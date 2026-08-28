# dopaminejs-react

React bindings for [DopamineJS](https://www.npmjs.com/package/dopaminejs). Drop progression mechanics — XP, levels, achievements, and daily streaks — into any React app with a single hook.

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
| `progress` | `number` | `0–1` fraction to next level |
| `achievements` | `object[]` | Unlocked achievements |
| `addXP(amount)` | `(number) => Promise<void>` | Add XP; triggers re-render on LEVEL_UP or XP_GAINED |
| `recordGame(gameId, stats)` | `(string, object) => Promise<void>` | Record a game session |
| `unlockAchievement(key)` | `(string) => Promise<void>` | Manually unlock an achievement |

## Notes

- `react >=18` is required as a peer dependency.
- The provider creates one `RewardSystem` instance on mount and tears it down on unmount. To reset progress, re-key the provider (`<RewardsProvider key={userId}>`).
- Event listeners are cleaned up on unmount. The `EventBus` in DopamineJS holds strong references — skipping cleanup leaks listeners.

## License

MIT
