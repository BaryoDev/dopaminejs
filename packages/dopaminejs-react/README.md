# dopaminejs-react

React bindings for [DopamineJS](https://www.npmjs.com/package/dopaminejs). A provider and one hook that give a React tree XP, levels, achievements and daily streaks.

```bash
npm install dopaminejs dopaminejs-react
```

## Usage

Wrap your app (or the relevant subtree) with `<RewardsProvider>`, then call `useRewards()` anywhere inside it.

```jsx
import { RewardsProvider, useRewards } from 'dopaminejs-react';

// Wrap at the root (or around any subtree)
export default function App() {
    return (
        <RewardsProvider>
            <Dashboard />
        </RewardsProvider>
    );
}

// Consume anywhere inside the tree
function Dashboard() {
    const { level, xp, progress, achievements, addXP } = useRewards();

    return (
        <div>
            <p>Level {level}</p>
            <progress value={progress} max={1} />
            <button onClick={() => addXP(250)}>Complete lesson (+250 XP)</button>
            <p>Unlocked achievements: {achievements.length}</p>
        </div>
    );
}
```

## API

### `<RewardsProvider config={...} storage={...}>`

| Prop | Type | Description |
|---|---|---|
| `config` | `object` | Passed to `new RewardSystem(...)`. Define custom achievements, XP curves, etc. |
| `storage` | `object` | Custom storage implementing `{ getItem, setItem, removeItem }`. Defaults to `localStorage`. |
| `children` | `ReactNode` | Required |

### `useRewards()`

Returns an object with:

| Property / method | Type | Description |
|---|---|---|
| `player` | `object` | Raw player state |
| `level` | `number` | Current player level |
| `xp` | `number` | Current XP |
| `progress` | `number` | 0 to 1, position inside the current level |
| `achievements` | `object[]` | Unlocked achievements |
| `addXP(amount, reason?)` | `(number, string?) => Promise<object>` | Add XP; re-renders on `xp_gained` and `level_up`. Resolves with what `RewardSystem.addXP` returns |
| `recordGame(gameId, stats)` | `(string, object) => Promise<void>` | Record a game session |
| `unlockAchievement(key)` | `(string) => Promise<boolean>` | Unlock an achievement by id. Resolves `false` when the id is unknown or already unlocked |

## Notes

- Peer dependencies: `react` 18 or newer and `dopaminejs` 2.3.0 or newer.
- The provider creates one `RewardSystem` when it mounts and removes its listeners when it unmounts. Later changes to `config` or `storage` are ignored. To rebuild it, for example for another user, give the provider a new `key` (`<RewardsProvider key={userId}>`).
- Until `init()` resolves, the state is `{ player: {}, level: 1, xp: 0, progress: 0, achievements: [] }`.
- The state refreshes on `xp_gained`, `level_up`, `achievement_unlocked` and `streak_updated`.
- No TypeScript declarations ship yet.

## License

MIT
