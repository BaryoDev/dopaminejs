# DopamineJS Architecture Review

**Review Date**: 2026-01-06
**Version Reviewed**: 2.0.2
**Reviewer**: AI Architecture Analysis

---

## Executive Summary

DopamineJS has undergone a significant architectural transformation in v2.0, moving from global singletons to a kernel-based dependency injection system with plugin architecture. The refactoring shows strong architectural vision with clean separation of concerns, good extensibility patterns, and thoughtful performance optimizations.

**Overall Assessment**: ⭐⭐⭐⭐ (4/5)

**Key Strengths**:
- Excellent plugin architecture enabling extensibility
- Clean dependency injection via kernel
- Good performance optimizations (caching, object pooling)
- Zero dependencies in core package
- Backward compatibility maintained

**Critical Areas for Improvement**:
- Error handling and resilience needs significant enhancement
- Missing input validation and sanitization
- Memory leak potential in several areas
- Limited security considerations
- Test coverage is sparse (5 tests for 36 source files)

---

## Detailed Analysis

### 1. Extendability ⭐⭐⭐⭐⭐ (5/5)

The plugin architecture is the standout feature of v2.0.

#### Strengths:

1. **Plugin Interface is Simple and Effective**
   ```javascript
   export const MyPlugin = {
     name: 'my-plugin',
     init(kernel) { /* Full kernel access */ },
     destroy() { /* Cleanup */ }
   };
   ```

2. **System Registry with Dependency Resolution**
   - Topological sorting for system dependencies (Kahn's algorithm)
   - Priority-based execution order
   - Clean replacement of core systems

3. **Event Bus for Loose Coupling**
   - Priority-based listeners
   - Once listeners for one-time events
   - Good separation between systems

4. **Kernel Injection Pattern**
   - Consistent access to systems via `kernel.systems.get('name')`
   - Propagates through GameObject hierarchy
   - Eliminates need for globals

#### Recommendations:

**1. Add Plugin Lifecycle Hooks**

Currently plugins only have `init()` and `destroy()`. Add more hooks:

```javascript
// Proposed enhancement
export const PluginLifecycle = {
  name: 'my-plugin',

  // Existing
  init(kernel) { },
  destroy() { },

  // NEW: Lifecycle hooks
  onBeforeStart(kernel) {
    // Called before game loop starts
  },

  onAfterStart(kernel) {
    // Called after game loop starts
  },

  onPause(kernel) {
    // Called when game pauses
  },

  onResume(kernel) {
    // Called when game resumes
  },

  onSceneChange(oldScene, newScene) {
    // Called on scene transitions
  }
};
```

**2. Add Plugin Dependencies**

Allow plugins to declare dependencies on other plugins:

```javascript
// packages/dopaminejs/src/core/PluginRegistry.js
use(plugin) {
  // NEW: Check plugin dependencies
  if (plugin.dependencies) {
    for (const depName of plugin.dependencies) {
      if (!this._plugins.has(depName)) {
        throw new Error(
          `[PluginRegistry] Plugin "${plugin.name}" requires plugin "${depName}" ` +
          `but it is not loaded. Please load "${depName}" first.`
        );
      }
    }
  }

  // ... rest of existing code
}
```

**3. Add Plugin Configuration Validation**

```javascript
// Proposed: Add schema validation for plugin configs
export const WebGLParticlePlugin = {
  name: 'webgl-particles',

  // NEW: Schema definition
  schema: {
    maxParticles: { type: 'number', default: 10000, min: 100, max: 100000 },
    blendMode: { type: 'string', default: 'additive', enum: ['additive', 'normal', 'multiply'] }
  },

  init(kernel, userConfig = {}) {
    // Validate and merge config
    const config = this._validateConfig(userConfig);
    // ... rest of init
  },

  _validateConfig(config) {
    // Validate against schema
  }
};
```

**4. Add System Interfaces/Contracts**

The `interfaces/` folder exists but interfaces aren't enforced:

```javascript
// packages/dopaminejs/src/core/SystemRegistry.js
register(name, system, options = {}) {
  // NEW: Validate system implements ISystem
  if (!this._implementsInterface(system, 'ISystem')) {
    console.warn(
      `[SystemRegistry] System "${name}" doesn't fully implement ISystem interface. ` +
      `Missing methods: ${this._getMissingMethods(system, 'ISystem').join(', ')}`
    );
  }

  // Existing code...
}

