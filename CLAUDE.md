# CLAUDE.md - AI Assistant Guide for DopamineJS

This document provides comprehensive guidance for AI assistants working with the DopamineJS codebase.

## Project Overview

**DopamineJS** is a Game Feel Engine for the web that adds "juice," rewards, and feedback to HTML5 games. It's organized as an **npm workspaces monorepo** with three main distribution packages:

- **dopaminejs** (MPL-2.0) - Core engine with plugin architecture
- **dopaminejs-plugins** (MIT) - Official plugins collection
- **dopaminejs-themes** (MIT) - UI theming system

**Current Version**: 2.0.x (major architecture overhaul from v1.x)

**Key Technology Stack**:
- Pure vanilla JavaScript (ES6+) - **NO TypeScript**
- JSDoc for type hints and documentation
- Vite for building and bundling
- Vitest for testing
- Zero runtime dependencies in core package

---

## Repository Structure

```
dopaminejs/
├── package.json                          # Root monorepo configuration
├── packages/
│   ├── dopaminejs/                       # Core engine (MPL-2.0)
│   │   ├── src/
│   │   │   ├── index.js                  # Main entry point
│   │   │   ├── core/                     # v2.0 kernel architecture
│   │   │   │   ├── DopamineKernel.js     # Central orchestrator
│   │   │   │   ├── EventBus.js           # Priority-based events
│   │   │   │   ├── SystemRegistry.js     # System lifecycle manager
│   │   │   │   ├── PluginRegistry.js     # Plugin loader
│   │   │   │   ├── Game.js               # Game entry point
│   │   │   │   ├── Scene.js              # Scene/state management
│   │   │   │   ├── GameObject.js         # Entity base class
│   │   │   │   └── Component.js          # Component base class
│   │   │   ├── interfaces/               # System contracts
│   │   │   │   ├── ISystem.js
│   │   │   │   ├── IPhysicsSystem.js
│   │   │   │   ├── IAudioSystem.js
│   │   │   │   └── IParticleSystem.js
│   │   │   ├── systems/                  # Core system implementations
│   │   │   │   ├── Physics.js            # Collision detection
│   │   │   │   ├── Input.js              # Keyboard/mouse
│   │   │   │   ├── Ticker.js             # Game loop
│   │   │   │   ├── Loader.js             # Asset loading
│   │   │   │   └── Director.js           # Scene management
│   │   │   ├── renderer/
│   │   │   │   └── Renderer.js           # Canvas 2D renderer
│   │   │   ├── dopamine/                 # Legacy "juice" systems
│   │   │   │   ├── core/
│   │   │   │   │   ├── RewardSystem.js   # XP/levels/achievements
│   │   │   │   │   └── DataService.js    # LocalStorage persistence
│   │   │   │   ├── ui/
│   │   │   │   │   ├── GameUI.js         # DOM overlay
│   │   │   │   │   └── dopamine.css      # Default styles
│   │   │   │   ├── audio/
│   │   │   │   │   └── SoundManager.js   # Web Audio API
│   │   │   │   ├── effects/
│   │   │   │   │   └── ParticleSystem.js # Canvas particles
│   │   │   │   └── components/
│   │   │   │       ├── ParticleEmitter.js
│   │   │   │       └── ScreenShake.js
│   │   │   └── tests/                    # Test files
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   ├── dopaminejs-plugins/               # Unified plugins (MIT)
│   │   ├── src/
│   │   │   └── index.js                  # Re-exports all plugins
│   │   └── package.json
│   │
│   ├── plugin-webgl-particles/           # Individual plugins (MIT)
│   ├── plugin-howler-audio/
│   ├── plugin-debug-overlay/
│   ├── plugin-feedback-effects/
│   ├── plugin-ecosystem/
│   ├── plugin-sound-packs/
│   │
│   └── dopaminejs-themes/                # Themes (MIT)
│       ├── src/
│       │   ├── index.js
│       │   └── ThemeEngine.js            # CSS variable themes
│       └── package.json
│
├── README.md                             # User-facing documentation
└── CLAUDE.md                             # This file
```

