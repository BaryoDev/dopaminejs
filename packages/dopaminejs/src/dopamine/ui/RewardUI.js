/**
 * The default reward UI: a progress bar, achievement and level-up popups and
 * floating text. Nothing here runs at import time.
 */

import DEFAULT_CSS from './dopamine.css?inline';

const OVERLAY_ID = 'game-ui-overlay';

const DEFAULT_TEXT = {
    levelUp: 'LEVEL UP!',
    achievementUnlocked: 'Achievement Unlocked!'
};

const STYLE_ID = 'dopamine-reward-ui-css';

const DEFAULT_STREAK_ICON = '🔥';

// Config comes from callers, so an inherited property (a polluted prototype)
// must not count.
const textOf = (value) => (value === undefined || value === null ? '' : String(value));

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const ownValue = (object, key) =>
    (object !== null && typeof object === 'object' && hasOwn(object, key) ? object[key] : undefined);

const SVG_NS = 'http://www.w3.org/2000/svg';

const SVG_ELEMENTS = new Set([
    'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline',
    'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'linearGradient',
    'radialGradient', 'stop', 'clipPath', 'mask'
]);

// No style, no href, no event handlers: only geometry and paint.
const SVG_ATTRIBUTES = new Set([
    'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy',
    'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-opacity',
    'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-opacity', 'opacity', 'offset', 'stop-color', 'stop-opacity',
    'gradientUnits', 'gradientTransform', 'clip-path', 'mask', 'clip-rule',
    'font-size', 'font-family', 'font-weight', 'text-anchor', 'id',
    'aria-hidden', 'aria-label', 'role'
]);

// Attributes that may point at a gradient, clip path or mask in the same icon.
const REFERENCE_ATTRIBUTES = new Set(['fill', 'stroke', 'clip-path', 'mask']);
const TRANSFORM_ATTRIBUTES = new Set(['transform', 'gradientTransform']);

