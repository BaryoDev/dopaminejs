import { describe, it, expect, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const KEY = 'dopamine_player';
const DEVICE = 'dopamine_device';
const START = new Date('2026-08-07T09:00:00').getTime();

// A 2.x save, so the stored xp is easy to read: 5000 under the legacy device.
const saved = () => ({ name: 'Ana', xp: 5000, level: 10 });

const pad = (value) => String(value).padStart(2, '0');
const makeClock = () => {
    let ms = START;
    return {
        now: () => ms,
        localDate: (at = ms) => {
            const date = new Date(at);
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        },
        advance: (by) => { ms += by; }
    };
};

// A memory store whose first `failures` reads of the player throw. `reads()` counts every read of it.
const flakyStorage = (failures = 1) => {
    const storage = createMemoryStorage();
    const getItem = storage.getItem.bind(storage);
    let left = failures;
    let reads = 0;
    storage.getItem = (key) => {
        if (key === KEY) {
            reads++;
            if (left > 0) {
                left--;
                throw new Error('offline');
            }
        }
        return getItem(key);
    };
    storage.reads = () => reads;
    storage.setItem(KEY, JSON.stringify(saved()));
    return storage;
};

const make = (storage, clock = makeClock(), config = {}) => ({
    clock,
    rewards: new RewardSystem(new DataService({ storage }), { clock, builtinAchievements: false, ...config })
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const total = (storage) => {
    const doc = JSON.parse(storage.getItem(KEY));
    const sum = (map) => Object.values(map).reduce((a, b) => a + b, 0);
    return sum(doc.xpBy) - sum(doc.xpSpentBy);
};

describe('RewardSystem after a failed read, once storage reads again', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('saves the merged player, fires load_recovered once and clears loadFailed', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        const recovered = vi.fn();
        rewards.on('load_recovered', recovered);
        await rewards.init();
        await rewards.addXP(10);
        expect(rewards.loadFailed).toBe(true);
        expect(recovered).not.toHaveBeenCalled();

        clock.advance(30000);
        await rewards.addXP(5);

        // Stored by the recovering call itself, before any later write could save it.
        expect(rewards.loadFailed).toBe(false);
        expect(recovered).toHaveBeenCalledTimes(1);
        expect(recovered.mock.calls[0][0]).toEqual({ key: 'player' });
        expect(rewards.snapshot().xp).toBe(5015);
        expect(total(storage)).toBe(5015);

        await rewards.addXP(1);
        expect(recovered).toHaveBeenCalledTimes(1);
        expect(total(storage)).toBe(5016);
    });

    it('saves nothing when the retry fails again, and keeps the session', async () => {
        const storage = flakyStorage(2);
        const setItem = vi.spyOn(storage, 'setItem');
        const { rewards, clock } = make(storage);
        const recovered = vi.fn();
        rewards.on('load_recovered', recovered);
        await rewards.init();
        await rewards.addXP(10);

        clock.advance(30000);
        await rewards.addXP(5);

        expect(rewards.loadFailed).toBe(true);
        expect(recovered).not.toHaveBeenCalled();
        expect(rewards.snapshot().xp).toBe(15);
        expect(setItem).not.toHaveBeenCalled();
    });

    it('limits the reads to one per interval', async () => {
        const storage = flakyStorage(2);
        const { rewards, clock } = make(storage);
        await rewards.init();
        expect(storage.reads()).toBe(1);

        for (let i = 0; i < 5; i++) await rewards.addXP(1);
        expect(storage.reads()).toBe(1);

        clock.advance(30000);
        for (let i = 0; i < 5; i++) await rewards.addXP(1);
        expect(storage.reads()).toBe(2);
        expect(rewards.loadFailed).toBe(true);

        clock.advance(29999);
        await rewards.addXP(1);
        expect(storage.reads()).toBe(2);

        clock.advance(1);
        await rewards.addXP(1);
        expect(storage.reads()).toBe(3);
        expect(rewards.loadFailed).toBe(false);
        expect(total(storage)).toBe(5000 + 12);
    });

    it('does not read when nothing is blocked', async () => {
        const storage = flakyStorage(0);
        const { rewards, clock } = make(storage);
        await rewards.init();
        clock.advance(60000);
        await rewards.addXP(1);
        expect(storage.reads()).toBe(1);
    });

    it('does not write twice or lose a gain when addXP lands during a retry', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.addXP(10);

        let release;
        const getItem = storage.getItem;
        let hung = 0;
        storage.getItem = (key) => {
            if (key !== KEY) return getItem(key);
            hung++;
            return new Promise((resolve) => { release = () => resolve(getItem(key)); });
        };
        const writes = [];
        const setItem = storage.setItem;
        storage.setItem = (key, value) => {
            if (key === KEY) writes.push(JSON.parse(value));
            return setItem(key, value);
        };

        clock.advance(30000);
        const first = rewards.addXP(20);
        const second = rewards.addXP(30);
        await settle();
        expect(hung).toBe(1);
        expect(writes).toHaveLength(0);

        release();
        await Promise.all([first, second]);
        storage.getItem = getItem;

        expect(writes).toHaveLength(1);
        expect(rewards.snapshot().xp).toBe(5060);
        expect(total(storage)).toBe(5060);
    });

    it('merges the session as it stands when the retry resolves', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();

        let release;
        const getItem = storage.getItem;
        storage.getItem = (key) => (key === KEY
            ? new Promise((resolve) => { release = () => resolve(getItem(key)); })
            : getItem(key));
        clock.advance(30000);
        const first = rewards.addXP(20);
        await settle();
        const late = rewards.addXP(30);
        release();
        await Promise.all([first, late]);
        storage.getItem = getItem;

        expect(total(storage)).toBe(5050);
    });

    it('stays blocked when the saved value now parses but is not a player', async () => {
        const storage = flakyStorage();
        const setItem = vi.spyOn(storage, 'setItem');
        const { rewards, clock } = make(storage);
        await rewards.init();
        storage.setItem(KEY, '[1,2]');
        setItem.mockClear();

        clock.advance(30000);
        await rewards.addXP(5);

        expect(rewards.loadFailed).toBe(true);
        expect(setItem).not.toHaveBeenCalled();
        expect(storage.getItem(KEY)).toBe('[1,2]');
        expect(rewards.snapshot().xp).toBe(5);
    });

    it('stays blocked when the saved player is a version it refuses', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();
        const future = JSON.stringify({ v: 99, xpBy: { a: 1 } });
        storage.setItem(KEY, future);
        const setItem = vi.spyOn(storage, 'setItem');

        clock.advance(30000);
        await rewards.addXP(5);

        expect(rewards.loadFailed).toBe(true);
        expect(setItem).not.toHaveBeenCalled();
        expect(storage.getItem(KEY)).toBe(future);
    });

    it('stays blocked when the merge would pass the device limit', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();
        const xpBy = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`d${i}`, 1]));
        const full = JSON.stringify({ v: 3, xpBy });
        storage.setItem(KEY, full);

        clock.advance(30000);
        await rewards.addXP(5);

        expect(rewards.loadFailed).toBe(true);
        expect(storage.getItem(KEY)).toBe(full);
    });

    it('keeps init() working: it loads the saved player and the session is replaced', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.addXP(10);

        clock.advance(30000);
        await rewards.init();
        expect(rewards.loadFailed).toBe(false);
        expect(rewards.snapshot().xp).toBe(5000);
        await rewards.addXP(1);
        expect(total(storage)).toBe(5001);
    });

    it('never lets a saved __proto__ achievement id reach the merged player', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();
        storage.setItem(KEY, '{"v":3,"xpBy":{"x":1},"achievements":{"__proto__":{"unlockedAt":1,"seen":true,"reward":9},"ok":{"unlockedAt":2,"seen":false,"reward":3}}}');

        clock.advance(30000);
        await rewards.addXP(1);

        expect(Object.keys(rewards.export().achievements)).toEqual(['ok']);
        expect({}.seen).toBeUndefined();
        expect(rewards.snapshot().xp).toBe(1 + 1 + 3);
        expect(Object.keys(JSON.parse(storage.getItem(KEY)).achievements)).toEqual(['ok']);
    });

    it('adopts the stored device id when the device read failed too, so no second device is made', async () => {
        const storage = flakyStorage();
        storage.setItem(DEVICE, JSON.stringify('dev-real'));
        storage.setItem(KEY, JSON.stringify({ v: 3, xpBy: { 'dev-real': 100 } }));
        const deviceRead = storage.getItem;
        let failDevice = true;
        storage.getItem = (key) => {
            if (key === DEVICE && failDevice) throw new Error('offline');
            return deviceRead(key);
        };
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.addXP(10);
        failDevice = false;

        clock.advance(30000);
        await rewards.addXP(5);

        const doc = JSON.parse(storage.getItem(KEY));
        expect(Object.keys(doc.xpBy)).toEqual(['dev-real']);
        expect(doc.xpBy['dev-real']).toBe(115);
        expect(JSON.parse(storage.getItem(DEVICE))).toBe('dev-real');
    });

    it('lets two tabs each merge their session once, and loses nothing', async () => {
        const storage = flakyStorage(2);
        const a = make(storage);
        const b = make(storage);
        await a.rewards.init();
        await b.rewards.init();
        await a.rewards.addXP(10);
        await b.rewards.addXP(20);

        a.clock.advance(30000);
        b.clock.advance(30000);
        await a.rewards.addXP(1);
        await b.rewards.addXP(1);

        expect(a.rewards.loadFailed).toBe(false);
        expect(b.rewards.loadFailed).toBe(false);
        expect(total(storage)).toBe(5000 + 11 + 21);
    });

    const ownBackup = () => ({
        v: 3,
        xpBy: { 'dev-a': 100 },
        xpSpentBy: {},
        gamesBy: { 'dev-a': 2 },
        playsBy: { g: { 'dev-a': 2 } },
        best: {},
        sumsBy: { g: { wins: { 'dev-a': 1 } } },
        achievements: {},
        level: 1
    });
    const withOwnSave = () => {
        const storage = flakyStorage();
        storage.setItem(DEVICE, JSON.stringify('dev-a'));
        storage.setItem(KEY, JSON.stringify(ownBackup()));
        return { storage };
    };

    it('does not count this device\'s own backup twice when it was imported while blocked', async () => {
        const { storage } = withOwnSave();
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.import(ownBackup(), { silent: true });

        clock.advance(30000);
        await rewards.addXP(1);
        await rewards.record('g', { wins: 1 });

        const doc = JSON.parse(storage.getItem(KEY));
        expect(rewards.loadFailed).toBe(false);
        expect(doc.gamesBy['dev-a']).toBe(3);
        expect(doc.playsBy.g['dev-a']).toBe(3);
        expect(doc.sumsBy.g.wins['dev-a']).toBe(2);
        expect(Object.keys(doc.xpBy)).toEqual(['dev-a']);
        expect(doc.xpBy['dev-a']).toBeGreaterThan(100);
        expect(doc.xpBy['dev-a']).toBeLessThan(150);
    });

    it('adds only the session\'s gain after an own backup import, exactly', async () => {
        const { storage } = withOwnSave();
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.addXP(5);
        await rewards.import(ownBackup(), { silent: true });
        await rewards.addXP(1);

        clock.advance(30000);
        await rewards.addXP(1);

        // 100 from the save, 5 + 1 + 1 earned this session.
        expect(JSON.parse(storage.getItem(KEY)).xpBy['dev-a']).toBe(107);
    });

    it('keeps an own backup that is ahead of the saved player', async () => {
        const { storage } = withOwnSave();
        const { rewards, clock } = make(storage);
        await rewards.init();
        const ahead = ownBackup();
        ahead.xpBy['dev-a'] = 150;
        ahead.gamesBy['dev-a'] = 5;
        await rewards.import(ahead, { silent: true });

        clock.advance(30000);
        await rewards.addXP(1);

        const doc = JSON.parse(storage.getItem(KEY));
        expect(doc.xpBy['dev-a']).toBe(151);
        expect(doc.gamesBy['dev-a']).toBe(5);
    });

    it('stays blocked when an import may have used the stored device id before it was known', async () => {
        const storage = flakyStorage();
        storage.setItem(DEVICE, JSON.stringify('dev-real'));
        const backup = { v: 3, xpBy: { 'dev-real': 100 } };
        storage.setItem(KEY, JSON.stringify(backup));
        const deviceRead = storage.getItem;
        let failDevice = true;
        storage.getItem = (key) => {
            if (key === DEVICE && failDevice) throw new Error('offline');
            return deviceRead(key);
        };
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.import(backup, { silent: true });
        failDevice = false;
        const setItem = vi.spyOn(storage, 'setItem');

        clock.advance(30000);
        await rewards.addXP(1);

        expect(rewards.loadFailed).toBe(true);
        expect(setItem).not.toHaveBeenCalled();
        expect(JSON.parse(storage.getItem(KEY))).toEqual(backup);
    });

    it('reports the merged total and level when a recovering addXP announces', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        const events = [];
        rewards.on('xp_gained', (payload) => events.push(['xp_gained', payload]));
        rewards.on('level_up', (payload) => events.push(['level_up', payload]));
        let afterXP;
        rewards.use({ afterXP: (context) => { afterXP = context; } });
        await rewards.init();

        clock.advance(30000);
        const result = await rewards.addXP(5);

        expect(rewards.snapshot().xp).toBe(5005);
        expect(events.map(([name]) => name)).toEqual(['xp_gained', 'level_up']);
        expect(events[0][1]).toMatchObject({ amount: 5, total: 5005, newLevel: 10, leveledUp: true });
        expect(events[1][1]).toEqual({ oldLevel: 1, newLevel: 10, totalXP: 5005 });
        expect(result).toEqual({ leveledUp: true, newLevel: 10, xpGained: 5 });
        expect(afterXP.total).toBe(5005);
        expect(afterXP.level).toBe(10);
    });

    it('does not make other callers wait on a retry that never settles', async () => {
        const storage = flakyStorage();
        const setItem = vi.spyOn(storage, 'setItem');
        const { rewards, clock } = make(storage);
        await rewards.init();

        const getItem = storage.getItem;
        let hung = 0;
        storage.getItem = (key) => {
            if (key !== KEY) return getItem(key);
            hung++;
            return new Promise(() => {});
        };
        clock.advance(30000);
        rewards.addXP(1);
        await settle();

        // These resolve, or the test times out.
        await rewards.addXP(2);
        await rewards.save();
        clock.advance(60000);
        await rewards.addXP(3);

        expect(hung).toBe(1);
        expect(rewards.loadFailed).toBe(true);
        expect(rewards.snapshot().xp).toBe(6);
        expect(setItem).not.toHaveBeenCalled();
    });

    it('retries when the clock has moved back', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();

        clock.advance(-5 * 3600000);
        await rewards.addXP(3);

        expect(rewards.loadFailed).toBe(false);
        expect(total(storage)).toBe(5003);
    });

    it('can still recover after reset({ overwrite: false }), and merges what was earned since', async () => {
        const storage = flakyStorage();
        const setItem = vi.spyOn(storage, 'setItem');
        const { rewards, clock } = make(storage);
        await rewards.init();
        await rewards.reset({ overwrite: false });
        expect(rewards.loadFailed).toBe(true);
        expect(setItem).not.toHaveBeenCalled();

        clock.advance(30000);
        await rewards.addXP(3);

        expect(rewards.loadFailed).toBe(false);
        expect(total(storage)).toBe(5003);
    });

    it('stays blocked when the retry reads a value that is not valid JSON', async () => {
        const storage = flakyStorage();
        const { rewards, clock } = make(storage);
        await rewards.init();
        storage.setItem(KEY, '{bad');
        const setItem = vi.spyOn(storage, 'setItem');

        clock.advance(30000);
        await rewards.addXP(3);

        expect(rewards.loadFailed).toBe(true);
        expect(setItem).not.toHaveBeenCalled();
        expect(storage.getItem(KEY)).toBe('{bad');
    });
});
