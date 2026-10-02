# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **`dopaminejs-react` 1.0.0 is published to npm.** `RewardsProvider` and
  `useRewards()`. It needs `dopaminejs` 2.3.0 or newer, the first version with
  the `streak_updated` event it listens for. The package was in the repo
  before and marked private.

## [2.4.0] - 2026-10-02

Published with this release: `dopaminejs` 2.4.0 and
`dopaminejs-plugin-webgl-particles` 1.1.2. `dopaminejs-react` is not on npm,
so its fix is in the repo only.

### Added

- **Physics emits `collision_enter` and `collision_exit` on the kernel event
  bus.** The constants existed and nothing emitted them. `collision_enter`
  fires once when two colliders start to overlap, `collision_exit` once when
  they stop or when one of them is removed. Both carry `{ a, b }`, the two
  colliders, typed as `CollisionEvent`. `onCollisionEnter` on a component is
  unchanged and still runs on every step while the pair overlaps.

### Fixed

- **`plugins.remove(name)` unregisters the systems the plugin registered
  during `init()`.** They stayed registered and kept updating, which
  `FeedbackPlugin`, `WebGLParticlePlugin` and `HowlerAudioPlugin` all relied
  on the caller to clean up. A system that something else has replaced since
  is left alone. Two cases are not tracked and stay the plugin's to unregister
  in `destroy()`: a system registered after `init()`, and one registered while
  two `useAsync()` inits overlapped. The fix is in the core, so it applies to
  the published plugin versions.
- **`SoundManager.preloadSounds()` registers its keys.** Called before the
  audio context existed it did nothing, so a later `play(key)` did not find
  the sound. The files now load when the context is created, as with
  `registerSound()`.
- **`WebGLParticlePlugin` no longer logs a Canvas fallback it does not set
  up.** Without WebGL it registers nothing and says so, and an existing
  `particles` system is left in place.
- **`dopaminejs-react`: `addXP(amount, reason)` passes the reason through.**
  It was dropped, so `xp_gained` always carried an empty reason.

### Changed

- **Build and test tools updated.** vite 8.3, vitest 4.1, jsdom 28.1 and
  size-limit 12.1. These are the newest versions that still run on Node 20.19.
  The core build now writes one shared chunk that `dopaminejs` and
  `dopaminejs/engine` both import. The export names of every entry point are
  unchanged.

## [2.3.1] - 2026-10-01

Published with this release: `dopaminejs` 2.3.1. Types only, no runtime change.
`dopaminejs-themes` 1.0.2 followed the same day with a README change only.

### Fixed

- **Engine type declarations now match the runtime.** `GameObject` declares
  `x`, `y`, `scale: { x, y }` and `parent`, not a `position` vector that never
  existed. `Collider.getBounds()` returns `BoxBounds` (`left`, `right`, `top`,
  `bottom`) or `CircleBounds` (`x`, `y`, `radius`). `Physics.checkOverlap()`
  returns `Collider[]` and its tag is optional. `Collider.tag` is declared.
  `ParticleConfig` accepts `angle` and a list of colours. TypeScript code
  written against the old declarations compiled and then read `undefined`, so
  it will now fail to compile at those points. No runtime change.

### Documentation

- **`dopaminejs-themes` 1.0.2 carries the corrected README to npm.** A theme
  sets `--dopamine-*` variables on the document root and the core stylesheet
  does not read them yet, so a theme changes only CSS written against those
  variables. No code change in the package.

## [2.3.0] - 2026-10-01

Fixes from a full audit of the repo. Core changes are additive. The
`dopaminejs-plugin-ecosystem` changes are breaking for that package.

Published with this release: `dopaminejs` 2.3.0,
`dopaminejs-plugin-ecosystem` 2.0.0 (needs `dopaminejs` 2.3.0 or newer),
`dopaminejs-plugin-feedback-effects` 1.0.2, `dopaminejs-plugin-debug-overlay`
1.0.1, `dopaminejs-plugin-webgl-particles` 1.1.1. `dopaminejs-react` is not on
npm yet and is not part of this release.

### Security

- **`recordGame` and `unlockAchievement` no longer reach `Object.prototype`.**
  A game name of `__proto__` wrote stats onto every object in the page, and an
  achievement id of `constructor` unlocked an inherited property. Both now use
  own-property lookups, and `recordGame` throws a `TypeError` for an empty,
  non-string or reserved name. `RewardMiddleware` and `SoundManager` got the
  same lookup fix.
- **Saved player state is validated on load.** A tampered or corrupt save is
  coerced back to valid numbers and plain records instead of producing `NaN`
  XP or throwing later.
- **`WebhookIntegration` no longer sends its secret.** The old "signature"
  was `btoa(secret + ':' + payload)`, so every request carried the secret
  itself, in a header and in the body. It is now
  `X-Dopamine-Signature: sha256=<hex>`, the HMAC-SHA256 of the exact body
  sent. Rotate any secret used with an earlier version. See `SECURITY.md` for
  what a browser-side secret can and cannot prove.
- **`LeaderboardPlugin` sends nothing until configured.** It shipped with a
  placeholder URL and a hardcoded secret. Use
  `LeaderboardPlugin.configure({ webhookUrl, secret, playerId })`.
- Workflow actions are pinned to commit SHAs, CI runs with a read-only token
  and `npm audit --omit=dev --audit-level=high`, the publish job pins its npm
  version, and Dependabot watches npm and actions.

