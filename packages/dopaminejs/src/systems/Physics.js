import { deprecatedGlobal } from './deprecate.js';

import { Collider } from '../core/Collider.js';
import { EventBus } from '../core/EventBus.js';

export class Physics {
    constructor() {
        this.colliders = [];
        this.kernel = null;

        // Map<Collider, Map<Collider, step>>: the pairs that overlapped as of
        // the last step, each with the step that last saw it. Without it
        // there is no telling a new overlap from one that is still going.
        this._pairs = new Map();
        this._step = 0;
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
        this._pairs.clear();
    }

    add(collider) {
        this.colliders.push(collider);
    }

    remove(collider) {
        const idx = this.colliders.indexOf(collider);
        if (idx > -1) this.colliders.splice(idx, 1);

        // A removed collider overlaps nothing, so its pairs end here. Left
        // in the map they would also keep the collider alive.
        const others = this._pairs.get(collider);
        if (others) {
            this._pairs.delete(collider);

            // Emptied before emitting: step() may be part way through this
            // map when an exit listener removes the collider, and would end
            // the same pairs again.
            const ended = [...others.keys()];
            others.clear();
            for (const other of ended) {
                this._emit(EventBus.Events.COLLISION_EXIT, collider, other);
            }
        }
        for (const [first, seconds] of this._pairs) {
            if (seconds.delete(collider)) {
                this._emit(EventBus.Events.COLLISION_EXIT, first, collider);
            }
        }
    }

    /**
     * Main Physics Step.
     * Checks all pairs and triggers callbacks.
     *
     * Emits `collision_enter` on the kernel event bus when a pair starts to
     * overlap and `collision_exit` when it stops, each with `{ a, b }` (the
     * two colliders). `onCollisionEnter` on a component is older and runs on
     * every step while the pair overlaps.
     */
    step() {
        const step = ++this._step;

        // Naive O(N^2)
        for (let i = 0; i < this.colliders.length; i++) {
            for (let j = i + 1; j < this.colliders.length; j++) {
                const a = this.colliders[i];
                const b = this.colliders[j];

                if (this._intersects(a, a.getBounds(), b, b.getBounds())) {
                    this._seen(a, b, step);

                    // Notify GameObjects
                    this._notifyCollision(a.gameObject, b.gameObject);
                    this._notifyCollision(b.gameObject, a.gameObject);
                }
            }
        }

        for (const [a, others] of this._pairs) {
            for (const [b, seen] of others) {
                if (seen === step) continue;

                // A collider removed during the loop above shifts the list,
                // and the loop then passes over some pairs. Not being seen
                // is not enough to end one.
                if (this._intersects(a, a.getBounds(), b, b.getBounds())) {
                    others.set(b, step);
                    continue;
                }

                others.delete(b);
                this._emit(EventBus.Events.COLLISION_EXIT, a, b);
            }
            if (others.size === 0) this._pairs.delete(a);
        }
    }

    /**
     * Record that a pair overlaps on this step. Emits `collision_enter` when
     * it did not overlap on the step before.
     * @private
     */
    _seen(a, b, step) {
        // A pair is stored under the collider that was first in the list
        // when it began. `colliders` is public and can be reordered, so look
        // under the other one too.
        if (this._pairs.get(b)?.has(a)) {
            this._pairs.get(b).set(a, step);
            return;
        }

        let others = this._pairs.get(a);
        if (!others) {
            others = new Map();
            this._pairs.set(a, others);
        }

        const known = others.has(b);
        others.set(b, step);
        if (!known) this._emit(EventBus.Events.COLLISION_ENTER, a, b);
    }

    /**
     * @private
     */
    _emit(event, a, b) {
        // GlobalPhysics and a Physics built by hand have no kernel.
        this.kernel?.events?.emit(event, { a, b });
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

// DEPRECATED: kept for v1 compatibility. Warns on first use, not on import.
export const GlobalPhysics = deprecatedGlobal(
    new Physics(),
    '[DopamineJS] GlobalPhysics is deprecated. Use kernel.physics instead.'
);
