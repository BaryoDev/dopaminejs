import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { EventBus } from '../src/core/EventBus.js';

/**
 * RewardSystem historically had its own EventEmitter while the kernel ran a
 * separate EventBus, and EventBus.Events already declared XP_GAINED, LEVEL_UP
 * and ACHIEVEMENT_UNLOCKED with nothing bridging them. These cover the bridge
 * without breaking the existing rewardSystem.on(...) surface.
 */
describe('RewardSystem on the kernel EventBus', () => {
    let dataService;
    let bus;

    beforeEach(() => {
        dataService = new DataService({
            storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
        });
        dataService.load = vi.fn().mockResolvedValue(null);
        dataService.save = vi.fn().mockResolvedValue(true);
        bus = new EventBus();
    });

    const build = async (config = {}) => {
        const system = new RewardSystem(dataService, config);
        await system.init();
        return system;
    };

    it('should forward xp_gained onto an injected EventBus', async () => {
        const system = await build({ events: bus });
        const spy = vi.fn();
        bus.on(EventBus.Events.XP_GAINED, spy);

        await system.addXP(25, 'testing');

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amount: 25, reason: 'testing' }));
    });

    it('should forward level_up onto the bus using the shared constant', async () => {
        const system = await build({ events: bus });
        const spy = vi.fn();
        bus.on(EventBus.Events.LEVEL_UP, spy);

        await system.addXP(100);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ oldLevel: 1, newLevel: 2 }));
    });

    it('should forward achievement_unlocked onto the bus', async () => {
        const system = await build({ events: bus });
        const spy = vi.fn();
        bus.on(EventBus.Events.ACHIEVEMENT_UNLOCKED, spy);

        await system.recordGame('game', { score: 5 });

        expect(spy).toHaveBeenCalled();
    });

    it('should keep the local on() surface working when a bus is attached', async () => {
        const system = await build({ events: bus });
        const local = vi.fn();
        system.on('xp_gained', local);

        await system.addXP(10);

        expect(local).toHaveBeenCalled();
    });

    it('should work with no bus at all, exactly as before', async () => {
        const system = await build();
        const local = vi.fn();
        system.on('xp_gained', local);

        await system.addXP(10);

        expect(local).toHaveBeenCalled();
    });

    it('should accept a kernel and find the bus on it', async () => {
        const kernel = { events: bus };
        const system = await build({ kernel });
        const spy = vi.fn();
        bus.on(EventBus.Events.XP_GAINED, spy);

        await system.addXP(15);

        expect(spy).toHaveBeenCalled();
    });
});
