# DopamineJS

> **Progress feedback for any web app.** XP, levels, achievements and daily streaks you can
> drop into a product, plus the particles and sound that make them land.

Every learning platform, habit tracker and onboarding flow eventually rebuilds the same
thing: points that accumulate, a level that goes up, a streak that must not be broken, and
some visual acknowledgement when it happens. There is no library for that, so teams write
it again each time, usually without the timezone handling that makes streaks correct.

DopamineJS is that library. Progress is the core, and the visual and audio feedback are
parts you can keep, swap or leave out.

## What it is for

- **Learning platforms**: daily streaks, XP per lesson, achievement unlocks
- **Habit and fitness apps**: streak preservation, milestone celebrations, progress toward a level
- **Onboarding and adoption**: progress that feels like something rather than a checklist
- **Internal tools**: the ones nobody opens voluntarily
- **Games**: they keep working through `dopaminejs/games` (next step of 3.0)

## Quick start

```bash
npm install dopaminejs
```

```javascript
import { RewardSystem, DataService } from 'dopaminejs';

const rewards = new RewardSystem(new DataService());
await rewards.init();

rewards.on('level_up', ({ newLevel }) => showLevelUpToast(newLevel));
rewards.on('achievement_unlocked', (achievement) => celebrate(achievement));

// Somewhere in your app, when the user does the thing you want repeated
await rewards.addXP(250);

const { progress, needed } = rewards.getXPForNextLevel();
// progress: 0.75, needed: 50
```

That is the whole integration. Persistence is `localStorage` by default and swappable,
streaks are computed in the user's local calendar rather than UTC, and nothing renders
until you ask it to.

Want the visuals and sound too. `createDopamine` builds the parts, wires them to the
progress events and installs plugins:

```javascript
import { createDopamine } from 'dopaminejs';
import 'dopaminejs/style.css';

const dopamine = createDopamine({ plugins: [] });
await dopamine.ready;

await dopamine.progress.addXP(250);   // the bar moves, the sound plays
```

Each part (`ui`, `particles`, `sound`, `haptics`) is a value, a factory, or `false` for none.
`RewardUI` takes a second argument to change its copy and icons:

```javascript
import { RewardUI } from 'dopaminejs';

new RewardUI(parts, {
    text: { levelUp: 'Level up', achievementUnlocked: 'Unlocked' },
    icons: { streak: '*' },   // a string or a DOM Node (a Node is moved, not copied)
    safeIcons: true,          // the default: string icons become allowlisted SVG or text
    injectCss: false          // true adds the stylesheet from code
});
```

Importing `dopaminejs` has no side effects. Import `dopaminejs/style.css` yourself, or pass
`injectCss: true`.

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

The core with:
- TypeScript declarations included, no `@types` package needed
- `createDopamine` with swappable parts and a plugin contract
- Default parts (DOM overlay, Canvas particles, Web Audio)
- Reward system (XP, levels, achievements, streaks)

**License**: MPL-2.0 (copyleft for core improvements)

---

### Plugin Packages (MIT)

Install only what you use. Each plugin is its own package.

| Package | Provides |
|---|---|
| `dopaminejs-plugin-webgl-particles` | `webglParticles()` - a GPU particle part |
| `dopaminejs-plugin-howler-audio` | `howlerSound()` - a sound part on Howler.js |
| `dopaminejs-plugin-sound-packs` | `soundPack(name)` - retro, modern, cute, scifi |
| `dopaminejs-plugin-ecosystem` | `webhooks()` - signed event webhooks with a queue |
| `dopaminejs-plugin-debug-overlay` | `debugOverlay()` - live snapshot and event log |

```bash
npm install dopaminejs-plugin-webgl-particles
```

> Coming from 2.x? See [docs/MIGRATION-3.0.md](./docs/MIGRATION-3.0.md).

**License**: MIT (use freely, even commercially)

---

### Themes Package (MIT)

```bash
npm install dopaminejs-themes
```

UI themes:
- Modern, Dark Cyberpunk, Neon, Retro, Cute
- Each theme sets `--dopamine-*` CSS variables on the document root
- The core stylesheet does not read those variables yet. Use them in your own CSS.

**License**: MIT (use freely, even commercially)

---

### React Package (MIT)

```bash
npm install dopaminejs dopaminejs-react
```

`RewardsProvider` and the `useRewards()` hook. Needs `react` 18 or newer and `dopaminejs` 2.3.0 or newer. See `packages/dopaminejs-react/README.md`.

---

### Vue Package (MIT)

Not on npm yet. `provideRewards()` and the `useRewards()` composable for Vue 3.3 or newer, with `dopaminejs` 2.3.0 or newer. See `packages/dopaminejs-vue/README.md`.

---

## React Native, Expo and other non-browser runtimes

`dopaminejs/core` exports only the progression API: `RewardSystem`, `DataService`, `EventEmitter`, `DopamineError`, `merge`, `validate`, `createMemoryStorage` and `resolveStorage`. It has no UI, particles or sound, and nothing in it touches `window`, `document` or `localStorage` at import time. Only the default-storage fallback (`resolveStorage`) probes `localStorage`, so pass `storage` outside a browser. CI imports the built output in plain Node with those globals unset and runs `init` and `record` (`scripts/check-core-import.js`).

The entry resolves only through the `exports` field of `package.json`. Metro honours it by default from React Native 0.79 and Expo SDK 53. Older versions need `config.resolver.unstable_enablePackageExports = true` in `metro.config.js`.

`DataService` awaits every storage call, so AsyncStorage works as is:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardSystem, DataService } from 'dopaminejs/core';

const rewards = new RewardSystem(new DataService({ storage: AsyncStorage }));
rewards.on('level_up', ({ newLevel }) => console.log(`Level ${newLevel}`));
await rewards.init();

await rewards.record('quiz', { score: 80, won: true });
```

Any object with promise-returning `getItem`, `setItem` and `removeItem` works the same way.

If the saved player cannot be read (`getItem` throws or rejects), `init()` still resolves with a new player in memory, fires `load_failed` with `reason: 'read'`, and saves nothing for the rest of the session, so the real player is never overwritten. Call `init()` again to retry; a retry that fails again keeps the progress made in memory. If the saved value is not valid JSON, it is kept under the `player_corrupt` key as a JSON string (`JSON.parse` it once to get the original), `load_failed` fires with `reason: 'corrupt'`, and a new player starts. If that backup cannot be written, `backedUp` is false and nothing is saved this session. A data service that overrides `load` must pass the third argument (`{ strict: true }`) on, or a failed read looks like an empty one. `rewards.loadFailed` is `true` after a failed read, and the React and Vue packages expose it as `loadFailed`. Show the visitor that progress is not being kept when it is. A failed write fires `save_failed`.

`merge(a, b)` joins two saves of the same player into one, in any order, so a server can merge saves without a browser. `rewards.export()` gives the saved document and `rewards.import(doc)` merges one in.

Without a `storage` option, `DataService` falls back to `localStorage` if present, then to memory, so state is lost when the app closes. `RewardUI`, `ParticleSystem` and `SoundManager` are web only and stay on the root `dopaminejs` entry.

---

## Plugins

A subscriber plugin is `{ name, version, api: 3, install(ctx) }` and `install` returns a disposer.
Parts and middleware are the other two shapes. See [docs/PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md).

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

- **Core (MPL-2.0)**: Ensures improvements to the core are shared back
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
