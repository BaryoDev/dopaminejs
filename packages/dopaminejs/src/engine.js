/**
 * Engine subpath export — `import { Game, Scene } from 'dopaminejs/engine'`
 *
 * The game engine that DopamineJS is built on. Use this subpath if your project
 * only needs the entity/component system, renderer, or physics, and not the
 * progression mechanics (RewardSystem, GameUI, DataService).
 *
 * The root `dopaminejs` export continues to re-export everything, so nothing breaks.
 * This subpath makes the README's distinction between the engine and the progression
 * layer real in code and gives bundlers a clear surface to tree-shake against.
 */

// Entity / component system
export { Game } from './core/Game.js';
export { Scene } from './core/Scene.js';
export { GameObject } from './core/GameObject.js';
export { Component } from './core/Component.js';
export { Vector2 } from './core/Vector2.js';
export { Collider } from './core/Collider.js';
export { Sprite } from './core/Sprite.js';
export { Animator } from './core/Animator.js';

// Kernel and plugin infrastructure
export { DopamineKernel } from './core/DopamineKernel.js';
export { EventBus } from './core/EventBus.js';
export { SystemRegistry } from './core/SystemRegistry.js';
export { PluginRegistry } from './core/PluginRegistry.js';

// Built-in systems
export { Renderer } from './renderer/Renderer.js';
export { Ticker } from './systems/Ticker.js';
export { Loader, GlobalLoader } from './systems/Loader.js';
export { Input, GlobalInput } from './systems/Input.js';
export { Director } from './systems/Director.js';
export { Physics, GlobalPhysics } from './systems/Physics.js';

// Engine-level components
export { ParticleEmitter, ScreenShake } from './dopamine/components/index.js';
