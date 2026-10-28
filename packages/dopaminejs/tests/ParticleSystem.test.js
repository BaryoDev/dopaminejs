/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParticleSystem } from '../src/dopamine/effects/ParticleSystem.js';

describe('ParticleSystem', () => {
    let particleSystem;
    let container;

    beforeEach(() => {
        // Mock canvas context
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            drawImage: vi.fn(),
            scale: vi.fn(),
            setTransform: vi.fn()
        }));

        // Mock requestAnimationFrame
        vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 0));
    });

    afterEach(() => {
        if (particleSystem) {
            particleSystem.clear();
            if (particleSystem.canvas && particleSystem.canvas.parentNode) {
                particleSystem.canvas.parentNode.removeChild(particleSystem.canvas);
            }
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.unstubAllGlobals();
    });

    it('should initialize with default config (full screen)', () => {
        particleSystem = new ParticleSystem();
        expect(particleSystem.container).toBe(document.body);
        expect(particleSystem.canvas.style.position).toBe('fixed');
    });

    it('should initialize with custom container', () => {
        container = document.createElement('div');
        container.id = 'game-container';
        document.body.appendChild(container);

        particleSystem = new ParticleSystem({ container: '#game-container' });

        expect(particleSystem.container).toBe(container);
        expect(particleSystem.canvas.style.position).toBe('absolute');
        expect(container.contains(particleSystem.canvas)).toBe(true);
    });

    it('should register and use sprites', () => {
        particleSystem = new ParticleSystem();
        particleSystem.registerSprite('coin', 'coin.png');

        expect(particleSystem.sprites.has('coin')).toBe(true);
    });

    it('should emit particles with custom config', () => {
        particleSystem = new ParticleSystem();
        particleSystem.emit({
            x: 100, y: 100,
            count: 5,
            color: '#ff0000'
        });

        expect(particleSystem.particles.length).toBe(5);
        expect(particleSystem.particles[0].color).toBe('#ff0000');
    });

    it('should register and play custom effects', () => {
        particleSystem = new ParticleSystem();
        const effectSpy = vi.fn();

        particleSystem.registerEffect('blood', effectSpy);
        particleSystem.play('blood', 50, 50, 'arg1');

        expect(effectSpy).toHaveBeenCalledWith(50, 50, 'arg1');
    });

    it('should give each instance its own canvas', () => {
        particleSystem = new ParticleSystem();
        const second = new ParticleSystem();

        expect(second.canvas).not.toBe(particleSystem.canvas);

        second.destroy();
    });

    it('should back the canvas with device pixels on a HiDPI screen', () => {
        vi.stubGlobal('devicePixelRatio', 2);
        vi.stubGlobal('innerWidth', 800);
        vi.stubGlobal('innerHeight', 600);

        particleSystem = new ParticleSystem();

        expect(particleSystem.canvas.width).toBe(1600);
        expect(particleSystem.canvas.height).toBe(1200);
        expect(particleSystem.canvas.style.width).toBe('800px');
        expect(particleSystem.canvas.style.height).toBe('600px');
    });

    it('should remove its canvas and resize listener on destroy', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        particleSystem = new ParticleSystem();
        const canvas = particleSystem.canvas;

        particleSystem.destroy();

        expect(canvas.parentNode).toBeNull();
        expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

        removeSpy.mockRestore();
        particleSystem = null;
    });

    it('should stop animating on destroy', () => {
        particleSystem = new ParticleSystem();
        particleSystem.emit({ x: 0, y: 0, count: 3 });
        expect(particleSystem.isAnimating).toBe(true);

        particleSystem.destroy();

        expect(particleSystem.isAnimating).toBe(false);
        particleSystem = null;
    });

    it('should recycle particles (object pooling)', () => {
        particleSystem = new ParticleSystem();

        // 1. Emit 1 particle
        particleSystem.emit({ x: 0, y: 0, count: 1, life: 0.1 }); // Short life
        const p1 = particleSystem.particles[0];

        // 2. Simulate animation frame where it dies
        // We manually trigger _animate logic or just wait
        // Let's force kill it
        p1.life = -1;
        particleSystem._animate();

        // It should be in the pool now
        expect(particleSystem.particles.length).toBe(0);
        expect(particleSystem.pool.length).toBe(1);
        expect(particleSystem.pool[0]).toBe(p1);

        // 3. Emit again
        particleSystem.emit({ x: 0, y: 0, count: 1 });

        // Should reuse the same object
        expect(particleSystem.particles[0]).toBe(p1);
        expect(particleSystem.pool.length).toBe(0);
    });

    it('makes no particles when the user asked for less motion, unless told to ignore it', () => {
        const original = window.matchMedia;
        window.matchMedia = vi.fn(() => ({ matches: true }));
        try {
            const calm = new ParticleSystem();
            calm.emit({ x: 0, y: 0, count: 5 });
            expect(calm.particles.length).toBe(0);
            expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
            calm.destroy();

            const loud = new ParticleSystem({ respectReducedMotion: false });
            loud.emit({ x: 0, y: 0, count: 5 });
            expect(loud.particles.length).toBe(5);
            loud.destroy();
        } finally {
            window.matchMedia = original;
        }
    });

    it('burst with an unknown kind is a no-op', () => {
        particleSystem = new ParticleSystem({ respectReducedMotion: false });
        particleSystem.burst('nope', { x: 1, y: 1 });
        particleSystem.burst(undefined);
        particleSystem.burst('constructor');
        expect(particleSystem.particles.length).toBe(0);
    });

    it('burst covers every kind', () => {
        particleSystem = new ParticleSystem({ respectReducedMotion: false });
        for (const kind of ['confetti', 'sparkle', 'fire', 'stars', 'coins']) {
            particleSystem.clear();
            particleSystem.burst(kind, { x: 10, y: 10 }, { count: 3 });
            expect(particleSystem.particles.length, kind).toBeGreaterThan(0);
        }
    });

    it('play accepts a position object', () => {
        particleSystem = new ParticleSystem({ respectReducedMotion: false });
        const effect = vi.fn();
        particleSystem.registerEffect('pop', effect);
        particleSystem.play('pop', { x: 5, y: 6 });
        particleSystem.play('pop', 7, 8, 'extra');
        expect(effect).toHaveBeenNthCalledWith(1, 5, 6);
        expect(effect).toHaveBeenNthCalledWith(2, 7, 8, 'extra');
    });
});
