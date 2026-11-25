/**
 * The `dopaminejs/certificate` subpath: a modal completion card the visitor can
 * download as a PNG or print. `celebrate('certificate', { certificate })` loads
 * it on demand. Nothing in the main entry imports it.
 */

import { setIcon } from './dopamine/ui/icon.js';

const WIDTH = 1200;
const HEIGHT = 850;
const TEXT_WIDTH = WIDTH - 240;
const LOGO_SIZE = 110;
const FALLBACK_BG = ['#667eea', '#764ba2'];

const FIELD_CSS = {
    title: 'margin:16px 0 0;font-size:32px;font-weight:700;line-height:1.2',
    recipient: 'margin:20px 0 0;font-size:26px;line-height:1.3;color:var(--dopamine-toast-accent,#ffd700)',
    date: 'margin:20px 0 0;font-size:16px;color:var(--dopamine-toast-muted,rgba(255,255,255,0.85))',
    issuer: 'margin:8px 0 0;font-size:16px;color:var(--dopamine-toast-muted,rgba(255,255,255,0.85))'
};
const CLAMP = 'display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;';
const LINES = { title: 2, recipient: 3, date: 1, issuer: 2 };

const OVERLAY_CSS = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:10001;display:flex;'
    + 'align-items:center;justify-content:center;padding:16px;overflow:auto;background:rgba(0,0,0,0.6)';
const CARD_CSS = 'box-sizing:border-box;width:min(100%,720px);padding:36px 32px 24px;text-align:center;'
    + 'overflow-wrap:anywhere;border-radius:var(--dopamine-toast-radius,16px);'
    + 'background:var(--dopamine-toast-bg,linear-gradient(135deg,#667eea 0%,#764ba2 100%));'
    + 'color:var(--dopamine-toast-text,#fff);border:4px double var(--dopamine-toast-accent,#ffd700);'
    + 'box-shadow:var(--dopamine-toast-shadow,0 8px 32px rgba(0,0,0,0.4));font:16px/1.4 system-ui,sans-serif';
const BUTTON_CSS = 'margin:0 6px;padding:8px 16px;border-radius:8px;font:inherit;cursor:pointer;color:inherit;'
    + 'background:rgba(255,255,255,0.15);border:1px solid var(--dopamine-toast-accent,#ffd700)';
const PRINT_CSS = '@media print{body>*:not(.dopamine-certificate-overlay){display:none!important}'
    + '.dopamine-certificate-overlay{position:static!important;display:block!important;padding:0!important;'
    + 'background:none!important}.dopamine-certificate-card{margin:0 auto;box-shadow:none!important;'
    + '-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.dopamine-certificate-actions{display:none!important}}';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const ownValue = (object, key) =>
    (object !== null && typeof object === 'object' && hasOwn(object, key) ? object[key] : undefined);
const textOf = (value) => (value === undefined || value === null ? '' : String(value));

// What is open now, until close() or destroyCertificate().
let current = null;

