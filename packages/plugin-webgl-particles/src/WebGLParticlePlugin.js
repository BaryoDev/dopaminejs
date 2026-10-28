/**
 * The WebGL particles part. Pass it as the `particles` option:
 *
 *   createDopamine({ particles: webglParticles() });
 *
 * When there is no DOM or no WebGL it returns null, and the host falls back to
 * the default canvas renderer.
 */

import { WebGLParticleSystem } from './WebGLParticleSystem.js';

/**
 * @param {Object} [options] - maxParticles and container, see WebGLParticleSystem.
 * @returns {(env: { hasDom: boolean, reducedMotion: boolean }) => WebGLParticleSystem | null}
 */
export function webglParticles(options = {}) {
    const config = options !== null && typeof options === 'object' ? options : {};
    return (env) => {
        if (!env?.hasDom) return null;
        const system = new WebGLParticleSystem({ ...config, reducedMotion: env.reducedMotion === true });
        if (!system.init()) {
            system.destroy();
            return null;
        }
        return system;
    };
}
