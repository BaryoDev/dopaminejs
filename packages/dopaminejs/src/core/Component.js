/**
 * Base class for all logic components attached to GameObjects.
 */
export class Component {
    constructor() {
        this.gameObject = null;
        this.kernel = null; // Injected by GameObject
    }

    /**
     * Access systems through kernel (no more globals!)
     */
    get physics() {
        return this.kernel?.systems.get('physics');
    }

    get input() {
        return this.kernel?.systems.get('input');
    }

    get loader() {
        return this.kernel?.systems.get('loader');
    }

    get events() {
        return this.kernel?.events;
    }

    onAttach() {
        // Subclasses can override
    }

    onDetach() { }

    update(dt) { }

    render(ctx) { }
}
