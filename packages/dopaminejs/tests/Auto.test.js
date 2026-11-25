/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auto, destroyAuto } from '../src/auto.js';
import { celebrate } from '../src/celebrate.js';
import { showCertificate } from '../src/certificate.js';

vi.mock('../src/celebrate.js', () => ({ celebrate: vi.fn(), destroyCelebrations: vi.fn() }));
vi.mock('../src/certificate.js', () => ({ showCertificate: vi.fn(), destroyCertificate: vi.fn() }));

const here = dirname(fileURLToPath(import.meta.url));

// jsdom has no IntersectionObserver. This one records what it was given.
class FakeIO {
    static instances = [];
    constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.observed = new Set();
        this.disconnected = false;
        FakeIO.instances.push(this);
    }
    observe(target) { this.observed.add(target); }
    unobserve(target) { this.observed.delete(target); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
    send(target, isIntersecting = true) {
        this.callback([{ target, isIntersecting }]);
    }
}

const fakeHost = () => ({
    progress: {
        achievements: { first: { name: 'First' } },
        addXP: vi.fn(() => Promise.resolve()),
        unlockAchievement: vi.fn(() => Promise.resolve())
    },
    parts: { marker: true },
    ready: Promise.resolve()
});

const flush = () => new Promise((done) => setTimeout(done, 0));
const html = (markup) => {
    document.body.innerHTML = markup;
    return document.body.firstElementChild;
};
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

let host;
let warn;
let originalIO;

beforeEach(() => {
    host = fakeHost();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    originalIO = globalThis.IntersectionObserver;
    FakeIO.instances = [];
    globalThis.IntersectionObserver = FakeIO;
    celebrate.mockClear();
    showCertificate.mockClear();
});

afterEach(() => {
    destroyAuto();
    document.body.innerHTML = '';
    globalThis.IntersectionObserver = originalIO;
    vi.restoreAllMocks();
});

describe('triggers', () => {
    it('click awards XP', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="5">go</button>');
        auto({ host });
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(5);
    });

    it('click on a child of the element counts', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="5"><b>go</b></button>');
        auto({ host });
        click(button.firstElementChild);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(1);
    });

    it('submit awards XP', async () => {
        const form = html('<form data-dopamine-on="submit" data-dopamine-xp="3"><input></form>');
        auto({ host });
        form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(3);
    });

    it('ended on a video, which does not bubble, awards XP', async () => {
        const video = html('<video data-dopamine-on="ended" data-dopamine-xp="9"></video>');
        auto({ host });
        video.dispatchEvent(new window.Event('ended', { bubbles: false }));
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(9);
    });

    it('visible fires when the element enters the viewport and not before', async () => {
        const el = html('<section data-dopamine-on="visible" data-dopamine-xp="2"></section>');
        auto({ host });
        const [io] = FakeIO.instances;
        expect(io.options).toEqual({ threshold: 0 });
        expect(io.observed.has(el)).toBe(true);

        io.send(el, false);
        await flush();
        expect(host.progress.addXP).not.toHaveBeenCalled();

        io.send(el, true);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(2);
    });

    it('read observes a sentinel that is the last child, and fires when it shows', async () => {
        const el = html('<article data-dopamine-on="read" data-dopamine-xp="4"><p>one</p><p>two</p></article>');
        auto({ host });
        const [io] = FakeIO.instances;
        const sentinel = el.lastElementChild;

        expect(sentinel.hasAttribute('data-dopamine-sentinel')).toBe(true);
        expect(sentinel.getAttribute('aria-hidden')).toBe('true');
        expect(sentinel.style.cssText.replaceAll(' ', '')).toBe('display:block;height:1px;width:1px;');
        expect(io.observed.has(sentinel)).toBe(true);
        expect(io.observed.has(el)).toBe(false);

        io.send(sentinel);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(4);
        expect(el.querySelector('[data-dopamine-sentinel]')).toBeNull();
        expect(io.observed.size).toBe(0);
    });

    it('an unknown trigger warns once for that element', () => {
        const el = html('<div data-dopamine-on="hover" data-dopamine-xp="5"></div>');
        auto({ host });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('data-dopamine-on');
        expect(warn.mock.calls[0][0]).toContain('"hover"');
        click(el);
        expect(host.progress.addXP).not.toHaveBeenCalled();
    });
});

