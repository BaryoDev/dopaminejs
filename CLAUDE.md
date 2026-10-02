# CLAUDE.md

Notes for an AI assistant working in this repo. Every claim here can be checked
against the code. If one is wrong, fix this file in the same change.

## What this is

DopamineJS adds progression to web apps: XP, levels, achievements and daily
streaks, plus the particles, sound and screen shake that go with them. A small
game engine sits underneath and is exported too.

npm workspaces monorepo, nine packages under `packages/`:

| Package | Licence | Holds |
|---|---|---|
| `dopaminejs` | MPL-2.0 | Core: rewards, UI, effects, engine |
| `dopaminejs-react` | MIT | `RewardsProvider`, `useRewards()` |
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
```

CI (`.github/workflows/ci.yml`) runs all of these on Node 20.19 and 22.12.
Run them all before saying a change is done.

All tests live in `packages/dopaminejs/tests/`, including the tests for the
plugin and React packages. A vite alias maps `dopaminejs` to the core source,
so plugin sources can be imported directly.

## Layout of the core

```
packages/dopaminejs/src/
  index.js            public exports
  dopamine/           the product: RewardSystem, DataService, GameUI,
                      ParticleSystem, SoundManager, the Dopamine facade
  core/               engine: DopamineKernel, EventBus, SystemRegistry,
                      PluginRegistry, Game, Scene, GameObject, Component, Collider
  systems/            Ticker, Physics, Input, Loader, Director
  interfaces/         system contracts
  renderer/           Canvas 2D renderer
```

## Two event systems

They are different classes with different rules. Mixing them up is the most
common mistake in this repo, and the old README did it.

`RewardSystem` extends `EventEmitter`. `on` returns an unsubscribe function.

```javascript
const stop = rewards.on('level_up', ({ oldLevel, newLevel, totalXP }) => {});
stop();
```

The kernel `EventBus` takes a numeric priority as the third argument and has
no unsubscribe return. Keep the callback and call `off`.

```javascript
kernel.events.on('tick', this._onTick, 10);
kernel.events.off('tick', this._onTick);
```

Event names are lowercase strings: `tick`, `fixed_update`, `render`,
`collision_enter`, `collision_exit`, `xp_gained`, `level_up`, `achievement_unlocked`,
`new_high_score`, `streak_updated`, `save_failed`. `EventBus.Events.LEVEL_UP`
is a constant whose value is `'level_up'`. Listening for `'LEVEL_UP'` never
fires.

Pass `events` or `kernel` in the `RewardSystem` config to mirror reward events
onto the bus.

## Engine API that is easy to get wrong

- `scene.add(obj)` and `scene.remove(obj)`. There is no `addGameObject`.
- `game.setScene(scene)` or `director.run(scene)`. There is no `changeScene`.
- `GameObject` has `x`, `y`, `rotation` and `scale: { x, y }`. No `position`.
- `kernel.systems.register(name, system, { priority, dependencies })`.
- `new ParticleSystem(config)` takes a config object, not a canvas.
- `new GameUI(particleSystem)` builds its DOM in the constructor. Do not call
  `init()` again.
- `ui.showLevelUp(oldLevel, newLevel)`.
- `rewards.getXPForNextLevel()` returns `{ total, needed, progress }`.
- `rewards.init()` must resolve before `addXP` or `recordGame`.

## Rules

- **The public API is snapshot tested.** `tests/publicApi.test.js` compares
  the exports with `tests/approved-api/*.approved.txt`. An intended change
  means updating the approved file in the same commit. `tests/types.test.js`
  checks that `types/index.d.ts` declares exactly what the module exports.
- **No runtime dependencies in the core.**
- **Streak dates are local calendar dates**, never UTC. The test timezone is
  pinned so a UTC assumption fails.
- **Look up by own property.** Game names, achievement ids and sound keys come
  from callers. Use an own-property check (the `hasOwn` helpers), never `obj[key]` alone or
  `key in obj`.
- **Saved state is untrusted.** Anything read from storage goes through
  `RewardSystem._migrate`.
- **`achievement.icon` is rendered as HTML on purpose.** Every other field is
  text. See `SECURITY.md`.
- **Anything that adds a listener, timer or DOM node removes it in
  `destroy()`**, and a test proves it.
- **The v1 globals stay.** `GlobalPhysics`, `GlobalInput` and `GlobalLoader`
  warn once on first use. Removing them needs a major version.
- The core entry has a default export (`Dopamine`) for v1 compatibility. New
  code uses named exports.

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
