import { EventBus } from './EventBus.js';
import { SystemRegistry } from './SystemRegistry.js';
import { PluginRegistry } from './PluginRegistry.js';
import { Renderer } from '../renderer/Renderer.js';
import { Ticker } from '../systems/Ticker.js';
import { Physics } from '../systems/Physics.js';
import { Input } from '../systems/Input.js';
import { Loader } from '../systems/Loader.js';

/**
 * DopamineKernel - Central orchestrator for the engine
 * 
 * Replaces global singletons and provides dependency injection for all systems.
 * This is the new foundation that enables the plugin architecture.
 */
export class DopamineKernel {
    constructor(config = {}) {
        this.config = config;

        // Core registries
        this.events = new EventBus();
        this.systems = new SystemRegistry(this);
        this.plugins = new PluginRegistry(this);

        // Register core systems
        this._registerCoreSystems(config);

        // Fixed timestep for physics (60 FPS)
        this.fixedTimestep = config.fixedTimestep || 1 / 60;
        this._accumulator = 0;
        this._maxAccumulator = this.fixedTimestep * 5; // Prevent spiral of death
    }

    /**
     * Register core engine systems
     * These can be replaced by plugins
     * @private
     */
    _registerCoreSystems(config) {
        // Ticker - highest priority, runs first
        this.systems.register('ticker', new Ticker(), {
            priority: 100
        });

        // Renderer
        const rendererOptions = {
            width: config.width,
            height: config.height,
            backgroundColor: config.backgroundColor,
            canvas: config.canvas,
            ...config.renderer
        };
        this.systems.register('renderer', new Renderer(rendererOptions), {
            priority: 90
        });

        // Input system
        this.systems.register('input', new Input(), {
            priority: 80
        });

        // Loader/Asset system
        this.systems.register('loader', new Loader(), {
            priority: 70
        });

        // Physics - depends on nothing, but runs in fixedUpdate
        this.systems.register('physics', new Physics(), {
            priority: 60
        });
    }

    /**
     * Start the kernel (begins game loop)
     */
    start() {
        const ticker = this.systems.get('ticker');
        if (ticker) {
            ticker.add(this._update.bind(this));
            ticker.start();
        }

        this.events.emit('kernel_started');
    }

    /**
     * Stop the kernel
     */
    stop() {
        const ticker = this.systems.get('ticker');
        if (ticker) {
            ticker.stop();
        }

        this.events.emit('kernel_stopped');
    }

    /**
     * Main update loop
     * @private
     */
    _update(dt) {
        // Emit tick event (high priority listeners go first)
        this.events.emit(EventBus.Events.TICK, { dt });

        // Fixed timestep for physics
        this._accumulator += dt;

        // Clamp accumulator to prevent spiral of death
        if (this._accumulator > this._maxAccumulator) {
            this._accumulator = this._maxAccumulator;
        }

        // Run fixed updates
        while (this._accumulator >= this.fixedTimestep) {
            this.events.emit(EventBus.Events.FIXED_UPDATE, { dt: this.fixedTimestep });
            this.systems.fixedUpdate(this.fixedTimestep);
            this._accumulator -= this.fixedTimestep;
        }

        // Run variable timestep updates
        this.systems.update(dt);

        // Emit render event
        this.events.emit(EventBus.Events.RENDER, { dt });
    }

    /**
     * Shorthand accessors for common systems (backward compatibility)
     */
    get physics() {
        return this.systems.get('physics');
    }

    get input() {
        return this.systems.get('input');
    }

    get loader() {
        return this.systems.get('loader');
    }

    get renderer() {
        return this.systems.get('renderer');
    }

    get ticker() {
        return this.systems.get('ticker');
    }

    /**
     * Destroy the kernel and cleanup all systems
     */
    destroy() {
        this.stop();
        this.plugins.clear();
        this.systems.clear();
        this.events.clear();
    }
}
