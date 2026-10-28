/**
 * provideRewards() + useRewards()
 *
 * provideRewards() creates a single RewardSystem for the component tree below
 * the caller. useRewards() reads it from any descendant. The calling component
 * itself uses the object provideRewards() returns, since inject() does not
 * see a component's own provides.
 *
 * The RewardSystem subscribes to xp_gained, level_up, achievement_unlocked and
 * streak_updated, and the listeners are removed when the calling scope is
 * disposed. The emitter holds strong references, so a component that mounts
 * and unmounts repeatedly without cleanup would accumulate duplicate listeners.
 *
 * Usage, in the root component's setup:
 *   provideRewards({ config, storage });
 *
 * Inside any descendant:
 *   const { level, progress, addXP } = useRewards();
 */
import {
    getCurrentInstance,
    inject,
    onScopeDispose,
    provide,
    shallowRef,
} from 'vue';
import { RewardSystem, DataService } from 'dopaminejs';
import { buildState } from './state.js';

// Symbol.for, so the ESM and CJS copies of this package share one key.
const REWARDS_KEY = Symbol.for('dopaminejs-rewards');

// What each component instance already provided, to catch a second call.
const provided = new WeakMap();

// Event names emitted by RewardSystem are lowercase.
const EVENTS = ['xp_gained', 'level_up', 'achievement_unlocked', 'streak_updated'];

/**
 * @param {object} [options]
 * @param {object} [options.config]   passed straight to new RewardSystem(...)
 * @param {object} [options.storage]  custom storage (defaults to localStorage)
 * @returns the same object useRewards() returns
 */
export function provideRewards({ config, storage } = {}) {
    const instance = getCurrentInstance();
    if (!instance) {
        throw new Error(
            'provideRewards() must be called inside a component setup(). ' +
            'provide() does nothing outside a component.'
        );
    }
    if (provided.has(instance)) {
        console.warn('[dopaminejs-vue] provideRewards() was called twice in one component. Returning the first instance.');
        return provided.get(instance);
    }

    // Safe initial state so consumers always have all fields defined before
    // the async init() resolves.
    const player = shallowRef({});
    const level = shallowRef(1);
    const xp = shallowRef(0);
    const progress = shallowRef(0);
    const achievements = shallowRef([]);
    const ready = shallowRef(false);
    const error = shallowRef(null);
    const loadFailed = shallowRef(false);

    const dataService = new DataService({ storage });
    const rewards = new RewardSystem(dataService, config);

    let active = true;

    function sync() {
        if (!active) return;
        const next = buildState(rewards);
        player.value = next.player;
        level.value = next.level;
        xp.value = next.xp;
        progress.value = next.progress;
        achievements.value = next.achievements;
    }

    // A rejected init() must not escape as an unhandled rejection, which can
    // end a Node process during server rendering.
    rewards.init().then(() => {
        if (!active) return;
        sync();
        loadFailed.value = rewards.loadFailed;
        ready.value = true;
    }).catch((reason) => {
        if (active) error.value = reason;
    });

    for (const name of EVENTS) rewards.on(name, sync);

    onScopeDispose(() => {
        active = false;
        for (const name of EVENTS) rewards.off(name, sync);
    });

    const value = {
        player,
        level,
        xp,
        progress,
        achievements,
        ready,
        error,
        loadFailed,

        /**
         * Add XP to the current player.
         * @param {number} amount
         * @param {string} [reason] - carried on the xp_gained event
         * @returns {Promise<object>} what RewardSystem.addXP resolves with
         */
        addXP(amount, reason) {
            return rewards.addXP(amount, reason);
        },

        /**
         * Record a game session, which may award XP and update stats.
         * @param {string} gameId
         * @param {object} stats
         * @returns {Promise<void>}
         */
        record(gameId, stats) {
            return rewards.record(gameId, stats);
        },

        /**
         * Manually unlock an achievement by key.
         * @param {string} key
         * @returns {Promise<boolean>} false when the id is unknown or already unlocked
         */
        unlockAchievement(key) {
            return rewards.unlockAchievement(key);
        },
    };

    provide(REWARDS_KEY, value);
    provided.set(instance, value);
    return value;
}

/**
 * Access the rewards from a component below one that called provideRewards().
 * player, level, xp, progress, achievements, ready, error and loadFailed are refs.
 */
export function useRewards() {
    const ctx = inject(REWARDS_KEY, null);
    if (ctx === null) {
        throw new Error(
            'useRewards() must be called below a component that called provideRewards(). ' +
            'Call provideRewards() in the setup() of your root component.'
        );
    }
    return ctx;
}
