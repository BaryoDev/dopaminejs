/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { debugOverlay } from '../../plugin-debug-overlay/src/index.js';
import { createTestHost, conformance } from '../src/testing.js';

let hosts = [];
afterEach(() => {
    for (const test of hosts) test.dispose();
    hosts = [];
    vi.useRealTimers();
    document.body.innerHTML = '';
});

const start = async (options) => {
    const test = createTestHost({ plugins: [debugOverlay(options)] });
    hosts.push(test);
    await test.ready;
    return test;
};

const overlay = () => document.getElementById('dopamine-debug-overlay');

describe('debugOverlay', () => {
    it('shows the snapshot', async () => {
        vi.useFakeTimers();
        const test = await start({ interval: 100 });
        await test.progress.addXP(30, 'debug');
        vi.advanceTimersByTime(100);

        const text = overlay().textContent;
        expect(text).toContain('"xp": 30');
        expect(text).toContain('xp_gained');
    });

    it('keeps only the last 20 events', async () => {
        vi.useFakeTimers();
        const test = await start({ interval: 100 });
        for (let i = 0; i < 25; i++) test.progress.emit('streak_updated', { current: i, longest: i });
        vi.advanceTimersByTime(100);

        const lines = overlay().querySelectorAll('pre')[1].textContent.split('\n');
        expect(lines).toHaveLength(20);
        expect(lines[0]).toContain('"current":5');
        expect(lines[19]).toContain('"current":24');
    });

    it('dispose stops the timer and removes the DOM', async () => {
        vi.useFakeTimers();
        const test = createTestHost();
        hosts.push(test);
        await test.ready;
        const timers = vi.getTimerCount();
        const dispose = test.use(debugOverlay());
        expect(overlay()).not.toBeNull();
        expect(vi.getTimerCount()).toBe(timers + 1);

        dispose();

        expect(overlay()).toBeNull();
        expect(vi.getTimerCount()).toBe(timers);
    });

    it('subscribes to every core event and unsubscribes on dispose', async () => {
        const test = createTestHost();
        hosts.push(test);
        await test.ready;
        const count = () => [...test.progress.listeners.values()].reduce((sum, set) => sum + set.size, 0);
        const before = count();
        const dispose = test.use(debugOverlay());
        expect(count()).toBe(before + 7);

        dispose();

        expect(count()).toBe(before);
    });

    it('says in one line why a plugin built for another api is refused', () => {
        const old = { ...debugOverlay(), api: 2 };
        let message = '';
        try {
            createTestHost({ plugins: [old] });
        } catch (error) {
            message = error.message;
        }
        expect(message).toBe('debug-overlay was built for api 2, this host is api 3');
    });

    it('does nothing without a DOM', () => {
        const plugin = debugOverlay();
        expect(plugin.install({ env: { hasDom: false } })).toBeUndefined();
    });
});

conformance.plugin(() => debugOverlay());
