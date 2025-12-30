/**
 * Manages Scene transitions and state.
 */
export class Director {
    constructor(game) {
        this.game = game;
        this.currentScene = null;
    }

    /**
     * Switch to a new scene.
     * @param {Scene} scene 
     */
    run(scene) {
        if (this.currentScene) {
            this.currentScene.onExit();
        }

        this.currentScene = scene;
        this.currentScene.game = this.game;

        // Let the game know (if game engine needs to reference it directly)
        this.game.scene = scene;

        scene.onEnter();
    }
}
