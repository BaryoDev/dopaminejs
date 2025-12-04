/**
 * Sound Manager Module
 * Handles synthesized sound effects using Web Audio API
 */

export class SoundManager {
    constructor(config = {}) {
        this.audioContext = null;
        this.storageKey = config.storageKey || 'dopamineSoundsMuted';
        this.muted = localStorage.getItem(this.storageKey) === 'true';
    }

    /**
     * Initialize Audio Context (must be called after user interaction)
     */
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
     * Play a synthesized tone
     * @param {number} frequency 
     * @param {number} duration 
     * @param {string} type - 'sine', 'square', 'sawtooth', 'triangle'
     * @param {number} volume 
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

    // --- Presets ---

    playJump() {
        this.playTone(400, 0.1, 'square', 0.2);
    }

    playScore() {
        this.playTone(800, 0.15, 'sine', 0.25);
        setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.25), 50);
    }

    playGameOver() {
        this.playTone(300, 0.2, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.3), 100);
        setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.3), 200);
    }

    playClick() {
        this.playTone(600, 0.05, 'sine', 0.1);
    }

    playSuccess() {
        this.playTone(600, 0.1, 'sine', 0.2);
        setTimeout(() => this.playTone(800, 0.2, 'sine', 0.2), 100);
    }

    playError() {
        this.playTone(200, 0.2, 'sawtooth', 0.3);
    }
}
