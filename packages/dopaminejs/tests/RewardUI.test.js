/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RewardUI } from '../src/dopamine/ui/RewardUI.js';

describe('RewardUI', () => {
    let ui;
    let parts;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        parts = { particles: { burst: vi.fn() } };
        ui = new RewardUI(parts);
    });

    afterEach(() => {
        ui?.destroy();
        vi.useRealTimers();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    it('reads parts.particles at call time', () => {
        const later = { burst: vi.fn() };
        parts.particles = later;

        ui.popup({ kind: 'achievement', title: 'A' });
        vi.advanceTimersByTime(400);

        expect(later.burst).toHaveBeenCalledWith('confetti', expect.any(Object), expect.any(Object));
        expect(parts.particles.burst).toBe(later.burst);
    });

    it('does nothing when there is no particles part', () => {
        parts.particles = null;
        ui.popup({ kind: 'achievement', title: 'A' });
        expect(() => vi.advanceTimersByTime(400)).not.toThrow();
    });

    it('popup renders each kind', () => {
        ui.popup({ kind: 'achievement', title: 'Name', body: 'Desc', meta: '+10 XP' });
        expect(document.querySelector('.achievement-title').textContent).toBe('Achievement Unlocked!');
        expect(document.querySelector('.achievement-name').textContent).toBe('Name');
        expect(document.querySelector('.achievement-desc').textContent).toBe('Desc');
        expect(document.querySelector('.achievement-xp').textContent).toBe('+10 XP');

        ui.popup({ kind: 'level', body: '5' });
        expect(document.querySelector('.level-up-title').textContent).toBe('LEVEL UP!');
        expect(document.querySelector('.level-up-number').textContent).toBe('5');

        ui.popup({ kind: 'notice', title: 'High score', tier: 'legendary' });
        expect(document.querySelector('.floating-text').textContent).toBe('High score');
        const kinds = parts.particles.burst.mock.calls.map((call) => call[0]);
        expect(kinds).toContain('stars');

        ui.popup({ kind: 'custom', title: 'Mine' });
        const names = [...document.querySelectorAll('.achievement-name')].map((el) => el.textContent);
        expect(names).toContain('Mine');
        expect(document.querySelectorAll('.achievement-title')[1].textContent).toBe('');
    });

    it('popup text is set as text, not markup', () => {
        ui.popup({
            kind: 'achievement',
            title: '<img src=x onerror="window.__pwned = true">',
            body: '<script>window.__pwned = true</script>',
            meta: '<b>x</b>'
        });

        const card = document.querySelector('.achievement-popup');
        expect(card.querySelector('img')).toBeNull();
        expect(card.querySelector('script')).toBeNull();
        expect(card.querySelector('b')).toBeNull();
        expect(card.querySelector('.achievement-name').textContent)
            .toBe('<img src=x onerror="window.__pwned = true">');
    });

    it('a string icon with markup renders as text by default', () => {
        ui.popup({ kind: 'achievement', title: 'A', icon: '<img src="skull.png">' });

        const icon = document.querySelector('.achievement-icon');
        expect(icon.querySelector('img')).toBeNull();
        expect(icon.textContent).toBe('<img src="skull.png">');
    });

    it('safeIcons false renders the icon as HTML', () => {
        ui.destroy();
        ui = new RewardUI(parts, { safeIcons: false });
        ui.popup({ kind: 'achievement', title: 'A', icon: '<img src="skull.png" width="20">' });

        expect(document.querySelector('.achievement-icon img')).not.toBeNull();
    });

    it('hud draws the bar, the level and the streak', () => {
        ui.hud({ xp: 30, level: 2, progress: 0.3, streak: 4, next: 100 });

        expect(ui.xpBar.style.width).toBe('30%');
        expect(ui.xpText.textContent).toBe('30 / 100 XP');
        expect(ui.levelDisplay.textContent).toBe('2');
        expect(ui.streakDisplay.textContent).toBe('4');
    });

    it('injectCss adds the styles once and destroy removes them', () => {
        ui.destroy();
        expect(document.getElementById('dopamine-reward-ui-css')).toBeNull();

        ui = new RewardUI(parts, { injectCss: '.x { color: red; }' });
        const second = new RewardUI(parts, { injectCss: true });

        expect(document.querySelectorAll('#dopamine-reward-ui-css').length).toBe(1);
        expect(document.getElementById('dopamine-reward-ui-css').textContent).toBe('.x { color: red; }');

        second.destroy();
        expect(document.getElementById('dopamine-reward-ui-css')).not.toBeNull();
        ui.destroy();
        ui = null;
        expect(document.getElementById('dopamine-reward-ui-css')).toBeNull();
    });

    it('adds no stylesheet unless asked', () => {
        expect(document.getElementById('dopamine-reward-ui-css')).toBeNull();
    });

    it('should scope element lookups so two instances do not collide', () => {
        const second = new RewardUI(parts);

        ui.hud({ xp: 0, level: 3, streak: 1 });
        second.hud({ xp: 0, level: 7, streak: 1 });

        expect(ui.levelDisplay.textContent).toBe('3');
        expect(second.levelDisplay.textContent).toBe('7');

        second.destroy();
    });

    it('should remove its overlay on destroy', () => {
        expect(document.getElementById('game-ui-overlay')).not.toBeNull();

        ui.destroy();
        ui = null;

        expect(document.getElementById('game-ui-overlay')).toBeNull();
    });
});
