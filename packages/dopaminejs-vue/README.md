# dopaminejs-vue

Vue 3 bindings for [DopamineJS](https://www.npmjs.com/package/dopaminejs). Two composables that give a Vue tree XP, levels, achievements and daily streaks.

```bash
npm install dopaminejs dopaminejs-vue
```

## Usage

Call `provideRewards()` in the `setup()` of your root component (or any subtree root), then call `useRewards()` in any descendant.

```vue
<!-- App.vue -->
<script setup>
import { provideRewards } from 'dopaminejs-vue';

provideRewards();
</script>

<template>
    <Dashboard />
</template>
```

```vue
<!-- Dashboard.vue -->
<script setup>
import { useRewards } from 'dopaminejs-vue';

const { level, progress, achievements, addXP } = useRewards();
</script>

<template>
    <p>Level {{ level }}</p>
    <progress :value="progress" max="1" />
    <button @click="addXP(250)">Complete lesson (+250 XP)</button>
    <p>Unlocked achievements: {{ achievements.length }}</p>
</template>
```

## API

### `provideRewards({ config, storage })`

| Option | Type | Description |
|---|---|---|
| `config` | `object` | Passed to `new RewardSystem(...)`. Define custom achievements, XP curves, etc. |
| `storage` | `object` | Custom storage implementing `{ getItem, setItem, removeItem }`. Defaults to `localStorage`. |

Returns the same object as `useRewards()`.

### `useRewards()`

Returns an object with:

| Property / method | Type | Description |
|---|---|---|
| `player` | `Ref<object>` | Raw player state |
| `level` | `Ref<number>` | Current player level |
| `xp` | `Ref<number>` | Current XP |
| `progress` | `Ref<number>` | 0 to 1, position inside the current level |
| `achievements` | `Ref<object[]>` | Unlocked achievements |
| `ready` | `Ref<boolean>` | `true` once `init()` has resolved |
| `error` | `Ref<unknown>` | `null` until `init()` rejects, then the rejection. It is caught, so it never surfaces as an unhandled rejection |
| `loadFailed` | `Ref<boolean>` | `true` when `init()` could not read the saved player. Nothing is saved this session, so show the visitor that progress is not being kept |
| `addXP(amount, reason?)` | `(number, string?) => Promise<object>` | Add XP. Resolves with what `RewardSystem.addXP` returns |
| `recordGame(gameId, stats)` | `(string, object) => Promise<void>` | Record a game session |
| `unlockAchievement(key)` | `(string) => Promise<boolean>` | Unlock an achievement by id. Resolves `false` when the id is unknown or already unlocked |

## Notes

- Peer dependencies: `vue` 3.3 or newer and `dopaminejs` 2.3.0 or newer.
- `provideRewards()` creates one `RewardSystem` and removes its listeners when the calling scope is disposed (component unmount). Later changes to `config` or `storage` are ignored. To rebuild it, for example for another user, key the component that calls it (`<App :key="userId" />`).
- `useRewards()` throws when no ancestor called `provideRewards()`. Calling `provideRewards()` twice in one component warns and returns the first instance.
- Until `init()` resolves, the state is `{ player: {}, level: 1, xp: 0, progress: 0, achievements: [] }`, with `ready` false, `error` null and `loadFailed` false. The methods reject until `init()` resolves.
- The state refreshes on `xp_gained`, `level_up`, `achievement_unlocked` and `streak_updated`.
- `player` is the live object from the reward system, mutated in place. Treat it as read-only.

## License

MIT
