/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

    it('should register its update callback only once across restarts', () => {
        kernel.start();
        kernel.stop();
        kernel.start();
        kernel.stop();

        expect(kernel.ticker.callbacks.size).toBe(1);
    });

    it('should detach from the ticker on destroy', () => {
        kernel.start();
        const ticker = kernel.ticker;
        kernel.destroy();

        expect(ticker.callbacks.size).toBe(0);
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

    describe('systems on removal', () => {
        const system = () => ({ destroy: vi.fn() });

        beforeEach(() => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should unregister the systems a plugin registered in init', () => {
            const first = system();
            const second = system();
            plugins.use({
                name: 'two-systems',
                init(k) {
                    k.systems.register('first', first);
                    k.systems.register('second', second);
                }
            });

            plugins.remove('two-systems');

            expect(kernel.systems.getSystemNames()).toEqual([]);
            expect(first.destroy).toHaveBeenCalledTimes(1);
            expect(second.destroy).toHaveBeenCalledTimes(1);
        });

        it('should unregister a system the plugin put in place of an existing one', () => {
            const original = system();
            const replacement = system();
            kernel.systems.register('audio', original);
            plugins.use({ name: 'replacer', init: (k) => k.systems.register('audio', replacement) });

            plugins.remove('replacer');

            expect(kernel.systems.has('audio')).toBe(false);
            expect(replacement.destroy).toHaveBeenCalledTimes(1);
        });

        it('should leave systems the plugin did not register', () => {
            const existing = system();
            kernel.systems.register('existing', existing);
            plugins.use({ name: 'own', init: (k) => k.systems.register('mine', system()) });
            const later = system();
            kernel.systems.register('later', later);

            plugins.remove('own');

            expect(kernel.systems.getSystemNames()).toEqual(['existing', 'later']);
            expect(existing.destroy).not.toHaveBeenCalled();
            expect(later.destroy).not.toHaveBeenCalled();
        });

        it('should leave a system that something else replaced after the plugin loaded', () => {
            const mine = system();
            const theirs = system();
            plugins.use({ name: 'first', init: (k) => k.systems.register('audio', mine) });
            plugins.use({ name: 'second', init: (k) => k.systems.register('audio', theirs) });

            plugins.remove('first');

            expect(kernel.systems.get('audio')).toBe(theirs);
            expect(theirs.destroy).not.toHaveBeenCalled();

            plugins.remove('second');

            expect(kernel.systems.has('audio')).toBe(false);
        });

        it('should not destroy a system twice when the plugin unregisters it itself', () => {
            const mine = system();
            plugins.use({
                name: 'tidy',
                init: (k) => k.systems.register('mine', mine),
                destroy: () => kernel.systems.unregister('mine')
            });

            plugins.remove('tidy');

            expect(mine.destroy).toHaveBeenCalledTimes(1);
        });

        it('should run the plugin destroy while its systems are still registered', () => {
            let seen = null;
            plugins.use({
                name: 'ordered',
                init: (k) => k.systems.register('mine', system()),
                destroy: () => { seen = kernel.systems.has('mine'); }
            });

            plugins.remove('ordered');

            expect(seen).toBe(true);
        });

        it('should finish removing a plugin when one of its systems throws from destroy', () => {
            const bad = { destroy: () => { throw new Error('boom'); } };
            const good = system();
            plugins.use({
                name: 'faulty',
                init(k) {
                    k.systems.register('bad', bad);
                    k.systems.register('good', good);
                }
            });
            const unloaded = vi.fn();
            kernel.events.on('plugin_unloaded', unloaded);

            expect(plugins.remove('faulty')).toBe(true);

            expect(kernel.systems.getSystemNames()).toEqual([]);
            expect(good.destroy).toHaveBeenCalledTimes(1);
            expect(plugins.has('faulty')).toBe(false);
            expect(unloaded).toHaveBeenCalledWith({ name: 'faulty' });
        });

        it('should not unregister the same systems again when a plugin of that name loads later', () => {
            plugins.use({ name: 'again', init: (k) => k.systems.register('mine', system()) });
            plugins.remove('again');
            const kept = system();
            kernel.systems.register('mine', kept);
            plugins.use({ name: 'again', init: () => {} });

            plugins.remove('again');

            expect(kernel.systems.get('mine')).toBe(kept);
        });

        it('should forget what a removed plugin registered', () => {
            const shared = system();
            plugins.use({ name: 'first', init: (k) => k.systems.register('shared', shared) });
            plugins.remove('first');
            plugins.use({ name: 'second', init: (k) => k.systems.register('shared', shared) });

            plugins.remove('second');

            expect(kernel.systems.has('shared')).toBe(false);
        });

        it('should unregister the systems of every plugin on clear', () => {
            const a = system();
            const b = system();
            plugins.use({ name: 'a', init: (k) => k.systems.register('a', a) });
            plugins.use({ name: 'b', init: (k) => k.systems.register('b', b) });

            plugins.clear();

            expect(kernel.systems.getSystemNames()).toEqual([]);
            expect(plugins.getPluginNames()).toEqual([]);
        });

        it('should unregister the systems an async plugin registered', async () => {
            const mine = system();
            await plugins.useAsync({
                name: 'async',
                async init(k) {
                    await Promise.resolve();
                    k.systems.register('mine', mine);
                }
            });

            plugins.remove('async');

            expect(kernel.systems.has('mine')).toBe(false);
            expect(mine.destroy).toHaveBeenCalledTimes(1);
        });

        it('should not give an async plugin the systems another plugin registered while it loaded', async () => {
            let release;
            const gate = new Promise((resolve) => { release = resolve; });
            const slowSystem = system();
            const quickSystem = system();
            const audio = system();
            kernel.systems.register('audio', system());

            const pending = plugins.useAsync({
                name: 'slow',
                async init(k) {
                    await gate;
                    k.systems.register('slow', slowSystem);
                }
            });
            plugins.use({
                name: 'quick',
                init(k) {
                    k.systems.register('quick', quickSystem);
                    k.systems.register('audio', audio);
                }
            });
            release();
            await pending;

            plugins.remove('slow');

            expect(kernel.systems.getSystemNames().sort()).toEqual(['audio', 'quick']);
            expect(kernel.systems.get('audio')).toBe(audio);

            plugins.remove('quick');

            expect(kernel.systems.getSystemNames()).toEqual([]);
        });

        it('should leave a system registered while two async inits overlapped', async () => {
            let releaseA;
            let releaseB;
            const gateA = new Promise((resolve) => { releaseA = resolve; });
            const gateB = new Promise((resolve) => { releaseB = resolve; });

            const loadingA = plugins.useAsync({
                name: 'a',
                async init(k) {
                    k.systems.register('a-early', system());
                    await gateA;
                    k.systems.register('a-late', system());
                }
            });
            const loadingB = plugins.useAsync({
                name: 'b',
                async init(k) {
                    k.systems.register('b-early', system());
                    await gateB;
                    k.systems.register('b-late', system());
                }
            });
            releaseA();
            await loadingA;
            releaseB();
            await loadingB;

            // a-early was there before b began, so it is a's. a-late and
            // b-early appeared while both were loading.
            plugins.remove('a');
            expect(kernel.systems.getSystemNames()).toEqual(['b-early', 'a-late', 'b-late']);

            plugins.remove('b');
            expect(kernel.systems.getSystemNames()).toEqual(['b-early', 'a-late']);
        });

        it('should leave the systems of a plugin loaded from inside another init', () => {
            const inner = { name: 'inner', init: (k) => k.systems.register('inner', system()) };
            plugins.use({
                name: 'outer',
                init(k) {
                    k.systems.register('outer', system());
                    plugins.use(inner);
                }
            });

            plugins.remove('outer');

            expect(kernel.systems.getSystemNames()).toEqual(['inner']);

            plugins.remove('inner');

            expect(kernel.systems.getSystemNames()).toEqual([]);
        });

        it('should not run a plugin destroy twice when a system removes the plugin again', () => {
            const destroy = vi.fn();
            plugins.use({
                name: 'loop',
                init: (k) => k.systems.register('mine', { destroy: () => plugins.remove('loop') }),
                destroy
            });
            const unloaded = vi.fn();
            kernel.events.on('plugin_unloaded', unloaded);

            plugins.remove('loop');

            expect(destroy).toHaveBeenCalledTimes(1);
            expect(unloaded).toHaveBeenCalledTimes(1);
        });

        it('should not unregister anything for a plugin whose init failed', () => {
            const existing = system();
            kernel.systems.register('existing', existing);

            expect(() => plugins.use({
                name: 'broken',
                init(k) {
                    k.systems.register('mine', system());
                    throw new Error('boom');
                }
            })).toThrow('boom');

            expect(plugins.remove('broken')).toBe(false);
            expect(kernel.systems.getSystemNames()).toEqual(['existing']);
        });
    });
});
