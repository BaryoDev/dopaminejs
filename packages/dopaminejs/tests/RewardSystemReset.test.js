import { describe, it, expect, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const build = (storage) => new RewardSystem(new DataService({ storage }));

const freshSystem = async (storage = createMemoryStorage()) => {
    const rewards = build(storage);
    await rewards.init();
    return rewards;
};

const sum = (map) => Object.values(map).reduce((a, b) => a + b, 0);

describe('RewardSystem.reset', () => {
    it('should replace the player with an empty one', async () => {
        const rewards = await freshSystem();
        await rewards.record('pickle', { score: 40 });
        await rewards.addXP(500, 'bonus');
        expect(rewards.snapshot().xp).toBeGreaterThan(0);

        const after = await rewards.reset();

        expect(after.xp).toBe(0);
        expect(after.level).toBe(1);
        expect(after.achievements).toEqual({});
        expect(after.stats).toEqual({});
        expect(after.streak.current).toBe(0);
        expect(after.streak.longest).toBe(0);
        expect(after.totalGamesPlayed).toBe(0);
        expect(rewards.getUnseenAchievements()).toEqual([]);
        const doc = rewards.export();
        expect(doc.playDates).toEqual([]);
        expect(doc.best).toEqual({});
        expect(doc.achievements).toEqual({});
    });

    it('should keep the device id', async () => {
        const storage = createMemoryStorage();
        const rewards = await freshSystem(storage);
        await rewards.addXP(10);
        const before = storage.getItem('dopamine_device');
        expect(before).toBeTruthy();

        await rewards.reset();

        expect(storage.getItem('dopamine_device')).toBe(before);
        const id = JSON.parse(before);
        await rewards.addXP(7);
        expect(Object.keys(rewards.export().xpBy)).toEqual([id]);
    });

    it('should publish player_reset once, after the save', async () => {
        const rewards = await freshSystem();
        await rewards.addXP(10);
        const order = [];
        const save = vi.spyOn(rewards.dataService, 'save').mockImplementation(async () => { order.push('save'); return true; });
        rewards.on('player_reset', (data) => order.push(['player_reset', data]));

        await rewards.reset();

        expect(order).toEqual(['save', ['player_reset', {}]]);
        save.mockRestore();
    });

    it('should replace a newer-version save with no backup', async () => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', JSON.stringify({ v: 999 }));
        const rewards = build(storage);
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        await rewards.init();
        expect(rewards.loadFailed).toBe(true);

        await rewards.reset();

        expect(rewards.loadFailed).toBe(false);
        expect(JSON.parse(storage.getItem('dopamine_player')).v).not.toBe(999);
        expect(storage.getItem('dopamine_player_corrupt')).toBeNull();
        error.mockRestore();
    });

    it('should write once', async () => {
        const rewards = await freshSystem();
        await rewards.addXP(10);
        const save = vi.spyOn(rewards.dataService, 'save');

        await rewards.reset();

        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0][0]).toBe('player');
        expect(sum(save.mock.calls[0][1].xpBy)).toBe(0);
    });

    it('should count later activity under the same device id', async () => {
        const storage = createMemoryStorage();
        const rewards = await freshSystem(storage);
        await rewards.addXP(10);
        const device = JSON.parse(storage.getItem('dopamine_device'));

        await rewards.reset();
        await rewards.record('pickle', { score: 5 });

        const doc = rewards.export();
        expect(Object.keys(doc.gamesBy)).toEqual([device]);
        expect(doc.gamesBy[device]).toBe(1);
        expect(rewards.snapshot().totalGamesPlayed).toBe(1);
    });

    it('should read back empty on a new RewardSystem with the same storage', async () => {
        const storage = createMemoryStorage();
        const rewards = await freshSystem(storage);
        await rewards.record('pickle', { score: 40 });

        await rewards.reset();
        const second = await freshSystem(storage);

        const player = second.snapshot();
        expect(player.xp).toBe(0);
        expect(player.achievements).toEqual({});
        expect(player.totalGamesPlayed).toBe(0);
    });

    it('should merge a later import into the empty document', async () => {
        const source = await freshSystem();
        await source.addXP(120);
        const doc = source.export();
        const rewards = await freshSystem();
        await rewards.addXP(900);

        await rewards.reset();
        await rewards.import(doc, { silent: true });

        expect(rewards.snapshot().xp).toBe(120);
    });

    it('should emit save_failed and keep the reset state when the write fails', async () => {
        const storage = createMemoryStorage();
        const rewards = await freshSystem(storage);
        await rewards.addXP(10);
        const spy = vi.fn();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        rewards.on('save_failed', spy);

        storage.setItem = () => { throw new Error('QuotaExceededError'); };
        const after = await rewards.reset();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(after.xp).toBe(0);
        expect(rewards.snapshot().xp).toBe(0);
        error.mockRestore();
    });

    it('should write after a failed load and clear loadFailed', async () => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', JSON.stringify({ v: 3, name: 'Old' }));
        const real = storage.getItem.bind(storage);
        storage.getItem = (key) => {
            if (key === 'dopamine_player') throw new Error('blocked');
            return real(key);
        };
        const rewards = build(storage);
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        await rewards.init();
        expect(rewards.loadFailed).toBe(true);

        await rewards.reset();

        expect(rewards.loadFailed).toBe(false);
        const stored = JSON.parse(real('dopamine_player'));
        expect(stored.name).toBe('Player');
        expect(sum(stored.xpBy)).toBe(0);
        error.mockRestore();
    });

    it('should throw before init', async () => {
        const rewards = build(createMemoryStorage());

        await expect(rewards.reset()).rejects.toThrow('init()');
    });
});
