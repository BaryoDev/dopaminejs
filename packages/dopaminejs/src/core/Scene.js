/**
 * Represents a specific state or screen in the game (e.g., Menu, Level1).
 */
export class Scene {
    constructor() {
        this.children = [];
        this.game = null;
    }

    /**
     * Called when the scene is added to the Game.
     */
    onEnter() { }

    onExit() { }

    /**
     * Update loop for the scene.
     * @param {number} dt 
     */
    update(dt) {
        // Update all children (GameObjects)
        for (const child of this.children) {
            if (child.update) child.update(dt);
        }
    }

    /**
        this.gameObjects = [];
        this.kernel = null; // Injected by Game
    }

    /**
     * Add a GameObject to the scene.
     * @param {GameObject} gameObject 
     */
    add(gameObject) {
        gameObject.kernel = this.kernel; // Inject kernel
        this.gameObjects.push(gameObject);
        return gameObject;
    }

    /**
     * Remove a GameObject from the scene.
     * @param {GameObject} gameObject 
     */
    remove(gameObject) {
        const index = this.gameObjects.indexOf(gameObject);
        if (index > -1) {
            this.gameObjects.splice(index, 1);
        }
    }

    update(dt) {
        for (const obj of this.gameObjects) {
            obj.update(dt);
        }
    }

    render(ctx) {
        for (const obj of this.gameObjects) {
            obj.render(ctx);
        }
    }
}
