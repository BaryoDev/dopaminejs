/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, watch } from 'vue';
import { DataService } from '../src/dopamine/core/DataService.js';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { provideRewards, useRewards } from '../../dopaminejs-vue/src/useRewards.js';
import { buildState } from '../../dopaminejs-vue/src/state.js';

const EVENTS = ['xp_gained', 'level_up', 'achievement_unlocked', 'streak_updated'];

// Mounts a root that provides rewards and a child that consumes them.
function mount({ storage = createMemoryStorage(), config } = {}) {
    const seen = {};
    const Child = defineComponent({
        setup() {
            seen.rewards = useRewards();
            return () => h('p', String(seen.rewards.level.value));
        }
    });
    const Root = defineComponent({
        setup() {
            seen.provided = provideRewards({ storage, config });
            return () => h(Child);
        }
    });
    const el = document.createElement('div');
    const app = createApp(Root);
    app.mount(el);
    return { app, el, seen };
}

const flush = async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
    await nextTick();
};

describe('provideRewards and useRewards', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should start with the empty state', () => {
        const { app, seen } = mount();

        expect(seen.rewards.level.value).toBe(1);
        expect(seen.rewards.xp.value).toBe(0);
        expect(seen.rewards.progress.value).toBe(0);
        expect(seen.rewards.achievements.value).toEqual([]);
        app.unmount();
    });

    it('should hand the child what the provider returned', () => {
        const { app, seen } = mount();

        expect(seen.rewards).toBe(seen.provided);
        app.unmount();
    });

    it('should update the refs and the rendered output after addXP', async () => {
        const { app, el, seen } = mount();
        await flush();

        await seen.rewards.addXP(150, 'lesson');
        await flush();

        expect(seen.rewards.xp.value).toBe(150);
        expect(seen.rewards.level.value).toBeGreaterThan(1);
        expect(el.textContent).toBe(String(seen.rewards.level.value));
        app.unmount();
    });

    it('should load a saved player once init resolves', async () => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', JSON.stringify({ xp: 1250, level: 5 }));
        const { app, seen } = mount({ storage });
        await flush();

        expect(seen.rewards.level.value).toBe(5);
        expect(seen.rewards.xp.value).toBe(1250);
        expect(seen.rewards.progress.value).toBe(0.5);
        app.unmount();
    });

    it('should notify watchers of player when it changes in place', async () => {
        const { app, seen } = mount();
        await flush();
        const runs = vi.fn();
        watch(seen.rewards.player, runs);

        await seen.rewards.addXP(10);
        await flush();

        expect(runs).toHaveBeenCalled();
        app.unmount();
    });

    it('should pass the reason through addXP', async () => {
        const addXP = vi.spyOn(RewardSystem.prototype, 'addXP').mockResolvedValue({ leveledUp: false });
        const { app, seen } = mount();

        await seen.rewards.addXP(50, 'lesson complete');

        expect(addXP).toHaveBeenCalledWith(50, 'lesson complete');
        app.unmount();
    });

    it('should return what RewardSystem.addXP resolves with', async () => {
        const result = { leveledUp: true };
        vi.spyOn(RewardSystem.prototype, 'addXP').mockResolvedValue(result);
        const { app, seen } = mount();

        await expect(seen.rewards.addXP(50)).resolves.toBe(result);
        app.unmount();
    });

    it('should add the listeners on setup and remove every one on unmount', () => {
        const on = vi.spyOn(RewardSystem.prototype, 'on');
        const off = vi.spyOn(RewardSystem.prototype, 'off');
        const { app } = mount();

        expect(on.mock.calls.map(call => call[0])).toEqual(EVENTS);
        expect(off).not.toHaveBeenCalled();

        app.unmount();

        expect(off.mock.calls.map(call => call[0])).toEqual(EVENTS);
        for (const call of off.mock.calls) {
            expect(on.mock.calls).toContainEqual(call);
        }
    });

    it('should leave no listeners on the emitter after unmount', () => {
        let instance;
        const original = RewardSystem.prototype.init;
        vi.spyOn(RewardSystem.prototype, 'init').mockImplementation(function () {
            instance = this;
            return original.call(this);
        });
        const { app } = mount();
        const count = () => EVENTS.reduce(
            (sum, name) => sum + (instance.listeners.get(name)?.size ?? 0),
            0
        );

        expect(count()).toBe(EVENTS.length);
        app.unmount();
        expect(count()).toBe(0);
    });

    it('should not touch state after unmount', async () => {
        const { app, seen } = mount();
        await flush();
        app.unmount();
        const before = seen.rewards.xp.value;

        await seen.rewards.addXP(100);
        await flush();

        expect(seen.rewards.xp.value).toBe(before);
    });

    it('should throw from useRewards without a provider', () => {
        const Orphan = defineComponent({
            setup() {
                useRewards();
                return () => null;
            }
        });
        const app = createApp(Orphan);
        app.config.warnHandler = () => {};
        let caught;
        app.config.errorHandler = (error) => { caught = error; };
        app.mount(document.createElement('div'));

        expect(String(caught)).toMatch(/provideRewards/);
        app.unmount();
    });

    it('should throw from provideRewards outside a scope', () => {
        expect(() => provideRewards({ storage: createMemoryStorage() })).toThrow(/setup/);
    });
});

describe('Vue state snapshot', () => {
    it('should report progress within the level', async () => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', JSON.stringify({ xp: 1250, level: 5 }));
        const rewards = new RewardSystem(new DataService({ storage }));
        await rewards.init();

        expect(buildState(rewards)).toMatchObject({ level: 5, xp: 1250, progress: 0.5 });
    });

    it('should return the empty state before init', () => {
        const rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));

        expect(buildState(rewards)).toEqual({ player: {}, level: 1, xp: 0, progress: 0, achievements: [] });
    });
});
