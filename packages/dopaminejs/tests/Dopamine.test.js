/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dopamine from '../src/dopamine/index.js';
import { GameUI } from '../src/dopamine/ui/GameUI.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const canvasContext = () => ({
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn()
});

const today = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

describe('Dopamine facade', () => {
    let dopamine;
    let storage;

    beforeEach(() => {
        document.body.innerHTML = '';
        HTMLCanvasElement.prototype.getContext = vi.fn(canvasContext);
        vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 0));

        storage = createMemoryStorage();
        dopamine = new Dopamine({ data: { storage }, sound: { storage: createMemoryStorage() } });
    });

    afterEach(() => {
        dopamine?.destroy?.();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    const text = (selector) => document.querySelector(selector).textContent;

    it('should show the saved player after init, not the placeholder', async () => {
        storage.setItem('dopamine_player', JSON.stringify({
            xp: 1000,
            level: 5,
            streak: { current: 4, longest: 4, lastPlayDate: today() }
        }));

        await dopamine.init();

        expect(text('.level-number')).toBe('5');
        expect(text('.xp-text')).toBe('1000 / 1500 XP');
        expect(text('.streak-number')).toBe('4');
    });

    it('should fill the XP bar by progress within the level, not lifetime XP', async () => {
        storage.setItem('dopamine_player', JSON.stringify({ xp: 1000, level: 5 }));
        await dopamine.init();

        // Level 5 starts at 1000 XP and ends at 1500.
        expect(document.querySelector('.xp-bar-fill').style.width).toBe('0%');

        await dopamine.rewardSystem.addXP(250);

        expect(document.querySelector('.xp-bar-fill').style.width).toBe('50%');
    });

    it('should keep the level badge in step with a level up', async () => {
        await dopamine.init();
        await dopamine.rewardSystem.addXP(100);

        expect(text('.level-number')).toBe('2');
    });

    it('should update the streak badge when the day rolls over', async () => {
        await dopamine.init();
        const rewards = dopamine.rewardSystem;
        rewards.player.streak = { current: 2, longest: 2, lastPlayDate: rewards._getYesterdayDateString() };

        await rewards.recordGame('snake', { score: 0 });

        expect(text('.streak-number')).toBe('3');
    });

    it('should show the high score message as written', async () => {
        await dopamine.init();
        await dopamine.rewardSystem.recordGame('snake', { score: 500 });

        const floaters = [...document.querySelectorAll('.floating-text')].map((el) => el.textContent);
        expect(floaters).toContain('New High Score: 500!');
    });

    it('should stop touching the DOM after destroy', async () => {
        await dopamine.init();
        const rewards = dopamine.rewardSystem;

        dopamine.destroy();
        dopamine = null;

        expect(document.querySelector('.game-ui-overlay')).toBeNull();
        expect(document.querySelector('canvas')).toBeNull();
        await expect(rewards.addXP(500)).resolves.toMatchObject({ leveledUp: true });
        expect(document.querySelector('.level-up-overlay')).toBeNull();
    });
});

describe('GameUI notifications', () => {
    let ui;
    let particles;

    beforeEach(() => {
        document.body.innerHTML = '';
        particles = { confetti: vi.fn(), fire: vi.fn(), sparkle: vi.fn(), starBurst: vi.fn() };
        ui = new GameUI(particles);
    });

    afterEach(() => {
        ui.destroy();
        document.body.innerHTML = '';
    });

    it('should not wrap a rare or legendary message in combo or lucky text', () => {
        ui.showNotification('Nice', 'rare');
        ui.showNotification('Jackpot', 'legendary');
        ui.showNotification('Saved');

        const floaters = [...document.querySelectorAll('.floating-text')].map((el) => el.textContent);
        expect(floaters).toEqual(['Nice', 'Jackpot', 'Saved']);
        expect(particles.fire).toHaveBeenCalledTimes(1);
        expect(particles.starBurst).toHaveBeenCalledTimes(1);
    });

    it('should announce popups to assistive technology', () => {
        const live = document.querySelector('.game-ui-overlay [aria-live]');
        expect(live).not.toBeNull();

        ui.showAchievement({ name: 'First Steps', description: 'Play', xp: 50 });
        expect(live.textContent).toBe('Achievement unlocked: First Steps');

        ui.showLevelUp(1, 2);
        expect(live.textContent).toBe('Level up: 2');
    });

    it('should clear the streak colour when the streak resets', () => {
        ui.updateStreak(7);
        expect(ui.streakBadge.style.background).not.toBe('');

        ui.updateStreak(1);
        expect(ui.streakBadge.style.background).toBe('');
    });
});
