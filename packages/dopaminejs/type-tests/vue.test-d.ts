/**
 * Compile-only check for the dopaminejs-vue declarations. Never executed.
 */

import type { Ref } from 'vue';
import { createMemoryStorage } from '../types/index.js';
import { provideRewards, useRewards } from '../../dopaminejs-vue/types/index.js';

// The core async storage type must be accepted.
const asyncStorage = {
    getItem: async (_key: string): Promise<string | null> => null,
    setItem: async (_key: string, _value: string): Promise<void> => {},
    removeItem: async (_key: string): Promise<void> => {}
};

provideRewards();
provideRewards({ storage: createMemoryStorage() });
provideRewards({
    storage: asyncStorage,
    config: {
        achievements: {
            first: { name: 'First', description: 'Play once', icon: 'x', xp: 5, check: () => true }
        }
    }
});

const rewards = useRewards();
const level: Ref<number> = rewards.level;
const ready: Ref<boolean> = rewards.ready;
const error: Ref<unknown> = rewards.error;
const progress: number = rewards.progress.value;
const firstId: string | undefined = rewards.achievements.value[0]?.id;
void [level, ready, error, progress, firstId];

rewards.addXP(10, 'lesson').then(result => result.newLevel.toFixed());
rewards.record('quiz', { score: 3 });
rewards.unlockAchievement('first').then((unlocked: boolean) => unlocked);

// @ts-expect-error amount must be a number
rewards.addXP('10');
// @ts-expect-error config is typed
provideRewards({ config: { nope: true } });
