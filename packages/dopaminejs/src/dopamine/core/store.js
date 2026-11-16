import { DopamineError } from './DopamineError.js';
import { BUILTIN_REWARDS } from './achievements.js';
import { levelFor } from './levels.js';
import { isDay, shiftDay, trimDays, currentStreak, longestRun, lastDayUntil } from './streaks.js';

export const VERSION = 3;
export const MAX_DEVICES = 20;
export const LEGACY = 'legacy';

// Keys that resolve to something on Object.prototype. Game names, achievement
// ids and device ids index plain objects, so these are never used as one.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const isSafeKey = (key) => typeof key === 'string' && key.length > 0 && !UNSAFE_KEYS.has(key);
export const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// A number read from storage: a finite number, or a string that holds one
// ("250", " 12 "). Anything else is undefined and falls back to the default.
export function toNumber(value) {
    if (typeof value === 'string' && value.trim() !== '') value = Number(value);
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export const cap = (value) => Math.min(value, Number.MAX_SAFE_INTEGER);

// Each reader returns the number, or undefined when the value does not fit.
const asNumber = toNumber;
const asAmount = (value) => {
    const number = toNumber(value);
    return number !== undefined && number >= 0 ? number : undefined;
};
const asCount = (value) => {
    const number = toNumber(value);
    return Number.isInteger(number) && number >= 0 ? number : undefined;
};
const numberOr = (value, fallback) => asNumber(value) ?? fallback;
const amountOr = (value, fallback) => asAmount(value) ?? fallback;
const count = (value, fallback, min = 0) => {
    const number = toNumber(value);
    return Number.isInteger(number) && number >= min ? cap(number) : fallback;
};

// Summed in key order, so the same document always gives the same float.
export const sum = (map, pick = (value) => value) => Object.keys(map).sort().reduce((total, key) => cap(total + pick(map[key])), 0);

export const emptyDoc = (now = 0) => ({
    v: VERSION,
    name: 'Player',
    createdAt: now,
    lastPlayedAt: now,
    level: 1,
    longest: 0,
    playDates: [],
    xpBy: {},
    xpSpentBy: {},
    gamesBy: {},
    playsBy: {},
    best: {},
    sumsBy: {},
    achievements: {}
});

function pickMap(source, read) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const key of Object.keys(source)) {
        const number = isSafeKey(key) ? read(source[key]) : undefined;
        if (number !== undefined) map[key] = cap(number);
    }
    return map;
}

function pickNested(source, read) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const key of Object.keys(source)) {
        if (isSafeKey(key)) map[key] = pickMap(source[key], read);
    }
    return map;
}

function pickAchievements(source, now) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const id of Object.keys(source)) {
        const entry = source[id];
        if (!isSafeKey(id) || !isRecord(entry)) continue;
        map[id] = {
            unlockedAt: numberOr(entry.unlockedAt, now),
            seen: entry.seen === true,
            reward: cap(amountOr(entry.reward, 0))
        };
    }
    return map;
}

// Fields of a document, and of a 2.x save, that the core reads. Any other
// top level field is kept as it was read, so a newer version's data survives.
export const DOC_KEYS = new Set(['v', 'name', 'createdAt', 'lastPlayedAt', 'level', 'longest', 'playDates', 'xpBy', 'xpSpentBy', 'gamesBy', 'playsBy', 'best', 'sumsBy', 'achievements']);
const READ_KEYS = new Set([...DOC_KEYS, 'xp', 'totalGamesPlayed', 'stats', 'streak']);

// A copy that holds only what JSON can: unsafe keys, functions, undefined and
// non-finite numbers are dropped. Deep input stops at 32 levels.
function plain(value, depth = 0) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (depth >= 32) return undefined;
    if (Array.isArray(value)) return value.map((item) => plain(item, depth + 1) ?? null);
    if (!isRecord(value)) return undefined;
    const copy = {};
    for (const key of Object.keys(value)) {
        const item = isSafeKey(key) ? plain(value[key], depth + 1) : undefined;
        if (item !== undefined) copy[key] = item;
    }
    return copy;
}

