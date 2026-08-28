# dopaminejs

> Progression mechanics for web apps. XP, levels, achievements, and timezone-correct daily streaks, with the particles and sound to make them land.

Zero runtime dependencies. Works with any framework.

```bash
npm install dopaminejs
```

## Quick start

```javascript
// Named imports — the recommended way
import { RewardSystem, DataService } from 'dopaminejs';
import 'dopaminejs/style.css';

const rewards = new RewardSystem(new DataService());
await rewards.init();
await rewards.addXP(100);
```

> **v1.x compatibility:** The package also has a default export (`import Dopamine from 'dopaminejs'`)
> that wraps the progression layer as it existed before v2. It is preserved for backward
> compatibility but new code should use named imports.

## What's in the box

| Piece | Does |
|---|---|
| `RewardSystem` | XP, levels, achievements, daily streaks |
| `GameUI` | DOM overlay: XP bar, level badge, popups, floating text |
| `ParticleSystem` | Canvas particles: confetti, sparkle, fire, star burst |
| `SoundManager` | Synthesized effects via Web Audio, or your own audio files |
| `DataService` | `localStorage` persistence with an in-memory fallback |

And a v2 engine layer if you want the whole thing:

| Piece | Does |
|---|---|
| `DopamineKernel` | Central orchestrator with dependency injection |
| `EventBus` | Priority-ordered pub/sub |
| `SystemRegistry` | System lifecycle, topologically sorted by dependency |
| `PluginRegistry` | Sync and async plugin loading |
| `Game`, `Scene`, `GameObject`, `Component` | Entity/component scaffolding |

## Custom achievements

```javascript
const dopamine = new Dopamine({
    rewards: {
        achievements: {
            die_100_times: {
                name: 'You Tried',
                description: 'Lose 100 times',
                icon: '<img src="skull.png" width="20">', // HTML allowed here
                xp: 50,
                check: (player) => player.stats.breakout?.deaths >= 100
            }
        }
    }
});
```

`icon` accepts HTML. Every other field is rendered as text, so game state and
server responses cannot inject markup.

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
import { Game } from 'dopaminejs';
import { WebGLParticlePlugin } from 'dopaminejs-plugin-webgl-particles';

const game = new Game();
game.kernel.plugins.use(WebGLParticlePlugin);
game.start();
```

## Cleanup

Everything that touches the DOM can be torn down, which matters in a
single-page app that mounts and unmounts a game view:

```javascript
dopamine.gameUI.destroy();
dopamine.particleSystem.destroy();
game.kernel.destroy();
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