_implementsInterface(system, interfaceName) {
  const required = {
    ISystem: ['init', 'update'],
    IPhysicsSystem: ['addBody', 'removeBody', 'checkCollision'],
    // ... other interfaces
  };

  return required[interfaceName]?.every(method =>
    typeof system[method] === 'function'
  ) ?? true;
}
```

---

### 2. Maintainability ⭐⭐⭐⭐ (4/5)

Code is generally well-organized with clear patterns.

#### Strengths:

1. **Clear Separation of Concerns**
   - Core kernel in `core/`
   - Systems in `systems/`
   - Interfaces in `interfaces/`
   - Legacy code preserved in `dopamine/`

2. **Consistent Naming Conventions**
   - Classes: PascalCase
   - Private methods: underscore prefix
   - Events: SCREAMING_SNAKE_CASE

3. **Good Documentation**
   - JSDoc comments on public APIs
   - File-level comments explaining purpose
   - README and CLAUDE.md for guidance

4. **Backward Compatibility**
   - Deprecated globals still work with warnings
   - Smooth migration path for v1.x users

#### Issues:

1. **Inconsistent Error Handling Patterns**
   ```javascript
   // PluginRegistry.js - Good: throws error
   if (!plugin.name) {
     throw new Error('[PluginRegistry] Plugin must have a name');
   }

   // SystemRegistry.js - Bad: only warns
   if (!this._systems.has(dep)) {
     console.warn(`[SystemRegistry] Dependency "${dep}" not found`);
     // Should throw or return error, not silently continue
   }
   ```

2. **Missing JSDoc Types**
   ```javascript
   // Current - no type information
   emit(event, data) { }

   // Better
   /**
    * @param {string} event - Event name
    * @param {any} data - Event data
    * @returns {void}
    */
   emit(event, data) { }
   ```

3. **Magic Numbers Without Constants**
   ```javascript
   // SystemRegistry.js:183
   queue.sort((a, b) => {
     const priorityA = this._systems.get(a).priority;
     const priorityB = this._systems.get(b).priority;
     return priorityB - priorityA; // Higher priority first
   });

   // Better: Define default priorities
   const SystemPriority = {
     CRITICAL: 100,  // Ticker
     HIGH: 90,       // Renderer
     NORMAL: 50,     // Physics, custom systems
     LOW: 10         // Debug, analytics
   };
   ```

#### Recommendations:

**1. Standardize Error Handling**

Create a centralized error handling system:

```javascript
// packages/dopaminejs/src/core/ErrorHandler.js
export class DopamineError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'DopamineError';
    this.context = context;
    this.timestamp = Date.now();
  }
}

export class PluginError extends DopamineError {
  constructor(pluginName, message, context) {
    super(`[Plugin: ${pluginName}] ${message}`, context);
    this.name = 'PluginError';
    this.pluginName = pluginName;
  }
}

export class SystemError extends DopamineError {
  constructor(systemName, message, context) {
    super(`[System: ${systemName}] ${message}`, context);
    this.name = 'SystemError';
    this.systemName = systemName;
  }
}

export class CircularDependencyError extends DopamineError {
  constructor(cycle) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`, { cycle });
    this.name = 'CircularDependencyError';
  }
}

// Usage in SystemRegistry.js
if (sorted.length !== systems.length) {
  const missing = systems.filter(([name]) => !sorted.includes(name));
  throw new CircularDependencyError(missing.map(([name]) => name));
}
```

**2. Add Logging Levels**

```javascript
// packages/dopaminejs/src/core/Logger.js
export class Logger {
  constructor(namespace, level = 'warn') {
    this.namespace = namespace;
    this.level = level;
    this.levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
  }

  debug(...args) {
    if (this.levels[this.level] <= this.levels.debug) {
      console.debug(`[${this.namespace}]`, ...args);
    }
  }

  info(...args) {
    if (this.levels[this.level] <= this.levels.info) {
      console.info(`[${this.namespace}]`, ...args);
    }
  }

  warn(...args) {
    if (this.levels[this.level] <= this.levels.warn) {
      console.warn(`[${this.namespace}]`, ...args);
    }
  }

  error(...args) {
    if (this.levels[this.level] <= this.levels.error) {
      console.error(`[${this.namespace}]`, ...args);
    }
  }
}

// Usage in DopamineKernel
this.logger = new Logger('DopamineKernel', config.logLevel || 'warn');
```

**3. Add Configuration Validation**

```javascript
// packages/dopaminejs/src/core/ConfigValidator.js
export class ConfigValidator {
  static validate(config, schema) {
    const errors = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = config[key];

      // Type checking
      if (rules.type && value !== undefined && typeof value !== rules.type) {
        errors.push(`${key}: expected ${rules.type}, got ${typeof value}`);
      }

      // Range checking
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${key}: must be >= ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${key}: must be <= ${rules.max}`);
      }

      // Enum checking
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${key}: must be one of [${rules.enum.join(', ')}]`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }
}

// Usage in DopamineKernel constructor
const schema = {
  width: { type: 'number', min: 1, max: 10000 },
  height: { type: 'number', min: 1, max: 10000 },
  fixedTimestep: { type: 'number', min: 0.001, max: 1 },
  backgroundColor: { type: 'string' }
};

ConfigValidator.validate(config, schema);
```

---

### 3. Performance ⭐⭐⭐⭐ (4/5)

Good performance optimizations in place, but some bottlenecks exist.

#### Strengths:

1. **EventBus Caching**
   ```javascript
   // EventBus.js:109 - Sorted listeners cached
   _getSortedListeners(event) {
     if (this._sortedCache.has(event)) {
       return this._sortedCache.get(event);
     }
     // ... sort and cache
   }
   ```

2. **Fixed Timestep for Physics**
   ```javascript
   // DopamineKernel.js:107 - Accumulator pattern prevents spiral of death
   this._accumulator += dt;
   if (this._accumulator > this._maxAccumulator) {
     this._accumulator = this._maxAccumulator;
   }
   ```

3. **Object Pooling in ParticleSystem**
   ```javascript
   // ParticleSystem.js:140
   _getParticle() {
     if (this.pool.length > 0) {
       return this.pool.pop();
     }
     return {};
   }
   ```

