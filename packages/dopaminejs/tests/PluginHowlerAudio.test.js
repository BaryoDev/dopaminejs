/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { howlerSound } from '../../plugin-howler-audio/src/index.js';
import { conformance } from '../src/testing.js';

const mocks = vi.hoisted(() => ({ howls: [], Howler: { mute: null, volume: null } }));

// Howler needs a real audio stack, so it is replaced by a recorder. Nothing
// here plays sound.
vi.mock('howler', () => {
    class Howl {
        constructor(options) {
            this.options = options;
            this.played = 0;
            this.unloaded = false;
            mocks.howls.push(this);
        }
        play() { this.played += 1; return this.played; }
        stop() { this.stopped = true; }
        unload() { this.unloaded = true; }
        volume() {}
        loop() {}
        rate() {}
        once() {}
    }
    mocks.Howler.mute = vi.fn();
    mocks.Howler.volume = vi.fn();
    return { Howl, Howler: mocks.Howler };
});

beforeEach(() => {
    mocks.howls.length = 0;
    mocks.Howler.mute.mockClear();
    mocks.Howler.volume.mockClear();
});

describe('howlerSound', () => {
    it('implements SoundPlayer', () => {
        const part = howlerSound({ sounds: { xp: '/xp.mp3' } });

        expect(typeof part.play).toBe('function');
        expect(typeof part.destroy).toBe('function');
        expect(typeof part.register('click', { src: '/click.mp3' })).toBe('function');
        expect(part.play('xp')).toBe(1);
        expect(mocks.howls.map((h) => h.options.src)).toEqual([['/xp.mp3'], ['/click.mp3']]);

        part.destroy();
        expect(mocks.howls.every((h) => h.unloaded)).toBe(true);
        expect(part.play('xp')).toBeUndefined();
    });

    it('unknown key is a no-op', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const part = howlerSound({ sounds: { xp: '/xp.mp3' } });

        for (const key of ['nope', '__proto__', 'constructor', 'toString', '', undefined, null, 42, {}]) {
            expect(part.play(key)).toBeUndefined();
        }

        expect(mocks.howls[0].played).toBe(0);
        expect(warn).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
        warn.mockRestore();
        log.mockRestore();
    });

    it('removing a key unloads it', () => {
        const part = howlerSound();
        const remove = part.register('jump', '/jump.mp3');
        remove();

        expect(mocks.howls[0].unloaded).toBe(true);
        expect(part.play('jump')).toBeUndefined();
    });

    it('has volume and mute controls', () => {
        const part = howlerSound({ volume: 0.4 });
        expect(part.getVolume()).toBe(0.4);
        expect(part.setVolume(5)).toBe(1);
        expect(part.setVolume(NaN)).toBe(1);

        expect(part.isMuted()).toBe(false);
        part.setMuted(true);
        expect(part.isMuted()).toBe(true);
        expect(mocks.Howler.mute).toHaveBeenLastCalledWith(true);
        expect(part.toggleMute()).toBe(false);
    });

    it('unlockOn is a no-op that returns a disposer', () => {
        const target = document.createElement('div');
        const add = vi.spyOn(target, 'addEventListener');
        const remove = howlerSound().unlockOn(target);

        expect(typeof remove).toBe('function');
        expect(add).not.toHaveBeenCalled();
        expect(() => remove()).not.toThrow();
    });
});

conformance.sound(() => howlerSound());
