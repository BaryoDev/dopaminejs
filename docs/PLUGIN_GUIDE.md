# DopamineJS Plugin Guide

A plugin extends a host built by `createDopamine`. It can listen to progress events, use
the parts (`ui`, `particles`, `sound`, `haptics`) and keep its own storage.

## The contract

```javascript
export const MyPlugin = {
    name: 'my-plugin',
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
```

`install` may be async. It returns a disposer (or nothing).

## What a plugin gets

| `ctx` field | Use |
|---|---|
| `progress` | The progress object (`RewardSystem` by default) |
| `parts` | Live getters for `ui`, `particles`, `sound`, `haptics`. Read them when you need them, never keep them. |
| `events` | `on`, `off`, and `emit` for names that start with `<plugin name>:` |
| `storage` | Key value storage namespaced as `dopamine_<plugin name>_` |
| `clock` | The clock the host uses |
| `log` | `debug`, `info`, `warn`, `error` |
| `env` | `hasDom`, `reducedMotion` |
| `plugin(name)` | What another plugin passed to `expose`, or null |
| `expose(handle)` | Share an object with other plugins |

## Order and errors

Plugins install in array order and dispose in reverse. `createDopamine` throws a
`DopamineError` before calling `install` when:

- `plugin_api`: the plugin was built for another api number. The message names both.
- `plugin_order`: `after` names a plugin not installed yet.
- `plugin_requires`: a required part is null.
- `plugin_duplicate`: the name is already installed.

Listeners added through `ctx.events.on` are removed when the plugin is disposed, even if
the disposer forgets them. A listener that throws does not stop the others.

## Installing later

```javascript
const dopamine = createDopamine();
const remove = dopamine.use(MyPlugin);   // returns a disposer
await dopamine.ready;                    // waits for async installs
```

`dopamine.dispose()` disposes every plugin in reverse order, then the parts.

See `examples/plugins/ToastPlugin.js`.
