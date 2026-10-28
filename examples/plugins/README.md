# Example plugins

Reference implementations. These are not published to npm and are not part of any
package's build; copy them into your own project as a starting point.

## `ToastPlugin.js`

Shows the plugin contract: `install(ctx)` listens to a core event, reads a part at call
time and returns a disposer.

```javascript
import { createDopamine } from 'dopaminejs';
import { ToastPlugin } from './ToastPlugin.js';

const dopamine = createDopamine({ plugins: [ToastPlugin] });
```
