# DopamineJS Architecture & Roadmap 🏗️

**Vision**: To become the standard "Game Feel Engine" for the web—a plug-and-play layer that handles the "juice" (feedback, rewards, satisfaction) so developers can focus on core mechanics.

## 🧠 Design Philosophy
1.  **Zero-Config Start**: It must work beautifully out of the box.
2.  **Infinite Extensibility**: Every default (sound, particle, UI style) must be replaceable.
3.  **Asset Agnostic**: Support synthesized sounds/shapes (no assets) AND custom assets (mp3/png).
4.  **AI-First**: APIs should be self-documenting and predictable for AI agents to use effectively.

## 🗺️ Roadmap

### Phase 1: Audio Extensibility (v1.1.0)
**Goal**: Allow developers to bring their own soundscapes.

-   **[NEW] Asset Loader**: A lightweight preloader for audio files.
-   **[UPDATE] SoundManager**:
    -   Add `registerSound(key, url)` method.
    -   Support `Howler.js` integration (optional) or robust Web Audio buffer caching.
    -   **Feature**: "Sound Packs" - Allow switching between 'Retro', 'Modern', 'Cute' preset packs.

### Phase 2: Visual Customization (v1.2.0)
**Goal**: Break free from geometric primitives.

-   **[UPDATE] ParticleSystem**:
    -   **Sprite Support**: Allow `image` or `sprite` properties in particle config.
    -   **Custom Emitters**: Define custom particle behaviors (gravity, velocity, life, decay) via JSON config.
    -   **Editor**: (Long term) A web-based particle editor that exports JSON for DopamineJS.

### Phase 3: UI Theming & Templates (v1.3.0)
**Goal**: Make the UI fit any game art style.

-   **[NEW] Theme Engine**:
    -   Use CSS Variables for all colors, fonts, and spacing.
    -   `Dopamine.setTheme('dark-cyberpunk')`
-   **[UPDATE] GameUI**:
    -   **Icon Sets**: Allow passing an icon map (SVG strings or URLs) to replace default emojis.
    -   **Slots**: Allow developers to inject custom HTML into notifications or level-up screens.

### Phase 4: The "Dopamine Ecosystem" (v2.0.0)
**Goal**: Community-driven content.

-   **Plugin System**: Middleware for the `RewardSystem` (e.g., "BattlePass Plugin", "Leaderboard Plugin").
-   **Backend Integration**: Webhooks for `onLevelUp` or `onAchievement` to validate rewards on a server.

## 📝 Developer Guide: How to Extend (Current Best Practices)

While we build these features, here is how you can extend DopamineJS today:

### Custom Achievements
You can already define any achievement logic you want:

```javascript
achievements: {
    'die_100_times': {
        name: 'You Tried',
        icon: '<img src="skull.png" width="20">', // HTML is supported in icons!
        check: (p) => p.stats.deaths >= 100
    }
}
```

### Custom CSS
Override the default styles by adding your own CSS *after* importing DopamineJS:

```css
/* Override the XP bar color */
.xp-bar-fill {
    background: linear-gradient(90deg, #ff00cc, #3333ff) !important;
}
```
