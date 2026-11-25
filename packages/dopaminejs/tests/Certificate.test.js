/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { showCertificate, destroyCertificate } from '../src/certificate.js';
import { celebrate, destroyCelebrations } from '../src/celebrate.js';
import { ParticleSystem } from '../src/dopamine/effects/ParticleSystem.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIELDS = { title: 'Course complete', recipient: 'Ana Reyes', date: 'Nov 25, 2026', issuer: 'Acme Academy' };
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 850;
const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\(.*\)|red|black|white)$/i;

// The blob URL calls stay installed: the revoke timer can fire after a test ends.
// Revoke timers outlive a test, so URL names never repeat: a late revoke from an earlier test cannot look like this test's.
let blobCount = 0;
const blobUrls = { created: [], urls: [], revoked: [] };
URL.createObjectURL = (blob) => {
    blobUrls.created.push(blob);
    const url = `blob:test/${++blobCount}`;
    blobUrls.urls.push(url);
    return url;
};
URL.revokeObjectURL = (url) => {
    blobUrls.revoked.push(url);
};

describe('showCertificate', () => {
    const realGetContext = HTMLCanvasElement.prototype.getContext;
    const realToBlob = HTMLCanvasElement.prototype.toBlob;
    const realClick = HTMLAnchorElement.prototype.click;
    const realPrint = window.print;
    let contexts;
    let saved;
    let warn;
    let errors;

    // A 2d context that records what was drawn. A string is 10 px per character.
    const makeContext = (canvas) => {
        const target = {
            canvas,
            texts: [],
            images: [],
            rects: [],
            fillRect(x, y, w, h) {
                target.rects.push({ x, y, w, h, fillStyle: target.fillStyle });
            },
            measureText: (text) => ({ width: String(text).length * 10 }),
            fillText(text, x, y, maxWidth) {
                target.texts.push({ text, x, y, maxWidth, font: target.font });
            },
            drawImage(image, x, y, w, h) {
                target.images.push({ image, x, y, w, h });
                // A cross-origin image taints the canvas, as in a browser.
                if (String(image.src).includes('other.test')) canvas.tainted = true;
            },
            // Every property the certificate sets, in order, as [name, value].
            assigned: [],
            createLinearGradient: () => ({ gradient: true, addColorStop() {} })
        };
        return new Proxy(target, {
            get: (t, key) => (key in t ? t[key] : () => {}),
            set(t, key, value) {
                t.assigned.push([key, value]);
                // Like a canvas, keep the old colour when a string does not parse, and read black and white back as hex.
                if (typeof value === 'string') value = { black: '#000000', white: '#ffffff' }[value.toLowerCase()] ?? value;
                if ((key === 'fillStyle' || key === 'strokeStyle') && typeof value === 'string' && !COLOUR.test(value)) return true;
                t[key] = value;
                return true;
            }
        });
    };

    const overlay = () => document.querySelector('.dopamine-certificate-overlay');
    const card = () => document.querySelector('.dopamine-certificate-card');
    const button = (name) => document.querySelector(`.dopamine-certificate-${name}`);
    const key = (name, init = {}) => {
        const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
        document.dispatchEvent(event);
        return event;
    };
    const download = async () => {
        button('download').click();
        await vi.waitFor(() => expect(saved.length).toBeGreaterThan(0));
        return saved[saved.length - 1];
    };
    const linesOf = (ctx, size) => ctx.texts.filter((t) => t.font.includes(`${size}px`));
    const crossOriginLogo = () => {
        const img = new Image();
        img.src = 'https://other.test/logo.png';
        Object.defineProperty(img, 'naturalWidth', { value: 200 });
        Object.defineProperty(img, 'naturalHeight', { value: 100 });
        return img;
    };

    beforeEach(() => {
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        contexts = [];
        saved = [];
        blobUrls.created.length = 0;
        blobUrls.urls.length = 0;
        blobUrls.revoked.length = 0;
        HTMLCanvasElement.prototype.getContext = function () {
            const ctx = makeContext(this);
            contexts.push(ctx);
            return ctx;
        };
        HTMLCanvasElement.prototype.toBlob = function (callback, type) {
            if (this.tainted) throw new DOMException('The canvas has been tainted', 'SecurityError');
            callback(new Blob(['png'], { type }));
        };
        HTMLAnchorElement.prototype.click = function () {
            saved.push({ download: this.download, href: this.href });
        };
        window.print = vi.fn();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        destroyCertificate();
        destroyCelebrations();
        HTMLCanvasElement.prototype.getContext = realGetContext;
        HTMLCanvasElement.prototype.toBlob = realToBlob;
        HTMLAnchorElement.prototype.click = realClick;
        window.print = realPrint;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    it('shows every field as text', async () => {
        showCertificate(FIELDS);

        expect(card().querySelector('.dopamine-certificate-title').textContent).toBe(FIELDS.title);
        expect(card().querySelector('.dopamine-certificate-recipient').textContent).toBe(FIELDS.recipient);
        expect(card().querySelector('.dopamine-certificate-date').textContent).toBe(FIELDS.date);
        expect(card().querySelector('.dopamine-certificate-issuer').textContent).toBe(FIELDS.issuer);

        // Only own properties count: values on the prototype are not shown, in the card or on the PNG.
        const inherited = Object.create({
            title: 'inherited title',
            recipient: 'inherited recipient',
            date: 'inherited date',
            issuer: 'inherited issuer',
            logo: 'inherited logo'
        });
        inherited.title = 'Own title';
        showCertificate(inherited);

        expect(card().querySelector('.dopamine-certificate-title').textContent).toBe('Own title');
        for (const name of ['recipient', 'date', 'issuer']) {
            expect(card().querySelector(`.dopamine-certificate-${name}`).textContent).toBe('');
        }
        expect(card().querySelector('.dopamine-certificate-logo')).toBeNull();
        expect(card().textContent).not.toContain('inherited');
        saved.length = 0;
        await download();
        expect(contexts[contexts.length - 1].texts.map((t) => t.text)).toEqual(['Own title']);
    });

    it('shows HTML in title, recipient, date and issuer as literal text', () => {
        const html = '<img src=x onerror=alert(1)><b>bold</b>';
        showCertificate({ title: html, recipient: html, date: html, issuer: html });

        for (const name of ['title', 'recipient', 'date', 'issuer']) {
            const node = card().querySelector(`.dopamine-certificate-${name}`);
            expect(node.textContent).toBe(html);
            expect(node.children).toHaveLength(0);
        }
        expect(card().querySelector('img')).toBeNull();
        expect(card().querySelector('b')).toBeNull();
    });

    it('is a modal dialog labelled by its title', () => {
        showCertificate(FIELDS);
        const title = card().querySelector('.dopamine-certificate-title');

        expect(card().getAttribute('role')).toBe('dialog');
        expect(card().getAttribute('aria-modal')).toBe('true');
        expect(title.id).not.toBe('');
        expect(card().getAttribute('aria-labelledby')).toBe(title.id);
        expect(document.activeElement).toBe(card());
    });

    it('has Download, Print and Close buttons', () => {
        showCertificate(FIELDS);

        expect(button('download').textContent).toBe('Download');
        expect(button('print').textContent).toBe('Print');
        expect(button('close').textContent).toBe('Close');
        for (const name of ['download', 'print', 'close']) expect(button(name).type).toBe('button');
    });

    it('reads the existing toast variables for its theme, on the card and on the PNG', async () => {
        const source = readFileSync(resolve(here, '../src/certificate.js'), 'utf8');

        for (const name of ['bg', 'text', 'muted', 'accent', 'radius', 'shadow']) {
            expect(source).toContain(`--dopamine-toast-${name}`);
            expect(readFileSync(resolve(here, '../src/dopamine/ui/dopamine.css'), 'utf8')).toContain(`--dopamine-toast-${name}`);
        }

        const assignedTo = (ctx, name) => ctx.assigned.filter(([key]) => key === name).map(([, value]) => value);
        const cardFill = (ctx) => ctx.rects.find((r) => r.w === CARD_WIDTH && r.h === CARD_HEIGHT).fillStyle;
        // Returns an object, never the context itself: the context's Proxy answers `then`, so awaiting it would never settle.
        const theme = async (bg) => {
            showCertificate(FIELDS);
            card().style.setProperty('--dopamine-toast-bg', bg);
            card().style.setProperty('--dopamine-toast-accent', '#abcdef');
            saved.length = 0;
            await download();
            const ctx = contexts[contexts.length - 1];
            return { fill: cardFill(ctx), strokes: assignedTo(ctx, 'strokeStyle') };
        };

        // A background the canvas accepts is used as it is, and the border takes the accent.
        const plain = await theme('#102030');
        expect(plain.fill).toBe('#102030');
        expect(plain.strokes).toEqual(['#abcdef']);
        // The canvas reads black back as hex, so that is what the fill shows.
        for (const [bg, shown] of [['rgb(0 0 0 / 50%)', 'rgb(0 0 0 / 50%)'], ['red', 'red'], ['black', '#000000']]) {
            expect((await theme(bg)).fill).toBe(shown);
        }

        // A gradient, url() or junk is not a colour the canvas takes: the PNG falls back to its own gradient.
        for (const bg of ['linear-gradient(135deg, red, blue)', 'url(https://other.test/bg.png)', 'not a colour']) {
            expect((await theme(bg)).fill).toEqual(expect.objectContaining({ gradient: true }));
        }
    });

    it('an unreadable field logs the error, opens nothing and does not throw', () => {
        expect(() => showCertificate({ get title() { throw new Error('boom'); } })).not.toThrow();

        expect(errors).toHaveBeenCalled();
        expect(overlay()).toBeNull();
    });

    it('no fields at all still opens an empty card', () => {
        expect(() => showCertificate({})).not.toThrow();

        expect(card()).not.toBeNull();
        expect(card().querySelector('.dopamine-certificate-title').textContent).toBe('');
    });

    it('anything but an object of fields warns and opens nothing', () => {
        for (const bad of ['abc', true, 5, [], null, undefined]) {
            warn.mockClear();
            expect(() => showCertificate(bad)).not.toThrow();

            expect(overlay(), String(bad)).toBeNull();
            expect(warn, String(bad)).toHaveBeenCalledTimes(1);
        }
    });

    describe('logo', () => {
        it('a logo that is not an image, text or markup leaves no empty logo band', () => {
            for (const logo of [5, true, {}]) {
                showCertificate({ ...FIELDS, logo });

                expect(card().querySelector('.dopamine-certificate-logo'), String(logo)).toBeNull();
            }
        });

        it('an image taken from the page goes back, with its style, however the certificate closes', () => {
            const host = document.createElement('div');
            const before = document.createElement('span');
            const img = document.createElement('img');
            img.setAttribute('style', 'width:10px');
            const after = document.createElement('span');
            host.append(before, img, after);
            document.body.appendChild(host);
            const closers = [() => key('Escape'), () => destroyCertificate(), () => showCertificate(FIELDS)];

            for (const closeIt of closers) {
                showCertificate({ ...FIELDS, logo: img });
                expect(img.parentElement).toBe(card().querySelector('.dopamine-certificate-logo'));
                expect(img.style.width).toBe('10px');
                expect(img.style.maxWidth).toBe('100%');
                closeIt();
                destroyCertificate();

                expect([...host.children]).toEqual([before, img, after]);
                expect(img.getAttribute('style')).toBe('width:10px');
            }
        });

        it('an image whose next sibling is gone goes back at the end, and one with no parent stays out', () => {
            const host = document.createElement('div');
            const img = document.createElement('img');
            const after = document.createElement('span');
            host.append(img, after);
            showCertificate({ ...FIELDS, logo: img });
            after.remove();
            destroyCertificate();
            expect([...host.children]).toEqual([img]);
            expect(img.hasAttribute('style')).toBe(false);

            const loose = document.createElement('img');
            loose.setAttribute('style', 'width:5px');
            showCertificate({ ...FIELDS, logo: loose });
            destroyCertificate();
            expect(loose.parentElement).toBeNull();
            expect(loose.getAttribute('style')).toBe('width:5px');
        });

        it('a string is text by default, even when it looks like HTML', () => {
            showCertificate({ ...FIELDS, logo: '<img src=x onerror=alert(1)>' });
            const logo = card().querySelector('.dopamine-certificate-logo');

            expect(logo.textContent).toBe('<img src=x onerror=alert(1)>');
            expect(logo.querySelector('img')).toBeNull();
        });

        it('an SVG string goes through the sanitiser', () => {
            showCertificate({
                ...FIELDS,
                logo: '<svg viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4" onload="alert(2)"/></svg>'
            });
            const logo = card().querySelector('.dopamine-certificate-logo');

            expect(logo.querySelector('svg')).not.toBeNull();
            expect(logo.querySelector('circle')).not.toBeNull();
            expect(logo.querySelector('script')).toBeNull();
            expect(logo.querySelector('circle').hasAttribute('onload')).toBe(false);
        });

        it('HTML is parsed only with safeIcons: false', () => {
            showCertificate({ ...FIELDS, logo: '<b class="mine">Acme</b>' }, { safeIcons: false });

            expect(card().querySelector('.dopamine-certificate-logo .mine')).not.toBeNull();
        });

        it('an HTMLImageElement is moved in, not parsed or copied', () => {
            const img = document.createElement('img');
            img.alt = 'Acme';
            showCertificate({ ...FIELDS, logo: img });

            expect(img.parentElement).toBe(card().querySelector('.dopamine-certificate-logo'));
            expect(card().querySelectorAll('img')).toHaveLength(1);
        });

        it('no logo leaves no logo element', () => {
            showCertificate(FIELDS);

            expect(card().querySelector('.dopamine-certificate-logo')).toBeNull();
        });
    });

    describe('one at a time', () => {
        it('opening a second certificate closes the first', () => {
            showCertificate({ ...FIELDS, title: 'First' });
            const first = overlay();
            showCertificate({ ...FIELDS, title: 'Second' });

            expect(document.querySelectorAll('.dopamine-certificate-overlay')).toHaveLength(1);
            expect(first.isConnected).toBe(false);
            expect(card().querySelector('.dopamine-certificate-title').textContent).toBe('Second');
            expect(document.querySelectorAll('style')).toHaveLength(1);
        });

        it('focus goes back to the element that had it before the first one', () => {
            const opener = document.createElement('button');
            document.body.appendChild(opener);
            opener.focus();
            showCertificate(FIELDS);
            showCertificate(FIELDS);
            key('Escape');

            expect(document.activeElement).toBe(opener);
        });
    });

    describe('closing', () => {
        let opener;

        beforeEach(() => {
            opener = document.createElement('button');
            document.body.appendChild(opener);
            opener.focus();
            showCertificate(FIELDS);
        });

        it('Escape closes it and returns focus', () => {
            const event = key('Escape');

            expect(event.defaultPrevented).toBe(true);
            expect(overlay()).toBeNull();
            expect(document.activeElement).toBe(opener);
        });

        it('the close button closes it and returns focus', () => {
            button('close').click();

            expect(overlay()).toBeNull();
            expect(document.activeElement).toBe(opener);
        });

        it('a click on the backdrop closes it, a click on the card does not', () => {
            card().click();
            expect(overlay()).not.toBeNull();

            overlay().click();
            expect(overlay()).toBeNull();
        });

        it('destroyCertificate closes it', () => {
            destroyCertificate();

            expect(overlay()).toBeNull();
            expect(document.activeElement).toBe(opener);
        });

        it('destroyCertificate with nothing open does nothing', () => {
            destroyCertificate();

            expect(() => destroyCertificate()).not.toThrow();
        });

        it('Escape that an earlier listener already handled leaves it open', () => {
            const earlier = (event) => event.preventDefault();
            destroyCertificate();
            document.addEventListener('keydown', earlier);
            showCertificate(FIELDS);
            const event = key('Escape');
            document.removeEventListener('keydown', earlier);

            expect(event.defaultPrevented).toBe(true);
            expect(overlay()).not.toBeNull();
        });

        it('Escape after it is closed does nothing', () => {
            button('close').click();
            const event = key('Escape');

            expect(event.defaultPrevented).toBe(false);
        });
    });

    describe('focus trap', () => {
        beforeEach(() => {
            showCertificate(FIELDS);
        });

        it('Tab from the last button goes to the first', () => {
            button('close').focus();
            const event = key('Tab');

            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(button('download'));
        });

        it('Shift+Tab from the first button goes to the last', () => {
            button('download').focus();
            key('Tab', { shiftKey: true });

            expect(document.activeElement).toBe(button('close'));
        });

        it('Tab moves forward through the buttons', () => {
            button('download').focus();
            key('Tab');
            expect(document.activeElement).toBe(button('print'));
            key('Tab');
            expect(document.activeElement).toBe(button('close'));
        });

        it('Tab with Ctrl, Alt or Meta is left to the browser', () => {
            button('download').focus();
            for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
                const event = key('Tab', { [modifier]: true });

                expect(event.defaultPrevented, modifier).toBe(false);
                expect(document.activeElement).toBe(button('download'));
            }
        });

        it('Tab from the card itself, or from outside it, lands on a button', () => {
            expect(document.activeElement).toBe(card());
            key('Tab');
            expect(document.activeElement).toBe(button('download'));

            document.body.focus();
            key('Tab', { shiftKey: true });
            expect(document.activeElement).toBe(button('close'));
        });
    });

    describe('cleanup', () => {
        it('close removes its DOM, its print style and every listener it added', () => {
            const log = [];
            const add = EventTarget.prototype.addEventListener;
            const remove = EventTarget.prototype.removeEventListener;
            vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (type, handler, ...rest) {
                log.push(['add', this, type, handler]);
                return add.call(this, type, handler, ...rest);
            });
            vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (type, handler, ...rest) {
                log.push(['remove', this, type, handler]);
                return remove.call(this, type, handler, ...rest);
            });
            const bodyBefore = document.body.children.length;
            const headBefore = document.head.children.length;

            showCertificate({ ...FIELDS, logo: 'L' });
            // jsdom's selector engine (dom-selector) adds window focus, keyboard and mouse listeners the first time a selector runs and keeps them; they are not ours.
            const isJsdomSelectorTracker = (entry) => /this\.#(focus|event) = evt/.test(String(entry[3]));
            const added = log.filter((entry) => entry[0] === 'add' && !isJsdomSelectorTracker(entry));
            expect(added.length).toBeGreaterThan(0);
            button('close').click();

            const removed = log.filter((entry) => entry[0] === 'remove');
            for (const [, target, type, handler] of added) {
                const matched = removed.some((r) => r[1] === target && r[2] === type && r[3] === handler);
                expect(matched, `${type} listener not removed: ${String(handler).slice(0, 80)}`).toBe(true);
            }
            expect(document.body.children).toHaveLength(bodyBefore);
            expect(document.head.children).toHaveLength(headBefore);
        });

        it('destroyCertificate leaves the page as it found it', () => {
            const bodyBefore = document.body.innerHTML;
            const headBefore = document.head.innerHTML;
            showCertificate(FIELDS);
            destroyCertificate();

            expect(document.body.innerHTML).toBe(bodyBefore);
            expect(document.head.innerHTML).toBe(headBefore);
        });

        it('a closed certificate no longer reacts to the keyboard', () => {
            showCertificate(FIELDS);
            destroyCertificate();
            document.body.focus();
            const event = key('Tab');

            expect(event.defaultPrevented).toBe(false);
        });
    });

    describe('print', () => {
        it('Print calls window.print', () => {
            showCertificate(FIELDS);
            button('print').click();

            expect(window.print).toHaveBeenCalledTimes(1);
        });

        it('print CSS hides the page and the buttons and keeps the certificate', () => {
            showCertificate(FIELDS);
            const css = document.head.querySelector('style').textContent;

            expect(css).toContain('@media print');
            expect(css).toContain('body>*:not(.dopamine-certificate-overlay){display:none!important}');
            expect(css).toContain('.dopamine-certificate-actions{display:none!important}');
        });
    });

    describe('download', () => {
        it('saves a PNG with every field drawn on it', async () => {
            showCertificate({ ...FIELDS, logo: 'Acme' });
            const file = await download();

            expect(file.download).toBe('certificate.png');
            expect(file.href).toBe(blobUrls.urls[0]);
            expect(blobUrls.created[0].type).toBe('image/png');
            const drawn = contexts[0].texts.map((t) => t.text);
            expect(drawn).toEqual(expect.arrayContaining([FIELDS.title, FIELDS.recipient, FIELDS.date, FIELDS.issuer, 'Acme']));
        });

        it('asks the canvas for image/png', async () => {
            const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
            showCertificate(FIELDS);
            await download();

            expect(toBlob).toHaveBeenCalledTimes(1);
            expect(toBlob.mock.calls[0][1]).toBe('image/png');
            expect(contexts[0].canvas.width).toBe(CARD_WIDTH);
            expect(contexts[0].canvas.height).toBe(CARD_HEIGHT);
        });

        it('draws HTML in the fields as literal text', async () => {
            const html = '<script>alert(1)</script>';
            showCertificate({ title: html, recipient: html, date: html, issuer: html });
            await download();

            expect(contexts[0].texts.map((t) => t.text)).toEqual([html, html, html, html]);
        });

        it('wraps a long recipient, ends it with an ellipsis, and stays inside the card', async () => {
            const long = 'A'.repeat(5000);
            showCertificate({ ...FIELDS, recipient: long, title: long, issuer: long });
            await download();
            const ctx = contexts[0];

            const recipient = linesOf(ctx, 44);
            expect(recipient).toHaveLength(3);
            expect(recipient[2].text.endsWith('\u2026')).toBe(true);
            expect(recipient[0].text.endsWith('\u2026')).toBe(false);
            expect(linesOf(ctx, 56)).toHaveLength(2);
            expect(linesOf(ctx, 28).filter((t) => t.text !== FIELDS.date)).toHaveLength(2);
            for (const line of ctx.texts) {
                expect(line.text.length * 10).toBeLessThanOrEqual(960);
                expect(line.maxWidth).toBeLessThanOrEqual(960);
                expect(line.x).toBeGreaterThan(0);
                expect(line.x).toBeLessThan(CARD_WIDTH);
                expect(line.y).toBeGreaterThanOrEqual(0);
                expect(line.y).toBeLessThan(CARD_HEIGHT - 60);
            }
        });

        it('wraps long text with spaces at word breaks and cuts it with an ellipsis', async () => {
            const long = 'word '.repeat(1000).trim();
            showCertificate({ ...FIELDS, recipient: long });
            await download();
            const recipient = linesOf(contexts[0], 44);

            expect(recipient).toHaveLength(3);
            expect(recipient[0].text).not.toMatch(/^\s|\s$/);
            expect(recipient[2].text.endsWith('\u2026')).toBe(true);
            for (const line of recipient) expect(line.text.length * 10).toBeLessThanOrEqual(960);
        });

        it('cuts an emoji string by whole characters, never leaving half a surrogate pair', async () => {
            showCertificate({ ...FIELDS, recipient: '\u{1F600}'.repeat(5000) });
            await download();
            const recipient = linesOf(contexts[0], 44);

            expect(recipient).toHaveLength(3);
            expect(recipient[2].text.endsWith('\u2026')).toBe(true);
            for (const line of contexts[0].texts) {
                expect(line.text).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/);
            }
        });

        it('text that fits is not cut and has no ellipsis', async () => {
            showCertificate(FIELDS);
            await download();

            expect(contexts[0].texts.some((t) => t.text.includes('\u2026'))).toBe(false);
        });

        it('draws an image logo, and an SVG logo through a data URL', async () => {
            const img = document.createElement('img');
            img.src = 'https://same.test/logo.png';
            Object.defineProperty(img, 'naturalWidth', { value: 200 });
            Object.defineProperty(img, 'naturalHeight', { value: 100 });
            showCertificate({ ...FIELDS, logo: img });
            await download();

            expect(contexts[0].images).toHaveLength(1);
            expect(contexts[0].images[0].image).toBe(img);
            expect(contexts[0].images[0].w).toBeLessThanOrEqual(960);
            expect(contexts[0].images[0].h).toBeLessThanOrEqual(110);

            vi.stubGlobal('Image', class {
                set src(value) {
                    this.source = value;
                    queueMicrotask(() => this.onload());
                }
                get src() { return this.source; }
            });
            saved.length = 0;
            showCertificate({ ...FIELDS, logo: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>' });
            await download();

            const last = contexts[contexts.length - 1];
            expect(last.images).toHaveLength(1);
            expect(last.images[0].image.src).toMatch(/^data:image\/svg\+xml/);

            // A logo that did not load (no natural width) is not drawn, and the PNG is still saved.
            vi.unstubAllGlobals();
            saved.length = 0;
            const broken = document.createElement('img');
            broken.src = 'https://same.test/missing.png';
            Object.defineProperty(broken, 'naturalWidth', { value: 0 });
            showCertificate({ ...FIELDS, logo: broken });
            const file = await download();

            const drawn = contexts[contexts.length - 1];
            expect(warn).toHaveBeenCalledTimes(1);
            expect(file.download).toBe('certificate.png');
            expect(drawn.images).toHaveLength(0);
            expect(drawn.texts.map((t) => t.text)).toEqual(
                expect.arrayContaining([FIELDS.title, FIELDS.recipient, FIELDS.date, FIELDS.issuer])
            );
        });

        it('an SVG logo that fails to load is dropped with one warning and the PNG is saved', async () => {
            vi.stubGlobal('Image', class {
                set src(value) {
                    this.source = value;
                    queueMicrotask(() => this.onerror());
                }
                get src() { return this.source; }
            });
            showCertificate({ ...FIELDS, logo: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>' });
            await download();

            expect(warn).toHaveBeenCalledTimes(1);
            expect(contexts[0].images).toHaveLength(0);
            expect(saved).toHaveLength(1);
        });

        it('a canvas that gives no PNG logs one error and saves nothing', async () => {
            HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
            showCertificate(FIELDS);
            button('download').click();
            await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1));

            expect(errors.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(saved).toHaveLength(0);
            expect(blobUrls.created).toHaveLength(0);
        });

        it('two quick clicks on Download save one PNG', async () => {
            showCertificate(FIELDS);
            button('download').click();
            button('download').click();
            await vi.waitFor(() => expect(saved.length).toBeGreaterThan(0));
            await new Promise((resolve) => setTimeout(resolve, 30));

            expect(saved).toHaveLength(1);
            expect(contexts).toHaveLength(1);

            button('download').click();
            await vi.waitFor(() => expect(saved).toHaveLength(2));
        });

        it('a cross-origin logo taints the canvas: the PNG is saved without it, with one warning', async () => {
            showCertificate({ ...FIELDS, logo: crossOriginLogo() });
            const file = await download();

            expect(file.download).toBe('certificate.png');
            expect(blobUrls.created).toHaveLength(1);
            expect(blobUrls.created[0].type).toBe('image/png');
            expect(warn).toHaveBeenCalledTimes(1);
            expect(errors).not.toHaveBeenCalled();
            expect(contexts).toHaveLength(2);
            expect(contexts[0].images).toHaveLength(1);
            expect(contexts[1].images).toHaveLength(0);
            expect(contexts[1].texts.map((t) => t.text)).toEqual(
                expect.arrayContaining([FIELDS.title, FIELDS.recipient, FIELDS.date, FIELDS.issuer])
            );
        });

        it('an error that is not a taint is logged and nothing is saved', async () => {
            HTMLCanvasElement.prototype.toBlob = () => { throw new Error('nope'); };
            showCertificate({ ...FIELDS, logo: crossOriginLogo() });
            button('download').click();
            await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1));

            expect(saved).toHaveLength(0);
            expect(warn).not.toHaveBeenCalled();
        });

        it('a canvas with no 2d context logs the error and saves nothing', async () => {
            HTMLCanvasElement.prototype.getContext = () => null;
            showCertificate(FIELDS);
            button('download').click();
            await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1));

            expect(saved).toHaveLength(0);
            expect(errors.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(errors.mock.calls[0][0].message).toBe('[DopamineJS] This canvas has no 2d context');
        });

        it('revokes the blob URL a moment after the save', async () => {
            showCertificate(FIELDS);
            await download();
            const url = blobUrls.urls[0];
            expect(url).toBeDefined();
            expect(blobUrls.revoked).not.toContain(url);

            await vi.waitFor(() => expect(blobUrls.revoked).toContain(url), { timeout: 3000 });
        });

        it('still saves after the certificate is closed mid-download', async () => {
            showCertificate({ ...FIELDS, logo: 'Acme' });
            button('download').click();
            destroyCertificate();

            await vi.waitFor(() => expect(saved).toHaveLength(1));
        });
    });

    describe('celebrate', () => {
        beforeEach(() => {
            vi.spyOn(ParticleSystem.prototype, 'burst').mockImplementation(() => {});
            vi.spyOn(SoundManager.prototype, 'play').mockResolvedValue(undefined);
        });

        it("celebrate('certificate', { certificate }) opens the certificate after the confetti", async () => {
            const burst = ParticleSystem.prototype.burst;
            celebrate('certificate', { certificate: FIELDS });
            await vi.waitFor(() => expect(overlay()).not.toBeNull());

            expect(burst).toHaveBeenCalledTimes(1);
            expect(card().querySelector('.dopamine-certificate-recipient').textContent).toBe(FIELDS.recipient);
            expect(errors).not.toHaveBeenCalled();
        });

        it('a certificate option that is not an object opens nothing and warns', async () => {
            for (const bad of ['abc', true, 5, []]) {
                warn.mockClear();
                celebrate('certificate', { certificate: bad });
                await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));

                expect(overlay(), String(bad)).toBeNull();
            }
        });

        it('without a certificate option no certificate opens', async () => {
            celebrate('certificate');
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(overlay()).toBeNull();
        });

        it('destroyCertificate closes the one celebrate opened', async () => {
            celebrate('certificate', { certificate: FIELDS });
            await vi.waitFor(() => expect(overlay()).not.toBeNull());
            destroyCertificate();

            expect(overlay()).toBeNull();
        });
    });
});

