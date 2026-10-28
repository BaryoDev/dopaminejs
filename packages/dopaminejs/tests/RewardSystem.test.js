import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

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
        const player = rewardSystem.snapshot();
        expect(player.level).toBe(1);
        expect(player.xp).toBe(0);
        expect(rewardSystem.player).toBeUndefined();
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
        expect(rewardSystem.snapshot().level).toBe(2);
    });

    it('should not level up before reaching the advertised threshold', async () => {
        // The curve is XP = 50 * L * (L - 1), so level 2 starts at exactly 100 XP.
        await rewardSystem.addXP(99);

        expect(rewardSystem.snapshot().level).toBe(1);
    });

    it('should place every level boundary on the advertised threshold', async () => {
        // [totalXP, expectedLevel] straddling the 50*L*(L-1) boundaries.
        const cases = [[0, 1], [99, 1], [100, 2], [299, 2], [300, 3], [599, 3], [600, 4]];

        for (const [xp, expected] of cases) {
            const system = new RewardSystem(mockDataService);
            await system.init();
            await system.addXP(xp);
            expect(system.snapshot().level, `${xp} XP should be level ${expected}`).toBe(expected);
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

    it('should clamp progress for a save whose level outran its XP', async () => {
        // Saves written before the curve fix banked levels at half the XP.
        // Those players keep their level; the bar must not go negative.
        mockDataService.load = vi.fn().mockResolvedValue({ xp: 50, level: 2 });

        const system = new RewardSystem(mockDataService);
        await system.init();

        const { progress, needed } = system.getXPForNextLevel();

        expect(progress).toBe(0);
        expect(needed).toBe(250);
    });

    it('should write to storage once per record, not once per mutation', async () => {
        // record internally calls addXP, unlockAchievement (twice each) and
        // a final save. Every one of those was a separate localStorage write
        // and a full JSON serialization of the player object.
        mockDataService.save.mockClear();

        await rewardSystem.record('test_game', { score: 10 });

        expect(mockDataService.save).toHaveBeenCalledTimes(1);
    });

    it('should still persist everything the batched writes accumulated', async () => {
        await rewardSystem.record('test_game', { score: 40 });

        const [, persisted] = mockDataService.save.mock.calls.at(-1);
        const sum = (map) => Object.values(map).reduce((a, b) => a + b, 0);
        expect(persisted.v).toBe(3);
        expect(sum(persisted.gamesBy)).toBe(1);
        expect(sum(persisted.playsBy.test_game)).toBe(1);
        expect(persisted.best.test_game).toBe(40);
        expect(persisted.achievements.first_game).toBeDefined();
        expect(sum(persisted.xpBy) + sum(Object.values(persisted.achievements).map((a) => a.reward))).toBe(rewardSystem.snapshot().xp);
    });

    it('should still save when a mutation happens outside a batch', async () => {
        mockDataService.save.mockClear();

        await rewardSystem.addXP(10);

        expect(mockDataService.save).toHaveBeenCalledTimes(1);
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

    it('should continue a streak across a local-day boundary', async () => {
        let ms = Date.parse('2026-08-06T12:00:00Z');
        const clock = {
            now: () => ms,
            localDate: (at = ms) => new Date(at).toISOString().slice(0, 10)
        };
        const system = new RewardSystem(mockDataService, { clock });
        await system.init();

        await system.record('test_game', { score: 1 });
        ms += 24 * 60 * 60 * 1000;
        await system.record('test_game', { score: 1 });

        expect(system.snapshot().streak.current).toBe(2);
        expect(system.snapshot().streak.lastPlayDate).toBe('2026-08-07');
    });

    it('should backfill missing fields when loading an older save', async () => {
        // A save written before `streak` and `stats` existed.
        mockDataService.load = vi.fn().mockResolvedValue({ name: 'Ana', xp: 250, level: 3 });

        const system = new RewardSystem(mockDataService);
        await system.init();

        const player = system.snapshot();
        expect(player.name).toBe('Ana');
        expect(player.xp).toBe(250);
        expect(player.streak.current).toBe(0);
        expect(player.achievements).toEqual({});
        expect(player.stats).toEqual({});
    });

    it('should reject non-finite XP instead of corrupting the save', async () => {
        await rewardSystem.addXP(50);

        await expect(rewardSystem.addXP(undefined)).rejects.toThrow(/finite number/i);
        await expect(rewardSystem.addXP(NaN)).rejects.toThrow(/finite number/i);

        expect(rewardSystem.snapshot().xp).toBe(50);
    });

    it('should award 0 XP for an achievement that omits xp', async () => {
        const system = new RewardSystem(mockDataService, {
            achievements: {
                no_xp: { name: 'Quiet Win', description: 'No reward', check: () => true }
            }
        });
        await system.init();

        await system.unlockAchievement('no_xp');

        expect(system.snapshot().xp).toBe(0);
        expect(system.snapshot().achievements.no_xp).toBeDefined();
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

        expect(system.snapshot().achievements.fine).toBeDefined();
        expect(system.snapshot().achievements.explodes).toBeUndefined();
    });

    it('should unlock achievements', async () => {
        const achievementSpy = vi.fn();
        rewardSystem.on('achievement_unlocked', achievementSpy);

        // 'first_game' achievement requires 1 game played
        await rewardSystem.record('test_game', { score: 10 });

        expect(rewardSystem.snapshot().totalGamesPlayed).toBe(1);
        expect(rewardSystem.snapshot().achievements['first_game']).toBeDefined();
        expect(achievementSpy).toHaveBeenCalled();
    });

    it('should emit personal_best with the activity and score', async () => {
        const spy = vi.fn();
        rewardSystem.on('personal_best', spy);
        rewardSystem.on('new_high_score', spy);

        await rewardSystem.record('test_game', { score: 40 });
        await rewardSystem.record('test_game', { score: 10 });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ activity: 'test_game', score: 40 });
    });

    it('should keep plays and best in the stats', async () => {
        await rewardSystem.record('test_game', { score: 40 });
        await rewardSystem.record('test_game', { score: 10 });

        const stats = rewardSystem.snapshot().stats.test_game;
        expect(stats.plays).toBe(2);
        expect(stats.best).toBe(40);
        expect(stats.totalPlays).toBeUndefined();
        expect(stats.highScore).toBeUndefined();
    });

    it('should not have recordGame any more', () => {
        expect(rewardSystem.recordGame).toBeUndefined();
    });

    it('should hand out a frozen snapshot that is detached from the player', async () => {
        await rewardSystem.record('test_game', { score: 40 });
        const first = rewardSystem.snapshot();

        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(first.stats.test_game)).toBe(true);
        expect(() => { 'use strict'; first.xp = 99999; }).toThrow(TypeError);

        await rewardSystem.addXP(5);
        expect(first.xp).not.toBe(rewardSystem.snapshot().xp);
        expect(rewardSystem.snapshot()).not.toBe(first);
    });

    it('should freeze event payloads', async () => {
        const seen = [];
        rewardSystem.on('xp_gained', (payload) => seen.push(payload));
        rewardSystem.on('achievement_unlocked', (payload) => seen.push(payload));

        await rewardSystem.record('test_game', { score: 40 });

        expect(seen.length).toBeGreaterThan(1);
        for (const payload of seen) expect(Object.isFrozen(payload)).toBe(true);
    });

    it('should give a check function the frozen snapshot', async () => {
        let received;
        const system = new RewardSystem(mockDataService, {
            achievements: {
                probe: { name: 'Probe', xp: 0, check: (player) => { received = player; return false; } }
            }
        });
        await system.init();

        await system.record('test_game', { score: 1 });

        expect(Object.isFrozen(received)).toBe(true);
        expect(received.totalGamesPlayed).toBe(1);
    });
});

