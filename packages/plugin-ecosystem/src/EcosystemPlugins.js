/**
 * Reward System Middleware
 * Allows plugins to hook into reward events and modify behavior
 */

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

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
        // hasOwn: 'constructor' and friends are truthy on any object.
        if (!hasOwn(this.hooks, event)) {
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
        const key = `before${event}`;
        const hooks = hasOwn(this.hooks, key) ? this.hooks[key] : [];
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
        const key = `after${event}`;
        const hooks = hasOwn(this.hooks, key) ? this.hooks[key] : [];

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
 *
 * With a `secret`, each request carries
 *   X-Dopamine-Signature: sha256=<hex HMAC-SHA256 of the request body>
 * The server recomputes the HMAC over the raw body and compares.
 *
 * A secret shipped in browser code can be read by any player, so the
 * signature only proves the request came from a copy of your game. Treat the
 * numbers as claims and validate them on the server.
 */
export class WebhookIntegration {
    constructor(config = {}) {
        this.webhookUrl = config.webhookUrl;
        this.secret = config.secret;
        this.enabled = config.enabled !== false;
        this.maxQueue = Number.isFinite(config.maxQueue) ? Math.max(1, config.maxQueue) : 100;
        this.queue = [];
        this.sending = false;
        this._draining = null;
        this._key = null;
        this._warnedNoCrypto = false;
    }

    /**
     * Send event to webhook
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @returns {Promise<void>} Settles once the queue has drained
     */
    async send(event, data) {
        if (!this.enabled || !this.webhookUrl) return;

        // Serialised once. The signature covers these exact bytes.
        const body = JSON.stringify({ event, data, timestamp: Date.now() });

        // A dead endpoint must not grow the queue without limit.
        if (this.queue.length >= this.maxQueue) {
            this.queue.shift();
        }

        this.queue.push(body);
        return this._processQueue();
    }

    /**
     * Process webhook queue. Every caller gets the promise of the drain in
     * progress, so a send() made while another is in flight still waits for
     * its own request.
     * @private
     */
    _processQueue() {
        if (!this._draining && this.queue.length > 0) {
            this._draining = this._drain();
        }
        return this._draining ?? Promise.resolve();
    }

    /**
     * @private
     */
    async _drain() {
        this.sending = true;

        try {
            while (this.queue.length > 0) {
                const body = this.queue.shift();

                try {
                    const headers = { 'Content-Type': 'application/json' };
                    const signature = await this._sign(body);
                    if (signature) {
                        headers['X-Dopamine-Signature'] = `sha256=${signature}`;
                    }

                    const response = await fetch(this.webhookUrl, {
                        method: 'POST',
                        headers,
                        body,
                    });

                    if (!response.ok) {
                        console.error('[WebhookIntegration] Failed to send webhook:', response.statusText);
                    }
                } catch (error) {
                    console.error('[WebhookIntegration] Webhook error:', error);
                }
            }
        } finally {
            this.sending = false;
            this._draining = null;
        }
    }

    /**
     * HMAC-SHA256 of the body, hex encoded. Empty when there is no secret or
     * no Web Crypto (an insecure origin, or a very old runtime).
     * @private
     */
    async _sign(body) {
        if (!this.secret) return '';

        const subtle = globalThis.crypto?.subtle;
        if (!subtle) {
            if (!this._warnedNoCrypto) {
                this._warnedNoCrypto = true;
                console.warn('[WebhookIntegration] crypto.subtle is unavailable. Sending unsigned.');
            }
            return '';
        }

        const encoder = new TextEncoder();

        if (!this._key) {
            this._key = subtle.importKey(
                'raw',
                encoder.encode(this.secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
        }

        const digest = await subtle.sign('HMAC', await this._key, encoder.encode(body));
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
}

/**
 * Example: Battle Pass Plugin
 *
 * Emits 'battlepass:tier-unlocked' on kernel.events, and on window when there
 * is one. Needs a RewardSystem created with `{ events: kernel.events }`.
 */
export const BattlePassPlugin = {
    name: 'battle-pass',
    version: '2.0.0',

    init(kernel) {
        this.kernel = kernel;

        // Built here, not on the object, so a second init starts unclaimed.
        this.tiers = [
            { level: 1, xpRequired: 0, reward: 'Bronze Badge' },
            { level: 5, xpRequired: 500, reward: 'Silver Badge' },
            { level: 10, xpRequired: 1500, reward: 'Gold Badge' },
            { level: 20, xpRequired: 5000, reward: 'Platinum Badge' },
        ];

        this._onXP = ({ total }) => this._checkTierProgress(total);
        kernel.events.on('xp_gained', this._onXP);
    },

    _checkTierProgress(totalXP) {
        if (!Number.isFinite(totalXP)) return;

        for (const tier of this.tiers) {
            if (totalXP >= tier.xpRequired && !tier.claimed) {
                tier.claimed = true;

                this.kernel?.events.emit('battlepass:tier-unlocked', tier);

                if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
                    window.dispatchEvent(new CustomEvent('battlepass:tier-unlocked', {
                        detail: tier
                    }));
                }
            }
        }
    },

    destroy() {
        if (this.kernel && this._onXP) {
            this.kernel.events.off('xp_gained', this._onXP);
        }
        this._onXP = null;
        this.kernel = null;
    }
};

/**
 * Example: Leaderboard Plugin
 *
 * Sends nothing until it is given an endpoint:
 *
 *   kernel.plugins.use(LeaderboardPlugin.configure({
 *       webhookUrl: 'https://example.com/leaderboard',
 *       secret: '...',          // optional, see WebhookIntegration
 *       playerId: () => user.id // optional, string or function
 *   }));
 */
export const LeaderboardPlugin = {
    name: 'leaderboard',
    version: '2.0.0',

    /**
     * @param {Object} config - WebhookIntegration options plus `playerId`
     * @returns {Object} The plugin, for use()
     */
    configure(config = {}) {
        this.config = { ...config };
        return this;
    },

    init(kernel) {
        const config = this.config ?? {};

        if (!config.webhookUrl) {
            console.warn('[LeaderboardPlugin] No webhookUrl. Call LeaderboardPlugin.configure({ webhookUrl }) before use(). Nothing will be sent.');
            return;
        }

        this.kernel = kernel;
        this.webhook = new WebhookIntegration(config);

        // Send level-up events to backend
        this._onLevelUp = (data) => {
            this.webhook.send('level_up', {
                playerId: this._getPlayerId(),
                level: data.newLevel,
                xp: data.totalXP,
            });
        };

        // Send achievement unlocks
        this._onAchievement = (data) => {
            this.webhook.send('achievement', {
                playerId: this._getPlayerId(),
                achievementId: data.id,
                timestamp: Date.now(),
            });
        };

        kernel.events.on('level_up', this._onLevelUp);
        kernel.events.on('achievement_unlocked', this._onAchievement);
    },

    _getPlayerId() {
        const configured = this.config?.playerId;
        if (typeof configured === 'function') return configured();
        if (configured) return configured;

        if (this._playerId) return this._playerId;

        // Get player ID from localStorage or generate one. Storage can throw
        // (private mode, blocked cookies), so the id then lasts one session.
        let playerId = null;
        try {
            playerId = localStorage.getItem('dopamine_player_id');
        } catch { /* no storage */ }

        if (!playerId) {
            playerId = typeof globalThis.crypto?.randomUUID === 'function'
                ? `player_${globalThis.crypto.randomUUID()}`
                : `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

            try {
                localStorage.setItem('dopamine_player_id', playerId);
            } catch { /* no storage */ }
        }

        this._playerId = playerId;
        return playerId;
    },

    destroy() {
        if (this.kernel) {
            this.kernel.events.off('level_up', this._onLevelUp);
            this.kernel.events.off('achievement_unlocked', this._onAchievement);
        }
        this.kernel = null;
        this.webhook = null;
        this._playerId = null;
    }
};
