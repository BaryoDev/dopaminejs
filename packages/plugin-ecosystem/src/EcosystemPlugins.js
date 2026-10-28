/**
 * Webhook integration: sends reward events to a URL you own.
 *
 * With a `secret`, each request carries
 *   X-Dopamine-Signature: sha256=<hex HMAC-SHA256 of the request body>
 * The server recomputes the HMAC over the raw body and compares.
 *
 * A secret shipped in browser code can be read by any player, so the
 * signature only proves the request came from a copy of your app. Treat the
 * numbers as claims and validate them on the server.
 */

const DEFAULT_EVENTS = ['level_up', 'achievement_unlocked', 'personal_best'];

export class WebhookIntegration {
    /**
     * @param {Object} config
     * @param {string} config.webhookUrl
     * @param {string} [config.secret]
     * @param {boolean} [config.enabled=true]
     * @param {number} [config.maxQueue=100] - The oldest body is dropped past this.
     * @param {number} [config.timeout=10000] - Milliseconds before a request is aborted.
     * @param {Function} [config.fetch] - Default: global fetch, read at send time.
     * @param {() => number} [config.now] - Default: Date.now.
     * @param {{ warn?: Function, error?: Function }} [config.log] - Default: console.
     */
    constructor(config = {}) {
        this.webhookUrl = config.webhookUrl;
        this.secret = config.secret;
        this.enabled = config.enabled !== false;
        this.maxQueue = Number.isFinite(config.maxQueue) ? Math.max(1, config.maxQueue) : 100;
        this.timeout = Number.isFinite(config.timeout) && config.timeout > 0 ? config.timeout : 10000;
        this.queue = [];
        this.sending = false;
        this._fetch = config.fetch;
        this._now = typeof config.now === 'function' ? config.now : Date.now;
        this._log = config.log || console;
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
        let body;
        try {
            body = JSON.stringify({ event, data, timestamp: this._now() });
        } catch {
            // Circular data or a BigInt. The payload is not logged.
            this._log.error(`[webhooks] ${event} was not sent: its data cannot be serialised`);
            return;
        }

        // A dead endpoint must not grow the queue without limit.
        if (this.queue.length >= this.maxQueue) {
            this.queue.shift();
        }

        this.queue.push(body);
        return this._processQueue();
    }

    /**
     * Drops the queue and aborts the request in flight. Call flush() first to
     * deliver what is queued.
     * @returns {number} How many events were dropped without confirmed
     *   delivery. An aborted request counts, since the server may have got it.
     */
    close() {
        let dropped = this.queue.length;
        this.queue.length = 0;
        if (this._inflight) {
            clearTimeout(this._inflight.timer);
            this._inflight.abort.abort();
            this._inflight = null;
            dropped += 1;
        }
        return dropped;
    }

    /**
     * Resolves once everything queued so far has been sent or has failed.
     * @returns {Promise<void>}
     */
    flush() {
        return this._processQueue();
    }

    /**
     * Every caller gets the promise of the drain in progress, so a send()
     * made while another is in flight still waits for its own request.
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

                const abort = new AbortController();
                const timer = setTimeout(() => abort.abort(), this.timeout);
                this._inflight = { abort, timer };
                try {
                    const headers = { 'Content-Type': 'application/json' };
                    const signature = await this._sign(body);
                    if (abort.signal.aborted) continue;
                    if (signature) {
                        headers['X-Dopamine-Signature'] = `sha256=${signature}`;
                    }

                    const send = this._fetch || globalThis.fetch;
                    const response = await send(this.webhookUrl, {
                        method: 'POST',
                        headers,
                        body,
                        signal: abort.signal
                    });

                    if (!response.ok) {
                        this._log.error('[webhooks] Failed to send webhook:', response.statusText);
                    }
                } catch (error) {
                    this._log.error('[webhooks] Webhook error:', error);
                } finally {
                    clearTimeout(timer);
                    this._inflight = null;
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
                this._log.warn('[webhooks] crypto.subtle is unavailable. Sending unsigned.');
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
 * A plugin that posts events to a URL.
 *
 *   createDopamine({ plugins: [webhooks({ url: 'https://example.com/hook', secret })] });
 *
 * Nothing is sent without a `url`. Disposing the plugin stops listening,
 * aborts the request in flight and drops the queue. When anything is dropped
 * it emits `webhooks:dropped` with `{ count }` and warns. Await `flush()`
 * before disposing to send everything queued. Failed requests are logged,
 * not retried.
 *
 * @param {Object} options
 * @param {string} options.url
 * @param {string} [options.secret]
 * @param {string[]} [options.events] - Default: level_up, achievement_unlocked, personal_best.
 * @param {number} [options.maxQueue=100]
 * @param {number} [options.timeout=10000] - Milliseconds before a request is aborted.
 * @param {Function} [options.fetch]
 */
export function webhooks(options = {}) {
    const opts = options !== null && typeof options === 'object' ? options : {};
    const names = Array.isArray(opts.events)
        ? opts.events.filter((name) => typeof name === 'string' && name !== '')
        : DEFAULT_EVENTS;
    let hook = null;

    return {
        name: 'webhooks',
        version: '3.0.0',
        api: 3,

        /** Resolves once everything queued so far has been sent or has failed. */
        flush: () => (hook ? hook.flush() : Promise.resolve()),

        install(ctx) {
            if (typeof opts.url !== 'string' || opts.url === '') {
                ctx.log.warn('[webhooks] no url was given. Nothing will be sent.');
                return undefined;
            }

            const integration = new WebhookIntegration({
                webhookUrl: opts.url,
                secret: opts.secret,
                maxQueue: opts.maxQueue,
                timeout: opts.timeout,
                fetch: opts.fetch,
                now: () => ctx.clock.now(),
                log: ctx.log
            });
            hook = integration;

            const offs = names.map((name) => ctx.events.on(name, (data) => {
                integration.send(name, data);
            }));

            return () => {
                for (const off of offs) off();
                const count = integration.close();
                if (count > 0) {
                    ctx.events.emit('webhooks:dropped', { count });
                    ctx.log.warn(`[webhooks] ${count} event(s) dropped without confirmed delivery. Await flush() before disposing to send them.`);
                }
            };
        }
    };
}
