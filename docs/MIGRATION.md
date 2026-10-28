# Migration Guide: 2.x to 3.0

3.0 is about progress feedback for any web app. The game engine layer is gone from the
package. Games keep working through `dopaminejs/games`, which arrives in the next step of 3.0.

## Removed

- The `dopaminejs/engine` entry and everything that only it used.
- The default export. Use named imports.
- `GameUI`. It is now `RewardUI`, with no alias.
- `showAchievement`, `showLevelUp`, `showCombo`, `showNearMiss`, `showLuckyMoment`,
  `showSummary`, `showNotification` and the `update*` methods. Use `popup`, `hud` and `text`.
- `SoundManager.playSuccess` and the `success` sound key.
- The event bus options of `RewardSystem` config.

## Changed

- Importing `dopaminejs` no longer adds CSS. Import `dopaminejs/style.css`, or pass
  `injectCss: true` to `RewardUI`.
- `achievement.icon` is shown as text or sanitised SVG by default (`safeIcons` is true).
  Pass `safeIcons: false` to render HTML.
- `ParticleSystem` has `burst(kind, at?, opts?)` for `confetti`, `sparkle`, `fire`, `stars`
  and `coins`. An unknown kind does nothing.
- `SoundManager.play(key)` plays `xp`, `level_up`, `achievement`, `personal_best`, `click`
  and `error`, and ignores keys it does not know.

## New

`createDopamine({ progress, ui, particles, sound, haptics, storage, clock, plugins })`
builds the parts, wires them to the progress events and installs plugins. See
[PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md).

```javascript
import { createDopamine } from 'dopaminejs';
import 'dopaminejs/style.css';

const dopamine = createDopamine();
await dopamine.ready;
await dopamine.progress.addXP(100);
```

## Sound packs and themes

Sound packs live in `dopaminejs-plugin-sound-packs`. A pack is a set of tone
definitions, not audio files; play an entry with `SoundManager.playTone`.

A theme from `dopaminejs-themes` sets `--dopamine-*` CSS variables on the document root.
The core stylesheet does not read them yet.
