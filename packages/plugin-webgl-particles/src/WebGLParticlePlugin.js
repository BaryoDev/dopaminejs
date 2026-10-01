/**
 * WebGL Particle Plugin
 * 
 * Replaces the default Canvas particle system with WebGL for 10x-100x performance
 * 
 * Usage:
 * ```javascript
 * import { Game } from 'dopaminejs';
 * import { WebGLParticlePlugin } from 'dopaminejs/plugins';
 * 
 * const game = new Game();
 * game.kernel.plugins.use(WebGLParticlePlugin);
 * game.start();
 * ```
 */

import { WebGLParticleSystem } from './WebGLParticleSystem.js';

export const WebGLParticlePlugin = {
    name: 'webgl-particles',
    version: '1.0.0',

    init(kernel) {


        // Check WebGL support
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            // Nothing here builds a Canvas particle system. Whatever is
            // registered as 'particles', if anything, stays as it is.
            console.error('[WebGLParticlePlugin] WebGL is not supported in this browser. No WebGL particle system was registered.');
            if (kernel.systems.has('particles')) {
                console.warn('[WebGLParticlePlugin] The existing "particles" system is left in place.');
            }
            return;
        }

        // Unregister default particle system (if exists)
        if (kernel.systems.has('particles')) {
            kernel.systems.unregister('particles');
        }

        // Register WebGL particle system
        kernel.systems.register('particles', new WebGLParticleSystem({
            maxParticles: 10000
        }), {
            priority: 50,
        });


    },

    destroy() {

    }
};
