/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DopamineKernel } from '../src/core/DopamineKernel.js';
import { EventBus } from '../src/core/EventBus.js';
import { SystemRegistry } from '../src/core/SystemRegistry.js';
import { PluginRegistry } from '../src/core/PluginRegistry.js';
import { System } from '../src/interfaces/ISystem.js';

describe('DopamineKernel', () => {
    let kernel;

    beforeEach(() => {
        kernel = new DopamineKernel();
    });

    it('should initialize with core systems', () => {
        expect(kernel.systems.has('ticker')).toBe(true);
        expect(kernel.systems.has('renderer')).toBe(true);
        expect(kernel.systems.has('physics')).toBe(true);
        expect(kernel.systems.has('input')).toBe(true);
        expect(kernel.systems.has('loader')).toBe(true);
    });

    it('should have event bus', () => {
        expect(kernel.events).toBeInstanceOf(EventBus);
    });

    it('should have system registry', () => {
        expect(kernel.systems).toBeInstanceOf(SystemRegistry);
    });

    it('should have plugin registry', () => {
        expect(kernel.plugins).toBeInstanceOf(PluginRegistry);
    });

    it('should provide shorthand accessors for common systems', () => {
        expect(kernel.physics).toBeDefined();
        expect(kernel.input).toBeDefined();
        expect(kernel.loader).toBeDefined();
        expect(kernel.renderer).toBeDefined();
        expect(kernel.ticker).toBeDefined();
    });
});

describe('EventBus', () => {
    let bus;

    beforeEach(() => {
        bus = new EventBus();
    });

    it('should register and emit events', () => {
        let called = false;
        bus.on('test', () => { called = true; });
        bus.emit('test');
        expect(called).toBe(true);
    });

    it('should handle priority ordering', () => {
        const order = [];
        bus.on('test', () => order.push(1), 1);
        bus.on('test', () => order.push(2), 2);
        bus.on('test', () => order.push(3), 3);
        bus.emit('test');
        expect(order).toEqual([3, 2, 1]); // Higher priority first
    });

    it('should handle once listeners', () => {
        let count = 0;
        bus.once('test', () => { count++; });
        bus.emit('test');
        bus.emit('test');
        expect(count).toBe(1);
    });

    it('should remove listeners', () => {
        let called = false;
        const callback = () => { called = true; };
        bus.on('test', callback);
        bus.off('test', callback);
        bus.emit('test');
        expect(called).toBe(false);
    });
});

describe('SystemRegistry', () => {
    let kernel, registry;

    beforeEach(() => {
        kernel = { events: new EventBus() };
        registry = new SystemRegistry(kernel);
    });

    it('should register systems', () => {
        const system = new System();
        registry.register('test', system);
        expect(registry.has('test')).toBe(true);
        expect(registry.get('test')).toBe(system);
    });

    it('should call init on registration', () => {
        const system = new System();
        let initCalled = false;
        system.init = () => { initCalled = true; };
        registry.register('test', system);
        expect(initCalled).toBe(true);
    });

    it('should call destroy on unregistration', () => {
        const system = new System();
        let destroyCalled = false;
        system.destroy = () => { destroyCalled = true; };
        registry.register('test', system);
        registry.unregister('test');
        expect(destroyCalled).toBe(true);
    });

    it('should update systems in order', () => {
        const order = [];
        const system1 = new System();
        system1.update = () => order.push(1);
        const system2 = new System();
        system2.update = () => order.push(2);

        registry.register('s1', system1, { priority: 1 });
        registry.register('s2', system2, { priority: 2 });
        registry.update(0.016);

        expect(order).toEqual([2, 1]); // Higher priority first
    });
});

describe('PluginRegistry', () => {
    let kernel, plugins;

    beforeEach(() => {
        kernel = { events: new EventBus(), systems: new SystemRegistry({ events: new EventBus() }) };
        plugins = new PluginRegistry(kernel);
    });

    it('should register plugins', () => {
        const plugin = {
            name: 'test-plugin',
            init: () => { }
        };
        plugins.use(plugin);
        expect(plugins.has('test-plugin')).toBe(true);
    });

    it('should call plugin init', () => {
        let initCalled = false;
        const plugin = {
            name: 'test-plugin',
            init: () => { initCalled = true; }
        };
        plugins.use(plugin);
        expect(initCalled).toBe(true);
    });

    it('should not register duplicate plugins', () => {
        const plugin = {
            name: 'test-plugin',
            init: () => { }
        };
        plugins.use(plugin);
        plugins.use(plugin); // Should warn but not throw
        expect(plugins.getPluginNames().length).toBe(1);
    });

    it('should call destroy on removal', () => {
        let destroyCalled = false;
        const plugin = {
            name: 'test-plugin',
            init: () => { },
            destroy: () => { destroyCalled = true; }
        };
        plugins.use(plugin);
        plugins.remove('test-plugin');
        expect(destroyCalled).toBe(true);
    });
});
