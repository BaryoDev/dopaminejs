/**
 * SystemRegistry - Manages system lifecycle and dependency resolution
 * 
 * Systems are registered with names and can have dependencies on other systems.
 * The registry ensures systems are updated in the correct order based on dependencies.
 */
export class SystemRegistry {
    constructor(kernel) {
        this.kernel = kernel;

        // Map<systemName, { system, priority, dependencies }>
        this._systems = new Map();

        // Pre-computed update order for performance
        this._updateOrder = [];
        this._fixedUpdateOrder = [];

        // Flag to track if order needs recomputation
        this._needsRecompute = false;
    }

    /**
     * Register a system
     * @param {string} name - Unique system name
     * @param {Object} system - System instance (must implement ISystem interface)
     * @param {Object} options - Configuration options
     * @param {number} options.priority - Update priority (higher = earlier, default: 0)
     * @param {string[]} options.dependencies - System names this depends on
     * @returns {SystemRegistry} - For chaining
     */
    register(name, system, { priority = 0, dependencies = [] } = {}) {
        if (this._systems.has(name)) {
            console.warn(`[SystemRegistry] System "${name}" already registered. Replacing.`);
            this.unregister(name);
        }

        // Validate dependencies exist
        for (const dep of dependencies) {
            if (!this._systems.has(dep)) {
                console.warn(`[SystemRegistry] Dependency "${dep}" not found for system "${name}"`);
            }
        }

        // Store system metadata
        this._systems.set(name, {
            system,
            priority,
            dependencies,
        });

        // Initialize the system
        if (system.init) {
            system.init(this.kernel);
        }

        // Mark for recomputation
        this._needsRecompute = true;

        // Emit event
        this.kernel.events.emit('system_registered', { name, system });

        return this;
    }

    /**
     * Get a system by name
     * @param {string} name - System name
     * @returns {Object|undefined} - System instance
     */
    get(name) {
        const entry = this._systems.get(name);
        return entry ? entry.system : undefined;
    }

    /**
     * Check if a system is registered
     * @param {string} name - System name
     * @returns {boolean}
     */
    has(name) {
        return this._systems.has(name);
    }

    /**
     * Unregister a system
     * @param {string} name - System name
     * @returns {boolean} - True if system was found and removed
     */
    unregister(name) {
        const entry = this._systems.get(name);
        if (!entry) {
            return false;
        }

        // Call destroy if available
        if (entry.system.destroy) {
            entry.system.destroy();
        }

        this._systems.delete(name);
        this._needsRecompute = true;

        // Emit event
        this.kernel.events.emit('system_unregistered', { name });

        return true;
    }

    /**
     * Update all systems (called each frame)
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (this._needsRecompute) {
            this._recomputeUpdateOrder();
        }

        // Fast iteration - no lookups, just array access
        for (let i = 0; i < this._updateOrder.length; i++) {
            const system = this._updateOrder[i];
            if (system.update) {
                system.update(dt);
            }
        }
    }

    /**
     * Fixed update for physics (called at fixed timestep)
     * @param {number} dt - Fixed delta time
     */
    fixedUpdate(dt) {
        if (this._needsRecompute) {
            this._recomputeUpdateOrder();
        }

        for (let i = 0; i < this._fixedUpdateOrder.length; i++) {
            const system = this._fixedUpdateOrder[i];
            if (system.fixedUpdate) {
                system.fixedUpdate(dt);
            }
        }
    }

    /**
     * Recompute the update order based on dependencies and priorities
     * Uses topological sort for dependencies
     * @private
     */
    _recomputeUpdateOrder() {
        const systems = Array.from(this._systems.entries());

        // Build dependency graph
        const graph = new Map();
        const inDegree = new Map();

        for (const [name, entry] of systems) {
            graph.set(name, entry.dependencies);
            inDegree.set(name, 0);
        }

        // Calculate in-degrees
        for (const [name, deps] of graph) {
            for (const dep of deps) {
                if (inDegree.has(dep)) {
                    inDegree.set(name, inDegree.get(name) + 1);
                }
            }
        }

        // Topological sort (Kahn's algorithm)
        const queue = [];
        const sorted = [];

        // Start with systems that have no dependencies
        for (const [name, degree] of inDegree) {
            if (degree === 0) {
                queue.push(name);
            }
        }

        while (queue.length > 0) {
            // Sort queue by priority before processing
            queue.sort((a, b) => {
                const priorityA = this._systems.get(a).priority;
                const priorityB = this._systems.get(b).priority;
                return priorityB - priorityA; // Higher priority first
            });

            const name = queue.shift();
            sorted.push(name);

            // Reduce in-degree for dependent systems
            for (const [otherName, deps] of graph) {
                if (deps.includes(name)) {
                    const newDegree = inDegree.get(otherName) - 1;
                    inDegree.set(otherName, newDegree);
                    if (newDegree === 0) {
                        queue.push(otherName);
                    }
                }
            }
        }

        // Check for circular dependencies
        if (sorted.length !== systems.length) {
            console.error('[SystemRegistry] Circular dependency detected in systems!');
            // Fallback: just use priority order
            sorted.length = 0;
            sorted.push(...systems.map(([name]) => name).sort((a, b) => {
                return this._systems.get(b).priority - this._systems.get(a).priority;
            }));
        }

        // Convert to system instances
        this._updateOrder = sorted
            .map(name => this._systems.get(name).system)
            .filter(system => system.update);

        this._fixedUpdateOrder = sorted
            .map(name => this._systems.get(name).system)
            .filter(system => system.fixedUpdate);

        this._needsRecompute = false;
    }

    /**
     * Get all registered system names
     * @returns {string[]}
     */
    getSystemNames() {
        return Array.from(this._systems.keys());
    }

    /**
     * Clear all systems
     */
    clear() {
        for (const name of this._systems.keys()) {
            this.unregister(name);
        }
    }
}
