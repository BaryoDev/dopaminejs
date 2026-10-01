import { GameObject } from 'dopaminejs';
import { FloatingText } from './FloatingText.js';
import { ConfettiParticle } from './ConfettiParticle.js';

const DEFAULTS = {
    oops: { text: 'Oops!', color: '#FF4444' },
    milestone: { text: 'MILESTONE!', color: '#FFD700', confetti: 50 },
    faster: { text: 'FASTER!', color: '#50fa7b' },
    levelup: { text: 'LEVEL UP!', color: '#bd93f9', confetti: 30 }
};

// Each confetti piece is a GameObject updated every frame.
const MAX_CONFETTI = 500;

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

        const preset = Object.prototype.hasOwnProperty.call(DEFAULTS, type) ? DEFAULTS[type] : {};

        // The colour used to be defaulted to white before the switch, so the
        // per-type colours below it never applied.
        const text = options.text || preset.text || '';
        const color = options.color || preset.color || '#FFFFFF';

        if (preset.confetti) {
            this.emitConfetti(x, y, options.count || preset.confetti);
        }

        if (text) {
            const fontObj = new GameObject(x, y);
            fontObj.addComponent(new FloatingText(text, { ...options, color }));
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
        const total = Number.isFinite(count) ? Math.min(Math.floor(count), MAX_CONFETTI) : 0;

        for (let i = 0; i < total; i++) {
            const particle = new GameObject(x, y);
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.addComponent(new ConfettiParticle(color));
            scene.add(particle);
        }
    }
}
