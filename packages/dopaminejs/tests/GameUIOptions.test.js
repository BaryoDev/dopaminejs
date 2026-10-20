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

const popupIcon = () => document.querySelector('.achievement-icon');

describe('GameUI text and icon options', () => {
    let ui;

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        ui?.destroy();
        ui = null;
        document.body.innerHTML = '';
    });

    it('should keep the built-in strings and fire emoji by default', () => {
        ui = new GameUI(stubParticles());
        ui.showAchievement({ name: 'A', xp: 1 });
        ui.showLevelUp(1, 2);

        expect(document.querySelector('.achievement-title').textContent).toBe('Achievement Unlocked!');
        expect(document.querySelector('.level-up-title').textContent).toBe('LEVEL UP!');
        expect(document.querySelector('.streak-icon').textContent).toBe('🔥');

        ui.showNearMiss(1, 2);
        expect(document.querySelector('.floating-text').textContent).toBe('CLOSE CALL!');
    });

    it('should use each text override', () => {
        ui = new GameUI(stubParticles(), {
            text: { levelUp: 'Level!', achievementUnlocked: 'Done', nearMiss: 'Phew' }
        });
        ui.showAchievement({ name: 'A', xp: 1 });
        ui.showLevelUp(1, 2);
        ui.showNearMiss(1, 2);

        expect(document.querySelector('.achievement-title').textContent).toBe('Done');
        expect(document.querySelector('.level-up-title').textContent).toBe('Level!');
        expect(document.querySelector('.floating-text').textContent).toBe('Phew');
    });

    it('should render override text as text and ignore non-strings', () => {
        ui = new GameUI(stubParticles(), {
            text: { levelUp: '<b>x</b>', nearMiss: 5 }
        });
        ui.showLevelUp(1, 2);
        ui.showNearMiss(1, 2);

        expect(document.querySelector('.level-up-title b')).toBeNull();
        expect(document.querySelector('.level-up-title').textContent).toBe('<b>x</b>');
        expect(document.querySelector('.floating-text').textContent).toBe('CLOSE CALL!');
    });

    it('should take a string streak icon', () => {
        ui = new GameUI(stubParticles(), { icons: { streak: '*' } });
        expect(document.querySelector('.streak-icon').textContent).toBe('*');
    });

    it('should append a Node streak icon', () => {
        const node = document.createElement('i');
        node.className = 'mine';
        ui = new GameUI(stubParticles(), { icons: { streak: node } });

        expect(document.querySelector('.streak-icon > i.mine')).toBe(node);
    });

    it('should append a Node achievement icon', () => {
        ui = new GameUI(stubParticles());
        const node = document.createElement('span');
        node.className = 'mine';
        ui.showAchievement({ icon: node, name: 'A', xp: 1 });

        expect(popupIcon().firstChild).toBe(node);
    });

    it('should remove everything on destroy', () => {
        const node = document.createElement('i');
        ui = new GameUI(stubParticles(), { icons: { streak: node } });
        ui.showAchievement({ icon: document.createElement('b'), name: 'A', xp: 1 });
        ui.showLevelUp(1, 2);

        ui.destroy();
        ui = null;

        expect(document.body.children.length).toBe(0);
    });

    describe('safeIcons', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10"><circle r="4"/></svg>';

        it('should leave string icons as HTML by default', () => {
            ui = new GameUI(stubParticles());
            ui.showAchievement({ icon: '<img src="a.png">', name: 'A', xp: 1 });
            expect(popupIcon().querySelector('img')).not.toBeNull();
        });

        it('should render an SVG string as an svg element', () => {
            ui = new GameUI(stubParticles(), { safeIcons: true });
            ui.showAchievement({ icon: svg, name: 'A', xp: 1 });
            expect(popupIcon().querySelector('svg circle')).not.toBeNull();
        });

        it('should turn an HTML string into text', () => {
            ui = new GameUI(stubParticles(), { safeIcons: true });
            const html = '<img src=x onerror="window.__pwned = true">';
            ui.showAchievement({ icon: html, name: 'A', xp: 1 });

            expect(popupIcon().querySelector('img')).toBeNull();
            expect(popupIcon().textContent).toBe(html);
        });

        it('should show an emoji as text', () => {
            ui = new GameUI(stubParticles(), { safeIcons: true });
            ui.showAchievement({ icon: '🏆', name: 'A', xp: 1 });
            expect(popupIcon().textContent).toBe('🏆');
        });

        it('should strip scripts, on* attributes and javascript: links', () => {
            ui = new GameUI(stubParticles(), { safeIcons: true });
            ui.showAchievement({
                icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="window.__pwned = true">'
                    + '<script>window.__pwned = true</script>'
                    + '<a href="javascript:alert(1)"><rect/></a>'
                    + '<circle r="1" onclick="x()"/></svg>',
                name: 'A',
                xp: 1
            });

            const root = popupIcon().querySelector('svg');
            expect(root).not.toBeNull();
            expect(root.hasAttribute('onload')).toBe(false);
            expect(root.querySelector('script')).toBeNull();
            expect(root.querySelector('circle').hasAttribute('onclick')).toBe(false);
            expect(root.querySelector('a')).toBeNull();
        });

        describe('allowlist', () => {
            const wrap = (inner, attrs = '') => '<svg xmlns="http://www.w3.org/2000/svg" '
                + 'xmlns:xlink="http://www.w3.org/1999/xlink" ' + attrs + '>' + inner + '</svg>';

            const render = (markup) => {
                ui = new GameUI(stubParticles(), { safeIcons: true });
                ui.showAchievement({ icon: markup, name: 'A', xp: 1 });
                return popupIcon().querySelector('svg');
            };

            it('should drop foreignObject and its subtree', () => {
                const root = render(wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x"/></div></foreignObject><circle r="1"/>'));
                expect(root.querySelector('foreignObject')).toBeNull();
                expect(root.querySelector('img, div')).toBeNull();
                expect(root.querySelector('circle')).not.toBeNull();
            });

            it('should drop use elements', () => {
                const root = render(wrap('<use href="data:image/svg+xml,x"/><use xlink:href="https://evil.test/a.svg#b"/>'));
                expect(root.querySelector('use')).toBeNull();
            });

            it('should drop animate, set and animateTransform', () => {
                const root = render(wrap('<a><set attributeName="href" to="javascript:alert(1)"/></a>'
                    + '<circle r="1"><animate attributeName="href" to="javascript:alert(1)"/>'
                    + '<animateTransform attributeName="transform"/></circle>'));
                expect(root.querySelector('set, animate, animateTransform, a')).toBeNull();
                expect(root.querySelector('circle')).not.toBeNull();
            });

            it('should drop iframe, embed, object and script', () => {
                const root = render(wrap('<iframe/><embed/><object/><script>window.__pwned = true</script>'));
                expect(root.querySelector('iframe, embed, object, script')).toBeNull();
            });

            it('should drop style elements and style attributes', () => {
                const root = render(wrap('<style>circle { fill: url(https://evil.test/x) }</style><circle r="1" style="fill:red"/>'));
                expect(root.querySelector('style')).toBeNull();
                expect(root.querySelector('circle').hasAttribute('style')).toBe(false);
            });

            it('should remove external url() references', () => {
                const root = render(wrap('<circle r="1" fill="url(https://evil.test/x)" stroke="URL( #ok ) red" clip-path="u\\72l(https://evil.test)"/>'));
                const circle = root.querySelector('circle');
                expect(circle.hasAttribute('fill')).toBe(false);
                expect(circle.getAttribute('stroke')).toBe('URL( #ok ) red');
                expect(circle.hasAttribute('clip-path')).toBe(false);
            });

            it('should drop comments and processing instructions', () => {
                const root = render(wrap('<!-- hi --><?pi x?><circle r="1"/>'));
                expect(root.innerHTML).not.toContain('hi');
                expect(root.childNodes.length).toBe(1);
            });

            it('should still render an ordinary icon', () => {
                const root = render(wrap(
                    '<defs><linearGradient id="grad" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs>'
                    + '<path d="M0 0L10 10" fill="url(#grad)" stroke-width="2"/><text x="1" y="2">hi</text>',
                    'viewBox="0 0 10 10" width="24" height="24"'
                ));
                expect(root.getAttribute('viewBox')).toBe('0 0 10 10');
                expect(root.querySelector('linearGradient stop')).not.toBeNull();
                expect(root.querySelector('path').getAttribute('fill')).toBe('url(#grad)');
                expect(root.querySelector('text').textContent).toBe('hi');
            });
        });

        it('should still append Node icons', () => {
            ui = new GameUI(stubParticles(), { safeIcons: true });
            const node = document.createElement('span');
            ui.showAchievement({ icon: node, name: 'A', xp: 1 });
            expect(popupIcon().firstChild).toBe(node);
        });
    });
});
