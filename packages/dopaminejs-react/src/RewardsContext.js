/**
 * RewardsProvider + useRewards()
 *
 * Manages a single RewardSystem instance for the React tree it wraps.
 * Components call useRewards() to read player state and dispatch XP/games.
 *
 * The provider subscribes to XP_GAINED, LEVEL_UP, and ACHIEVEMENT_UNLOCKED
 * on mount and unsubscribes on unmount. EventBus holds strong references, so
 * this cleanup is mandatory — a component that mounts and unmounts repeatedly
 * without cleanup will accumulate duplicate listeners.
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

function buildState(rewards) {
    const player = rewards.player || {};
    return {
        player,
        level: player.level ?? 1,
        xp: player.xp ?? 0,
        progress: rewards.getXPForNextLevel
            ? player.xp / rewards.getXPForNextLevel(player.level ?? 1)
            : 0,
        achievements: rewards.getUnlockedAchievements?.() ?? [],
    };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {object}   [props.config]   — passed straight to new RewardSystem(...)
 * @param {object}   [props.storage]  — custom storage (defaults to localStorage)
 * @param {React.ReactNode} props.children
 */
export function RewardsProvider({ config, storage, children }) {
    const [state, dispatch] = useReducer(reducer, null, () => ({}));
    const rewardsRef = useRef(null);

    // Keep a stable reference to the dispatch so event handlers don't need to
    // be re-registered when state changes.
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;

    useEffect(() => {
        const dataService = new DataService(storage);
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

        rewards.on('XP_GAINED', sync);
        rewards.on('LEVEL_UP', sync);
        rewards.on('ACHIEVEMENT_UNLOCKED', sync);

        return () => {
            mounted = false;
            // Remove listeners so the EventBus doesn't accumulate them across
            // re-mounts (EventBus holds strong references).
            rewards.off('XP_GAINED', sync);
            rewards.off('LEVEL_UP', sync);
            rewards.off('ACHIEVEMENT_UNLOCKED', sync);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // config and storage are intentionally excluded: the RewardSystem is
    // created once. Callers who need dynamic config should re-key the provider.

    const value = {
        ...state,

        /**
         * Add XP to the current player.
         * @param {number} amount
         * @returns {Promise<void>}
         */
        addXP(amount) {
            return rewardsRef.current?.addXP(amount);
        },

        /**
         * Record a game session, which may award XP and update stats.
         * @param {string} gameId
         * @param {object} stats
         * @returns {Promise<void>}
         */
        recordGame(gameId, stats) {
            return rewardsRef.current?.recordGame(gameId, stats);
        },

        /**
         * Manually unlock an achievement by key.
         * @param {string} key
         * @returns {Promise<void>}
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
 *   addXP: (amount: number) => Promise<void>,
 *   recordGame: (gameId: string, stats: object) => Promise<void>,
 *   unlockAchievement: (key: string) => Promise<void>,
 * }}
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
