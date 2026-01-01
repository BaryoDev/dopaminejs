import { GameObject } from 'dopaminejs';
import { FloatingText } from './FloatingText.js';
import { ConfettiParticle } from './ConfettiParticle.js';

/**
 * Feedback System handles visual cues like floating text and confetti.
 */
export class FeedbackSystem {
    constructor(kernel) {
        this.kernel = kernel;
    }

    /**
     * Trigger a feedback effect
     * @param {string} type - Effect type ('oops', 'milestone', 'faster', 'levelup', 'custom')
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Custom options (text, color, count)
     */
    trigger(type, x, y, options = {}) {
        const director = this.kernel.systems.get('director');
        const scene = director?.currentScene;
        if (!scene) return;

        let text = options.text || '';
        let color = options.color || '#FFFFFF';

        switch (type) {
            case 'oops':
                text = text || 'Oops!';
                color = color || '#FF4444';
                break;
            case 'milestone':
                text = text || 'MILESTONE!';
                color = color || '#FFD700';
                this.emitConfetti(x, y, options.count || 50);
                break;
            case 'faster':
                text = text || 'FASTER!';
                color = color || '#50fa7b';
                break;
            case 'levelup':
                text = text || 'LEVEL UP!';
                color = color || '#bd93f9';
                this.emitConfetti(x, y, options.count || 30);
                break;
        }

        if (text) {
            const fontObj = new GameObject(x, y);
            fontObj.addComponent(new FloatingText(text, { color, ...options }));
            scene.add(fontObj);
        }
    }

    emitConfetti(x, y, count = 50) {
        const director = this.kernel.systems.get('director');
        const scene = director?.currentScene;
        if (!scene) {
            console.warn('[FeedbackSystem] No scene available for confetti');
            return;
        }

        const colors = ['#FF0000', '#00FF00', '#0066FF', '#FFFF00', '#FF00FF'];

        // Create confetti particles using STATIC imports (same as FloatingText)
        for (let i = 0; i < count; i++) {
            const particle = new GameObject(x, y);
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.addComponent(new ConfettiParticle(color));
            scene.add(particle);
        }
    }
}