describe('elements that come and go', () => {
    it('an element added after auto() fires', async () => {
        html('<main></main>');
        auto({ host });
        const el = document.createElement('section');
        el.setAttribute('data-dopamine-on', 'visible');
        el.setAttribute('data-dopamine-xp', '6');
        document.querySelector('main').appendChild(el);
        await flush();

        const [io] = FakeIO.instances;
        expect(io.observed.has(el)).toBe(true);
        io.send(el);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(6);
    });

    it('an element added inside a new subtree is found', async () => {
        html('<main></main>');
        auto({ host });
        const wrap = document.createElement('div');
        wrap.innerHTML = '<p data-dopamine-on="read"></p>';
        document.querySelector('main').appendChild(wrap);
        await flush();
        expect(wrap.querySelector('[data-dopamine-sentinel]')).not.toBeNull();
    });

    it('an element removed before firing is unobserved and its sentinel is gone', async () => {
        const main = html('<main><article data-dopamine-on="read" data-dopamine-xp="4"><p>x</p></article></main>');
        auto({ host });
        const [io] = FakeIO.instances;
        const article = main.firstElementChild;
        const sentinel = article.lastElementChild;
        expect(io.observed.has(sentinel)).toBe(true);

        main.removeChild(article);
        await flush();

        expect(io.observed.size).toBe(0);
        expect(article.querySelector('[data-dopamine-sentinel]')).toBeNull();
        io.send(sentinel);
        await flush();
        expect(host.progress.addXP).not.toHaveBeenCalled();
    });

    it('its own sentinels are not tracked as new elements', async () => {
        html('<article data-dopamine-on="read"></article>');
        auto({ host });
        await flush();
        expect(FakeIO.instances[0].observed.size).toBe(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('a root that is an element only reacts inside it', async () => {
        html('<div id="in"><button data-dopamine-on="click" data-dopamine-xp="1"></button></div>'
            + '<button id="out" data-dopamine-on="click" data-dopamine-xp="1"></button>');
        auto({ host, root: document.getElementById('in') });
        click(document.getElementById('out'));
        await flush();
        expect(host.progress.addXP).not.toHaveBeenCalled();
        click(document.querySelector('#in button'));
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(1);
    });
});

describe('once per page load', () => {
    it('two clicks award once', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="5"></button>');
        auto({ host });
        click(button);
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(1);
    });

    it('data-dopamine-repeat awards every time', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-repeat data-dopamine-xp="5"></button>');
        auto({ host });
        click(button);
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(2);
    });

    it('a repeating visible element fires each time it enters the viewport', async () => {
        const el = html('<section data-dopamine-on="visible" data-dopamine-repeat data-dopamine-xp="1"></section>');
        auto({ host });
        const [io] = FakeIO.instances;
        io.send(el);
        io.send(el, false);
        io.send(el);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(2);
        expect(io.observed.has(el)).toBe(true);
    });

    it('is still once after destroyAuto() and a new auto()', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="5"></button>');
        auto({ host });
        click(button);
        destroyAuto();
        auto({ host });
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(1);
    });

    it('a fired read element is not watched again by a new auto()', () => {
        const el = html('<article data-dopamine-on="read"></article>');
        auto({ host });
        FakeIO.instances[0].send(el.lastElementChild);
        destroyAuto();
        auto({ host });
        expect(FakeIO.instances[1].observed.size).toBe(0);
        expect(el.querySelector('[data-dopamine-sentinel]')).toBeNull();
    });

    it('a second auto() replaces the first, so one click awards once', async () => {
        const button = html('<button data-dopamine-repeat data-dopamine-on="click" data-dopamine-xp="5"></button>');
        auto({ host });
        auto({ host });
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledTimes(1);
        expect(FakeIO.instances[0].disconnected).toBe(true);
    });
});

describe('XP', () => {
    const bad = ['__proto__', 'constructor', 'NaN', '1e309', '-5', '5.5', '+5', '0x10', '', '1001'];

    for (const value of bad) {
        it(`ignores ${JSON.stringify(value)} with one warning`, async () => {
            const button = html('<button data-dopamine-on="click" data-dopamine-repeat></button>');
            button.setAttribute('data-dopamine-xp', value);
            auto({ host });
            click(button);
            click(button);
            await flush();
            expect(host.progress.addXP).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toContain('data-dopamine-xp');
        });
    }

    it('trims " 7 " and awards 7', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp=" 7 "></button>');
        auto({ host });
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(7);
    });

    it('maxXP: 5000 allows 1001', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="1001"></button>');
        auto({ host, maxXP: 5000 });
        click(button);
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(1001);
    });

    it('a maxXP that is not a whole number of 0 or more falls back to 1000', async () => {
        for (const maxXP of [-1, 2.5, NaN, Infinity, '5000']) {
            const button = html('<button data-dopamine-on="click" data-dopamine-xp="1001"></button>');
            auto({ host, maxXP });
            click(button);
            await flush();
            destroyAuto();
        }
        expect(host.progress.addXP).not.toHaveBeenCalled();
    });

    it('0 does nothing and does not warn', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="0"></button>');
        auto({ host });
        click(button);
        await flush();
        expect(host.progress.addXP).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it('a rejected addXP is warned, not unhandled', async () => {
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        host.progress.addXP = vi.fn(() => Promise.reject(new Error('disk full')));
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="5"></button>');
        auto({ host });
        click(button);
        await flush();
        await flush();
        process.off('unhandledRejection', unhandled);
        expect(unhandled).not.toHaveBeenCalled();
        expect(warn.mock.calls.some((call) => String(call[0]).includes('addXP failed'))).toBe(true);
    });
});

