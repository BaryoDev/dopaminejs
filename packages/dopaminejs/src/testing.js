/**
 * Test kit for parts and plugins: a host that records what it is asked to
 * show, the part conformance suites, and a loader for the spec fixtures.
 * Needs vitest for the suites. Not for production code.
 */

import { describe, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDopamine, HOST_API } from './dopamine/host.js';
import { createMemoryStorage } from './dopamine/utils/storage.js';
import { systemClock } from './dopamine/core/clock.js';

const CORE_EVENTS = {
    xp_gained: { amount: 10, reason: 'test', totalXP: 10, leveledUp: false },
    level_up: { oldLevel: 1, newLevel: 2, totalXP: 50 },
    achievement_unlocked: { id: 'test', name: 'Test', description: 'Test', icon: '', xp: 5 },
    personal_best: { activity: 'test', score: 10 },
    streak_updated: { current: 1, longest: 1 },
    player_reset: {},
    save_failed: { error: new Error('save failed') },
    load_failed: { reason: 'corrupt' }
};
const BURST_KINDS = ['confetti', 'sparkle', 'fire', 'stars', 'coins'];
const SOUND_KEYS = ['xp', 'level_up', 'achievement', 'personal_best', 'click', 'error'];
const ODD_KEYS = ['', 'nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty', undefined, null, 42, {}];
const CLOCK_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const fail = (message) => {
    throw new Error(message);
};
const assert = (condition, message) => {
    if (!condition) fail(message);
};

// --- Test host ---------------------------------------------------------------

function makeClock(start) {
    if (start !== null && typeof start === 'object') {
        return { clock: start, move: () => fail('this clock is not a test clock, it cannot advance') };
    }
    const at = start === undefined ? '2026-01-15T09:00:00' : start;
    if (typeof at !== 'string' || !CLOCK_FORMAT.test(at)) fail('clock must be YYYY-MM-DDTHH:MM:SS local time');
    let ms = new Date(at).getTime();
    return {
        clock: { now: () => ms, localDate: (value = ms) => systemClock.localDate(value) },
        move: (next) => { ms = next(ms); }
    };
}

/**
 * @param {Object} [options]
 * @param {string|{now(): number, localDate(ms?: number): string}} [options.clock]
 *   Local time `YYYY-MM-DDTHH:MM:SS`, default 2026-01-15T09:00:00.
 * @param {Object} [options.storage]
 * @param {Object} [options.parts] - Replaces the recording part of the same name.
 *   `false` means none. Other createDopamine options (`plugins`, `streakDays`) pass through.
 */
export function createTestHost(options = {}) {
    const { clock: clockOption, storage, parts: overrides = {}, ...rest } = options || {};
    const { clock, move } = makeClock(clockOption);

    const popups = [];
    const texts = [];
    const huds = [];
    const bursts = [];
    const sounds = [];
    const soundKeys = new Set();
    const haptics = [];

    const recorders = {
        ui: () => ({
            root: null,
            hud: (state) => { huds.push(state); },
            popup: (popup) => { popups.push(popup); },
            text: (text) => { texts.push(text); },
            destroy() {}
        }),
        particles: () => ({
            burst: (kind, at, opts) => { bursts.push({ kind, at, opts }); },
            destroy() {}
        }),
        sound: () => ({
            play: (key) => { sounds.push(key); },
            register(key) {
                soundKeys.add(key);
                return () => { soundKeys.delete(key); };
            },
            destroy() {}
        }),
        haptics: () => ({
            tap: () => { haptics.push('tap'); },
            double: () => { haptics.push('double'); },
            setEnabled() {},
            destroy() {}
        })
    };
    const chosen = {};
    for (const name of Object.keys(recorders)) {
        const own = Object.prototype.hasOwnProperty.call(overrides, name);
        chosen[name] = own ? overrides[name] : recorders[name]();
    }

    const host = createDopamine({
        ...rest,
        ...chosen,
        storage: storage || createMemoryStorage(),
        clock,
        log: { warn: () => {}, error: () => {}, ...(rest.log || {}) }
    });

    // Every event on the bus, plugin events included.
    const log = [];
    const emit = host.progress.emit;
    host.progress.emit = function recordedEmit(event, data) {
        log.push({ event, data });
        return emit.call(this, event, data);
    };

    const dispose = () => {
        host.dispose();
        host.progress.emit = emit;
    };

    return {
        host,
        progress: host.progress,
        parts: host.parts,
        ready: host.ready,
        use: host.use,
        dispose,
        clock,
        popups,
        texts,
        huds,
        bursts,
        sounds,
        soundKeys,
        haptics,
        events: {
            log,
            on: (event, callback) => host.progress.on(event, callback),
            off: (event, callback) => host.progress.off(event, callback),
            emit: (event, data) => host.progress.emit(event, data)
        },
        advance: (ms) => move((now) => now + ms),
        advanceDays(days) {
            move((now) => {
                const date = new Date(now);
                date.setDate(date.getDate() + days);
                return date.getTime();
            });
        },
        setClock(at) {
            if (!CLOCK_FORMAT.test(at)) fail('clock must be YYYY-MM-DDTHH:MM:SS local time');
            move(() => new Date(at).getTime());
        }
    };
}

