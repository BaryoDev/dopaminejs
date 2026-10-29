/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { RewardsProvider } from '../../dopaminejs-react/src/RewardsContext.js';

const dispatched = vi.hoisted(() => []);
const cleanups = vi.hoisted(() => []);

// No React renderer is installed. These stand-ins run the provider once, as
// its first render would, so the value it hands to the context can be read.
// Dispatched actions are recorded rather than reduced.
vi.mock('react', () => {
    const api = {
        createContext: () => ({ Provider: 'Provider' }),
        useContext: () => null,
        useEffect: (effect) => { cleanups.push(effect()); },
        useReducer: (reducer, arg, init) => [init(arg), (action) => { dispatched.push(action); }],
        useRef: (value) => ({ current: value }),
        createElement: (type, props, ...children) => ({ type, props, children })
    };
    return { default: api, ...api };
});

const settle = async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
    await new Promise(resolve => setTimeout(resolve, 0));
};

describe('RewardsProvider', () => {
    afterEach(async () => {
        // Let every init the test left running finish before the next test.
        await settle();
        vi.restoreAllMocks();
        dispatched.length = 0;
        cleanups.length = 0;
    });

    const render = () => RewardsProvider({ storage: createMemoryStorage(), children: null }).props.value;

    it('should pass the reason through addXP', async () => {
        const addXP = vi.spyOn(RewardSystem.prototype, 'addXP').mockResolvedValue({ leveledUp: false });
        const { addXP: contextAddXP } = render();

        await contextAddXP(50, 'lesson complete');

        expect(addXP).toHaveBeenCalledWith(50, 'lesson complete');
    });

    it('should return what RewardSystem.addXP resolves with', async () => {
        const result = { leveledUp: true };
        vi.spyOn(RewardSystem.prototype, 'addXP').mockResolvedValue(result);

        await expect(render().addXP(50, 'lesson complete')).resolves.toBe(result);
    });

    it('should start not ready with no error', () => {
        const value = render();

        expect(value.ready).toBe(false);
        expect(value.error).toBeNull();
    });

    it('should dispatch ready once init resolves', async () => {
        render();
        await settle();

        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].payload).toMatchObject({ ready: true, level: 1, loadFailed: false });
    });

    it('should dispatch loadFailed when the saved player cannot be read', async () => {
        const storage = createMemoryStorage();
        storage.getItem = () => { throw new Error('offline'); };
        const value = RewardsProvider({ storage, children: null }).props.value;
        expect(value.loadFailed).toBe(false);
        await settle();

        expect(dispatched[0].payload).toMatchObject({ ready: true, loadFailed: true });
    });

    it('should catch an init rejection and dispatch it as error', async () => {
        const failure = new Error('storage down');
        vi.spyOn(RewardSystem.prototype, 'init').mockRejectedValue(failure);
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        render();
        await settle();
        process.off('unhandledRejection', unhandled);

        expect(dispatched).toEqual([{ type: 'SYNC', payload: { error: failure } }]);
        expect(unhandled).not.toHaveBeenCalled();
    });

    it('record calls progress.record', async () => {
        const record = vi.spyOn(RewardSystem.prototype, 'record').mockResolvedValue(true);

        await expect(render().record('quiz', { score: 9 })).resolves.toBe(true);

        expect(record).toHaveBeenCalledWith('quiz', { score: 9 });
    });

    it('loadFailed reaches the state', async () => {
        const storage = createMemoryStorage();
        storage.getItem = () => { throw new Error('offline'); };
        RewardsProvider({ storage, children: null });
        await settle();

        expect(dispatched.at(-1).payload.loadFailed).toBe(true);
    });

    it('refreshes loadFailed after reset', async () => {
        const on = vi.spyOn(RewardSystem.prototype, 'on');
        const storage = createMemoryStorage();
        storage.getItem = () => { throw new Error('offline'); };
        RewardsProvider({ storage, children: null });
        await settle();
        expect(dispatched.at(-1).payload.loadFailed).toBe(true);
        expect(on.mock.calls.map(call => call[0])).toContain('player_reset');

        await on.mock.contexts[0].reset();
        await settle();

        expect(dispatched.at(-1).payload.loadFailed).toBe(false);
    });

    it('syncs on personal_best', async () => {
        const on = vi.spyOn(RewardSystem.prototype, 'on');
        render();
        await settle();

        expect(on.mock.calls.map(call => call[0])).toContain('personal_best');
    });

    it('createDopamine wrapper installs and disposes', async () => {
        const calls = [];
        const plugin = {
            name: 'probe',
            version: '1.0.0',
            api: 3,
            install() {
                calls.push('install');
                return () => calls.push('dispose');
            }
        };
        const dopamine = { ui: false, particles: false, sound: false, haptics: false, plugins: [plugin] };
        RewardsProvider({ storage: createMemoryStorage(), dopamine, children: null });
        await settle();

        expect(calls).toEqual(['install']);
        expect(dispatched.at(-1).payload).toMatchObject({ ready: true });

        for (const cleanup of cleanups) cleanup?.();
        expect(calls).toEqual(['install', 'dispose']);
    });
});
