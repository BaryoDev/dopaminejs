/**
 * The Ticker class manages the game loop.
 * It uses requestAnimationFrame to provide a smooth loop.
 */
export class Ticker {
    constructor() {
        this.running = false;
        this.lastTime = 0;
        this.callbacks = new Set();
        this._frameHandle = null;
        this._tick = this._tick.bind(this);
        this._failed = new WeakSet();
    }

    /**
     * Add a callback to the loop.
     * @param {Function} callback - Function to call each frame (receives dt).
     */
    add(callback) {
        this.callbacks.add(callback);
    }

    /**
     * Remove a callback from the loop.
     * @param {Function} callback 
     */
    remove(callback) {
        this.callbacks.delete(callback);
    }

    /**
     * Start the loop.
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();

        // Cancel first: a frame queued before the last stop() may still be
        // pending, and letting it through would leave two live loops running
        // the game at double speed.
        if (this._frameHandle !== null) {
            cancelAnimationFrame(this._frameHandle);
        }
        this._frameHandle = requestAnimationFrame(this._tick);
    }

    /**
     * Stop the loop.
     */
    stop() {
        this.running = false;

        if (this._frameHandle !== null) {
            cancelAnimationFrame(this._frameHandle);
            this._frameHandle = null;
        }
    }

    _tick(time) {
        this._frameHandle = null;

        if (!this.running) return;

        const dt = (time - this.lastTime) / 1000; // Delta time in seconds
        this.lastTime = time;

        // Cap dt to prevent huge jumps if tab was inactive. Floored at 0: the
        // first frame's timestamp can predate the performance.now() in start().
        const safeDt = Math.max(0, Math.min(dt, 0.1));

        // Snapshot: a callback may add or remove callbacks mid-frame.
        for (const callback of [...this.callbacks]) {
            try {
                callback(safeDt);
            } catch (error) {
                // A throw here used to skip the re-queue below with `running`
                // still true, so the loop died and start() refused to revive it.
                if (!this._failed.has(callback)) {
                    this._failed.add(callback);
                    console.error('[Ticker] Callback threw:', error);
                }
            }
        }

        // A callback may have called stop(); don't queue another frame if so.
        if (this.running) {
            this._frameHandle = requestAnimationFrame(this._tick);
        }
    }
}
