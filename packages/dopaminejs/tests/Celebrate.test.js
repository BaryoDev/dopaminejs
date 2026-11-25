/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDopamine } from '../src/dopamine/host.js';
import { RewardUI } from '../src/dopamine/ui/RewardUI.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const PRESETS = [
    ['complete', 'Complete!', '\u{2705}', 'achievement', 40],
    ['milestone', 'Milestone reached', '\u{1F3C1}', 'level_up', 60],
    ['streak', 'Streak kept', '\u{1F525}', 'achievement', 40],
    ['certificate', 'Certificate earned', '\u{1F393}', 'level_up', 80]
];

describe('host.celebrate', () => {
    let hosts;
    let parts;
    let log;
    const realMatchMedia = window.matchMedia;

    const make = (extra = {}) => {
        const host = createDopamine({
            storage: createMemoryStorage(), ui: parts.ui, particles: parts.particles, sound: parts.sound, haptics: false, log, ...extra
        });
        hosts.push(host);
        return host;
    };
    const reduceMotion = () => {
        window.matchMedia = vi.fn((query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    };
    const centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    beforeEach(() => {
        hosts = [];
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        parts = {
            ui: { popup: vi.fn() },
            particles: { burst: vi.fn() },
            sound: { play: vi.fn() }
        };
        log = { error: vi.fn() };
    });

    afterEach(() => {
        for (const host of hosts) host.dispose();
        window.matchMedia = realMatchMedia;
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it.each(PRESETS)('each preset shows its toast, confetti and sound: %s', (name, title, icon, sound, count) => {
        make().celebrate(name);

        expect(parts.ui.popup).toHaveBeenCalledTimes(1);
        expect(parts.ui.popup).toHaveBeenCalledWith({ kind: 'custom', title, body: undefined, icon, burst: false });
        expect(parts.particles.burst).toHaveBeenCalledTimes(1);
        expect(parts.particles.burst).toHaveBeenCalledWith('confetti', centre, { count });
        expect(parts.sound.play).toHaveBeenCalledTimes(1);
        expect(parts.sound.play).toHaveBeenCalledWith(sound);
    });

    it('title, body and icon replace the preset values', () => {
        make().celebrate('complete', { title: 'Lesson 3 done', body: 'Nice', icon: 'X' });

        expect(parts.ui.popup).toHaveBeenCalledWith({ kind: 'custom', title: 'Lesson 3 done', body: 'Nice', icon: 'X', burst: false });
    });

    it('sound false plays nothing', () => {
        make().celebrate('complete', { sound: false });

        expect(parts.sound.play).not.toHaveBeenCalled();
        expect(parts.ui.popup).toHaveBeenCalledTimes(1);
    });

    it('a sound key plays that key', () => {
        make().celebrate('complete', { sound: 'click' });

        expect(parts.sound.play).toHaveBeenCalledWith('click');
    });

    it('target centres the confetti on the element', () => {
        const target = { getBoundingClientRect: () => ({ left: 100, top: 200, width: 50, height: 20 }) };
        make().celebrate('complete', { target });

        expect(parts.particles.burst).toHaveBeenCalledWith('confetti', { x: 125, y: 210 }, { count: 40 });
    });

    it('a zero-size target falls back to the viewport centre', () => {
        const target = { getBoundingClientRect: () => ({ left: 100, top: 200, width: 0, height: 0 }) };
        make().celebrate('complete', { target });

        expect(parts.particles.burst).toHaveBeenCalledWith('confetti', centre, { count: 40 });
    });

    it('a target without getBoundingClientRect falls back to the viewport centre', () => {
        make().celebrate('complete', { target: {} });

        expect(parts.particles.burst).toHaveBeenCalledWith('confetti', centre, { count: 40 });
    });

    it('reduced motion makes no particle call and still shows the toast', () => {
        reduceMotion();
        make().celebrate('complete');

        expect(parts.particles.burst).not.toHaveBeenCalled();
        expect(parts.ui.popup).toHaveBeenCalledTimes(1);
        expect(parts.sound.play).toHaveBeenCalledTimes(1);
    });

    it('reduced motion is read at call time, not when the host was built', () => {
        const host = make();
        reduceMotion();
        host.celebrate('complete');

        expect(parts.particles.burst).not.toHaveBeenCalled();
    });

    describe('with the real RewardUI', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            parts.ui = new RewardUI({ get particles() { return parts.particles; } });
        });

        it('the card adds no second burst, so the fake burst runs exactly once', () => {
            make().celebrate('complete');
            vi.advanceTimersByTime(400);

            expect(parts.particles.burst).toHaveBeenCalledTimes(1);
        });

        it('under reduced motion the fake burst runs zero times', () => {
            reduceMotion();
            make().celebrate('complete');
            vi.advanceTimersByTime(400);

            expect(parts.particles.burst).not.toHaveBeenCalled();
        });

        it('title is rendered as text', () => {
            make().celebrate('complete', { title: '<img src=x onerror=alert(1)>' });

            expect(document.querySelector('.achievement-name').textContent).toBe('<img src=x onerror=alert(1)>');
            expect(document.querySelector('img')).toBeNull();
        });
    });

    it.each(['nope', '__proto__', 'toString', 'constructor', 42, undefined])('an unknown preset does nothing: %s', (name) => {
        const host = make();

        expect(() => host.celebrate(name)).not.toThrow();
        expect(parts.ui.popup).not.toHaveBeenCalled();
        expect(parts.particles.burst).not.toHaveBeenCalled();
        expect(parts.sound.play).not.toHaveBeenCalled();
    });

    it('inherited options are ignored', () => {
        const options = Object.create({ title: 'x', body: 'y', icon: 'z', sound: 'click', target: { getBoundingClientRect: () => ({ left: 1, top: 1, width: 1, height: 1 }) } });
        make().celebrate('complete', options);

        expect(parts.ui.popup).toHaveBeenCalledWith({ kind: 'custom', title: 'Complete!', body: undefined, icon: '\u{2705}', burst: false });
        expect(parts.sound.play).toHaveBeenCalledWith('achievement');
        expect(parts.particles.burst).toHaveBeenCalledWith('confetti', centre, { count: 40 });
    });

    it('a throwing part is logged, not thrown, and the others still run', () => {
        const boom = new Error('boom');
        parts.ui.popup.mockImplementation(() => { throw boom; });
        parts.particles.burst.mockImplementation(() => { throw boom; });
        const host = make();

        expect(() => host.celebrate('complete')).not.toThrow();
        expect(log.error).toHaveBeenCalledTimes(2);
        expect(log.error).toHaveBeenCalledWith(boom);
        expect(parts.sound.play).toHaveBeenCalledTimes(1);
    });

    it('a rejected sound is logged', async () => {
        const boom = new Error('no audio');
        parts.sound.play.mockReturnValue(Promise.reject(boom));
        make().celebrate('complete');
        await Promise.resolve();
        await Promise.resolve();

        expect(log.error).toHaveBeenCalledWith(boom);
    });

    it('no DOM means no confetti and no viewport maths, the rest still runs', () => {
        vi.stubGlobal('document', undefined);
        const host = make();
        host.celebrate('complete', { target: { getBoundingClientRect: () => { throw new Error('read'); } } });
        vi.unstubAllGlobals();

        expect(parts.particles.burst).not.toHaveBeenCalled();
        expect(log.error).not.toHaveBeenCalled();
        expect(parts.ui.popup).toHaveBeenCalledTimes(1);
        expect(parts.sound.play).toHaveBeenCalledTimes(1);
    });

    it('celebrate returns undefined', () => {
        expect(make().celebrate('complete')).toBeUndefined();
        expect(make().celebrate('nope')).toBeUndefined();
    });

    it('dispose removes what celebrate showed', () => {
        vi.useFakeTimers();
        const host = createDopamine({ storage: createMemoryStorage(), log });
        hosts.push(host);
        host.celebrate('certificate');
        expect(document.querySelector('.achievement-popup')).not.toBeNull();

        host.dispose();

        expect(document.querySelector('.achievement-popup')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('celebrate after dispose does nothing', () => {
        const host = make();
        host.dispose();

        expect(() => host.celebrate('complete')).not.toThrow();
        expect(parts.ui.popup).not.toHaveBeenCalled();
        expect(parts.particles.burst).not.toHaveBeenCalled();
        expect(parts.sound.play).not.toHaveBeenCalled();
    });
});
