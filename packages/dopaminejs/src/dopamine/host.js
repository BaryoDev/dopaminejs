/**
 * The composition root. createDopamine() builds the parts, wires the default
 * feedback to the progress events and installs plugins on top.
 *
 * Nothing here touches the DOM until it is called.
 */

import { RewardSystem } from './core/RewardSystem.js';
import { DataService } from './core/DataService.js';
import { DopamineError } from './core/DopamineError.js';
import { systemClock } from './core/clock.js';
import { RewardUI } from './ui/RewardUI.js';
import { ParticleSystem } from './effects/ParticleSystem.js';
import { SoundManager } from './audio/SoundManager.js';
import { createHaptics } from './feel/haptics.js';
import { prefersReducedMotion } from './feel/motion.js';
import { resolveStorage } from './utils/storage.js';

export const HOST_API = 3;

const PART_NAMES = ['ui', 'particles', 'sound', 'haptics'];

const isThenable = (value) => value !== null && typeof value === 'object' && typeof value.then === 'function';

const settle = (value, log) => {
    if (isThenable(value)) value.then(undefined, (error) => log.error(error));
};

function makeEnv() {
    const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
    return { hasDom, reducedMotion: hasDom ? prefersReducedMotion(window).matches === true : false };
}

/**
 * A part is a value, a factory `(env) => Part | null`, or `false` for none.
 * A factory returning null (or no value at all) means use the default.
 */
function resolvePart(option, env, makeDefault) {
    if (option === false) return null;
    let part = option;
    if (typeof option === 'function') part = option(env);
    if (part === null || part === undefined) return makeDefault();
    return part;
}

function namespacedStorage(storage, name) {
    const prefix = `dopamine_${name}_`;
    return {
        getItem: (key) => storage.getItem(prefix + key),
        setItem: (key, value) => storage.setItem(prefix + key, value),
        removeItem: (key) => storage.removeItem(prefix + key)
    };
}

/**
 * @param {Object} [options]
 * @param {Object|Function|null} [options.progress] - A RewardSystem-like object or a factory
 * @param {Object|Function|false|null} [options.ui]
 * @param {Object|Function|false|null} [options.particles]
 * @param {Object|Function|false|null} [options.sound]
 * @param {Object|Function|false|null} [options.haptics]
 * @param {Object} [options.storage] - Storage port, default localStorage or memory
 * @param {{ now(): number, localDate(ms?: number): string }} [options.clock]
 * @param {Object[]} [options.plugins]
 * @param {{ debug?: Function, info?: Function, warn?: Function, error?: Function }} [options.log]
 */
