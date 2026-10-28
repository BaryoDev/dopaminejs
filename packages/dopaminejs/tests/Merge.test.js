import { describe, it, expect, afterEach, vi } from 'vitest';
import { isDeepStrictEqual } from 'node:util';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { DopamineError } from '../src/dopamine/core/DopamineError.js';
import { merge } from '../src/dopamine/core/merge.js';
import { validate } from '../src/dopamine/core/store.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const sorted = (value) => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
    }
    return value;
};
const same = (a, b) => isDeepStrictEqual(sorted(a), sorted(b));

const docA = () => ({
    v: 3,
    name: 'Ana',
    createdAt: 100,
    lastPlayedAt: 500,
    level: 2,
    longest: 2,
    playDates: ['2026-03-01', '2026-03-02'],
    xpBy: { a: 120 },
    xpSpentBy: { a: 10 },
    gamesBy: { a: 3 },
    playsBy: { snake: { a: 3 } },
    best: { snake: 40 },
    sumsBy: { snake: { apples: { a: 5 } } },
    achievements: { first_game: { unlockedAt: 300, seen: false, reward: 50 } }
});

const docB = () => ({
    v: 3,
    name: 'Ana B',
    createdAt: 90,
    lastPlayedAt: 800,
    level: 3,
    longest: 4,
    playDates: ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'],
    xpBy: { b: 200, a: 100 },
    xpSpentBy: { b: 30 },
    gamesBy: { b: 4, a: 2 },
    playsBy: { snake: { b: 4, a: 2 }, pong: { b: 1 } },
    best: { snake: 90, pong: 3 },
    sumsBy: { snake: { apples: { b: 7, a: 9 } } },
    achievements: {
        first_game: { unlockedAt: 250, seen: true, reward: 50 },
        level_5: { unlockedAt: 700, seen: false, reward: 100 }
    }
});

const docC = () => ({
    v: 3,
    name: 'Ana C',
    createdAt: 95,
    lastPlayedAt: 650,
    level: 1,
    longest: 1,
    playDates: ['2026-04-01'],
    xpBy: { c: 40 },
    xpSpentBy: {},
    gamesBy: { c: 1 },
    playsBy: { quiz: { c: 1 } },
    best: { quiz: 8 },
    sumsBy: {},
    achievements: {}
});

