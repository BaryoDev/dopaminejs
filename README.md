# DopamineJS 🧠✨

A lightweight, modular JavaScript library for adding "juice", rewards, and satisfying feedback to your HTML5 games.

## Features

-   **Reward System**: XP, Levels, Achievements, and Daily Streaks.
-   **Game UI**: Beautiful, animated overlays for level-ups, notifications, and HUDs.
-   **Particle Effects**: Confetti, sparkles, fire, and coin showers.
-   **Sound Manager**: Synthesized retro sound effects (no external assets needed).
-   **Data Persistence**: Automatic local storage management.

## Installation

### Via npm (Coming Soon)
```bash
npm install dopaminejs
```

### Direct Include
Include the built script and CSS in your HTML:
```html
<link rel="stylesheet" href="dist/dopamine.css">
<script src="dist/dopamine.js"></script>
```

## Quick Start

```javascript
import Dopamine from 'dopaminejs';

// Initialize
const game = new Dopamine();
await game.init();

// Access modules
const { rewardSystem, particleSystem, soundManager, gameUI } = game;

// 1. Award XP
await rewardSystem.addXP(100, 'Enemy Defeated');

// 2. Show Visual Feedback
particleSystem.confetti(window.innerWidth / 2, window.innerHeight / 2);

// 3. Play Sound
soundManager.playSuccess();

// 4. Show Notification
gameUI.showNotification('Level Up!', 'legendary');
```

## Modules

### RewardSystem
Manages player progression.
-   `addXP(amount, reason)`
-   `recordGame(gameId, result)`
-   `unlockAchievement(id)`

### ParticleSystem
Visual effects on a dedicated canvas layer.
-   `confetti(x, y)`
-   `sparkle(x, y)`
-   `fire(x, y)`
-   `coinShower(x, y)`

### SoundManager
Synthesized audio effects.
-   `playJump()`
-   `playScore()`
-   `playGameOver()`
-   `toggleMute()`

### GameUI
Overlay system for feedback.
-   `showNotification(msg, type)`
-   `showLevelUp(oldLvl, newLvl)`
-   `showSummary(data)`

## License
MIT

## Support
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/T6T01CQT4R)
