# DopamineJS Architecture

**Vision**: Progression mechanics for web apps — a drop-in layer for XP, levels, achievements, and daily streaks that makes the feedback feel good.

## Design Philosophy
1.  **Zero-Config Start**: It must work beautifully out of the box.
2.  **Infinite Extensibility**: Every default (sound, particle, UI style) must be replaceable.
3.  **Asset Agnostic**: Support synthesized sounds/shapes (no assets) AND custom assets (mp3/png).
4.  **AI-First**: APIs should be self-documenting and predictable for AI agents to use effectively.

## Shape (3.0)

`createDopamine()` is the composition root. It takes `progress`, `ui`, `particles`, `sound`,
`haptics`, `storage`, `clock` and `plugins`, builds the defaults, wires them to the progress
events and installs plugins.

-   **Parts** are swappable: a value, a factory `(env) => part | null`, or `false`. A factory
    that returns null means use the default. `host.parts` has getters only, so a plugin reads the
    current part and cannot replace it.
-   **One event bus.** The progress object is the bus. Core events have plain names
    (`xp_gained`, `level_up`, `achievement_unlocked`, `streak_updated`, `personal_best`).
    Plugin events are `<plugin>:<event>`. Listeners are synchronous and each one is wrapped.
-   **Plugins** are `{ name, version, api: 3, after?, requires?, install(ctx) }`. They install in
    array order and dispose in reverse. See [docs/PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md).
-   **No side effects at import.** The package touches no document, window or storage until
    `createDopamine()` or a part is constructed. CSS is `dopaminejs/style.css`.
-   **`dopaminejs/core`** is the progression API alone, for runtimes with no DOM.

The engine layer from 1.x and 2.x (kernel, scenes, game objects, physics) is removed. Games
keep working through `dopaminejs/games` in a later step of 3.0.
