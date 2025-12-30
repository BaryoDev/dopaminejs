import { DopamineKernel } from './DopamineKernel.js';
import { Scene } from './Scene.js';
import { Director } from '../systems/Director.js';
import { EventBus } from './EventBus.js';

/**
 * The main Game entry point.
 * Now uses DopamineKernel for system management.
 */
export class Game {
    constructor(config = {}) {
        this.config = config;

        // NEW: Use kernel for system management
        this.kernel = new DopamineKernel(config);

        // Initialize Director
        this.director = new Director(this);

        // Bind to kernel tick event for scene updates
        this.kernel.events.on(EventBus.Events.TICK, this._update.bind(this), 10);
        this.kernel.events.on(EventBus.Events.RENDER, this._render.bind(this), 10);
    }

    /**
     * Backward compatibility accessors
     */
    get renderer() {
        return this.kernel.renderer;
    }

    get ticker() {
        return this.kernel.ticker;
    }

    get physics() {
        return this.kernel.physics;
    }

    get input() {
        return this.kernel.input;
    }

    /**
     * Start the game loop.
     */
    start() {
        this.kernel.start();
    }

    /**
     * Stop the game loop.
     */
    stop() {
        this.kernel.stop();
    }

    /**
     * Switch to a new scene.
     * @param {Scene} newScene 
     */
    setScene(newScene) {
        // Inject kernel into scene
        newScene.kernel = this.kernel;
        this.director.run(newScene);
    }

    _update({ dt }) {
        // Update scene logic
        if (this.director.currentScene) {
            this.director.currentScene.update(dt);
        }
    }

    _render({ dt }) {
        // Clear and render
        this.renderer.clear();
        if (this.director.currentScene) {
            this.director.currentScene.render(this.renderer.ctx);
        }
    }

    /**
     * Destroy the game and cleanup
     */
    destroy() {
        this.kernel.destroy();
    }
}
