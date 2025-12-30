# Migration Guide: v1.x to v2.0

## Overview

DopamineJS v2.0 introduces a new plugin architecture with the `DopamineKernel`. While we've maintained backward compatibility, we recommend migrating to the new APIs for better performance and future-proofing.

## Breaking Changes

### 1. Global Singletons Deprecated

**Old (v1.x)**:
```javascript
import { GlobalPhysics, GlobalInput } from 'dopaminejs';

GlobalPhysics.add(collider);
const keys = GlobalInput.keys;
```

**New (v2.0)**:
```javascript
// In components
class MyComponent extends Component {
    onAttach() {
        this.physics.add(this.collider);  // Injected via kernel
        const keys = this.input.keys;
    }
}

// In game code
const game = new Game();
game.kernel.physics.add(collider);
```

### 2. Game Initialization

**Old (v1.x)**:
```javascript
import { Game } from 'dopaminejs';

const game = new Game();
game.start();
```

**New (v2.0)** - Same API, but now uses kernel internally:
```javascript
import { Game } from 'dopaminejs';

const game = new Game();
game.start();  // Works the same!

// Access kernel for advanced features
game.kernel.plugins.use(MyPlugin);
```

## New Features

### 1. Plugin System

```javascript
import { Game } from 'dopaminejs';
import { WebGLParticlePlugin } from 'dopaminejs-plugins';

const game = new Game();
game.kernel.plugins.use(WebGLParticlePlugin);
```

### 2. Sound Packs

```javascript
import { SoundManager } from 'dopaminejs';

const soundManager = new SoundManager({
    soundPack: 'retro'  // or 'modern', 'cute', 'scifi'
});

// Switch packs dynamically
soundManager.setSoundPack('cyberpunk');
```

### 3. Themes

```javascript
import { themeEngine } from 'dopaminejs-themes';

themeEngine.setTheme('dark-cyberpunk');
```

## Component Migration

### Before (v1.x)
```javascript
import { Component } from 'dopaminejs';
import { GlobalPhysics } from 'dopaminejs';

class PlayerController extends Component {
    onAttach() {
        GlobalPhysics.add(this.gameObject.collider);
    }
    
    update(dt) {
        // Update logic
    }
}
```

### After (v2.0)
```javascript
import { Component } from 'dopaminejs';

class PlayerController extends Component {
    onAttach() {
        // this.physics is automatically injected via kernel
        this.physics.add(this.gameObject.collider);
    }
    
    update(dt) {
        // Same update logic
    }
}
```

## Package Installation

### v1.x
```bash
npm install dopaminejs
```

### v2.0 - Modular Installation
```bash
# Core only
npm install dopaminejs

# With plugins
npm install dopaminejs dopaminejs-plugins

# With themes
npm install dopaminejs dopaminejs-themes
```

## Deprecation Timeline

- **v2.0**: Global singletons deprecated (warnings in console)
- **v2.5**: Global singletons marked for removal
- **v3.0**: Global singletons removed entirely

## Performance Improvements

You'll automatically get these benefits:

- ✅ 10-20x faster game loop (no dynamic imports)
- ✅ Fixed timestep physics (60 FPS)
- ✅ Pre-sorted system updates
- ✅ WebGL particles option (10,000+ particles)

## Need Help?

- [Plugin Development Guide](./PLUGIN_GUIDE.md)
- [GitHub Issues](https://github.com/BaryoDev/dopaminejs/issues)
- [Examples](../examples/)
