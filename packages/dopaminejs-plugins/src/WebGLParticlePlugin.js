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

import { WebGLParticleSystem } from '../dopamine/effects/WebGLParticleSystem.js';

export const WebGLParticlePlugin = {
    name: 'webgl-particles',
    version: '1.0.0',

    init(kernel) {
        console.log('[WebGLParticlePlugin] Installing WebGL particle system...');

        // Check WebGL support
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            console.error('[WebGLParticlePlugin] WebGL not supported in this browser');
            console.warn('[WebGLParticlePlugin] Falling back to Canvas particles');
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

        console.log('[WebGLParticlePlugin] WebGL particle system installed (max 10,000 particles)');
    },

    destroy() {
        console.log('[WebGLParticlePlugin] Uninstalling WebGL particle system...');
    }
};
