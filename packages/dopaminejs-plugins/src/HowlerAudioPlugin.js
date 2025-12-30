/**
 * Howler.js Audio Plugin
 * 
 * Replaces the default Web Audio implementation with Howler.js
 * for better cross-browser compatibility and advanced features.
 * 
 * Installation:
 * ```bash
 * npm install howler
 * ```
 * 
 * Usage:
 * ```javascript
 * import { Game } from 'dopaminejs';
 * import { HowlerAudioPlugin } from 'dopaminejs/plugins';
 * 
 * const game = new Game();
 * await game.kernel.plugins.useAsync(HowlerAudioPlugin);
 * game.start();
 * ```
 */

// Note: Howler.js must be installed separately
// This is a reference implementation showing how to integrate it

/**
 * Howler.js Audio System implementing IAudioSystem
 */
class HowlerAudioSystem {
    constructor() {
        this.sounds = new Map();
        this.kernel = null;
        this.muted = false;
        this.volume = 1.0;
    }

    // ISystem interface
    init(kernel) {
        this.kernel = kernel;
        console.log('[HowlerAudio] Initialized with Howler.js');
    }

    destroy() {
        // Stop and unload all sounds
        for (const [key, howl] of this.sounds) {
            howl.unload();
        }
        this.sounds.clear();
    }

    // IAudioSystem interface
    registerSound(key, url) {
        // Dynamically import Howler when needed
        if (typeof Howl === 'undefined') {
            console.error('[HowlerAudio] Howler.js not found. Install with: npm install howler');
            return;
        }

        const howl = new Howl({
            src: [url],
            volume: this.volume,
            mute: this.muted
        });

        this.sounds.set(key, howl);
    }

    async preloadSounds(soundMap) {
        const promises = Object.entries(soundMap).map(([key, url]) => {
            return new Promise((resolve) => {
                this.registerSound(key, url);
                const howl = this.sounds.get(key);
                if (howl) {
                    howl.once('load', resolve);
                    howl.once('loaderror', resolve);
                } else {
                    resolve();
                }
            });
        });

        await Promise.all(promises);
    }

    play(key, options = {}) {
        const howl = this.sounds.get(key);
        if (!howl) {
            console.warn(`[HowlerAudio] Sound "${key}" not registered`);
            return;
        }

        const id = howl.play();

        // Apply options
        if (options.volume !== undefined) {
            howl.volume(options.volume, id);
        }
        if (options.loop !== undefined) {
            howl.loop(options.loop, id);
        }
        if (options.rate !== undefined) {
            howl.rate(options.rate, id);
        }

        return id;
    }

    playTone(frequency, duration, type, volume) {
        // Howler.js doesn't support synthesized tones
        // Fall back to Web Audio API for this
        console.warn('[HowlerAudio] Synthesized tones not supported. Use registerSound() instead.');
    }

    stop(key) {
        const howl = this.sounds.get(key);
        if (howl) {
            howl.stop();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        for (const howl of this.sounds.values()) {
            howl.mute(this.muted);
        }
        return this.muted;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        for (const howl of this.sounds.values()) {
            howl.volume(this.volume);
        }
    }
}

/**
 * Howler.js Audio Plugin
 * 
 * Replaces default audio system with Howler.js
 */
export const HowlerAudioPlugin = {
    name: 'howler-audio',
    version: '1.0.0',

    async init(kernel) {
        console.log('[HowlerAudioPlugin] Installing Howler.js audio system...');

        // Check if Howler.js is available
        if (typeof window !== 'undefined' && typeof window.Howl === 'undefined') {
            try {
                // Try to dynamically import Howler.js
                /* @vite-ignore */
                const { Howl, Howler } = await import('howler');
                window.Howl = Howl;
                window.Howler = Howler;
            } catch (error) {
                console.error('[HowlerAudioPlugin] Failed to load Howler.js:', error);
                console.error('Install with: npm install howler');
                throw new Error('Howler.js is required for this plugin');
            }
        }

        // Unregister default audio (if exists)
        if (kernel.systems.has('audio')) {
            kernel.systems.unregister('audio');
        }

        // Register Howler.js audio system
        kernel.systems.register('audio', new HowlerAudioSystem(), {
            priority: 70,
        });

        console.log('[HowlerAudioPlugin] Howler.js audio system installed successfully');
    },

    destroy() {
        console.log('[HowlerAudioPlugin] Uninstalling Howler.js audio system...');
    }
};

/**
 * Example usage with sound preloading
 */
export const HowlerAudioPluginExample = {
    name: 'howler-audio-example',

    async init(kernel) {
        // First install the Howler plugin
        await HowlerAudioPlugin.init(kernel);

        // Then preload some sounds
        const audio = kernel.systems.get('audio');
        await audio.preloadSounds({
            'bgm': '/assets/music/background.mp3',
            'jump': '/assets/sfx/jump.wav',
            'coin': '/assets/sfx/coin.wav',
            'powerup': '/assets/sfx/powerup.wav'
        });

        // Play background music on loop
        audio.play('bgm', { loop: true, volume: 0.5 });
    }
};
