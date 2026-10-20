import { describe, it, expect, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const KEY = 'dopamine_player';
const saved = () => ({ name: 'Ana', xp: 5000, level: 10 });

// A memory store whose next `failures` reads throw (sync) or reject (async).
const flakyStorage = ({ failures = 1, async = false } = {}) => {
    const storage = createMemoryStorage();
    const getItem = storage.getItem.bind(storage);
    let left = failures;
    storage.getItem = (key) => {
        if (left > 0) {
            left--;
            if (async) return Promise.reject(new Error('offline'));
            throw new Error('offline');
        }
        return async ? Promise.resolve(getItem(key)) : getItem(key);
    };
    storage.setItem(KEY, JSON.stringify(saved()));
    return storage;
};

describe('RewardSystem when the saved player cannot be read', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const async of [false, true]) {
        const kind = async ? 'rejects' : 'throws';

        it(`should not overwrite the saved player when getItem ${kind}`, async () => {
            const storage = flakyStorage({ async });
            const rewards = new RewardSystem(new DataService({ storage }));
            const failed = vi.fn();
            rewards.on('load_failed', failed);

            await rewards.init();
            await rewards.addXP(10);
            await rewards.recordGame('quiz', { score: 5 });

            expect(JSON.parse(await storage.getItem(KEY))).toEqual(saved());
            expect(failed).toHaveBeenCalledTimes(1);
            expect(failed.mock.calls[0][0]).toMatchObject({ key: 'player', reason: 'read' });
            expect(failed.mock.calls[0][0].error).toBeInstanceOf(Error);
            expect(rewards.player.xp).toBeGreaterThan(10);
            expect(rewards.player.totalGamesPlayed).toBe(1);
        });
    }

    it('should keep the stored value byte for byte after a failed read', async () => {
        const storage = flakyStorage();
        const before = JSON.stringify(saved());
        const setItem = vi.spyOn(storage, 'setItem');
        const rewards = new RewardSystem(new DataService({ storage }));

        await rewards.init();
        await rewards.addXP(10);

        expect(setItem).not.toHaveBeenCalled();
        expect(storage.getItem(KEY)).toBe(before);
    });

    it('should load the real player when init is called again', async () => {
        const storage = flakyStorage();
        const rewards = new RewardSystem(new DataService({ storage }));

        await rewards.init();
        expect(rewards.player.xp).toBe(0);

        await rewards.init();
        expect(rewards.player.xp).toBe(5000);
        await rewards.addXP(10);
        expect(JSON.parse(storage.getItem(KEY)).xp).toBe(5010);
    });

    it('should still create and save a new player when nothing is saved', async () => {
        const storage = createMemoryStorage();
        const rewards = new RewardSystem(new DataService({ storage }));
        const failed = vi.fn();
        rewards.on('load_failed', failed);

        await rewards.init();

        expect(failed).not.toHaveBeenCalled();
        expect(JSON.parse(storage.getItem(KEY)).xp).toBe(0);
    });

    it('should keep corrupt data under player_corrupt and start a new player', async () => {
        const storage = createMemoryStorage();
        storage.setItem(KEY, '{not json');
        const rewards = new RewardSystem(new DataService({ storage }));
        const failed = vi.fn();
        rewards.on('load_failed', failed);

        await rewards.init();

        expect(failed).toHaveBeenCalledWith({ key: 'player', reason: 'corrupt' });
        expect(JSON.parse(storage.getItem('dopamine_player_corrupt'))).toBe('{not json');
        expect(JSON.parse(storage.getItem(KEY)).xp).toBe(0);
    });

    it('should fall back to load() for a data service without read()', async () => {
        const store = { player: saved() };
        const service = {
            load: async (key) => store[key] ?? null,
            save: async (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); return true; },
        };
        const rewards = new RewardSystem(service);

        await rewards.init();

        expect(rewards.player.xp).toBe(5000);
    });
});

describe('DataService.read', () => {
    it('should reject when storage throws, where load() hides it', async () => {
        const storage = flakyStorage({ failures: 2 });
        const service = new DataService({ storage });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(service.read('player')).rejects.toThrow('offline');
        await expect(service.load('player')).resolves.toBeNull();
    });

    it('should resolve a missing key as null and parse a saved one', async () => {
        const storage = createMemoryStorage();
        const service = new DataService({ storage });

        await expect(service.read('player')).resolves.toEqual({ value: null });
        await service.save('player', { xp: 1 });
        await expect(service.read('player')).resolves.toEqual({ value: { xp: 1 } });
    });
});
