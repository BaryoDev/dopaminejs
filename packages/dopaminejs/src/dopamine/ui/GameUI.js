/**
 * UI Components for Dopamine-Driven Games
 * Reusable UI elements for XP bars, achievement popups, level-up screens, etc.
 */

const OVERLAY_ID = 'game-ui-overlay';

export class GameUI {
    constructor(particleSystem) {
        this.particleSystem = particleSystem;
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
                    <span class="streak-icon">🔥</span>
                    <span class="streak-number">1</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Scoped to this instance. Document-wide getElementById would make a
        // second GameUI silently rebind every element to the first one's DOM.
        this.levelBadge = this.container.querySelector('.level-badge');
        this.streakBadge = this.container.querySelector('.streak-badge');
        this.xpBar = this.container.querySelector('.xp-bar-fill');
        this.xpText = this.container.querySelector('.xp-text');
        this.levelDisplay = this.container.querySelector('.level-number');
        this.streakDisplay = this.container.querySelector('.streak-number');
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
     */
    updateXP(current, needed, total) {
        const progress = total > 0 ? (current / total) * 100 : 0;
        this.xpBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
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
        }
    }

    /**
     * Show achievement unlocked popup
     *
     * `icon` is rendered as HTML by design (documented in ARCHITECTURE.md, so
     * games can pass an <img> or inline SVG). Every other field is game state
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
                    <div class="achievement-title">Achievement Unlocked!</div>
                    <div class="achievement-name"></div>
                    <div class="achievement-desc"></div>
                    <div class="achievement-xp"></div>
                </div>
            </div>
        `;

        popup.querySelector('.achievement-icon').innerHTML = achievement.icon ?? '';
        popup.querySelector('.achievement-name').textContent = achievement.name ?? '';
        popup.querySelector('.achievement-desc').textContent = achievement.description ?? '';
        popup.querySelector('.achievement-xp').textContent = `+${achievement.xp ?? 0} XP`;

        this._mount(popup);

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
                <div class="level-up-title">LEVEL UP!</div>
                <div class="level-up-number"></div>
                <div class="level-up-subtitle">Amazing progress!</div>
            </div>
        `;
        overlay.querySelector('.level-up-number').textContent = newLevel;

        this._mount(overlay);

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
        this.showFloatingText('CLOSE CALL!', x, y, '#45b7d1', '20px');
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

        if (type === 'legendary') {
            this.showLuckyMoment(message, x, y);
        } else if (type === 'rare') {
            this.showCombo(message, x, y);
        } else {
            this.showFloatingText(message, x, y, '#fff', '24px');
        }
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
        this.xpBar = null;
        this.xpText = null;
        this.levelBadge = null;
        this.streakBadge = null;
        this.levelDisplay = null;
        this.streakDisplay = null;
    }
}
