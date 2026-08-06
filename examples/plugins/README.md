# Example plugins

Reference implementations. These are **not** published to npm and are not part
of any package's build; copy them into your own project as a starting point.

## `CustomPhysicsPlugin.js`

Shows how a plugin replaces a core system rather than adding one: it
unregisters the default `physics` system and registers its own in the same
slot, so everything calling `kernel.systems.get('physics')` transparently gets
the replacement.

Deliberately minimal. `raycast()` is a stub and collision is plain AABB. A real
version would wrap Matter.js or Box2D.

```javascript
import { Game } from 'dopaminejs';
import { CustomPhysicsPlugin } from './CustomPhysicsPlugin.js';

const game = new Game();
game.kernel.plugins.use(CustomPhysicsPlugin);
game.start();
```

Until 2.1.0 this shipped inside the `dopaminejs-plugins` package, which meant an
example with a `TODO` in it was published as a dependency. It lives here now.