function make(tag, css, text) {
    const node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Greedy wrap that breaks a long word by characters. Past `max` lines it stops
// measuring and ends the last line with an ellipsis, so 5,000 characters cost
// a few lines of work.
function wrap(ctx, text, max) {
    const fits = (s) => ctx.measureText(s).width <= TEXT_WIDTH;
    const lines = [];
    let line = '';
    let cut = false;
    const flush = () => {
        if (lines.length === max) {
            cut = true;
            return false;
        }
        lines.push(line);
        line = '';
        return true;
    };
    scan: for (const word of text.split(/\s+/)) {
        if (word === '') continue;
        const joined = line === '' ? word : `${line} ${word}`;
        if (fits(joined)) {
            line = joined;
            continue;
        }
        if (line !== '' && !flush()) break;
        for (const char of word) {
            if (line !== '' && !fits(line + char)) {
                if (!flush()) break scan;
            }
            line += char;
        }
    }
    if (!cut && line !== '') cut = !flush();
    if (cut) {
        let last = lines[max - 1];
        while (last !== '' && !fits(`${last}\u2026`)) {
            last = Array.from(last).slice(0, -1).join('');
        }
        lines[max - 1] = `${last}\u2026`;
    }
    return lines;
}

function paint(ctx, state, logo) {
    const { fields, look } = state;
    // The canvas keeps its old fillStyle when it cannot parse a colour, so a value is
    // taken when setting it after a known one changed it. Two probes cover black and white.
    const accepts = (colour) => {
        for (const probe of ['#000000', '#ffffff']) {
            ctx.fillStyle = probe;
            ctx.fillStyle = colour;
            if (ctx.fillStyle !== probe) return true;
        }
        return false;
    };
    let fill = look.bg && accepts(look.bg) ? look.bg : null;
    if (!fill) {
        fill = ctx.createLinearGradient?.(0, 0, WIDTH, HEIGHT);
        fill?.addColorStop(0, FALLBACK_BG[0]);
        fill?.addColorStop(1, FALLBACK_BG[1]);
    }
    ctx.fillStyle = fill ?? FALLBACK_BG[0];
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = look.accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const x = WIDTH / 2;
    let y = 90;

    if (logo) {
        if (typeof logo === 'string') {
            ctx.fillStyle = look.text;
            ctx.font = `${LOGO_SIZE / 2}px system-ui, sans-serif`;
            ctx.fillText(logo, x, y, TEXT_WIDTH);
        } else {
            const w = logo.naturalWidth || logo.width || LOGO_SIZE;
            const h = logo.naturalHeight || logo.height || LOGO_SIZE;
            const scale = Math.min(TEXT_WIDTH / w, LOGO_SIZE / h);
            const dw = Math.min(TEXT_WIDTH, w * scale);
            const dh = Math.min(LOGO_SIZE, h * scale);
            ctx.drawImage(logo, x - dw / 2, y, dw, dh);
        }
        y += LOGO_SIZE + 30;
    }

    const rows = [
        ['title', 56, 'bold', look.text, 40],
        ['recipient', 44, '', look.accent, 40],
        ['date', 28, '', look.muted, 30],
        ['issuer', 28, '', look.muted, 0]
    ];
    for (const [name, size, weight, colour, gap] of rows) {
        ctx.fillStyle = colour;
        ctx.font = `${weight} ${size}px system-ui, sans-serif`.trim();
        for (const line of wrap(ctx, fields[name], LINES[name])) {
            ctx.fillText(line, x, y, TEXT_WIDTH);
            y += size * 1.25;
        }
        y += gap;
    }
}

// The logo as something drawImage takes, text, or null. Always drawn from the
// copy already in the card, so the same sanitising rules apply.
function loadLogo(holder) {
    const dropped = () => {
        console.warn('[DopamineJS] The certificate logo had not loaded, so the PNG has no logo.');
        return null;
    };
    const img = holder.querySelector('img');
    if (img) return Promise.resolve(img.naturalWidth > 0 ? img : dropped());
    const svg = holder.querySelector('svg');
    if (!svg) return Promise.resolve(holder.textContent.trim() || null);
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(dropped());
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    });
}

