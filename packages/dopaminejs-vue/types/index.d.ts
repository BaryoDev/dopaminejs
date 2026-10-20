import type { Ref } from 'vue';
import type {
    AchievementDefinition,
    AddXPResult,
    DataServiceConfig,
    Player,
    RewardSystemConfig,
    UnlockedAchievement,
} from 'dopaminejs';

export interface ProvideRewardsOptions {
    /** Passed to `new RewardSystem(...)`. */
    config?: RewardSystemConfig;
    /** Custom storage, sync or async. Defaults to localStorage. */
    storage?: DataServiceConfig['storage'];
}

export interface RewardsState {
    /** The live player object, mutated in place. Empty until init resolves. */
    player: Ref<Player | Record<string, never>>;
    level: Ref<number>;
    xp: Ref<number>;
    /** 0 to 1, position inside the current level. */
    progress: Ref<number>;
    achievements: Ref<Array<AchievementDefinition & UnlockedAchievement & { id: string }>>;
    /** True once init() has resolved. */
    ready: Ref<boolean>;
    /** Null until init() rejects, then the rejection. */
    error: Ref<unknown>;
    /** True when init() could not read the saved player, so nothing is saved this session. */
    loadFailed: Ref<boolean>;
    addXP(amount: number, reason?: string): Promise<AddXPResult>;
    recordGame(gameId: string, stats: object): Promise<void>;
    /** Resolves false when the id is unknown or already unlocked. */
    unlockAchievement(key: string): Promise<boolean>;
}

export function provideRewards(options?: ProvideRewardsOptions): RewardsState;
export function useRewards(): RewardsState;
