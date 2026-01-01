import { Component } from './Component.js';

/**
 * Base Entity class.
 * Has position, scale, rotation, and a list of Components.
 */
export class GameObject {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.rotation = 0;
        this.scale = { x: 1, y: 1 };

        this.components = [];
        this.children = [];
        this.parent = null;
        this._kernel = null;
    }

    get kernel() {
        return this._kernel;
    }

    set kernel(value) {
        this._kernel = value;
        // Propagate to components
        for (const comp of this.components) {
            comp.kernel = value;
        }
        // Propagate to children
        for (const child of this.children) {
            child.kernel = value;
        }
    }

    /**
     * Add a child object.
     * @param {GameObject} child 
     */
    addChild(child) {
        child.parent = this;
        child.kernel = this.kernel; // Propagate kernel
        this.children.push(child);
        return child;
    }

    /**
     * Add a component.
     * @param {Component} component 
     */
    addComponent(component) {
        component.gameObject = this;
        component.kernel = this.kernel; // Inject kernel reference
        this.components.push(component);
        component.onAttach();
        return component;
    }

    /**
     * Get a component by class type.
     * @param {class} type 
     */
    getComponent(type) {
        return this.components.find(c => c instanceof type);
    }

    update(dt) {
        // Update components
        for (const component of this.components) {
            if (component.update) component.update(dt);
        }

        // Update children
        for (const child of this.children) {
            child.update(dt);
        }
    }

    render(ctx) {
        ctx.save();

        // Apply Transforms
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale.x, this.scale.y);

        // Render components
        for (const component of this.components) {
            if (component.render) component.render(ctx);
        }

        // Render children
        for (const child of this.children) {
            child.render(ctx);
        }

        ctx.restore();
    }
}