function keepExtras(input, doc) {
    for (const key of Object.keys(input)) {
        if (READ_KEYS.has(key) || !isSafeKey(key)) continue;
        const value = plain(input[key]);
        if (value !== undefined) doc[key] = value;
    }
    return doc;
}

export const extraKeys = (doc) => Object.keys(doc).filter((key) => !DOC_KEYS.has(key));

// Every activity has a play map, a best and a sum map, so merge never has to
// ask whether one exists.
function finish(doc) {
    const sums = doc.sumsBy;
    const activities = new Set([...Object.keys(doc.playsBy), ...Object.keys(doc.best), ...Object.keys(sums)]);
    for (const activity of activities) {
        if (!hasOwn(doc.playsBy, activity)) doc.playsBy[activity] = {};
        if (!hasOwn(doc.best, activity)) doc.best[activity] = 0;
        if (!hasOwn(sums, activity)) sums[activity] = {};
    }
    return doc;
}

function read3(input, now, today) {
    return keepExtras(input, finish({
        v: VERSION,
        name: typeof input.name === 'string' ? input.name : 'Player',
        createdAt: numberOr(input.createdAt, now),
        lastPlayedAt: numberOr(input.lastPlayedAt, now),
        level: count(input.level, 1, 1),
        longest: count(input.longest, 0),
        playDates: trimDays(Array.isArray(input.playDates) ? input.playDates.filter(isDay) : [], today),
        xpBy: pickMap(input.xpBy, asAmount),
        xpSpentBy: pickMap(input.xpSpentBy, asAmount),
        gamesBy: pickMap(input.gamesBy, asCount),
        playsBy: pickNested(input.playsBy, asCount),
        best: pickMap(input.best, asAmount),
        sumsBy: nestedSums(input.sumsBy),
        achievements: pickAchievements(input.achievements, now)
    }));
}

function nestedSums(source) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const activity of Object.keys(source)) {
        if (isSafeKey(activity)) map[activity] = pickNested(source[activity], asAmount);
    }
    return map;
}

// A 2.x document, moved under the fixed legacy key. Two devices that read the
// same save get the same entries, so they merge by max and nothing doubles.
function read2(input, now, rewards, today) {
    const doc = emptyDoc(now);
    doc.name = typeof input.name === 'string' ? input.name : 'Player';
    doc.createdAt = numberOr(input.createdAt, now);
    doc.lastPlayedAt = numberOr(input.lastPlayedAt, now);
    doc.achievements = pickAchievements(input.achievements, now);

    let granted = 0;
    for (const id of Object.keys(doc.achievements)) {
        const reward = hasOwn(rewards, id) ? cap(amountOr(rewards[id], 0)) : 0;
        doc.achievements[id].reward = reward;
        granted += reward;
    }

    // The old xp already holds the rewards of the unlocked achievements.
    const xp = cap(amountOr(input.xp, 0));
    const own = Math.max(0, xp - granted);
    if (own > 0) doc.xpBy[LEGACY] = own;
    doc.level = Math.max(levelFor(xp), count(input.level, 1, 1));
    const games = count(input.totalGamesPlayed, 0);
    if (games > 0) doc.gamesBy[LEGACY] = games;

    if (isRecord(input.stats)) {
        for (const activity of Object.keys(input.stats)) {
            const entry = input.stats[activity];
            if (!isSafeKey(activity) || !isRecord(entry)) continue;
            const plays = count(entry.totalPlays, 0);
            doc.playsBy[activity] = plays > 0 ? { [LEGACY]: plays } : {};
            doc.best[activity] = cap(amountOr(entry.highScore, 0));
            doc.sumsBy[activity] = {};
            for (const key of Object.keys(entry)) {
                if (!isSafeKey(key) || key === 'totalPlays' || key === 'highScore') continue;
                const amount = asAmount(entry[key]);
                if (amount !== undefined) doc.sumsBy[activity][key] = { [LEGACY]: cap(amount) };
            }
        }
    }

    const streak = isRecord(input.streak) ? input.streak : {};
    const current = count(streak.current, 1, 1);
    doc.longest = Math.max(current, count(streak.longest, 0));
    if (isDay(streak.lastPlayDate)) {
        // A date after today (a clock change) counts as today, so the streak stays.
        const last = today && streak.lastPlayDate > today ? today : streak.lastPlayDate;
        for (let back = 0; back < Math.min(current, 400); back++) doc.playDates.push(shiftDay(last, -back));
        doc.playDates = trimDays(doc.playDates, today);
    } else {
        // No real date, so no current run. The counts stay as the best run.
        doc.longest = Math.max(count(streak.current, 0), count(streak.longest, 0));
    }

    return keepExtras(input, finish(doc));
}