4. **Pre-computed Update Order**
   ```javascript
   // SystemRegistry.js:15 - Lazy recomputation
   this._updateOrder = [];
   this._needsRecompute = false;
   ```

#### Performance Issues:

1. **Physics O(n²) Collision Detection**
   ```javascript
   // Physics.js:44 - Naive broad phase
   step() {
     for (let i = 0; i < this.colliders.length; i++) {
       for (let j = i + 1; j < this.colliders.length; j++) {
         // Check collision
       }
     }
   }
   ```

   **Impact**: With 100 colliders = 4,950 checks per frame (at 60 FPS = 297,000 checks/sec)

2. **EventBus Array Creation on Every Sort**
   ```javascript
   // EventBus.js:121
   const sorted = Array.from(listeners).sort((a, b) => b.priority - a.priority);
   ```

   **Impact**: Allocates new array on every cache miss. For high-frequency events like TICK, this creates garbage.

3. **GameObject Update Iteration Without Culling**
   ```javascript
   // GameObject.js:68
   update(dt) {
     for (const component of this.components) {
       if (component.update) component.update(dt);
     }
     for (const child of this.children) {
       child.update(dt);
     }
   }
   ```

   **Impact**: Updates all objects even if off-screen or inactive.

4. **Particle System Canvas Rendering Bottleneck**
   ```javascript
   // ParticleSystem.js:239
   _animate() {
     this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
     for (let i = this.particles.length - 1; i >= 0; i--) {
       // ctx.save/restore on every particle
       this.ctx.save();
       // ... draw particle
       this.ctx.restore();
     }
   }
   ```

   **Impact**: Canvas 2D has ~1000 particle limit before FPS drops.

#### Recommendations:

**1. Implement Spatial Partitioning for Physics**

```javascript
// packages/dopaminejs/src/systems/SpatialHash.js
export class SpatialHash {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  insert(collider) {
    const bounds = collider.getBounds();
    const cells = this._getCells(bounds);

    for (const cell of cells) {
      if (!this.grid.has(cell)) {
        this.grid.set(cell, []);
      }
      this.grid.get(cell).push(collider);
    }
  }

  query(bounds) {
    const cells = this._getCells(bounds);
    const results = new Set();

    for (const cell of cells) {
      const bucket = this.grid.get(cell);
      if (bucket) {
        for (const collider of bucket) {
          results.add(collider);
        }
      }
    }

    return Array.from(results);
  }

  _getCells(bounds) {
    const cells = [];
    const minX = Math.floor(bounds.left / this.cellSize);
    const maxX = Math.floor(bounds.right / this.cellSize);
    const minY = Math.floor(bounds.top / this.cellSize);
    const maxY = Math.floor(bounds.bottom / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        cells.push(`${x},${y}`);
      }
    }

    return cells;
  }
}

// Update Physics.js to use spatial hash
import { SpatialHash } from './SpatialHash.js';

export class Physics {
  constructor() {
    this.colliders = [];
    this.spatialHash = new SpatialHash(64);
    this.kernel = null;
  }

  fixedUpdate(dt) {
    this.spatialHash.clear();

    // Populate spatial hash
    for (const collider of this.colliders) {
      this.spatialHash.insert(collider);
    }

    // Optimized collision detection
    const checked = new Set();
    for (const a of this.colliders) {
      const nearby = this.spatialHash.query(a.getBounds());

      for (const b of nearby) {
        if (a === b) continue;

        // Avoid duplicate checks
        const pair = a < b ? `${a.id},${b.id}` : `${b.id},${a.id}`;
        if (checked.has(pair)) continue;
        checked.add(pair);

        if (this._intersects(a, a.getBounds(), b, b.getBounds())) {
          this._notifyCollision(a.gameObject, b.gameObject);
          this._notifyCollision(b.gameObject, a.gameObject);
        }
      }
    }
  }
}
```

**Impact**: Reduces collision checks from O(n²) to O(n) for sparse distributions.

**2. Add Active/Inactive State to GameObjects**

```javascript
// packages/dopaminejs/src/core/GameObject.js
export class GameObject {
  constructor(x = 0, y = 0) {
    // Existing properties...
    this.active = true;
  }

  update(dt) {
    if (!this.active) return; // Skip inactive objects

    // Update components
    for (const component of this.components) {
      if (component.active && component.update) {
        component.update(dt);
      }
    }

    // Update children
    for (const child of this.children) {
      child.update(dt);
    }
  }
}
```

**3. Implement Viewport Culling**

```javascript
// packages/dopaminejs/src/renderer/ViewportCuller.js
export class ViewportCuller {
  constructor(viewport) {
    this.viewport = viewport;
  }

  isVisible(gameObject) {
    // Simple AABB check
    const padding = 100; // Render objects slightly off-screen
    return (
      gameObject.x + padding >= this.viewport.x &&
      gameObject.x - padding <= this.viewport.x + this.viewport.width &&
      gameObject.y + padding >= this.viewport.y &&
      gameObject.y - padding <= this.viewport.y + this.viewport.height
    );
  }
}

// Update Scene.js
render(ctx) {
  const culler = new ViewportCuller({
    x: 0, y: 0,
    width: ctx.canvas.width,
    height: ctx.canvas.height
  });

  for (const obj of this.gameObjects) {
    if (culler.isVisible(obj)) {
      obj.render(ctx);
    }
  }
}
```

