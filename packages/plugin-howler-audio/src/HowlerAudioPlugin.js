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

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const CURVES = {
    linear: (k) => k,
    smoothstep: (k) => k * k * (3 - 2 * k),
};

const defaultClock = () => {
    const raf = typeof requestAnimationFrame === 'function';
    return {
        now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        request: (fn) => (raf ? requestAnimationFrame(fn) : setTimeout(fn, 16)),
        cancel: (handle) => (raf ? cancelAnimationFrame(handle) : clearTimeout(handle)),
    };
};

class HowlerSound {
    constructor(options) {
        const opts = options !== null && typeof options === 'object' ? options : {};
        // A Map, so a key such as "__proto__" is only ever a key.
        this.sounds = new Map();
        this._volume = 1;
        this._muted = false;
        this._destroyed = false;

        // Music channel state. Tracks are kept apart from `sounds`.
        this.tracks = new Map();
        this._clock = opts.clock && typeof opts.clock.now === 'function' ? opts.clock : defaultClock();
        this._fades = new Set();
        this._frame = null;
        this._musicVolume = 1;
        this._effectsVolume = 1;
        this._duck = 1;
        this._duckFade = null;
        this._muteGain = 1;
        this._muteFade = null;
        this._crossfade = null;

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
        for (const fade of [...this._fades]) fade.cancel();
        for (const track of this.tracks.values()) track.howl.unload();
        this.tracks.clear();
        for (const howl of this.sounds.values()) howl.unload();
        this.sounds.clear();
    }

    /**
     * Adds a looping track. It never starts by itself.
     * @param {string} key
     * @param {string|string[]} source One file URL or a list of formats.
     * @param {{ volume?: number }} [options]
     */
    registerTrack(key, source, options = {}) {
        if (this._destroyed || typeof key !== 'string' || key === '') return;
        const list = (Array.isArray(source) ? source : [source]).filter((u) => typeof u === 'string' && u !== '');
        if (list.length === 0) return;
        const old = this.tracks.get(key);
        if (old) {
            old.fade?.cancel();
            old.howl.unload();
        }
        const base = Number.isFinite(options.volume) ? clamp01(options.volume) : 1;
        const track = { howl: null, base, gain: 1, playing: false, id: undefined, fade: null };
        track.howl = new Howl({ src: list, loop: true, volume: 0, mute: this._muted });
        this.tracks.set(key, track);
        this._apply(track);
    }

    /**
     * Starts or resumes a track. A track that was paused continues from where it
     * stopped. Only the first play starts at the beginning.
     * @param {string} key
     * @param {{ fadeIn?: number, curve?: 'linear'|'smoothstep' }} [options]
     */
    playTrack(key, options = {}) {
        const track = this._track(key);
        if (!track) return;
        const ms = Number.isFinite(options.fadeIn) ? options.fadeIn : 0;
        const wasPlaying = track.playing;
        track.fade?.cancel();
        if (!wasPlaying) {
            track.gain = ms > 0 ? 0 : 1;
            this._apply(track);
            this._start(track);
        } else if (ms <= 0) {
            track.gain = 1;
            this._apply(track);
        }
        if (ms > 0) this._fadeTrack(track, 1, ms, options.curve);
    }

    /** Fades a track to silence, then pauses it. The position is kept. */
    fadeOutTrack(key, ms, curve) {
        const track = this._track(key);
        if (!track || !track.playing) return;
        this._fadeOut(track, ms, curve);
    }

    /**
     * Fades `from` out and `to` in. A second call cancels the first.
     * @param {string} from
     * @param {string} to
     * @param {{ out: number, in: number, inIfPlaying?: number, curve?: string }} options
     */
    crossfade(from, to, options = {}) {
        if (this._destroyed) return;
        const next = this._track(to);
        if (!next || from === to) return;
        const prev = this._crossfade;
        this._crossfade = null;
        if (prev) {
            prev.fades.forEach((fade) => fade.cancel());
            const outgoing = this.tracks.get(prev.from);
            const incoming = this.tracks.get(prev.to);
            if (outgoing && prev.from !== to && prev.from !== from) this._pause(outgoing);
            if (incoming && prev.to !== from && prev.to !== to && incoming.playing) {
                this._fadeOut(incoming, options.out, options.curve);
            }
        }
        const fades = [];
        const outgoing = this._track(from);
        if (outgoing && outgoing.playing) fades.push(this._fadeOut(outgoing, options.out, options.curve));
        const inMs = next.playing && Number.isFinite(options.inIfPlaying) ? options.inIfPlaying : options.in;
        next.fade?.cancel();
        if (!next.playing) {
            next.gain = 0;
            this._apply(next);
            this._start(next);
        }
        fades.push(this._fadeTrack(next, 1, inMs, options.curve));
        this._crossfade = { from, to, fades: fades.filter(Boolean) };
    }

