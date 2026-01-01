/**
 * Represents a specific state or screen in the game (e.g., Menu, Level1).
 */
export class Scene {
    constructor() {
        this.gameObjects = [];
        this.kernel = null; // Injected by Game
    }

    /**
     * Called when the scene is added to the Game.
     */
    onEnter() { }

    /**
     * Called when the scene is removed from the Game.
     */
    onExit() { }

    /**
     * Add a GameObject to the scene.
     * @param {GameObject} gameObject 
     */
    add(gameObject) {
        if (this.kernel) {
            gameObject.kernel = this.kernel; // Inject kernel
        }
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

    /**
     * Update loop for the scene.
     * @param {number} dt 
     */
    update(dt) {
        for (const obj of this.gameObjects) {
            obj.update(dt);
        }
    }

    /**
     * Render loop for the scene.
     * @param {CanvasRenderingContext2D} ctx 
     */
    render(ctx) {
        for (const obj of this.gameObjects) {
            obj.render(ctx);
        }
    }
}
