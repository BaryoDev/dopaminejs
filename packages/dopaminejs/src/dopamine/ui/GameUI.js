/**
 * UI Components for Dopamine-Driven Games
 * Reusable UI elements for XP bars, achievement popups, level-up screens, etc.
 */

const OVERLAY_ID = 'game-ui-overlay';

const DEFAULT_TEXT = {
    levelUp: 'LEVEL UP!',
    achievementUnlocked: 'Achievement Unlocked!',
    nearMiss: 'CLOSE CALL!'
};

const DEFAULT_STREAK_ICON = '🔥';

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
    if (source.nodeType === 3) {
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
    try {
        doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
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

export class GameUI {
    /**
     * @param {Object} particleSystem
     * @param {Object} [config]
     * @param {{levelUp?: string, achievementUnlocked?: string, nearMiss?: string}} [config.text]
     *   Replaces the built-in popup strings.
     * @param {{streak?: string|Node}} [config.icons]
     * @param {boolean} [config.safeIcons] - Render string icons as sanitised
     *   SVG or plain text instead of HTML. Default false.
     */
    constructor(particleSystem, config = {}) {
        this.particleSystem = particleSystem;

        // Only strings override a default, so a bad value cannot blank a popup.
        this.text = { ...DEFAULT_TEXT };
        for (const key of Object.keys(DEFAULT_TEXT)) {
            const value = config?.text?.[key];
            if (typeof value === 'string') this.text[key] = value;
        }
        this.safeIcons = config?.safeIcons === true;
        this._streakIcon = config?.icons?.streak ?? DEFAULT_STREAK_ICON;
        this.container = null;
        this.xpBar = null;
        this.levelDisplay = null;
        this.streakDisplay = null;

        // Everything this instance put in the DOM or scheduled, so destroy()
        // can take it all back out again.
        this._timers = new Set();
        this._detached = [];

        this.init();
    }

    /**
     * Initialize UI overlay
     */
    init() {
        // Create main container
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
        // second GameUI silently rebind every element to the first one's DOM.
        this.levelBadge = this.container.querySelector('.level-badge');
        this.streakBadge = this.container.querySelector('.streak-badge');
        this.xpBar = this.container.querySelector('.xp-bar-fill');
        this.xpText = this.container.querySelector('.xp-text');
        this.levelDisplay = this.container.querySelector('.level-number');
        this.streakDisplay = this.container.querySelector('.streak-number');
        this._setIcon(this.container.querySelector('.streak-icon'), this._streakIcon);
    }

    /**
     * Single place where icons reach the DOM. A Node is appended. A string is
     * HTML unless safeIcons is on (see SECURITY.md); then it is a sanitised
     * SVG or plain text.
     * @private
     */
    _setIcon(el, icon) {
        el.textContent = '';
        if (icon && typeof icon === 'object' && typeof icon.nodeType === 'number') {
            el.appendChild(icon);
        } else if (!this.safeIcons) {
            el.innerHTML = icon ?? '';
        } else {
            const svg = typeof icon === 'string' ? parseSafeSvg(icon) : null;
            if (svg) {
                el.appendChild(svg);
            } else {
                el.textContent = icon ?? '';
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
     * Replay a CSS animation by clearing it for one tick.
     * @private
     */
    _replayAnimation(el, animation) {
        if (!el) return;
        el.style.animation = 'none';
        this._defer(() => { el.style.animation = animation; }, 10);
    }

    /**
     * Update XP bar
     * @param {number} current - XP held right now
     * @param {number} needed - XP still required for the next level
     * @param {number} total - XP total that marks the next level
     * @param {number} [progress] - Position within the current level, 0 to 1.
     *   Without it the bar falls back to current / total, which is lifetime
     *   XP and starts every level after the first partly full.
     */
    updateXP(current, needed, total, progress) {
        const fraction = Number.isFinite(progress)
            ? progress
            : (total > 0 ? current / total : 0);
        this.xpBar.style.width = `${Math.max(0, Math.min(100, fraction * 100))}%`;
        this.xpText.textContent = `${current} / ${total} XP`;

        this._replayAnimation(this.xpBar, 'xp-pulse 0.3s ease-out');
    }

    /**
     * Update level display
     */
    updateLevel(level) {
        this.levelDisplay.textContent = level;
        this._replayAnimation(this.levelBadge, 'level-pulse 0.5s ease-out');
    }

    /**
     * Update streak display
     */
    updateStreak(days) {
        this.streakDisplay.textContent = days;

        // Change color based on streak
        if (days >= 7) {
            this.streakBadge.style.background = 'linear-gradient(135deg, #ff6b00 0%, #ff4400 100%)';
        } else if (days >= 3) {
            this.streakBadge.style.background = 'linear-gradient(135deg, #ff8800 0%, #ff6b00 100%)';
        } else {
            this.streakBadge.style.background = '';
        }
    }

    /**
     * Show achievement unlocked popup
     *
     * A string `icon` is rendered as HTML by design (documented in
     * ARCHITECTURE.md, so games can pass an <img> or inline SVG). A Node is
     * appended as is. Every other field is game state
     * and could carry a player-supplied or server-supplied string, so it goes
     * in as text.
     */
    showAchievement(achievement) {
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
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

        popup.querySelector('.achievement-title').textContent = this.text.achievementUnlocked;
        this._setIcon(popup.querySelector('.achievement-icon'), achievement.icon);
        popup.querySelector('.achievement-name').textContent = achievement.name ?? '';
        popup.querySelector('.achievement-desc').textContent = achievement.description ?? '';
        popup.querySelector('.achievement-xp').textContent = `+${achievement.xp ?? 0} XP`;

        this._mount(popup);
        this._announce(`Achievement unlocked: ${achievement.name ?? ''}`);

        // Trigger confetti at popup location
        this._defer(() => {
            const rect = popup.getBoundingClientRect();
            this.particleSystem.confetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
        }, 300);

        // Remove after animation
        this._defer(() => {
            popup.style.animation = 'slideOut 0.3s ease-in forwards';
            this._defer(() => this._remove(popup), 300);
        }, 4000);
    }

    /**
     * Show level up screen
     */
    showLevelUp(oldLevel, newLevel) {
        const overlay = document.createElement('div');
        overlay.className = 'level-up-overlay';
        overlay.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-title"></div>
                <div class="level-up-number"></div>
                <div class="level-up-subtitle">Amazing progress!</div>
            </div>
        `;
        overlay.querySelector('.level-up-title').textContent = this.text.levelUp;
        overlay.querySelector('.level-up-number').textContent = newLevel;

        this._mount(overlay);
        this._announce(`Level up: ${newLevel}`);

        // Fireworks effect
        this._defer(() => {
            for (let i = 0; i < 5; i++) {
                this._defer(() => {
                    const x = Math.random() * window.innerWidth;
                    const y = Math.random() * window.innerHeight * 0.6;
                    this.particleSystem.confetti(x, y, 30);
                }, i * 200);
            }
        }, 300);

        // Remove after 3 seconds
        this._defer(() => {
            overlay.style.opacity = '0';
            this._defer(() => this._remove(overlay), 500);
        }, 2500);
    }

    /**
     * Show floating text (e.g., "+50 XP", "COMBO!")
     */
    showFloatingText(text, x, y, color = '#ffd700', size = '24px') {
        const floater = document.createElement('div');
        floater.className = 'floating-text';
        floater.textContent = text;
        floater.style.left = x + 'px';
        floater.style.top = y + 'px';
        floater.style.color = color;
        floater.style.fontSize = size;

        this._mount(floater);

        this._defer(() => this._remove(floater), 2000);
    }

    /**
     * Show combo multiplier
     */
    showCombo(multiplier, x, y) {
        this.showFloatingText(`${multiplier}× COMBO!`, x, y, '#ff6b6b', '32px');
        this.particleSystem.fire(x, y, 20);
    }

    /**
     * Show "near miss" indicator
     */
    showNearMiss(x, y) {
        this.showFloatingText(this.text.nearMiss, x, y, '#45b7d1', '20px');
        this.particleSystem.sparkle(x, y, 15, '#45b7d1');
    }

    /**
     * Show lucky moment (random multiplier)
     */
    showLuckyMoment(multiplier, x, y) {
        this.showFloatingText(`LUCKY ${multiplier}×!`, x, y, '#ffd700', '36px');
        this.particleSystem.starBurst(x, y, 12);
        this.particleSystem.confetti(x, y, 25);
    }

    /**
     * Show generic notification
     */
    showNotification(message, type = 'normal') {
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 3;

        // The message is shown as written. showLuckyMoment and showCombo
        // expect a multiplier and would wrap it in "LUCKY ...×!".
        if (type === 'legendary') {
            this.showFloatingText(message, x, y, '#ffd700', '36px');
            this.particleSystem.starBurst(x, y, 12);
            this.particleSystem.confetti(x, y, 25);
        } else if (type === 'rare') {
            this.showFloatingText(message, x, y, '#ff6b6b', '32px');
            this.particleSystem.fire(x, y, 20);
        } else {
            this.showFloatingText(message, x, y, '#fff', '24px');
        }

        this._announce(message);
    }

    /**
     * Show Game Over Summary
     *
     * @param {Object} data
     * @param {number|string} data.score - Final score
     * @param {Object} [data.metrics] - Label/value pairs listed under the score
     * @param {Function} [data.onReplay] - Replay button handler (default: reload)
     * @param {Function} [data.onExit] - Exit button handler (button hidden if omitted)
     */
    showSummary(data) {
        const overlay = document.createElement('div');
        overlay.className = 'message-box';
        overlay.style.display = 'flex';
        overlay.style.position = 'absolute';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.zIndex = '1000';

        const heading = document.createElement('h1');
        heading.textContent = 'Game Over';

        const score = document.createElement('div');
        score.className = 'summary-score';
        score.style.cssText = 'font-size: 3rem; font-weight: bold; color: #e06020; margin: 10px 0;';
        score.textContent = data.score;

        const metrics = document.createElement('div');
        metrics.className = 'summary-metrics';
        metrics.style.cssText = 'width: 100%; margin-bottom: 20px;';

        for (const [key, value] of Object.entries(data.metrics || {})) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;width:100%';

            const label = document.createElement('span');
            label.textContent = `${key}:`;

            const amount = document.createElement('strong');
            amount.textContent = value;

            row.append(label, amount);
            metrics.appendChild(row);
        }

        overlay.append(heading, score, metrics);

        // addEventListener rather than an onclick attribute: inline handlers
        // are blocked by any script-src CSP without 'unsafe-inline'.
        const replay = document.createElement('button');
        replay.className = 'btn';
        replay.textContent = 'Play Again';
        replay.addEventListener('click', data.onReplay || (() => window.location.reload()));
        overlay.appendChild(replay);

        if (data.onExit) {
            const exit = document.createElement('button');
            exit.className = 'btn';
            exit.textContent = 'Exit';
            exit.style.cssText = 'margin-top: 10px; background: #543847;';
            exit.addEventListener('click', data.onExit);
            overlay.appendChild(exit);
        }

        this._mount(overlay);
        return overlay;
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