---

## Architecture & Key Patterns

### 1. Kernel-Based Architecture (v2.0+)

The **DopamineKernel** is the central orchestrator that owns three core registries:

```javascript
class DopamineKernel {
  constructor() {
    this.events = new EventBus();           // Priority-based pub/sub
    this.systems = new SystemRegistry(this); // System lifecycle
    this.plugins = new PluginRegistry(this); // Plugin management
  }
}
```

**Key Points**:
- Kernel reference is injected throughout the object hierarchy
- Systems are accessed via `kernel.systems.get('systemName')`
- Events are emitted via `kernel.events.emit(eventName, data)`
- Plugins modify kernel during initialization

### 2. Plugin System

All plugins follow this interface:

```javascript
export const MyPlugin = {
  name: 'my-plugin',        // Unique identifier (required)
  version: '1.0.0',         // Semantic version (optional)

  init(kernel) {
    // Setup: register systems, add event listeners, etc.
    kernel.systems.register('mySystem', new MySystem());
  },

  destroy() {
    // Cleanup: remove listeners, dispose resources (optional)
  }
};
```

**Usage**:
```javascript
const game = new Game();
game.kernel.plugins.use(MyPlugin);
```

### 3. System Registry Pattern

Systems have dependencies and update cycles:

```javascript
class MySystem {
  get dependencies() {
    return ['physics', 'input']; // Systems this depends on
  }

  init(kernel) {
    // Initialize system with kernel reference
  }

  update(deltaTime) {
    // Called every frame (variable timestep)
  }

  fixedUpdate(fixedDeltaTime) {
    // Called at fixed 60 FPS (optional, for physics)
  }

  destroy() {
    // Cleanup
  }
}
```

**Important**: SystemRegistry uses topological sorting to respect dependencies.

### 4. Event Bus Pattern

Priority-based event system with cached sorting:

```javascript
// Subscribe with priority (higher = executes first)
kernel.events.on('TICK', this.onTick.bind(this), { priority: 10 });

// Emit events
kernel.events.emit('XP_GAINED', { amount: 100 });

// One-time listeners
kernel.events.once('GAME_START', this.initialize.bind(this));

// Unsubscribe
kernel.events.off('TICK', this.onTick);
```

**Standard Events** (from `EventBus.Events`):
- `TICK` - Every frame
- `FIXED_UPDATE` - Physics update (60 FPS)
- `RENDER` - Render cycle
- `COLLISION_ENTER` - Physics collision
- `XP_GAINED`, `LEVEL_UP`, `ACHIEVEMENT_UNLOCKED` - Reward events

### 5. Component-Entity Pattern

```javascript
class GameObject {
  constructor(x, y) {
    this.position = new Vector2(x, y);
    this.rotation = 0;
    this.scale = new Vector2(1, 1);
    this.components = [];
    this.children = [];
    this.kernel = null; // Injected by scene
  }

  addComponent(component) {
    component.gameObject = this;
    component.kernel = this.kernel;
    this.components.push(component);
    component.onAttach();
  }
}

class Component {
  onAttach() { }      // Called when added to GameObject
  update(dt) { }      // Called every frame
  onDetach() { }      // Called when removed
}
```

### 6. Scene Management

```javascript
class MyScene extends Scene {
  onEnter() {
    // Scene setup: create GameObjects, add listeners
    const player = new GameObject(100, 100);
    this.addGameObject(player);
  }

  update(deltaTime) {
    // Per-frame logic
  }

  render(renderer) {
    // Custom rendering
  }

  onExit() {
    // Cleanup before leaving scene
  }
}

// Switch scenes
game.kernel.systems.get('director').changeScene(new MyScene());
```

