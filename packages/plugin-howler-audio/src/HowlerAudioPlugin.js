/**
 * Howler.js Audio Plugin for DopamineJS
 * Requires: npm install howler
 */

import { Howl, Howler } from 'howler';

class HowlerAudioSystem {
    constructor() {
        this.sounds = new Map();
        this.kernel = null;
        this.muted = false;
        this.volume = 1.0;
    }

    init(kernel) {
        this.kernel = kernel;
        console.log('[HowlerAudio] Initialized');
    }

    destroy() {
        for (const howl of this.sounds.values()) {
            howl.unload();
        }
        this.sounds.clear();
    }

    register(key, options = {}) {
        const url = options.src || options.url;
        if (!url) return;
        this.registerSound(key, url);
    }

    registerSound(key, url) {
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
                howl.once('load', resolve);
                howl.once('loaderror', resolve);
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
        if (options.volume !== undefined) howl.volume(options.volume, id);
        if (options.loop !== undefined) howl.loop(options.loop, id);
        if (options.rate !== undefined) howl.rate(options.rate, id);
        return id;
    }

    stop(key) {
        const howl = this.sounds.get(key);
        if (howl) howl.stop();
    }

    toggleMute() {
        this.muted = !this.muted;
        Howler.mute(this.muted);
        return this.muted;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        Howler.volume(this.volume);
    }
}

export const HowlerAudioPlugin = {
    name: 'howler-audio',
    version: '1.0.0',

    init(kernel) {
        console.log('[HowlerAudioPlugin] Installing Howler.js audio system...');

        if (kernel.systems.has('audio')) {
            kernel.systems.unregister('audio');
        }

        kernel.systems.register('audio', new HowlerAudioSystem(), { priority: 70 });
        console.log('[HowlerAudioPlugin] Howler.js audio system installed');
    },

    destroy() {
        console.log('[HowlerAudioPlugin] Uninstalled');
    }
};
