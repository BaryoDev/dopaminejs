import { ISystem } from './ISystem.js';

/**
 * IAudioSystem - Interface for audio implementations
 * 
 * Allows different audio engines (Web Audio, Howler.js, etc.) to be swapped
 */
export const IAudioSystem = {
    ...ISystem,

    /**
     * Register a sound with a key
     * @param {string} key - Sound identifier
     * @param {string} url - Path to audio file
     */
    registerSound(key, url) { },

    /**
     * Preload multiple sounds
     * @param {Object} soundMap - Map of key -> url
     * @returns {Promise<void>}
     */
    preloadSounds(soundMap) { },

    /**
     * Play a sound by key
     * @param {string} key - Sound identifier
     * @param {Object} options - Playback options (volume, loop, etc.)
     */
    play(key, options) { },

    /**
     * Play a synthesized tone
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Waveform type ('sine', 'square', etc.)
     * @param {number} volume - Volume (0-1)
     */
    playTone(frequency, duration, type, volume) { },

    /**
     * Stop a playing sound
     * @param {string} key - Sound identifier
     */
    stop(key) { },

    /**
     * Toggle mute state
     * @returns {boolean} - New mute state
     */
    toggleMute() { },

    /**
     * Set master volume
     * @param {number} volume - Volume (0-1)
     */
    setVolume(volume) { },
};
