import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';

describe('RewardSystem', () => {
    let rewardSystem;
    let mockDataService;

    beforeEach(async () => {
        mockDataService = new DataService({
            storage: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn()
            }
        });

        // Mock load to return default player
        mockDataService.load = vi.fn().mockImplementation((key, def) => Promise.resolve(def));
        mockDataService.save = vi.fn().mockResolvedValue(true);

        rewardSystem = new RewardSystem(mockDataService);
        await rewardSystem.init();
    });

    it('should initialize with default player data', () => {
        expect(rewardSystem.player).toBeDefined();
        expect(rewardSystem.player.level).toBe(1);
        expect(rewardSystem.player.xp).toBe(0);
    });

    it('should add XP and level up', async () => {
        const xpAmount = 100; // Enough for level 2 (needs 100 XP: 50 * 2 * 1)
        // Wait, formula is XP = 50 * level * (level - 1)
        // Level 1: 0 XP
        // Level 2: 50 * 2 * 1 = 100 XP needed total?
        // Let's check getXPForNextLevel logic.
        // nextLevel = 2. xpNeeded = 50 * 2 * 1 = 100.

        const result = await rewardSystem.addXP(100);

        expect(result.xpGained).toBe(100);
        expect(result.leveledUp).toBe(true);
        expect(result.newLevel).toBe(2);
        expect(rewardSystem.player.level).toBe(2);
    });

    it('should not level up before reaching the advertised threshold', async () => {
        // The curve is XP = 50 * L * (L - 1), so level 2 starts at exactly 100 XP.
        await rewardSystem.addXP(99);

        expect(rewardSystem.player.level).toBe(1);
    });

    it('should place every level boundary on the advertised threshold', async () => {
        // [totalXP, expectedLevel] straddling the 50*L*(L-1) boundaries.
        const cases = [[0, 1], [99, 1], [100, 2], [299, 2], [300, 3], [599, 3], [600, 4]];

        for (const [xp, expected] of cases) {
            rewardSystem.player.xp = 0;
            rewardSystem.player.level = 1;
            await rewardSystem.addXP(xp);
            expect(rewardSystem.player.level, `${xp} XP should be level ${expected}`).toBe(expected);
        }
    });

    it('should report progress within the current level as a 0..1 fraction', async () => {
        await rewardSystem.addXP(150); // level 2, 50 XP into a 200 XP band

        const { progress, needed } = rewardSystem.getXPForNextLevel();

        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
        expect(progress).toBeCloseTo(0.25, 5);
        expect(needed).toBe(150); // 300 total for level 3, minus 150 held
    });

    it('should emit events when adding XP', async () => {
        const spy = vi.fn();
        rewardSystem.on('xp_gained', spy);

        await rewardSystem.addXP(10);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            amount: 10,
            leveledUp: false
        }));
    });

    it('should use the local calendar day, not the UTC day', () => {
        // 20:00 UTC on Aug 6 is already Aug 7 in Asia/Manila (UTC+8).
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-06T20:00:00Z'));

        try {
            expect(rewardSystem._getTodayDateString()).toBe('2026-08-07');
            expect(rewardSystem._getYesterdayDateString()).toBe('2026-08-06');
        } finally {
            vi.useRealTimers();
        }
    });

    it('should continue a streak across a local-day boundary', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-06T20:00:00Z')); // Aug 7 local

        try {
            rewardSystem.player.streak = {
                current: 4,
                longest: 4,
                lastPlayDate: '2026-08-06' // local yesterday
            };
            rewardSystem._updateDailyStreak();

            expect(rewardSystem.player.streak.current).toBe(5);
            expect(rewardSystem.player.streak.lastPlayDate).toBe('2026-08-07');
        } finally {
            vi.useRealTimers();
        }
    });

    it('should backfill missing fields when loading an older save', async () => {
        // A save written before `streak` and `stats` existed.
        mockDataService.load = vi.fn().mockResolvedValue({ name: 'Ana', xp: 250, level: 3 });

        const system = new RewardSystem(mockDataService);
        await system.init();

        expect(system.player.name).toBe('Ana');
        expect(system.player.xp).toBe(250);
        expect(system.player.streak).toBeDefined();
        expect(system.player.streak.current).toBeGreaterThanOrEqual(1);
        expect(system.player.achievements).toEqual({});
        expect(system.player.stats).toEqual({});
    });

    it('should reject non-finite XP instead of corrupting the save', async () => {
        await rewardSystem.addXP(50);

        await expect(rewardSystem.addXP(undefined)).rejects.toThrow(/finite number/i);
        await expect(rewardSystem.addXP(NaN)).rejects.toThrow(/finite number/i);

        expect(rewardSystem.player.xp).toBe(50);
    });

    it('should award 0 XP for an achievement that omits xp', async () => {
        const system = new RewardSystem(mockDataService, {
            achievements: {
                no_xp: { name: 'Quiet Win', description: 'No reward', check: () => true }
            }
        });
        await system.init();

        await system.unlockAchievement('no_xp');

        expect(system.player.xp).toBe(0);
        expect(system.player.achievements.no_xp).toBeDefined();
    });

    it('should keep checking achievements after one throws', async () => {
        const system = new RewardSystem(mockDataService, {
            achievements: {
                explodes: { name: 'Bad', xp: 10, check: () => { throw new Error('boom'); } },
                fine: { name: 'Good', xp: 10, check: () => true }
            }
        });
        await system.init();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await system.checkAchievements('game', {});
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();

        expect(system.player.achievements.fine).toBeDefined();
        expect(system.player.achievements.explodes).toBeUndefined();
    });

    it('should unlock achievements', async () => {
        const achievementSpy = vi.fn();
        rewardSystem.on('achievement_unlocked', achievementSpy);

        // 'first_game' achievement requires 1 game played
        await rewardSystem.recordGame('test_game', { score: 10 });

        expect(rewardSystem.player.totalGamesPlayed).toBe(1);
        expect(rewardSystem.player.achievements['first_game']).toBeDefined();
        expect(achievementSpy).toHaveBeenCalled();
    });
});