### 7. Fixed Timestep Physics

The Ticker system uses an accumulator pattern:

```javascript
// Physics runs at fixed 60 FPS regardless of frame rate
// Systems implementing fixedUpdate() get called at consistent intervals
// Prevents physics instabilities from variable frame rates
```

---

## Development Workflow

### Initial Setup

```bash
# Clone repository
git clone https://github.com/BaryoDev/dopaminejs.git
cd dopaminejs

# Install all workspace dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test
```

### Working on Core Package

```bash
cd packages/dopaminejs

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Preview built package
npm run preview
```

### Working on Plugins

```bash
# Build unified plugins package
cd packages/dopaminejs-plugins
npm run build

# Work on individual plugin
cd packages/plugin-webgl-particles
npm run build
```

### Monorepo Commands (from root)

```bash
# Build all packages
npm run build

# Test all packages
npm run test

# Dev mode for specific workspace
npm run dev --workspace=dopaminejs

# Clean all build artifacts
npm run clean
```

---

## Build System

### Technology: Vite 5.x

Each package has a `vite.config.js` with library mode configuration.

**Core Package** (`packages/dopaminejs/vite.config.js`):
```javascript
export default {
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'Dopamine',
      fileName: 'dopamine'
    },
    rollupOptions: {
      output: {
        assetFileNames: 'style.css'
      }
    }
  }
};
```

**Plugin Packages**:
```javascript
export default {
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'DopaminePlugins',
      fileName: (format) => `plugins.${format === 'es' ? 'mjs' : 'umd.cjs'}`
    },
    rollupOptions: {
      external: ['dopaminejs'], // Don't bundle core
      output: {
        globals: { dopaminejs: 'Dopamine' }
      }
    }
  }
};
```

### Build Outputs

Each package produces:
- **ES Module**: `dist/[name].mjs` or `dist/[name].js`
- **UMD**: `dist/[name].umd.cjs`
- **CSS** (if applicable): `dist/style.css`

**Note**: `dist/` directories are gitignored.

---

## Testing Conventions

### Framework: Vitest

Tests are located in `packages/*/tests/` directories parallel to `src/`.

### Running Tests

```bash
# All packages
npm test

# Specific package
npm test --workspace=dopaminejs

# Watch mode
cd packages/dopaminejs && npm run test -- --watch
```

### Test Structure

```javascript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DopamineKernel } from '../src/core/DopamineKernel.js';

describe('DopamineKernel', () => {
  let kernel;

  beforeEach(() => {
    kernel = new DopamineKernel();
  });

  afterEach(() => {
    kernel.destroy();
  });

  it('should initialize with core systems', () => {
    expect(kernel.systems.has('ticker')).toBe(true);
    expect(kernel.systems.has('physics')).toBe(true);
  });
});
```

### Key Test Files

- `DopamineKernel.test.js` - Core architecture
- `EventBus.test.js` - Event system
- `SystemRegistry.test.js` - System management
- `RewardSystem.test.js` - XP/achievements
- `ParticleSystem.test.js` - Particle effects
- `SoundManager.test.js` - Audio

---

## Code Conventions

### Language: JavaScript (ES6+)

**IMPORTANT**: This project uses pure JavaScript, NOT TypeScript.

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| Classes | PascalCase | `DopamineKernel`, `EventBus`, `GameObject` |
| Plugins | PascalCase + "Plugin" | `WebGLParticlePlugin`, `HowlerAudioPlugin` |
| Systems | PascalCase | `Physics`, `Input`, `Ticker` |
| Event names | SCREAMING_SNAKE_CASE | `TICK`, `COLLISION_ENTER`, `XP_GAINED` |
| Private methods | Underscore prefix | `_recomputeUpdateOrder()`, `_sortListeners()` |
| Files | PascalCase for classes | `DopamineKernel.js`, `EventBus.js` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PARTICLES`, `FIXED_TIMESTEP` |

### File Organization

- **One class per file**: Each major class in its own file
- **Index files**: Re-export public API from subdirectories
- **Co-located tests**: Tests in `tests/` directory parallel to `src/`
- **Interfaces separate**: System contracts in `interfaces/` folder

### Export Patterns

**Preferred: Named exports**
```javascript
// Good
export class EventBus { }
export const MyPlugin = { };

