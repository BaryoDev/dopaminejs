# Migration guide: 2.x to 3.0

3.0 is progress feedback for any web app: XP, levels, achievements and streaks, shown
with a bar, popups, particles and sound. The game engine is gone. If your game needs the
engine, stay on 2.x. 2.x is unsupported and gets no more fixes.

## Removed

- The engine layer: the kernel, scenes, game objects, physics, input, the loader and
  the camera effects, with the `dopaminejs/engine` entry.
- The default export. Use named imports.
- `SoundManager.playSuccess` and the `success` sound key. `playJump`, `playScore` and
  `playGameOver` too. The `jump`, `score` and `gameover` keys exist while
  `gameFeedback()` is installed.
- The event bus options of the `RewardSystem` config.
- `RewardMiddleware`, `BattlePassPlugin` and `LeaderboardPlugin` from
  `dopaminejs-plugin-ecosystem`. The package stays, with `webhooks()`.
- The `dopaminejs-plugin-feedback-effects` package. The core popups, text and
  particles cover it.

## Renames

| 2.x | 3.0 |
|---|---|
| `recordGame(name, stats)` | `record(activity, result)` |
| `new_high_score` | `personal_best` |
| `GameUI` | `RewardUI` (no alias) |
| `showNotification`, `showAchievement`, `showLevelUp` | `popup` |
| `showCombo`, `showNearMiss`, `showLuckyMoment`, `showSummary` | methods of `gameFeedback()` from `dopaminejs/games` |
| `totalPlays`, `highScore` | `plays`, `best` |
| `rewardSystem` | `progress` |
| `rewards.player` (field) | `rewards.snapshot()` |

`snapshot()` returns a frozen copy. Nothing hands out the live document.

## Plugins

A 2.x plugin was `{ name, init(kernel), destroy }`. A 3.0 plugin is:

```javascript
export const myAnalyticsPlugin = {
    name: 'my-analytics-plugin',
    version: '1.0.0',
    api: 3,
    install(ctx) {
        const off = ctx.events.on('level_up', ({ newLevel }) => send('level', newLevel));
        return () => off();
    }
};
```

`install` returns the disposer, so there is no `destroy`. A plugin built for another api
number is refused with `plugin_api`. The shapes are in [PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md).

The first-party plugin packages changed with it:

| Package | 2.x | 3.0 |
|---|---|---|
| `dopaminejs-plugin-webgl-particles` | `WebGLParticlePlugin` | `webglParticles(opts)`, a particle part. Returns null without WebGL. |
| `dopaminejs-plugin-howler-audio` | `HowlerAudioPlugin` | `howlerSound(opts)`, a sound part |
| `dopaminejs-plugin-sound-packs` | pack lookup | `soundPack(name)`, a plugin that registers each sound on `sound` |
| `dopaminejs-plugin-debug-overlay` | `DebugOverlayPlugin` | `debugOverlay(opts)`, a plugin |
| `dopaminejs-plugin-ecosystem` | `WebhookIntegration` and three plugins | `webhooks(opts)` and `WebhookIntegration` |
| `dopaminejs-themes` | `themeEngine` | `theme(name)` plugin, applied to the UI root |

The peer range of every package is `dopaminejs@^3.0.0`.

## Old saves

A 2.x save loads on first use. Its XP and plays go under one fixed `legacy` entry, so
the same save on two devices merges without doubling. Separate progress on two devices
merges by the larger value, not the sum. Migrated XP is the old XP minus the rewards of
achievements already unlocked, because the reward is now part of the achievement.

A fresh player starts with an empty `playDates` list and a streak of 0.

## Other changes

- Importing `dopaminejs` adds no CSS. Import `dopaminejs/style.css`, or pass
  `injectCss: true` to `RewardUI`.
- `achievement.icon` is shown as text or sanitised SVG. Pass `safeIcons: false` to render
  HTML.
- `ParticleSystem` has `burst(kind, at?, opts?)` for `confetti`, `sparkle`, `fire`,
  `stars` and `coins`. An unknown kind does nothing.
- `SoundManager.play(key)` ignores keys it does not know, and `register(key, source)`
  adds a URL or a synth function.

## Start here

```javascript
import { createDopamine } from 'dopaminejs';
import 'dopaminejs/style.css';

const dopamine = createDopamine();
await dopamine.ready;
await dopamine.progress.record('quiz', { score: 12 });
```

Game helpers (combo, near miss, lucky moment, summary):

```javascript
import { gameFeedback } from 'dopaminejs/games';

const feedback = gameFeedback();
createDopamine({ plugins: [feedback] });
feedback.combo(3, x, y);
```

Tests for your own parts and plugins: `dopaminejs/testing` has `createTestHost()` and the
`conformance` suites. It needs `vitest`.