export function deviceIds(doc) {
    const ids = new Set([...Object.keys(doc.xpBy), ...Object.keys(doc.xpSpentBy), ...Object.keys(doc.gamesBy)]);
    for (const activity of Object.keys(doc.playsBy)) {
        for (const id of Object.keys(doc.playsBy[activity])) ids.add(id);
    }
    for (const activity of Object.keys(doc.sumsBy)) {
        for (const key of Object.keys(doc.sumsBy[activity])) {
            for (const id of Object.keys(doc.sumsBy[activity][key])) ids.add(id);
        }
    }
    return ids;
}

export function checkDevices(doc) {
    if (deviceIds(doc).size > MAX_DEVICES) {
        throw new DopamineError('too_many_devices', `[DopamineJS] a save holds at most ${MAX_DEVICES} devices`);
    }
}

/**
 * Clean any value into a version 3 document, or throw a DopamineError.
 * Pure: no clock, no storage. A 2.x document (no `v`) is migrated.
 *
 * @param {*} input
 * @param {{ now?: number, today?: string, rewards?: Object }} [options] `now` fills missing
 *   timestamps, `today` (a local date) sets the 400 day window for play dates, `rewards` maps achievement ids to the XP a 2.x save already
 *   holds for them.
 */
export function validate(input, options = {}) {
    if (!isRecord(input)) {
        throw new DopamineError('invalid_document', '[DopamineJS] a save must be an object');
    }
    if (input.v !== undefined && input.v !== VERSION) {
        throw new DopamineError('unsupported_version', `[DopamineJS] save version ${String(input.v)} is not ${VERSION}`);
    }
    const now = Number.isFinite(options.now) ? options.now : 0;
    const today = isDay(options.today) ? options.today : undefined;
    const doc = input.v === VERSION
        ? read3(input, now, today)
        : read2(input, now, isRecord(options.rewards) ? options.rewards : BUILTIN_REWARDS, today);
    checkDevices(doc);
    return doc;
}

export const xpOf = (doc) => cap(Math.max(0, sum(doc.xpBy) + sum(doc.achievements, (entry) => entry.reward) - sum(doc.xpSpentBy)));

export const levelOf = (doc) => Math.max(doc.level, levelFor(xpOf(doc)));

/** The derived view of a document as of `today`. Not frozen. */
export function view(doc, today) {
    const stats = {};
    for (const activity of Object.keys(doc.playsBy)) {
        const entry = { plays: sum(doc.playsBy[activity]), best: doc.best[activity] };
        for (const key of Object.keys(doc.sumsBy[activity])) {
            if (key !== 'plays' && key !== 'best') entry[key] = sum(doc.sumsBy[activity][key]);
        }
        stats[activity] = entry;
    }

    const achievements = {};
    for (const id of Object.keys(doc.achievements)) achievements[id] = { ...doc.achievements[id] };

    const streak = {
        current: currentStreak(doc.playDates, today),
        longest: Math.max(doc.longest, longestRun(doc.playDates))
    };
    const last = lastDayUntil(doc.playDates, today);
    if (last) streak.lastPlayDate = last;

    return {
        name: doc.name,
        xp: xpOf(doc),
        level: levelOf(doc),
        totalGamesPlayed: sum(doc.gamesBy),
        createdAt: doc.createdAt,
        lastPlayedAt: doc.lastPlayedAt,
        streak,
        achievements,
        stats
    };
}

export const clone = (value) => JSON.parse(JSON.stringify(value));

export function freeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) freeze(value[key]);
    }
    return value;
}
