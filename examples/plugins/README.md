# Example plugins

Reference implementations. These are not published to npm and are not part of any
package's build; copy them into your own project as a starting point.

## `ToastPlugin.js`

A subscriber plugin: `install(ctx)` listens to a core event, reads a part at call
time and returns a disposer. See [the plugin guide](../../docs/PLUGIN_GUIDE.md) for the
other two shapes.

```javascript
import { createDopamine } from 'dopaminejs';
import { ToastPlugin } from './ToastPlugin.js';

const dopamine = createDopamine({ plugins: [ToastPlugin] });
```
