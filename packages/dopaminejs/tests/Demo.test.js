/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as everything from '../src/all.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const demo = readFileSync(resolve(root, 'demo/index.html'), 'utf8');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

const PRESETS = ['complete', 'milestone', 'streak', 'certificate'];
const TRIGGERS = ['click', 'submit', 'ended', 'read', 'visible'];
const ALL_JS = /https:\/\/cdn\.jsdelivr\.net\/npm\/dopaminejs@([^/"]+)\/dist\/dopamine\.all\.global\.js"\s+integrity="([^"]+)"/;

const page = new DOMParser().parseFromString(demo, 'text/html');
const attr = (name) => [...page.querySelectorAll(`[${name}]`)].map((el) => el.getAttribute(name));

describe('demo page pins', () => {
    const readmePin = readme.match(ALL_JS);
    const demoPin = demo.match(ALL_JS);

    it('should find the all-in-one script tag in both the README and the demo', () => {
        expect(readmePin).not.toBeNull();
        expect(demoPin).not.toBeNull();
    });

    it('should pin the version the README pins', () => {
        expect(demoPin[1]).toBe(readmePin[1]);
    });

    it('should use the integrity value the README gives for dopamine.all.global.js', () => {
        expect(demoPin[2]).toBe(readmePin[2]);
    });

    it('should pin one exact version in every dopaminejs URL', () => {
        const versions = [...demo.matchAll(/dopaminejs@([^/"'\s]+)\//g)].map((m) => m[1]);
        expect(versions.length).toBeGreaterThan(1);
        for (const version of versions) {
            expect(version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(version).toBe(readmePin[1]);
        }
    });

    it('should give every CDN script and stylesheet integrity and crossorigin anonymous', () => {
        const external = [...page.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
            .filter((el) => /^https?:\/\//.test(el.getAttribute('src') ?? el.getAttribute('href')));
        expect(external.length).toBeGreaterThanOrEqual(2);
        for (const el of external) {
            expect(el.getAttribute('integrity'), el.outerHTML).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
            expect(el.getAttribute('crossorigin'), el.outerHTML).toBe('anonymous');
        }
    });

    it('should not use data-dopamine-auto, because the page defines its own achievements', () => {
        expect(demo).not.toMatch(/data-dopamine-auto/);
    });
});

describe('demo page attributes', () => {
    let host;
    let maxXP;
    let status;
    let warn;
    let original;

    beforeAll(async () => {
        original = HTMLCanvasElement.prototype.getContext;
        // createDopamine() builds a particle canvas, and jsdom has no 2d context.
        HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        document.body.innerHTML = page.body.innerHTML;
        // The demo's own inline script, run as written. It reads window.Dopamine,
        // and this one records the host it hands to auto().
        const Dopamine = {
            ...everything,
            auto: (options) => {
                host = options.host;
                maxXP = options.maxXP ?? 1000;
                return everything.auto(options);
            }
        };
        const inline = [...page.querySelectorAll('script:not([src])')].map((el) => el.textContent).join('\n');
        new Function('Dopamine', inline)(Dopamine);
        await host.ready;
        await new Promise((done) => setTimeout(done, 0));
        status = document.getElementById('status');
    });

    afterAll(() => {
        everything.destroyAuto();
        host?.dispose();
        HTMLCanvasElement.prototype.getContext = original;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should start the host and set the ready marker to the pinned version', () => {
        expect(host).toBeDefined();
        expect(status.getAttribute('data-ready')).toBe(demo.match(ALL_JS)[1]);
        // The marker is not in the markup, so only the script can set it.
        expect(page.getElementById('status').hasAttribute('data-ready')).toBe(false);
    });

    it('should use only whole number XP up to the limit auto() applies', () => {
        const values = attr('data-dopamine-xp');
        expect(values.length).toBeGreaterThan(0);
        for (const value of values) {
            expect(value).toMatch(/^\d+$/);
            expect(Number(value)).toBeLessThanOrEqual(maxXP);
        }
    });

    it('should use only known celebrate presets', () => {
        const values = attr('data-dopamine-celebrate');
        expect(values.length).toBeGreaterThan(0);
        for (const value of values) expect(PRESETS).toContain(value);
    });

    it('should use only known triggers', () => {
        const values = attr('data-dopamine-on');
        expect(values.length).toBeGreaterThan(0);
        for (const value of values) expect(TRIGGERS).toContain(value);
    });

    it('should name only achievements the inline script defines', () => {
        const ids = attr('data-dopamine-achievement');
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            expect(Object.prototype.hasOwnProperty.call(host.progress.achievements, id), id).toBe(true);
        }
    });

    it('should cover the course, blog, docs and form cases', () => {
        const on = (id) => page.getElementById(id).querySelectorAll('[data-dopamine-on]');
        expect(page.getElementById('lesson').getAttribute('data-dopamine-on')).toBe('ended');
        expect(page.getElementById('lesson').getAttribute('data-dopamine-celebrate')).toBe('certificate');
        expect([...on('blog')].map((el) => el.getAttribute('data-dopamine-on'))).toEqual(['read']);
        expect(on('docs').length).toBe(3);
        expect(page.getElementById('signup').getAttribute('data-dopamine-on')).toBe('submit');
    });

    it('should warn about nothing but the missing IntersectionObserver', () => {
        const messages = warn.mock.calls.map((call) => String(call[0]));
        expect(messages.filter((m) => !m.includes('IntersectionObserver'))).toEqual([]);
    });

    it('should have the heading the deploy check looks for', () => {
        expect(demo).toContain('<h1>dopaminejs demo</h1>');
    });

    it('should cancel the submit itself, since auto() does not', () => {
        const form = document.getElementById('signup');
        const event = new window.Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
        // auto() never cancels a submit, so the page script must.
        expect(event.defaultPrevented).toBe(true);
    });

    it('should give XP for the three docs buttons and unlock tutorial_badge on the third', async () => {
        // 10 + 10 + 10 from the buttons, plus the 25 the achievement itself pays.
        // The host is shared with the tests above (the form submit pays 15), so count from here.
        const before = host.progress.snapshot().xp;
        for (const button of document.querySelectorAll('#docs button')) button.click();
        await vi.waitFor(() => expect(host.progress.snapshot().xp - before).toBe(55));
        const unlocked = host.progress.getUnlockedAchievements().map((a) => a.id);
        expect(unlocked).toContain('tutorial_badge');
    });
});