describe('achievements', () => {
    for (const id of ['__proto__', 'constructor', 'toString', 'nope']) {
        it(`ignores ${id} with one warning`, async () => {
            const button = html('<button data-dopamine-on="click" data-dopamine-repeat></button>');
            button.setAttribute('data-dopamine-achievement', id);
            auto({ host });
            click(button);
            click(button);
            await flush();
            expect(host.progress.unlockAchievement).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toContain('data-dopamine-achievement');
        });
    }

    it('unlocks a known id', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-achievement="first"></button>');
        auto({ host });
        click(button);
        await flush();
        expect(host.progress.unlockAchievement).toHaveBeenCalledWith('first');
        expect(warn).not.toHaveBeenCalled();
    });

    it('a long value is cut to 40 characters in the warning', () => {
        const button = html('<button data-dopamine-on="click"></button>');
        button.setAttribute('data-dopamine-achievement', 'x'.repeat(200));
        auto({ host });
        click(button);
        expect(warn.mock.calls[0][0]).not.toContain('x'.repeat(41));
    });
});

describe('celebrate and certificate', () => {
    it('celebrate __proto__ does not throw', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-celebrate="__proto__"></button>');
        auto({ host });
        expect(() => click(button)).not.toThrow();
        await flush();
        expect(celebrate).toHaveBeenCalledWith('__proto__', { parts: host.parts, target: button });
    });

    it('celebrate with certificate fields passes parts, target and only the set fields', async () => {
        const el = html('<button data-dopamine-on="click" data-dopamine-celebrate="complete" '
            + 'data-dopamine-certificate-title="Done" data-dopamine-certificate-recipient="Ana"></button>');
        auto({ host });
        click(el);
        await vi.waitFor(() => expect(celebrate).toHaveBeenCalledTimes(1));
        expect(celebrate).toHaveBeenCalledWith('complete', {
            parts: host.parts,
            target: el,
            certificate: { title: 'Done', recipient: 'Ana' }
        });
        expect(showCertificate).not.toHaveBeenCalled();
    });

    it('certificate fields alone call showCertificate with only the set fields', async () => {
        const el = html('<button data-dopamine-on="click" data-dopamine-certificate-issuer="Acme" '
            + 'data-dopamine-certificate-date="Nov 25" data-dopamine-certificate-logo="A"></button>');
        auto({ host });
        click(el);
        await vi.waitFor(() => expect(showCertificate).toHaveBeenCalledTimes(1));
        expect(showCertificate).toHaveBeenCalledWith({ issuer: 'Acme', date: 'Nov 25', logo: 'A' });
        expect(celebrate).not.toHaveBeenCalled();
    });

    it('a rejected celebrate import is warned', async () => {
        celebrate.mockImplementationOnce(() => { throw new Error('boom'); });
        const el = html('<button data-dopamine-on="click" data-dopamine-celebrate="complete"></button>');
        auto({ host });
        click(el);
        await vi.waitFor(() => expect(warn).toHaveBeenCalled());
        expect(warn.mock.calls[0][0]).toContain('celebrate failed');
    });
});