// Avoid default exports
```

**Aggregation in index.js**:
```javascript
// src/index.js
export { DopamineKernel } from './core/DopamineKernel.js';
export { EventBus } from './core/EventBus.js';
export { Game } from './core/Game.js';
// ... etc
```

### Documentation

**Use JSDoc comments** for public APIs:

```javascript
/**
 * Emits an event to all registered listeners
 * @param {string} eventName - The event to emit
 * @param {*} data - Data to pass to listeners
 */
emit(eventName, data) {
  // ...
}
```

**File-level comments** explaining purpose:

```javascript
/**
 * DopamineKernel - Central orchestrator for the game engine
 *
 * Manages three core registries:
 * - EventBus: Priority-based event system
 * - SystemRegistry: System lifecycle and dependencies
 * - PluginRegistry: Plugin loading and management
 */
```

### Code Style

- **2-space indentation**
- **Semicolons**: Yes, always use them
- **Quotes**: Single quotes for strings (except JSON)
- **Template literals**: Use for string interpolation
- **Arrow functions**: Prefer for callbacks and short functions
- **Const/let**: Never use `var`

---

## Common Tasks

### Adding a New System

1. Create system class in `packages/dopaminejs/src/systems/`
2. Implement required methods: `init()`, `update()`, optionally `fixedUpdate()`
3. Define dependencies in `get dependencies()` if needed
4. Register in DopamineKernel's constructor or via plugin
5. Export from `src/systems/index.js` and `src/index.js`

**Example**:
```javascript
// src/systems/MySystem.js
export class MySystem {
  get dependencies() {
    return ['physics'];
  }

  init(kernel) {
    this.kernel = kernel;
  }

  update(deltaTime) {
    // Per-frame logic
  }

  destroy() {
    // Cleanup
  }
}

// In DopamineKernel.js constructor:
this.systems.register('mySystem', new MySystem());
```

### Creating a New Plugin

1. Create directory: `packages/plugin-name/`
2. Add `package.json`:
```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/plugin-name.umd.cjs",
  "module": "dist/plugin-name.mjs",
  "exports": {
    ".": {
      "import": "./dist/plugin-name.mjs",
      "require": "./dist/plugin-name.umd.cjs"
    }
  },
  "peerDependencies": {
    "dopaminejs": "^2.0.0"
  }
}
```

3. Create `src/index.js`:
```javascript
export const MyPlugin = {
  name: 'my-plugin',
  version: '1.0.0',

  init(kernel) {
    // Plugin setup
  },

  destroy() {
    // Cleanup
  }
};
```

4. Add `vite.config.js` (copy from existing plugin)
5. Add to `packages/dopaminejs-plugins/src/index.js` if official plugin

### Adding a New Component

1. Create component class in `packages/dopaminejs/src/core/` or appropriate location
2. Extend `Component` base class
3. Implement lifecycle methods: `onAttach()`, `update()`, `onDetach()`
4. Export from `src/index.js`

**Example**:
```javascript
import { Component } from './Component.js';