describe('RewardSystem streakDays', () => {
    const build = async (config = {}) => {
        const clock = { now: () => 1_000, localDate: () => '2031-03-04' };
        const system = new RewardSystem(
            new DataService({ storage: createMemoryStorage() }),
            { clock, ...config }
        );
        await system.init();
        return system;
    };

    it('marks the day on addXP by default', async () => {
        const system = await build();
        expect(system.snapshot().streak.current).toBe(0);

        await system.addXP(5);

        expect(system.snapshot().streak.current).toBe(1);
        expect(system.snapshot().streak.lastPlayDate).toBe('2031-03-04');
    });

    it('does not mark the day on addXP when streakDays is record', async () => {
        const system = await build({ streakDays: 'record' });

        await system.addXP(5);
        expect(system.snapshot().streak.current).toBe(0);

        await system.record('g', { score: 1 });
        expect(system.snapshot().streak.current).toBe(1);
    });

    it('never marks the day for achievement reward XP', async () => {
        const system = await build({
            achievements: { gift: { name: 'Gift', xp: 40, check: () => false } }
        });

        await system.unlockAchievement('gift');

        expect(system.snapshot().xp).toBe(40);
        expect(system.snapshot().streak.current).toBe(0);
    });

    it('falls back to any for an unknown value', async () => {
        const system = await build({ streakDays: 'nope' });
        await system.addXP(1);
        expect(system.snapshot().streak.current).toBe(1);
    });
});
