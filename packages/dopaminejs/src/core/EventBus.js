/**
 * EventBus - Central event system for loose coupling between systems
 * 
 * Performance optimizations:
 * - Priority queues for critical events (tick, render)
 * - Object pooling for event data (future enhancement)
 * - Pre-allocated arrays to minimize GC
 */
export class EventBus {
    constructor() {
        // Map<eventName, Set<{callback, priority}>>
        this._listeners = new Map();
        this._onceListeners = new Map();

        // Cache for sorted listeners by priority
        this._sortedCache = new Map();
    }

    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {number} priority - Higher priority = called first (default: 0)
     * @returns {EventBus} - For chaining
     */
    on(event, callback, priority = 0) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }

        this._listeners.get(event).add({ callback, priority });

        // Invalidate cache for this event
        this._sortedCache.delete(event);

        return this;
    }

    /**
     * Register a one-time event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {EventBus} - For chaining
     */
    once(event, callback) {
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, new Set());
        }

        this._onceListeners.get(event).add(callback);
        return this;
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     * @returns {EventBus} - For chaining
     */
    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            // Find and remove the listener with matching callback
            for (const listener of listeners) {
                if (listener.callback === callback) {
                    listeners.delete(listener);
                    this._sortedCache.delete(event);
                    break;
                }
            }
        }

        const onceListeners = this._onceListeners.get(event);
        if (onceListeners) {
            onceListeners.delete(callback);
        }

        return this;
    }

    /**
     * Emit an event to all registered listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        // Get sorted listeners (cached for performance)
        const listeners = this._getSortedListeners(event);

        // Call regular listeners
        for (let i = 0; i < listeners.length; i++) {
            listeners[i].callback(data);
        }

        // Call and remove once listeners
        const onceListeners = this._onceListeners.get(event);
        if (onceListeners && onceListeners.size > 0) {
            for (const callback of onceListeners) {
                callback(data);
            }
            onceListeners.clear();
        }
    }

    /**
     * Get sorted listeners for an event (with caching)
     * @private
     */
    _getSortedListeners(event) {
        // Check cache first
        if (this._sortedCache.has(event)) {
            return this._sortedCache.get(event);
        }

        const listeners = this._listeners.get(event);
        if (!listeners || listeners.size === 0) {
            return [];
        }

        // Sort by priority (higher first)
        const sorted = Array.from(listeners).sort((a, b) => b.priority - a.priority);

        // Cache the result
        this._sortedCache.set(event, sorted);

        return sorted;
    }

    /**
     * Remove all listeners for an event, or all events if no event specified
     * @param {string} [event] - Event name (optional)
     */
    clear(event) {
        if (event) {
            this._listeners.delete(event);
            this._onceListeners.delete(event);
            this._sortedCache.delete(event);
        } else {
            this._listeners.clear();
            this._onceListeners.clear();
            this._sortedCache.clear();
        }
    }

    /**
     * Check if an event has listeners
     * @param {string} event - Event name
     * @returns {boolean}
     */
    hasListeners(event) {
        const listeners = this._listeners.get(event);
        const onceListeners = this._onceListeners.get(event);
        return (listeners && listeners.size > 0) || (onceListeners && onceListeners.size > 0);
    }
}

/**
 * Standard event names for performance-critical events
 * Using constants avoids string allocation
 */
EventBus.Events = {
    // Core game loop events
    TICK: 'tick',
    FIXED_UPDATE: 'fixed_update',
    RENDER: 'render',

    // Physics events
    COLLISION_ENTER: 'collision_enter',
    COLLISION_EXIT: 'collision_exit',

    // Dopamine events (from RewardSystem)
    XP_GAINED: 'xp_gained',
    LEVEL_UP: 'level_up',
    ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
    NEW_HIGH_SCORE: 'new_high_score',
    STREAK_UPDATED: 'streak_updated',

    // System lifecycle events
    SYSTEM_REGISTERED: 'system_registered',
    SYSTEM_UNREGISTERED: 'system_unregistered',
    PLUGIN_LOADED: 'plugin_loaded',
    PLUGIN_UNLOADED: 'plugin_unloaded',
};