    /** Fades the music down to `level` (0 to 1 of its normal volume). */
    duckMusic(level, ms) {
        if (!Number.isFinite(level)) return;
        this._duckFade?.cancel();
        this._duckFade = this._fade(this._duck, clamp01(level), ms, 'smoothstep', (v) => {
            this._duck = v;
            this._applyAll();
        });
    }

    unduck(ms) {
        this.duckMusic(1, ms);
    }

    setMusicVolume(value) {
        if (!Number.isFinite(value)) return this._musicVolume;
        this._musicVolume = clamp01(value);
        this._applyAll();
        return this._musicVolume;
    }

    getMusicVolume() {
        return this._musicVolume;
    }

    /** Sets the volume of the sounds added with `register`. Tracks are not touched. */
    setEffectsVolume(value) {
        if (!Number.isFinite(value)) return this._effectsVolume;
        this._effectsVolume = clamp01(value);
        for (const howl of this.sounds.values()) howl.volume(this._effectsVolume);
        return this._effectsVolume;
    }

    getEffectsVolume() {
        return this._effectsVolume;
    }

    /** Fades the music out without pausing it, so it keeps its place. */
    muteMusic(fadeMs = 0) {
        this._fadeMute(0, fadeMs);
    }

    unmuteMusic(fadeMs = 0) {
        this._fadeMute(1, fadeMs);
    }

    /** Seconds into the track, 0 for an unknown key. */
    getTrackPosition(key) {
        const track = this.tracks.get(key);
        if (!track) return 0;
        const pos = track.howl.seek();
        return typeof pos === 'number' && Number.isFinite(pos) ? pos : 0;
    }

    _track(key) {
        if (this._destroyed || typeof key !== 'string') return undefined;
        return this.tracks.get(key);
    }

    _start(track) {
        track.id = track.id === undefined ? track.howl.play() : track.howl.play(track.id);
        track.playing = true;
    }

    _pause(track) {
        track.fade?.cancel();
        track.fade = null;
        track.howl.pause();
        track.playing = false;
    }

    _apply(track) {
        track.howl.volume(track.base * track.gain * this._musicVolume * this._duck * this._muteGain);
    }

    _applyAll() {
        for (const track of this.tracks.values()) this._apply(track);
    }

    _fadeTrack(track, to, ms, curve, onDone) {
        track.fade?.cancel();
        const fade = this._fade(track.gain, to, ms, curve, (v) => {
            track.gain = v;
            this._apply(track);
        }, () => {
            if (track.fade?.done) track.fade = null;
            onDone?.();
        });
        if (!fade.done) track.fade = fade;
        return fade;
    }

    _fadeOut(track, ms, curve) {
        return this._fadeTrack(track, 0, ms, curve, () => this._pause(track));
    }

    _fadeMute(to, ms) {
        this._muteFade?.cancel();
        this._muteFade = this._fade(this._muteGain, to, ms, 'linear', (v) => {
            this._muteGain = v;
            this._applyAll();
        });
    }

    /**
     * Runs `apply(value)` from `from` to `to` over `ms`. A fade of zero length
     * applies at once. `cancel()` stops it without calling `onDone`.
     */
    _fade(from, to, ms, curve, apply, onDone) {
        const shape = Object.prototype.hasOwnProperty.call(CURVES, curve) ? CURVES[curve] : CURVES.smoothstep;
        const fade = {
            done: false,
            cancel: () => {
                fade.done = true;
                this._fades.delete(fade);
                if (this._fades.size === 0 && this._frame !== null) {
                    this._clock.cancel(this._frame);
                    this._frame = null;
                }
            },
        };
        if (!Number.isFinite(ms) || ms <= 0) {
            fade.done = true;
            apply(to);
            onDone?.();
            return fade;
        }
        const start = this._clock.now();
        fade.step = (now) => {
            const k = Math.min(1, (now - start) / ms);
            apply(from + (to - from) * (k >= 1 ? 1 : shape(k)));
            if (k < 1) return;
            fade.done = true;
            this._fades.delete(fade);
            onDone?.();
        };
        this._fades.add(fade);
        this._pump();
        return fade;
    }

    _pump() {
        if (this._frame !== null || this._fades.size === 0) return;
        this._frame = this._clock.request(() => {
            this._frame = null;
            const now = this._clock.now();
            for (const fade of [...this._fades]) if (!fade.done) fade.step(now);
            this._pump();
        });
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
