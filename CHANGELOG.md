# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-08-06

Stabilisation release. No API removals; the level curve correction changes
numbers players can see, so it is a minor rather than a patch.

### Fixed

- **Level curve** - `_calculateLevel` inverted `XP = 50 * L * (L - 1)` with the
  wrong coefficient, so every level was reached at half the XP that
  `getXPForNextLevel()` advertised, and `progress` went negative at the start of
  each level. Levels now land exactly on the documented thresholds.
  Saves written before this fix keep the level they earned; their progress is
  clamped to 0 rather than reported negative.
- **Streaks in non-UTC timezones** - date keys used `toISOString()` (UTC), so
  players east or west of Greenwich lost or double-counted days. A UTC+8
  player's morning session did not register at all. Now uses the local calendar
  day.
- **Crash loading an older save** - `init()` read `player.streak` off whatever
  was persisted, throwing before first frame for any save predating that field.
  Loaded saves are now merged onto the current default shape.
- **Permanent save corruption from `NaN` XP** - `addXP(undefined)` wrote `NaN`
  to `player.xp` and persisted it. `addXP` now rejects non-finite input, and an
  achievement that omits `xp` awards 0 instead of poisoning the save.
- **One bad achievement blocked all others** - a throwing `check()` aborted the
  whole loop. Failures are logged and the remaining achievements still run.
- **Game ran at double speed after a restart** - `Ticker.stop()` left its
  `requestAnimationFrame` queued, and `DopamineKernel.start()` bound a fresh
  update function on every call, stacking duplicate loops.
- **`EventBus`** - `off()` removed only the first registration of a callback; a
  throwing listener aborted every lower-priority listener for that event (on
  `tick`, that silently stops the game); `once()` listeners registered during
  their own event fired immediately then were cleared unfired; `hasListeners()`
  returned `undefined` instead of `false`.
- **XSS in `GameUI`** - achievement name/description and summary score/metrics
  were interpolated into `innerHTML`. They now go in as text.
  `achievement.icon` still accepts HTML, as documented.
- **`GameUI.showSummary` under a CSP** - emitted inline `onclick` attributes,
  blocked by any `script-src` policy without `unsafe-inline`, and hardcoded
  `index.html` as the exit target.
- **Two UI instances collided** - `GameUI` and `ParticleSystem` looked elements
  up by global id, so a second instance rebound the first one's nodes and
  shared its canvas. Lookups are now instance-scoped.
- **Import under SSR, workers, and Safari private mode** - `DataService` and
  `SoundManager` touched `window`/`localStorage` in their constructors. Storage
  now falls back to an in-memory store.
- **`dopaminejs-themes@1.0.0` was unusable from CommonJS** - `main` and
  `exports.require` pointed at `dist/themes.umd.js` while the build emits
  `dist/themes.umd.cjs`, so every `require('dopaminejs-themes')` threw
  `MODULE_NOT_FOUND`. Fixed in 1.0.1. It also pinned `vite ^7` against the
  repo's `^5`, which forced a broken nested install and failed its own build on
  a clean checkout. `scripts/check-versions.js --dist` now fails CI if any
  declared entry point is missing from the build output.
- **`dopaminejs-plugin-webgl-particles` shipped a debug build** - it logged on
  every `emit()`, looked for a hardcoded `#game-container` element, and forced
  an 800x600 backing store. The container is now configurable and defaults to
  `document.body`.

### Added

- `GameUI.destroy()` and `ParticleSystem.destroy()` - tear down DOM nodes,
  pending timers, resize listeners, and observers.
- `SoundManager.setVolume()` / `getVolume()` - all output routes through a
  master gain node, so volume and mute apply uniformly.
- Particle canvas is backed by `devicePixelRatio` device pixels, so it is no
  longer soft on HiDPI displays. Drawing coordinates stay in CSS pixels.
- `showSummary` accepts `onReplay` / `onExit` callbacks.
- CI on Node 20 and 22, and an automated release workflow using npm Trusted
  Publishing with provenance attestation.
- Test suites for `EventBus`, `Ticker`, `GameUI`, and non-browser environments.

### Changed

- **`dopaminejs-plugins` is retired.** The bundled package was unpublished from
  npm on 2026-01-01; five of its six modules were duplicates of the standalone
  `dopaminejs-plugin-*` packages and had drifted apart. Install the individual
  packages instead. `CustomPhysicsPlugin`, which was only ever an example, moved
  to `examples/plugins/`.
- `jsdom` is now a declared devDependency. It previously resolved only because
  a stale lockfile remembered it, so a fresh lockfile would have broken five
  test files.

### Removed

- `packages/dopaminejs/src/dopamine/effects/WebGLParticleSystem.js` - dead code,
  exported by nothing, and a third drifted copy of the same file.
- `scripts/deploy.js` - v1-era release script, superseded by the workflow.
- `dopaminejs-1.0.0.tgz` - stale build artifact committed at the repo root.

## [2.0.2] - 2026-01-01

### Changed
- Reorganised plugin exports into unscoped `dopaminejs-plugin-*` packages.
- Removed sound pack support from core `SoundManager`; it now lives in
  `dopaminejs-plugin-sound-packs`.
- Unpublished the bundled `dopaminejs-plugins` package.

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