// --- Conformance -------------------------------------------------------------

const settle = async (value) => { await value; };

const domSnapshot = () => (typeof document === 'undefined' ? null : document.body.innerHTML);

const withParts = () => createTestHost().parts;

const particles = (make) => [
    ['draws every burst kind without throwing', async () => {
        const part = make();
        try {
            for (const kind of BURST_KINDS) {
                part.burst(kind);
                part.burst(kind, { x: 10, y: 20 });
                part.burst(kind, { x: 10, y: 20 }, { count: 3, color: '#fff' });
            }
        } finally {
            part.destroy();
        }
    }],
    ['treats an unknown kind as a no-op', async () => {
        const part = make();
        try {
            for (const kind of ODD_KEYS) part.burst(kind, { x: 1, y: 1 });
        } finally {
            part.destroy();
        }
    }],
    ['has destroy', async () => {
        const part = make();
        assert(typeof part.destroy === 'function', 'a particle part needs destroy()');
        part.destroy();
    }]
];

const sound = (make) => [
    ['plays every preset key without throwing', async () => {
        const part = make();
        try {
            for (const key of SOUND_KEYS) await settle(part.play(key));
        } finally {
            part.destroy();
        }
    }],
    ['treats an unknown key as a no-op', async () => {
        const part = make();
        try {
            for (const key of ODD_KEYS) await settle(part.play(key));
        } finally {
            part.destroy();
        }
    }],
    ['stops a registered key after its remover runs', async () => {
        const part = make();
        try {
            if (typeof part.register !== 'function') return;
            let calls = 0;
            const remove = part.register('conformance_key', () => { calls += 1; });
            assert(typeof remove === 'function', 'register() must return a remover');
            remove();
            await settle(part.play('conformance_key'));
            assert(calls === 0, 'a removed key still played');
        } finally {
            part.destroy();
        }
    }]
];

const ui = (make) => [
    ['draws the hud', async () => {
        const part = make(withParts());
        try {
            part.hud({ xp: 10, level: 1, progress: 0.2, streak: 0, next: 50 });
            part.hud({ xp: 0, level: 1, streak: 3 });
        } finally {
            part.destroy();
        }
    }],
    ['shows every popup kind and tier', async () => {
        const part = make(withParts());
        try {
            for (const kind of ['achievement', 'level', 'notice', 'custom']) {
                for (const tier of [undefined, 'common', 'rare', 'legendary']) {
                    part.popup({ kind, title: 'T', body: 'B', icon: 'I', meta: 'M', tier });
                }
            }
        } finally {
            part.destroy();
        }
    }],
    ['ignores a popup it cannot read', async () => {
        const part = make(withParts());
        try {
            for (const bad of [undefined, null, 42, 'text', {}, { kind: '__proto__' }]) part.popup(bad);
        } finally {
            part.destroy();
        }
    }],
    ['floats text', async () => {
        const part = make(withParts());
        try {
            part.text({ text: 'hello', x: 5, y: 5, color: '#fff' });
            part.text({ text: 'hello' });
        } finally {
            part.destroy();
        }
    }],
    ['has a root that is an element or null', async () => {
        const part = make(withParts());
        try {
            const root = part.root;
            assert(root === null || (typeof root === 'object' && typeof root.nodeType === 'number'), 'root must be an element or null');
        } finally {
            part.destroy();
        }
    }],
    ['leaves no DOM behind after destroy', async () => {
        const before = domSnapshot();
        const part = make(withParts());
        part.hud({ xp: 1, level: 1, streak: 1 });
        part.popup({ kind: 'achievement', title: 'T' });
        part.text({ text: 'x' });
        part.destroy();
        assert(domSnapshot() === before, 'the page changed after destroy()');
    }]
];

