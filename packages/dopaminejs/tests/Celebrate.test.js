/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { celebrate, destroyCelebrations } from '../src/celebrate.js';
import { ParticleSystem } from '../src/dopamine/effects/ParticleSystem.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';
import { RewardUI } from '../src/dopamine/ui/RewardUI.js';

const PRESETS = [
    ['complete', 'Complete!', '\u{2705}', 'achievement', 40],
    ['milestone', 'Milestone reached', '\u{1F3C1}', 'level_up', 60],
    ['streak', 'Streak kept', '\u{1F525}', 'achievement', 40],
    ['certificate', 'Certificate earned', '\u{1F393}', 'level_up', 80]
];

describe('celebrate', () => {
    let burst;
    let play;
    let particleDestroy;
    let soundDestroy;
    let errors;
    const realMatchMedia = window.matchMedia;
    const realGetContext = HTMLCanvasElement.prototype.getContext;
    const centre = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const toasts = () => document.querySelectorAll('.dopamine-celebrate-toast');
    const reduceMotion = () => {
        window.matchMedia = vi.fn((query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    };
    const fakeParts = () => ({
        ui: { popup: vi.fn() },
        particles: { burst: vi.fn() },
        sound: { play: vi.fn() }
    });

    beforeEach(() => {
        // jsdom has no canvas, so the real ParticleSystem constructor needs a context.
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
            fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(),
            lineTo: vi.fn(), closePath: vi.fn(), drawImage: vi.fn(), scale: vi.fn(), setTransform: vi.fn()
        }));
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        burst = vi.spyOn(ParticleSystem.prototype, 'burst').mockImplementation(() => {});
        play = vi.spyOn(SoundManager.prototype, 'play').mockResolvedValue(undefined);
        particleDestroy = vi.spyOn(ParticleSystem.prototype, 'destroy');
        soundDestroy = vi.spyOn(SoundManager.prototype, 'destroy');
        errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        destroyCelebrations();
        window.matchMedia = realMatchMedia;
        HTMLCanvasElement.prototype.getContext = realGetContext;
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it.each(PRESETS)('each preset shows its toast, confetti and sound: %s', (name, title, icon, sound, count) => {
        celebrate(name);

        expect(errors).not.toHaveBeenCalled();
        expect(toasts()).toHaveLength(1);
        expect(toasts()[0].textContent).toBe(`${icon}${title}`);
        expect(burst).toHaveBeenCalledTimes(1);
        expect(burst).toHaveBeenCalledWith('confetti', centre(), { count });
        expect(play).toHaveBeenCalledTimes(1);
        expect(play).toHaveBeenCalledWith(sound);
    });

    it('parts sends the toast, confetti and sound through the host', () => {
        const parts = fakeParts();
        expect(celebrate('milestone', { parts })).toBeUndefined();

        expect(parts.ui.popup).toHaveBeenCalledWith({
            kind: 'custom', title: 'Milestone reached', body: undefined, icon: '\u{1F3C1}', burst: false
        });
        expect(parts.particles.burst).toHaveBeenCalledWith('confetti', centre(), { count: 60 });
        expect(parts.sound.play).toHaveBeenCalledWith('level_up');
        expect(document.querySelector('.dopamine-celebrate-toast')).toBeNull();
        expect(document.querySelector('#dopamine-celebrate-canvas')).toBeNull();
        expect(burst).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
    });

    describe('with the real RewardUI in parts', () => {
        let ui;
        let particles;

        beforeEach(() => {
            vi.useFakeTimers();
            particles = { burst: vi.fn() };
            ui = new RewardUI({ particles });
        });

        afterEach(() => ui.destroy());

        it('the card adds no second burst, so the fake burst runs exactly once', () => {
            celebrate('complete', { parts: { ui, particles, sound: { play: vi.fn() } } });
            vi.advanceTimersByTime(400);

            expect(particles.burst).toHaveBeenCalledTimes(1);
        });

        it('under reduced motion the fake burst runs zero times', () => {
            reduceMotion();
            celebrate('complete', { parts: { ui, particles, sound: { play: vi.fn() } } });
            vi.advanceTimersByTime(400);

            expect(particles.burst).not.toHaveBeenCalled();
        });
    });

    it('title, body and icon replace the preset values', () => {
        celebrate('complete', { title: 'Lesson 3 done', body: 'Nice work', icon: 'X' });

        expect(toasts()[0].textContent).toBe('XLesson 3 doneNice work');
    });

    it('sound false plays nothing', () => {
        celebrate('complete', { sound: false });

        expect(play).not.toHaveBeenCalled();
        expect(toasts()).toHaveLength(1);
    });

    it('a sound key plays that key', () => {
        celebrate('complete', { sound: 'click' });

        expect(play).toHaveBeenCalledWith('click');
    });

    it('target centres the confetti on the element', () => {
        const target = { getBoundingClientRect: () => ({ left: 100, top: 200, width: 50, height: 20 }) };
        celebrate('complete', { target });

        expect(burst).toHaveBeenCalledWith('confetti', { x: 125, y: 210 }, { count: 40 });
    });

    it('a zero-size target falls back to the viewport centre', () => {
        const target = { getBoundingClientRect: () => ({ left: 100, top: 200, width: 0, height: 0 }) };
        celebrate('complete', { target });

        expect(burst).toHaveBeenCalledWith('confetti', centre(), { count: 40 });
    });

    it('a target without getBoundingClientRect falls back to the viewport centre', () => {
        celebrate('complete', { target: {} });

        expect(burst).toHaveBeenCalledWith('confetti', centre(), { count: 40 });
    });

    it('reduced motion makes no particle call and still shows the toast, standalone', () => {
        reduceMotion();
        celebrate('complete');

        expect(burst).not.toHaveBeenCalled();
        expect(toasts()).toHaveLength(1);
        expect(play).toHaveBeenCalledTimes(1);
    });

    it('reduced motion makes no particle call and still shows the toast, through parts', () => {
        reduceMotion();
        const parts = fakeParts();
        celebrate('complete', { parts });

        expect(parts.particles.burst).not.toHaveBeenCalled();
        expect(parts.ui.popup).toHaveBeenCalledTimes(1);
        expect(parts.sound.play).toHaveBeenCalledTimes(1);
    });

    it('title and body are rendered as text', () => {
        const bad = '<img src=x onerror=alert(1)>';
        celebrate('complete', { title: bad, body: bad });

        expect(toasts()[0].textContent).toContain(bad);
        expect(toasts()[0].textContent).toBe(`\u{2705}${bad}${bad}`);
        expect(document.querySelector('img')).toBeNull();
    });

    it('a string icon is text', () => {
        celebrate('complete', { icon: '<img src=x onerror=alert(1)>' });

        expect(document.querySelector('img')).toBeNull();
        expect(toasts()[0].textContent).toContain('<img src=x onerror=alert(1)>');
    });

    it('a Node icon is appended as is', () => {
        const icon = document.createElement('span');
        icon.className = 'mine';
        celebrate('complete', { icon });

        expect(toasts()[0].querySelector('.mine')).toBe(icon);
    });

    it('the toast is a polite status region', () => {
        celebrate('complete');

        expect(toasts()[0].getAttribute('role')).toBe('status');
        expect(toasts()[0].getAttribute('aria-live')).toBe('polite');
    });

    it('a second call replaces the toast', () => {
        celebrate('complete', { title: 'First' });
        celebrate('complete', { title: 'Second' });

        expect(toasts()).toHaveLength(1);
        expect(toasts()[0].textContent).toContain('Second');
        expect(toasts()[0].textContent).not.toContain('First');
    });

    it('the toast is removed after 3000 ms', () => {
        vi.useFakeTimers();
        celebrate('complete');
        vi.advanceTimersByTime(2999);
        expect(toasts()).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(toasts()).toHaveLength(0);
    });

    it('a second call clears the first timer', () => {
        vi.useFakeTimers();
        celebrate('complete');
        vi.advanceTimersByTime(2000);
        celebrate('streak');
        vi.advanceTimersByTime(2000);

        expect(toasts()).toHaveLength(1);
        expect(vi.getTimerCount()).toBe(1);
    });

    it('standalone uses its own canvas id, not the host canvas', () => {
        celebrate('complete');

        expect(document.querySelector('#dopamine-celebrate-canvas')).not.toBeNull();
        expect(document.querySelector('#dopamine-particle-canvas')).toBeNull();
    });

    it('destroyCelebrations removes the toast, the canvas and the timer', () => {
        vi.useFakeTimers();
        celebrate('complete');
        expect(document.querySelector('#dopamine-celebrate-canvas')).not.toBeNull();

        destroyCelebrations();

        expect(toasts()).toHaveLength(0);
        expect(document.querySelector('#dopamine-celebrate-canvas')).toBeNull();
        // jsdom queues a 0 ms storage event for each localStorage write, and SoundManager writes
        // once to probe it. Run those; a toast timer that destroy missed is still 3000 ms out.
        vi.advanceTimersByTime(1);
        expect(vi.getTimerCount()).toBe(0);
        expect(particleDestroy).toHaveBeenCalledTimes(1);
        expect(soundDestroy).toHaveBeenCalledTimes(1);

        celebrate('streak');
        expect(toasts()).toHaveLength(1);
    });

    it('destroyCelebrations twice does not throw', () => {
        celebrate('complete');

        expect(() => { destroyCelebrations(); destroyCelebrations(); }).not.toThrow();
    });

    it('destroyCelebrations before any call does not throw', () => {
        expect(() => destroyCelebrations()).not.toThrow();
    });

    it.each(['nope', '__proto__', 'toString', 'constructor'])('an unknown preset does nothing: %s', (name) => {
        const parts = fakeParts();
        expect(() => celebrate(name)).not.toThrow();
        celebrate(name, { parts });

        expect(toasts()).toHaveLength(0);
        expect(burst).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
        expect(parts.ui.popup).not.toHaveBeenCalled();
    });

    it('inherited options are ignored', () => {
        const parts = fakeParts();
        celebrate('complete', Object.create({ title: 'x', parts }));

        expect(toasts()[0].textContent).toContain('Complete!');
        expect(parts.ui.popup).not.toHaveBeenCalled();
        expect(burst).toHaveBeenCalledTimes(1);
    });

    it('a throwing part is logged, not thrown', () => {
        const boom = new Error('boom');
        const parts = fakeParts();
        parts.ui.popup.mockImplementation(() => { throw boom; });
        parts.particles.burst.mockImplementation(() => { throw boom; });

        expect(() => celebrate('complete', { parts })).not.toThrow();
        expect(errors).toHaveBeenCalledTimes(2);
        expect(errors).toHaveBeenCalledWith(boom);
        expect(parts.sound.play).toHaveBeenCalledTimes(1);
    });

    it('a rejected sound is logged', async () => {
        const boom = new Error('no audio');
        const parts = fakeParts();
        parts.sound.play.mockReturnValue(Promise.reject(boom));
        celebrate('complete', { parts });
        await Promise.resolve();
        await Promise.resolve();

        expect(errors).toHaveBeenCalledWith(boom);
    });

    it('without a DOM celebrate does nothing', () => {
        vi.stubGlobal('document', undefined);

        expect(() => celebrate('complete')).not.toThrow();
        vi.unstubAllGlobals();

        expect(burst).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
        expect(toasts()).toHaveLength(0);
    });

    it('the main entry does not import the celebrate subpath', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const seen = new Set();
        const walk = (file) => {
            if (seen.has(file)) return;
            seen.add(file);
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/(?:from|import)\s+['"](\.[^'"]+\.js)['"]/g)) {
                walk(resolve(dirname(file), match[1]));
            }
        };
        walk(resolve(here, '../src/index.js'));
        const names = [...seen].map((file) => file.slice(resolve(here, '../src').length));

        expect(names).not.toContain('/celebrate.js');
    });
});
