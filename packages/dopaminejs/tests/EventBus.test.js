import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';

describe('EventBus', () => {
    let bus;

    beforeEach(() => {
        bus = new EventBus();
    });

    it('should call listeners in priority order, highest first', () => {
        const order = [];
        bus.on('tick', () => order.push('low'), 0);
        bus.on('tick', () => order.push('high'), 10);
        bus.on('tick', () => order.push('mid'), 5);

        bus.emit('tick');

        expect(order).toEqual(['high', 'mid', 'low']);
    });

    it('should pass emitted data to listeners', () => {
        const spy = vi.fn();
        bus.on('xp_gained', spy);

        bus.emit('xp_gained', { amount: 25 });

        expect(spy).toHaveBeenCalledWith({ amount: 25 });
    });

    it('should remove a listener registered more than once', () => {
        const spy = vi.fn();
        bus.on('tick', spy);
        bus.on('tick', spy);

        bus.off('tick', spy);
        bus.emit('tick');

        expect(spy).not.toHaveBeenCalled();
    });

    it('should report hasListeners as a boolean', () => {
        expect(bus.hasListeners('nothing-here')).toBe(false);

        bus.on('tick', () => { });

        expect(bus.hasListeners('tick')).toBe(true);
    });

    it('should call a once listener exactly one time', () => {
        const spy = vi.fn();
        bus.once('ready', spy);

        bus.emit('ready');
        bus.emit('ready');

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not drop a once listener registered during its own event', () => {
        const second = vi.fn();
        bus.once('ready', () => bus.once('ready', second));

        bus.emit('ready'); // registers `second`, must not also fire it
        expect(second).not.toHaveBeenCalled();

        bus.emit('ready'); // now it fires
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('should let a listener remove itself mid-emit without skipping others', () => {
        const later = vi.fn();
        const selfRemoving = () => bus.off('tick', selfRemoving);

        bus.on('tick', selfRemoving, 10);
        bus.on('tick', later, 0);

        bus.emit('tick');
        bus.emit('tick');

        expect(later).toHaveBeenCalledTimes(2);
    });

    it('should survive a throwing listener and still call the rest', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const later = vi.fn();

        bus.on('tick', () => { throw new Error('boom'); }, 10);
        bus.on('tick', later, 0);

        expect(() => bus.emit('tick')).not.toThrow();
        expect(later).toHaveBeenCalled();

        errorSpy.mockRestore();
    });
});
