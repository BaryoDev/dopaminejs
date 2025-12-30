/**
 * DopamineJS Plugins
 * Official plugin collection (MIT License)
 */

// Audio Plugins
// Note: HowlerAudioPlugin requires 'howler' package to be installed separately
// export { HowlerAudioPlugin, HowlerAudioPluginExample } from './HowlerAudioPlugin.js';
export { getSoundPack, listSoundPacks, SoundPacks } from './SoundPacks.js';

// Visual Plugins
export { WebGLParticlePlugin } from './WebGLParticlePlugin.js';

// Physics Plugins
export { CustomPhysicsPlugin } from './CustomPhysicsPlugin.js';

// Ecosystem Plugins
export {
    BattlePassPlugin,
    LeaderboardPlugin,
    RewardMiddleware,
    WebhookIntegration
} from './EcosystemPlugins.js';

// Utility Plugins
export { DebugOverlayPlugin } from './DebugOverlayPlugin.js';
