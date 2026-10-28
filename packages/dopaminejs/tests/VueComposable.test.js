/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, defineComponent, h, inject, nextTick, watch } from 'vue';
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
            return () => h('p', `${seen.rewards.level.value}|${seen.rewards.achievements.value.length}`);
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
    await new Promise((resolve) => setTimeout(resolve, 0));
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
        expect(el.textContent).toBe(`${seen.rewards.level.value}|0`);
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

    it('should expose the player xp and streak after init and after addXP', async () => {
        const { app, seen } = mount();
        expect(seen.rewards.ready.value).toBe(false);
        await flush();

        expect(seen.rewards.ready.value).toBe(true);
        expect(seen.rewards.error.value).toBeNull();
        expect(seen.rewards.player.value.xp).toBe(0);
        expect(seen.rewards.player.value.streak.current).toBe(0);

        await seen.rewards.addXP(150);
        await flush();

        expect(seen.rewards.player.value.xp).toBe(150);
        expect(seen.rewards.player.value.streak.current).toBe(1);
        app.unmount();
    });

    it('should show an achievement unlocked through unlockAchievement', async () => {
        const config = {
            achievements: {
                custom_one: { name: 'Custom One', description: 'd', icon: 'i', xp: 5, check: () => false }
            }
        };
        const { app, el, seen } = mount({ config });
        await flush();

        await expect(seen.rewards.unlockAchievement('custom_one')).resolves.toBe(true);
        await flush();

        expect(seen.rewards.achievements.value.map(a => a.id)).toEqual(['custom_one']);
        expect(seen.rewards.achievements.value[0].name).toBe('Custom One');
        expect(seen.rewards.xp.value).toBe(5);
        expect(el.textContent).toMatch(/\|1$/);
        app.unmount();
    });

    it('should show an achievement unlocked by record', async () => {
        const config = {
            achievements: {
                played_quiz: {
                    name: 'Played', description: 'd', icon: 'i', xp: 0,
                    check: (player, game) => game === 'quiz'
                }
            }
        };
        const { app, el, seen } = mount({ config });
        await flush();

        await seen.rewards.record('quiz', { score: 1 });
        await flush();

        expect(seen.rewards.achievements.value.map(a => a.id)).toContain('played_quiz');
        expect(el.textContent).toMatch(/\|[1-9]\d*$/);
        expect(seen.rewards.xp.value).toBeGreaterThan(0);
        app.unmount();
    });

    it('should delegate record and unlockAchievement', async () => {
        const record = vi.spyOn(RewardSystem.prototype, 'record').mockResolvedValue(undefined);
        const unlock = vi.spyOn(RewardSystem.prototype, 'unlockAchievement').mockResolvedValue(true);
        const { app, seen } = mount();

        await seen.rewards.record('quiz', { score: 9 });
        await expect(seen.rewards.unlockAchievement('first_game')).resolves.toBe(true);

        expect(record).toHaveBeenCalledWith('quiz', { score: 9 });
        expect(unlock).toHaveBeenCalledWith('first_game');
        app.unmount();
    });

    it('should leave the refs untouched when unmounted before init resolves', async () => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', JSON.stringify({ xp: 1250, level: 5 }));
        const { app, seen } = mount({ storage });

        app.unmount();
        await flush();

        expect(seen.rewards.level.value).toBe(1);
        expect(seen.rewards.ready.value).toBe(false);
    });

    it('should set loadFailed when the saved player cannot be read', async () => {
        const storage = createMemoryStorage();
        storage.getItem = () => { throw new Error('offline'); };
        const { app, seen } = mount({ storage });
        expect(seen.rewards.loadFailed.value).toBe(false);
        await flush();

        expect(seen.rewards.ready.value).toBe(true);
        expect(seen.rewards.loadFailed.value).toBe(true);
        app.unmount();
    });

    it('should catch an init rejection into error', async () => {
        const failure = new Error('storage down');
        vi.spyOn(RewardSystem.prototype, 'init').mockRejectedValue(failure);
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        const { app, seen } = mount();
        await flush();
        await new Promise(resolve => setTimeout(resolve, 0));
        process.off('unhandledRejection', unhandled);

        expect(seen.rewards.error.value).toBe(failure);
        expect(seen.rewards.ready.value).toBe(false);
        expect(unhandled).not.toHaveBeenCalled();
        app.unmount();
    });

    it('should warn and return the first instance on a second provideRewards call', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const seen = {};
        const Root = defineComponent({
            setup() {
                seen.first = provideRewards({ storage: createMemoryStorage() });
                seen.second = provideRewards({ storage: createMemoryStorage() });
                return () => null;
            }
        });
        const app = createApp(Root);
        app.mount(document.createElement('div'));

        expect(seen.second).toBe(seen.first);
        expect(warn).toHaveBeenCalledTimes(1);
        app.unmount();
    });

    it('should use a registry symbol for the injection key', () => {
        const key = Symbol.for('dopaminejs-rewards');
        const seen = {};
        const Child = defineComponent({
            setup() {
                seen.injected = inject(key, null);
                return () => null;
            }
        });
        const Root = defineComponent({
            setup() {
                provideRewards({ storage: createMemoryStorage() });
                return () => h(Child);
            }
        });
        const app = createApp(Root);
        app.mount(document.createElement('div'));

        expect(seen.injected).not.toBeNull();
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