**4. Optimize EventBus for Hot Paths**

```javascript
// packages/dopaminejs/src/core/EventBus.js
export class EventBus {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new Map();
    this._sortedCache = new Map();

    // NEW: Pre-allocate arrays for hot events
    this._preallocated = new Map([
      ['tick', []],
      ['fixed_update', []],
      ['render', []]
    ]);
  }

  _getSortedListeners(event) {
    if (this._sortedCache.has(event)) {
      return this._sortedCache.get(event);
    }

    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return this._preallocated.get(event) || [];
    }

    // Use preallocated array if available
    let sorted = this._preallocated.get(event);
    if (sorted) {
      sorted.length = 0; // Clear but keep allocation
      sorted.push(...listeners);
    } else {
      sorted = Array.from(listeners);
    }

    sorted.sort((a, b) => b.priority - a.priority);
    this._sortedCache.set(event, sorted);

    return sorted;
  }
}
```

**5. Add Performance Monitoring**

```javascript
// packages/dopaminejs/src/core/PerformanceMonitor.js
export class PerformanceMonitor {
  constructor(sampleSize = 60) {
    this.sampleSize = sampleSize;
    this.frameTimes = [];
    this.systemTimes = new Map();
  }

  startFrame() {
    this.frameStart = performance.now();
  }

  endFrame() {
    const frameTime = performance.now() - this.frameStart;
    this.frameTimes.push(frameTime);

    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }
  }

  startSystem(name) {
    this.systemStart = performance.now();
    this.currentSystem = name;
  }

  endSystem() {
    if (!this.currentSystem) return;

    const time = performance.now() - this.systemStart;

    if (!this.systemTimes.has(this.currentSystem)) {
      this.systemTimes.set(this.currentSystem, []);
    }

    const times = this.systemTimes.get(this.currentSystem);
    times.push(time);

    if (times.length > this.sampleSize) {
      times.shift();
    }

    this.currentSystem = null;
  }

  getStats() {
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;

    const systemStats = {};
    for (const [name, times] of this.systemTimes) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      systemStats[name] = {
        avg: avg.toFixed(2),
        max: Math.max(...times).toFixed(2),
        min: Math.min(...times).toFixed(2)
      };
    }

    return {
      fps: fps.toFixed(1),
      frameTime: avgFrameTime.toFixed(2),
      systems: systemStats
    };
  }
}

// Add to DopamineKernel
this.perf = config.enablePerfMonitoring ? new PerformanceMonitor() : null;
```

---

### 4. Security ⭐⭐ (2/5)

Security is a significant concern with multiple vulnerabilities.

#### Critical Issues:

**1. No Input Validation**

```javascript
// DopamineKernel.js:17 - Accepts arbitrary config
constructor(config = {}) {
  this.config = config; // No validation
}

// EventBus.js:26 - No validation
on(event, callback, priority = 0) {
  // What if callback is not a function?
  // What if priority is NaN or Infinity?
}
```

**2. XSS Vulnerability in RewardSystem**

```javascript
// RewardSystem.js:308 - User-provided data rendered without sanitization
achievements: {
  'first_game': {
    name: 'First Steps',  // ← Could be user-provided
    description: 'Play your first game',  // ← Could contain XSS
    icon: '🎮'  // ← Could be malicious HTML
  }
}
```

**3. LocalStorage Injection in DataService**

```javascript
// Assuming DataService uses localStorage
save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  // No sanitization of 'key' or 'data'
  // Could overwrite critical data or inject malicious content
}
```

**4. Prototype Pollution Risk**

```javascript
// RewardSystem.js:143 - Unsafe object merging
Object.keys(result).forEach(key => {
  if (key !== 'score') {
    stats[key] = (stats[key] || 0) + (typeof result[key] === 'number' ? result[key] : 0);
  }
});

// Attack: result = { __proto__: { polluted: true } }
```

**5. DOM-based XSS in ParticleSystem**

```javascript
// ParticleSystem.js:9 - Direct DOM manipulation
this.container = config.container ?
  (typeof config.container === 'string' ?
    document.querySelector(config.container) : config.container)
  : document.body;

// Attack: config.container = '<img src=x onerror=alert(1)>'
```

#### Recommendations:

**1. Add Comprehensive Input Validation**

```javascript
// packages/dopaminejs/src/core/InputValidator.js
export class InputValidator {
  static validateCallback(callback, name = 'callback') {
    if (typeof callback !== 'function') {
      throw new TypeError(`${name} must be a function, got ${typeof callback}`);
    }
  }

  static validateNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      throw new TypeError(`${name} must be a finite number`);
    }
    if (value < min || value > max) {
      throw new RangeError(`${name} must be between ${min} and ${max}`);
    }
  }

  static validateString(value, name, { maxLength = Infinity } = {}) {
    if (typeof value !== 'string') {
      throw new TypeError(`${name} must be a string`);
    }
    if (value.length > maxLength) {
      throw new RangeError(`${name} exceeds maximum length of ${maxLength}`);
    }
  }

  static validateObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`${name} must be a plain object`);
    }
  }

  static sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  static sanitizeKey(key) {
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(`Invalid key: ${key}`);
    }
    return key;
  }
}

// Apply in EventBus
on(event, callback, priority = 0) {
  InputValidator.validateString(event, 'event', { maxLength: 256 });
  InputValidator.validateCallback(callback, 'callback');
  InputValidator.validateNumber(priority, 'priority', { min: -1000, max: 1000 });

  // ... rest of method
}
```

