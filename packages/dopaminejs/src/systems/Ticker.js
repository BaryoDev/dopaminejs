/**
 * The Ticker class manages the game loop.
 * It uses requestAnimationFrame to provide a smooth loop.
 */
export class Ticker {
    constructor() {
        this.running = false;
        this.lastTime = 0;
        this.callbacks = new Set();
        this._tick = this._tick.bind(this);
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
        requestAnimationFrame(this._tick);
    }

    /**
     * Stop the loop.
     */
    stop() {
        this.running = false;
    }

    _tick(time) {
        if (!this.running) return;

        const dt = (time - this.lastTime) / 1000; // Delta time in seconds
        this.lastTime = time;

        // Cap dt to prevent huge jumps if tab was inactive
        const safeDt = Math.min(dt, 0.1);

        for (const callback of this.callbacks) {
            callback(safeDt);
        }

        requestAnimationFrame(this._tick);
    }
}