export class HealthComponent extends Component {
  constructor(maxHealth = 100) {
    super();
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  onAttach() {
    console.log('HealthComponent attached');
  }

  takeDamage(amount) {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    if (this.currentHealth === 0) {
      this.kernel.events.emit('ENTITY_DIED', { entity: this.gameObject });
    }
  }

  update(deltaTime) {
    // Regeneration logic, etc.
  }
}
```

### Modifying Core Architecture

**CAUTION**: Core changes affect all users. Follow these steps:

1. **Read existing code thoroughly** before making changes
2. **Maintain backward compatibility** when possible
3. **Add deprecation warnings** for removed APIs
4. **Update tests** to cover new functionality
5. **Document breaking changes** in commit messages
6. **Consider the MPL-2.0 license**: Core modifications must be shareable

### Adding Dependencies

**Core Package (`dopaminejs`)**: Avoid adding runtime dependencies. The core should remain dependency-free.

**Plugin Packages**: Can add dependencies, but prefer peer dependencies:
```json
{
  "peerDependencies": {
    "howler": "^2.2.0",
    "dopaminejs": "^2.0.0"
  }
}
```

**Dev Dependencies**: Add to individual package or root:
```bash
# To specific package
cd packages/dopaminejs
npm install --save-dev some-dev-tool

# To root (affects all packages)
npm install --save-dev some-dev-tool -w
```

---

## Important Gotchas

### 1. Backward Compatibility with v1.x

The codebase maintains deprecated globals for v1.x compatibility:

```javascript
// These still work but log console warnings:
GlobalPhysics.checkCollision(a, b);
GlobalInput.isKeyPressed('w');
GlobalLoader.loadImage('sprite.png');

// Prefer kernel-based access:
game.kernel.systems.get('physics').checkCollision(a, b);
game.kernel.systems.get('input').isKeyPressed('w');
```

**When working on core**: Don't remove these globals without major version bump and migration guide.

### 2. No TypeScript

Despite `.js` extensions, this project does NOT use TypeScript. Use JSDoc for type hints:

```javascript
/**
 * @param {number} x
 * @param {number} y
 * @returns {Vector2}
 */
function createVector(x, y) {
  return new Vector2(x, y);
}
```

### 3. System Dependencies Matter

System registration order is handled automatically via topological sort, but circular dependencies will cause errors:

```javascript
// BAD: Circular dependency
class SystemA {
  get dependencies() { return ['systemB']; }
}
class SystemB {
  get dependencies() { return ['systemA']; }
}

// GOOD: Clear dependency chain
class SystemA {
  get dependencies() { return []; }
}
class SystemB {
  get dependencies() { return ['systemA']; }
}
```

### 4. Kernel Injection

GameObjects and Components need kernel reference to access systems. This is automatically handled by Scene:

```javascript
// When adding GameObject to scene
scene.addGameObject(gameObject); // Sets gameObject.kernel
```

**Manual creation**: If creating objects outside Scene, inject kernel manually:
```javascript
const obj = new GameObject(0, 0);
obj.kernel = game.kernel;
```

### 5. Event Listener Cleanup

Always clean up event listeners to prevent memory leaks:

```javascript
class MyComponent extends Component {
  onAttach() {
    this.onTick = () => { /* ... */ };
    this.kernel.events.on('TICK', this.onTick);
  }

