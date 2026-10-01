/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Ticker } from '../src/systems/Ticker.js';
import { Physics } from '../src/systems/Physics.js';
import { Director } from '../src/systems/Director.js';
import { EventBus } from '../src/core/EventBus.js';
import { SystemRegistry } from '../src/core/SystemRegistry.js';
import { PluginRegistry } from '../src/core/PluginRegistry.js';
import { Scene } from '../src/core/Scene.js';
import { GameObject } from '../src/core/GameObject.js';
import { Component } from '../src/core/Component.js';
import { Collider } from '../src/core/Collider.js';
import { ScreenShake } from '../src/dopamine/components/ScreenShake.js';
import { ParticleSystem } from '../src/dopamine/effects/ParticleSystem.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const makeKernel = () => {
    const kernel = { events: new EventBus() };
    kernel.systems = new SystemRegistry(kernel);
    kernel.plugins = new PluginRegistry(kernel);
    return kernel;
};

describe('engine loop error isolation', () => {
    let error;

    beforeEach(() => {
        error = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        error.mockRestore();
        vi.unstubAllGlobals();
    });

    it('should keep the ticker running after a callback throws', () => {
        const frames = [];
        vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => {});

        const ticker = new Ticker();
        const healthy = vi.fn();
        ticker.add(() => { throw new Error('boom'); });
        ticker.add(healthy);
        ticker.start();

        frames.shift()(performance.now() + 16);
        expect(healthy).toHaveBeenCalledTimes(1);
        expect(frames.length).toBe(1);

        frames.shift()(performance.now() + 32);
        expect(healthy).toHaveBeenCalledTimes(2);
        expect(error).toHaveBeenCalledTimes(1);

        ticker.stop();
    });

    it('should never hand callbacks a negative dt', () => {
        const frames = [];
        vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => {});

        const ticker = new Ticker();
        const seen = [];
        ticker.add((dt) => seen.push(dt));
        ticker.start();

        // A frame timestamp can predate the performance.now() taken in start().
        frames.shift()(ticker.lastTime - 5);

        expect(seen).toEqual([0]);
        ticker.stop();
    });

    it('should keep updating other systems when one throws', () => {
        const kernel = makeKernel();
        const after = { update: vi.fn(), fixedUpdate: vi.fn() };
        const bad = {
            update() { throw new Error('boom'); },
            fixedUpdate() { throw new Error('boom'); }
        };

        kernel.systems.register('bad', bad, { priority: 10 });
        kernel.systems.register('after', after, { priority: 1 });

        kernel.systems.update(0.016);
        kernel.systems.update(0.016);
        kernel.systems.fixedUpdate(0.016);

        expect(after.update).toHaveBeenCalledTimes(2);
        expect(after.fixedUpdate).toHaveBeenCalledTimes(1);
        // Logged once per system, not once per frame.
        expect(error).toHaveBeenCalledTimes(1);
    });
});

