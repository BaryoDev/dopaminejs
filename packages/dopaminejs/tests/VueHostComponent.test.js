/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createApp, defineComponent, h, onUnmounted } from 'vue';
import { createDopamine, DataService, RewardSystem } from 'dopaminejs';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

// The component the Vue recipe on the wiki quotes. It uses the core only.
const XPButton = defineComponent({
    props: { options: { type: Object, default: () => ({}) } },
    setup(props) {
        const host = createDopamine(props.options);
        onUnmounted(() => host.dispose());
        const finish = async () => {
            await host.ready;
            await host.progress.addXP(10);
        };
        return () => h('button', { onClick: finish }, 'Mark as done');
    }
});

const settle = async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('a Vue component that owns a host', () => {
    it('should create the host on setup, award XP on click and remove its overlay on unmount', async () => {
        const storage = createMemoryStorage();
        const el = document.createElement('div');
        const app = createApp(XPButton, { options: { particles: false, storage } });
        app.mount(el);

        expect(document.querySelector('.game-ui-overlay')).not.toBeNull();

        el.querySelector('button').click();
        await settle();

        const saved = new RewardSystem(new DataService({ storage }));
        await saved.init();
        expect(saved.snapshot().xp).toBe(10);

        app.unmount();
        expect(document.querySelector('.game-ui-overlay')).toBeNull();
    });
});
