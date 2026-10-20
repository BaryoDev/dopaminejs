# Conformance fixtures

Language-neutral cases that pin the progression core: saved-state migration,
streaks, score and XP, level thresholds and achievements. They describe what
the JS core does today. Any port runs the same files and must match.

The JS runner is `packages/dopaminejs/tests/conformance.test.js`. Fixtures are
not part of any npm package.

A rule change means changing a fixture in the same commit. A port that has not
caught up goes red.

## Files

`spec/fixtures/*.json`, each `{ "suite", "description", "cases": [...] }`.

## A case

| Key | Meaning |
|---|---|
| `name` | Unique within the file. |
| `note` | Optional. Why the case exists, or a quirk it pins. |
| `clock` | Required. Start time, local `YYYY-MM-DDTHH:MM:SS`. No offset. |
| `config` | Optional. See below. |
| `storage` | Optional. `{ "failWrites": true }` makes every storage write throw, to exercise `save_failed`. Reads still work and `savedJson`/`savedRaw` are seeded first. |
| `savedJson` | Optional. Any JSON value, stored as `JSON.stringify(value)`. |
| `savedRaw` | Optional. A string stored as is, for corrupt data. |
| `afterInit` | Optional. Expectation checked after the first `init`. |
| `steps` | Optional. Ordered list of steps. |

With neither `savedJson` nor `savedRaw`, storage is empty. A case needs
`afterInit`, or at least one step, or it checks nothing and fails.

Storage is an in-memory string store. The player lives under the key
`dopamine_player` (prefix `dopamine_` plus `player`).

### Clock

Streak dates are local calendar dates, so the clock is a local date and time,
not an instant. The core runs in a non-UTC zone in CI (`Asia/Manila`). A port
sets its clock to the local wall time given, and must not convert through UTC.

### Config

- `builtinAchievements`: `false` removes the five built-ins (`first_game`,
  `level_5`, `level_10`, `streak_3`, `streak_7`). Default `true`. The JS core
  has no such option; the runner emulates it by replacing the achievement table
  after construction. A port must do the same.
- `achievements`: extra achievements by id, `{ name, description?, icon?, xp?, when }`.

`when` replaces the check function. One of:

| Condition | True when |
|---|---|
| `{ "always": true }` | Always. |
| `{ "never": true }` | Never. |
| `{ "throws": true }` | The check raises an error. Must not stop other achievements. |
| `{ "player": "totalGamesPlayed", "gte": 2 }` | The dotted player field is `>=` the number. |
| `{ "game": "arcade" }` | The recorded game name equals the string. |
| `{ "score_gte": 100 }` | The result has a score and it is `>=` the number. |

Achievements are checked in the order: built-ins in the order listed above,
then `config.achievements` in file order. Two limits come from JS objects:
integer-like ids (`"1"`, `"2"`) sort first regardless of file order, and a
config entry that reuses a built-in id replaces its definition but keeps the
built-in's position. Fixtures avoid both; do not rely on either.

`gte` and `score_gte` must be numbers, and a `player` path must name a numeric
field on a new player, or the runner rejects the case.

## Steps

Every step is `{ "op": ..., ...args, "expect": {...} }`. `expect` is required
except for `setClock`, where it is accepted and checked if present.

| op | args | Does |
|---|---|---|
| `setClock` | `at` | Moves the clock. |
| `reload` | none | Builds a new reward system on the same storage and runs `init`, like a page load. |
| `addXP` | `amount`, `reason?` | `addXP(amount, reason)`. |
| `recordGame` | `game`, `result?` | `recordGame(game, result)`. A missing `result` means the default. `null` is passed as `null`. |
| `unlockAchievement` | `id` | `unlockAchievement(id)`. |
| `markAchievementsSeen` | `ids` | `markAchievementsSeen(ids)`. |
| `getXPForNextLevel` | none | Reads `{ total, needed, progress }`. |

Events are collected from the start of each step (and from construction for
`afterInit` and `reload`) and compared after it.

## Expectations

`expect` and `afterInit` take these keys. Unknown keys are an error.

| Key | Checks |
|---|---|
| `player` | Subset match against the player. Every listed key must exist as an own key and match. Objects match by listed keys, arrays by length and element, numbers and strings exactly. |
| `playerExact` | Map of dotted path to value. The value at that path must equal it strictly, no extra keys. |
| `absent` | Dotted paths under the player that must not exist as own keys. |
| `achievements` | Ids in `player.achievements`, as a set. |
| `events` | The complete ordered list of events since the step began. Each is `{ "event": name, ...payload fields }`, matched as a subset. The list length must match. |
| `returns` | Subset match against the operation's return value. |
| `throws` | An error with this name (`TypeError`) is raised. State checks still run afterwards. |

An empty `player`, `playerExact`, `returns` or `absent`, or an empty `expect`,
is an error because it checks nothing. An empty `events` or `achievements`
list is a real check (nothing fired, nothing unlocked).

Each event is matched as `{ ...payload, "event": name }`. The `event` key is
the event name, so it wins over a payload field called `event`; the
`achievement_unlocked` payload has its own `name` (the achievement's name),
which is why the event name is not under `name`.

CI also runs the conformance file once in `America/Los_Angeles`
(`DOPAMINE_TEST_TZ`), so the daylight saving case can fail.

Event names: `xp_gained`, `level_up`, `achievement_unlocked`, `new_high_score`,
`streak_updated`, `save_failed`.

Timestamps (`createdAt`, `lastPlayedAt`, `unlockedAt`) are not checked.
Fixture paths use `.` as the separator, so keys in fixtures contain no dots.

## Running them from a port

1. Load every `spec/fixtures/*.json`.
2. For each case, set the local clock, seed storage, construct the system with
   the config, subscribe to the six events, run `init`.
3. Check `afterInit`, then run each step and check its `expect`.
4. Fail on any unknown op, step key, expectation key or condition. A fixture
   must never pass by checking nothing.

Some JSON files contain keys such as `__proto__`. Parse them into a plain map,
not into a structure that treats those names specially.

## Quirks pinned on purpose

Cases with a `note` pin behaviour that may look odd (numeric strings accepted
as numbers, a date-shaped `lastPlayDate` not checked for being a real date, a
future `lastPlayDate` counting as a gap). Changing any of these is a rule
change and needs a fixture change.
