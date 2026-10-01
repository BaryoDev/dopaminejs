/**
 * Represents a specific state or screen in the game (e.g., Menu, Level1).
 */
export class Scene {
    constructor() {
        this.gameObjects = [];
        this._kernel = null; // Injected by Game
    }

    get kernel() {
        return this._kernel;
    }

    /**
     * Objects added before the scene had a kernel receive it here. Scenes are
     * often built in a constructor, before Game.setScene() injects the kernel.
     * The Director sets it to null on exit, which takes colliders out of
     * physics until the scene runs again.
     */
    set kernel(value) {
        this._kernel = value;

        for (const gameObject of this.gameObjects) {
            gameObject.kernel = value;
        }
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

        // Coming back after a remove(): components were detached then.
        if (gameObject._detached) {
            gameObject._detached = false;
            this._eachComponent(gameObject, (component) => component.onAttach());
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

            // Lets components release what they hold. A Collider left in
            // physics keeps colliding for an object that is gone.
            gameObject._detached = true;
            this._eachComponent(gameObject, (component) => component.onDetach());
        }
    }

    /**
     * Visit the components of an object and of all its children.
     * @private
     */
    _eachComponent(gameObject, fn) {
        for (const component of [...gameObject.components]) {
            fn(component);
        }
        for (const child of gameObject.children) {
            this._eachComponent(child, fn);
        }
    }

    /**
     * Update loop for the scene.
     * @param {number} dt 
     */
    update(dt) {
        // Snapshot: an object may add or remove objects mid-frame, and
        // splicing the live array would skip the one after it.
        for (const obj of [...this.gameObjects]) {
            if (!obj._detached) obj.update(dt);
        }
    }

    /**
     * Render loop for the scene.
     * @param {CanvasRenderingContext2D} ctx 
     */
    render(ctx) {
        for (const obj of [...this.gameObjects]) {
            if (!obj._detached) obj.render(ctx);
        }
    }
}
