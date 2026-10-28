/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestHost, conformanceFailures, loadFixtures } from '../src/testing.js';
import { copySpec } from '../../../scripts/copy-spec.js';

const here = dirname(fileURLToPath(import.meta.url));
const rootSpec = resolve(here, '../../../spec');

let hosts = [];
afterEach(() => {
    for (const test of hosts) test.dispose();
    hosts = [];
});
const host = (options) => {
    const test = createTestHost(options);
    hosts.push(test);
    return test;
};

describe('createTestHost', () => {
    it('records popups bursts and sounds', async () => {
        const test = host();
        await test.ready;
        test.parts.ui.popup({ kind: 'notice', title: 'hi' });
        test.parts.particles.burst('confetti', { x: 1, y: 2 });
        test.parts.sound.play('xp');
        await test.progress.addXP(5, 'one');
        expect(test.popups).toEqual([{ kind: 'notice', title: 'hi' }]);
        expect(test.bursts).toEqual([{ kind: 'confetti', at: { x: 1, y: 2 }, opts: undefined }]);
        expect(test.sounds).toEqual(['xp', 'xp']);
        expect(test.huds.length).toBeGreaterThan(0);
    });

    it('logs every event on the bus, plugin events included', async () => {
        const test = host();
        await test.ready;
        await test.progress.addXP(5, 'one');
        test.progress.emit('mine:thing', { a: 1 });
        const names = test.events.log.map((e) => e.event);
        expect(names).toContain('xp_gained');
        expect(test.events.log.at(-1)).toEqual({ event: 'mine:thing', data: { a: 1 } });
    });

    it('advancing the clock moves the streak day', async () => {
        const test = host({ clock: '2026-03-01T10:00:00' });
        await test.ready;
        expect(test.clock.localDate()).toBe('2026-03-01');
        await test.progress.addXP(5, 'one');
        test.advanceDays(1);
        expect(test.clock.localDate()).toBe('2026-03-02');
        await test.progress.addXP(5, 'two');
        expect(test.progress.snapshot().streak.current).toBe(2);
        test.advance(60 * 60 * 1000);
        expect(test.clock.now()).toBe(new Date('2026-03-02T11:00:00').getTime());
    });

    it('lets a part replace its recorder', async () => {
        const seen = [];
        const test = host({ parts: { sound: { play: (key) => seen.push(key), destroy() {} } } });
        await test.ready;
        await test.progress.addXP(5, 'one');
        expect(seen).toContain('xp');
        expect(test.sounds).toEqual([]);
    });

    it('rejects a clock string it cannot read', () => {
        expect(() => createTestHost({ clock: 'tomorrow' })).toThrow();
    });
});

describe('loadFixtures', () => {
    it('the fixture loader returns every suite including merge', () => {
        const { contract, schema, suites } = loadFixtures();
        const files = readdirSync(join(rootSpec, 'fixtures')).filter((f) => f.endsWith('.json'));
        expect(Object.keys(suites).sort()).toEqual(files.map((f) => f.replace('.json', '')).sort());
        expect(suites.merge.cases.length).toBeGreaterThan(0);
        expect(contract).toBe(3);
        expect(typeof schema).toBe('object');
    });

    it('the build copy of spec matches the repo root', () => {
        const out = mkdtempSync(join(tmpdir(), 'dj-spec-'));
        try {
            const target = join(out, 'spec');
            copySpec(rootSpec, target);
            const list = (dir) => readdirSync(dir, { recursive: true }).sort();
            expect(list(target)).toEqual(list(rootSpec));
            for (const file of list(rootSpec).filter((f) => f.endsWith('.json') || f === 'VERSION')) {
                expect(readFileSync(join(target, file), 'utf8')).toBe(readFileSync(join(rootSpec, file), 'utf8'));
            }
            expect(existsSync(join(target, 'fixtures', 'merge.json'))).toBe(true);
        } finally {
            rmSync(out, { recursive: true, force: true });
        }
    });

    it('the package copy, when built, matches the repo root', () => {
        const built = resolve(here, '../spec');
        if (!existsSync(built)) return;
        expect(readFileSync(join(built, 'VERSION'), 'utf8')).toBe(readFileSync(join(rootSpec, 'VERSION'), 'utf8'));
        expect(loadFixtures(built).suites.merge).toEqual(loadFixtures(rootSpec).suites.merge);
    });
});

describe('known-bad parts', () => {
    const goodPlugin = () => ({ name: 'good', version: '1.0.0', api: 3, install: () => () => {} });

    it('a plugin that leaks a listener fails conformance.plugin', async () => {
        const leaky = () => ({
            name: 'leaky', version: '1.0.0', api: 3,
            install: (ctx) => { ctx.progress.on('xp_gained', () => {}); }
        });
        expect(await conformanceFailures('plugin', goodPlugin)).toEqual([]);
        expect(await conformanceFailures('plugin', leaky)).toEqual(['leaves no listeners, timers or DOM behind once disposed']);
    });

    it('a plugin that leaves a timer or DOM behind fails conformance.plugin', async () => {
        const timer = () => ({ name: 't', version: '1.0.0', api: 3, install: (ctx) => { ctx.events.on('xp_gained', () => { setTimeout(() => {}, 100000); }); } });
        const dom = () => ({ name: 'd', version: '1.0.0', api: 3, install: () => { document.body.append(document.createElement('p')); } });
        expect(await conformanceFailures('plugin', timer)).toHaveLength(1);
        expect(await conformanceFailures('plugin', dom)).toHaveLength(1);
        document.body.innerHTML = '';
    });

    it('a plugin built for another api fails conformance.plugin', async () => {
        const old = () => ({ name: 'old', version: '1.0.0', api: 2, install() {} });
        expect((await conformanceFailures('plugin', old)).length).toBeGreaterThan(0);
    });

    it('a part that throws on an unknown burst kind fails conformance.particles', async () => {
        const strict = () => ({
            burst(kind) {
                if (!['confetti', 'sparkle', 'fire', 'stars', 'coins'].includes(kind)) throw new Error('unknown kind');
            },
            destroy() {}
        });
        expect(await conformanceFailures('particles', strict)).toEqual(['treats an unknown kind as a no-op']);
    });

    it('a particle part that skips a kind fails conformance.particles', async () => {
        const partial = () => ({
            burst(kind) {
                if (kind === 'coins') throw new Error('not supported');
            },
            destroy() {}
        });
        expect(await conformanceFailures('particles', partial)).toEqual(['draws every burst kind without throwing']);
    });

    it('a storage that shares keys fails conformance.storage', async () => {
        const bad = () => ({ getItem: () => 'x', setItem() {}, removeItem() {} });
        expect((await conformanceFailures('storage', bad)).length).toBeGreaterThan(0);
    });

    it('a ui that leaves DOM behind fails conformance.ui', async () => {
        const bad = () => ({
            root: null,
            hud() { document.body.append(document.createElement('div')); },
            popup() {}, text() {}, destroy() {}
        });
        expect(await conformanceFailures('ui', bad)).toContain('leaves no DOM behind after destroy');
        document.body.innerHTML = '';
    });

    it('a sound part that throws on an unknown key fails conformance.sound', async () => {
        const bad = () => ({
            play(key) { if (key !== 'xp') throw new Error('unknown'); },
            destroy() {}
        });
        expect(await conformanceFailures('sound', bad)).toContain('treats an unknown key as a no-op');
    });

    it('rejects an unknown suite name', async () => {
        await expect(conformanceFailures('nope', () => ({}))).rejects.toThrow();
    });
});

