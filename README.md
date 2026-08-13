# DopamineJS

> **Progression mechanics for web apps.** XP, levels, achievements and daily streaks you can
> drop into a product, plus the particles, sound and screen shake that make them land.

Every learning platform, habit tracker and onboarding flow eventually rebuilds the same
thing: points that accumulate, a level that goes up, a streak that must not be broken, and
some visual acknowledgement when it happens. There is no library for that, so teams write
it again each time, usually without the timezone handling that makes streaks correct.

DopamineJS is that library. The game engine underneath it is what makes the feedback feel
good, not the reason to install it.

## What it is for

- **Learning platforms**: daily streaks, XP per lesson, achievement unlocks
- **Habit and fitness apps**: streak preservation, milestone celebrations, progress toward a level
- **Onboarding and adoption**: progress that feels like something rather than a checklist
- **Internal tools**: the ones nobody opens voluntarily
- **HTML5 games**: the original use case, still supported

## Quick start

```bash
npm install dopaminejs
```

```javascript
import { RewardSystem, DataService } from 'dopaminejs';

const rewards = new RewardSystem(new DataService());
await rewards.init();

rewards.on('LEVEL_UP', ({ level }) => showLevelUpToast(level));
rewards.on('ACHIEVEMENT_UNLOCKED', (achievement) => celebrate(achievement));

// Somewhere in your app, when the user does the thing you want repeated
await rewards.addXP(250);

const { progress, needed } = rewards.getXPForNextLevel();
// progress: 0.75, needed: 50
```

That is the whole integration. Persistence is `localStorage` by default and swappable,
streaks are computed in the user's local calendar rather than UTC, and nothing renders
until you ask it to.

Want the visuals too:

```javascript
import { GameUI, ParticleSystem } from 'dopaminejs';
import 'dopaminejs/style.css';

const ui = new GameUI(new ParticleSystem(canvas));
ui.init();

rewards.on('LEVEL_UP', ({ level }) => ui.showLevelUp(level));
```

## Why streaks are the hard part

A daily streak is a calendar question, not a clock question. "Did they come back yesterday"
depends on the user's timezone, and a naive `Date` comparison breaks for anyone not on UTC,
silently, for a subset of users you will never hear from.

DopamineJS resolves streak boundaries in local time and the test suite is
[pinned to a non-UTC zone](scripts/run-tests.js) so a regression fails CI instead of passing
quietly on a UTC runner.

## 📦 Packages

### Core Package (MPL-2.0)

```bash
npm install dopaminejs
```

The core engine with:
- TypeScript declarations included, no `@types` package needed
- Plugin architecture (Kernel, EventBus, SystemRegistry)
- Default implementations (Canvas particles, Web Audio, basic physics)
- Reward system (XP, levels, achievements)
- Component-based game objects

**License**: MPL-2.0 (copyleft for core improvements)

---

### Plugin Packages (MIT)

Install only what you use. Each plugin is its own package.

| Package | Provides |
|---|---|
| `dopaminejs-plugin-webgl-particles` | `WebGLParticlePlugin` - GPU particles (10,000+) |
| `dopaminejs-plugin-howler-audio` | `HowlerAudioPlugin` - Advanced audio (Howler.js) |
| `dopaminejs-plugin-sound-packs` | Sound packs (retro, modern, cute, scifi) |
| `dopaminejs-plugin-ecosystem` | `BattlePassPlugin`, `LeaderboardPlugin`, webhooks |
| `dopaminejs-plugin-feedback-effects` | Floating text and confetti feedback |
| `dopaminejs-plugin-debug-overlay` | `DebugOverlayPlugin` - FPS and system inspector |

```bash
npm install dopaminejs-plugin-webgl-particles
```

> The bundled `dopaminejs-plugins` package was retired in 2.1.0 and unpublished
> from npm. Install the individual packages above instead; see
> [docs/MIGRATION.md](./docs/MIGRATION.md).

**License**: MIT (use freely, even commercially)

---

### Themes Package (MIT)

```bash
npm install dopaminejs-themes
```

UI themes:
- Modern, Dark Cyberpunk, Neon, Retro, Cute
- CSS variable-based
- Easy customization

**License**: MIT (use freely, even commercially)

---

## Using the game engine directly

The engine that powers the effects is exported too, if you are building an actual game
rather than adding progression to an app.

```javascript
import { Game } from 'dopaminejs';
import { WebGLParticlePlugin } from 'dopaminejs-plugin-webgl-particles';
import { themeEngine } from 'dopaminejs-themes';

const game = new Game();

// Add plugins
game.kernel.plugins.use(WebGLParticlePlugin);

// Set theme
themeEngine.setTheme('dark-cyberpunk');

game.start();
```

---

## 🏗️ Development

This is a monorepo using npm workspaces:

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Test all packages
npm run test

# Work on specific package
cd packages/dopaminejs
npm run dev
```

---

## 🚢 Releasing

Publishing is automated. There is no manual `npm publish` step and no npm token
in this repository; GitHub Actions authenticates via npm Trusted Publishing
(OIDC), which also attaches a provenance attestation to every release.

1. Bump the version of each package you want to publish.
2. Update `CHANGELOG.md`.
3. Tag with the core package's version and push:

```bash
git tag v2.1.0
git push origin v2.1.0
```

The `Publish` workflow (`.github/workflows/publish.yml`, the filename npm's
Trusted Publisher config is pinned to) verifies manifests, runs the tests, builds every
package, checks the tag matches `dopaminejs`'s version, then publishes only
those packages whose version is not already on npm. Re-running after a partial
failure is safe: already-published packages are skipped.

To preview without publishing, run the workflow manually from the Actions tab
with **dry run** left checked.

If a publish fails with `ENEEDAUTH`, run the workflow manually with **dry run**
checked. That runs a per-package OIDC diagnostic and prints the registry's
actual response, which `npm publish` hides:

- `HTTP 201` - trusted publishing is configured correctly for that package
- `HTTP 404 "package not found"` - no Trusted Publisher record exists for that
  package name, even though the package itself is on npm. Configure it at
  `npmjs.com/package/<name>/access`.

> The filename `publish.yml` is load-bearing. npm matches the OIDC request
> against the exact workflow filename registered on each package's Trusted
> Publisher config, so renaming this file breaks publishing until all eight
> packages are reconfigured on npmjs.com.

---

## 📝 Licensing

### Why Different Licenses?

- **Core (MPL-2.0)**: Ensures improvements to the core engine are shared back
- **Plugins/Themes (MIT)**: Maximum freedom for extensions and customization

### Can I use this commercially?

**Yes!** Both MPL-2.0 and MIT allow commercial use:
- MPL-2.0: You can use the core in commercial projects. If you modify the core files, share those modifications.
- MIT: Plugins and themes have zero restrictions.

---

## 🔗 Links

- [Documentation](./docs/)
- [Plugin Development Guide](./docs/PLUGIN_GUIDE.md)
- [Examples](./examples/)
- [Issues](https://github.com/BaryoDev/dopaminejs/issues)

---

## 📄 License

- **dopaminejs**: MPL-2.0
- **dopaminejs-themes**: MIT
- **dopaminejs-plugin-\***: MIT

See individual package LICENSE files for details.
