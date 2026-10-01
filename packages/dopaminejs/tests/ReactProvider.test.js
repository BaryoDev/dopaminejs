/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { RewardsProvider } from '../../dopaminejs-react/src/RewardsContext.js';

// No React renderer is installed. These stand-ins run the provider once, as
// its first render would, so the value it hands to the context can be read.
vi.mock('react', () => {
    const api = {
        createContext: () => ({ Provider: 'Provider' }),
        useContext: () => null,
        useEffect: (effect) => { effect(); },
        useReducer: (reducer, arg, init) => [init(arg), () => {}],
        useRef: (value) => ({ current: value }),
        createElement: (type, props, ...children) => ({ type, props, children })
    };
    return { default: api, ...api };
});

describe('RewardsProvider', () => {
    afterEach(() => {
        vi.restoreAllMocks();
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
});
