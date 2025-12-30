import { Component } from '../../core/Component.js';

/**
 * Wraps the Dopamine ParticleSystem for a GameObject.
 * Allows easy "Emit at my position" logic.
 */
export class ParticleEmitter extends Component {
    constructor(particleSystem) {
        super();
        this.system = particleSystem;
    }

    /**
     * Trigger an effect at the GameObject's current position.
     * @param {string} effectName - 'confetti', 'fire', 'sparkle', etc.
     * @param {object} options - override options
     */
    play(effectName, options = {}) {
        const x = this.gameObject.x;
        const y = this.gameObject.y;

        switch (effectName) {
            case 'confetti':
                this.system.confetti(x, y, options.count);
                break;
            case 'fire':
                this.system.fire(x, y, options.count);
                break;
            case 'sparkle':
                this.system.sparkle(x, y, options.count, options.color);
                break;
            case 'blood': // Custom shortcut for our game
                this.system.emit({
                    x, y,
                    count: 10,
                    color: ['#8a0303', '#ff0000'],
                    speed: 4,
                    gravity: 0.1,
                    decay: 0.05
                });
                break;
            default:
                // Direct emit fallback
                this.system.emit({
                    x, y,
                    ...options
                });
        }
    }
}