**2. Sanitize User-Provided Content**

```javascript
// packages/dopaminejs/src/dopamine/core/RewardSystem.js
_initAchievements() {
  return {
    'first_game': {
      name: InputValidator.sanitizeHTML('First Steps'),
      description: InputValidator.sanitizeHTML('Play your first game'),
      icon: InputValidator.sanitizeHTML('🎮'),
      xp: 50,
      check: (player) => player.totalGamesPlayed >= 1
    },
    // ... other achievements
  };
}
```

**3. Implement Content Security Policy Helper**

```javascript
// packages/dopaminejs/src/core/CSPHelper.js
export class CSPHelper {
  static checkCSP() {
    // Verify that CSP allows unsafe-eval and inline styles if needed
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (meta) {
      console.info('[DopamineJS] CSP detected:', meta.content);
    }
  }

  static sanitizeCSS(css) {
    // Remove dangerous CSS patterns
    const dangerous = [
      /javascript:/gi,
      /expression\(/gi,
      /@import/gi,
      /behaviour:/gi
    ];

    let safe = css;
    for (const pattern of dangerous) {
      safe = safe.replace(pattern, '');
    }

    return safe;
  }
}
```

**4. Add Subresource Integrity (SRI) for External Resources**

```javascript
// packages/dopaminejs/src/systems/Loader.js
export class Loader {
  async loadScript(url, integrity = null) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;

      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
      }

      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));

      document.head.appendChild(script);
    });
  }
}
```

**5. Implement Rate Limiting for Event Emissions**

```javascript
// packages/dopaminejs/src/core/RateLimiter.js
export class RateLimiter {
  constructor(maxEvents = 1000, windowMs = 1000) {
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
    this.events = new Map();
  }

  check(eventName) {
    const now = Date.now();
    const window = now - this.windowMs;

    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    const times = this.events.get(eventName);

    // Remove old events outside window
    while (times.length > 0 && times[0] < window) {
      times.shift();
    }

    if (times.length >= this.maxEvents) {
      return false; // Rate limit exceeded
    }

    times.push(now);
    return true;
  }
}

// Add to EventBus
emit(event, data) {
  if (this.rateLimiter && !this.rateLimiter.check(event)) {
    console.warn(`[EventBus] Rate limit exceeded for event: ${event}`);
    return;
  }

  // ... rest of emit logic
}
```

---

### 5. Error Handling & Resilience ⭐⭐ (2/5)

Error handling is minimal and inconsistent.

#### Critical Issues:

**1. Silent Failures**

```javascript
// SystemRegistry.js:38 - Dependency not found, only warns
for (const dep of dependencies) {
  if (!this._systems.has(dep)) {
    console.warn(`[SystemRegistry] Dependency "${dep}" not found`);
    // ← Should throw error or return validation result
  }
}
```

**2. No Try-Catch in Critical Paths**

```javascript
// DopamineKernel.js:102 - Update loop has no error handling
_update(dt) {
  this.events.emit(EventBus.Events.TICK, { dt });
  // If any listener throws, entire game loop crashes

  while (this._accumulator >= this.fixedTimestep) {
    this.events.emit(EventBus.Events.FIXED_UPDATE, { dt: this.fixedTimestep });
    this.systems.fixedUpdate(this.fixedTimestep);
    this._accumulator -= this.fixedTimestep;
  }

  this.systems.update(dt);
  this.events.emit(EventBus.Events.RENDER, { dt });
}
```

**3. Memory Leaks from Event Listeners**

```javascript
// Input.js:25 - Window listeners never cleaned up if init() called multiple times
init(kernel) {
  // No check if listeners already attached
  window.addEventListener('keydown', this._onKeyDown);
  window.addEventListener('keyup', this._onKeyUp);
  // ...
}
```

**4. No Circular Dependency Protection**

```javascript
// GameObject.js:40 - Can create infinite parent-child loops
addChild(child) {
  child.parent = this;
  child.kernel = this.kernel;
  this.children.push(child);
  // ← No check if 'child' is already an ancestor
}
```

**5. Resource Cleanup Issues**

```javascript
// ParticleSystem.js - Canvas never removed from DOM
// No destroy() method to clean up
```

#### Recommendations:

**1. Add Global Error Boundary**

