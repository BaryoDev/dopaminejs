/**
 * Types for the `dopaminejs/core` subpath. Only what that entry exports at
 * runtime, plus the types those values use, so importing RewardUI or another
 * web-only name from it fails to compile instead of being undefined.
 */
export {
    RewardSystem,
    DataService,
    EventEmitter,
    DopamineError,
    merge,
    validate,
    createMemoryStorage,
    resolveStorage
} from './index';

export type {
    Player,
    PlayerDocument,
    PlayerStreak,
    Clock,
    DopamineErrorCode,
    ValidateOptions,
    Middleware,
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
