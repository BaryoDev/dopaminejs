/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DopamineKernel } from '../src/core/DopamineKernel.js';
import { EventBus } from '../src/core/EventBus.js';
import { Physics } from '../src/systems/Physics.js';
import { GameObject } from '../src/core/GameObject.js';
import { Collider } from '../src/core/Collider.js';
import { Component } from '../src/core/Component.js';

const box = (x, y) => {
    const collider = new Collider('box', 10, 10);
    collider.gameObject = new GameObject(x, y);
    return collider;
};

describe('Physics collision events', () => {
    let kernel;
    let physics;
    let entered;
    let exited;

    beforeEach(() => {
        kernel = new DopamineKernel({ canvas: document.createElement('canvas') });
        physics = kernel.physics;
        entered = [];
        exited = [];
        kernel.events.on(EventBus.Events.COLLISION_ENTER, (pair) => entered.push(pair));
        kernel.events.on(EventBus.Events.COLLISION_EXIT, (pair) => exited.push(pair));
    });

    afterEach(() => {
        kernel.destroy();
        vi.restoreAllMocks();
    });

    it('should emit collision_enter once when two colliders start to overlap', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);

        physics.step();
        physics.step();
        physics.step();

        expect(entered).toEqual([{ a, b }]);
        expect(entered[0].a).toBe(a);
        expect(entered[0].b).toBe(b);
        expect(exited).toEqual([]);
    });

    it('should emit collision_exit once when they stop overlapping', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);
        physics.step();

        b.gameObject.x = 100;
        physics.step();
        physics.step();

        expect(exited).toEqual([{ a, b }]);
        expect(exited[0].a).toBe(a);
        expect(exited[0].b).toBe(b);
    });

    it('should emit collision_enter again when they overlap a second time', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);
        physics.step();

        b.gameObject.x = 100;
        physics.step();
        b.gameObject.x = 5;
        physics.step();

        expect(entered).toHaveLength(2);
        expect(exited).toHaveLength(1);
    });

    it('should emit nothing for colliders that never overlap', () => {
        physics.add(box(0, 0));
        physics.add(box(100, 0));

        physics.step();

        expect(entered).toEqual([]);
        expect(exited).toEqual([]);
    });

    it('should track each pair on its own', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        const c = box(-5, 0);
        physics.add(a);
        physics.add(b);
        physics.add(c);
        physics.step();

        expect(entered).toEqual([{ a, b }, { a, b: c }]);

        c.gameObject.x = -100;
        physics.step();

        expect(exited).toEqual([{ a, b: c }]);
    });

    it('should emit collision_exit when an overlapping collider is removed', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        const c = box(-5, 0);
        physics.add(a);
        physics.add(b);
        physics.add(c);
        physics.step();

        physics.remove(a);

        expect(exited).toEqual([{ a, b }, { a, b: c }]);

        physics.step();

        expect(exited).toHaveLength(2);
    });

    it('should emit collision_exit once per pair when an exit listener removes the collider', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        const c = box(-5, 0);
        physics.add(a);
        physics.add(b);
        physics.add(c);
        physics.step();
        kernel.events.on('collision_exit', () => physics.remove(a));

        a.gameObject.y = 500;
        physics.step();

        expect(exited).toEqual([{ a, b }, { a, b: c }]);
    });

    it('should emit collision_enter again for a collider that was removed and added back', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);
        physics.step();

        physics.remove(a);
        physics.add(a);
        physics.step();

        expect(entered).toHaveLength(2);
        expect(exited).toHaveLength(1);
    });

    it('should end the pair when a listener removes a collider on entry', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);
        kernel.events.on('collision_enter', (pair) => physics.remove(pair.b));

        physics.step();
        physics.step();

        expect(entered).toHaveLength(1);
        expect(exited).toEqual([{ a, b }]);
    });

    it('should end the pair when a component removes its collider in onCollisionEnter', () => {
        class Bullet extends Component {
            onCollisionEnter() {
                physics.remove(this.collider);
            }
        }

        const a = box(0, 0);
        const b = box(5, 0);
        const bullet = new Bullet();
        bullet.collider = b;
        b.gameObject.components.push(bullet);
        physics.add(a);
        physics.add(b);

        physics.step();
        physics.step();

        expect(entered).toHaveLength(1);
        expect(exited).toEqual([{ a, b }]);
    });

    it('should not end a pair the loop skipped because a collider was removed mid-step', () => {
        const a = box(500, 0);
        const b = box(0, 0);
        const c = box(5, 0);
        physics.add(a);
        physics.add(b);
        physics.add(c);
        physics.step();
        expect(entered).toEqual([{ a: b, b: c }]);

        // Removing a while the loop is on (a, b) shifts the list, and the
        // loop never reaches (b, c) on this step.
        kernel.events.on('collision_enter', (pair) => {
            if (pair.a === a) physics.remove(a);
        });
        a.gameObject.x = -5;
        physics.step();

        expect(exited).toEqual([{ a, b }]);

        c.gameObject.x = 500;
        physics.step();

        expect(exited).toEqual([{ a, b }, { a: b, b: c }]);
    });

    it('should not report a pair twice when the collider list is reordered', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);
        physics.step();

        physics.colliders.reverse();
        physics.step();
        b.gameObject.x = 500;
        physics.step();

        expect(entered).toHaveLength(1);
        expect(exited).toHaveLength(1);
    });

    it('should keep calling onCollisionEnter on every step while overlapping', () => {
        const onCollisionEnter = vi.fn();
        const a = box(0, 0);
        const b = box(5, 0);
        a.gameObject.components.push({ onCollisionEnter });
        physics.add(a);
        physics.add(b);

        physics.step();
        physics.step();

        expect(onCollisionEnter).toHaveBeenCalledTimes(2);
        expect(onCollisionEnter).toHaveBeenCalledWith(b.gameObject);
    });

    it('should emit collision events from the fixed update of a running kernel', () => {
        physics.add(box(0, 0));
        physics.add(box(5, 0));

        kernel.systems.fixedUpdate(1 / 60);

        expect(entered).toHaveLength(1);
    });

    it('should forget its pairs on destroy without emitting', () => {
        const a = box(0, 0);
        const b = box(5, 0);
        physics.add(a);
        physics.add(b);
        physics.step();

        physics.destroy();
        physics.step();

        expect(exited).toEqual([]);

        physics.add(a);
        physics.add(b);
        physics.step();

        expect(entered).toHaveLength(2);
    });

    it('should step without a kernel', () => {
        const standalone = new Physics();
        const a = box(0, 0);
        const b = box(5, 0);
        standalone.add(a);
        standalone.add(b);

        expect(() => {
            standalone.step();
            standalone.remove(a);
            standalone.step();
        }).not.toThrow();
    });
});
