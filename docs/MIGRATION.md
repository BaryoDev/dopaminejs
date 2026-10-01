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
import { WebGLParticlePlugin } from 'dopaminejs-plugin-webgl-particles';

const game = new Game();
game.kernel.plugins.use(WebGLParticlePlugin);
```

### 2. Sound Packs

Sound packs left core in 2.0.2. Install `dopaminejs-plugin-sound-packs`.

A pack is a set of tone definitions, not audio files. Do not pass one as
`customSounds`, which expects `{ key: url }`, and there is no `setSoundPack`
method. Play an entry with `playTone`:

```javascript
import { SoundManager } from 'dopaminejs';
import { getSoundPack } from 'dopaminejs-plugin-sound-packs';

const sound = new SoundManager();
const pack = getSoundPack('retro');  // or 'modern', 'cute', 'scifi'

// Returns a function that cancels the notes not played yet.
function playPackSound(def) {
    if (def.type === 'tone') {
        sound.playTone(def.frequency, def.duration, def.waveform, def.volume);
        return () => {};
    }
    const timers = [];
    let delay = 0;
    for (const note of def.notes) {
        timers.push(setTimeout(() => sound.playTone(note.frequency, note.duration, def.waveform, def.volume), delay * 1000));
        delay += note.duration;
    }
    return () => timers.forEach(clearTimeout);
}

const cancel = playPackSound(pack.levelUp);
```

`sound.destroy()` does not know about these timers. Call `cancel()` before
it, or a late note calls `playTone` and opens a new audio context.

To switch packs, call `getSoundPack` with another name.

### 3. Themes

```javascript
import { themeEngine } from 'dopaminejs-themes';

themeEngine.setTheme('dark-cyberpunk');
```

A theme sets `--dopamine-*` CSS variables on the document root. The core
stylesheet does not read them, so a theme changes only the CSS you write
against those variables.

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

# With plugins (one package per plugin)
npm install dopaminejs dopaminejs-plugin-webgl-particles

# With themes
npm install dopaminejs dopaminejs-themes
```

### Moving off `dopaminejs-plugins`

The bundled package was unpublished from npm on 2026-01-01 and removed from the
repo in 2.1.0. Replace the single import with the package that owns each export:

| Was imported from `dopaminejs-plugins` | Now install |
|---|---|
| `WebGLParticlePlugin`, `WebGLParticleSystem` | `dopaminejs-plugin-webgl-particles` |
| `HowlerAudioPlugin` | `dopaminejs-plugin-howler-audio` |
| `getSoundPack`, `listSoundPacks`, `SoundPacks` | `dopaminejs-plugin-sound-packs` |
| `BattlePassPlugin`, `LeaderboardPlugin`, `RewardMiddleware`, `WebhookIntegration` | `dopaminejs-plugin-ecosystem` |
| `DebugOverlayPlugin` | `dopaminejs-plugin-debug-overlay` |
| `CustomPhysicsPlugin` | Not published. It was always an example; copy it from `examples/plugins/CustomPhysicsPlugin.js`. |

## Deprecation Timeline

`GlobalPhysics`, `GlobalInput` and `GlobalLoader` are deprecated since v2.0.
Each warns once in the console on first use. They stay for the whole of 2.x.
Removing them needs a major version, and none is scheduled.

## Performance Improvements

- No dynamic imports in the game loop
- Physics runs on a fixed timestep
- The system order is recomputed on the first update after a system is registered or removed, not every frame
- Optional WebGL particles, 10,000 by default (`maxParticles`)

## Need Help?

- [Plugin Development Guide](./PLUGIN_GUIDE.md)
- [GitHub Issues](https://github.com/BaryoDev/dopaminejs/issues)
- [Examples](../examples/)
