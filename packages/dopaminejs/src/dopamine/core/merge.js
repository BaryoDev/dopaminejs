import { validate, checkDevices, hasOwn, extraKeys, VERSION } from './store.js';
import { isDay, trimDays } from './streaks.js';

// Join two maps that are `depth` levels deep, taking the larger number at the
// leaves. Max per key is what makes the join order independent.
function join(a, b, depth) {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const x = hasOwn(a, key) ? a[key] : undefined;
        const y = hasOwn(b, key) ? b[key] : undefined;
        if (depth > 0) out[key] = join(x || {}, y || {}, depth - 1);
        else out[key] = x === undefined ? y : y === undefined ? x : Math.max(x, y);
    }
    return out;
}

function joinAchievements(a, b) {
    const out = {};
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const x = hasOwn(a, id) ? a[id] : undefined;
        const y = hasOwn(b, id) ? b[id] : undefined;
        if (!x || !y) {
            out[id] = { ...(x || y) };
            continue;
        }
        // The earliest unlock decides the reward; a tie takes the larger.
        const first = x.unlockedAt < y.unlockedAt || (x.unlockedAt === y.unlockedAt && x.reward >= y.reward) ? x : y;
        out[id] = { unlockedAt: first.unlockedAt, seen: x.seen || y.seen, reward: first.reward };
    }
    return out;
}

// Same text for the same value whatever the key order, so the choice below does
// not depend on which side a value came from.
const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

// A field the core does not know has no rule to join by. One side only: kept.
// Both: the one with the larger text, the same in any order.
function joinExtras(x, y, doc) {
    for (const key of new Set([...extraKeys(x), ...extraKeys(y)])) {
        const a = hasOwn(x, key) ? x[key] : undefined;
        const b = hasOwn(y, key) ? y[key] : undefined;
        doc[key] = a === undefined ? b : b === undefined ? a : stable(a) >= stable(b) ? a : b;
    }
}

const positive = (a, b) => (a > 0 && b > 0 ? Math.min(a, b) : Math.max(a, b));

/**
 * Join two saves. Pure: it reads no clock and no storage, and the result does
 * not depend on argument order or grouping, or on merging twice.
 * Throws a DopamineError when either input is invalid or the result would
 * hold more than 20 devices.
 *
 * @param {*} a
 * @param {*} b
 * @param {{ today?: string, rewards?: Object }} [options] see validate
 */
export function merge(a, b, options) {
    const x = validate(a, options);
    const y = validate(b, options);
    const later = x.lastPlayedAt !== y.lastPlayedAt ? (x.lastPlayedAt > y.lastPlayedAt ? x : y) : (x.name >= y.name ? x : y);

    const doc = {
        v: VERSION,
        name: later.name,
        createdAt: positive(x.createdAt, y.createdAt),
        lastPlayedAt: Math.max(x.lastPlayedAt, y.lastPlayedAt),
        level: Math.max(x.level, y.level),
        longest: Math.max(x.longest, y.longest),
        playDates: trimDays([...x.playDates, ...y.playDates], isDay(options?.today) ? options.today : undefined),
        xpBy: join(x.xpBy, y.xpBy, 0),
        xpSpentBy: join(x.xpSpentBy, y.xpSpentBy, 0),
        gamesBy: join(x.gamesBy, y.gamesBy, 0),
        playsBy: join(x.playsBy, y.playsBy, 1),
        best: join(x.best, y.best, 0),
        sumsBy: join(x.sumsBy, y.sumsBy, 2),
        achievements: joinAchievements(x.achievements, y.achievements)
    };
    joinExtras(x, y, doc);
    checkDevices(doc);
    return doc;
}