### Added

- `Dopamine.destroy()` removes the overlay and canvas, stops audio and
  detaches from the reward system.
- `streak_updated` and `save_failed` events on `RewardSystem`.
- Storage may return promises (`AsyncStorageLike` in the types).
- `ParticleSystem` options `maxParticles` (default 5000) and
  `respectReducedMotion` (default true). The stylesheet also honours
  `prefers-reduced-motion`.
- `GameUI` announces achievements, level ups and notifications through an
  `aria-live` region.
- `SoundManager.destroy()`.
- `WebhookIntegration` option `maxQueue` (default 100, oldest dropped).

### Fixed

- The `Dopamine` facade showed level 1, 0 XP and streak 1 until the first
  event, whatever was saved. It now draws the loaded player after `init()`.
- The XP bar filled by lifetime XP against the next threshold instead of
  progress within the level.
- The streak badge did not update when the streak changed.
- `showNotification` wrapped rare and legendary messages in unrelated combo
  and lucky-bonus text. The message is shown as written.
- `recordGame` with a non-finite or non-numeric score corrupted the high
  score. It now throws before changing anything. A negative score no longer
  takes XP away.
- Calling `addXP` or `recordGame` before `init()` threw a null `TypeError`.
  The error now says `init()` is missing.
- A failed save was silent. It emits `save_failed`.
- One throwing ticker callback or system stopped the whole loop. Each is now
  isolated and logged once.
- A plugin whose `init` threw or rejected left the systems it had registered
  behind.
- `Scene.remove` did not call `onDetach`, so colliders of removed objects
  kept colliding. Removing an object during `update` skipped its neighbour.
  Colliders of the previous scene also stayed in physics after a scene
  change. The `Director` now clears the old scene's kernel on exit.
- `addXP` with a negative amount larger than the player's XP reported the
  amount asked for. `xpGained` and the `xp_gained` event now carry what was
  removed.
- Overlapping saves on promise storage could finish out of order and keep the
  older value. `DataService` now sends one write at a time.
- A system whose `destroy` threw stayed registered.
- `ScreenShake` restarted mid-shake saved the shaken position as the origin.
- `ParticleSystem` ran at frame rate, so effects were twice as fast on a
  120 Hz display. It is now time based. A missing container selector fell
  through to a crash.
- `SoundManager` fetched the same sound once per concurrent call and accepted
  HTTP error pages as audio. The `customSounds` preload was a no-op, so each
  sound loaded on first play. They now load when the audio context is created.
- `FeedbackSystem` ignored its per-type colours, and `confetti(Infinity)`
  hung the page. `WebGLParticleSystem` had the same hang, threw without
  WebGL, and did not recover from a lost context.
- `BattlePassPlugin` looked up a system that is never registered, so it never
  unlocked a tier. `DebugOverlayPlugin` and `LeaderboardPlugin` left their
  listeners behind on `destroy`.
- `progress` from `useRewards()` in `dopaminejs-react` was always 0, and the
  hook did not re-render on a streak change.
- README examples used event names and signatures that do not exist.

### Changed

- **Breaking, `dopaminejs-plugin-ecosystem`:** the webhook body is
  `{ event, data, timestamp }` with no `signature` field, the signature format
  changed as above, `LeaderboardPlugin` needs `configure()`, and
  `BattlePassPlugin` announces a tier with a `battlepass:tier-unlocked` event
  instead of a console log.
- `recordGame` rejects with a `TypeError` on a bad game name or score where it
  used to store the bad value.
- The size budget measured an empty import (26 B against 19 KB). It now
  measures the whole ESM entry against 14 KB.
- Dev tooling: vitest 3, vite 7, and the lighter size-limit preset. Advisories
  in the dev tree went from 14 to 2 moderate.

## [2.2.0] - 2026-08-07

### Added

- **TypeScript declarations.** `types/index.d.ts` ships with the package and is
  wired into `exports`, so TypeScript consumers get completion and checking
  without the project adopting TypeScript. Two checks keep them honest: `tsc`
  compiles a realistic usage file, and a runtime test compares every declared
  export against what the module actually exports, so declarations cannot drift
  from the implementation. That second check caught three exports that had been
  declared but did not exist.
- **`RewardSystem` can bridge onto the kernel `EventBus`.** `EventBus.Events`
  already declared `XP_GAINED`, `LEVEL_UP`, `ACHIEVEMENT_UNLOCKED` and
  `NEW_HIGH_SCORE` with nothing emitting them. Pass `events` (an `EventBus`) or
  `kernel` in the `RewardSystem` config and those events are mirrored onto the
  bus. The existing `rewardSystem.on(...)` surface is unchanged, so this is
  additive.
- `EventEmitter`, `createMemoryStorage` and `resolveStorage` are now exported
  from the package root.

### Fixed

- **Importing the package printed three deprecation warnings**, one per v1
  global, whether or not the consumer touched any of them. `GlobalPhysics`,
  `GlobalInput` and `GlobalLoader` now warn once on first actual use. Found by
  installing the packed tarball and requiring it, which is the only way this
  class of defect shows up.

### Changed

- **`recordGame` writes to storage once instead of four times.** `addXP` and
  each `unlockAchievement` saved independently, so a single game produced four
  full JSON serializations of the player object. Writes are now batched to one
  per call. Mutations outside a batch still save immediately, so nothing else
  changes for callers.

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
