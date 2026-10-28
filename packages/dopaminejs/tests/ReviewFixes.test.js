import { describe, it, expect, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { validate, deviceIds, xpOf } from '../src/dopamine/core/store.js';
import { merge as mergeDocs } from '../src/dopamine/core/merge.js';
import { shiftDay } from '../src/dopamine/core/streaks.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const PLAYER = 'dopamine_player';
const DEVICE = 'dopamine_device';

const ids = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`d${i}`, 1]));
const full = (n = 20) => ({ v: 3, xpBy: ids(n) });

const start = async (doc, device = null) => {
    const storage = createMemoryStorage();
    storage.setItem(PLAYER, JSON.stringify(doc));
    if (device) storage.setItem(DEVICE, JSON.stringify(device));
    const rewards = new RewardSystem(new DataService({ storage }));
    const failed = vi.fn();
    rewards.on('load_failed', failed);
    await rewards.init();
    return { storage, rewards, failed };
};

describe('the 20 device cap on a local write', () => {
    it('refuses addXP from a new device and leaves the stored save alone', async () => {
        const { storage, rewards, failed } = await start(full(), 'newcomer');
        failed.mockClear();
        const before = storage.getItem(PLAYER);

        const result = await rewards.addXP(50);

        expect(result.xpGained).toBe(0);
        expect(storage.getItem(PLAYER)).toBe(before);
        expect(failed).toHaveBeenCalledWith({ key: 'player', reason: 'too_many_devices' });
        expect(rewards.snapshot().xp).toBe(20);
        expect(rewards.loadFailed).toBe(false);
    });

    it('refuses record from a new device', async () => {
        const { storage, rewards } = await start(full(), 'newcomer');
        const before = storage.getItem(PLAYER);

        expect(await rewards.record('quiz', { score: 5 })).toBe(false);

        expect(storage.getItem(PLAYER)).toBe(before);
        expect(rewards.snapshot().totalGamesPlayed).toBe(0);
    });

    it('lets a device already in the save keep playing', async () => {
        const { storage, rewards } = await start(full(), 'd3');

        await rewards.addXP(50);

        expect(() => validate(JSON.parse(storage.getItem(PLAYER)))).not.toThrow();
        expect(rewards.snapshot().xp).toBe(70);
    });

    it('counts the legacy key, so legacy plus 19 devices is full', async () => {
        const migrated = validate({ xp: 100, totalGamesPlayed: 3 });
        for (let i = 0; i < 19; i++) migrated.xpBy[`d${i}`] = 1;
        const { storage, rewards } = await start(migrated, 'newcomer');
        const before = storage.getItem(PLAYER);

        await rewards.addXP(5);

        expect(storage.getItem(PLAYER)).toBe(before);
    });

    it('counts ids that appear only in sumsBy', () => {
        const sums = {};
        for (let i = 0; i < 21; i++) sums[`d${i}`] = 1;
        const doc = { v: 3, sumsBy: { quiz: { coins: sums } } };

        expect(deviceIds(validate({ v: 3, sumsBy: { quiz: { coins: ids(20) } } })).size).toBe(20);
        expect(() => validate(doc)).toThrow('at most 20 devices');
    });
});

describe('the version rule', () => {
    it.each(['3', '2', 4, null, Number.NaN, true])('refuses v %s', (v) => {
        expect(() => validate({ v, xpBy: { a: 5 } })).toThrow(/save version/);
    });

    it('still reads a save with no v as 2.x', () => {
        expect(validate({ xp: 120 }).xpBy).toEqual({ legacy: 120 });
    });
});

describe('play dates ahead of today', () => {
    it('drops dates more than a day after today and keeps tomorrow', () => {
        const doc = validate({ v: 3, playDates: ['2026-08-07', '2026-08-08', '2026-08-09'] }, { today: '2026-08-07' });

        expect(doc.playDates).toEqual(['2026-08-07', '2026-08-08']);
    });

    it('drops a long run of future dates', () => {
        const future = Array.from({ length: 200 }, (_, i) => shiftDay('2026-08-20', i));
        const doc = validate({ v: 3, playDates: ['2026-08-07', ...future] }, { today: '2026-08-07' });

        expect(doc.playDates).toEqual(['2026-08-07']);
    });
});

describe('overflow', () => {
    it('clamps sums, so xp and level stay finite', () => {
        const doc = validate({ v: 3, xpBy: { a: Number.MAX_VALUE, b: Number.MAX_VALUE } });

        expect(doc.xpBy.a).toBe(Number.MAX_SAFE_INTEGER);
        expect(Number.isFinite(xpOf(doc))).toBe(true);
        expect(xpOf(doc)).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });

    it('clamps what addXP and record add on one device', async () => {
        const { rewards } = await start({ v: 3, xpBy: { me: Number.MAX_SAFE_INTEGER - 1 }, gamesBy: { me: Number.MAX_SAFE_INTEGER } }, 'me');

        await rewards.addXP(1e6);
        await rewards.record('quiz', { score: 1, coins: 1e300 });
        await rewards.record('quiz', { score: 1, coins: 1e300 });

        const snap = rewards.snapshot();
        expect(Number.isFinite(snap.xp)).toBe(true);
        expect(Number.isFinite(snap.level)).toBe(true);
        expect(rewards._doc.xpBy.me).toBe(Number.MAX_SAFE_INTEGER);
        expect(rewards._doc.gamesBy.me).toBe(Number.MAX_SAFE_INTEGER);
        expect(rewards._doc.sumsBy.quiz.coins.me).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('merge of two clamped docs stays finite', () => {
        const a = { v: 3, xpBy: { a: Number.MAX_VALUE } };
        const b = { v: 3, xpBy: { b: Number.MAX_VALUE } };

        expect(Number.isFinite(xpOf(mergeDocs(a, b)))).toBe(true);
    });
});

describe('streakDays any', () => {
    it('does not mark a play day for addXP(0) or a negative amount', async () => {
        const { rewards } = await start({ v: 3, xpBy: { me: 100 } }, 'me');
        rewards.streakDays = 'any';

        await rewards.addXP(0);
        await rewards.addXP(-10);
        expect(rewards._doc.playDates).toEqual([]);

        await rewards.addXP(5);
        expect(rewards._doc.playDates).toHaveLength(1);
    });
});

describe('the device id when its key cannot be read', () => {
    const unreadable = (failWrites = 0) => {
        const storage = createMemoryStorage();
        const getItem = storage.getItem.bind(storage);
        const setItem = storage.setItem.bind(storage);
        let left = failWrites;
        storage.getItem = (key) => {
            if (key === DEVICE) throw new Error('offline');
            return getItem(key);
        };
        storage.setItem = (key, value) => {
            if (key === DEVICE && left > 0) {
                left--;
                throw new Error('full');
            }
            return setItem(key, value);
        };
        return { storage, raw: getItem };
    };

    it('saves the id with the first write that works', async () => {
        const { storage, raw } = unreadable();
        const rewards = new RewardSystem(new DataService({ storage }));
        await rewards.init();
        await rewards.addXP(5);

        const id = JSON.parse(raw(DEVICE));
        expect(Object.keys(rewards._doc.xpBy)).toEqual([id]);
    });

    it('retries after a failed device write', async () => {
        const { storage, raw } = unreadable(1);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const rewards = new RewardSystem(new DataService({ storage }));
        await rewards.init();
        expect(raw(DEVICE)).toBeNull();

        await rewards.addXP(5);

        expect(JSON.parse(raw(DEVICE))).toBe(Object.keys(rewards._doc.xpBy)[0]);
        vi.restoreAllMocks();
    });
});
