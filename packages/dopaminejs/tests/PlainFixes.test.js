import { describe, it, expect, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const make = async (storage = createMemoryStorage(), config = {}) => {
    const rewards = new RewardSystem(new DataService({ storage }), config);
    await rewards.init();
    return { rewards, storage };
};

describe('two unlocks of one achievement at once', () => {
    it('fires one achievement_unlocked and one xp_gained for two calls', async () => {
        const { rewards } = await make();
        const unlocked = vi.fn();
        const gained = vi.fn();
        rewards.on('achievement_unlocked', unlocked);
        rewards.on('xp_gained', gained);
        rewards.use({ beforeUnlock: async () => { await Promise.resolve(); } });

        const results = await Promise.all([rewards.unlockAchievement('first_game'), rewards.unlockAchievement('first_game')]);

        expect(results.filter(Boolean)).toHaveLength(1);
        expect(unlocked).toHaveBeenCalledTimes(1);
        expect(gained).toHaveBeenCalledTimes(1);
        expect(rewards.snapshot().xp).toBe(50);
    });

    it('runs afterUnlock once for two record() calls fired together', async () => {
        const { rewards } = await make();
        const unlocked = vi.fn();
        const after = vi.fn();
        rewards.on('achievement_unlocked', unlocked);
        rewards.use({ beforeUnlock: async () => { await Promise.resolve(); }, afterUnlock: after });

        await Promise.all([rewards.record('a'), rewards.record('a')]);

        const firstGame = unlocked.mock.calls.filter(([a]) => a.id === 'first_game');
        expect(firstGame).toHaveLength(1);
        expect(after.mock.calls.filter(([c]) => c.id === 'first_game')).toHaveLength(1);
    });

    it('lets the id unlock again after a hook refuses it', async () => {
        const { rewards } = await make();
        let refuse = true;
        rewards.use({ beforeUnlock: async () => (refuse ? false : undefined) });

        expect(await rewards.unlockAchievement('first_game')).toBe(false);
        refuse = false;
        expect(await rewards.unlockAchievement('first_game')).toBe(true);
    });
});

describe('negative sums', () => {
    it('are dropped on import, so stats stay finite', async () => {
        const { rewards } = await make();
        await rewards.import({ v: 3, sumsBy: { a: { k: { d: -1e308, e: -1e308 }, ok: { d: 4 } } } });

        const stats = JSON.parse(JSON.stringify(rewards.snapshot().stats));
        expect(stats.a.k).toBe(0);
        expect(stats.a.ok).toBe(4);
    });
});

describe('a saved player that is valid JSON but not an object', () => {
    it.each([['[1,2]', [1, 2]], ['5', 5], ['"x"', 'x']])('keeps %s under player_corrupt and emits load_failed', async (raw, value) => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', raw);
        const rewards = new RewardSystem(new DataService({ storage }));
        const failed = vi.fn();
        rewards.on('load_failed', failed);

        await rewards.init();

        expect(failed).toHaveBeenCalledWith({ key: 'player', reason: 'corrupt', backedUp: true });
        expect(JSON.parse(storage.getItem('dopamine_player_corrupt'))).toStrictEqual(value);
        expect(rewards.loadFailed).toBe(false);
        expect(JSON.parse(storage.getItem('dopamine_player')).v).toBe(3);
    });
});

describe('markAchievementsSeen', () => {
    it('gives the init message before init()', async () => {
        const rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));
        await expect(rewards.markAchievementsSeen(['first_game'])).rejects.toThrow('init() must be awaited');
    });
});
