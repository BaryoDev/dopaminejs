/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDopamine, HOST_API } from '../src/dopamine/host.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';

const plugin = (name, install = () => {}, extra = {}) => ({ name, version: '1.0.0', api: 3, install, ...extra });

const codeOf = (fn) => {
    try {
        fn();
    } catch (error) {
        return error.code;
    }
    return null;
};

describe('createDopamine', () => {
    let hosts;
    let storage;

    const make = (options = {}) => {
        const host = createDopamine({ particles: false, storage, ...options });
        hosts.push(host);
        return host;
    };

    beforeEach(() => {
        hosts = [];
        storage = createMemoryStorage();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        for (const host of hosts) host.dispose();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('exports the host api number', () => {
        expect(HOST_API).toBe(3);
    });

    it('installs plugins in array order', () => {
        const seen = [];
        make({ plugins: [plugin('a', () => { seen.push('a'); }), plugin('b', () => { seen.push('b'); })] });
        expect(seen).toEqual(['a', 'b']);
    });

    it('throws plugin_order when after names a plugin not installed yet', () => {
        const options = { plugins: [plugin('b', () => {}, { after: ['a'] }), plugin('a')] };
        expect(codeOf(() => make(options))).toBe('plugin_order');
    });

    it('accepts after when the named plugin comes first', () => {
        expect(() => make({ plugins: [plugin('a'), plugin('b', () => {}, { after: ['a'] })] })).not.toThrow();
    });

    it('throws plugin_requires when a required part is null', () => {
        const options = { particles: false, plugins: [plugin('needs', () => {}, { requires: ['particles'] })] };
        expect(codeOf(() => make(options))).toBe('plugin_requires');
    });

    it('throws plugin_api with both versions in the message', () => {
        const install = vi.fn();
        let message = '';
        try {
            make({ plugins: [{ name: 'old', version: '1.0.0', api: 2, install }] });
        } catch (error) {
            expect(error.code).toBe('plugin_api');
            message = error.message;
        }
        expect(message).toContain('2');
        expect(message).toContain('3');
        expect(install).not.toHaveBeenCalled();
    });

    it('throws plugin_duplicate for a repeated name', () => {
        expect(codeOf(() => make({ plugins: [plugin('a'), plugin('a')] }))).toBe('plugin_duplicate');
    });

    it('disposes plugins in reverse order', () => {
        const seen = [];
        const host = make({
            plugins: [
                plugin('a', () => () => seen.push('a')),
                plugin('b', () => () => seen.push('b')),
                plugin('c', () => () => seen.push('c'))
            ]
        });
        host.dispose();
        expect(seen).toEqual(['c', 'b', 'a']);
    });

    it('removes listeners added through ctx.events when the plugin forgets', async () => {
        const listener = vi.fn();
        const host = make({ plugins: [plugin('a', (ctx) => { ctx.events.on('xp_gained', listener); })] });
        await host.ready;

        await host.progress.addXP(5, 'one');
        expect(listener).toHaveBeenCalledTimes(1);

        host.dispose();
        host.progress.emit('xp_gained', {});
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('removes listeners when a plugin is disposed through use', async () => {
        const listener = vi.fn();
        const host = make();
        const dispose = host.use(plugin('a', (ctx) => { ctx.events.on('custom', listener); }));
        host.progress.emit('custom', 1);
        dispose();
        host.progress.emit('custom', 2);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('ready waits for an async install', async () => {
        let finished = false;
        const host = make({
            plugins: [plugin('slow', async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                finished = true;
            })]
        });
        expect(finished).toBe(false);
        await host.ready;
        expect(finished).toBe(true);
    });

    it('rejects ready when an async install fails', async () => {
        const host = make({ plugins: [plugin('bad', async () => { throw new Error('nope'); })] });
        await expect(host.ready).rejects.toThrow('nope');
    });

    it('disposes the installed plugins, last first, when an async install fails', async () => {
        const seen = [];
        const init = vi.fn();
        const host = make({
            progress: { on: () => () => {}, off: () => {}, init },
            plugins: [
                plugin('a', () => () => seen.push('a')),
                plugin('b', () => () => seen.push('b')),
                plugin('bad', async () => { throw new Error('nope'); })
            ]
        });
        await expect(host.ready).rejects.toThrow('nope');
        expect(seen).toEqual(['b', 'a']);
        expect(init).not.toHaveBeenCalled();
    });

    it('lets a name be used again after it was disposed or failed', () => {
        const host = make();
        const off = host.use(plugin('again'));
        off();
        const second = vi.fn();
        host.use(plugin('again', second));
        expect(second).toHaveBeenCalledTimes(1);

        expect(() => host.use(plugin('broken', () => { throw new Error('nope'); }))).toThrow('nope');
        const third = vi.fn();
        host.use(plugin('broken', third));
        expect(third).toHaveBeenCalledTimes(1);
    });

    it('refuses plugin names outside a-z, 0-9 and -', () => {
        for (const name of ['Bad', 'a b', 'a_b', 'a:b', '', 'é']) {
            expect(codeOf(() => make({ plugins: [plugin(name)] }))).toBe('plugin_invalid');
        }
    });

    it('keeps plugin storage keys apart and away from core keys', () => {
        let ctxA;
        let ctxAB;
        make({ plugins: [plugin('a', (ctx) => { ctxA = ctx; }), plugin('a-b', (ctx) => { ctxAB = ctx; })] });
        ctxA.storage.setItem('b-c', 'one');
        ctxAB.storage.setItem('c', 'two');
        expect(storage.getItem('dopamine_plugin_a:b-c')).toBe('one');
        expect(storage.getItem('dopamine_plugin_a-b:c')).toBe('two');
        ctxA.storage.setItem('../player', 'x');
        expect(storage.getItem('dopamine_player')).toBeNull();
    });

    it('use installs later and returns a disposer', () => {
        const dispose = vi.fn();
        const host = make();
        const off = host.use(plugin('later', () => dispose));
        expect(dispose).not.toHaveBeenCalled();
        off();
        expect(dispose).toHaveBeenCalledTimes(1);
        off();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('use disposes an async install that is still running', async () => {
        const dispose = vi.fn();
        const host = make();
        const off = host.use(plugin('slow', async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return dispose;
        }));
        off();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('a part factory returning null falls back to the default', () => {
        const factory = vi.fn(() => null);
        const host = make({ sound: factory });
        expect(factory).toHaveBeenCalledTimes(1);
        expect(host.parts.sound).toBeInstanceOf(SoundManager);
    });

    it('uses a part value as given and false as none', () => {
        const sound = { play: vi.fn() };
        const host = make({ sound, haptics: false });
        expect(host.parts.sound).toBe(sound);
        expect(host.parts.haptics).toBeNull();
    });

    it('parts has no setters', () => {
        const host = make();
        expect(Object.isFrozen(host.parts)).toBe(true);
        expect(() => {
            'use strict';
            host.parts.ui = null;
        }).toThrow();
        expect(() => {
            'use strict';
            host.parts.extra = 1;
        }).toThrow();
    });

    it('gives plugins live getters, never captured parts', () => {
        let seenCtx;
        make({ plugins: [plugin('a', (ctx) => { seenCtx = ctx; })] });
        const before = seenCtx.parts.sound;
        expect(seenCtx.parts.sound).toBe(before);
        const descriptor = Object.getOwnPropertyDescriptor(seenCtx.parts, 'sound');
        expect(typeof descriptor.get).toBe('function');
        expect(descriptor.set).toBeUndefined();
    });

    it('plugin() returns what another plugin exposed', () => {
        const handle = { hello: () => 'hi' };
        let got;
        let missing;
        make({
            plugins: [
                plugin('a', (ctx) => { ctx.expose(handle); }),
                plugin('b', (ctx) => { got = ctx.plugin('a'); missing = ctx.plugin('zzz'); })
            ]
        });
        expect(got).toBe(handle);
        expect(missing).toBeNull();
    });

    it('namespaces plugin storage as dopamine_plugin_<plugin>:', () => {
        let ctxA;
        let ctxB;
        make({ plugins: [plugin('a', (ctx) => { ctxA = ctx; }), plugin('b', (ctx) => { ctxB = ctx; })] });

        ctxA.storage.setItem('key', 'one');
        expect(storage.getItem('dopamine_plugin_a:key')).toBe('one');
        expect(ctxB.storage.getItem('key')).toBeNull();
        ctxA.storage.removeItem('key');
        expect(storage.getItem('dopamine_plugin_a:key')).toBeNull();
    });

    it('limits ctx.events.emit to the plugin namespace', () => {
        const listener = vi.fn();
        let ctx;
        const host = make({ plugins: [plugin('a', (c) => { ctx = c; })] });
        host.events.on('a:ping', listener);

        ctx.events.emit('a:ping', 1);
        expect(listener).toHaveBeenCalledWith(1);
        expect(codeOf(() => ctx.events.emit('xp_gained', {}))).toBe('plugin_event');
    });

    it('a throwing listener does not stop the others', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const second = vi.fn();
        const host = make();
        host.events.on('custom', () => { throw new Error('boom'); });
        host.events.on('custom', second);

        host.progress.emit('custom', 1);
        expect(second).toHaveBeenCalledWith(1);
    });

    it('rejects a progress part without on and off', () => {
        expect(codeOf(() => make({ progress: {} }))).toBe('invalid_progress');
    });

    it('throws disposed when used after dispose', () => {
        const host = make();
        host.dispose();
        expect(codeOf(() => host.use(plugin('late')))).toBe('disposed');
    });

    it('shows the saved player in the HUD once ready', async () => {
        const first = make();
        await first.ready;
        await first.progress.addXP(40, 'seed');
        await first.progress.save();
        first.dispose();

        const second = make();
        await second.ready;
        expect(document.querySelector('.xp-text').textContent).toContain('40');
    });

    it('draws xp, level and streak after progress events', async () => {
        const host = make();
        await host.ready;
        await host.progress.addXP(30, 'work');

        expect(document.querySelector('.xp-bar-fill').style.width).not.toBe('0%');
        expect(document.querySelector('.level-number').textContent).toBe(String(host.progress.snapshot().level));
        expect(document.querySelector('.streak-number').textContent).toBe(String(host.progress.snapshot().streak.current));
    });

    it('plays the sound part on xp and shows a popup for a level up', async () => {
        const sound = { play: vi.fn() };
        const host = make({ sound });
        await host.ready;
        await host.progress.addXP(1, 'tiny');
        expect(sound.play).toHaveBeenCalledWith('xp');

        await host.progress.addXP(100000, 'big');
        expect(sound.play).toHaveBeenCalledWith('level_up');
        expect(document.querySelector('.level-up-overlay')).not.toBeNull();
    });

    it('shows an achievement popup with the icon as text by default', async () => {
        const host = make();
        await host.ready;
        host.progress.defineAchievement('a1', { name: 'First', description: 'Did it', icon: '<img src=x>', xp: 5, check: () => false });
        await host.progress.unlockAchievement('a1');

        expect(document.querySelector('.achievement-name').textContent).toBe('First');
        expect(document.querySelector('.achievement-icon img')).toBeNull();
    });

    it('passes streakDays to the default progress object', async () => {
        const host = make({ streakDays: 'record' });
        await host.ready;
        await host.progress.addXP(5);
        expect(host.progress.snapshot().streak.current).toBe(0);
    });

    it('passes builtinAchievements to the default progress object', async () => {
        const host = make({ builtinAchievements: false });
        await host.ready;
        await host.progress.record('g');
        expect(host.progress.snapshot().achievements).toEqual({});
    });

    it('leaves no DOM behind after dispose', async () => {
        const host = make();
        await host.ready;
        host.dispose();
        expect(document.body.children.length).toBe(0);
    });
});