describe('plugin registry failure cleanup', () => {
    let error;

    beforeEach(() => {
        error = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => error.mockRestore());

    it('should drop the failed plugin from the load order, not the last one', async () => {
        const kernel = makeKernel();
        let rejectSlow;
        const slow = {
            name: 'slow',
            init: () => new Promise((_, reject) => { rejectSlow = reject; })
        };

        const pending = kernel.plugins.useAsync(slow);
        await kernel.plugins.useAsync({ name: 'fine', init: async () => {} });

        rejectSlow(new Error('no network'));
        await expect(pending).rejects.toThrow('no network');

        expect(kernel.plugins.getLoadOrder()).toEqual(['fine']);
        expect(kernel.plugins.getPluginNames()).toEqual(['fine']);
    });

    it('should unregister systems a failed plugin registered', () => {
        const kernel = makeKernel();
        const destroy = vi.fn();

        expect(() => kernel.plugins.use({
            name: 'half',
            init(k) {
                k.systems.register('orphan', { update() {}, destroy });
                throw new Error('missing config');
            }
        })).toThrow('missing config');

        expect(kernel.systems.has('orphan')).toBe(false);
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(kernel.plugins.getLoadOrder()).toEqual([]);
    });

    it('should report the init error when a leftover system fails to destroy', () => {
        const kernel = makeKernel();

        expect(() => kernel.plugins.use({
            name: 'half',
            init(k) {
                k.systems.register('broken', { destroy() { throw new Error('half built'); } });
                k.systems.register('orphan', { update() {} });
                throw new Error('missing config');
            }
        })).toThrow('missing config');

        expect(kernel.systems.getSystemNames()).toEqual([]);
    });

    it('should unregister systems a failed async plugin registered', async () => {
        const kernel = makeKernel();

        await expect(kernel.plugins.useAsync({
            name: 'half',
            async init(k) {
                k.systems.register('orphan', { update() {} });
                throw new Error('no network');
            }
        })).rejects.toThrow('no network');

        expect(kernel.systems.has('orphan')).toBe(false);
    });

    it('should leave the systems of another plugin alone when an async init fails', async () => {
        const kernel = makeKernel();
        let rejectSlow;
        const pending = kernel.plugins.useAsync({
            name: 'slow',
            init(k) {
                k.systems.register('slow-system', { update() {} });
                return new Promise((_, reject) => { rejectSlow = reject; });
            }
        });

        await kernel.plugins.useAsync({
            name: 'fine',
            async init(k) { k.systems.register('fine-system', { update() {} }); }
        });
        kernel.plugins.use({
            name: 'sync',
            init(k) { k.systems.register('sync-system', { update() {} }); }
        });

        rejectSlow(new Error('no network'));
        await expect(pending).rejects.toThrow('no network');

        expect(kernel.systems.getSystemNames().sort()).toEqual(['fine-system', 'sync-system']);
    });
});

describe('scene and components', () => {
    class Recorder extends Component {
        constructor(name, log, onUpdate) {
            super();
            this.name = name;
            this.log = log;
            this.onUpdate = onUpdate;
            this.attached = 0;
            this.detached = 0;
        }
        onAttach() { this.attached++; }
        onDetach() { this.detached++; }
        update() {
            this.log.push(this.name);
            this.onUpdate?.();
        }
    }

    const objectWith = (component) => {
        const object = new GameObject();
        object.addComponent(component);
        return object;
    };

    it('should update every object when one removes itself mid-frame', () => {
        const scene = new Scene();
        const log = [];
        const a = objectWith(new Recorder('a', log, () => scene.remove(a)));
        const b = objectWith(new Recorder('b', log));
        const c = objectWith(new Recorder('c', log));
        [a, b, c].forEach((object) => scene.add(object));

        scene.update(0.016);

        expect(log).toEqual(['a', 'b', 'c']);
    });

    it('should not update an object removed earlier in the same frame', () => {
        const scene = new Scene();
        const log = [];
        const b = objectWith(new Recorder('b', log));
        const a = objectWith(new Recorder('a', log, () => scene.remove(b)));
        scene.add(a);
        scene.add(b);

        scene.update(0.016);

        expect(log).toEqual(['a']);
    });

    it('should detach components on remove and attach them again on re-add', () => {
        const scene = new Scene();
        const recorder = new Recorder('a', []);
        const child = new Recorder('child', []);
        const object = objectWith(recorder);
        object.addChild(objectWith(child));
        scene.add(object);

        scene.remove(object);
        expect(recorder.detached).toBe(1);
        expect(child.detached).toBe(1);

        scene.add(object);
        expect(recorder.attached).toBe(2);
        expect(child.attached).toBe(2);
    });

    it('should register a collider that was attached before the scene had a kernel', () => {
        const kernel = makeKernel();
        const physics = new Physics();
        kernel.systems.register('physics', physics);

        const collider = new Collider('box', 10, 10);
        const object = objectWith(collider);
        const scene = new Scene();
        scene.add(object);

        expect(physics.colliders).toEqual([]);

        scene.kernel = kernel;
        expect(physics.colliders).toEqual([collider]);

        scene.remove(object);
        expect(physics.colliders).toEqual([]);

        scene.add(object);
        expect(physics.colliders).toEqual([collider]);
    });

    it('should take the colliders of the old scene out of physics on a scene change', () => {
        const kernel = makeKernel();
        const physics = new Physics();
        kernel.systems.register('physics', physics);
        const director = new Director({ kernel });

        const collider = new Collider('box', 10, 10);
        const menu = new Scene();
        menu.add(objectWith(collider));

        director.run(menu);
        expect(physics.colliders).toEqual([collider]);

        director.run(new Scene());
        expect(physics.colliders).toEqual([]);

        director.run(menu);
        expect(physics.colliders).toEqual([collider]);
    });

    it('should return to the resting position after overlapping shakes', () => {
        const shake = new ScreenShake();
        const object = new GameObject(100, 100);
        object.addComponent(shake);

        shake.shake(20, 0.2);
        shake.update(0.05);
        shake.shake(20, 0.2);
        shake.update(0.05);
        shake.update(0.3);

        expect([object.x, object.y]).toEqual([100, 100]);
    });
});

describe('particle system guards', () => {
    let particles;
    let warn;

    beforeEach(() => {
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            drawImage: vi.fn(),
            setTransform: vi.fn()
        }));
        // Frames are pumped by hand in these tests.
        vi.stubGlobal('requestAnimationFrame', () => 1);
        vi.stubGlobal('cancelAnimationFrame', () => {});
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        particles?.destroy();
        particles = null;
        warn.mockRestore();
        vi.unstubAllGlobals();
    });

    it('should not draw pooled star particles as stars in a later emit', () => {
        particles = new ParticleSystem();
        particles.starBurst(0, 0, 8);
        particles.clear();

        particles.confetti(0, 0, 8);

        expect(particles.particles.map((p) => p.type)).toEqual(Array(8).fill(null));
    });

    it('should fall back to the body when the container selector matches nothing', () => {
        particles = new ParticleSystem({ container: '#does-not-exist' });

        expect(particles.container).toBe(document.body);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should cap the number of live particles', () => {
        particles = new ParticleSystem({ maxParticles: 100 });

        particles.emit({ x: 0, y: 0, count: 1000000 });
        particles.starBurst(0, 0, 50);

        expect(particles.particles.length).toBe(100);
    });

    it('should round a fractional cap down', () => {
        particles = new ParticleSystem({ maxParticles: 0.5 });

        particles.emit({ x: 0, y: 0, count: 1 });

        expect(particles.particles.length).toBe(0);
    });

    it('should spread a capped star burst around the full circle', () => {
        particles = new ParticleSystem({ maxParticles: 4 });

        particles.starBurst(0, 0, 100);

        const angles = particles.particles.map((p) => p.rotation);
        expect(angles).toEqual([0, 1, 2, 3].map((i) => (Math.PI * 2 / 4) * i));
    });

    it('should ignore a count that is not a number', () => {
        particles = new ParticleSystem();

        particles.emit({ x: 0, y: 0, count: Infinity });
        particles.emit({ x: 0, y: 0, count: 'lots' });

        expect(particles.particles.length).toBe(0);
    });

    it('should move particles by elapsed time, not by frame count', () => {
        const travel = (frameMs) => {
            const system = new ParticleSystem();
            system.emit({ x: 0, y: 0, count: 1, speed: 0, gravity: 1, decay: 0, spread: 0 });
            const [p] = system.particles;
            p.vx = 2;

            // 100 ms of animation at the given frame interval.
            system._animate(1000);
            for (let t = frameMs; t <= 100; t += frameMs) {
                system._animate(1000 + t);
            }

            const x = p.x;
            system.destroy();
            return x;
        };

        // The first call has no previous timestamp and counts as one step.
        expect(travel(10)).toBeCloseTo(travel(20), 5);
    });

    it('should emit nothing when the user prefers reduced motion', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        particles = new ParticleSystem();

        particles.confetti(0, 0, 20);
        particles.starBurst(0, 0, 8);
        expect(particles.particles.length).toBe(0);

        particles.destroy();
        particles = new ParticleSystem({ respectReducedMotion: false });
        particles.confetti(0, 0, 20);
        expect(particles.particles.length).toBe(20);
    });
});