```javascript
// packages/dopaminejs/src/core/ErrorBoundary.js
export class ErrorBoundary {
  constructor(kernel) {
    this.kernel = kernel;
    this.errorHandlers = [];
    this.paused = false;

    // Global error handlers
    window.addEventListener('error', this._onGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this._onUnhandledRejection.bind(this));
  }

  _onGlobalError(event) {
    console.error('[ErrorBoundary] Uncaught error:', event.error);
    this.kernel.events.emit('error', {
      type: 'error',
      error: event.error,
      message: event.message,
      filename: event.filename,
      lineno: event.lineno
    });
  }

  _onUnhandledRejection(event) {
    console.error('[ErrorBoundary] Unhandled promise rejection:', event.reason);
    this.kernel.events.emit('error', {
      type: 'unhandled_rejection',
      reason: event.reason
    });
  }

  addHandler(handler) {
    this.errorHandlers.push(handler);
  }

  handle(error, context = {}) {
    for (const handler of this.errorHandlers) {
      try {
        handler(error, context);
      } catch (handlerError) {
        console.error('[ErrorBoundary] Error in error handler:', handlerError);
      }
    }
  }
}

// Add to DopamineKernel
constructor(config = {}) {
  // ... existing code
  this.errorBoundary = new ErrorBoundary(this);

  // Default error handler
  this.errorBoundary.addHandler((error, context) => {
    console.error('[DopamineJS] Error:', error, context);

    if (config.pauseOnError) {
      this.stop();
    }
  });
}
```

**2. Wrap Critical Update Loop**

```javascript
// packages/dopaminejs/src/core/DopamineKernel.js
_update(dt) {
  try {
    this.events.emit(EventBus.Events.TICK, { dt });
  } catch (error) {
    this.errorBoundary.handle(error, { phase: 'tick', dt });
  }

  this._accumulator += dt;
  if (this._accumulator > this._maxAccumulator) {
    this._accumulator = this._maxAccumulator;
  }

  while (this._accumulator >= this.fixedTimestep) {
    try {
      this.events.emit(EventBus.Events.FIXED_UPDATE, { dt: this.fixedTimestep });
      this.systems.fixedUpdate(this.fixedTimestep);
    } catch (error) {
      this.errorBoundary.handle(error, { phase: 'fixedUpdate' });
      break; // Stop physics updates on error
    }
    this._accumulator -= this.fixedTimestep;
  }

  try {
    this.systems.update(dt);
  } catch (error) {
    this.errorBoundary.handle(error, { phase: 'update', dt });
  }

  try {
    this.events.emit(EventBus.Events.RENDER, { dt });
  } catch (error) {
    this.errorBoundary.handle(error, { phase: 'render', dt });
  }
}
```

**3. Add Listener Cleanup Tracking**

```javascript
// packages/dopaminejs/src/systems/Input.js
export class Input {
  constructor() {
    this.keys = new Map();
    this.mouse = { x: 0, y: 0, buttons: new Map() };
    this.kernel = null;
    this._listenersAttached = false; // NEW

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  init(kernel) {
    this.kernel = kernel;

    // NEW: Prevent duplicate listeners
    if (this._listenersAttached) {
      console.warn('[Input] Listeners already attached, skipping');
      return;
    }

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);

    this._listenersAttached = true;
  }

  destroy() {
    if (!this._listenersAttached) return;

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);

    this._listenersAttached = false;
  }
}
```

**4. Detect Circular Dependencies in GameObject Hierarchy**

```javascript
// packages/dopaminejs/src/core/GameObject.js
addChild(child) {
  // NEW: Check for circular reference
  if (this._isAncestor(child)) {
    throw new Error(
      '[GameObject] Cannot add child: would create circular parent-child relationship'
    );
  }

  // Remove from previous parent
  if (child.parent) {
    child.parent.removeChild(child);
  }

  child.parent = this;
  child.kernel = this.kernel;
  this.children.push(child);
  return child;
}

_isAncestor(node) {
  let current = this.parent;
  while (current) {
    if (current === node) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

removeChild(child) {
  const index = this.children.indexOf(child);
  if (index > -1) {
    child.parent = null;
    this.children.splice(index, 1);
  }
  return child;
}
```

**5. Add Resource Cleanup to ParticleSystem**

```javascript
// packages/dopaminejs/src/dopamine/effects/ParticleSystem.js
destroy() {
  // Stop animation
  this.isAnimating = false;

  // Clear particles
  this.clear();

  // Remove canvas from DOM
  if (this.canvas && this.canvas.parentNode) {
    this.canvas.parentNode.removeChild(this.canvas);
  }

  // Clear references
  this.canvas = null;
  this.ctx = null;
  this.sprites.clear();
  this.customEffects.clear();
}
```

---

### 6. Testing ⭐⭐ (2/5)

Test coverage is very sparse.

#### Current State:

- **36 source files** in core package
- **5 test files** covering ~13% of files
- Tests are basic unit tests, no integration tests
- No performance benchmarks
- No browser compatibility tests

#### Existing Tests:

1. `DopamineKernel.test.js` - Basic initialization tests
2. `RewardSystem.test.js` - XP and achievement tests
3. `ParticleSystem.test.js` - Particle effects tests
4. `DataService.test.js` - LocalStorage persistence tests
5. `SoundManager.test.js` - Audio system tests

#### Missing Coverage:

- SystemRegistry dependency resolution
- EventBus priority ordering edge cases
- Physics collision detection
- GameObject component lifecycle
- Scene transitions
- Plugin loading/unloading
- Error handling paths
- Memory leak scenarios

#### Recommendations:

**1. Increase Test Coverage to 80%+**