describe('bounds and cleanup', () => {
    it('2000 visible elements make one IntersectionObserver, one MutationObserver and three listeners', () => {
        html(Array.from({ length: 2000 }, () => '<i data-dopamine-on="visible"></i>').join(''));
        const mutation = vi.spyOn(globalThis, 'MutationObserver');
        const add = vi.spyOn(document, 'addEventListener');
        auto({ host });
        expect(FakeIO.instances).toHaveLength(1);
        expect(FakeIO.instances[0].observed.size).toBe(2000);
        expect(mutation).toHaveBeenCalledTimes(1);
        expect(add).toHaveBeenCalledTimes(3);
    });

    it('destroyAuto() removes the listeners, disconnects both observers and removes every sentinel', async () => {
        html('<article data-dopamine-on="read"></article><article data-dopamine-on="read"></article>');
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        const disconnect = vi.spyOn(globalThis.MutationObserver.prototype, 'disconnect');
        auto({ host });
        expect(document.querySelectorAll('[data-dopamine-sentinel]')).toHaveLength(2);

        destroyAuto();

        expect(remove.mock.calls).toEqual(add.mock.calls);
        expect(remove).toHaveBeenCalledTimes(3);
        expect(FakeIO.instances[0].disconnected).toBe(true);
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('[data-dopamine-sentinel]')).toHaveLength(0);
    });

    it('after destroyAuto() a click does nothing, and a late observer callback does nothing', async () => {
        const button = html('<button data-dopamine-on="click" data-dopamine-xp="5"></button>'
            + '<section data-dopamine-on="visible" data-dopamine-xp="5"></section>');
        auto({ host });
        const section = document.querySelector('section');
        const [io] = FakeIO.instances;
        destroyAuto();
        click(button);
        io.send(section);
        await flush();
        expect(host.progress.addXP).not.toHaveBeenCalled();
    });

    it('destroyAuto() is safe twice and before any auto()', () => {
        expect(() => { destroyAuto(); destroyAuto(); }).not.toThrow();
    });

    it('destroyAuto() does not dispose the host', () => {
        host.dispose = vi.fn();
        auto({ host });
        destroyAuto();
        expect(host.dispose).not.toHaveBeenCalled();
    });

    it('with no IntersectionObserver there is one warning, and click still works', async () => {
        delete globalThis.IntersectionObserver;
        const el = html('<div><i data-dopamine-on="visible"></i><i data-dopamine-on="read"></i>'
            + '<button data-dopamine-on="click" data-dopamine-xp="5"></button></div>');
        auto({ host });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('IntersectionObserver');
        expect(el.querySelector('[data-dopamine-sentinel]')).toBeNull();
        click(el.querySelector('button'));
        await flush();
        expect(host.progress.addXP).toHaveBeenCalledWith(5);
    });

    it('auto() with no host throws a TypeError', () => {
        expect(() => auto()).toThrow(TypeError);
        expect(() => auto({})).toThrow(TypeError);
        expect(() => auto({ host: {} })).toThrow(TypeError);
        expect(() => auto({ host: { progress: null } })).toThrow(TypeError);
    });

    it('importing the module adds no listener and no node', async () => {
        vi.resetModules();
        const add = vi.spyOn(document, 'addEventListener');
        const before = document.querySelectorAll('*').length;
        await import('../src/auto.js');
        expect(add).not.toHaveBeenCalled();
        expect(document.querySelectorAll('*').length).toBe(before);
    });
});

describe('the auto subpath is separate and wired', () => {
    const src = resolve(here, '../src');
    const graph = (entry) => {
        const seen = new Set();
        const walk = (file) => {
            if (seen.has(file)) return;
            seen.add(file);
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/(?:from|import)\s+['"](\.[^'"]+\.js)['"]/g)) {
                walk(resolve(dirname(file), match[1]));
            }
        };
        walk(resolve(src, entry));
        return [...seen].map((file) => file.slice(src.length).replaceAll('\\', '/'));
    };

    it('the main entry does not reach auto.js', () => {
        expect(graph('index.js')).not.toContain('/auto.js');
    });

    it('auto.js has no static imports and loads celebrate and certificate with import()', () => {
        const source = readFileSync(resolve(src, 'auto.js'), 'utf8');
        expect(graph('auto.js')).toEqual(['/auto.js']);
        expect(source).not.toMatch(/^\s*import\s/m);
        expect(source).toContain("import('./celebrate.js')");
        expect(source).toContain("import('./certificate.js')");
    });

    it('is exported with types and both module formats, and built as its own entry', () => {
        const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));
        const vite = readFileSync(resolve(here, '../vite.config.js'), 'utf8');

        expect(pkg.exports['./auto']).toEqual({
            types: './types/auto.d.ts',
            import: './dist/auto.js',
            require: './dist/auto.cjs'
        });
        expect(readFileSync(resolve(here, '../types/auto.d.ts'), 'utf8')).toContain('destroyAuto');
        expect(vite).toContain("auto: resolve(__dirname, 'src/auto.js')");
    });

    it('the all-in-one file is a script tag file, not an export', () => {
        const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));
        expect(JSON.stringify(pkg.exports)).not.toContain('dopamine.all.global.js');
        expect(pkg.scripts.build).toContain('vite.config.all.js');
    });
});
