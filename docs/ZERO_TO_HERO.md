# Zero to Hero: Building with DopamineJS

Welcome to DopamineJS, the **Juice-First Game Engine**.
Unlike other engines where you add feedback later, DopamineJS makes particles, screenshake, and rewards a core part of your game loop.

## 1. Setup

Install via npm:

```bash
npm install dopaminejs
```

Create an `index.html`:

```html
<div id="game-container"></div>
<script type="module">
  import Dopamine, { Game, Scene, GameObject, Component } from 'dopaminejs';
  
  // 1. Initialize the Juice System
  const app = new Dopamine();
  await app.init();
  
  // 2. Create the Game
  const game = new Game({ parent: '#game-container' });
  game.start();
</script>
```

## 2. Your First Scene

A `Scene` is a state (Menu, Gameplay).

```javascript
class MainScene extends Scene {
    onEnter() {
        console.log("Game Started!");
    }
}
game.setScene(new MainScene());
```

## 3. Game Objects & Components

Everything is a `GameObject`. Logic lives in `Components`.

```javascript
class Player extends Component {
    update(dt) {
        this.gameObject.x += 100 * dt; // Move right
    }
    render(ctx) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(-10, -10, 20, 20);
    }
}

// In Scene.onEnter:
const player = new GameObject(100, 100);
player.addComponent(new Player());
this.add(player);
```

## 4. Physics

DopamineJS has a simple built-in physics engine.

1.  **Add a Collider**:
    ```javascript
    import { Collider } from 'dopaminejs';
    player.addComponent(new Collider('box', {w: 50, h: 50}, 'player'));
    enemy.addComponent(new Collider('box', {w: 50, h: 50}, 'enemy'));
    ```

2.  **React to Collisions**:
    Add `onCollisionEnter(other)` to any Component on the object.
    ```javascript
    class Bullet extends Component {
        onCollisionEnter(other) {
            // Check tag via Collider component
            const col = other.getComponent(Collider);
            if (col && col.tag === 'enemy') {
                this.destroy();
            }
        }
    }
    ```

## 5. adding Juice (The Dopamine Way)

Easily trigger effects from your components.

```javascript
import { ParticleEmitter, ScreenShake } from 'dopaminejs';

// In your Player class:
shoot() {
    // 1. Shake Camera
    // Assuming you have a ScreenShake component on your camera/root
    this.scene.cameraShaker.shake(5, 0.2);
    
    // 2. Muzzle Flash
    const emitter = this.gameObject.getComponent(ParticleEmitter);
    emitter.play('sparkle', { count: 10, color: '#ff0000' });
}
```

## 6. Publishing

Run `npm run build` (vite build) and deploy your `dist` folder.
