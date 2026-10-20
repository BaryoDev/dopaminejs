import type { Ref } from 'vue';

export interface ProvideRewardsOptions {
    /** Passed to `new RewardSystem(...)`. */
    config?: object;
    /** Custom storage. Defaults to localStorage. */
    storage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
    };
}

export interface RewardsState {
    player: Ref<Record<string, any>>;
    level: Ref<number>;
    xp: Ref<number>;
    /** 0 to 1, position inside the current level. */
    progress: Ref<number>;
    achievements: Ref<any[]>;
    addXP(amount: number, reason?: string): Promise<any>;
    recordGame(gameId: string, stats: object): Promise<void>;
    /** Resolves false when the id is unknown or already unlocked. */
    unlockAchievement(key: string): Promise<boolean>;
}

export function provideRewards(options?: ProvideRewardsOptions): RewardsState;
export function useRewards(): RewardsState;
