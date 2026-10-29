import { describe, it, expect } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { merge } from '../src/dopamine/core/merge.js';

const BUILTIN_IDS = ['first_game', 'level_5', 'level_10', 'streak_3', 'streak_7'];

// A clock the test can move, so a streak can build over real calendar days.
const makeClock = (start = '2031-03-01') => {
    let day = start;
    return {
        now: () => Date.parse(`${day}T12:00:00`),
        localDate: () => day,
        set: (next) => { day = next; }
    };
};

const build = async (config = {}, storage = createMemoryStorage()) => {
    const clock = config.clock || makeClock();
    const system = new RewardSystem(new DataService({ storage }), { ...config, clock });
    await system.init();
    return { system, clock, storage };
};

const unlockedIds = (system) => Object.keys(system.snapshot().achievements);

describe('RewardSystem builtinAchievements: false', () => {
    it('defines none of the built-ins', async () => {
        const { system } = await build({ builtinAchievements: false });
        for (const id of BUILTIN_IDS) expect(Object.hasOwn(system.achievements, id)).toBe(false);
    });

    it('unlocks nothing on a first win and adds no reward XP', async () => {
        const { system } = await build({ builtinAchievements: false });
        await system.record('g', { score: 0 });
        expect(unlockedIds(system)).toEqual([]);
        expect(system.snapshot().xp).toBe(10);
    });

    it('unlocks nothing at level 5', async () => {
        const { system } = await build({ builtinAchievements: false });
        await system.addXP(2000);
        expect(system.snapshot().level).toBeGreaterThanOrEqual(5);
        await system.record('g');
        expect(unlockedIds(system)).toEqual([]);
        expect(system.snapshot().xp).toBe(2010);
    });

    it('unlocks nothing on a 3 day streak', async () => {
        const { system, clock } = await build({ builtinAchievements: false });
        let expected = 0;
        for (const day of ['2031-03-01', '2031-03-02', '2031-03-03']) {
            clock.set(day);
            const before = system.snapshot().xp;
            await system.record('g');
            expected += system.snapshot().xp - before;
        }
        expect(system.snapshot().streak.current).toBe(3);
        expect(unlockedIds(system)).toEqual([]);
        expect(system.snapshot().xp).toBe(expected);
        expect(system.snapshot().xp).toBe(10 + 10 + Math.floor(10 * 1.25));
    });

    it('still unlocks custom achievements', async () => {
        const { system } = await build({
            builtinAchievements: false,
            achievements: { mine: { name: 'Mine', xp: 20, check: (player) => player.totalGamesPlayed >= 1 } }
        });
        await system.record('g');
        expect(unlockedIds(system)).toEqual(['mine']);
        expect(system.snapshot().xp).toBe(30);
    });

    it('lets defineAchievement add a built-in id by hand', async () => {
        const { system } = await build({ builtinAchievements: false });
        system.defineAchievement('first_game', { name: 'Mine', xp: 7, check: () => true });
        await system.record('g');
        expect(unlockedIds(system)).toEqual(['first_game']);
        expect(system.snapshot().xp).toBe(17);
    });

    it.each([undefined, true, 'false', 0, null, {}])('treats %j as true', async (value) => {
        const { system } = await build({ builtinAchievements: value });
        for (const id of BUILTIN_IDS) expect(Object.hasOwn(system.achievements, id)).toBe(true);
    });
});

describe('RewardSystem builtinAchievements default', () => {
    it('unlocks first_game with its reward when the option is not given', async () => {
        const { system } = await build();
        await system.record('g');
        expect(unlockedIds(system)).toEqual(['first_game']);
        expect(system.snapshot().xp).toBe(60);
    });

    it('defines all five built-ins', async () => {
        const { system } = await build();
        expect(Object.keys(system.achievements)).toEqual(BUILTIN_IDS);
    });
});