function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function download(state) {
    const logo = state.logoHolder ? await loadLogo(state.logoHolder) : null;
    const render = async (withLogo) => {
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('[DopamineJS] This canvas has no 2d context');
        paint(ctx, state, withLogo);
        return toBlob(canvas);
    };
    let blob;
    try {
        blob = await render(logo);
    } catch (error) {
        // A cross-origin logo taints the canvas, and export then throws.
        if (!logo || error?.name !== 'SecurityError') throw error;
        console.warn('[DopamineJS] The certificate logo could not be saved (cross-origin), so the PNG has no logo.');
        blob = await render(null);
    }
    if (!blob) {
        console.error(new Error('[DopamineJS] The canvas gave no PNG'));
        return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'certificate.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function close() {
    const open = current;
    if (!open) return;
    current = null;
    for (const undo of open.undo) undo();
    open.overlay.remove();
    open.style.remove();
    const back = open.previous;
    if (back && back.isConnected && typeof back.focus === 'function') back.focus();
}

/**
 * Open a completion certificate in a modal with Download (PNG), Print and
 * Close. Every field is set as text. A second call closes the first. Never
 * throws.
 *
 * @param {{ title?: string, recipient?: string, date?: string, issuer?: string,
 *   logo?: string|HTMLImageElement|Node }} fields
 * @param {{ safeIcons?: boolean }} [options] - A string `logo` follows
 *   `safeIcons` as an achievement icon does. Default true.
 * @returns {undefined}
 */
export function showCertificate(fields, options) {
    if (typeof document === 'undefined') return;
    if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) {
        console.warn('[DopamineJS] showCertificate needs an object of fields.');
        return;
    }
    close();
    let restoreLogo = null;
    try {
        const value = (name) => textOf(ownValue(fields, name));
        const given = { title: value('title'), recipient: value('recipient'), date: value('date'), issuer: value('issuer') };
        const logo = ownValue(fields, 'logo');
        const safeIcons = ownValue(options, 'safeIcons') !== false;

        const overlay = make('div', OVERLAY_CSS);
        overlay.className = 'dopamine-certificate-overlay';
        const card = make('div', CARD_CSS);
        card.className = 'dopamine-certificate-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', 'dopamine-certificate-title');
        card.tabIndex = -1;

        let logoHolder = null;
        if (logo !== undefined && logo !== null && logo !== '') {
            logoHolder = make('div', `height:${LOGO_SIZE}px;font-size:56px;line-height:${LOGO_SIZE}px`);
            logoHolder.className = 'dopamine-certificate-logo';
            // A node taken from the page goes back where it was, with its style, when the certificate closes. One with no parent is left out.
            const parent = logo instanceof Node ? logo.parentNode : null;
            const next = parent ? logo.nextSibling : null;
            const styled = [];
            setIcon(logoHolder, logo, safeIcons);
            for (const child of logoHolder.querySelectorAll('img,svg')) {
                styled.push([child, child.getAttribute('style')]);
                child.style.maxWidth = '100%';
                child.style.maxHeight = `${LOGO_SIZE}px`;
            }
            if (logo instanceof Node) {
                restoreLogo = () => {
                    restoreLogo = null;
                    for (const [child, text] of styled) {
                        if (text === null) child.removeAttribute('style');
                        else child.setAttribute('style', text);
                    }
                    logo.parentNode?.removeChild(logo);
                    parent?.insertBefore(logo, next && next.parentNode === parent ? next : null);
                };
            }
            if (logoHolder.firstChild) card.appendChild(logoHolder);
            else logoHolder = null;
        }
        for (const name of ['title', 'recipient', 'date', 'issuer']) {
            const node = make(name === 'title' ? 'h2' : 'p', `${CLAMP}-webkit-line-clamp:${LINES[name]};${FIELD_CSS[name]}`, given[name]);
            node.className = `dopamine-certificate-${name}`;
            if (name === 'title') node.id = 'dopamine-certificate-title';
            card.appendChild(node);
        }

        const actions = make('div', 'margin-top:28px');
        actions.className = 'dopamine-certificate-actions';
        const buttons = {};
        for (const [name, label] of [['download', 'Download'], ['print', 'Print'], ['close', 'Close']]) {
            buttons[name] = make('button', BUTTON_CSS, label);
            buttons[name].type = 'button';
            buttons[name].className = `dopamine-certificate-${name}`;
            actions.appendChild(buttons[name]);
        }
        card.appendChild(actions);
        overlay.appendChild(card);

        const style = document.createElement('style');
        style.textContent = PRINT_CSS;
        const state = { fields: given, logoHolder, look: null, overlay, style, undo: [], previous: document.activeElement };
        current = state;
        if (restoreLogo) state.undo.push(restoreLogo);
        const read = (name, fallback) => getComputedStyle(card).getPropertyValue(name).trim() || fallback;
        const refreshLook = () => {
            state.look = {
                bg: read('--dopamine-toast-bg', ''),
                text: read('--dopamine-toast-text', '#fff'),
                muted: read('--dopamine-toast-muted', 'rgba(255,255,255,0.85)'),
                accent: read('--dopamine-toast-accent', '#ffd700')
            };
        };

        const on = (target, type, handler) => {
            target.addEventListener(type, handler);
            state.undo.push(() => target.removeEventListener(type, handler));
        };
        on(document, 'keydown', (event) => {
            if (event.key === 'Escape') {
                if (event.defaultPrevented) return;
                event.preventDefault();
                close();
            } else if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                const order = [buttons.download, buttons.print, buttons.close];
                const at = order.indexOf(document.activeElement);
                const step = event.shiftKey ? order.length - 1 : 1;
                const next = at === -1 ? (event.shiftKey ? order.length - 1 : 0) : (at + step) % order.length;
                event.preventDefault();
                order[next].focus();
            }
        });
        on(overlay, 'click', (event) => {
            const target = event.target;
            if (target === overlay || target === buttons.close) {
                close();
            } else if (target === buttons.print) {
                window.print();
            } else if (target === buttons.download && !state.saving) {
                state.saving = true;
                refreshLook();
                download(state).catch((error) => console.error(error)).finally(() => { state.saving = false; });
            }
        });

        document.head.appendChild(style);
        document.body.appendChild(overlay);
        card.focus();
    } catch (error) {
        console.error(error);
        close();
        restoreLogo?.();
    }
}

/** Close the open certificate and remove its DOM, print style and listeners. */
export function destroyCertificate() {
    close();
}
