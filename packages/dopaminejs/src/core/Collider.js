import { Component } from './Component.js';

/**
 * Collider Component
 * Handles collision detection for GameObjects.
 */
export class Collider extends Component {
    constructor(type = 'box', width = 50, height = 50, radius = 25) {
        super();
        this.type = type; // 'box' or 'circle'
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.tag = null; // For collision filtering
    }

    get kernel() {
        return this._kernel ?? null;
    }

    /**
     * The kernel can arrive after onAttach(), when the collider was added to
     * an object before that object joined a scene. Registering only in
     * onAttach() left such colliders out of physics for good.
     */
    set kernel(value) {
        if (value === this._kernel) return;

        this._unregister();
        this._kernel = value;
        this._register();
    }

    onAttach() {
        super.onAttach();
        this._attached = true;
        this._register();
    }

    onDetach() {
        super.onDetach();
        this._attached = false;
        this._unregister();
    }

    /**
     * @private
     */
    _register() {
        if (this._physics || !this._attached) return;

        const physics = this.physics;
        if (physics) {
            physics.add(this);
            this._physics = physics;
        }
    }

    /**
     * @private
     */
    _unregister() {
        if (this._physics) {
            this._physics.remove(this);
            this._physics = null;
        }
    }

    getBounds() {
        const go = this.gameObject;
        if (this.type === 'box') {
            return {
                left: go.x - this.width / 2,
                right: go.x + this.width / 2,
                top: go.y - this.height / 2,
                bottom: go.y + this.height / 2,
            };
        } else if (this.type === 'circle') {
            return {
                x: go.x,
                y: go.y,
                radius: this.radius,
            };
        }
    }
}