  onDetach() {
    this.kernel.events.off('TICK', this.onTick);
  }
}
```

### 6. Fixed Timestep vs Variable Timestep

- Use `update(deltaTime)` for rendering, animation, input
- Use `fixedUpdate(fixedDeltaTime)` for physics, deterministic logic
- Fixed timestep is always `1/60` (~16.67ms)

### 7. Monorepo Workspace Issues

When adding dependencies, specify the workspace:

```bash
# Wrong (adds to root)
npm install howler

# Right (adds to plugin package)
npm install howler --workspace=plugin-howler-audio
```

### 8. Build Before Test

Plugins depend on core being built:

```bash
# Build core first
cd packages/dopaminejs && npm run build

# Then test plugins
cd ../dopaminejs-plugins && npm run test
```

### 9. Vite Library Mode

When building libraries with Vite, `index.html` is not needed. The entry point is specified in `vite.config.js`:

```javascript
build: {
  lib: {
    entry: 'src/index.js', // Not index.html
  }
}
```

---

## Licensing Considerations

### MPL-2.0 (Core Package)

**Files affected**: Everything in `packages/dopaminejs/`

**What this means for AI assistants**:
- Modifications to core files must be shared under MPL-2.0
- File-level copyleft: Only modified files need to be MPL-2.0
- Can be combined with proprietary code (unlike GPL)
- Commercial use is allowed
- Must include license notices in modified files

**When modifying core files**:
1. Preserve existing license headers
2. Add modification notes if creating significant changes
3. Ensure changes are documented for sharing

### MIT (Plugins & Themes)

**Files affected**: `packages/dopaminejs-plugins/`, `packages/dopaminejs-themes/`, and all `packages/plugin-*/`

**What this means**:
- Maximum freedom: Can be modified and used commercially
- No copyleft requirements
- Just preserve copyright notice

### Creating New Files

**In core package** (`packages/dopaminejs/`):
```javascript
/**
 * Copyright (c) 2025 BaryoDev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
```

**In plugin/theme packages**:
```javascript
/**
 * Copyright (c) 2025 BaryoDev
 * Licensed under the MIT License
 */
```

---

## Git Workflow

### Branch Strategy

- **Main branch**: `main` (stable releases)
- **Feature branches**: `feature/description` or `feat/description`
- **Fix branches**: `fix/description`
- **Release branches**: `release/v2.x.x`

### Commit Message Convention

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.
- `perf`: Performance improvement

**Examples**:
```
feat(core): Add WebGL particle system support

fix(physics): Resolve collision detection bug with rotated sprites

docs(readme): Update installation instructions for v2.0

refactor(kernel): Simplify system registration logic

test(events): Add tests for priority-based event ordering
```

### Before Committing

1. **Run tests**: `npm test`
2. **Build all packages**: `npm run build`
3. **Check for console errors**: Ensure no new warnings
4. **Review changes**: Double-check what you're committing

---

## AI Assistant Best Practices

### When Making Changes

1. **Read before writing**: Always read existing code before modifying
2. **Use existing patterns**: Follow established conventions in the codebase
3. **Test your changes**: Run tests and ensure they pass
4. **Maintain compatibility**: Don't break existing APIs without discussion
5. **Document your work**: Update comments and JSDoc as needed
6. **Keep it simple**: Avoid over-engineering or unnecessary abstractions

### When Exploring Code

1. **Start with index.js**: Main entry points show public API
2. **Check interfaces/**: Understand contracts before implementations
3. **Read tests**: Tests document expected behavior
4. **Follow imports**: Trace through import chains to understand dependencies

### When Answering Questions

1. **Reference specific files**: Include file paths and line numbers
2. **Provide examples**: Show actual code from the repository
3. **Explain context**: Don't just say what, explain why
4. **Cite documentation**: Link to README, docs, or code comments

### When Suggesting Features

1. **Check if it exists**: Search codebase first
2. **Consider architecture**: Does it fit the plugin model?
3. **Think about license**: Core (MPL-2.0) vs plugin (MIT)
4. **Propose as plugin**: When possible, suggest plugin implementation

### Red Flags to Avoid

❌ Adding TypeScript (project is pure JS)
❌ Adding runtime dependencies to core package
❌ Breaking backward compatibility without discussion
❌ Removing deprecated globals (still needed for v1.x users)
❌ Introducing circular system dependencies
❌ Creating default exports (use named exports)
❌ Modifying core without understanding kernel architecture
❌ Skipping tests after changes

### Green Lights

✅ Adding new plugins (MIT licensed)
✅ Improving documentation and comments
✅ Adding tests for uncovered code
✅ Optimizing performance (with benchmarks)
✅ Fixing bugs with test coverage
✅ Creating examples and demos
✅ Extending existing systems via plugins

---

## Quick Reference

### File Locations

| What | Where |
|------|-------|
| Core engine entry | `packages/dopaminejs/src/index.js` |
| Kernel | `packages/dopaminejs/src/core/DopamineKernel.js` |
| Event bus | `packages/dopaminejs/src/core/EventBus.js` |
| System registry | `packages/dopaminejs/src/core/SystemRegistry.js` |
| Plugin registry | `packages/dopaminejs/src/core/PluginRegistry.js` |
| Game class | `packages/dopaminejs/src/core/Game.js` |
| Scene class | `packages/dopaminejs/src/core/Scene.js` |
| GameObject | `packages/dopaminejs/src/core/GameObject.js` |
| Component | `packages/dopaminejs/src/core/Component.js` |
| Physics system | `packages/dopaminejs/src/systems/Physics.js` |
| Input system | `packages/dopaminejs/src/systems/Input.js` |
| Reward system | `packages/dopaminejs/src/dopamine/core/RewardSystem.js` |
| Particle system | `packages/dopaminejs/src/dopamine/effects/ParticleSystem.js` |
| Tests | `packages/*/tests/` |
| Build configs | `packages/*/vite.config.js` |
| Package manifests | `packages/*/package.json` |

### Commands Cheatsheet

```bash
# Setup
npm install
npm run build

# Development
cd packages/dopaminejs && npm run dev
npm run test

# Building
npm run build                              # All packages
npm run build --workspace=dopaminejs       # Specific package

# Testing
npm test                                   # All packages
npm test --workspace=dopaminejs            # Specific package

# Cleaning
npm run clean                              # Remove all dist/ and node_modules/
```

### Key Exports

```javascript
// Core exports
import {
  Game,              // Main game class
  Scene,             // Scene base class
  GameObject,        // Entity class
  Component,         // Component base class
  Vector2,           // 2D vector
  DopamineKernel,    // Kernel class
  EventBus,          // Event system
  SystemRegistry,    // System manager
  PluginRegistry,    // Plugin manager
} from 'dopaminejs';

// Plugin exports
import {
  WebGLParticlePlugin,
  HowlerAudioPlugin,
  DebugOverlayPlugin,
} from 'dopaminejs-plugins';

// Theme exports
import { themeEngine } from 'dopaminejs-themes';
```

---

## Version History Context

### v2.0.0 (Current) - Architecture Overhaul

**Major Changes**:
- Introduced DopamineKernel with dependency injection
- Moved from global singletons to plugin-based architecture
- Added SystemRegistry with dependency resolution
- Added EventBus with priority-based listeners
- Maintained backward compatibility with v1.x via deprecated globals

### v1.x (Legacy)

**Architecture**:
- Global singletons: `GlobalPhysics`, `GlobalInput`, `GlobalLoader`
- Direct instantiation of `Dopamine` class
- No plugin system
- Tightly coupled systems

**Migration Note**: v1.x code still works with console warnings. Full migration guide needed for v3.0 if globals are removed.

---

## Resources

- **Repository**: https://github.com/BaryoDev/dopaminejs
- **Issues**: https://github.com/BaryoDev/dopaminejs/issues
- **License (Core)**: Mozilla Public License 2.0
- **License (Plugins/Themes)**: MIT

---

## Summary

DopamineJS is a well-architected game feel engine built with:
- **Pure JavaScript** (no TypeScript)
- **Zero runtime dependencies** in core
- **Plugin-based architecture** with dependency injection
- **Kernel orchestrator** managing events, systems, and plugins
- **Component-entity pattern** for game objects
- **Backward compatibility** with v1.x
- **Monorepo structure** using npm workspaces
- **Vite build system** for fast bundling
- **Vitest** for testing
- **Dual licensing**: MPL-2.0 (core) + MIT (plugins/themes)

When working with this codebase, always read before writing, follow established patterns, maintain backward compatibility, and prefer plugins over core modifications.

---

**Last Updated**: 2026-01-06
**DopamineJS Version**: 2.0.2