```javascript
// packages/dopaminejs/tests/SystemRegistry.test.js
describe('SystemRegistry - Dependency Resolution', () => {
  it('should handle complex dependency chains', () => {
    const registry = new SystemRegistry(mockKernel);

    const systemA = { init: vi.fn(), update: vi.fn() };
    const systemB = { init: vi.fn(), update: vi.fn(), dependencies: ['a'] };
    const systemC = { init: vi.fn(), update: vi.fn(), dependencies: ['b'] };

    registry.register('a', systemA);
    registry.register('b', systemB);
    registry.register('c', systemC);

    const order = [];
    systemA.update = () => order.push('a');
    systemB.update = () => order.push('b');
    systemC.update = () => order.push('c');

    registry.update(0.016);

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('should throw on circular dependencies', () => {
    const registry = new SystemRegistry(mockKernel);

    const systemA = { init: vi.fn(), dependencies: ['b'] };
    const systemB = { init: vi.fn(), dependencies: ['a'] };

    registry.register('a', systemA);

    expect(() => {
      registry.register('b', systemB);
    }).toThrow(CircularDependencyError);
  });
});
```

**2. Add Integration Tests**

```javascript
// packages/dopaminejs/tests/integration/GameLifecycle.test.js
describe('Game Lifecycle Integration', () => {
  it('should start, run, and stop cleanly', async () => {
    const game = new Game({ width: 800, height: 600 });

    let tickCount = 0;
    game.kernel.events.on('tick', () => tickCount++);

    game.start();

    // Wait for 10 frames
    await new Promise(resolve => {
      let frames = 0;
      game.kernel.events.on('tick', () => {
        frames++;
        if (frames >= 10) resolve();
      });
    });

    expect(tickCount).toBeGreaterThanOrEqual(10);

    game.stop();
    const ticksAfterStop = tickCount;

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(tickCount).toBe(ticksAfterStop);
  });

  it('should handle scene transitions', () => {
    const game = new Game();

    const scene1 = new Scene();
    const scene2 = new Scene();

    let scene1Exited = false;
    let scene2Entered = false;

    scene1.onExit = () => { scene1Exited = true; };
    scene2.onEnter = () => { scene2Entered = true; };

    game.setScene(scene1);
    expect(game.director.currentScene).toBe(scene1);

    game.setScene(scene2);
    expect(scene1Exited).toBe(true);
    expect(scene2Entered).toBe(true);
    expect(game.director.currentScene).toBe(scene2);
  });
});
```

**3. Add Performance Benchmarks**

```javascript
// packages/dopaminejs/tests/benchmarks/Physics.bench.js
import { bench, describe } from 'vitest';
import { Physics } from '../src/systems/Physics.js';
import { Collider } from '../src/core/Collider.js';

describe('Physics Performance', () => {
  bench('100 colliders - broad phase', () => {
    const physics = new Physics();

    for (let i = 0; i < 100; i++) {
      const collider = new Collider({ x: Math.random() * 800, y: Math.random() * 600 });
      physics.add(collider);
    }

    physics.step();
  });

  bench('1000 colliders - broad phase', () => {
    const physics = new Physics();

    for (let i = 0; i < 1000; i++) {
      const collider = new Collider({ x: Math.random() * 800, y: Math.random() * 600 });
      physics.add(collider);
    }

    physics.step();
  });
});
```

**4. Add Memory Leak Tests**

```javascript
// packages/dopaminejs/tests/memory/EventBus.memory.test.js
describe('EventBus Memory Leaks', () => {
  it('should not leak listeners when objects are destroyed', () => {
    const bus = new EventBus();
    const listeners = [];

    // Create 1000 listeners
    for (let i = 0; i < 1000; i++) {
      const listener = () => {};
      listeners.push(listener);
      bus.on('test', listener);
    }

    expect(bus._listeners.get('test').size).toBe(1000);

    // Remove all listeners
    for (const listener of listeners) {
      bus.off('test', listener);
    }

    expect(bus._listeners.get('test').size).toBe(0);

    // Verify cache is cleared
    expect(bus._sortedCache.has('test')).toBe(false);
  });
});
```

**5. Add Cross-Browser Testing**

```javascript
// vitest.config.js
export default {
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      }
    },
    // Add browser testing with Playwright
    browser: {
      enabled: true,
      name: 'chromium',
      headless: true,
    }
  }
};
```

---

### 7. Additional Architecture Concerns

#### A. State Management

Currently, state is scattered across systems with no centralized state management.

**Recommendation**: Add optional state management plugin

```javascript
// packages/plugin-state-manager/src/StateManagerPlugin.js
export const StateManagerPlugin = {
  name: 'state-manager',
  version: '1.0.0',

  init(kernel) {
    const store = new StateStore();

    // Register as system
    kernel.systems.register('state', store);

    // Emit events on state changes
    store.subscribe((state, prevState) => {
      kernel.events.emit('state_changed', { state, prevState });
    });
  }
};

class StateStore {
  constructor() {
    this.state = {};
    this.subscribers = [];
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const prevState = { ...this.state };
    this.state[key] = value;
    this._notify(this.state, prevState);
  }

  update(updates) {
    const prevState = { ...this.state };
    Object.assign(this.state, updates);
    this._notify(this.state, prevState);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) this.subscribers.splice(index, 1);
    };
  }

  _notify(state, prevState) {
    for (const subscriber of this.subscribers) {
      subscriber(state, prevState);
    }
  }
}
```

