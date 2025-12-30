/**
 * Handles the Canvas and Context for rendering.
 */
export class Renderer {
    constructor(options = {}) {
        this.width = options.width || 800;
        this.height = options.height || 600;
        this.backgroundColor = options.backgroundColor || '#000000';

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d');

        // Append to body or specified container
        const parent = options.parent ?
            (typeof options.parent === 'string' ? document.querySelector(options.parent) : options.parent)
            : document.body;

        parent.appendChild(this.canvas);
    }

    /**
     * Clear the canvas.
     */
    clear() {
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
