import { validate, checkDevices, hasOwn, extraKeys, cap, clone, VERSION } from './store.js';
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
// Both: the larger number, else the larger text, the same in any order.
const larger = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && a !== b ? a > b : stable(a) >= stable(b)) ? a : b;

function joinExtras(x, y, doc) {
    for (const key of new Set([...extraKeys(x), ...extraKeys(y)])) {
        const a = hasOwn(x, key) ? x[key] : undefined;
        const b = hasOwn(y, key) ? y[key] : undefined;
        doc[key] = a === undefined ? b : b === undefined ? a : larger(a, b);
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

// Every counter map of a document by path, as a JSON array of keys.
function counterMaps(doc) {
    const maps = new Map([[JSON.stringify(['xpBy']), doc.xpBy], [JSON.stringify(['xpSpentBy']), doc.xpSpentBy], [JSON.stringify(['gamesBy']), doc.gamesBy]]);
    for (const activity of Object.keys(doc.playsBy)) maps.set(JSON.stringify(['playsBy', activity]), doc.playsBy[activity]);
    for (const activity of Object.keys(doc.sumsBy)) {
        for (const key of Object.keys(doc.sumsBy[activity])) {
            maps.set(JSON.stringify(['sumsBy', activity, key]), doc.sumsBy[activity][key]);
        }
    }
    return maps;
}

/** This device's counters in a document, by path. */
export function ownCounters(doc, device) {
    const out = new Map();
    for (const [path, map] of counterMaps(doc)) {
        if (hasOwn(map, device)) out.set(path, map[device]);
    }
    return out;
}

/** Add `by` (a path to amount map) to this device's counters in `doc`, in place. */
export function raiseOwn(doc, device, by) {
    for (const [path, amount] of by) {
        let node = doc;
        for (const key of JSON.parse(path)) {
            if (!hasOwn(node, key)) node[key] = {};
            node = node[key];
        }
        node[device] = cap((hasOwn(node, device) ? node[device] : 0) + amount);
    }
}

/**
 * Fold a session player into the saved one it could not read earlier. The
 * session started empty, so its counters for this device are new progress and
 * are added, not joined by max. Everything else joins like `merge`. The saved
 * player keeps its name and its unknown fields. Pure.
 *
 * `base` holds what an import put into this device's session counters (path to
 * amount, see `ownCounters`). That is not new progress, so it is joined by max
 * with the saved counter, and only what the session added on top is added.
 *
 * @param {*} saved the player read from storage
 * @param {*} session the player made since the failed read
 * @param {string} device this device's id
 * @param {{ today?: string, rewards?: Object }} [options] see validate
 * @param {Map<string, number>} [base]
 */
export function mergeSession(saved, session, device, options, base = new Map()) {
    const x = validate(saved, options);
    const y = validate(session, options);
    const doc = merge(x, y, options);
    doc.name = x.name;
    for (const key of extraKeys(x)) doc[key] = x[key];

    const mine = counterMaps(doc);
    const was = counterMaps(x);
    for (const [path, map] of counterMaps(y)) {
        if (!hasOwn(map, device)) continue;
        const imported = Math.min(base.get(path) ?? 0, map[device]);
        const stored = was.has(path) && hasOwn(was.get(path), device) ? was.get(path)[device] : 0;
        mine.get(path)[device] = cap(Math.max(stored, imported) + (map[device] - imported));
    }
    return doc;
}

/** A copy of a document with one device's entries moved under another id. */
export function rekey(doc, from, to) {
    const out = clone(doc);
    const move = (map) => {
        if (!hasOwn(map, from)) return;
        map[to] = hasOwn(map, to) ? Math.max(map[to], map[from]) : map[from];
        delete map[from];
    };
    for (const map of [out.xpBy, out.xpSpentBy, out.gamesBy]) move(map);
    for (const activity of Object.keys(out.playsBy)) move(out.playsBy[activity]);
    for (const activity of Object.keys(out.sumsBy)) {
        for (const key of Object.keys(out.sumsBy[activity])) move(out.sumsBy[activity][key]);
    }
    return out;
}
