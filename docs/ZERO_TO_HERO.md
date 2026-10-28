# Zero to Hero: Progress Feedback with DopamineJS

DopamineJS gives any web app XP, levels, achievements and streaks, and shows them with a bar, popups, particles and sound.

## 1. Setup

```bash
npm install dopaminejs
```

```javascript
import { createDopamine } from 'dopaminejs';
import 'dopaminejs/style.css';

const dopamine = createDopamine();
await dopamine.ready;
```

`createDopamine` builds the parts (`ui`, `particles`, `sound`, `haptics`), wires them to the
progress events and loads the saved player. Importing the package has no side effects, so
the stylesheet is yours to import (or pass `injectCss: true` to `RewardUI`).

## 2. Give XP

```javascript
await dopamine.progress.addXP(50, 'finished lesson');
```

The bar moves and the XP sound plays. When the level changes, the level popup shows.

## 3. Achievements

```javascript
dopamine.progress.defineAchievement('first_lesson', {
    name: 'First lesson',
    description: 'Finish one lesson',
    icon: 'trophy',
    xp: 25
});
await dopamine.progress.unlockAchievement('first_lesson');
```

Icons are shown as text or sanitised SVG. See SECURITY.md before turning `safeIcons` off.

## 4. Swap or drop a part

Each part is a value, a factory, or `false` for none.

```javascript
createDopamine({
    sound: false,
    particles: (env) => (env.reducedMotion ? null : new MyParticles())
});
```

A factory that returns `null` means use the default.

## 5. React to events

```javascript
dopamine.events.on('level_up', ({ newLevel }) => track('level', newLevel));
```

## 6. Plugins

See [PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md).

## 7. Publishing

Run `npm run build` and deploy your `dist` folder.
