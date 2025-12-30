import { ISystem } from './ISystem.js';

/**
 * IParticleSystem - Interface for particle system implementations
 * 
 * Allows different renderers (Canvas, WebGL, custom) to be swapped
 */
export const IParticleSystem = {
    ...ISystem,

    /**
     * Register a sprite for particles
     * @param {string} key - Sprite identifier
     * @param {string} url - Path to image
     */
    registerSprite(key, url) { },

    /**
     * Register a custom effect
     * @param {string} name - Effect name
     * @param {Function} callback - Effect function (x, y, ...args) => void
     */
    registerEffect(name, callback) { },

    /**
     * Play a registered effect
     * @param {string} name - Effect name
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {...any} args - Additional arguments
     */
    play(name, x, y, ...args) { },

    /**
     * Emit particles with custom configuration
     * @param {Object} config - Particle configuration
     */
    emit(config) { },

    /**
     * Clear all particles
     */
    clear() { },

    // Built-in effects (optional, but recommended)
    confetti(x, y, count) { },
    coinShower(x, y, count) { },
    sparkle(x, y, count, color) { },
    fire(x, y, count) { },
    starBurst(x, y, count) { },
};
