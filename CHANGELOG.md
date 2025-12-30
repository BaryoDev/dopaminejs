# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-12-30

### 🎉 Major Release - Complete Architecture Overhaul

This release transforms DopamineJS from a game feel library into a fully extensible game feel engine.

### Added
- **DopamineKernel** - Central orchestrator with dependency injection
- **EventBus** - Priority-based event system
- **SystemRegistry** - Lifecycle management with topological sort
- **PluginRegistry** - Sync/async plugin loading
- **System Interfaces** - ISystem, IPhysicsSystem, IAudioSystem, IParticleSystem
- **Sound Pack System** - 4 presets (retro, modern, cute, scifi)
- **WebGLParticleSystem** - GPU particles (10,000+ at 60 FPS)
- **ThemeEngine** - 5 UI themes with CSS variables
- **Middleware hooks** - RewardSystem event interception
- **Webhook integration** - Backend sync with HMAC

### Changed
- **BREAKING**: Deprecated `GlobalPhysics`, `GlobalInput`, `GlobalLoader` (use kernel)
- Refactored all core files to use kernel dependency injection
- Removed dynamic import from game loop (10-20x faster)
- Fixed timestep physics (60 FPS)

### Monorepo Structure
- Separated into 3 packages: `dopaminejs` (MPL-2.0), `dopaminejs-plugins` (MIT), `dopaminejs-themes` (MIT)
- Each package independently versioned and published

### Performance
- Game loop: ~5-10ms → <0.5ms (10-20x improvement)
- Particles: 1,000 Canvas → 10,000+ WebGL at 60 FPS

### Documentation
- Added [Plugin Development Guide](./docs/PLUGIN_GUIDE.md)
- Updated [ARCHITECTURE.md](./ARCHITECTURE.md)
- Created package-specific READMEs

## [1.2.0] - 2025-12-04
### Added
- **Visual Customization**:
    - `registerSprite(key, url)`: Use custom images for particles.
    - `emit(config)`: Create fully custom particle explosions.
    - `registerEffect(name, callback)`: Define reusable custom effects.
- **Multi-Screen Support**: Pass `container` selector to `ParticleSystem` to target specific elements.
- **Optimization**: Implemented Object Pooling to reduce garbage collection and improve performance.

## [1.1.0] - 2025-12-04
### Added
- **Audio Extensibility**: Support for custom audio files (`.mp3`, `.wav`).
- `SoundManager.registerSound(key, url)`: Register custom assets.
- `SoundManager.play(key)`: Unified API to play custom sounds or fallback to synth.
- Support for `customSounds` in the initial configuration.

## [1.0.2] - 2025-12-04
### Fixed
- Fixed `npm run release` script failing due to missing `vitest` dependency.
- Uncommented `npm publish` in deployment script to ensure package is actually published to npm.

## [1.0.1] - 2025-12-04
### Added
- Initial release of DopamineJS.
- Core systems: `RewardSystem`, `ParticleSystem`, `SoundManager`, `GameUI`.
- Basic gamification features: XP, Levels, Streaks, Achievements.
- Built-in visual effects: Confetti, Coin Shower, Sparkles, Fire, Star Burst.
- Synthesized sound effects.
- Comprehensive README with "Vibe Coding" instructions for AI agents.

## [1.0.0] - 2025-12-04
- Initial scaffold.
