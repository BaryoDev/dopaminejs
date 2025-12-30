/**
 * ISystem - Base interface for all systems
 * 
 * All systems should implement this interface.
 * Methods are optional - only implement what you need.
 */
export const ISystem = {
    /**
     * Called when system is registered to the kernel
     * @param {DopamineKernel} kernel - The kernel instance
     */
    init(kernel) { },

    /**
     * Called each frame (variable timestep)
     * @param {number} dt - Delta time in seconds
     */
    update(dt) { },

    /**
     * Called at fixed timestep (for physics)
     * @param {number} dt - Fixed delta time
     */
    fixedUpdate(dt) { },

    /**
     * Called when system is unregistered
     */
    destroy() { },
};

/**
 * Base System class that implements ISystem
 * Systems can extend this for convenience
 */
export class System {
    constructor() {
        this.kernel = null;
    }

    init(kernel) {
        this.kernel = kernel;
    }

    update(dt) { }
    fixedUpdate(dt) { }
    destroy() { }
}