const STORAGE_KEY = 'conformance_key';

const storage = (make) => [
    ['returns null for a missing key', async () => {
        const store = make();
        for (const key of [STORAGE_KEY, '__proto__', 'constructor', 'toString']) {
            assert((await store.getItem(key)) === null, `getItem(${key}) should be null`);
        }
    }],
    ['keeps what setItem stores and overwrites it', async () => {
        const store = make();
        await store.setItem(STORAGE_KEY, 'one');
        assert((await store.getItem(STORAGE_KEY)) === 'one', 'getItem should return the stored value');
        await store.setItem(STORAGE_KEY, 'two');
        assert((await store.getItem(STORAGE_KEY)) === 'two', 'setItem should overwrite');
    }],
    ['keeps keys apart', async () => {
        const store = make();
        await store.setItem('a', '1');
        await store.setItem('b', '2');
        assert((await store.getItem('a')) === '1' && (await store.getItem('b')) === '2', 'keys must not share a value');
    }],
    ['forgets a key after removeItem', async () => {
        const store = make();
        await store.setItem(STORAGE_KEY, 'one');
        await store.removeItem(STORAGE_KEY);
        assert((await store.getItem(STORAGE_KEY)) === null, 'removeItem should clear the key');
        await store.removeItem(STORAGE_KEY);
    }]
];

// Timers a case starts and does not clear or finish.
function watchTimers() {
    const live = new Set();
    const real = {};
    const names = ['setTimeout', 'setInterval', 'requestAnimationFrame'];
    const clears = { setTimeout: 'clearTimeout', setInterval: 'clearInterval', requestAnimationFrame: 'cancelAnimationFrame' };
    for (const name of names) {
        real[name] = globalThis[name];
        real[clears[name]] = globalThis[clears[name]];
        if (typeof real[name] !== 'function') continue;
        globalThis[name] = (callback, ...args) => {
            const once = name !== 'setInterval';
            let id;
            const wrapped = (...inner) => {
                if (once) live.delete(id);
                return callback(...inner);
            };
            id = real[name](wrapped, ...args);
            live.add(id);
            return id;
        };
        if (typeof real[clears[name]] === 'function') {
            globalThis[clears[name]] = (id) => {
                live.delete(id);
                return real[clears[name]](id);
            };
        }
    }
    return {
        live: () => live.size,
        stop() {
            for (const id of live) {
                real.clearTimeout?.(id);
                real.clearInterval?.(id);
                real.cancelAnimationFrame?.(id);
            }
            for (const name of Object.keys(real)) {
                if (typeof real[name] === 'function') globalThis[name] = real[name];
            }
        }
    };
}

const countListeners = (progress) => {
    let total = 0;
    for (const set of progress.listeners.values()) total += set.size;
    return total;
};

async function withPluginHost(make, run) {
    const watch = watchTimers();
    const errors = [];
    const realError = console.error;
    console.error = (...args) => { errors.push(args); };
    const test = createTestHost();
    try {
        await test.ready;
        await run(test, { watch, errors });
    } finally {
        console.error = realError;
        test.dispose();
        watch.stop();
    }
}

