import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const freshSystem = async (storage = createMemoryStorage(), config = {}) => {
    const rewards = new RewardSystem(new DataService({ storage }), config);
    await rewards.init();
    return rewards;
};

const seed = (storage, player) => {
    storage.setItem('dopamine_player', JSON.stringify(player));
};

describe('RewardSystem input guards', () => {
    let rewards;

    beforeEach(async () => {
        rewards = await freshSystem();
    });

    afterEach(() => {
        delete Object.prototype.polluted;
        delete Object.prototype.totalPlays;
        delete Object.prototype.highScore;
    });

    it('should refuse game names that reach Object.prototype', async () => {
        for (const name of ['__proto__', 'constructor', 'prototype']) {
            await expect(rewards.recordGame(name, { polluted: 7 })).rejects.toThrow(TypeError);
        }

        expect({}.polluted).toBeUndefined();
        expect({}.totalPlays).toBeUndefined();
        expect(rewards.player.totalGamesPlayed).toBe(0);
    });

    it('should refuse an empty or non-string game name', async () => {
        await expect(rewards.recordGame('', { score: 1 })).rejects.toThrow(TypeError);
        await expect(rewards.recordGame(undefined, { score: 1 })).rejects.toThrow(TypeError);
    });

    it('should not unlock inherited property names as achievements', async () => {
        for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(await rewards.unlockAchievement(id)).toBe(false);
        }

        expect(Object.keys(rewards.player.achievements)).toEqual([]);
        expect(rewards.player.xp).toBe(0);
    });

    it('should award an achievement only once', async () => {
        const spy = vi.fn();
        rewards.on('achievement_unlocked', spy);

        expect(await rewards.unlockAchievement('level_10')).toBe(true);
        expect(await rewards.unlockAchievement('level_10')).toBe(false);

        expect(rewards.player.xp).toBe(250);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should include the id in the achievement_unlocked payload', async () => {
        const spy = vi.fn();
        rewards.on('achievement_unlocked', spy);

        await rewards.unlockAchievement('first_game');

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'first_game', name: 'First Steps' }));
    });

    it('should reject a non-finite score before changing anything', async () => {
        for (const score of [Infinity, NaN, '500', null]) {
            await expect(rewards.recordGame('snake', { score })).rejects.toThrow(TypeError);
        }

        expect(rewards.player.totalGamesPlayed).toBe(0);
        expect(rewards.player.stats.snake).toBeUndefined();
        expect(rewards.player.xp).toBe(0);
    });

    it('should accept a game with no result', async () => {
        await rewards.recordGame('snake');

        expect(rewards.player.stats.snake.totalPlays).toBe(1);
    });

    it('should never take XP away for a negative score', async () => {
        await rewards.addXP(40);
        await rewards.recordGame('snake', { score: -1000 });

        // 40 + the base 10 for playing + 50 for first_game.
        expect(rewards.player.xp).toBe(100);
    });

    it('should floor total XP at zero and keep the level a number', async () => {
        const spy = vi.fn();
        rewards.on('xp_gained', spy);

        await rewards.addXP(-5000);
        const result = await rewards.addXP(10);

        expect(rewards.player.xp).toBe(10);
        expect(result.newLevel).toBe(1);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ newLevel: 1, total: 10 }));
    });

    it('should ignore non-finite extra metrics', async () => {
        await rewards.recordGame('snake', { score: 5, apples: NaN, time: Infinity, moves: 3 });

        expect(rewards.player.stats.snake.apples).toBe(0);
        expect(rewards.player.stats.snake.time).toBe(0);
        expect(rewards.player.stats.snake.moves).toBe(3);
    });

    it('should say init() is missing instead of a null TypeError', async () => {
        const cold = new RewardSystem(new DataService({ storage: createMemoryStorage() }));

        await expect(cold.addXP(10)).rejects.toThrow(/init\(\)/);
        await expect(cold.recordGame('snake', { score: 1 })).rejects.toThrow(/init\(\)/);
        expect(() => cold.getXPForNextLevel()).toThrow(/init\(\)/);
    });
});

