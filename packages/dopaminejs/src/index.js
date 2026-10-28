// Importing this module does nothing. Styles come from `dopaminejs/style.css`
// or RewardUI's `injectCss` option.
export { createDopamine, HOST_API } from './dopamine/host.js';
export { RewardSystem } from './dopamine/core/RewardSystem.js';
export { DataService } from './dopamine/core/DataService.js';
export { DopamineError } from './dopamine/core/DopamineError.js';
export { merge } from './dopamine/core/merge.js';
export { validate } from './dopamine/core/store.js';
export { RewardUI } from './dopamine/ui/RewardUI.js';
export { ParticleSystem } from './dopamine/effects/ParticleSystem.js';
export { SoundManager } from './dopamine/audio/SoundManager.js';

// The emitter RewardSystem extends, so consumers can type their listeners.
export { EventEmitter } from './dopamine/core/EventEmitter.js';

// Storage resolution, useful for tests and for SSR where localStorage is absent.
export { createMemoryStorage, resolveStorage } from './dopamine/utils/storage.js';

// Feel helpers: vibration and the reduced-motion preference
export { createHaptics } from './dopamine/feel/haptics.js';
export { prefersReducedMotion } from './dopamine/feel/motion.js';
