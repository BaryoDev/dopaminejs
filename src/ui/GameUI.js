/**
 * UI Components for Dopamine-Driven Games
 * Reusable UI elements for XP bars, achievement popups, level-up screens, etc.
 */

export class GameUI {
    constructor(particleSystem) {
        this.particleSystem = particleSystem;
        this.container = null;
        this.xpBar = null;
        this.levelDisplay = null;
        this.streakDisplay = null;
        this.init();
    }

    /**
     * Initialize UI overlay
     */
    init() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'game-ui-overlay';
        this.container.innerHTML = `
            <div class="game-ui-top-bar">
                <div class="level-badge" id="level-badge">
                    <span class="level-label">LVL</span>
                    <span class="level-number" id="level-number">1</span>
                </div>
                
                <div class="xp-container">
                    <div class="xp-bar-bg">
                        <div class="xp-bar-fill" id="xp-bar-fill" style="width: 0%"></div>
                    </div>
                    <div class="xp-text" id="xp-text">0 /100 XP</div>
                </div>
                
                <div class="streak-badge" id="streak-badge">
                    <span class="streak-icon">🔥</span>
                    <span class="streak-number" id="streak-number">1</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Cache elements
        this.xpBar = document.getElementById('xp-bar-fill');
        this.xpText = document.getElementById('xp-text');
        this.levelDisplay = document.getElementById('level-number');
        this.streakDisplay = document.getElementById('streak-number');
    }

    /**
     * Update XP bar
     */
    updateXP(current, needed, total) {
        const progress = (current / total) * 100;
        this.xpBar.style.width = `${Math.min(100, progress)}%`;
        this.xpText.textContent = `${current} / ${total} XP`;

        // Add pulse animation when gaining XP
        this.xpBar.style.animation = 'none';
        setTimeout(() => {
            this.xpBar.style.animation = 'xp-pulse 0.3s ease-out';
        }, 10);
    }

    /**
     * Update level display
     */
    updateLevel(level) {
        this.levelDisplay.textContent = level;

        // Pulse animation
        const badge = document.getElementById('level-badge');
        badge.style.animation = 'none';
        setTimeout(() => {
            badge.style.animation = 'level-pulse 0.5s ease-out';
        }, 10);
    }

    /**
     * Update streak display
     */
    updateStreak(days) {
        this.streakDisplay.textContent = days;

        // Change color based on streak
        const badge = document.getElementById('streak-badge');
        if (days >= 7) {
            badge.style.background = 'linear-gradient(135deg, #ff6b00 0%, #ff4400 100%)';
        } else if (days >= 3) {
            badge.style.background = 'linear-gradient(135deg, #ff8800 0%, #ff6b00 100%)';
        }
    }

    /**
     * Show achievement unlocked popup
     */
    showAchievement(achievement) {
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-shine"></div>
            <div class="achievement-content">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-title">Achievement Unlocked!</div>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-desc">${achievement.description}</div>
                    <div class="achievement-xp">+${achievement.xp} XP</div>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Trigger confetti at popup location
        setTimeout(() => {
            const rect = popup.getBoundingClientRect();
            this.particleSystem.confetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
        }, 300);

        // Remove after animation
        setTimeout(() => {
            popup.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => popup.remove(), 300);
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
                <div class="level-up-number">${newLevel}</div>
                <div class="level-up-subtitle">Amazing progress!</div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Fireworks effect
        setTimeout(() => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const x = Math.random() * window.innerWidth;
                    const y = Math.random() * window.innerHeight * 0.6;
                    this.particleSystem.confetti(x, y, 30);
                }, i * 200);
            }
        }, 300);

        // Remove after 3 seconds
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
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

        document.body.appendChild(floater);

        setTimeout(() => floater.remove(), 2000);
    }

    /**
     * Show combo multiplier
     */
    showCombo(multiplier, x, y) {
        this.showFloatingText(`${multiplier}× COMBO!`, x, y, '#ff6b6b', '32px');
        this.particleSystem.fire(x, y, 20);
    }

    /**
     * Show "near miss"indicator
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

        let metricsHtml = '';
        if (data.metrics) {
            metricsHtml = Object.entries(data.metrics)
                .map(([key, value]) => `<div style="display:flex;justify-content:space-between;width:100%"><span>${key}:</span> <strong>${value}</strong></div>`)
                .join('');
        }

        overlay.innerHTML = `
            <h1>Game Over</h1>
            <div style="font-size: 3rem; font-weight: bold; color: #e06020; margin: 10px 0;">${data.score}</div>
            <div style="width: 100%; margin-bottom: 20px;">
                ${metricsHtml}
            </div>
            <button class="btn" onclick="location.reload()">Play Again</button>
            <button class="btn" onclick="window.location.href='index.html'" style="margin-top: 10px; background: #543847;">Exit</button>
        `;

        document.body.appendChild(overlay);
    }
}
