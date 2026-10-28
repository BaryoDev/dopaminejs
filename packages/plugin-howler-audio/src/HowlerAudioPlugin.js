/**
 * Howler.js as the sound part. Pass it as the `sound` option:
 *
 *   createDopamine({ sound: howlerSound({ sounds: { xp: '/xp.mp3' } }) });
 *
 * Needs: npm install howler
 */

import { Howl, Howler } from 'howler';

const NOOP = () => {};

const urlOf = (source) => {
    if (typeof source === 'string') return source;
    if (source !== null && typeof source === 'object') return source.src || source.url || '';
    return '';
};

class HowlerSound {
    constructor(options) {
        const opts = options !== null && typeof options === 'object' ? options : {};
        // A Map, so a key such as "__proto__" is only ever a key.
        this.sounds = new Map();
        this._volume = 1;
        this._muted = false;
        this._destroyed = false;

        if (opts.volume !== undefined) this.setVolume(opts.volume);
        if (opts.muted === true) this.setMuted(true);
        if (opts.sounds !== null && typeof opts.sounds === 'object') {
            for (const [key, source] of Object.entries(opts.sounds)) this.register(key, source);
        }
    }

    /**
     * Adds a key. A string is a file URL, an object takes `src` or `url`.
     * @returns {() => void} Removes the key.
     */
    register(key, source) {
        const url = urlOf(source);
        if (this._destroyed || typeof key !== 'string' || key === '' || url === '') return NOOP;
        this.sounds.get(key)?.unload();
        const howl = new Howl({ src: [url], volume: this._volume, mute: this._muted });
        this.sounds.set(key, howl);
        return () => {
            if (this.sounds.get(key) !== howl) return;
            howl.unload();
            this.sounds.delete(key);
        };
    }

    /** Registers many keys and resolves once each has loaded or failed. */
    preloadSounds(soundMap) {
        const pending = Object.entries(soundMap || {}).map(([key, source]) => new Promise((resolve) => {
            this.register(key, source);
            const howl = this.sounds.get(key);
            if (!howl) return resolve();
            howl.once('load', resolve);
            howl.once('loaderror', resolve);
        }));
        return Promise.all(pending).then(() => undefined);
    }

    /**
     * An unknown key does nothing.
     * @param {string} key
     * @param {{ volume?: number, loop?: boolean, rate?: number }} [options]
     * @returns {number|undefined} The Howler play id.
     */
    play(key, options = {}) {
        if (this._destroyed || typeof key !== 'string') return undefined;
        const howl = this.sounds.get(key);
        if (!howl) return undefined;
        const id = howl.play();
        if (options.volume !== undefined) howl.volume(options.volume, id);
        if (options.loop !== undefined) howl.loop(options.loop, id);
        if (options.rate !== undefined) howl.rate(options.rate, id);
        return id;
    }

    stop(key) {
        this.sounds.get(key)?.stop();
    }

    setVolume(value) {
        if (!Number.isFinite(value)) return this._volume;
        this._volume = Math.max(0, Math.min(1, value));
        Howler.volume(this._volume);
        return this._volume;
    }

    getVolume() {
        return this._volume;
    }

    setMuted(muted) {
        this._muted = muted === true;
        Howler.mute(this._muted);
        return this._muted;
    }

    isMuted() {
        return this._muted;
    }

    toggleMute() {
        return this.setMuted(!this._muted);
    }

    /** Howler unlocks audio itself, so this adds nothing. It returns a disposer to match SoundManager. */
    unlockOn() {
        return NOOP;
    }

    destroy() {
        this._destroyed = true;
        for (const howl of this.sounds.values()) howl.unload();
        this.sounds.clear();
    }
}

/**
 * @param {Object} [options]
 * @param {Object<string, string|{src: string}>} [options.sounds] - key to file
 * @param {number} [options.volume=1] - 0 to 1
 * @param {boolean} [options.muted=false]
 * @returns {HowlerSound} A sound part.
 */
export function howlerSound(options) {
    return new HowlerSound(options);
}
