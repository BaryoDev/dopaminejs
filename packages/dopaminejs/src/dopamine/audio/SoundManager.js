/**
 * Sound Manager Module
 * Handles synthesized sound effects using Web Audio API
 */

export class SoundManager {
    constructor(config = {}) {
        this.audioContext = null;
        this.storageKey = config.storageKey || 'dopamineSoundsMuted';
        this.muted = localStorage.getItem(this.storageKey) === 'true';

        // Asset management
        this.assets = new Map(); // key -> AudioBuffer
        this.customSounds = config.customSounds || {}; // key -> url

        // Preload custom sounds if provided
        if (Object.keys(this.customSounds).length > 0) {
            this.preloadSounds(this.customSounds);
        }
    }

    /**
     * Initialize Audio Context (must be called after user interaction)
     */
    initAudio() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem(this.storageKey, this.muted);
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
     * Preload multiple sounds
     * @param {Object} soundMap - { key: url }
     */
    async preloadSounds(soundMap) {
        const promises = Object.entries(soundMap).map(([key, url]) => this.loadSound(key, url));
        await Promise.allSettled(promises);
    }

    /**
     * Load and decode a sound file
     */
    async loadSound(key, url) {
        try {
            // We need audio context to decode
            if (!this.audioContext) {
                // If no context yet, we can't decode. 
                // In a real app, we might fetch buffer first, decode later.
                // For simplicity, we'll wait for initAudio() or lazy load.
                return;
            }

            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.assets.set(key, audioBuffer);
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
        this.initAudio();

        // 1. Try custom asset first
        if (this.assets.has(key)) {
            this._playBuffer(this.assets.get(key));
            return;
        }

        // 2. Try to load if registered but not loaded
        if (this.customSounds[key] && !this.assets.has(key)) {
            await this.loadSound(key, this.customSounds[key]);
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

        if (synthMap[key]) {
            synthMap[key]();
        }
    }

    _playBuffer(buffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }

    /**
     * Play a synthesized tone
     */
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (this.muted) return;
        this.initAudio();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
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
        setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.25), 50);
    }

    playGameOver(force = false) {
        if (!force && this.assets.has('gameover')) return this.play('gameover');
        this.playTone(300, 0.2, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.3), 100);
        setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.3), 200);
    }

    playClick(force = false) {
        if (!force && this.assets.has('click')) return this.play('click');
        this.playTone(600, 0.05, 'sine', 0.1);
    }

    playSuccess(force = false) {
        if (!force && this.assets.has('success')) return this.play('success');
        this.playTone(600, 0.1, 'sine', 0.2);
        setTimeout(() => this.playTone(800, 0.2, 'sine', 0.2), 100);
    }

    playError(force = false) {
        if (!force && this.assets.has('error')) return this.play('error');
        this.playTone(200, 0.2, 'sawtooth', 0.3);
    }
}
