/**
 * Example Plugin: Custom Physics System
 * 
 * This demonstrates how to create a plugin that replaces the default physics system.
 * In a real implementation, this would integrate Matter.js or Box2D.
 */

/**
 * Custom Physics System that implements IPhysicsSystem
 */
class CustomPhysicsSystem {
    constructor() {
        this.bodies = [];
        this.gravity = { x: 0, y: 9.8 };
        this.kernel = null;
    }

    // ISystem interface
    init(kernel) {
        this.kernel = kernel;
        console.log('[CustomPhysics] Initialized with custom physics engine');
    }

    fixedUpdate(dt) {
        // Apply gravity and update positions
        for (const body of this.bodies) {
            if (!body.isStatic) {
                body.velocity.y += this.gravity.y * dt;
                body.position.x += body.velocity.x * dt;
                body.position.y += body.velocity.y * dt;
            }
        }
    }

    destroy() {
        this.bodies = [];
    }

    // IPhysicsSystem interface
    addBody(body) {
        this.bodies.push(body);
    }

    removeBody(body) {
        const index = this.bodies.indexOf(body);
        if (index > -1) {
            this.bodies.splice(index, 1);
        }
    }

    checkCollision(a, b) {
        // Simple AABB collision
        return (
            a.position.x < b.position.x + b.width &&
            a.position.x + a.width > b.position.x &&
            a.position.y < b.position.y + b.height &&
            a.position.y + a.height > b.position.y
        );
    }

    raycast(origin, direction, distance) {
        // TODO: Implement raycasting
        return null;
    }

    setGravity(x, y) {
        this.gravity.x = x;
        this.gravity.y = y;
    }

    step(dt) {
        this.fixedUpdate(dt);
    }
}

/**
 * Custom Physics Plugin
 * 
 * Usage:
 * ```javascript
 * import { Game } from 'dopaminejs';
 * import { CustomPhysicsPlugin } from 'dopaminejs/plugins/CustomPhysicsPlugin';
 * 
 * const game = new Game();
 * game.kernel.plugins.use(CustomPhysicsPlugin);
 * game.start();
 * ```
 */
export const CustomPhysicsPlugin = {
    name: 'custom-physics',
    version: '1.0.0',

    init(kernel) {
        console.log('[CustomPhysicsPlugin] Installing custom physics...');

        // Unregister default physics
        if (kernel.systems.has('physics')) {
            kernel.systems.unregister('physics');
        }

        // Register custom physics system
        kernel.systems.register('physics', new CustomPhysicsSystem(), {
            priority: 60,
        });

        // Listen to physics events if needed
        kernel.events.on('collision_enter', (data) => {
            console.log('[CustomPhysics] Collision detected:', data);
        });
    },

    destroy() {
        console.log('[CustomPhysicsPlugin] Uninstalling custom physics...');
    }
};
