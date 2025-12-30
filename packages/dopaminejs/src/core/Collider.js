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

    onAttach() {
        super.onAttach();
        // Register with physics system through kernel
        if (this.physics) {
            this.physics.add(this);
        }
    }

    onDetach() {
        super.onDetach();
        // Unregister from physics
        if (this.physics) {
            this.physics.remove(this);
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
