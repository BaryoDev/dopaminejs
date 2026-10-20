/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { RewardsProvider } from '../../dopaminejs-react/src/RewardsContext.js';

const dispatched = vi.hoisted(() => []);

// No React renderer is installed. These stand-ins run the provider once, as
// its first render would, so the value it hands to the context can be read.
// Dispatched actions are recorded rather than reduced.
vi.mock('react', () => {
    const api = {
        createContext: () => ({ Provider: 'Provider' }),
        useContext: () => null,
        useEffect: (effect) => { effect(); },
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
    afterEach(() => {
        vi.restoreAllMocks();
        dispatched.length = 0;
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
});
