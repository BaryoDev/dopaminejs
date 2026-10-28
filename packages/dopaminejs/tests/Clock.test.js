import { describe, it, expect, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { systemClock } from '../src/dopamine/core/clock.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const DAY = 24 * 60 * 60 * 1000;

const build = async (clock) => {
    const rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }), clock ? { clock } : {});
    await rewards.init();
    return rewards;
};

describe('clock port', () => {
    it('should take the day and the time from the clock it is given', async () => {
        const clock = { now: () => 1_000, localDate: () => '2031-03-04' };
        const rewards = await build(clock);

        await rewards.record('snake', { score: 1 });

        expect(rewards.snapshot().streak.lastPlayDate).toBe('2031-03-04');
        expect(rewards.snapshot().createdAt).toBe(1_000);
    });

    it('should not read Date when a clock is given', async () => {
        const clock = { now: () => 5, localDate: () => '2030-01-01' };
        const rewards = await build(clock);
        const spy = vi.spyOn(Date, 'now');

        await rewards.record('snake', { score: 1 });
        rewards.snapshot();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should count a day by the clock, not by the wall time', async () => {
        const state = { ms: Date.parse('2026-02-27T10:00:00Z') };
        const clock = {
            now: () => state.ms,
            localDate: (at = state.ms) => new Date(at).toISOString().slice(0, 10)
        };
        const rewards = await build(clock);

        for (let i = 0; i < 3; i++) {
            await rewards.record('snake', { score: 1 });
            state.ms += DAY;
        }

        // 27 Feb, 28 Feb, 1 Mar in a non-leap year.
        expect(rewards.snapshot().streak.current).toBe(3);
    });

    it('should ignore a clock that is missing a method', async () => {
        const rewards = await build({ now: () => 1 });

        expect(rewards.clock).toBe(systemClock);
    });

    it('should give the local date, never the UTC date', () => {
        // 20:00 UTC on 6 Aug is 7 Aug anywhere east of UTC+4.
        const ms = Date.parse('2026-08-06T20:00:00Z');
        const local = new Date(ms);
        const pad = (n) => String(n).padStart(2, '0');
        const expected = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;

        expect(systemClock.localDate(ms)).toBe(expected);
    });

    it('should default localDate to now', () => {
        const ms = Date.parse('2026-08-06T20:00:00Z');
        vi.useFakeTimers();
        vi.setSystemTime(ms);
        try {
            expect(systemClock.localDate()).toBe(systemClock.localDate(ms));
            expect(systemClock.now()).toBe(ms);
        } finally {
            vi.useRealTimers();
        }
    });
});
