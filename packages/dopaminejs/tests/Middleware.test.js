import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

describe('middleware', () => {
    let rewards;
    let errorSpy;

    beforeEach(async () => {
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));
        await rewards.init();
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it('should let beforeXP patch the amount', async () => {
        rewards.use({ beforeXP: ({ amount }) => ({ amount: amount * 2 }) });

        const result = await rewards.addXP(10);

        expect(result.xpGained).toBe(20);
        expect(rewards.snapshot().xp).toBe(20);
    });

    it('should drop the XP when beforeXP returns false', async () => {
        const gained = vi.fn();
        rewards.on('xp_gained', gained);
        rewards.use({ beforeXP: () => false });

        const result = await rewards.addXP(10);

        expect(result.xpGained).toBe(0);
        expect(rewards.snapshot().xp).toBe(0);
        expect(gained).not.toHaveBeenCalled();
    });

    it('should leave things alone when a before hook returns nothing', async () => {
        rewards.use({ beforeXP: () => undefined });

        await rewards.addXP(10);

        expect(rewards.snapshot().xp).toBe(10);
    });

    it('should run hooks in the order they were added', async () => {
        const order = [];
        rewards.use({ beforeXP: () => { order.push('a'); } });
        rewards.use({ beforeXP: () => { order.push('b'); } });
        rewards.use({ beforeXP: () => { order.push('c'); } });

        await rewards.addXP(1);

        expect(order).toEqual(['a', 'b', 'c']);
    });

    it('should hand each hook the patch from the one before', async () => {
        rewards.use({ beforeXP: ({ amount }) => ({ amount: amount + 1 }) });
        rewards.use({ beforeXP: ({ amount }) => ({ amount: amount * 10 }) });

        await rewards.addXP(1);

        expect(rewards.snapshot().xp).toBe(20);
    });

    it('should log a throwing hook, skip it and run the rest', async () => {
        rewards.use({ beforeXP: () => { throw new Error('boom'); } });
        rewards.use({ beforeXP: ({ amount }) => ({ amount: amount + 5 }) });

        await rewards.addXP(10);

        expect(errorSpy).toHaveBeenCalled();
        expect(rewards.snapshot().xp).toBe(15);
    });

    it('should not stop an after hook that throws', async () => {
        const seen = vi.fn();
        rewards.use({ afterXP: () => { throw new Error('boom'); } });
        rewards.use({ afterXP: seen });

        await rewards.addXP(10);

        expect(seen).toHaveBeenCalledWith(expect.objectContaining({ amount: 10, total: 10 }));
    });

    it('should return a disposer from use', async () => {
        const hook = vi.fn();
        const remove = rewards.use({ beforeXP: hook });

        await rewards.addXP(1);
        remove();
        await rewards.addXP(1);

        expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should refuse an object with no hook on it', () => {
        expect(() => rewards.use({})).toThrow(TypeError);
        expect(() => rewards.use(null)).toThrow(TypeError);
    });

    it('should let beforeRecord reject a play', async () => {
        rewards.use({ beforeRecord: ({ activity }) => (activity === 'cheat' ? false : undefined) });

        expect(await rewards.record('cheat', { score: 9 })).toBe(false);
        expect(await rewards.record('snake', { score: 9 })).toBe(true);

        const player = rewards.snapshot();
        expect(player.stats.cheat).toBeUndefined();
        expect(player.totalGamesPlayed).toBe(1);
    });

    it('should let beforeRecord patch the result', async () => {
        rewards.use({ beforeRecord: ({ result }) => ({ result: { ...result, score: 1 } }) });

        await rewards.record('snake', { score: 900 });

        expect(rewards.snapshot().stats.snake.best).toBe(1);
    });

    it('should keep the original result when a patch is not valid', async () => {
        rewards.use({ beforeRecord: () => ({ result: { score: Infinity } }) });

        await rewards.record('snake', { score: 7 });

        expect(rewards.snapshot().stats.snake.best).toBe(7);
    });

    it('should call afterRecord with the XP awarded', async () => {
        const after = vi.fn();
        rewards.use({ afterRecord: after });

        await rewards.record('snake', { score: 0 });

        expect(after).toHaveBeenCalledWith(expect.objectContaining({ activity: 'snake', xp: expect.any(Number) }));
    });

    it('should let beforeUnlock patch the reward', async () => {
        rewards.use({ beforeUnlock: () => ({ reward: 7 }) });

        expect(await rewards.unlockAchievement('first_game')).toBe(true);

        expect(rewards.snapshot().xp).toBe(7);
        expect(rewards.snapshot().achievements.first_game.reward).toBe(7);
    });

    it('should let beforeUnlock block an achievement', async () => {
        const unlocked = vi.fn();
        rewards.on('achievement_unlocked', unlocked);
        rewards.use({ beforeUnlock: () => false });

        expect(await rewards.unlockAchievement('first_game')).toBe(false);

        expect(unlocked).not.toHaveBeenCalled();
        expect(rewards.snapshot().achievements).toEqual({});
    });

    it('should call afterUnlock with the id and reward', async () => {
        const after = vi.fn();
        rewards.use({ afterUnlock: after });

        await rewards.unlockAchievement('first_game');

        expect(after).toHaveBeenCalledWith({ id: 'first_game', reward: 50 });
    });

    it('should freeze the context a hook receives', async () => {
        let frozen;
        rewards.use({ beforeXP: (context) => { frozen = Object.isFrozen(context); } });

        await rewards.addXP(1);

        expect(frozen).toBe(true);
    });
});

describe('defineAchievement', () => {
    let rewards;

    beforeEach(async () => {
        rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));
        await rewards.init();
    });

    it('should add a rule that unlocks on record', async () => {
        rewards.defineAchievement('snake_fan', {
            name: 'Snake Fan', xp: 25, check: (player, activity) => activity === 'snake'
        });

        await rewards.record('snake', { score: 1 });

        expect(rewards.snapshot().achievements.snake_fan).toBeDefined();
    });

    it('should return a disposer that removes the rule', async () => {
        const remove = rewards.defineAchievement('snake_fan', {
            name: 'Snake Fan', xp: 25, check: () => true
        });
        remove();

        await rewards.record('snake', { score: 1 });

        expect(rewards.snapshot().achievements.snake_fan).toBeUndefined();
    });

    it('should log a check that throws and keep going', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        rewards.defineAchievement('bad', { name: 'Bad', xp: 1, check: () => { throw new Error('boom'); } });
        rewards.defineAchievement('good', { name: 'Good', xp: 1, check: () => true });

        await rewards.record('snake', { score: 1 });

        expect(errorSpy).toHaveBeenCalled();
        expect(rewards.snapshot().achievements.good).toBeDefined();
        expect(rewards.snapshot().achievements.bad).toBeUndefined();
        errorSpy.mockRestore();
    });

    it('should restore a built-in rule when its replacement is removed', () => {
        const before = rewards.achievements.first_game;
        const remove = rewards.defineAchievement('first_game', { name: 'Mine', xp: 1, check: () => false });

        expect(rewards.achievements.first_game.name).toBe('Mine');
        remove();

        expect(rewards.achievements.first_game).toBe(before);
    });

    it('should refuse a bad id or a definition with no check', () => {
        expect(() => rewards.defineAchievement('__proto__', { check: () => true })).toThrow(TypeError);
        expect(() => rewards.defineAchievement('', { check: () => true })).toThrow(TypeError);
        expect(() => rewards.defineAchievement('x', { name: 'No check' })).toThrow(TypeError);
    });
});
