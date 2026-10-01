/**
 * Example Plugin: Debug Overlay
 * 
 * This demonstrates how to create a plugin that adds new functionality
 * without replacing existing systems.
 */

class DebugOverlay {
    constructor() {
        this.kernel = null;
        this.overlay = null;
        this.stats = {
            fps: 0,
            frameTime: 0,
            systemCount: 0,
        };
    }

    init(kernel) {
        this.kernel = kernel;
        this._createOverlay();

        // Listen to tick events to update stats
        this._onTick = ({ dt }) => {
            // dt is 0 on a frame that lands on the same timestamp.
            this.stats.fps = dt > 0 ? Math.round(1 / dt) : 0;
            this.stats.frameTime = Math.round(dt * 1000);
            this.stats.systemCount = kernel.systems.getSystemNames().length;
            this._updateOverlay();
        };
        kernel.events.on('tick', this._onTick, 100); // Low priority - update after everything else
    }

    _createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'dopamine-debug-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 4px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);
    }

    _updateOverlay() {
        if (!this.overlay) return;

        this.overlay.innerHTML = `
            <div><strong>DopamineJS Debug</strong></div>
            <div>FPS: ${this.stats.fps}</div>
            <div>Frame Time: ${this.stats.frameTime}ms</div>
            <div>Systems: ${this.stats.systemCount}</div>
            <div>Plugins: ${this.kernel.plugins.getPluginNames().length}</div>
        `;
    }

    destroy() {
        if (this.kernel && this._onTick) {
            this.kernel.events.off('tick', this._onTick);
        }
        this._onTick = null;

        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
    }
}

/**
 * Debug Overlay Plugin
 * 
 * Usage:
 * ```javascript
 * import { Game } from 'dopaminejs';
 * import { DebugOverlayPlugin } from 'dopaminejs/plugins/DebugOverlayPlugin';
 * 
 * const game = new Game();
 * game.kernel.plugins.use(DebugOverlayPlugin);
 * game.start();
 * ```
 */
export const DebugOverlayPlugin = {
    name: 'debug-overlay',
    version: '1.0.0',

    init(kernel) {
        const overlay = new DebugOverlay();
        overlay.init(kernel);

        // Store reference for cleanup
        this._overlay = overlay;
    },

    destroy() {
        if (this._overlay) {
            this._overlay.destroy();
            this._overlay = null;
        }
    }
};
