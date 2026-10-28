/**
 * Core subpath export: `import { RewardSystem } from 'dopaminejs/core'`
 *
 * The progression API with no UI, effects, sound or engine behind it, so it
 * loads in React Native, Expo and other runtimes that have no browser. Nothing
 * reachable from here may touch window, document, localStorage or navigator
 * at import time. scripts/check-core-import.js enforces that against the build.
 */

export { RewardSystem } from './dopamine/core/RewardSystem.js';
export { DopamineError } from './dopamine/core/DopamineError.js';
export { merge } from './dopamine/core/merge.js';
export { validate } from './dopamine/core/store.js';
export { DataService } from './dopamine/core/DataService.js';
export { EventEmitter } from './dopamine/core/EventEmitter.js';
export { createMemoryStorage, resolveStorage } from './dopamine/utils/storage.js';
