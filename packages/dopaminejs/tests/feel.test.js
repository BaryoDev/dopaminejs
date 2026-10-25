/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createHaptics, prefersReducedMotion, SoundManager } from '../src/index.js';

function stubTarget() {
    const listeners = new Map();
    return {
        listeners,
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            listeners.get(type)?.delete(fn);
        },
        fire(type) {
            for (const fn of [...(listeners.get(type) ?? [])]) fn({ type });
        },
        count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    };
}

describe('createHaptics', () => {
    it('taps 10 ms and doubles 10, 40, 10', () => {
        const calls = [];
        const h = createHaptics({ nav: { vibrate: (p) => calls.push(p) } });
        h.tap();
        h.double();
        expect(calls).toEqual([10, [10, 40, 10]]);
    });

    it('is silent where there is no vibrate', () => {
        const h = createHaptics({ nav: {} });
        expect(() => {
            h.tap();
            h.double();
        }).not.toThrow();
        expect(() => createHaptics({ nav: undefined }).tap()).not.toThrow();
    });

    it('a vibrate that throws does not reach the game', () => {
        const h = createHaptics({ nav: { vibrate: () => { throw new Error('blocked'); } } });
        expect(() => h.tap()).not.toThrow();
    });

    it('records nothing while turned off, and works again when turned on', () => {
        const calls = [];
        const h = createHaptics({ nav: { vibrate: (p) => calls.push(p) }, enabled: false });
        h.tap();
        h.setEnabled(true);
        h.double();
        h.setEnabled(false);
        h.tap();
        expect(calls).toEqual([[10, 40, 10]]);
    });
});

describe('prefersReducedMotion', () => {
    it('is matches: false without matchMedia', () => {
        expect(prefersReducedMotion({})).toEqual({ matches: false });
        expect(prefersReducedMotion(undefined)).toEqual({ matches: false });
    });

    it('asks for the reduce query', () => {
        const query = { matches: true };
        const win = { matchMedia: vi.fn(() => query) };
        expect(prefersReducedMotion(win)).toBe(query);
        expect(win.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });
});

describe('SoundManager#unlockOn', () => {
    it('starts audio once on the first gesture and removes its listeners', () => {
        const sound = new SoundManager();
        const init = vi.spyOn(sound, 'initAudio').mockReturnValue(true);
        const target = stubTarget();
        sound.unlockOn(target);
        expect(target.count()).toBe(3);
        target.fire('pointerdown');
        target.fire('pointerdown');
        target.fire('keydown');
        expect(init).toHaveBeenCalledTimes(1);
        expect(target.count()).toBe(0);
    });

    it('takes its own event list and returns a remover', () => {
        const sound = new SoundManager();
        const init = vi.spyOn(sound, 'initAudio').mockReturnValue(true);
        const target = stubTarget();
        const remove = sound.unlockOn(target, ['click']);
        expect([...target.listeners.keys()]).toEqual(['click']);
        remove();
        target.fire('click');
        expect(init).not.toHaveBeenCalled();
        expect(target.count()).toBe(0);
    });

    it('destroy removes listeners that never fired', () => {
        const sound = new SoundManager();
        vi.spyOn(sound, 'initAudio').mockReturnValue(true);
        const target = stubTarget();
        sound.unlockOn(target);
        sound.destroy();
        expect(target.count()).toBe(0);
    });
});
