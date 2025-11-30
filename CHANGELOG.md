# Changelog

All notable changes to this project will be documented in this file.

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
