# CLAUDE.md

Notes for an AI assistant working in this repo. Every claim here can be checked
against the code. If one is wrong, fix this file in the same change.

## What this is

DopamineJS adds progression to web apps: XP, levels, achievements and daily
streaks, plus the particles and sound that go with them. `createDopamine()`
wires swappable parts and plugins together.

npm workspaces monorepo, ten packages under `packages/`:

| Package | Licence | Holds |
|---|---|---|
| `dopaminejs` | MPL-2.0 | Core: rewards, UI, effects, host and plugins |
| `dopaminejs-react` | MIT | `RewardsProvider`, `useRewards()` |
| `dopaminejs-vue` | MIT | `provideRewards()`, `useRewards()` (private until first publish) |
| `dopaminejs-themes` | MIT | CSS variable themes |
| `plugin-webgl-particles`, `plugin-howler-audio`, `plugin-sound-packs`, `plugin-ecosystem`, `plugin-feedback-effects`, `plugin-debug-overlay` | MIT | One plugin each, published as `dopaminejs-plugin-*` |

The source is plain JavaScript with JSDoc. The core has zero runtime
dependencies (`npm run check-zero-deps`). TypeScript declarations are written
by hand in `packages/dopaminejs/types/index.d.ts` and ship with the package.

## Commands

Run from the repo root. Node 20.19 or newer.

```bash
npm ci
npm test                 # vitest, pinned to TZ=Asia/Manila by scripts/run-tests.js
npm test -- tests/RewardSystem.test.js -t "streak"
npm run typecheck        # tsc over types/ and type-tests/
npm run build            # every package
npm run size             # needs a build first
npm run check-zero-deps
node scripts/check-versions.js --dist   # needs a build first
node scripts/check-core-import.js       # needs a build first
```

CI (`.github/workflows/ci.yml`) runs all of these on Node 20.19 and 22.12.
Run them all before saying a change is done.

All tests live in `packages/dopaminejs/tests/`, including the tests for the
plugin, React and Vue packages. A vite alias maps `dopaminejs` to the core source,
so plugin sources can be imported directly.

## Layout of the core

```
packages/dopaminejs/src/
  index.js            public exports, no default export, no side effects
  progression.js      the `dopaminejs/core` subpath, no browser globals allowed
  dopamine/
    host.js           createDopamine, HOST_API, the plugin contract
    core/             RewardSystem, DataService, EventEmitter, merge, validate
    ui/               RewardUI and dopamine.css
    effects/          ParticleSystem
    audio/            SoundManager
    feel/             haptics, reduced motion
```

`dopaminejs/style.css` is emitted by the build from `ui/dopamine.css`. Nothing
imports it. `RewardUI` takes `injectCss: true` to add it from code.

## Events

`RewardSystem` extends `EventEmitter`, and it is the one event bus. `on`
returns an unsubscribe function.

```javascript
const stop = rewards.on('level_up', ({ oldLevel, newLevel, totalXP }) => {});
stop();
```

Core events: `xp_gained`, `level_up`, `achievement_unlocked`, `personal_best`,
`streak_updated`, `save_failed`, `load_failed`. Plugin events are named
`<plugin>:<event>`. Listeners are synchronous and each is wrapped, so a
throwing one does not stop the others.

## Host and plugins

- `createDopamine({ progress, ui, particles, sound, haptics, storage, clock, plugins })`.
  A part is a value, a factory `(env) => part | null` (null means the default),
  or `false` for none.
- `streakDays` (`'any'` default, or `'record'`) on `RewardSystem` and `createDopamine`
  decides whether `addXP` marks a play day. Achievement reward XP never does.
- `host.parts` has getters only. Read a part when you need it, never keep it.
- A plugin is `{ name, version, api: 3, after?, requires?, install(ctx) }`.
  `install` returns a disposer. A wrong `api` throws `plugin_api`.
- Plugins install in array order and dispose in reverse. `ctx.events.on`
  listeners are removed on dispose. `ctx.storage` is namespaced `dopamine_<plugin>_`.

## API that is easy to get wrong

- `new ParticleSystem(config)` takes a config object, not a canvas.
  `burst(kind, at?, opts?)` takes confetti, sparkle, fire, stars or coins; an
  unknown kind does nothing.
- `new RewardUI(parts, config?)` builds its DOM in the constructor. `parts` is
  read at call time. `config` takes `text`, `icons.streak`, `safeIcons` and
  `injectCss`. Use `hud()`, `popup()` and `text()`.
- `SoundManager.play(key)` knows xp, level_up, achievement, personal_best, click
  and error, and ignores other keys.
- `rewards.getXPForNextLevel()` returns `{ total, needed, progress }`.
- `rewards.init()` must resolve before `addXP` or `record`. `createDopamine`
  does that in `host.ready`.

## Rules

- **The public API is snapshot tested.** `tests/publicApi.test.js` compares
  the exports with `tests/approved-api/*.approved.txt`. An intended change
  means updating the approved file in the same commit. `tests/types.test.js`
  checks that `types/index.d.ts` declares exactly what the module exports.
- **No runtime dependencies in the core.**
- **`spec/` holds the language-neutral conformance fixtures**, and
  `tests/conformance.test.js` runs them. A rule change in `RewardSystem` means
  changing a fixture in the same commit. See `spec/README.md`.
- **Streak dates are local calendar dates**, never UTC. The test timezone is
  pinned so a UTC assumption fails.
- **Look up by own property.** Game names, achievement ids and sound keys come
  from callers. Use an own-property check (the `hasOwn` helpers), never `obj[key]` alone or
  `key in obj`.
- **Saved state is untrusted.** Anything read from storage, and anything
  passed to `import` or `merge`, goes through `validate`.
- **The save is a document that merges.** `merge` is pure, reads no clock and
  is the same in any order. Nothing hands out the document: callers get frozen
  `snapshot()` copies. Time comes from the `clock` in the config.
- **`achievement.icon` is safe text by default.** `RewardUI` shows a string
  icon as text or allowlisted SVG. `safeIcons: false` renders it as HTML. A
  string `icons.streak` follows the same rule. A Node icon is always moved in,
  never parsed. Every other field is text. See `SECURITY.md`.
- **Anything that adds a listener, timer or DOM node removes it in
  `destroy()`**, and a test proves it.
- The core entry has no default export and no import side effects. A test proves it.

Style: 4-space indent, semicolons, single quotes, underscore prefix for
private members, one class per file. Comments say why, not what.

## Releasing

Publishing is tag driven through `.github/workflows/publish.yml` with npm
Trusted Publishing (OIDC). No npm token exists. The filename `publish.yml` is
registered on npm for every published package, so do not rename the file or
add an `environment:` to the job without reconfiguring each package on
npmjs.com.

A new package cannot get a Trusted Publisher record until it exists on npm.
Keep it `"private": true` until its first version is published and the record
for `publish.yml` is added, or the dry run fails on it. `dopaminejs-react`
went through this.

Bump the versions, update `CHANGELOG.md`, tag `v<core version>`, push the tag.
Only packages whose version is not on npm get published. Never run
`npm publish` by hand. Details are in the README.

## Commits

Short imperative subject in plain words, for example "stop the ticker loop
dying on one bad callback". A body only when the reason is not clear from the
diff. No attribution trailers.
