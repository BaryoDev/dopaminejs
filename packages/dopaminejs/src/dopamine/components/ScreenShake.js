import { Component } from '../../core/Component.js';

/**
 * Adds screen shake capability.
 * Usually attached to the Camera or the Root Scene object.
 */
export class ScreenShake extends Component {
    constructor() {
        super();
        this.intensity = 0;
        this.duration = 0;
        this.timer = 0;
        this.originalPos = { x: 0, y: 0 };
        this.isShaking = false;
    }

    shake(intensity = 5, duration = 0.2) {
        this.intensity = intensity;
        this.duration = duration;
        this.timer = 0;
        this.isShaking = true;

        // Save original if not already shaking
        if (this.timer === 0) {
            this.originalPos.x = this.gameObject.x;
            this.originalPos.y = this.gameObject.y;
        }
    }

    update(dt) {
        if (!this.isShaking) return;

        this.timer += dt;

        if (this.timer >= this.duration) {
            this.isShaking = false;
            this.gameObject.x = this.originalPos.x;
            this.gameObject.y = this.originalPos.y;
            return;
        }

        // Random offset
        const offsetX = (Math.random() - 0.5) * 2 * this.intensity;
        const offsetY = (Math.random() - 0.5) * 2 * this.intensity;

        this.gameObject.x = this.originalPos.x + offsetX;
        this.gameObject.y = this.originalPos.y + offsetY;
    }
}
