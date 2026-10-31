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
            this.vol = options.volume;
            this.pos = 0;
            this.seeks = [];
            this.pauses = 0;
            this.playIds = [];
            mocks.howls.push(this);
        }
        play(id) { this.played += 1; this.playIds.push(id); return id === undefined ? this.played : id; }
        stop() { this.stopped = true; }
        pause() { this.pauses += 1; }
        seek(to) {
            if (to === undefined) return this.pos;
            this.seeks.push(to);
            this.pos = to;
            return this;
        }
        unload() { this.unloaded = true; }
        volume(v, id) {
            if (v === undefined) return this.vol;
            if (id === undefined) this.vol = v;
            return this;
        }
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

// A clock the test steps by hand. `requests` and `cancels` count the timers.
const makeClock = () => {
    const clock = {
        t: 0, pending: null, requests: 0, cancels: 0,
        now: () => clock.t,
        request(fn) { clock.requests += 1; clock.pending = fn; return clock.requests; },
        cancel() { clock.cancels += 1; clock.pending = null; },
        tick(ms) {
            clock.t += ms;
            const fn = clock.pending;
            clock.pending = null;
            if (fn) fn();
        },
    };
    return clock;
};

describe('howlerSound music channel', () => {
    let clock;
    let part;
    const track = (n) => mocks.howls[n];

    beforeEach(() => {
        clock = makeClock();
        part = howlerSound({ clock });
        part.registerTrack('a', '/a.mp3');
        part.registerTrack('b', ['/b.ogg', '/b.mp3'], { volume: 0.5 });
    });

    it('registers looping tracks that do not autoplay', () => {
        expect(track(0).options.loop).toBe(true);
        expect(track(1).options.src).toEqual(['/b.ogg', '/b.mp3']);
        expect(track(0).played).toBe(0);
        expect(part.sounds.size).toBe(0);
    });

    it('smoothstep fade follows k*k*(3-2k)', () => {
        part.playTrack('a', { fadeIn: 1000, curve: 'smoothstep' });
        expect(track(0).vol).toBe(0);

        clock.tick(250);
        expect(track(0).vol).toBeCloseTo(0.15625, 10);
        clock.tick(250);
        expect(track(0).vol).toBeCloseTo(0.5, 10);
        clock.tick(500);
        expect(track(0).vol).toBe(1);
    });

    it('linear fade is a straight line', () => {
        part.playTrack('a', { fadeIn: 1000, curve: 'linear' });
        clock.tick(250);
        expect(track(0).vol).toBeCloseTo(0.25, 10);
    });

    it('fading out pauses at the end and keeps the position', () => {
        part.playTrack('a');
        track(0).pos = 42;
        part.fadeOutTrack('a', 400);
        clock.tick(200);
        expect(track(0).pauses).toBe(0);
        clock.tick(200);

        expect(track(0).pauses).toBe(1);
        expect(track(0).vol).toBe(0);
        expect(track(0).seeks).toEqual([]);
        expect(part.getTrackPosition('a')).toBe(42);
    });

    it('playing again after a fade out resumes and never seeks to 0', () => {
        part.playTrack('a');
        part.fadeOutTrack('a', 100);
        clock.tick(100);
        part.playTrack('a', { fadeIn: 100 });
        clock.tick(100);

        expect(track(0).seeks).toEqual([]);
        expect(track(0).playIds).toEqual([undefined, 1]);
        expect(track(0).vol).toBe(1);
    });

    it('a second crossfade cancels the timers of the first', () => {
        part.registerTrack('c', '/c.mp3');
        part.playTrack('a');
        part.crossfade('a', 'b', { out: 1000, in: 1000 });
        clock.tick(300);
        const cancels = clock.cancels;
        const gainOfB = track(1).vol;

        part.crossfade('b', 'c', { out: 1000, in: 1000 });
        expect(clock.cancels).toBeGreaterThan(cancels);
        // Only one frame request is ever waiting.
        expect(clock.pending).not.toBeNull();
        expect(track(0).pauses).toBe(1);

        clock.tick(1000);
        expect(track(1).pauses).toBe(1);
        expect(track(2).vol).toBe(1);
        expect(gainOfB).toBeGreaterThan(0);
    });

    it('uses inIfPlaying when the target is already playing', () => {
        part.playTrack('a');
        part.playTrack('b', { fadeIn: 1000, curve: 'linear' });
        clock.tick(500);
        expect(track(1).vol).toBeCloseTo(0.25, 10);

        part.crossfade('a', 'b', { out: 1000, in: 1600, inIfPlaying: 900, curve: 'linear' });
        clock.tick(450);
        // gain 0.5 to 1 over 900 ms, halfway: 0.75 of a 0.5 base volume.
        expect(track(1).vol).toBeCloseTo(0.375, 10);
    });

    it('uses in when the target was paused, and starts it from its stored place', () => {
        part.crossfade('a', 'b', { out: 1000, in: 1600, inIfPlaying: 900 });
        clock.tick(800);
        expect(track(1).vol).toBeCloseTo(0.5 * 0.5, 5);
        expect(track(1).seeks).toEqual([]);
    });

    it('music and effects volumes are separate', () => {
        part.register('click', '/click.mp3');
        const effect = track(2);
        part.playTrack('a');

        part.setMusicVolume(0.4);
        expect(effect.vol).toBe(1);
        expect(track(0).vol).toBeCloseTo(0.4, 10);
        expect(part.getMusicVolume()).toBe(0.4);

        part.setEffectsVolume(0.2);
        expect(effect.vol).toBe(0.2);
        expect(track(0).vol).toBeCloseTo(0.4, 10);
        expect(part.getEffectsVolume()).toBe(0.2);
    });

    it('keeps setVolume on the global Howler volume and register volume as before', () => {
        part.setVolume(0.3);
        expect(mocks.Howler.volume).toHaveBeenLastCalledWith(0.3);
        part.register('x', '/x.mp3');
        expect(track(2).options.volume).toBe(0.3);
    });

    it('mute then unmute runs one fade each and never two at once', () => {
        part.playTrack('a');
        part.muteMusic(500);
        clock.tick(250);
        expect(track(0).vol).toBeCloseTo(0.5, 10);
        expect(track(0).pauses).toBe(0);

        part.unmuteMusic(1200);
        const fromHere = track(0).vol;
        clock.tick(600);
        expect(track(0).vol).toBeGreaterThan(fromHere);
        expect(track(0).vol).toBeLessThan(1);
        clock.tick(600);
        expect(track(0).vol).toBe(1);
        expect(clock.pending).toBeNull();
    });

    it('ducks and unducks', () => {
        part.playTrack('a');
        part.duckMusic(0.25, 100);
        clock.tick(100);
        expect(track(0).vol).toBeCloseTo(0.25, 10);
        part.unduck(100);
        clock.tick(100);
        expect(track(0).vol).toBe(1);
    });

    it('ignores unknown keys', () => {
        expect(() => {
            part.playTrack('nope');
            part.fadeOutTrack('nope', 10);
            part.crossfade('nope', 'also', { out: 1, in: 1 });
            part.playTrack(undefined);
        }).not.toThrow();
        expect(part.getTrackPosition('nope')).toBe(0);
    });

    it('destroy unloads tracks and cancels the timer', () => {
        part.playTrack('a', { fadeIn: 1000 });
        part.destroy();
        expect(track(0).unloaded).toBe(true);
        expect(clock.pending).toBeNull();
    });
});
