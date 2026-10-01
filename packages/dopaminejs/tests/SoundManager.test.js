/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';

// Mock Web Audio API
class AudioContextMock {
    constructor() {
        this.state = 'running';
        this.resume = vi.fn();
        this.destination = {};
        this.currentTime = 0;
    }
    createOscillator() {
        return {
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            frequency: { value: 0 },
            type: 'sine'
        };
    }
    createGain() {
        return {
            connect: vi.fn(),
            gain: {
                setValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn()
            }
        };
    }
    createBufferSource() {
        return {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn()
        };
    }
    decodeAudioData() {
        return Promise.resolve({ duration: 1 });
    }
}

window.AudioContext = AudioContextMock;
window.webkitAudioContext = AudioContextMock;

// Mock Fetch
global.fetch = vi.fn(() => Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
}));

describe('SoundManager', () => {
    let soundManager;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        soundManager = new SoundManager();
    });

    it('should initialize with default config', () => {
        expect(soundManager.muted).toBe(false);
        expect(soundManager.assets.size).toBe(0);
        expect(soundManager.customSounds).toEqual({});
    });

    it('should toggle mute', () => {
        soundManager.toggleMute();
        expect(soundManager.muted).toBe(true);
        expect(localStorage.getItem('dopamineSoundsMuted')).toBe('true');
    });

    it('should register custom sounds', () => {
        soundManager.registerSound('jump', 'jump.mp3');
        expect(soundManager.customSounds['jump']).toBe('jump.mp3');
    });

    it('should load sound when audio context is ready', async () => {
        soundManager.initAudio();
        await soundManager.loadSound('jump', 'jump.mp3');

        expect(global.fetch).toHaveBeenCalledWith('jump.mp3');
        expect(soundManager.assets.has('jump')).toBe(true);
    });

    it('should play custom sound if loaded', async () => {
        soundManager.initAudio();
        // Manually set asset to simulate loaded state
        soundManager.assets.set('jump', { duration: 1 });

        // Spy on internal method
        const playBufferSpy = vi.spyOn(soundManager, '_playBuffer');

        await soundManager.play('jump');

        expect(playBufferSpy).toHaveBeenCalled();
    });

    it('should fallback to synth if custom sound not found', async () => {
        soundManager.initAudio();
        const playToneSpy = vi.spyOn(soundManager, 'playTone');

        // 'jump' is not in assets, so it should fallback to playJump() -> playTone()
        await soundManager.play('jump');

        expect(playToneSpy).toHaveBeenCalled();
    });

    it('should attempt to load and play if registered but not loaded', async () => {
        soundManager.initAudio();
        soundManager.registerSound('win', 'win.mp3');

        const playBufferSpy = vi.spyOn(soundManager, '_playBuffer');

        await soundManager.play('win');

        expect(global.fetch).toHaveBeenCalledWith('win.mp3');
        expect(playBufferSpy).toHaveBeenCalled();
    });

    it('should register preloaded sounds before the audio context exists', async () => {
        await soundManager.preloadSounds({ win: 'win.mp3', lose: 'lose.mp3' });

        expect(soundManager.audioContext).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(soundManager.customSounds).toEqual({ win: 'win.mp3', lose: 'lose.mp3' });
    });

    it('should load preloaded sounds when the audio context is created', async () => {
        await soundManager.preloadSounds({ win: 'win.mp3', lose: 'lose.mp3' });

        soundManager.initAudio();
        await vi.waitFor(() => expect(soundManager.assets.size).toBe(2));

        expect(global.fetch).toHaveBeenCalledWith('win.mp3');
        expect(global.fetch).toHaveBeenCalledWith('lose.mp3');
    });

    it('should play a sound that was preloaded before the audio context existed', async () => {
        await soundManager.preloadSounds({ win: 'win.mp3' });
        const playBufferSpy = vi.spyOn(soundManager, '_playBuffer');

        await soundManager.play('win');

        expect(playBufferSpy).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should load preloaded sounds at once when the audio context exists', async () => {
        soundManager.initAudio();

        await soundManager.preloadSounds({ win: 'win.mp3' });

        expect(soundManager.assets.has('win')).toBe(true);
        expect(soundManager.customSounds.win).toBe('win.mp3');
    });
});
