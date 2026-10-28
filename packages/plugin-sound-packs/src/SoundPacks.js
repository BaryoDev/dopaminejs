/**
 * Sound Pack Presets
 * Pre-configured sound collections for different game aesthetics
 */

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export const SoundPacks = {
    /**
     * Retro/8-bit sound pack
     * Classic arcade game sounds
     */
    retro: {
        xp: {
            type: 'tone',
            frequency: 440,
            duration: 0.1,
            waveform: 'square',
            volume: 0.3
        },
        levelUp: {
            type: 'sequence',
            notes: [
                { frequency: 523, duration: 0.1 }, // C
                { frequency: 659, duration: 0.1 }, // E
                { frequency: 784, duration: 0.2 }, // G
            ],
            waveform: 'square',
            volume: 0.4
        },
        achievement: {
            type: 'sequence',
            notes: [
                { frequency: 659, duration: 0.1 },
                { frequency: 784, duration: 0.1 },
                { frequency: 1047, duration: 0.3 },
            ],
            waveform: 'square',
            volume: 0.4
        },
        coin: {
            type: 'tone',
            frequency: 1000,
            duration: 0.05,
            waveform: 'sine',
            volume: 0.2
        },
        error: {
            type: 'tone',
            frequency: 100,
            duration: 0.2,
            waveform: 'sawtooth',
            volume: 0.3
        }
    },

    /**
     * Modern/Cinematic sound pack
     * Smooth, polished sounds
     */
    modern: {
        xp: {
            type: 'tone',
            frequency: 800,
            duration: 0.15,
            waveform: 'sine',
            volume: 0.2
        },
        levelUp: {
            type: 'sequence',
            notes: [
                { frequency: 440, duration: 0.15 },
                { frequency: 554, duration: 0.15 },
                { frequency: 659, duration: 0.3 },
            ],
            waveform: 'sine',
            volume: 0.3
        },
        achievement: {
            type: 'sequence',
            notes: [
                { frequency: 523, duration: 0.1 },
                { frequency: 659, duration: 0.1 },
                { frequency: 784, duration: 0.1 },
                { frequency: 1047, duration: 0.4 },
            ],
            waveform: 'sine',
            volume: 0.3
        },
        coin: {
            type: 'tone',
            frequency: 1200,
            duration: 0.08,
            waveform: 'triangle',
            volume: 0.15
        },
        error: {
            type: 'tone',
            frequency: 200,
            duration: 0.25,
            waveform: 'triangle',
            volume: 0.25
        }
    },

    /**
     * Cute/Kawaii sound pack
     * High-pitched, cheerful sounds
     */
    cute: {
        xp: {
            type: 'tone',
            frequency: 1200,
            duration: 0.08,
            waveform: 'sine',
            volume: 0.25
        },
        levelUp: {
            type: 'sequence',
            notes: [
                { frequency: 659, duration: 0.1 },
                { frequency: 784, duration: 0.1 },
                { frequency: 988, duration: 0.1 },
                { frequency: 1319, duration: 0.3 },
            ],
            waveform: 'sine',
            volume: 0.3
        },
        achievement: {
            type: 'sequence',
            notes: [
                { frequency: 784, duration: 0.08 },
                { frequency: 988, duration: 0.08 },
                { frequency: 1175, duration: 0.08 },
                { frequency: 1568, duration: 0.35 },
            ],
            waveform: 'sine',
            volume: 0.3
        },
        coin: {
            type: 'tone',
            frequency: 1500,
            duration: 0.06,
            waveform: 'sine',
            volume: 0.2
        },
        error: {
            type: 'tone',
            frequency: 300,
            duration: 0.15,
            waveform: 'sine',
            volume: 0.2
        }
    },

    /**
     * Sci-Fi sound pack
     * Futuristic, electronic sounds
     */
    scifi: {
        xp: {
            type: 'tone',
            frequency: 600,
            duration: 0.12,
            waveform: 'sawtooth',
            volume: 0.25
        },
        levelUp: {
            type: 'sequence',
            notes: [
                { frequency: 400, duration: 0.1 },
                { frequency: 600, duration: 0.1 },
                { frequency: 800, duration: 0.1 },
                { frequency: 1000, duration: 0.25 },
            ],
            waveform: 'sawtooth',
            volume: 0.3
        },
        achievement: {
            type: 'sequence',
            notes: [
                { frequency: 500, duration: 0.1 },
                { frequency: 700, duration: 0.1 },
                { frequency: 900, duration: 0.1 },
                { frequency: 1200, duration: 0.35 },
            ],
            waveform: 'sawtooth',
            volume: 0.3
        },
        coin: {
            type: 'tone',
            frequency: 1400,
            duration: 0.07,
            waveform: 'sawtooth',
            volume: 0.2
        },
        error: {
            type: 'tone',
            frequency: 150,
            duration: 0.3,
            waveform: 'sawtooth',
            volume: 0.3
        }
    }
};

/**
 * Get a sound pack by name
 * @param {string} packName - Name of the pack (retro, modern, cute, scifi)
 * @returns {Object} Sound pack configuration. An unknown name gives `modern`.
 */
export function getSoundPack(packName) {
    return typeof packName === 'string' && hasOwn(SoundPacks, packName) ? SoundPacks[packName] : SoundPacks.modern;
}

/**
 * List all available sound packs
 * @returns {string[]} Array of pack names
 */
export function listSoundPacks() {
    return Object.keys(SoundPacks);
}

// Pack keys that differ from the sound keys the host plays.
const SOUND_KEYS = { levelUp: 'level_up' };

// A spec is a tone, or a sequence of notes that share a waveform and volume.
function synthOf(spec) {
    const volume = spec.volume;
    const waveform = spec.waveform;
    if (spec.type === 'sequence') {
        return (sound, later) => {
            let at = 0;
            spec.notes.forEach((note, i) => {
                const play = () => sound.playTone(note.frequency, note.duration, waveform, volume);
                if (i === 0) play();
                else later(play, Math.round(at * 1000));
                at += note.duration;
            });
        };
    }
    return (sound) => sound.playTone(spec.frequency, spec.duration, waveform, volume);
}

/**
 * A plugin that registers a pack on the sound part with `sound.register(key, synth)`.
 * It replaces the built-in xp, level_up, achievement and error sounds, and adds `coin`.
 * Removing the plugin restores them.
 *
 *   createDopamine({ plugins: [soundPack('retro')] });
 *
 * @param {string} [name='modern']
 */
export function soundPack(name = 'modern') {
    return {
        name: 'sound-pack',
        version: '3.0.0',
        api: 3,
        requires: ['sound'],

        install(ctx) {
            const known = typeof name === 'string' && hasOwn(SoundPacks, name);
            if (!known) ctx.log.warn(`[sound-pack] unknown pack "${String(name)}", using modern`);
            const pack = getSoundPack(name);
            const sound = ctx.parts.sound;
            if (typeof sound.register !== 'function') {
                ctx.log.warn('[sound-pack] the sound part cannot register keys, nothing was added');
                return undefined;
            }
            const removers = Object.keys(pack).map((key) => {
                const soundKey = hasOwn(SOUND_KEYS, key) ? SOUND_KEYS[key] : key;
                return sound.register(soundKey, synthOf(pack[key]));
            });
            return () => {
                for (const remove of removers) if (typeof remove === 'function') remove();
            };
        }
    };
}
