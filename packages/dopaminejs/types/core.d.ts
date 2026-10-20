/**
 * Types for the `dopaminejs/core` subpath. Only what that entry exports at
 * runtime, plus the types those values use, so importing GameUI or another
 * web-only name from it fails to compile instead of being undefined.
 */
export {
    RewardSystem,
    DataService,
    EventEmitter,
    createMemoryStorage,
    resolveStorage
} from './index';

export type {
    Player,
    PlayerStreak,
    UnlockedAchievement,
    AchievementDefinition,
    GameResult,
    XPProgress,
    AddXPResult,
    RewardSystemConfig,
    RewardEvent,
    StorageLike,
    AsyncStorageLike,
    DataServiceConfig
} from './index';