describe('RewardSystem saved state', () => {
    it('should coerce a tampered save back to valid numbers', async () => {
        const storage = createMemoryStorage();
        seed(storage, {
            xp: '100',
            level: 'nine',
            totalGamesPlayed: -3,
            streak: { current: 'x', longest: null, lastPlayDate: 42 },
            achievements: 'nope',
            stats: 'x'
        });

        const rewards = await freshSystem(storage);

        expect(rewards.player.xp).toBe(100);
        expect(rewards.player.level).toBe(2);
        expect(rewards.player.totalGamesPlayed).toBe(0);
        expect(rewards.player.streak.current).toBe(1);
        expect(rewards.player.streak.longest).toBe(1);
        expect(rewards.player.achievements).toEqual({});
        expect(rewards.player.stats).toEqual({});

        await rewards.addXP(5);
        expect(rewards.player.xp).toBe(105);

        await rewards.recordGame('snake', { score: 10 });
        expect(rewards.player.stats.snake.highScore).toBe(10);
    });

    it('should drop saved stats and achievements that are not plain records', async () => {
        const storage = createMemoryStorage();
        seed(storage, {
            xp: 0,
            level: 1,
            stats: { snake: 'broken', pong: { totalPlays: 'two', highScore: 9 } },
            achievements: { first_game: true, level_5: { unlockedAt: 1, seen: true } }
        });

        const rewards = await freshSystem(storage);

        expect(rewards.player.stats.snake).toBeUndefined();
        expect(rewards.player.stats.pong).toEqual({ totalPlays: 0, highScore: 9 });
        expect(rewards.player.achievements.first_game).toBeUndefined();
        expect(rewards.player.achievements.level_5).toEqual({ unlockedAt: 1, seen: true });
    });

    it('should keep a level earned under an older curve and report it', async () => {
        const storage = createMemoryStorage();
        seed(storage, { xp: 300, level: 5 });

        const rewards = await freshSystem(storage);
        const result = await rewards.addXP(10);

        expect(result.leveledUp).toBe(false);
        expect(result.newLevel).toBe(5);
        expect(rewards.player.level).toBe(5);
    });
});

describe('RewardSystem daily streak', () => {
    it('should advance the streak when a game is recorded on a new day', async () => {
        const rewards = await freshSystem();
        const spy = vi.fn();
        rewards.on('streak_updated', spy);

        rewards.player.streak = {
            current: 2,
            longest: 2,
            lastPlayDate: rewards._getYesterdayDateString()
        };

        await rewards.recordGame('snake', { score: 0 });

        expect(rewards.player.streak.current).toBe(3);
        expect(rewards.player.streak.longest).toBe(3);
        expect(spy).toHaveBeenCalledWith({ current: 3, longest: 3 });
    });

    it('should not emit streak_updated twice on the same day', async () => {
        const rewards = await freshSystem();
        const spy = vi.fn();
        rewards.on('streak_updated', spy);

        await rewards.recordGame('snake', { score: 0 });
        await rewards.recordGame('snake', { score: 0 });

        expect(spy).not.toHaveBeenCalled();
    });
});

describe('RewardSystem persistence', () => {
    it('should round-trip through an async storage', async () => {
        const map = new Map();
        const storage = {
            getItem: async (key) => (map.has(key) ? map.get(key) : null),
            setItem: async (key, value) => { map.set(key, value); },
            removeItem: async (key) => { map.delete(key); }
        };

        const first = await freshSystem(storage);
        await first.addXP(150);

        const second = await freshSystem(storage);

        expect(second.player.xp).toBe(150);
        expect(second.player.level).toBe(2);
    });

    it('should emit save_failed when storage rejects the write', async () => {
        const storage = createMemoryStorage();
        const rewards = await freshSystem(storage);
        const spy = vi.fn();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        rewards.on('save_failed', spy);

        storage.setItem = () => { throw new Error('QuotaExceededError'); };
        await rewards.addXP(10);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(rewards.player.xp).toBe(10);
        error.mockRestore();
    });

    it('should report a rejected async write as a failed save', async () => {
        const service = new DataService({
            storage: {
                getItem: async () => null,
                setItem: async () => { throw new Error('offline'); },
                removeItem: async () => {}
            }
        });
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(await service.save('player', { xp: 1 })).toBe(false);
        error.mockRestore();
    });
});
