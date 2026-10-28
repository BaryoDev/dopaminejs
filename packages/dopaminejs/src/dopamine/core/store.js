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

const isCount = (value) => Number.isInteger(value) && value >= 0;
const isAmount = (value) => Number.isFinite(value) && value >= 0;
const isNumber = (value) => Number.isFinite(value);
export const cap = (value) => Math.min(value, Number.MAX_SAFE_INTEGER);
const count = (value, fallback, min = 0) => (Number.isInteger(value) && value >= min ? cap(value) : fallback);

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

function pickMap(source, accept) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const key of Object.keys(source)) {
        if (isSafeKey(key) && accept(source[key])) map[key] = cap(source[key]);
    }
    return map;
}

function pickNested(source, accept) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const key of Object.keys(source)) {
        if (isSafeKey(key)) map[key] = pickMap(source[key], accept);
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
            unlockedAt: isNumber(entry.unlockedAt) ? entry.unlockedAt : now,
            seen: entry.seen === true,
            reward: isAmount(entry.reward) ? cap(entry.reward) : 0
        };
    }
    return map;
}

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
    return finish({
        v: VERSION,
        name: typeof input.name === 'string' ? input.name : 'Player',
        createdAt: isNumber(input.createdAt) ? input.createdAt : now,
        lastPlayedAt: isNumber(input.lastPlayedAt) ? input.lastPlayedAt : now,
        level: count(input.level, 1, 1),
        longest: count(input.longest, 0),
        playDates: trimDays(Array.isArray(input.playDates) ? input.playDates.filter(isDay) : [], today),
        xpBy: pickMap(input.xpBy, isAmount),
        xpSpentBy: pickMap(input.xpSpentBy, isAmount),
        gamesBy: pickMap(input.gamesBy, isCount),
        playsBy: pickNested(input.playsBy, isCount),
        best: pickMap(input.best, isAmount),
        sumsBy: nestedSums(input.sumsBy),
        achievements: pickAchievements(input.achievements, now)
    });
}

function nestedSums(source) {
    const map = {};
    if (!isRecord(source)) return map;
    for (const activity of Object.keys(source)) {
        if (isSafeKey(activity)) map[activity] = pickNested(source[activity], isNumber);
    }
    return map;
}

// A 2.x document, moved under the fixed legacy key. Two devices that read the
// same save get the same entries, so they merge by max and nothing doubles.
function read2(input, now, rewards, today) {
    const doc = emptyDoc(now);
    doc.name = typeof input.name === 'string' ? input.name : 'Player';
    doc.createdAt = isNumber(input.createdAt) ? input.createdAt : now;
    doc.lastPlayedAt = isNumber(input.lastPlayedAt) ? input.lastPlayedAt : now;
    doc.achievements = pickAchievements(input.achievements, now);

    let granted = 0;
    for (const id of Object.keys(doc.achievements)) {
        const reward = hasOwn(rewards, id) && isAmount(rewards[id]) ? cap(rewards[id]) : 0;
        doc.achievements[id].reward = reward;
        granted += reward;
    }

    // The old xp already holds the rewards of the unlocked achievements.
    const xp = isAmount(input.xp) ? cap(input.xp) : 0;
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
            doc.best[activity] = isAmount(entry.highScore) ? cap(entry.highScore) : 0;
            doc.sumsBy[activity] = {};
            for (const key of Object.keys(entry)) {
                if (isSafeKey(key) && key !== 'totalPlays' && key !== 'highScore' && isNumber(entry[key])) {
                    doc.sumsBy[activity][key] = { [LEGACY]: cap(entry[key]) };
                }
            }
        }
    }

    const streak = isRecord(input.streak) ? input.streak : {};
    const current = count(streak.current, 1, 1);
    doc.longest = Math.max(current, count(streak.longest, 0));
    if (isDay(streak.lastPlayDate)) {
        for (let back = 0; back < Math.min(current, 400); back++) doc.playDates.push(shiftDay(streak.lastPlayDate, -back));
        doc.playDates = trimDays(doc.playDates, today);
    } else {
        doc.longest = count(streak.longest, 0);
    }

    return finish(doc);
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
    const now = isNumber(options.now) ? options.now : 0;
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
