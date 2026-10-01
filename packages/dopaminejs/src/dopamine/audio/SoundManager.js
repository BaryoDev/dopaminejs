/**
 * Sound Manager Module
 * Handles synthesized sound effects using Web Audio API
 */

import { resolveStorage } from '../utils/storage.js';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export class SoundManager {
    constructor(config = {}) {
        this.audioContext = null;
        this.storageKey = config.storageKey || 'dopamineSoundsMuted';
        this.storage = config.storage || resolveStorage();
        this.muted = this.storage.getItem(this.storageKey) === 'true';

        // Asset management
        this.assets = new Map(); // key -> AudioBuffer
        this.customSounds = config.customSounds || {}; // key -> url

        // Master gain, created with the AudioContext on first use.
        this.masterGain = null;
        this._volume = 1;
        this.setVolume(config.volume ?? 1);

        // In-flight loads by key, so a play() during preload does not fetch
        // the same file twice.
        this._loading = new Map();

        // Queued follow-up tones, so destroy() can cancel them.
        this._timers = new Set();
    }

    /**
     * setTimeout that destroy() can cancel.
     * @private
     */
    _later(fn, delay) {
        const id = setTimeout(() => {
            this._timers.delete(id);
            fn();
        }, delay);
        this._timers.add(id);
    }

    /**
     * Initialize Audio Context (must be called after user interaction)
     */
    initAudio() {
        if (!this.audioContext) {
            const Ctor = typeof window !== 'undefined'
                ? (window.AudioContext || window.webkitAudioContext)
                : undefined;

            // No Web Audio API: SSR, a worker, or a very old browser. Stay
            // silent rather than taking the whole game down.
            if (!Ctor) return false;

            this.audioContext = new Ctor();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this._volume;
            this.masterGain.connect(this.audioContext.destination);

            // Decoding needs a context, so sounds registered before this
            // point could not be loaded until now.
            this.preloadSounds(this.customSounds);
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        return true;
    }

    /**
     * Set master output volume.
     * @param {number} value - 0..1
     */
    setVolume(value) {
        // NaN would pass through Math.min/max and silence the gain node.
        if (!Number.isFinite(value)) return this._volume;

        this._volume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.value = this._volume;
        }
        return this._volume;
    }

    /**
     * Current master output volume.
     * @returns {number}
     */
    getVolume() {
        return this._volume;
    }

    /**
     * Node every sound routes through, so volume and mute apply uniformly.
     * @private
     */
    _output() {
        return this.masterGain || this.audioContext.destination;
    }

    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    toggleMute() {
        this.muted = !this.muted;
        this.storage.setItem(this.storageKey, this.muted);
        return this.muted;
    }

    /**
     * Register a custom sound URL
     * @param {string} key - Unique identifier (e.g., 'jump', 'win')
     * @param {string} url - Path to audio file
     */
    registerSound(key, url) {
        this.customSounds[key] = url;
        // Auto-load if context exists, otherwise wait for init
        if (this.audioContext) {
            this.loadSound(key, url);
        }
    }

    /**
     * Register and load multiple sounds. Before the audio context exists the
     * files cannot be decoded, so they load when initAudio() creates it.
     * @param {Object} soundMap - { key: url }
     */
    async preloadSounds(soundMap) {
        const promises = Object.entries(soundMap).map(([key, url]) => {
            // play() only loads keys it finds here.
            this.customSounds[key] = url;
            return this.loadSound(key, url);
        });
        await Promise.allSettled(promises);
    }

    /**
     * Load and decode a sound file
     */
    async loadSound(key, url) {
        // We need an audio context to decode. Without one this waits for
        // initAudio(), which loads everything registered so far.
        if (!this.audioContext) return;

        if (this._loading.has(key)) {
            return this._loading.get(key);
        }

        const loading = this._load(key, url).finally(() => this._loading.delete(key));
        this._loading.set(key, loading);
        return loading;
    }

    /**
     * @private
     */
    async _load(key, url) {
        try {
            const context = this.audioContext;
            const response = await fetch(url);

            // fetch resolves on a 404. Its body is an error page, not audio.
            if (response.ok === false) {
                throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await context.decodeAudioData(arrayBuffer);

            // destroy() may have run while this was in flight.
            if (this.audioContext === context) {
                this.assets.set(key, audioBuffer);
            }
        } catch (error) {
            console.warn(`[DopamineJS] Failed to load sound '${key}':`, error);
        }
    }

    /**
     * Play a sound by key (custom) or fallback to synth
     * @param {string} key - 'jump', 'score', 'success', etc.
     */
    async play(key) {
        if (this.muted) return;
        if (!this.initAudio()) return;

        // 1. Try custom asset first
        if (this.assets.has(key)) {
            this._playBuffer(this.assets.get(key));
            return;
        }

        // 2. Try to load if registered but not loaded
        if (hasOwn(this.customSounds, key) && !this.assets.has(key)) {
            const context = this.audioContext;
            await this.loadSound(key, this.customSounds[key]);

            // destroy() ran while the file loaded. The synth fallback would
            // open a new context.
            if (this.audioContext !== context) return;

            if (this.assets.has(key)) {
                this._playBuffer(this.assets.get(key));
                return;
            }
        }

        // 3. Fallback to synth based on key name
        const synthMap = {
            'jump': () => this.playJump(true),
            'score': () => this.playScore(true),
            'success': () => this.playSuccess(true),
            'click': () => this.playClick(true),
            'error': () => this.playError(true),
            'gameover': () => this.playGameOver(true)
        };

        if (hasOwn(synthMap, key)) {
            synthMap[key]();
        }
    }

    _playBuffer(buffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this._output());
        source.start(0);
    }

    /**
     * Play a synthesized tone
     */
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (this.muted) return;
        if (!this.initAudio()) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this._output());

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        // exponentialRampToValueAtTime cannot reach or start from zero.
        const peak = Math.max(0.0001, volume);
        gainNode.gain.setValueAtTime(peak, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // --- Presets (Synth) ---

    playJump(force = false) {
        if (!force && this.assets.has('jump')) return this.play('jump');
        this.playTone(400, 0.1, 'square', 0.2);
    }

    playScore(force = false) {
        if (!force && this.assets.has('score')) return this.play('score');
        this.playTone(800, 0.15, 'sine', 0.25);
        this._later(() => this.playTone(1000, 0.15, 'sine', 0.25), 50);
    }

    playGameOver(force = false) {
        if (!force && this.assets.has('gameover')) return this.play('gameover');
        this.playTone(300, 0.2, 'sawtooth', 0.3);
        this._later(() => this.playTone(200, 0.2, 'sawtooth', 0.3), 100);
        this._later(() => this.playTone(150, 0.3, 'sawtooth', 0.3), 200);
    }

    playClick(force = false) {
        if (!force && this.assets.has('click')) return this.play('click');
        this.playTone(600, 0.05, 'sine', 0.1);
    }

    playSuccess(force = false) {
        if (!force && this.assets.has('success')) return this.play('success');
        this.playTone(600, 0.1, 'sine', 0.2);
        this._later(() => this.playTone(800, 0.2, 'sine', 0.2), 100);
    }

    playError(force = false) {
        if (!force && this.assets.has('error')) return this.play('error');
        this.playTone(200, 0.2, 'sawtooth', 0.3);
    }

    /**
     * Cancel queued tones, close the audio context and drop decoded buffers.
     * Browsers cap the number of live AudioContexts per page.
     */
    destroy() {
        for (const id of this._timers) {
            clearTimeout(id);
        }
        this._timers.clear();

        if (this.audioContext) {
            const closing = this.audioContext.close?.();
            closing?.catch?.(() => {});
        }

        this.audioContext = null;
        this.masterGain = null;
        this.assets.clear();
        this._loading.clear();
    }
}
