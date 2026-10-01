/**
 * PluginRegistry - Manages plugin lifecycle
 * 
 * Plugins can extend the engine by:
 * - Registering new systems
 * - Replacing existing systems
 * - Adding event listeners
 * - Modifying kernel configuration
 */
export class PluginRegistry {
    constructor(kernel) {
        this.kernel = kernel;

        // Map<pluginName, plugin>
        this._plugins = new Map();

        // Track plugin load order for proper cleanup
        this._loadOrder = [];
    }

    /**
     * Forget a plugin whose init failed.
     *
     * Removed by name: with two async inits in flight, the failed plugin is
     * not necessarily the last entry.
     * @private
     */
    _forget(name) {
        this._plugins.delete(name);

        const index = this._loadOrder.indexOf(name);
        if (index > -1) {
            this._loadOrder.splice(index, 1);
        }
    }

    /**
     * Register and initialize a plugin
     * 
     * Plugin interface:
     * {
     *   name: string,
     *   version?: string,
     *   init(kernel): void,
     *   destroy?(): void
     * }
     * 
     * @param {Object} plugin - Plugin instance
     * @returns {PluginRegistry} - For chaining
     */
    use(plugin) {
        if (!plugin.name) {
            throw new Error('[PluginRegistry] Plugin must have a name');
        }

        if (this._plugins.has(plugin.name)) {
            console.warn(`[PluginRegistry] Plugin "${plugin.name}" already registered. Skipping.`);
            return this;
        }

        if (!plugin.init || typeof plugin.init !== 'function') {
            throw new Error(`[PluginRegistry] Plugin "${plugin.name}" must have an init() method`);
        }

        // Store plugin
        this._plugins.set(plugin.name, plugin);
        this._loadOrder.push(plugin.name);

        // Initialize plugin
        const systemsBefore = new Set(this.kernel.systems.getSystemNames());

        try {
            plugin.init(this.kernel);

            // Emit event
            this.kernel.events.emit('plugin_loaded', {
                name: plugin.name,
                version: plugin.version
            });

            // Plugin loaded successfully
        } catch (error) {
            console.error(`[PluginRegistry] Failed to initialize plugin "${plugin.name}":`, error);
            this._forget(plugin.name);

            // Systems it registered before throwing would keep updating with
            // nothing left to remove them.
            for (const name of this.kernel.systems.getSystemNames()) {
                if (!systemsBefore.has(name)) {
                    this.kernel.systems.unregister(name);
                }
            }

            throw error;
        }

        return this;
    }

    /**
     * Register and initialize a plugin asynchronously
     * Useful for plugins that need to load external resources
     * 
     * @param {Object} plugin - Plugin instance with async init
     * @returns {Promise<PluginRegistry>} - For chaining
     */
    async useAsync(plugin) {
        if (!plugin.name) {
            throw new Error('[PluginRegistry] Plugin must have a name');
        }

        if (this._plugins.has(plugin.name)) {
            console.warn(`[PluginRegistry] Plugin "${plugin.name}" already registered. Skipping.`);
            return this;
        }

        if (!plugin.init || typeof plugin.init !== 'function') {
            throw new Error(`[PluginRegistry] Plugin "${plugin.name}" must have an init() method`);
        }

        // Store plugin
        this._plugins.set(plugin.name, plugin);
        this._loadOrder.push(plugin.name);

        // Initialize plugin (await if it returns a promise)
        try {
            await plugin.init(this.kernel);

            // Emit event
            this.kernel.events.emit('plugin_loaded', {
                name: plugin.name,
                version: plugin.version
            });

            // Plugin loaded successfully
        } catch (error) {
            console.error(`[PluginRegistry] Failed to initialize plugin "${plugin.name}":`, error);
            this._forget(plugin.name);
            throw error;
        }

        return this;
    }

    /**
     * Remove a plugin
     * @param {string} name - Plugin name
     * @returns {boolean} - True if plugin was found and removed
     */
    remove(name) {
        const plugin = this._plugins.get(name);
        if (!plugin) {
            return false;
        }

        // Call destroy if available
        if (plugin.destroy) {
            try {
                plugin.destroy();
            } catch (error) {
                console.error(`[PluginRegistry] Error destroying plugin "${name}":`, error);
            }
        }

        this._plugins.delete(name);

        // Remove from load order
        const index = this._loadOrder.indexOf(name);
        if (index > -1) {
            this._loadOrder.splice(index, 1);
        }

        // Emit event
        this.kernel.events.emit('plugin_unloaded', { name });

        return true;
    }

    /**
     * Get a plugin by name
     * @param {string} name - Plugin name
     * @returns {Object|undefined} - Plugin instance
     */
    get(name) {
        return this._plugins.get(name);
    }

    /**
     * Check if a plugin is registered
     * @param {string} name - Plugin name
     * @returns {boolean}
     */
    has(name) {
        return this._plugins.has(name);
    }

    /**
     * Get all registered plugin names
     * @returns {string[]}
     */
    getPluginNames() {
        return Array.from(this._plugins.keys());
    }

    /**
     * Get plugin load order
     * @returns {string[]}
     */
    getLoadOrder() {
        return [...this._loadOrder];
    }

    /**
     * Clear all plugins (in reverse load order)
     */
    clear() {
        // Unload in reverse order
        for (let i = this._loadOrder.length - 1; i >= 0; i--) {
            this.remove(this._loadOrder[i]);
        }
    }
}
