# DopamineJS Architecture

**Vision**: Progression mechanics for web apps. A drop-in layer for XP, levels, achievements, and daily streaks that makes the feedback feel good.

## Design Philosophy
1.  **Zero-Config Start**: It must work well out of the box.
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
    (`xp_gained`, `level_up`, `achievement_unlocked`, `streak_updated`, `personal_best`,
    `player_reset`, `save_failed`, `load_failed`). Plugin events are `<plugin>:<event>`. Listeners are
    synchronous and each one is wrapped.
-   **Three extension shapes.** A subscriber plugin `{ name, version, api: 3, install(ctx) }`
    reacts to events. A part replaces the ui, particles, sound or haptics. Middleware
    (`progress.use`) changes or drops XP, records and unlocks. Plugins install in array order
    and dispose in reverse. See [docs/PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md).
-   **The save is a document that merges.** Two devices can merge their saves in any order.
-   **No side effects at import.** The package touches no document, window or storage until
    `createDopamine()` or a part is constructed. CSS is `dopaminejs/style.css`.
-   **Entries.** `dopaminejs/core` is the progression API alone, for runtimes with no DOM.
    `dopaminejs/games` is the optional game feedback plugin. `dopaminejs/testing` is the
    test kit.

The engine layer from 2.x is removed. See [docs/MIGRATION-3.0.md](./docs/MIGRATION-3.0.md).
