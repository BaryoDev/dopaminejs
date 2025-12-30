import Dopamine from './dopamine/index.js';

// Re-export legacy systems
export * from './dopamine/index.js';

// Export New Kernel Architecture (Phase 0)
export { DopamineKernel } from './core/DopamineKernel.js';
export { EventBus } from './core/EventBus.js';
export { SystemRegistry } from './core/SystemRegistry.js';
export { PluginRegistry } from './core/PluginRegistry.js';

// Export System Interfaces
export * from './interfaces/index.js';

// Export New Engine Core
export { Game } from './core/Game.js';
export { Scene } from './core/Scene.js';
export { GameObject } from './core/GameObject.js';
export { Component } from './core/Component.js';
export { Renderer } from './renderer/Renderer.js';
export { Ticker } from './systems/Ticker.js';
export { Loader, GlobalLoader } from './systems/Loader.js';
export { Input, GlobalInput } from './systems/Input.js';
export { Director } from './systems/Director.js';
export { Physics, GlobalPhysics } from './systems/Physics.js';
export { Vector2 } from './core/Vector2.js';
export { Collider } from './core/Collider.js';
export { Sprite } from './core/Sprite.js';
export { Animator } from './core/Animator.js';
export { TextureGenerator } from './dopamine/utils/TextureGenerator.js';
export { ParticleEmitter, ScreenShake } from './dopamine/components/index.js';

// Export default for backward compatibility
export default Dopamine;