describe('the certificate subpath is separate', () => {
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
        return [...seen].map((file) => file.slice(src.length));
    };

    it('the main entry does not reach certificate.js', () => {
        expect(graph('index.js')).not.toContain('/certificate.js');
    });

    it('celebrate.js does not import it statically, only with import()', () => {
        expect(graph('celebrate.js')).not.toContain('/certificate.js');
        expect(readFileSync(resolve(src, 'celebrate.js'), 'utf8')).toContain("import('./certificate.js')");
    });

    it('certificate.js reaches only the icon sanitiser', () => {
        expect(graph('certificate.js')).toEqual(['/certificate.js', '/dopamine/ui/icon.js']);
    });
});

describe('the certificate subpath is wired', () => {
    it('is exported with types and both module formats, and built as its own entry', () => {
        const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));
        const vite = readFileSync(resolve(here, '../vite.config.js'), 'utf8');

        expect(pkg.exports['./certificate']).toEqual({
            types: './types/certificate.d.ts',
            import: './dist/certificate.js',
            require: './dist/certificate.cjs'
        });
        expect(readFileSync(resolve(here, '../types/certificate.d.ts'), 'utf8')).toContain('showCertificate');
        expect(vite).toContain("certificate: resolve(__dirname, 'src/certificate.js')");
    });
});
