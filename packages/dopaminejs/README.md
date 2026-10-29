# dopaminejs

> Progression mechanics for web apps. XP, levels, achievements, and timezone-correct daily streaks, with the particles and sound to make them land.

Zero runtime dependencies. Works with any framework.

```bash
npm install dopaminejs
```

## Quick start

```javascript
import { createDopamine } from 'dopaminejs';
import 'dopaminejs/style.css';

const dopamine = createDopamine();
await dopamine.ready;
await dopamine.progress.addXP(100);
```

Importing `dopaminejs` touches no document or window, and there is no default export.
Without the DOM, `ui` and `particles` are simply absent.

## What's in the box

| Piece | Does |
|---|---|
| `createDopamine` | Builds the parts, wires default feedback, installs plugins |
| `RewardSystem` | XP, levels, achievements, daily streaks |
| `RewardUI` | DOM overlay: XP bar, level badge, popups, floating text |
| `ParticleSystem` | Canvas particles: confetti, sparkle, fire, stars, coins |
| `SoundManager` | Synthesized effects via Web Audio, or your own audio files |
| `DataService` | `localStorage` persistence with an in-memory fallback |

## Custom achievements

```javascript
dopamine.progress.defineAchievement('die_100_times', {
    name: 'You Tried',
    description: 'Lose 100 times',
    icon: 'skull',
    xp: 50,
    check: (player) => player.stats.breakout?.deaths >= 100
});
```

`icon` is shown as text or sanitised SVG by default. Pass `safeIcons: false` to
`RewardUI` to render it as HTML. Every other field is always text.

## Streak days

A streak counts the days the player did something. By default `record()` and `addXP()`
both mark today as a play day. To count only `record()`:

```javascript
new RewardSystem(data, { streakDays: 'record' });
createDopamine({ streakDays: 'record' });
```

XP from an achievement reward never marks a day. A new player has a streak of 0 until
the first marked day.

## Built-in achievements

`first_game`, `level_5`, `level_10`, `streak_3` and `streak_7` are defined by default.
To define none of them, and still use your own `achievements`:

```javascript
new RewardSystem(data, { builtinAchievements: false });
createDopamine({ builtinAchievements: false });
```

A save that already holds one of them (from an older version or another device)
keeps it and its XP. `getUnlockedAchievements()` returns it without a `name`, since
no definition is loaded. `defineAchievement` can still add one of those ids by hand.
Any value but `false` means `true`.

## Plugins

Install only what you need:

- [`dopaminejs-plugin-webgl-particles`](https://www.npmjs.com/package/dopaminejs-plugin-webgl-particles) - GPU particle part
- [`dopaminejs-plugin-howler-audio`](https://www.npmjs.com/package/dopaminejs-plugin-howler-audio) - Howler.js sound part
- [`dopaminejs-plugin-sound-packs`](https://www.npmjs.com/package/dopaminejs-plugin-sound-packs) - retro, modern, cute, scifi
- [`dopaminejs-plugin-ecosystem`](https://www.npmjs.com/package/dopaminejs-plugin-ecosystem) - signed webhooks
- [`dopaminejs-plugin-debug-overlay`](https://www.npmjs.com/package/dopaminejs-plugin-debug-overlay) - live snapshot and event log
- [`dopaminejs-themes`](https://www.npmjs.com/package/dopaminejs-themes) - five UI themes

```javascript
import { createDopamine } from 'dopaminejs';
import { myPlugin } from './my-plugin.js';

const dopamine = createDopamine({ plugins: [myPlugin] });
```

## Cleanup

Everything that touches the DOM can be torn down:

```javascript
dopamine.dispose();
```

## Non-browser environments

Importing the package under SSR, in a worker, or in Node does not throw.
`DataService` and `SoundManager` fall back to an in-memory store when
`localStorage` is absent or blocked (Safari private browsing), and audio stays
silent when there is no Web Audio API.

## Links

- [Migration guide](https://github.com/BaryoDev/dopaminejs/blob/main/docs/MIGRATION-3.0.md)
- [Plugin development](https://github.com/BaryoDev/dopaminejs/blob/main/docs/PLUGIN_GUIDE.md)
- [Changelog](https://github.com/BaryoDev/dopaminejs/blob/main/CHANGELOG.md)

## License

MPL-2.0. Commercial use is fine; modifications to core files are shared back.
