/**
 * RewardsProvider + useRewards()
 *
 * Manages a single RewardSystem instance for the React tree it wraps.
 * Components call useRewards() to read player state and dispatch XP/games.
 *
 * The provider subscribes to xp_gained, level_up, achievement_unlocked and
 * streak_updated on mount and unsubscribes on unmount. The emitter holds
 * strong references, so a component that mounts and unmounts repeatedly
 * without cleanup would accumulate duplicate listeners.
 *
 * Usage:
 *   <RewardsProvider config={...} storage={myStorage}>
 *     <App />
 *   </RewardsProvider>
 *
 * Inside any child:
 *   const { player, addXP, level, progress, achievements } = useRewards();
 */
import React, {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useRef,
} from 'react';
import { RewardSystem, DataService } from 'dopaminejs';
import { buildState } from './state.js';

// ─── Context ──────────────────────────────────────────────────────────────────

const RewardsContext = createContext(null);

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
    switch (action.type) {
        case 'SYNC':
            return { ...state, ...action.payload };
        default:
            return state;
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {object}   [props.config]   passed straight to new RewardSystem(...)
 * @param {object}   [props.storage]  custom storage (defaults to localStorage)
 * @param {React.ReactNode} props.children
 */
export function RewardsProvider({ config, storage, children }) {
    // Safe initial state so consumers always have all fields defined before
    // the async init() resolves, even on the very first render.
    const [state, dispatch] = useReducer(reducer, null, () => ({
        player: {},
        level: 1,
        xp: 0,
        progress: 0,
        achievements: [],
    }));
    const rewardsRef = useRef(null);

    // Keep a stable reference to the dispatch so event handlers don't need to
    // be re-registered when state changes.
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;

    useEffect(() => {
        // DataService accepts a config object with a `storage` key.
        // Passing undefined is fine, it defaults to resolveStorage().
        const dataService = new DataService({ storage });
        const rewards = new RewardSystem(dataService, config);
        rewardsRef.current = rewards;

        let mounted = true;

        rewards.init().then(() => {
            if (!mounted) return;
            dispatchRef.current({ type: 'SYNC', payload: buildState(rewards) });
        });

        function sync() {
            if (!mounted) return;
            dispatchRef.current({ type: 'SYNC', payload: buildState(rewards) });
        }

        // Event names emitted by RewardSystem are lowercase.
        rewards.on('xp_gained', sync);
        rewards.on('level_up', sync);
        rewards.on('achievement_unlocked', sync);
        rewards.on('streak_updated', sync);

        return () => {
            mounted = false;
            // Remove listeners so the emitter doesn't accumulate them across
            // re-mounts (it holds strong references).
            rewards.off('xp_gained', sync);
            rewards.off('level_up', sync);
            rewards.off('achievement_unlocked', sync);
            rewards.off('streak_updated', sync);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // config and storage are intentionally excluded: the RewardSystem is
    // created once. Callers who need dynamic config should re-key the provider.

    const value = {
        ...state,

        /**
         * Add XP to the current player.
         * @param {number} amount
         * @param {string} [reason] - carried on the xp_gained event
         * @returns {Promise<object>|undefined} what RewardSystem.addXP resolves with
         */
        addXP(amount, reason) {
            return rewardsRef.current?.addXP(amount, reason);
        },

        /**
         * Record a game session, which may award XP and update stats.
         * @param {string} gameId
         * @param {object} stats
         * @returns {Promise<void>|undefined}
         */
        recordGame(gameId, stats) {
            return rewardsRef.current?.recordGame(gameId, stats);
        },

        /**
         * Manually unlock an achievement by key.
         * @param {string} key
         * @returns {Promise<boolean>|undefined} false when the id is unknown or already unlocked
         */
        unlockAchievement(key) {
            return rewardsRef.current?.unlockAchievement(key);
        },
    };

    return React.createElement(RewardsContext.Provider, { value }, children);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the rewards context from any descendant of <RewardsProvider>.
 *
 * @returns {{
 *   player: object,
 *   level: number,
 *   xp: number,
 *   progress: number,
 *   achievements: object[],
 *   addXP: (amount: number, reason?: string) => Promise<object> | undefined,
 *   recordGame: (gameId: string, stats: object) => Promise<void> | undefined,
 *   unlockAchievement: (key: string) => Promise<boolean> | undefined,
 * }}
 * The three methods return undefined until the provider's effect has
 * created the RewardSystem, which is after the effects of its children.
 */
export function useRewards() {
    const ctx = useContext(RewardsContext);
    if (ctx === null) {
        throw new Error(
            'useRewards() must be called inside a <RewardsProvider>. ' +
            'Wrap your app (or the relevant subtree) with <RewardsProvider>.'
        );
    }
    return ctx;
}