#### B. Serialization/Deserialization

No built-in save/load for game state beyond LocalStorage.

**Recommendation**: Add serialization system

```javascript
// packages/dopaminejs/src/core/Serializer.js
export class Serializer {
  static serialize(gameObject) {
    return {
      type: gameObject.constructor.name,
      x: gameObject.x,
      y: gameObject.y,
      rotation: gameObject.rotation,
      scale: gameObject.scale,
      components: gameObject.components.map(c => ({
        type: c.constructor.name,
        data: c.serialize ? c.serialize() : {}
      })),
      children: gameObject.children.map(child => this.serialize(child))
    };
  }

  static deserialize(data, kernel) {
    const gameObject = new GameObject(data.x, data.y);
    gameObject.rotation = data.rotation;
    gameObject.scale = data.scale;
    gameObject.kernel = kernel;

    // Deserialize components
    for (const compData of data.components) {
      const ComponentClass = this._getComponentClass(compData.type);
      if (ComponentClass) {
        const component = new ComponentClass();
        if (component.deserialize) {
          component.deserialize(compData.data);
        }
        gameObject.addComponent(component);
      }
    }

    // Deserialize children
    for (const childData of data.children) {
      const child = this.deserialize(childData, kernel);
      gameObject.addChild(child);
    }

    return gameObject;
  }

  static _getComponentClass(name) {
    // Registry of component classes
    return ComponentRegistry.get(name);
  }
}
```

#### C. Debugging Tools

Minimal debugging support.

**Recommendation**: Enhance debug plugin

```javascript
// packages/plugin-debug-overlay/src/DebugOverlayPlugin.js
export const DebugOverlayPlugin = {
  name: 'debug-overlay',
  version: '2.0.0',

  init(kernel) {
    const overlay = new DebugOverlay(kernel);
    kernel.systems.register('debug', overlay, { priority: -100 });

    // Keyboard shortcut to toggle
    kernel.systems.get('input')?.on('keydown', (e) => {
      if (e.key === '`') {
        overlay.toggle();
      }
    });
  }
};

class DebugOverlay {
  constructor(kernel) {
    this.kernel = kernel;
    this.visible = false;
    this.stats = {
      fps: 0,
      systems: {},
      objects: 0,
      particles: 0,
      events: {}
    };

    this._createUI();
    this._startTracking();
  }

  _createUI() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: #0f0;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
    `;
    document.body.appendChild(this.element);
  }

  _startTracking() {
    let frames = 0;
    let lastTime = performance.now();

    this.kernel.events.on('tick', () => {
      frames++;

      const now = performance.now();
      if (now - lastTime >= 1000) {
        this.stats.fps = frames;
        frames = 0;
        lastTime = now;

        this._updateDisplay();
      }
    });
  }

  _updateDisplay() {
    if (!this.visible) return;

    const html = `
      <div>FPS: ${this.stats.fps}</div>
      <div>Systems: ${this.kernel.systems.getSystemNames().length}</div>
      <div>Plugins: ${this.kernel.plugins.getPluginNames().length}</div>
      <div>Event Listeners: ${this._countEventListeners()}</div>
      <hr>
      <div style="font-size: 10px;">
        ${this.kernel.systems.getSystemNames().join(', ')}
      </div>
    `;

    this.element.innerHTML = html;
  }

  _countEventListeners() {
    let count = 0;
    for (const [_, listeners] of this.kernel.events._listeners) {
      count += listeners.size;
    }
    return count;
  }

  toggle() {
    this.visible = !this.visible;
    this.element.style.display = this.visible ? 'block' : 'none';
    if (this.visible) {
      this._updateDisplay();
    }
  }
}
```

---

## Summary of Recommendations

### High Priority (Critical)

1. **Add comprehensive error handling with ErrorBoundary**
2. **Implement input validation across all public APIs**
3. **Fix security vulnerabilities (XSS, prototype pollution)**
4. **Add spatial partitioning to physics (O(n²) → O(n))**
5. **Increase test coverage to 80%+**

### Medium Priority (Important)

6. **Add plugin lifecycle hooks and dependencies**
7. **Implement performance monitoring system**
8. **Add viewport culling for rendering optimization**
9. **Create standardized logging system**
10. **Add memory leak tests and prevention**

### Low Priority (Nice to Have)

11. **Add state management plugin**
12. **Implement serialization/deserialization**
13. **Enhance debugging tools**
14. **Add configuration validation**
15. **Implement rate limiting for events**

---

## Conclusion

DopamineJS v2.0 demonstrates excellent architectural vision with its kernel-based plugin system and clean separation of concerns. The foundation is solid, but significant work is needed in error handling, security, and testing to make it production-ready.

**Recommended Next Steps**:

1. **Security Audit**: Address all XSS and prototype pollution vulnerabilities
2. **Error Handling**: Implement ErrorBoundary and wrap all critical paths
3. **Performance**: Add spatial partitioning to physics system
4. **Testing**: Increase coverage to 80% with unit + integration tests
5. **Documentation**: Add security best practices guide for plugin developers

With these improvements, DopamineJS can become a robust, production-grade game engine suitable for serious game development projects.

---

**Review Conducted By**: AI Architecture Analysis
**Date**: 2026-01-06
**Version**: 2.0.2
