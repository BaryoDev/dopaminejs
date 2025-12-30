# DopamineJS Plugin Development Guide

## Overview

DopamineJS now features a powerful plugin system that allows you to extend or replace core functionality without modifying the source code. This guide will show you how to create your own plugins.

## Plugin Architecture

The plugin system is built on three core components:

1. **DopamineKernel** - Central orchestrator that manages all systems
2. **SystemRegistry** - Manages system lifecycle and dependencies
3. **PluginRegistry** - Handles plugin loading and initialization

## Creating a Plugin

A plugin is simply an object with a `name` and an `init` function:

```javascript
export const MyPlugin = {
    name: 'my-plugin',
    version: '1.0.0', // optional
    
    init(kernel) {
        // Your plugin initialization code
        console.log('MyPlugin initialized!');
    },
    
    destroy() {
        // Optional cleanup code
    }
};
```

## Plugin Types

### 1. System Replacement Plugins

Replace existing systems (physics, audio, particles) with custom implementations:

```javascript
import { CustomPhysicsSystem } from './CustomPhysicsSystem.js';

export const MatterPhysicsPlugin = {
    name: 'matter-physics',
    
    init(kernel) {
        // Unregister default physics
        kernel.systems.unregister('physics');
        
        // Register Matter.js wrapper
        kernel.systems.register('physics', new CustomPhysicsSystem(), {
            priority: 60,
        });
    }
};
```

### 2. Feature Addition Plugins

Add new functionality without replacing existing systems:

```javascript
export const DebugOverlayPlugin = {
    name: 'debug-overlay',
    
    init(kernel) {
        // Listen to events
        kernel.events.on('tick', ({ dt }) => {
            // Update debug overlay
        });
        
        // Register new system
        kernel.systems.register('debug', new DebugSystem());
    }
};
```

### 3. Middleware Plugins

Intercept and modify events:

```javascript
export const LoggingPlugin = {
    name: 'event-logger',
    
    init(kernel) {
        // Log all events
        const originalEmit = kernel.events.emit.bind(kernel.events);
        kernel.events.emit = (event, data) => {
            console.log(`[Event] ${event}`, data);
            originalEmit(event, data);
        };
    }
};
```

## System Interface Contracts

When creating custom systems, implement the appropriate interface:

### ISystem (Base Interface)

```javascript
class MySystem {
    init(kernel) {
        // Called when registered
        this.kernel = kernel;
    }
    
    update(dt) {
        // Called each frame (variable timestep)
    }
    
    fixedUpdate(dt) {
        // Called at fixed timestep (for physics)
    }
    
    destroy() {
        // Called when unregistered
    }
}
```

### IPhysicsSystem

```javascript
class MyPhysicsSystem {
    // ... ISystem methods ...
    
    addBody(body) {}
    removeBody(body) {}
    checkCollision(a, b) {}
    raycast(origin, direction, distance) {}
    setGravity(x, y) {}
    step(dt) {}
}
```

### IAudioSystem

```javascript
class MyAudioSystem {
    // ... ISystem methods ...
    
    registerSound(key, url) {}
    preloadSounds(soundMap) {}
    play(key, options) {}
    playTone(frequency, duration, type, volume) {}
    stop(key) {}
    toggleMute() {}
    setVolume(volume) {}
}
```

## Using Plugins

### Synchronous Loading

```javascript
import { Game } from 'dopaminejs';
import { MyPlugin } from './plugins/MyPlugin.js';

const game = new Game();
game.kernel.plugins.use(MyPlugin);
game.start();
```

### Asynchronous Loading

For plugins that need to load external resources:

```javascript
const HeavyPlugin = {
    name: 'heavy-plugin',
    
    async init(kernel) {
        // Load external library
        const Matter = await import('matter-js');
        
        // Initialize with loaded library
        kernel.systems.register('physics', new MatterPhysicsSystem(Matter));
    }
};

await game.kernel.plugins.useAsync(HeavyPlugin);
```

### Chaining Plugins

```javascript
game.kernel.plugins
    .use(DebugOverlayPlugin)
    .use(CustomPhysicsPlugin)
    .use(MyCustomPlugin);
```

## Accessing Systems from Plugins

```javascript
export const MyPlugin = {
    name: 'my-plugin',
    
    init(kernel) {
        // Access existing systems
        const physics = kernel.systems.get('physics');
        const renderer = kernel.systems.get('renderer');
        
        // Or use shorthand accessors
        const input = kernel.input;
        const loader = kernel.loader;
    }
};
```

## Event System

Plugins can listen to and emit events:

```javascript
export const MyPlugin = {
    name: 'my-plugin',
    
    init(kernel) {
        // Listen to events
        kernel.events.on('tick', ({ dt }) => {
            // Called every frame
        });
        
        kernel.events.on('collision_enter', (data) => {
            // Called on collision
        });
        
        // Emit custom events
        kernel.events.emit('my_custom_event', { foo: 'bar' });
    }
};
```

### Standard Events

- `tick` - Every frame (variable timestep)
- `fixed_update` - Fixed timestep (for physics)
- `render` - Render phase
- `collision_enter` - Physics collision
- `xp_gained` - Dopamine reward system
- `level_up` - Dopamine reward system
- `achievement_unlocked` - Dopamine reward system

## Example Plugins

### Debug Overlay

```javascript
import { DebugOverlayPlugin } from 'dopaminejs/plugins';

game.kernel.plugins.use(DebugOverlayPlugin);
```

Shows FPS, frame time, and system count in the top-right corner.

### Custom Physics

```javascript
import { CustomPhysicsPlugin } from 'dopaminejs/plugins';

game.kernel.plugins.use(CustomPhysicsPlugin);
```

Replaces default physics with a custom implementation.

## Best Practices

1. **Name your plugins uniquely** - Use reverse domain notation: `com.yourcompany.plugin-name`
2. **Version your plugins** - Include a version string for compatibility tracking
3. **Clean up resources** - Implement `destroy()` to remove event listeners and DOM elements
4. **Document dependencies** - Clearly state which systems your plugin requires
5. **Handle errors gracefully** - Wrap initialization in try-catch blocks
6. **Use priority wisely** - Higher priority systems run first (default: 0)

## Publishing Plugins

To publish your plugin for others to use:

1. Create a separate npm package: `dopaminejs-plugin-yourname`
2. Export your plugin as the default export
3. Document usage in README.md
4. Tag with `dopaminejs-plugin` keyword

```json
{
  "name": "dopaminejs-plugin-matter",
  "keywords": ["dopaminejs-plugin", "physics", "matter-js"]
}
```

## Migration from Global Singletons

If you're upgrading from DopamineJS < 2.0:

```javascript
// Old (deprecated)
import { GlobalPhysics } from 'dopaminejs';
GlobalPhysics.add(collider);

// New (recommended)
class MyComponent extends Component {
    onAttach() {
        // Access through kernel
        this.physics.add(this.collider);
    }
}
```

Global singletons (`GlobalPhysics`, `GlobalInput`, `GlobalLoader`) are still available but deprecated and will be removed in v3.0.

## Further Reading

- [System Interfaces Reference](./INTERFACES.md)
- [Event System Guide](./EVENTS.md)
- [Example Plugins](../src/plugins/)
