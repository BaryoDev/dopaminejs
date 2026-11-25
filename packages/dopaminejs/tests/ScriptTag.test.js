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
let allDir;
let allCode;

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
    allDir = mkdtempSync(join(tmpdir(), 'script-tag-all-'));
    await build({
        root: pkgDir,
        configFile: join(pkgDir, 'vite.config.all.js'),
        logLevel: 'silent',
        build: { outDir: allDir }
    });
    allCode = readFileSync(join(allDir, 'dopamine.all.global.js'), 'utf8');
}, 60000);

afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
    rmSync(allDir, { recursive: true, force: true });
});

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

    it('does not include auto, so the plain file stays as it was', () => {
        const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/', runScripts: 'outside-only' });
        dom.window.eval(code);
        expect(dom.window.Dopamine.auto).toBeUndefined();
        expect(dom.window.Dopamine.celebrate).toBeUndefined();
        dom.window.close();
    });

    it('leaves the rest of the output folder alone', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'script-tag-files-'));
        try {
            const stray = join(dir, 'keep.txt');
            writeFileSync(stray, 'kept');
            await build({
                root: pkgDir,
                configFile: join(pkgDir, 'vite.config.iife.js'),
                logLevel: 'silent',
                build: { outDir: dir }
            });
            // emptyOutDir is off, so the main build's files survive.
            expect(readFileSync(stray, 'utf8')).toBe('kept');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 60000);
});

describe('all-in-one script tag build', () => {
    // createDopamine() builds a particle canvas, and jsdom has no 2d context.
    const stubCanvas = (window) => {
        window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
    };
    const page = () => {
        const dom = new JSDOM(
            '<!doctype html><body><button data-dopamine-on="click" data-dopamine-xp="5">go</button></body>',
            { url: 'https://example.test/', runScripts: 'dangerously' }
        );
        stubCanvas(dom.window);
        return dom;
    };
    const load = (window, attributes) => {
        const script = window.document.createElement('script');
        for (const name of attributes) script.setAttribute(name, '');
        script.textContent = allCode;
        window.document.body.appendChild(script);
    };
    const xpOf = (window) => {
        const saved = JSON.parse(window.localStorage.getItem('dopamine_player') ?? '{"xpBy":{}}');
        return Object.values(saved.xpBy).reduce((sum, value) => sum + value, 0);
    };
    const wait = () => new Promise((done) => setTimeout(done, 50));

    it('has the main entry, celebrate, the certificate and auto, with no module loader', () => {
        const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/', runScripts: 'outside-only' });
        expect(dom.window.require).toBeUndefined();
        dom.window.eval(allCode);
        const names = Object.keys(dom.window.Dopamine);
        for (const name of ['createDopamine', 'RewardSystem', 'celebrate', 'destroyCelebrations',
            'showCertificate', 'destroyCertificate', 'auto', 'destroyAuto']) {
            expect(names).toContain(name);
        }
        dom.window.close();
    });

    it('is one file: the dynamic imports are inlined', () => {
        expect(allCode).not.toMatch(/import\(\s*['"]\.\//);
        expect(allCode).not.toMatch(/\brequire\(/);
    });

    it('without data-dopamine-auto, loading adds no listener to document and awards nothing', async () => {
        const dom = page();
        const { window } = dom;
        const added = [];
        const real = window.document.addEventListener.bind(window.document);
        window.document.addEventListener = (...args) => { added.push(args[0]); return real(...args); };
        load(window, []);
        window.document.querySelector('button').click();
        await wait();
        expect(added).toEqual([]);
        expect(xpOf(window)).toBe(0);
        window.close();
    });

    it('with data-dopamine-auto on the script, a click awards the XP', async () => {
        const dom = page();
        const { window } = dom;
        load(window, ['data-dopamine-auto']);
        window.document.querySelector('button').click();
        await wait();
        expect(xpOf(window)).toBe(5);
        window.Dopamine.destroyAuto();
        window.close();
    });

    it('in <head> with no defer, it waits for the body, then a click awards the XP', async () => {
        // The tag runs while the parser is still in <head>, so there is no body yet.
        // The file is evaluated from inside that tag, so currentScript is the tag.
        let bodyAtLoad;
        const dom = new JSDOM(
            '<!doctype html><html><head><script data-dopamine-auto>window.loadAll()</script></head>'
            + '<body><button data-dopamine-on="click" data-dopamine-xp="5">go</button></body></html>',
            {
                url: 'https://example.test/',
                runScripts: 'dangerously',
                beforeParse(window) {
                    stubCanvas(window);
                    window.loadAll = () => {
                        bodyAtLoad = window.document.body;
                        window.eval(allCode);
                    };
                }
            }
        );
        const { window } = dom;
        expect(bodyAtLoad).toBeNull();
        expect(window.Dopamine).toBeDefined();
        if (window.document.readyState === 'loading') {
            await new Promise((done) => window.document.addEventListener('DOMContentLoaded', done, { once: true }));
        }
        window.document.querySelector('button').click();
        await wait();
        expect(xpOf(window)).toBe(5);
        window.Dopamine.destroyAuto();
        window.close();
    });
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
