/**
 * Input System
 * Tracks keyboard and mouse input.
 */
export class Input {
    constructor() {
        this.keys = new Map();
        this.mouse = { x: 0, y: 0, buttons: new Map() };
        this.kernel = null;

        // Bind event listeners
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
    }

    /**
     * ISystem interface - called when registered
     */
    init(kernel) {
        this.kernel = kernel;

        // Attach event listeners
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
    }

    /**
     * ISystem interface - cleanup
     */
    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
    }

    _onKeyDown(e) {
        this.keys.set(e.key, true);
    }

    _onKeyUp(e) {
        this.keys.set(e.key, false);
    }

    _onMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    }

    _onMouseDown(e) {
        this.mouse.buttons.set(e.button, true);
    }

    _onMouseUp(e) {
        this.mouse.buttons.set(e.button, false);
    }

    isKeyDown(key) {
        return this.keys.get(key) || false;
    }

    isMouseButtonDown(button = 0) {
        return this.mouse.buttons.get(button) || false;
    }
}

// DEPRECATED: Keep for backward compatibility
export const GlobalInput = new Input();
// Note: GlobalInput won't have listeners attached unless init() is called
console.warn('[DopamineJS] GlobalInput is deprecated. Use kernel.input instead.');
