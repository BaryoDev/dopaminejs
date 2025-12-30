import { Collider } from '../core/Collider.js';

export class Physics {
    constructor() {
        this.colliders = [];
        this.kernel = null;
    }

    /**
     * ISystem interface - called when registered
     */
    init(kernel) {
        this.kernel = kernel;
    }

    /**
     * ISystem interface - called at fixed timestep
     */
    fixedUpdate(dt) {
        this.step();
    }

    /**
     * ISystem interface - cleanup
     */
    destroy() {
        this.colliders = [];
    }

    add(collider) {
        this.colliders.push(collider);
    }

    remove(collider) {
        const idx = this.colliders.indexOf(collider);
        if (idx > -1) this.colliders.splice(idx, 1);
    }

    /**
     * Main Physics Step.
     * Checks all pairs and triggers callbacks.
     */
    step() {
        // Naive O(N^2)
        for (let i = 0; i < this.colliders.length; i++) {
            for (let j = i + 1; j < this.colliders.length; j++) {
                const a = this.colliders[i];
                const b = this.colliders[j];

                if (this._intersects(a, a.getBounds(), b, b.getBounds())) {
                    // Notify GameObjects
                    this._notifyCollision(a.gameObject, b.gameObject);
                    this._notifyCollision(b.gameObject, a.gameObject);
                }
            }
        }
    }

    _notifyCollision(go, other) {
        if (!go || !go.components) return;
        go.components.forEach(c => {
            if (c.onCollisionEnter) c.onCollisionEnter(other);
        });
    }

    /**
     * Check if a specific collider overlaps with anything in the target group (tag).
     * @param {Collider} source 
     * @param {string} targetTag 
     */
    checkOverlap(source, targetTag) {
        // ... (Keep existing manual check for flexibility)
        const hits = [];
        const sourceBounds = source.getBounds();

        for (const target of this.colliders) {
            if (target === source) continue;
            if (targetTag && target.tag !== targetTag) continue;

            const targetBounds = target.getBounds();

            if (this._intersects(source, sourceBounds, target, targetBounds)) {
                hits.push(target);
            }
        }
        return hits;
    }

    _intersects(a, bA, b, bB) {
        // Box vs Box
        if (a.type === 'box' && b.type === 'box') {
            return (bA.left < bB.right && bA.right > bB.left &&
                bA.top < bB.bottom && bA.bottom > bB.top);
        }
        // Circle vs Circle
        if (a.type === 'circle' && b.type === 'circle') {
            const dx = bA.x - bB.x;
            const dy = bA.y - bB.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return dist < (bA.radius + bB.radius);
        }

        // TODO: Box vs Circle
        return false;
    }

    // IPhysicsSystem interface methods (for plugin compatibility)
    addBody(body) { this.add(body); }
    removeBody(body) { this.remove(body); }
    checkCollision(a, b) { return this._intersects(a, a.getBounds(), b, b.getBounds()); }
    raycast(origin, direction, distance) { /* TODO */ return null; }
    setGravity(x, y) { /* TODO: Add gravity support */ }
}

// DEPRECATED: Keep for backward compatibility, but log warning
export const GlobalPhysics = new Physics();
console.warn('[DopamineJS] GlobalPhysics is deprecated. Use kernel.physics instead.');
