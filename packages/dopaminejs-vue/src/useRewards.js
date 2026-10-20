/**
 * provideRewards() + useRewards()
 *
 * provideRewards() creates a single RewardSystem for the component tree below
 * the caller. useRewards() reads it from any descendant (or the same component).
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
    getCurrentScope,
    inject,
    onScopeDispose,
    provide,
    shallowRef,
    triggerRef,
} from 'vue';
import { RewardSystem, DataService } from 'dopaminejs';
import { buildState } from './state.js';

const REWARDS_KEY = Symbol('dopaminejs-rewards');

// Event names emitted by RewardSystem are lowercase.
const EVENTS = ['xp_gained', 'level_up', 'achievement_unlocked', 'streak_updated'];

/**
 * @param {object} [options]
 * @param {object} [options.config]   passed straight to new RewardSystem(...)
 * @param {object} [options.storage]  custom storage (defaults to localStorage)
 * @returns the same object useRewards() returns
 */
export function provideRewards({ config, storage } = {}) {
    if (!getCurrentScope()) {
        throw new Error(
            'provideRewards() must be called inside setup() or an effect scope, ' +
            'so its listeners can be removed when the scope is disposed.'
        );
    }

    // Safe initial state so consumers always have all fields defined before
    // the async init() resolves.
    const player = shallowRef({});
    const level = shallowRef(1);
    const xp = shallowRef(0);
    const progress = shallowRef(0);
    const achievements = shallowRef([]);

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
        // RewardSystem mutates the player in place, so the same object comes
        // back and the assignment above would not notify.
        triggerRef(player);
    }

    rewards.init().then(sync);

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
        recordGame(gameId, stats) {
            return rewards.recordGame(gameId, stats);
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
    return value;
}

/**
 * Access the rewards from a component below one that called provideRewards().
 * player, level, xp, progress and achievements are refs.
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