const SINGLE_FRAGMENT_URL = /^url\(\s*#([A-Za-z][\w.:-]*)\s*\)$/;
const PLAIN_COLOUR = /^[#a-zA-Z0-9(),.%\s-]+$/;
const PLAIN_TRANSFORM = /^[a-zA-Z0-9(),.\s-]+$/;
const SAFE_ID = /^[A-Za-z][\w.:-]*$/;

// Ids inside an icon are page-global (window.<id>, getElementById), so every
// render gets its own prefix.
let iconCounter = 0;

function collectIds(node, ids) {
    if (node.nodeType !== 1 || node.namespaceURI !== SVG_NS || !SVG_ELEMENTS.has(node.localName)) {
        return;
    }
    const id = node.getAttribute('id');
    if (id && SAFE_ID.test(id)) ids.add(id);
    for (const child of Array.from(node.childNodes)) collectIds(child, ids);
}

/**
 * Returns the value to write, or null to drop the attribute.
 */
function cleanValue(name, value, ctx) {
    if (value.includes('\\')) return null;
    const trimmed = value.trim();

    if (name === 'id') {
        return SAFE_ID.test(trimmed) ? ctx.prefix + trimmed : null;
    }

    if (REFERENCE_ATTRIBUTES.has(name)) {
        const ref = SINGLE_FRAGMENT_URL.exec(trimmed);
        if (ref) {
            return ctx.ids.has(ref[1]) ? `url(#${ctx.prefix}${ref[1]})` : null;
        }
        return PLAIN_COLOUR.test(trimmed) && !/url/i.test(trimmed) ? trimmed : null;
    }

    if (TRANSFORM_ATTRIBUTES.has(name)) {
        return PLAIN_TRANSFORM.test(trimmed) && !/url/i.test(trimmed) ? trimmed : null;
    }

    if (value.includes('(')) {
        // Only a plain colour such as rgb() or hsl() is acceptable here.
        return name === 'stop-color' && PLAIN_COLOUR.test(trimmed) && !/url/i.test(trimmed)
            ? trimmed
            : null;
    }
    return value;
}

function cleanNode(source, ctx) {
    // 3 is text, 4 is CDATA.
    if (source.nodeType === 3 || source.nodeType === 4) {
        return document.createTextNode(source.data);
    }
    if (source.nodeType !== 1
        || source.namespaceURI !== SVG_NS
        || !SVG_ELEMENTS.has(source.localName)) {
        return null;
    }

    const clean = document.createElementNS(SVG_NS, source.localName);
    for (const attr of Array.from(source.attributes)) {
        if (attr.namespaceURI !== null || !SVG_ATTRIBUTES.has(attr.name)) continue;
        const value = cleanValue(attr.name, attr.value, ctx);
        if (value !== null) clean.setAttribute(attr.name, value);
    }
    for (const child of Array.from(source.childNodes)) {
        const kept = cleanNode(child, ctx);
        if (kept) clean.appendChild(kept);
    }
    return clean;
}

/**
 * Parse a string as SVG and rebuild it from an allowlist of elements and
 * attributes, so nothing that can run script or load a resource survives.
 * Returns null unless the whole string is one valid <svg> document.
 */
function parseSafeSvg(markup) {
    let doc;
    // Inline HTML SVG usually has no xmlns, which the XML parser rejects.
    const source = /^\s*<svg[\s>]/.test(markup) && !/^\s*<svg\b[^>]*\sxmlns\s*=/.test(markup)
        ? markup.replace(/^(\s*<svg)/, `$1 xmlns="${SVG_NS}"`)
        : markup;
    try {
        doc = new DOMParser().parseFromString(source,'image/svg+xml');
    } catch {
        return null;
    }
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
        return null;
    }
    const ids = new Set();
    collectIds(root, ids);
    return cleanNode(root, { ids, prefix: `dj-icon-${++iconCounter}-` });
}

export class RewardUI {
    /**
     * @param {{ particles?: Object|null }} [parts] - Read at call time, so a
     *   different particle renderer is picked up without rebuilding the UI.
     * @param {Object} [config]
     * @param {{levelUp?: string, achievementUnlocked?: string}} [config.text]
     *   Replaces the built-in popup strings.
     * @param {{streak?: string|Node}} [config.icons]
     * @param {boolean} [config.safeIcons] - Render string icons as sanitised
     *   SVG or plain text. Default true. False renders them as HTML.
     * @param {boolean|string} [config.injectCss] - Add the stylesheet from
     *   code. A string is the CSS text. Default false: import
     *   `dopaminejs/style.css` instead.
     */
    constructor(parts = {}, config = {}) {
        this.parts = parts || {};

        // Only strings override a default, so a non-string cannot break a
        // popup. An empty string is allowed and hides that text.
        const textConfig = ownValue(config, 'text');
        this.strings = { ...DEFAULT_TEXT };
        for (const key of Object.keys(DEFAULT_TEXT)) {
            const value = ownValue(textConfig, key);
            if (typeof value === 'string') this.strings[key] = value;
        }
        this.safeIcons = ownValue(config, 'safeIcons') !== false;
        this._streakIcon = ownValue(ownValue(config, 'icons'), 'streak') ?? DEFAULT_STREAK_ICON;
        this._injectCss = ownValue(config, 'injectCss');
        this.container = null;
        this.xpBar = null;
        this.levelDisplay = null;
        this.streakDisplay = null;
        this._style = null;
        this._xp = null;
        this._level = null;

        // Everything this instance put in the DOM or scheduled, so destroy()
        // can take it all back out again.
        this._timers = new Set();
        this._detached = [];

        this._build();
    }

    /**
     * The overlay element, for themes. Null after destroy().
     * @returns {HTMLElement|null}
     */
    get root() {
        return this.container;
    }

    /** @private */
    _build() {
        if (this._injectCss) this._addStyles();

        this.container = document.createElement('div');
        this.container.className = 'game-ui-overlay';

        // The stylesheet targets #game-ui-overlay. Claim the id only if it is
        // free, so a second instance cannot produce a duplicate id.
        if (!document.getElementById(OVERLAY_ID)) {
            this.container.id = OVERLAY_ID;
        }

        this.container.innerHTML = `
            <div class="game-ui-top-bar">
                <div class="level-badge">
                    <span class="level-label">LVL</span>
                    <span class="level-number">1</span>
                </div>

                <div class="xp-container">
                    <div class="xp-bar-bg">
                        <div class="xp-bar-fill" style="width: 0%"></div>
                    </div>
                    <div class="xp-text">0 / 100 XP</div>
                </div>

                <div class="streak-badge">
                    <span class="streak-icon"></span>
                    <span class="streak-number">1</span>
                </div>
            </div>
        `;

        // Popups are decorative and short-lived, so a screen reader would
        // miss them. This region repeats them as plain text.
        this.liveRegion = document.createElement('div');
        this.liveRegion.className = 'dopamine-live-region';
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('role', 'status');
        Object.assign(this.liveRegion.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap'
        });
        this.container.appendChild(this.liveRegion);

        document.body.appendChild(this.container);

        // Scoped to this instance. Document-wide getElementById would make a
        // second RewardUI silently rebind every element to the first one's DOM.
        this.levelBadge = this.container.querySelector('.level-badge');
        this.streakBadge = this.container.querySelector('.streak-badge');
        this.xpBar = this.container.querySelector('.xp-bar-fill');
        this.xpText = this.container.querySelector('.xp-text');
        this.levelDisplay = this.container.querySelector('.level-number');
        this.streakDisplay = this.container.querySelector('.streak-number');
        this._setIcon(this.container.querySelector('.streak-icon'), this._streakIcon);
    }

    /**
     * Add the stylesheet once per page. The first instance owns the element
     * and removes it on destroy; later ones share it.
     * @private
     */
    _addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const css = typeof this._injectCss === 'string' ? this._injectCss : DEFAULT_CSS;
        this._style = document.createElement('style');
        this._style.id = STYLE_ID;
        this._style.textContent = css;
        document.head.appendChild(this._style);
    }

    /**
     * Single place where icons reach the DOM. A Node is appended. A string is
     * a sanitised SVG or plain text unless safeIcons is off; then it is HTML
     * (see SECURITY.md).
     * @private
     */
    _setIcon(el, icon) {
        el.textContent = '';
        if (typeof Node !== 'undefined' && icon instanceof Node) {
            el.appendChild(icon);
        } else if (typeof icon !== 'string') {
            return;
        } else if (!this.safeIcons) {
            el.innerHTML = icon;
        } else {
            const svg = parseSafeSvg(icon);
            if (svg) {
                el.appendChild(svg);
            } else {
                el.textContent = icon;
            }
        }
    }

    /**
     * setTimeout that destroy() can cancel.
     * @private
     */
    _defer(fn, delay) {
        const id = setTimeout(() => {
            this._timers.delete(id);
            fn();
        }, delay);
        this._timers.add(id);
        return id;
    }

    /**
     * Append a transient element and remember it for cleanup.
     * @private
     */
    _mount(el) {
        document.body.appendChild(el);
        this._detached.push(el);
        return el;
    }

    /**
     * Repeat a popup as text for assistive technology.
     * @private
     */
    _announce(message) {
        if (this.liveRegion) {
            this.liveRegion.textContent = message;
        }
    }

    /**
     * Ask the particle part for a burst, if there is one. The part is looked
     * up on every call.
     * @private
     */
    _burst(kind, at, opts) {
        this.parts.particles?.burst?.(kind, at, opts);
    }

    /**
     * Replay a CSS animation by clearing it for one tick.
     * @private
     */
    _replayAnimation(el, animation) {
        if (!el) return;
        el.style.animation = 'none';
        this._defer(() => { el.style.animation = animation; }, 10);
    }

    /**
     * Draw the bar, the level and the streak.
     * @param {{ xp: number, level: number, progress?: number, streak: number, next?: number }} state
     *   `progress` is the position within the current level, 0 to 1. `next` is
     *   the XP total that marks the next level. Without `progress` the bar
     *   falls back to xp / next.
     */
    hud(state) {
        if (!this.container || !state) return;
        const { xp, level, progress, streak, next } = state;

        const fraction = Number.isFinite(progress)
            ? progress
            : (next > 0 ? xp / next : 0);
        this.xpBar.style.width = `${Math.max(0, Math.min(100, fraction * 100))}%`;
        this.xpText.textContent = Number.isFinite(next) ? `${xp} / ${next} XP` : `${xp} XP`;
        if (xp !== this._xp) this._replayAnimation(this.xpBar, 'xp-pulse 0.3s ease-out');
        this._xp = xp;

        this.levelDisplay.textContent = level;
        if (level !== this._level) this._replayAnimation(this.levelBadge, 'level-pulse 0.5s ease-out');
        this._level = level;

        this.streakDisplay.textContent = streak;
        if (streak >= 7) {
            this.streakBadge.style.background = 'linear-gradient(135deg, #ff6b00 0%, #ff4400 100%)';
        } else if (streak >= 3) {
            this.streakBadge.style.background = 'linear-gradient(135deg, #ff8800 0%, #ff6b00 100%)';
        } else {
            this.streakBadge.style.background = '';
        }
    }

    /**
     * Show a popup. Every field is set as text. Only `icon` can carry markup,
     * and only when safeIcons is off; a Node is appended as is.
     *
     * - `achievement`: `title` is the name, `body` the description, `meta`
     *   an extra line such as "+50 XP".
     * - `level`: `body` is the new level. `title` replaces the heading and
     *   falls back to the configured level-up text.
     * - `notice`: `title` is a message floated over the page. `tier` picks
     *   the colour and the burst.
     * - `custom` (and any other kind): the achievement layout without the heading.
     *
     * @param {{ kind: string, title?: string, body?: string, icon?: string|Node,
     *   meta?: string, tier?: 'common'|'rare'|'legendary' }} popup
     */
    popup(popup) {
        if (!this.container || !popup || typeof popup !== 'object') return;
        const kind = ownValue(popup, 'kind');
        if (kind === 'level') {
            this._levelPopup(popup);
        } else if (kind === 'notice') {
            this._notice(popup);
        } else {
            this._card(popup, kind === 'achievement');
        }
    }

    /** @private */
    _card(popup, withHeading) {
        const card = document.createElement('div');
        card.className = 'achievement-popup';
        card.innerHTML = `
            <div class="achievement-shine"></div>
            <div class="achievement-content">
                <div class="achievement-icon"></div>
                <div class="achievement-info">
                    <div class="achievement-title"></div>
                    <div class="achievement-name"></div>
                    <div class="achievement-desc"></div>
                    <div class="achievement-xp"></div>
                </div>
            </div>
        `;

        const title = textOf(popup.title);
        card.querySelector('.achievement-title').textContent = withHeading ? this.strings.achievementUnlocked : '';
        this._setIcon(card.querySelector('.achievement-icon'), popup.icon);
        card.querySelector('.achievement-name').textContent = title;
        card.querySelector('.achievement-desc').textContent = textOf(popup.body);
        card.querySelector('.achievement-xp').textContent = textOf(popup.meta);

        this._mount(card);
        this._announce(withHeading ? `${this.strings.achievementUnlocked}: ${title}` : title);

        this._defer(() => {
            const rect = card.getBoundingClientRect();
            this._burst('confetti', { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, { count: 40 });
        }, 300);

        this._defer(() => {
            card.style.animation = 'slideOut 0.3s ease-in forwards';
            this._defer(() => this._remove(card), 300);
        }, 4000);
    }

    /** @private */
    _levelPopup(popup) {
        const heading = typeof popup.title === 'string' && popup.title !== '' ? popup.title : this.strings.levelUp;
        const level = textOf(popup.body);

        const overlay = document.createElement('div');
        overlay.className = 'level-up-overlay';
        overlay.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-title"></div>
                <div class="level-up-number"></div>
                <div class="level-up-subtitle">Amazing progress!</div>
            </div>
        `;
        overlay.querySelector('.level-up-title').textContent = heading;
        overlay.querySelector('.level-up-number').textContent = level;

        this._mount(overlay);
        this._announce(`Level up: ${level}`);

        this._defer(() => {
            for (let i = 0; i < 5; i++) {
                this._defer(() => {
                    this._burst('confetti', {
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight * 0.6
                    }, { count: 30 });
                }, i * 200);
            }
        }, 300);

        this._defer(() => {
            overlay.style.opacity = '0';
            this._defer(() => this._remove(overlay), 500);
        }, 2500);
    }

    /** @private */
    _notice(popup) {
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 3;
        const message = textOf(popup.title);

        if (popup.tier === 'legendary') {
            this._floatText({ text: message, x, y, color: '#ffd700', size: '36px' });
            this._burst('stars', { x, y }, { count: 12 });
            this._burst('confetti', { x, y }, { count: 25 });
        } else if (popup.tier === 'rare') {
            this._floatText({ text: message, x, y, color: '#ff6b6b', size: '32px' });
            this._burst('fire', { x, y }, { count: 20 });
        } else {
            this._floatText({ text: message, x, y, color: '#fff', size: '24px' });
        }

        this._announce(message);
    }

    /**
     * Float a short text over the page, then remove it.
     * @param {{ text: string, x?: number, y?: number, color?: string }} options
     */
    text(options) {
        this._floatText({ ...options });
    }

    /** @private */
    _floatText({ text, x, y, color = '#ffd700', size = '24px' }) {
        if (!this.container) return;
        const floater = document.createElement('div');
        floater.className = 'floating-text';
        floater.textContent = textOf(text);
        floater.style.left = (Number.isFinite(x) ? x : window.innerWidth / 2) + 'px';
        floater.style.top = (Number.isFinite(y) ? y : window.innerHeight / 3) + 'px';
        floater.style.color = color;
        floater.style.fontSize = size;

        this._mount(floater);

        this._defer(() => this._remove(floater), 2000);
    }

    /**
     * @private
     */
    _remove(el) {
        el.remove();
        const i = this._detached.indexOf(el);
        if (i > -1) this._detached.splice(i, 1);
    }

    /**
     * Tear down the overlay, any transient popups, and all pending timers.
     */
    destroy() {
        for (const id of this._timers) {
            clearTimeout(id);
        }
        this._timers.clear();

        for (const el of this._detached) {
            el.remove();
        }
        this._detached = [];

        this.container?.remove();
        this._style?.remove();
        this._style = null;
        this.container = null;
        this.liveRegion = null;
        this.xpBar = null;
        this.xpText = null;
        this.levelBadge = null;
        this.streakBadge = null;
        this.levelDisplay = null;
        this.streakDisplay = null;
        this._streakIcon = null;
    }
}
