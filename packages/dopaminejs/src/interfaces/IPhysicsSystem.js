import { ISystem } from './ISystem.js';

/**
 * IPhysicsSystem - Interface for physics implementations
 * 
 * Allows different physics engines (custom, Matter.js, Box2D) to be swapped
 */
export const IPhysicsSystem = {
    ...ISystem,

    /**
     * Add a physics body to the simulation
     * @param {Object} body - Physics body (implementation-specific)
     */
    addBody(body) { },

    /**
     * Remove a physics body from the simulation
     * @param {Object} body - Physics body to remove
     */
    removeBody(body) { },

    /**
     * Check collision between two bodies
     * @param {Object} a - First body
     * @param {Object} b - Second body
     * @returns {boolean} - True if colliding
     */
    checkCollision(a, b) { },

    /**
     * Perform a raycast
     * @param {Object} origin - Ray origin {x, y}
     * @param {Object} direction - Ray direction {x, y}
     * @param {number} distance - Maximum ray distance
     * @returns {Object|null} - Hit result or null
     */
    raycast(origin, direction, distance) { },

    /**
     * Set gravity for the physics world
     * @param {number} x - Gravity X component
     * @param {number} y - Gravity Y component
     */
    setGravity(x, y) { },

    /**
     * Step the physics simulation
     * @param {number} dt - Delta time
     */
    step(dt) { },
};
