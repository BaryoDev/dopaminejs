/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

        vi.advanceTimersByTime(4600);
        ui.popup({ kind: 'custom', title: 'Mine' });
        const names = [...document.querySelectorAll('.achievement-name')].map((el) => el.textContent);
        expect(names).toContain('Mine');
        // The first card is gone by now, so the custom card is the only one.
        expect(document.querySelectorAll('.achievement-title')[0].textContent).toBe('');
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

    describe('card queue', () => {
        const cards = () => [...document.querySelectorAll('.achievement-popup .achievement-name')]
            .map((el) => el.textContent);

        it('shows one card at a time and the next after the first is gone', () => {
            ui.popup({ kind: 'achievement', title: 'First' });
            ui.popup({ kind: 'achievement', title: 'Second' });
            expect(cards()).toEqual(['First']);

            vi.advanceTimersByTime(4299);
            expect(cards()).toEqual(['First']);

            vi.advanceTimersByTime(1);
            expect(cards()).toEqual(['Second']);

            vi.advanceTimersByTime(4300);
            expect(cards()).toEqual([]);
        });

        it('announces each card when it shows, in order', () => {
            ui.popup({ kind: 'achievement', title: 'First' });
            ui.popup({ kind: 'custom', title: 'Second' });
            expect(ui.liveRegion.textContent).toBe('Achievement Unlocked!: First');

            vi.advanceTimersByTime(4300);
            expect(ui.liveRegion.textContent).toBe('Second');
        });

        it('bursts confetti for a queued card when it shows', () => {
            ui.popup({ kind: 'achievement', title: 'First' });
            ui.popup({ kind: 'achievement', title: 'Second' });
            vi.advanceTimersByTime(400);
            expect(parts.particles.burst).toHaveBeenCalledTimes(1);

            // The second card mounts at 4300ms and bursts 300ms after that.
            vi.advanceTimersByTime(3900);
            expect(parts.particles.burst).toHaveBeenCalledTimes(1);
            vi.advanceTimersByTime(300);
            expect(parts.particles.burst).toHaveBeenCalledTimes(2);
        });

        it('does not queue level-up overlays or floating text', () => {
            ui.popup({ kind: 'achievement', title: 'First' });
            ui.popup({ kind: 'level', body: '2' });
            ui.popup({ kind: 'notice', title: 'Note' });
            expect(document.querySelector('.level-up-overlay')).not.toBeNull();
            expect(document.querySelector('.floating-text')).not.toBeNull();
        });

        it('a card that throws while building does not block later cards', () => {
            const bad = { kind: 'achievement', get title() { throw new Error('bad title'); } };
            expect(() => ui.popup(bad)).toThrow('bad title');

            ui.popup({ kind: 'achievement', title: 'After' });
            expect(cards()).toEqual(['After']);
        });

        it('a throwing card in the queue lets the next one show', () => {
            ui.popup({ kind: 'achievement', title: 'First' });
            ui.popup({ kind: 'achievement', get title() { throw new Error('bad title'); } });
            ui.popup({ kind: 'achievement', title: 'Third' });

            expect(() => vi.advanceTimersByTime(4300)).toThrow('bad title');
            expect(cards()).toEqual(['Third']);
        });

        it('destroy clears a queued card and leaves no timer', () => {
            ui.popup({ kind: 'achievement', title: 'First' });
            ui.popup({ kind: 'achievement', title: 'Second' });
            ui.destroy();

            expect(vi.getTimerCount()).toBe(0);
            vi.advanceTimersByTime(10000);
            expect(document.querySelector('.achievement-popup')).toBeNull();
            expect(parts.particles.burst).not.toHaveBeenCalled();
        });
    });

    it('the stylesheet reads the toast variables', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const css = readFileSync(resolve(here, '../src/dopamine/ui/dopamine.css'), 'utf8');
        const rule = css.match(/\.achievement-popup \{[^}]*\}/)[0];
        expect(rule).toContain('var(--dopamine-toast-bg');
        expect(rule).toContain('env(safe-area-inset-top');
        for (const name of ['bg', 'text', 'muted', 'accent', 'radius', 'shadow', 'top', 'right', 'left', 'max-width']) {
            expect(css).toContain(`var(--dopamine-toast-${name},`);
        }
        // A game's max width must not undo the small-screen cap.
        expect(css).toContain('min(var(--dopamine-toast-max-width, 320px), calc(100% - 24px))');
    });
});
