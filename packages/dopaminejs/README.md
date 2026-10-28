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

## Plugins

Install only what you need:

- [`dopaminejs-plugin-webgl-particles`](https://www.npmjs.com/package/dopaminejs-plugin-webgl-particles) - GPU particles (10,000+)
- [`dopaminejs-plugin-howler-audio`](https://www.npmjs.com/package/dopaminejs-plugin-howler-audio) - Howler.js audio
- [`dopaminejs-plugin-sound-packs`](https://www.npmjs.com/package/dopaminejs-plugin-sound-packs) - retro, modern, cute, scifi
- [`dopaminejs-plugin-ecosystem`](https://www.npmjs.com/package/dopaminejs-plugin-ecosystem) - battle pass, leaderboards, webhooks
- [`dopaminejs-plugin-feedback-effects`](https://www.npmjs.com/package/dopaminejs-plugin-feedback-effects) - floating text, confetti
- [`dopaminejs-plugin-debug-overlay`](https://www.npmjs.com/package/dopaminejs-plugin-debug-overlay) - FPS and system inspector
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

- [Migration guide](https://github.com/BaryoDev/dopaminejs/blob/main/docs/MIGRATION.md)
- [Plugin development](https://github.com/BaryoDev/dopaminejs/blob/main/docs/PLUGIN_GUIDE.md)
- [Changelog](https://github.com/BaryoDev/dopaminejs/blob/main/CHANGELOG.md)

## License

MPL-2.0. Commercial use is fine; modifications to core files are shared back.