export function createDopamine(options = {}) {
    const opts = options || {};
    const env = makeEnv();
    const log = {
        debug: () => {},
        info: () => {},
        warn: (...args) => console.warn(...args),
        error: (...args) => console.error(...args),
        ...(opts.log || {})
    };
    const storage = opts.storage || resolveStorage();
    const clock = opts.clock || systemClock;

    // Getters over a table that is only written while the host is built, so a
    // plugin always reads the part that is current and cannot replace one.
    const slots = { ui: null, particles: null, sound: null, haptics: null };
    const parts = {};
    for (const name of PART_NAMES) {
        Object.defineProperty(parts, name, { enumerable: true, get: () => slots[name] });
    }
    Object.freeze(parts);

    const factoryEnv = { ...env, parts, storage, clock };

    const progress = resolvePart(opts.progress, factoryEnv, () => new RewardSystem(new DataService({ storage }), { clock }));
    if (typeof progress?.on !== 'function' || typeof progress?.off !== 'function') {
        throw new DopamineError('invalid_progress', 'progress needs on() and off()');
    }

    slots.particles = resolvePart(opts.particles, factoryEnv, () => (env.hasDom ? new ParticleSystem() : null));
    slots.sound = resolvePart(opts.sound, factoryEnv, () => new SoundManager({ storage }));
    slots.haptics = resolvePart(opts.haptics, factoryEnv, () => createHaptics());
    try {
        slots.ui = resolvePart(opts.ui, factoryEnv, () => (env.hasDom ? new RewardUI(parts) : null));
    } catch (error) {
        destroyParts();
        throw error;
    }

    function destroyParts() {
        for (const name of PART_NAMES) {
            try {
                slots[name]?.destroy?.();
            } catch (error) {
                log.error(error);
            }
        }
    }

    const events = progress;
    const offs = [];
    let disposed = false;

    // Default feedback: the parts react to the core events.
    const react = (fn) => (data) => {
        try {
            const result = fn(data);
            settle(result, log);
        } catch (error) {
            log.error(error);
        }
    };
    const sync = () => {
        const ui = slots.ui;
        if (!ui || typeof progress.snapshot !== 'function' || typeof progress.getXPForNextLevel !== 'function') return;
        const player = progress.snapshot();
        const { total, progress: fraction } = progress.getXPForNextLevel();
        ui.hud({ xp: player.xp, level: player.level, progress: fraction, streak: player.streak.current, next: total });
    };
    offs.push(
        events.on('xp_gained', react((e) => {
            sync();
            if (!e.leveledUp) slots.sound?.play('xp');
        })),
        events.on('level_up', react((e) => {
            sync();
            slots.ui?.popup({ kind: 'level', title: '', body: String(e.newLevel) });
            slots.sound?.play('level_up');
        })),
        events.on('achievement_unlocked', react((a) => {
            slots.ui?.popup({
                kind: 'achievement',
                title: a.name,
                body: a.description,
                icon: a.icon,
                meta: `+${a.xp ?? 0} XP`
            });
            slots.sound?.play('achievement');
        })),
        events.on('streak_updated', react(sync)),
        events.on('personal_best', react((e) => {
            slots.ui?.popup({ kind: 'notice', title: `New High Score: ${e.score}!`, tier: 'legendary' });
            slots.sound?.play('personal_best');
        }))
    );

    // Plugins, by name. A record is created when an install starts and is
    // `done` once it has finished.
    const plugins = new Map();
    const order = [];

    function check(plugin) {
        if (plugin === null || typeof plugin !== 'object' || typeof plugin.name !== 'string' || plugin.name === ''
            || typeof plugin.install !== 'function') {
            throw new DopamineError('plugin_invalid', 'a plugin needs a name and an install function');
        }
        if (plugin.api !== HOST_API) {
            throw new DopamineError(
                'plugin_api',
                `${plugin.name} was built for api ${plugin.api}, this host is api ${HOST_API}`
            );
        }
        if (plugins.has(plugin.name)) {
            throw new DopamineError('plugin_duplicate', `${plugin.name} is already installed`);
        }
        for (const dep of plugin.after || []) {
            if (!plugins.has(dep) || !plugins.get(dep).done) {
                throw new DopamineError('plugin_order', `${plugin.name} must come after ${dep}`);
            }
        }
        for (const part of plugin.requires || []) {
            if (!PART_NAMES.includes(part) || slots[part] === null) {
                throw new DopamineError('plugin_requires', `${plugin.name} requires the ${part} part, which is not set`);
            }
        }
    }

    function release(record) {
        for (const off of record.offs) off();
        record.offs.clear();
        plugins.delete(record.name);
        const i = order.indexOf(record);
        if (i > -1) order.splice(i, 1);
    }

    function dispose1(record) {
        if (record.removed) return;
        record.removed = true;
        const disposer = record.disposer;
        record.disposer = null;
        try {
            disposer?.();
        } catch (error) {
            log.error(error);
        }
        release(record);
    }

    function context(record) {
        const { name } = record;
        const bus = {
            on(event, callback) {
                const off = events.on(event, callback);
                const tracked = () => {
                    off();
                    record.offs.delete(tracked);
                };
                record.offs.add(tracked);
                return tracked;
            },
            off: (event, callback) => events.off(event, callback),
            emit(event, data) {
                if (typeof event !== 'string' || !event.startsWith(`${name}:`)) {
                    throw new DopamineError('plugin_event', `${name} may only emit events named ${name}:<event>`);
                }
                events.emit(event, data);
            }
        };
        return {
            progress,
            parts,
            events: bus,
            storage: namespacedStorage(storage, name),
            clock,
            log,
            env: { hasDom: env.hasDom, reducedMotion: env.reducedMotion },
            plugin: (other) => (plugins.has(other) && plugins.get(other).done ? plugins.get(other).handle : null),
            expose: (handle) => { record.handle = handle; }
        };
    }

    // Returns the record, or a promise of it when install is async.
    function install(plugin) {
        if (disposed) throw new DopamineError('disposed', 'the host was disposed');
        check(plugin);
        const record = {
            name: plugin.name, done: false, removed: false, disposer: null, handle: null, offs: new Set()
        };
        plugins.set(plugin.name, record);

        const finish = (disposer) => {
            record.done = true;
            if (typeof disposer === 'function') record.disposer = disposer;
            if (record.removed || disposed) {
                record.removed = false;
                dispose1(record);
                return record;
            }
            order.push(record);
            return record;
        };
        const fail = (error) => {
            release(record);
            throw error;
        };

        let result;
        try {
            result = plugin.install(context(record));
        } catch (error) {
            return fail(error);
        }
        if (isThenable(result)) {
            return result.then(finish, fail);
        }
        return finish(result);
    }

    // Installs run one after another, so `after` sees finished plugins only.
    let tail = null;
    function enqueue(plugin) {
        if (disposed) throw new DopamineError('disposed', 'the host was disposed');
        if (tail === null) {
            const result = install(plugin);
            if (isThenable(result)) {
                const done = result.then((record) => record, (error) => { throw error; });
                tail = done.then(() => { tail = null; }, () => { tail = null; });
                return { record: null, done };
            }
            return { record: result, done: Promise.resolve(result) };
        }
        const done = tail.then(() => install(plugin));
        tail = done.then(() => { tail = null; }, () => { tail = null; });
        return { record: null, done };
    }

    function use(plugin) {
        const { record, done } = enqueue(plugin);
        if (record) return () => dispose1(record);
        let target = null;
        let early = false;
        done.then((r) => {
            target = r;
            if (early) dispose1(r);
        }, (error) => log.error(error));
        return () => {
            if (target) dispose1(target);
            else early = true;
        };
    }

    let readyChain = Promise.resolve();
    try {
        for (const plugin of opts.plugins || []) {
            const { done } = enqueue(plugin);
            readyChain = readyChain.then(() => done);
        }
    } catch (error) {
        // A plugin was refused: undo what was built.
        dispose();
        throw error;
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        for (const record of [...order].reverse()) dispose1(record);
        for (const record of [...plugins.values()]) dispose1(record);
        for (const off of offs) off();
        offs.length = 0;
        destroyParts();
        progress.clear?.();
    }

    const ready = readyChain
        .then(() => (typeof progress.init === 'function' ? progress.init() : undefined))
        .then(() => {
            if (!disposed) sync();
            return host;
        });
    ready.catch(() => {});

    const host = { progress, parts, events, ready, use, dispose };
    return host;
}
