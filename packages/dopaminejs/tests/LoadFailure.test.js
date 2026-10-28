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
        if (key === KEY && left > 0) {
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
            await rewards.record('quiz', { score: 5 });

            expect(JSON.parse(await storage.getItem(KEY))).toEqual(saved());
            expect(failed).toHaveBeenCalledTimes(1);
            expect(failed.mock.calls[0][0]).toMatchObject({ key: 'player', reason: 'read' });
            expect(failed.mock.calls[0][0].error).toBeInstanceOf(Error);
            expect(rewards.snapshot().xp).toBeGreaterThan(10);
            expect(rewards.snapshot().totalGamesPlayed).toBe(1);
            expect(rewards.loadFailed).toBe(true);
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
        expect(rewards.snapshot().xp).toBe(0);
        expect(rewards.loadFailed).toBe(true);

        await rewards.init();
        expect(rewards.snapshot().xp).toBe(5000);
        expect(rewards.loadFailed).toBe(false);
        await rewards.addXP(10);
        expect(Object.values(JSON.parse(storage.getItem(KEY)).xpBy).reduce((a, b) => a + b, 0)).toBe(5010);
    });

    it('should still create and save a new player when nothing is saved', async () => {
        const storage = createMemoryStorage();
        const rewards = new RewardSystem(new DataService({ storage }));
        const failed = vi.fn();
        rewards.on('load_failed', failed);

        await rewards.init();

        expect(failed).not.toHaveBeenCalled();
        expect(JSON.parse(storage.getItem(KEY)).v).toBe(3);
    });

    it('should keep corrupt data under player_corrupt and start a new player', async () => {
        const storage = createMemoryStorage();
        storage.setItem(KEY, '{not json');
        const rewards = new RewardSystem(new DataService({ storage }));
        const failed = vi.fn();
        rewards.on('load_failed', failed);

        await rewards.init();

        expect(failed).toHaveBeenCalledWith({ key: 'player', reason: 'corrupt', backedUp: true });
        expect(JSON.parse(storage.getItem('dopamine_player_corrupt'))).toBe('{not json');
        expect(rewards.loadFailed).toBe(false);
        expect(JSON.parse(storage.getItem(KEY)).v).toBe(3);
    });

    it('should still work with a data service whose load() ignores the option', async () => {
        const store = { player: saved() };
        const service = {
            load: async (key) => store[key] ?? null,
            save: async (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); return true; },
        };
        const rewards = new RewardSystem(service);

        await rewards.init();

        expect(rewards.snapshot().xp).toBe(5000);
    });
    it('should not write while a retry is still reading', async () => {
        const storage = flakyStorage();
        const rewards = new RewardSystem(new DataService({ storage }));
        await rewards.init();

        let release;
        const getItem = storage.getItem;
        storage.getItem = (key) => new Promise((resolve) => {
            release = () => resolve(getItem(key));
        });
        const retry = rewards.init();
        await rewards.addXP(7);
        expect(JSON.parse(await getItem(KEY))).toEqual(saved());

        release();
        await retry;
        expect(rewards.snapshot().xp).toBe(5000);
    });

    it('should keep the session progress when a retry fails too', async () => {
        const storage = flakyStorage({ failures: 2 });
        const rewards = new RewardSystem(new DataService({ storage }));

        await rewards.init();
        await rewards.addXP(100);
        await rewards.init();

        expect(rewards.snapshot().xp).toBe(100);
        expect(JSON.parse(await storage.getItem(KEY))).toEqual(saved());
    });

    it('should save nothing when the corrupt value cannot be backed up', async () => {
        const storage = createMemoryStorage();
        storage.setItem(KEY, '{not json');
        const setItem = storage.setItem.bind(storage);
        storage.setItem = (key, value) => {
            if (key === 'dopamine_player_corrupt') throw new Error('full');
            return setItem(key, value);
        };
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const rewards = new RewardSystem(new DataService({ storage }));
        const failed = vi.fn();
        rewards.on('load_failed', failed);

        await rewards.init();
        await rewards.addXP(10);

        expect(storage.getItem(KEY)).toBe('{not json');
        expect(failed.mock.calls[0][0]).toMatchObject({ reason: 'corrupt', backedUp: false });
        expect(rewards.loadFailed).toBe(true);
    });
});

describe('DataService.load strict', () => {
    it('should reject when storage throws, where the default hides it', async () => {
        const storage = flakyStorage({ failures: 2 });
        const service = new DataService({ storage });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(service.load('player', null, { strict: true })).rejects.toThrow('offline');
        await expect(service.load('player')).resolves.toBeNull();
    });

    it('should reject corrupt data with its raw string', async () => {
        const storage = createMemoryStorage();
        storage.setItem(KEY, '{not json');
        const service = new DataService({ storage });

        await expect(service.load('player', null, { strict: true }))
            .rejects.toMatchObject({ code: 'DOPAMINE_CORRUPT', raw: '{not json' });
    });

    it('should resolve a missing key as the default and parse a saved one', async () => {
        const service = new DataService({ storage: createMemoryStorage() });

        await expect(service.load('player', 7, { strict: true })).resolves.toBe(7);
        await service.save('player', { xp: 1 });
        await expect(service.load('player', null, { strict: true })).resolves.toEqual({ xp: 1 });
    });
});
