/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameUI } from '../src/dopamine/ui/GameUI.js';

const stubParticles = () => ({
    confetti: vi.fn(),
    fire: vi.fn(),
    sparkle: vi.fn(),
    starBurst: vi.fn()
});

describe('GameUI', () => {
    let ui;

    beforeEach(() => {
        document.body.innerHTML = '';
        ui = new GameUI(stubParticles());
    });

    afterEach(() => {
        ui?.destroy?.();
        document.body.innerHTML = '';
    });

    it('should render achievement text as text, not markup', () => {
        ui.showAchievement({
            icon: '🏆',
            name: '<img src=x onerror="window.__pwned = true">',
            description: '<script>window.__pwned = true</script>',
            xp: 10
        });

        const popup = document.querySelector('.achievement-popup');
        expect(popup.querySelector('img')).toBeNull();
        expect(popup.querySelector('script')).toBeNull();
        expect(popup.querySelector('.achievement-name').textContent)
            .toBe('<img src=x onerror="window.__pwned = true">');
    });

    it('should still allow HTML in the achievement icon', () => {
        ui.showAchievement({
            icon: '<img src="skull.png" width="20">',
            name: 'You Tried',
            description: 'Documented behaviour',
            xp: 10
        });

        expect(document.querySelector('.achievement-icon img')).not.toBeNull();
    });

    it('should render summary metrics as text, not markup', () => {
        ui.showSummary({
            score: '<img src=x onerror="window.__pwned = true">',
            metrics: { '<b>Coins</b>': '<i>12</i>' }
        });

        const box = document.querySelector('.message-box');
        expect(box.querySelector('img')).toBeNull();
        expect(box.querySelector('b')).toBeNull();
        expect(box.querySelector('i')).toBeNull();
    });

    it('should not use inline event handlers, which a CSP blocks', () => {
        ui.showSummary({ score: 10, metrics: {} });

        const withInlineHandlers = document.querySelectorAll('[onclick]');
        expect(withInlineHandlers.length).toBe(0);
    });

    it('should wire summary buttons to injected callbacks', () => {
        const onReplay = vi.fn();
        const onExit = vi.fn();

        ui.showSummary({ score: 10, metrics: {}, onReplay, onExit });

        const [replayBtn, exitBtn] = document.querySelectorAll('.message-box .btn');
        replayBtn.click();
        exitBtn.click();

        expect(onReplay).toHaveBeenCalled();
        expect(onExit).toHaveBeenCalled();
    });

    it('should scope element lookups so two instances do not collide', () => {
        const second = new GameUI(stubParticles());

        ui.updateLevel(3);
        second.updateLevel(7);

        expect(ui.levelDisplay.textContent).toBe('3');
        expect(second.levelDisplay.textContent).toBe('7');
        expect(ui.levelDisplay).not.toBe(second.levelDisplay);

        second.destroy();
    });

    it('should remove its overlay on destroy', () => {
        expect(document.getElementById('game-ui-overlay')).not.toBeNull();

        ui.destroy();
        ui = null;

        expect(document.getElementById('game-ui-overlay')).toBeNull();
    });
});
