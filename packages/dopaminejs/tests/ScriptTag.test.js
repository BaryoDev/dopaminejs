import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from 'vite';
import { JSDOM } from 'jsdom';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(here, '..');
const root = resolve(pkgDir, '../..');

let outDir;
let code;

beforeAll(async () => {
    // Built here, into a temp folder, because the suite runs before the
    // package build in CI.
    outDir = mkdtempSync(join(tmpdir(), 'script-tag-'));
    await build({
        root: pkgDir,
        configFile: join(pkgDir, 'vite.config.iife.js'),
        logLevel: 'silent',
        build: { outDir }
    });
    code = readFileSync(join(outDir, 'dopamine.global.js'), 'utf8');
}, 60000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('script tag build', () => {
    it('sets window.Dopamine with no module loader and runs init and addXP', async () => {
        const dom = new JSDOM('<!doctype html><body></body>', {
            url: 'https://example.test/',
            runScripts: 'outside-only'
        });
        const { window } = dom;
        expect(window.require).toBeUndefined();
        expect(window.module).toBeUndefined();
        expect(window.define).toBeUndefined();

        window.eval(code);

        const { RewardSystem, DataService, createDopamine } = window.Dopamine;
        expect(typeof RewardSystem).toBe('function');
        expect(typeof createDopamine).toBe('function');

        const rewards = new RewardSystem(new DataService());
        await rewards.init();
        const events = [];
        rewards.on('xp_gained', (e) => events.push(e));
        await rewards.addXP(25);

        expect(events).toHaveLength(1);
        expect(rewards.getXPForNextLevel().needed).toBeGreaterThan(0);
        window.close();
    });

    it('leaves the rest of the output folder alone', () => {
        const dir = mkdtempSync(join(tmpdir(), 'script-tag-files-'));
        const stray = join(dir, 'keep.txt');
        writeFileSync(stray, 'kept');
        return build({
            root: pkgDir,
            configFile: join(pkgDir, 'vite.config.iife.js'),
            logLevel: 'silent',
            build: { outDir: dir }
        }).then(() => {
            // emptyOutDir is off, so the main build's files survive.
            expect(readFileSync(stray, 'utf8')).toBe('kept');
            rmSync(dir, { recursive: true, force: true });
        });
    }, 60000);
});

describe('check-versions --dist and the unpkg and jsdelivr fields', () => {
    const script = join(root, 'scripts/check-versions.js');

    function fixture(withFile) {
        const dir = mkdtempSync(join(tmpdir(), 'script-tag-dist-'));
        const pkg = join(dir, 'packages', 'core');
        mkdirSync(join(pkg, 'dist'), { recursive: true });
        writeFileSync(join(pkg, 'LICENSE'), 'MPL-2.0');
        writeFileSync(
            join(pkg, 'package.json'),
            JSON.stringify({
                name: 'dopaminejs',
                version: '3.0.0',
                license: 'MPL-2.0',
                repository: 'x',
                unpkg: './dist/dopamine.global.js',
                jsdelivr: './dist/dopamine.global.js'
            })
        );
        if (withFile) writeFileSync(join(pkg, 'dist', 'dopamine.global.js'), '');
        return dir;
    }

    it('fails when the file is not built', () => {
        const dir = fixture(false);
        const result = spawnSync(process.execPath, [script, '--dist'], { cwd: dir, encoding: 'utf8' });
        rmSync(dir, { recursive: true, force: true });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('"unpkg" points at ./dist/dopamine.global.js');
        expect(result.stderr).toContain('"jsdelivr" points at ./dist/dopamine.global.js');
    });

    it('passes when the file exists', () => {
        const dir = fixture(true);
        const result = spawnSync(process.execPath, [script, '--dist'], { cwd: dir, encoding: 'utf8' });
        rmSync(dir, { recursive: true, force: true });
        expect(result.status).toBe(0);
    });

    it('the core manifest points unpkg and jsdelivr at the script tag file', () => {
        const core = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
        expect(core.unpkg).toBe('./dist/dopamine.global.js');
        expect(core.jsdelivr).toBe('./dist/dopamine.global.js');
        expect(core.files).toContain('dist');
    });
});