describe('merge', () => {
    it('should give the same result in either order', () => {
        expect(same(merge(docA(), docB()), merge(docB(), docA()))).toBe(true);
    });

    it('should give the same result however three saves are grouped', () => {
        const left = merge(merge(docA(), docB()), docC());
        const right = merge(docA(), merge(docB(), docC()));
        expect(same(left, right)).toBe(true);
    });

    it('should not change when a save is merged with itself', () => {
        const once = merge(docA(), docB());
        expect(same(merge(once, once), once)).toBe(true);
        expect(same(merge(once, docA()), once)).toBe(true);
    });

    it('should not touch its inputs', () => {
        const a = docA();
        const b = docB();
        merge(a, b);
        expect(a).toEqual(docA());
        expect(b).toEqual(docB());
    });

    it('should keep every device and take the larger count per key', () => {
        const merged = merge(docA(), docB());

        expect(merged.xpBy).toEqual({ a: 120, b: 200 });
        expect(merged.gamesBy).toEqual({ a: 3, b: 4 });
        expect(merged.playsBy.snake).toEqual({ a: 3, b: 4 });
        expect(merged.best.snake).toBe(90);
        expect(merged.sumsBy.snake.apples).toEqual({ a: 9, b: 7 });
    });

    it('should unite play days and take the larger longest', () => {
        const merged = merge(docA(), docB());

        expect(merged.playDates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
        expect(merged.longest).toBe(4);
    });

    it('should keep the earliest unlockedAt for an achievement both unlocked', () => {
        const merged = merge(docA(), docB());

        expect(merged.achievements.first_game.unlockedAt).toBe(250);
        expect(merged.achievements.level_5.unlockedAt).toBe(700);
    });

    it('should count XP as earned, plus rewards, minus spent', () => {
        const total = validate(merge(docA(), docB()));
        const xpBy = Object.values(total.xpBy).reduce((a, b) => a + b, 0);
        const rewards = Object.values(total.achievements).reduce((a, e) => a + e.reward, 0);
        const spent = Object.values(total.xpSpentBy).reduce((a, b) => a + b, 0);

        expect(xpBy + rewards - spent).toBe(120 + 200 + 50 + 100 - 10 - 30);
    });

    it('should keep the level as a max register', () => {
        expect(merge(docA(), docB()).level).toBe(3);
        expect(merge(docB(), docC()).level).toBe(3);
    });

    it('should keep every play day, even with a date far in the future', () => {
        const merged = merge({ v: 3, playDates: ['2020-01-01'] }, { v: 3, playDates: ['2099-01-01'] });

        expect(merged.playDates).toEqual(['2020-01-01', '2099-01-01']);
    });

    it('should trim against the given today, dropping dates past tomorrow', () => {
        const a = { v: 3, playDates: ['2025-07-03', '2025-07-04'] };
        const b = { v: 3, playDates: ['2099-01-01'] };

        const merged = merge(a, b, { today: '2026-08-07' });

        expect(merged.playDates).toEqual(['2025-07-04']);
        expect(same(merge(b, a, { today: '2026-08-07' }), merged)).toBe(true);
    });

    it('should keep unknown achievement ids', () => {
        const a = docA();
        a.achievements.from_a_newer_build = { unlockedAt: 5, seen: false, reward: 10 };

        expect(merge(a, docB()).achievements.from_a_newer_build).toBeDefined();
    });

    it('should never make __proto__ an own property', () => {
        const hostile = JSON.parse('{"v":3,"xpBy":{"__proto__":9,"d":1},"playsBy":{"__proto__":{"x":{}}}}');
        const merged = merge(hostile, docA());

        expect(Object.prototype.hasOwnProperty.call(merged.xpBy, '__proto__')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(merged.playsBy, '__proto__')).toBe(false);
        expect({}.x).toBeUndefined();
    });

    it('should throw too_many_devices past 20 devices', () => {
        const wide = (prefix, n) => {
            const doc = { v: 3 };
            doc.xpBy = Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, 1]));
            return doc;
        };

        expect(() => merge(wide('a', 10), wide('b', 10))).not.toThrow();
        expect(() => merge(wide('a', 10), wide('a', 10))).not.toThrow();
        expect(() => merge(wide('a', 11), wide('b', 10))).toThrow(DopamineError);
        try {
            merge(wide('a', 11), wide('b', 10));
        } catch (error) {
            expect(error.code).toBe('too_many_devices');
        }
    });

    it('should throw unsupported_version for a newer save', () => {
        try {
            merge({ v: 4 }, docA());
            throw new Error('did not throw');
        } catch (error) {
            expect(error.code).toBe('unsupported_version');
        }
    });

    it('should read no clock', () => {
        const spy = vi.spyOn(Date, 'now');
        merge(docA(), docB());
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('merge of 2.x saves', () => {
    it('should not double a 2.x save that two copies both migrate', () => {
        const old = { name: 'Ana', xp: 400, level: 3, totalGamesPlayed: 5, stats: { snake: { totalPlays: 5, highScore: 30 } } };

        const merged = merge(old, old);

        const player = validate(merged);
        expect(Object.values(player.xpBy).reduce((a, b) => a + b, 0)).toBe(400);
        expect(player.playsBy.snake.legacy).toBe(5);
    });
});

describe('device id', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const open = async (storage) => {
        const rewards = new RewardSystem(new DataService({ storage }));
        await rewards.init();
        return rewards;
    };

    it('should be made once and kept outside the document', async () => {
        const storage = createMemoryStorage();
        const first = await open(storage);

        const id = JSON.parse(storage.getItem('dopamine_device'));
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        expect(JSON.stringify(first.export())).not.toContain(id);
    });

    it('should survive a reload', async () => {
        const storage = createMemoryStorage();
        await open(storage);
        const id = storage.getItem('dopamine_device');

        const again = await open(storage);
        await again.addXP(5);

        expect(storage.getItem('dopamine_device')).toBe(id);
        expect(Object.keys(again.export().xpBy)).toEqual([JSON.parse(id)]);
    });

    it('should differ between two fresh storages', async () => {
        const a = createMemoryStorage();
        const b = createMemoryStorage();
        await open(a);
        await open(b);

        expect(a.getItem('dopamine_device')).not.toBe(b.getItem('dopamine_device'));
    });

    it('should fall back to Math.random when crypto is missing', async () => {
        vi.stubGlobal('crypto', undefined);
        const random = vi.spyOn(Math, 'random');
        const storage = createMemoryStorage();

        await open(storage);

        expect(random).toHaveBeenCalled();
        expect(JSON.parse(storage.getItem('dopamine_device'))).toMatch(/^[0-9a-f]{16}$/);
        random.mockRestore();
    });
});

describe('export and import', () => {
    const open = async () => {
        const rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));
        await rewards.init();
        return rewards;
    };

    it('should round trip a player onto a fresh one', async () => {
        const source = await open();
        await source.record('snake', { score: 120 });
        await source.addXP(40);

        const target = await open();
        await target.import(source.export());

        const a = source.snapshot();
        const b = target.snapshot();
        expect(b.xp).toBe(a.xp);
        expect(b.level).toBe(a.level);
        expect(b.stats).toEqual(a.stats);
        expect(Object.keys(b.achievements)).toEqual(Object.keys(a.achievements));
    });

    it('should hand out a copy that cannot change the player', async () => {
        const rewards = await open();
        await rewards.addXP(10);

        const doc = rewards.export();
        doc.xpBy = {};

        expect(rewards.snapshot().xp).toBe(10);
    });

    it('should announce the delta unless it is silent', async () => {
        const source = await open();
        await source.record('snake', { score: 500 });
        const doc = source.export();

        const loud = await open();
        const xp = vi.fn();
        const level = vi.fn();
        const unlocked = vi.fn();
        loud.on('xp_gained', xp);
        loud.on('level_up', level);
        loud.on('achievement_unlocked', unlocked);
        await loud.import(doc);

        expect(xp).toHaveBeenCalledTimes(1);
        expect(xp.mock.calls[0][0].amount).toBe(source.snapshot().xp);
        expect(level).toHaveBeenCalledTimes(1);
        expect(unlocked).toHaveBeenCalled();

        const quiet = await open();
        const quietXp = vi.fn();
        quiet.on('xp_gained', quietXp);
        await quiet.import(doc, { silent: true });

        expect(quietXp).not.toHaveBeenCalled();
        expect(quiet.snapshot().xp).toBe(source.snapshot().xp);
    });

    it('should announce nothing when the import adds nothing', async () => {
        const rewards = await open();
        await rewards.record('snake', { score: 10 });
        const xp = vi.fn();
        rewards.on('xp_gained', xp);

        await rewards.import(rewards.export());

        expect(xp).not.toHaveBeenCalled();
    });

    it('should refuse a document that does not validate', async () => {
        const rewards = await open();

        await expect(rewards.import({ v: 9 })).rejects.toMatchObject({ code: 'unsupported_version' });
        expect(rewards.snapshot().xp).toBe(0);
    });

    it('should not double a 2.x save imported on two fresh players', async () => {
        const old = { name: 'Ana', xp: 400, level: 3 };
        const one = await open();
        const two = await open();
        await one.import(old, { silent: true });
        await two.import(old, { silent: true });

        await one.import(two.export(), { silent: true });

        expect(one.snapshot().xp).toBe(400);
    });
});
