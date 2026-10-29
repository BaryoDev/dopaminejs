# DopamineJS Plugin Guide

There are three shapes. Pick the smallest one that does the job.

| Shape | Use it to | Looks like |
|---|---|---|
| Subscriber | react to events | `{ name, version, api: 3, install(ctx) }` |
| Part | replace the ui, particles, sound or haptics | a value or a factory `(env) => part \| null` |
| Middleware | change or drop XP, a record or an unlock | `progress.use({ beforeXP, ... })` |

## Subscriber

```javascript
export const myAnalyticsPlugin = {
    name: 'my-analytics-plugin',
    version: '1.0.0',
    api: 3,                    // must equal HOST_API
    after: ['other-plugin'],   // optional, must be installed earlier
    requires: ['sound'],       // optional, parts that must not be null

    install(ctx) {
        const off = ctx.events.on('level_up', ({ newLevel }) => {
            ctx.parts.sound?.play('level_up');
        });
        return () => off();    // the disposer
    }
};

createDopamine({ plugins: [myAnalyticsPlugin] });
```

`install` may be async. It returns a disposer, or nothing.

| `ctx` field | Use |
|---|---|
| `progress` | The progress object (`RewardSystem` by default) |
| `parts` | Live getters for `ui`, `particles`, `sound`, `haptics`. Read them when you need them, never keep them. |
| `events` | `on`, `off`, and `emit` for names that start with `<plugin name>:` |
| `storage` | Key value storage namespaced as `dopamine_plugin_<plugin name>:` |
| `clock` | The clock the host uses |
| `log` | `debug`, `info`, `warn`, `error` |
| `env` | `hasDom`, `reducedMotion` |
| `plugin(name)` | What another plugin passed to `expose`, or null |
| `expose(handle)` | Share an object with other plugins |

Core events: `xp_gained`, `level_up`, `achievement_unlocked`, `personal_best`,
`streak_updated`, `player_reset`, `save_failed`, `load_failed`. Plugin events are `<plugin>:<event>`.

## Part

A part is a value, a factory, or `false` for none. A factory that returns `null` means use
the default, which is how a part says it cannot run here.

```javascript
createDopamine({
    sound: false,
    particles: (env) => (env.reducedMotion ? null : new MyParticles())
});
```

The first-party parts are `webglParticles()` and `howlerSound()`. A part owns its own
loop and timers and removes them in `destroy()`.

## Middleware

```javascript
const remove = dopamine.progress.use({
    beforeXP: ({ amount }) => ({ amount: Math.min(amount, 100) })
});
```

Hooks are `beforeXP`, `afterXP`, `beforeRecord`, `afterRecord`, `beforeUnlock` and
`afterUnlock`. A before hook can return a patch, or `false` to drop the action. Hooks run
in the order they were added. `use` returns a remover.

## Order and errors

Plugins install in array order and dispose in reverse. `createDopamine` throws a
`DopamineError` before calling `install` when:

- `plugin_api`: the plugin was built for another api number. The message names both.
- `plugin_order`: `after` names a plugin not installed yet.
- `plugin_requires`: a required part is null.
- `plugin_duplicate`: the name is already installed.
- `plugin_invalid`: the plugin has no install function, or its name is not made of `a-z`, `0-9` and `-`.

If an install that returns a promise rejects, the plugins installed before it are disposed, last
first, and `ready` rejects.

Listeners added through `ctx.events.on` are removed when the plugin is disposed, even if
the disposer forgets them. A listener that throws does not stop the others.

## Installing later

```javascript
const dopamine = createDopamine();
const remove = dopamine.use(myAnalyticsPlugin);   // returns a disposer
await dopamine.ready;                             // waits for async installs
```

`dopamine.dispose()` disposes every plugin in reverse order, then the parts.

## Testing

`dopaminejs/testing` has `createTestHost()` and the `conformance` suites. Run
`conformance.plugin(make)` on a plugin and `conformance.particles|sound|ui|storage(make)`
on a part. They check that nothing is left behind after dispose.

See `examples/plugins/ToastPlugin.js`.
