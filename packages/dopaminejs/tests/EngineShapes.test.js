import { describe, it, expect } from 'vitest';
import { Physics } from '../src/systems/Physics.js';
import { GameObject } from '../src/core/GameObject.js';
import { Collider } from '../src/core/Collider.js';

/**
 * types/index.d.ts is written by hand and tsc only checks it against itself.
 * These pin the runtime shapes the declarations describe, so the two cannot
 * drift apart again without a test failing.
 */
const withCollider = (x, y, collider, tag = null) => {
    const object = new GameObject(x, y);
    object.addComponent(collider);
    collider.tag = tag;
    return collider;
};

describe('engine shapes the type declarations describe', () => {
    it('should keep position as x and y on the object', () => {
        const object = new GameObject(10, 20);

        expect(object.x).toBe(10);
        expect(object.y).toBe(20);
        expect(object.position).toBeUndefined();
        expect(object.scale).toEqual({ x: 1, y: 1 });
        expect(object.parent).toBeNull();
    });

    it('should return edges for a box collider', () => {
        const box = withCollider(100, 50, new Collider('box', 20, 10));

        expect(box.getBounds()).toEqual({ left: 90, right: 110, top: 45, bottom: 55 });
    });

    it('should return centre and radius for a circle collider', () => {
        const circle = withCollider(100, 50, new Collider('circle', 0, 0, 8));

        expect(circle.getBounds()).toEqual({ x: 100, y: 50, radius: 8 });
    });

    it('should return the overlapping colliders from checkOverlap', () => {
        const physics = new Physics();
        const hero = withCollider(0, 0, new Collider('box', 20, 20), 'hero');
        const enemy = withCollider(5, 5, new Collider('box', 20, 20), 'enemy');
        const coin = withCollider(-5, -5, new Collider('box', 20, 20), 'coin');
        const far = withCollider(500, 500, new Collider('box', 20, 20), 'enemy');
        for (const collider of [hero, enemy, coin, far]) physics.add(collider);

        expect(physics.checkOverlap(hero)).toEqual([enemy, coin]);
        expect(physics.checkOverlap(hero, 'enemy')).toEqual([enemy]);
        expect(physics.checkOverlap(far)).toEqual([]);
    });
});