const plugin = (make) => [
    ['has a name, a version and the host api', async () => {
        const p = make();
        assert(typeof p.name === 'string' && p.name !== '', 'a plugin needs a name');
        assert(typeof p.version === 'string' && p.version !== '', 'a plugin needs a version');
        assert(p.api === HOST_API, `a plugin needs api ${HOST_API}`);
        assert(typeof p.install === 'function', 'a plugin needs install()');
    }],
    ['installs on a host and survives every core event', async () => {
        await withPluginHost(make, async (test, { errors }) => {
            test.use(make());
            await test.ready;
            for (const event of Object.keys(CORE_EVENTS)) test.progress.emit(event, CORE_EVENTS[event]);
            await test.progress.addXP(5, 'conformance');
            assert(errors.length === 0, `a listener threw: ${String(errors[0]?.[1] ?? errors[0]?.[0])}`);
        });
    }],
    ['leaves no listeners, timers or DOM behind once disposed', async () => {
        await withPluginHost(make, async (test, { watch }) => {
            await test.ready;
            const listeners = countListeners(test.progress);
            const dom = domSnapshot();
            const timers = watch.live();

            const dispose = test.use(make());
            await test.progress.addXP(1, 'conformance');
            for (const event of Object.keys(CORE_EVENTS)) test.progress.emit(event, CORE_EVENTS[event]);
            await test.ready;
            dispose();

            assert(countListeners(test.progress) === listeners, 'the plugin left listeners on the bus');
            assert(watch.live() <= timers, 'the plugin left timers running');
            assert(domSnapshot() === dom, 'the plugin left DOM in the page');
        });
    }]
];

const SUITES = { particles, sound, ui, storage, plugin };

const suite = (name) => (make) => {
    describe(`conformance.${name}`, () => {
        for (const [title, run] of SUITES[name](make)) it(title, run);
    });
};

/** Each suite is a vitest `describe` block. */
export const conformance = {
    particles: suite('particles'),
    sound: suite('sound'),
    ui: suite('ui'),
    storage: suite('storage'),
    plugin: suite('plugin')
};

/**
 * Runs a suite without vitest's describe and returns the titles that failed,
 * so a test can prove a bad part is caught.
 * @param {'particles'|'sound'|'ui'|'storage'|'plugin'} name
 * @param {Function} make
 * @returns {Promise<string[]>}
 */
export async function conformanceFailures(name, make) {
    if (!Object.prototype.hasOwnProperty.call(SUITES, name)) fail(`unknown suite ${String(name)}`);
    const failed = [];
    for (const [title, run] of SUITES[name](make)) {
        try {
            await run();
        } catch {
            failed.push(title);
        }
    }
    return failed;
}

// --- Fixtures ----------------------------------------------------------------

function specDir() {
    // dist/ and the built package keep spec/ one level up. From src/ in the
    // repo, the copy may not exist yet, so fall back to the repo root.
    // The CommonJS build has __dirname and no import.meta.
    const here = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath(import.meta.url));
    for (const path of ['../spec', '../../../spec']) {
        const dir = resolve(here, path);
        if (existsSync(join(dir, 'VERSION'))) return dir;
    }
    return fail('spec/ was not found next to this package');
}

/**
 * Reads the conformance fixtures shipped in `spec/`.
 * @param {string} [dir] - A spec folder, default the one in this package.
 * @returns {{ contract: number, schema: Object, suites: Object }} `suites` is keyed by suite name.
 */
export function loadFixtures(dir) {
    const root = dir || specDir();
    const contract = Number(/contract:\s*(\d+)/.exec(readFileSync(join(root, 'VERSION'), 'utf8'))?.[1]);
    const schema = JSON.parse(readFileSync(join(root, 'schema.json'), 'utf8'));
    const suites = {};
    for (const file of readdirSync(join(root, 'fixtures')).sort()) {
        if (!file.endsWith('.json')) continue;
        const fixture = JSON.parse(readFileSync(join(root, 'fixtures', file), 'utf8'));
        suites[fixture.suite] = fixture;
    }
    return { contract, schema, suites };
}
