# 🧠 DopamineJS

A lightweight, customizable framework for adding juice, rewards, and feedback to HTML5 games.

## Features

- **Reward System**: XP, Levels, Achievements, and Daily Streaks.
- **Particle Effects**: Confetti, Sparkles, Fire, and more.
- **Sound Manager**: Synthesized sound effects (no assets required).
- **Game UI**: Ready-to-use overlays for level ups, achievements, and notifications.
- **Extensible**: Built with a modular architecture and event system.

## Installation

```bash
npm install dopaminejs
```

## Usage

### Basic Setup

```javascript
import Dopamine from 'dopaminejs';

// Initialize with default config
const app = new Dopamine();
const { rewardSystem, particleSystem, soundManager, gameUI } = await app.init();

// Award XP
rewardSystem.addXP(100, 'Completed Level 1');

// Play Sound
soundManager.playSuccess();

// Show Effect
particleSystem.confetti(x, y);
```

### Configuration

You can customize almost everything by passing a config object:

```javascript
const app = new Dopamine({
    rewards: {
        achievements: {
            'my_custom_achievement': {
                name: 'Super Player',
                description: 'Score 1000 points',
                icon: '🏆',
                xp: 500,
                check: (player, gameName, result) => result.score >= 1000
            }
        }
    },
    sound: {
        storageKey: 'my_game_muted'
    },
    particles: {
        zIndex: '10000'
    }
});
```

### Recording Games

Use `recordGame` to automatically handle stats, high scores, and achievements:

```javascript
await rewardSystem.recordGame('my_game_id', {
    score: 1500,
    enemiesDefeated: 50
});
```

## Development

1.  Clone the repository:
    ```bash
    git clone https://github.com/BaryoDev/dopaminejs.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run dev server:
    ```bash
    npm run dev
    ```
4.  Run tests:
    ```bash
    npm test
    ```

## Deployment

To release a new version (bumps version, builds, tags, and pushes):

```bash
npm run release -- [patch|minor|major]
```

## License

MIT