describe('RewardSystem builtinAchievements: false with a held built-in', () => {
    const heldDoc = () => ({
        v: 3,
        name: 'Player',
        createdAt: 1,
        lastPlayedAt: 1,
        level: 1,
        longest: 0,
        playDates: [],
        xpBy: { phone: 25 },
        xpSpentBy: {},
        gamesBy: { phone: 1 },
        playsBy: { g: { phone: 1 } },
        best: { g: 0 },
        sumsBy: { g: {} },
        achievements: { first_game: { unlockedAt: 5, seen: true, reward: 50 } }
    });

    it('loads a document that holds first_game with the same XP and achievement', async () => {
        const seeded = () => {
            const storage = createMemoryStorage();
            storage.setItem('dopamine_player', JSON.stringify(heldDoc()));
            return storage;
        };
        const on = await build({}, seeded());
        const { system } = await build({ builtinAchievements: false }, seeded());
        await system.import(heldDoc(), { silent: true });

        expect(system.snapshot().xp).toBe(75);
        expect(system.snapshot().xp).toBe(on.system.snapshot().xp);
        expect(unlockedIds(system)).toEqual(['first_game']);
        expect(system.export().achievements.first_game.reward).toBe(50);
        expect(system.export()).toEqual(on.system.export());
    });

    it('reads a 2.x save with the built-in reward, so XP and the entry stay put', async () => {
        const legacy = {
            xp: 500, level: 3, totalGamesPlayed: 7,
            achievements: { first_game: { unlockedAt: 1, seen: true } }
        };
        const off = await build({ builtinAchievements: false });
        const on = await build({});
        await off.system.import(legacy, { silent: true });
        await on.system.import(legacy, { silent: true });

        expect(off.system.snapshot().xp).toBe(500);
        expect(off.system.export()).toEqual(on.system.export());
        expect(off.system.export().achievements.first_game.reward).toBe(50);
    });

    it('re-exports unchanged after more play', async () => {
        const { system } = await build({ builtinAchievements: false });
        await system.import(heldDoc(), { silent: true });
        await system.record('g');
        expect(unlockedIds(system)).toEqual(['first_game']);
        expect(system.snapshot().xp).toBe(85);
        expect(system.export().achievements.first_game).toEqual({ unlockedAt: 5, seen: true, reward: 50 });
        expect(merge(system.export(), system.export())).toEqual(system.export());
    });

    it('returns the held built-in with its id and stored fields but no name', async () => {
        const { system } = await build({ builtinAchievements: false });
        await system.import(heldDoc(), { silent: true });
        const [held] = system.getUnlockedAchievements();
        expect(held).toEqual({ id: 'first_game', unlockedAt: 5, seen: true, reward: 50 });
        expect(held.name).toBeUndefined();
        expect(system.getUnseenAchievements()).toEqual([]);
    });

    it('keeps the achievements of a document exported by a device with the option on', async () => {
        const phone = await build({});
        await phone.system.record('g');
        const exported = phone.system.export();
        expect(Object.keys(exported.achievements)).toEqual(['first_game']);

        const web = await build({ builtinAchievements: false });
        await web.system.record('g');
        await web.system.import(exported);

        expect(unlockedIds(web.system)).toEqual(['first_game']);
        expect(web.system.snapshot().xp).toBe(phone.system.snapshot().xp + 10);
        expect(web.system.export().achievements.first_game.reward).toBe(50);

        // Merging back gives the phone nothing new and nothing doubled.
        await phone.system.import(web.system.export(), { silent: true });
        expect(phone.system.snapshot().xp).toBe(web.system.snapshot().xp);
    });
});

describe('RewardSystem import events for achievement ids', () => {
    const docWith = (ids) => ({
        v: 3,
        name: 'Player',
        createdAt: 1,
        lastPlayedAt: 1,
        level: 1,
        longest: 0,
        playDates: [],
        xpBy: { phone: 25 },
        xpSpentBy: {},
        gamesBy: { phone: 1 },
        playsBy: { g: { phone: 1 } },
        best: { g: 0 },
        sumsBy: { g: {} },
        achievements: Object.fromEntries(ids.map((id) => [id, { unlockedAt: 5, seen: true, reward: 50 }]))
    });

    const listen = (system) => {
        const events = [];
        system.on('achievement_unlocked', (payload) => events.push(payload));
        return events;
    };

    it('fires no unlock event for a built-in id when builtinAchievements is false, and keeps the id', async () => {
        const { system } = await build({ builtinAchievements: false });
        const events = listen(system);
        await system.import(docWith(['first_game']));
        expect(events).toEqual([]);
        expect(unlockedIds(system)).toEqual(['first_game']);
        expect(system.getUnlockedAchievements().map((a) => a.id)).toEqual(['first_game']);
    });

    it('fires no unlock event for an id in no table, and keeps the id', async () => {
        const { system } = await build({});
        const events = listen(system);
        await system.import(docWith(['nowhere']));
        expect(events).toEqual([]);
        expect(unlockedIds(system)).toEqual(['nowhere']);
    });

    it('still fires the unlock event for a defined id the player lacks', async () => {
        const { system } = await build({});
        const events = listen(system);
        await system.import(docWith(['first_game']));
        expect(events).toHaveLength(1);
        expect(events[0].id).toBe('first_game');
        expect(events[0].name).toEqual(expect.any(String));
        expect(events[0].xp).toEqual(expect.any(Number));
    });
});
