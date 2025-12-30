# DopamineJS Architecture & Roadmap 🏗️

**Vision**: To become the standard "Game Feel Engine" for the web—a plug-and-play layer that handles the "juice" (feedback, rewards, satisfaction) so developers can focus on core mechanics.

## 🧠 Design Philosophy
1.  **Zero-Config Start**: It must work beautifully out of the box.
2.  **Infinite Extensibility**: Every default (sound, particle, UI style) must be replaceable.
3.  **Asset Agnostic**: Support synthesized sounds/shapes (no assets) AND custom assets (mp3/png).
4.  **AI-First**: APIs should be self-documenting and predictable for AI agents to use effectively.

## ✅ Phase 0: Core Plugin Architecture (v1.3.0) - **COMPLETED**

**Goal**: Build the foundation for extensibility.

### Implemented Components

-   **[NEW] DopamineKernel**: Central orchestrator that replaces global singletons
    -   Manages `EventBus`, `SystemRegistry`, and `PluginRegistry`
    -   Fixed timestep physics loop
    -   Dependency injection for all systems
-   **[NEW] EventBus**: Priority-based event system for loose coupling
    -   Pre-allocated event constants for performance
    -   Support for `on`, `once`, `off` listeners
    -   Priority queues for critical events (tick, render)
-   **[NEW] SystemRegistry**: Manages system lifecycle and dependencies
    -   Topological sort for dependency resolution
    -   Pre-computed update order for performance
    -   Support for `update()` and `fixedUpdate()` methods
-   **[NEW] PluginRegistry**: Plugin loading and lifecycle management
    -   Synchronous and asynchronous plugin loading
    -   Proper cleanup on plugin removal
-   **[NEW] System Interfaces**: Contracts for swappable implementations
    -   `ISystem`: Base interface for all systems
    -   `IPhysicsSystem`: Physics engine contract
    -   `IAudioSystem`: Audio engine contract
    -   `IParticleSystem`: Particle renderer contract

### Breaking Changes

-   `GlobalPhysics`, `GlobalInput`, `GlobalLoader` are now **deprecated**
-   Use `kernel.physics`, `kernel.input`, `kernel.loader` instead
-   Backward compatibility maintained until v3.0

### Migration Guide

```javascript
// Old (still works, but deprecated)
import { GlobalPhysics } from 'dopaminejs';

// New (recommended)
const game = new Game();
game.kernel.physics.add(collider);
```

See [Plugin Development Guide](./docs/PLUGIN_GUIDE.md) for creating custom plugins.

## 🗺️ Roadmap

### Phase 1: Audio Extensibility (v1.4.0)
**Goal**: Allow developers to bring their own soundscapes.

-   **[UPDATE] SoundManager**:
    -   ✅ Add `registerSound(key, url)` method (already implemented)
    -   Support `Howler.js` integration via plugin
    -   **Feature**: "Sound Packs" - Allow switching between 'Retro', 'Modern', 'Cute' preset packs.

**Now Easier**: Create a `HowlerAudioPlugin` that implements `IAudioSystem`

### Phase 2: Visual Customization (v1.5.0)
**Goal**: Break free from geometric primitives.

-   **[UPDATE] ParticleSystem**:
    -   ✅ **Sprite Support**: Allow `image` or `sprite` properties (already implemented)
    -   ✅ **Custom Emitters**: Define custom particle behaviors via JSON config (already implemented)
    -   **Editor**: (Long term) A web-based particle editor that exports JSON for DopamineJS.

**Now Easier**: Create a `WebGLParticlePlugin` that implements `IParticleSystem`

### Phase 3: UI Theming & Templates (v1.6.0)
**Goal**: Make the UI fit any game art style.

-   **[NEW] Theme Engine**:
    -   Use CSS Variables for all colors, fonts, and spacing.
    -   `Dopamine.setTheme('dark-cyberpunk')`
-   **[UPDATE] GameUI**:
    -   **Icon Sets**: Allow passing an icon map (SVG strings or URLs) to replace default emojis.
    -   **Slots**: Allow developers to inject custom HTML into notifications or level-up screens.

**Now Easier**: Create UI plugins that listen to `EventBus` events

### Phase 4: The "Dopamine Ecosystem" (v2.0.0)
**Goal**: Community-driven content.

-   ✅ **Plugin System**: Middleware for the `RewardSystem` (e.g., "BattlePass Plugin", "Leaderboard Plugin") - **Foundation Complete**
-   **Backend Integration**: Webhooks for `onLevelUp` or `onAchievement` to validate rewards on a server.
-   **Plugin Marketplace**: Community-contributed plugins

**Now Possible**: Full plugin ecosystem enabled by Phase 0 architecture

## 📝 Developer Guide: How to Extend

### Using the New Plugin System

```javascript
import { Game } from 'dopaminejs';
import { DebugOverlayPlugin } from 'dopaminejs/plugins';

const game = new Game();
game.kernel.plugins.use(DebugOverlayPlugin);
game.start();
```

### Creating Custom Plugins

See [Plugin Development Guide](./docs/PLUGIN_GUIDE.md) for detailed instructions.

### Custom Achievements (Still Works)

You can already define any achievement logic you want:

```javascript
achievements: {
    'die_100_times': {
        name: 'You Tried',
        icon: '<img src="skull.png" width="20">', // HTML is supported in icons!
        check: (p) => p.stats.deaths >= 100
    }
}
```

### Custom CSS (Still Works)

Override the default styles by adding your own CSS *after* importing DopamineJS:

```css
/* Override the XP bar color */
.xp-bar-fill {
    background: linear-gradient(90deg, #ff00cc, #3333ff) !important;
}
```
