/**
 * @vitest-environment jsdom
 *
 * jsdom has no WebGL. getContext is stubbed with a fake context that accepts
 * every call, the way ParticleSystem.test.js stubs the 2d canvas. The shaders,
 * the draw calls and the pixels were not checked, and no real browser was run.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webglParticles } from '../../plugin-webgl-particles/src/index.js';
import { conformance } from '../src/testing.js';

const env = { hasDom: true, reducedMotion: false };

const fakeGl = () => new Proxy({}, {
    get(target, prop) {
        if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => true;
        if (!(prop in target)) target[prop] = vi.fn();
        return target[prop];
    }
});

let frames;
let cancelled;

beforeEach(() => {
    frames = [];
    cancelled = [];
    HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeGl());
    vi.stubGlobal('requestAnimationFrame', (fn) => frames.push(fn));
    vi.stubGlobal('cancelAnimationFrame', (id) => cancelled.push(id));
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('webglParticles', () => {
    it('returns null without WebGL so the default renderer is used', () => {
        HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

        expect(webglParticles()(env)).toBeNull();
        expect(document.querySelector('canvas')).toBeNull();
    });

    it('returns null without a DOM', () => {
        expect(webglParticles()({ hasDom: false, reducedMotion: false })).toBeNull();
    });

    it('passes conformance.particles for every kind', async () => {
        const part = webglParticles()(env);
        for (const kind of ['confetti', 'sparkle', 'fire', 'stars', 'coins']) {
            part.burst(kind, { x: 5, y: 5 });
            expect(part.particleCount).toBeGreaterThan(0);
            part.clear();
        }
        part.burst('nope', { x: 5, y: 5 });
        part.burst('__proto__', { x: 5, y: 5 });
        part.burst('constructor');
        expect(part.particleCount).toBe(0);
        part.destroy();
    });

    it('owns its loop and stops it on destroy', () => {
        const part = webglParticles()(env);
        expect(frames).toHaveLength(0);

        part.burst('confetti', { x: 10, y: 10 }, { count: 5 });
        expect(frames).toHaveLength(1);

        frames.shift()(0);
        expect(frames).toHaveLength(1);

        part.destroy();
        expect(cancelled).toHaveLength(1);
        frames.shift()(16);
        expect(frames).toHaveLength(0);
        expect(document.querySelector('canvas')).toBeNull();
    });

    it('stops asking for frames once every particle has died', () => {
        const part = webglParticles()(env);
        part.burst('sparkle', { x: 10, y: 10 }, { count: 3 });
        let now = 0;
        for (let i = 0; i < 50 && frames.length > 0; i++) {
            now += 100;
            frames.shift()(now);
        }
        expect(part.particleCount).toBe(0);
        expect(frames).toHaveLength(0);
        part.destroy();
    });

    it('draws nothing under reduced motion', () => {
        const part = webglParticles()({ hasDom: true, reducedMotion: true });
        part.burst('confetti', { x: 1, y: 1 });
        expect(part.particleCount).toBe(0);
        part.destroy();
    });

    it('reads a hex color from the burst options', () => {
        const part = webglParticles()(env);
        part.burst('sparkle', { x: 1, y: 1 }, { count: 1, color: '#ff0000' });
        expect([...part.colors.slice(0, 3)]).toEqual([1, 0, 0]);
        part.destroy();
    });
});

conformance.particles(() => webglParticles()(env));