describe('sound manager guards', () => {
    class FakeAudioContext {
        constructor() {
            this.state = 'running';
            this.destination = {};
            this.currentTime = 0;
            this.close = vi.fn(() => Promise.resolve());
        }
        createGain() {
            return {
                connect: vi.fn(),
                gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
            };
        }
        createOscillator() {
            return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } };
        }
        createBufferSource() {
            return { connect: vi.fn(), start: vi.fn() };
        }
        decodeAudioData() {
            return Promise.resolve({ duration: 1 });
        }
    }

    let sound;
    let warn;

    beforeEach(() => {
        window.AudioContext = FakeAudioContext;
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        sound = new SoundManager({ storage: createMemoryStorage() });
    });

    afterEach(() => {
        warn.mockRestore();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('should not decode an error page as audio', async () => {
        const decode = vi.spyOn(FakeAudioContext.prototype, 'decodeAudioData');
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        })));
        sound.initAudio();

        await sound.loadSound('win', 'missing.mp3');

        expect(decode).not.toHaveBeenCalled();
        expect(sound.assets.has('win')).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        decode.mockRestore();
    });

    it('should keep the volume a number when given NaN', () => {
        sound.setVolume(0.4);

        expect(sound.setVolume(NaN)).toBe(0.4);
        expect(sound.setVolume('loud')).toBe(0.4);
    });

    it('should not treat inherited property names as registered sounds', async () => {
        vi.stubGlobal('fetch', vi.fn());

        await sound.play('constructor');
        await sound.play('toString');

        expect(fetch).not.toHaveBeenCalled();
    });

    it('should load sounds registered before the audio context existed', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        })));
        sound.registerSound('win', 'win.mp3');

        sound.initAudio();
        await sound.play('win');

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(sound.assets.has('win')).toBe(true);
    });

    it('should stay silent when destroyed while a sound is loading', async () => {
        let respond;
        vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { respond = resolve; })));
        sound.registerSound('score', 'score.mp3');

        const playing = sound.play('score');
        sound.destroy();
        respond({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
        await playing;

        expect(sound.audioContext).toBeNull();
    });

    it('should close the context and cancel queued tones on destroy', () => {
        vi.useFakeTimers();
        sound.playGameOver();
        const context = sound.audioContext;
        const tone = vi.spyOn(sound, 'playTone');

        sound.destroy();
        vi.runAllTimers();

        expect(context.close).toHaveBeenCalledTimes(1);
        expect(tone).not.toHaveBeenCalled();
        expect(sound.audioContext).toBeNull();
    });
});
