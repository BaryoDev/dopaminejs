/**
 * Reward System Middleware
 * Allows plugins to hook into reward events and modify behavior
 */

export class RewardMiddleware {
    constructor() {
        this.hooks = {
            beforeXP: [],
            afterXP: [],
            beforeLevelUp: [],
            afterLevelUp: [],
            beforeAchievement: [],
            afterAchievement: [],
        };
    }

    /**
     * Register a middleware hook
     * @param {string} event - Event name (beforeXP, afterXP, etc.)
     * @param {Function} callback - Middleware function
     */
    use(event, callback) {
        if (!this.hooks[event]) {
            console.warn(`[RewardMiddleware] Unknown event: ${event}`);
            return;
        }
        this.hooks[event].push(callback);
    }

    /**
     * Execute before hooks
     * @param {string} event - Event name
     * @param {Object} data - Event data
     * @returns {Object} Modified data
     */
    async executeBefore(event, data) {
        const hooks = this.hooks[`before${event}`] || [];
        let result = { ...data };

        for (const hook of hooks) {
            try {
                const modified = await hook(result);
                if (modified !== undefined) {
                    result = { ...result, ...modified };
                }
            } catch (error) {
                console.error(`[RewardMiddleware] Error in before${event} hook:`, error);
            }
        }

        return result;
    }

    /**
     * Execute after hooks
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    async executeAfter(event, data) {
        const hooks = this.hooks[`after${event}`] || [];

        for (const hook of hooks) {
            try {
                await hook(data);
            } catch (error) {
                console.error(`[RewardMiddleware] Error in after${event} hook:`, error);
            }
        }
    }
}

/**
 * Webhook Integration
 * Send reward events to backend servers
 */
export class WebhookIntegration {
    constructor(config = {}) {
        this.webhookUrl = config.webhookUrl;
        this.secret = config.secret;
        this.enabled = config.enabled !== false;
        this.queue = [];
        this.sending = false;
    }

    /**
     * Send event to webhook
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
    async send(event, data) {
        if (!this.enabled || !this.webhookUrl) return;

        const payload = {
            event,
            data,
            timestamp: Date.now(),
            signature: this._generateSignature(event, data),
        };

        this.queue.push(payload);
        this._processQueue();
    }

    /**
     * Process webhook queue
     * @private
     */
    async _processQueue() {
        if (this.sending || this.queue.length === 0) return;

        this.sending = true;

        while (this.queue.length > 0) {
            const payload = this.queue.shift();

            try {
                const response = await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Dopamine-Signature': payload.signature,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    console.error('[WebhookIntegration] Failed to send webhook:', response.statusText);
                }
            } catch (error) {
                console.error('[WebhookIntegration] Webhook error:', error);
            }
        }

        this.sending = false;
    }

    /**
     * Generate HMAC signature for webhook security
     * @private
     */
    _generateSignature(event, data) {
        if (!this.secret) return '';

        // Simple signature (in production, use crypto.subtle or a library)
        const payload = JSON.stringify({ event, data });
        return btoa(`${this.secret}:${payload}`);
    }
}

/**
 * Example: Battle Pass Plugin
 */
export const BattlePassPlugin = {
    name: 'battle-pass',
    version: '1.0.0',

    init(kernel) {
        console.log('[BattlePassPlugin] Installing battle pass system...');

        // Get reward system
        const rewardSystem = kernel.systems.get('rewards');
        if (!rewardSystem) {
            console.error('[BattlePassPlugin] RewardSystem not found');
            return;
        }

        // Add battle pass tiers
        this.tiers = [
            { level: 1, xpRequired: 0, reward: 'Bronze Badge' },
            { level: 5, xpRequired: 500, reward: 'Silver Badge' },
            { level: 10, xpRequired: 1500, reward: 'Gold Badge' },
            { level: 20, xpRequired: 5000, reward: 'Platinum Badge' },
        ];

        // Listen to XP events
        kernel.events.on('xp_gained', ({ amount, total }) => {
            this._checkTierProgress(total);
        });
    },

    _checkTierProgress(totalXP) {
        for (const tier of this.tiers) {
            if (totalXP >= tier.xpRequired && !tier.claimed) {
                tier.claimed = true;
                console.log(`[BattlePass] Tier ${tier.level} unlocked: ${tier.reward}`);

                // Emit custom event
                window.dispatchEvent(new CustomEvent('battlepass:tier-unlocked', {
                    detail: tier
                }));
            }
        }
    },

    destroy() {
        console.log('[BattlePassPlugin] Uninstalling battle pass system...');
    }
};

/**
 * Example: Leaderboard Plugin
 */
export const LeaderboardPlugin = {
    name: 'leaderboard',
    version: '1.0.0',

    init(kernel) {
        console.log('[LeaderboardPlugin] Installing leaderboard system...');

        this.webhook = new WebhookIntegration({
            webhookUrl: 'https://api.example.com/leaderboard',
            secret: 'your-secret-key',
            enabled: true,
        });

        // Send level-up events to backend
        kernel.events.on('level_up', (data) => {
            this.webhook.send('level_up', {
                playerId: this._getPlayerId(),
                level: data.newLevel,
                xp: data.totalXP,
            });
        });

        // Send achievement unlocks
        kernel.events.on('achievement_unlocked', (data) => {
            this.webhook.send('achievement', {
                playerId: this._getPlayerId(),
                achievementId: data.id,
                timestamp: Date.now(),
            });
        });
    },

    _getPlayerId() {
        // Get player ID from localStorage or generate one
        let playerId = localStorage.getItem('dopamine_player_id');
        if (!playerId) {
            playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('dopamine_player_id', playerId);
        }
        return playerId;
    },

    destroy() {
        console.log('[LeaderboardPlugin] Uninstalling leaderboard system...');
    }
};
