import { describe, it, expect, afterEach, vi } from 'vitest';
import { soundPack, getSoundPack, listSoundPacks } from '../../plugin-sound-packs/src/index.js';
import { createTestHost, conformance } from '../src/testing.js';

let hosts = [];
afterEach(() => {
    for (const test of hosts) test.dispose();
    hosts = [];
});

// A sound part that keeps what is registered on it.
const soundPart = () => {
    const synths = new Map();
    return {
        synths,
        play() {},
        register(key, synth) {
            synths.set(key, synth);
            return () => { if (synths.get(key) === synth) synths.delete(key); };
        },
        destroy() {}
    };
};

const start = (name, part = soundPart()) => {
    const test = createTestHost({ parts: { sound: part }, plugins: [soundPack(name)] });
    hosts.push(test);
    return { test, part };
};

describe('soundPack', () => {
    it('registers every key of the pack on the sound part', () => {
        const { part } = start('retro');

        expect([...part.synths.keys()].sort()).toEqual(['achievement', 'coin', 'error', 'level_up', 'xp']);
    });

    it('plays a tone and a sequence through the synth', () => {
        const { part } = start('retro');
        const sound = { playTone: vi.fn() };
        const later = vi.fn((fn) => fn());

        part.synths.get('xp')(sound, later);
        expect(sound.playTone).toHaveBeenLastCalledWith(440, 0.1, 'square', 0.3);
        expect(later).not.toHaveBeenCalled();

        part.synths.get('level_up')(sound, later);
        expect(sound.playTone).toHaveBeenCalledTimes(4);
        expect(later.mock.calls.map((c) => c[1])).toEqual([100, 200]);
    });

    it('removes its keys when disposed', () => {
        const part = soundPart();
        const test = createTestHost({ parts: { sound: part } });
        hosts.push(test);
        const dispose = test.use(soundPack('cute'));
        expect(part.synths.size).toBe(5);

        dispose();

        expect(part.synths.size).toBe(0);
    });

    it('falls back to modern with a warning for an unknown name', () => {
        const warn = vi.fn();
        const part = soundPart();
        const test = createTestHost({ parts: { sound: part }, plugins: [soundPack('__proto__')], log: { warn } });
        hosts.push(test);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(part.synths.size).toBe(5);
        expect(getSoundPack('constructor')).toBe(getSoundPack('modern'));
    });

    it('lists the packs', () => {
        expect(listSoundPacks()).toEqual(['retro', 'modern', 'cute', 'scifi']);
    });

    it('is refused when there is no sound part', () => {
        expect(() => createTestHost({ parts: { sound: false }, plugins: [soundPack()] })).toThrow(/requires the sound part/);
    });
});

conformance.plugin(() => soundPack('scifi'));
