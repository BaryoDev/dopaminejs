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
        for (const key of ['text', 'icons', 'safeIcons', 'levelUp', 'achievementUnlocked', 'nearMiss', 'streak']) {
            delete Object.prototype[key];
        }
        vi.unstubAllGlobals();
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

    it('should ignore options inherited from a polluted prototype', () => {
        Object.prototype.nearMiss = 'POLLUTED';
        Object.prototype.levelUp = 'POLLUTED';
        Object.prototype.streak = 'POLLUTED';
        Object.prototype.safeIcons = true;
        ui = new GameUI(stubParticles());

        expect(ui.text.nearMiss).toBe('CLOSE CALL!');
        expect(ui.text.levelUp).toBe('LEVEL UP!');
        expect(ui.safeIcons).toBe(false);
        expect(document.querySelector('.streak-icon').textContent).toBe('🔥');
    });

    it('should ignore an inherited text or icons object', () => {
        Object.prototype.text = { nearMiss: 'POLLUTED' };
        Object.prototype.icons = { streak: 'POLLUTED' };
        ui = new GameUI(stubParticles());

        expect(ui.text.nearMiss).toBe('CLOSE CALL!');
        expect(document.querySelector('.streak-icon').textContent).toBe('🔥');
    });

    it('should render nothing for an icon that is not a string or Node', () => {
        ui = new GameUI(stubParticles());
        ui.showAchievement({ icon: 42, name: 'A', xp: 1 });
        expect(popupIcon().childNodes.length).toBe(0);

        ui.destroy();
        ui = new GameUI(stubParticles(), { safeIcons: true });
        ui.showAchievement({ icon: { nodeType: 1 }, name: 'B', xp: 1 });
        expect(popupIcon().childNodes.length).toBe(0);
    });

    it('should release the streak icon on destroy', () => {
        ui = new GameUI(stubParticles(), { icons: { streak: document.createElement('i') } });
        const held = ui;
        ui.destroy();
        ui = null;

        expect(held._streakIcon).toBeNull();
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
                const root = render(wrap('<circle r="1" fill="url(https://evil.test/x)" stroke="url(#a) url(https://evil.test/y)" clip-path="u\\72l(https://evil.test)"/>'));
                const circle = root.querySelector('circle');
                expect(circle.hasAttribute('fill')).toBe(false);
                expect(circle.hasAttribute('stroke')).toBe(false);
                expect(circle.hasAttribute('clip-path')).toBe(false);
            });

            it('should drop chained, fallback and unknown-id url() values', () => {
                const root = render(wrap('<defs><linearGradient id="a"/></defs>'
                    + '<circle r="1" fill="url(#a) red" stroke="url(#missing)" mask="url(#a)url(#a)"/>'
                    + '<rect fill="  url( #a )  "/>'));
                const circle = root.querySelector('circle');
                expect(circle.hasAttribute('fill')).toBe(false);
                expect(circle.hasAttribute('stroke')).toBe(false);
                expect(circle.hasAttribute('mask')).toBe(false);
                expect(root.querySelector('rect').getAttribute('fill')).toMatch(/^url\(#dj-icon-\d+-a\)$/);
            });

            it('should prefix ids so an icon cannot clobber page globals', () => {
                const root = render(wrap('<defs><linearGradient id="a"/></defs>'
                    + '<circle id="rewards" r="1" fill="url(#a)"/>'));
                const circle = root.querySelector('circle');
                expect(circle.id).toMatch(/^dj-icon-\d+-rewards$/);
                expect(window.rewards).toBeUndefined();
                expect(document.getElementById('rewards')).toBeNull();
                const grad = root.querySelector('linearGradient');
                expect(circle.getAttribute('fill')).toBe(`url(#${grad.id})`);
            });

            it('should give two renders different id prefixes', () => {
                const first = render(wrap('<circle id="x" r="1"/>'));
                const second = new GameUI(stubParticles(), { safeIcons: true });
                second.showAchievement({ icon: wrap('<circle id="x" r="1"/>'), name: 'B', xp: 1 });
                const ids = [...document.querySelectorAll('.achievement-icon circle')].map((c) => c.id);
                expect(new Set(ids).size).toBe(2);
                expect(first).not.toBeNull();
                second.destroy();
            });

            it('should render an svg with no xmlns', () => {
                const root = render('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
                expect(root).not.toBeNull();
                expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
                expect(root.querySelector('path')).not.toBeNull();

                const padded = new GameUI(stubParticles(), { safeIcons: true });
                padded.showAchievement({ icon: '  <svg><circle r="1"/></svg>', name: 'B', xp: 1 });
                expect(document.querySelectorAll('.achievement-icon svg circle').length).toBe(2);
                padded.destroy();
            });

            it('should fall back to text when the markup is not well-formed XML', () => {
                const markup = '<svg viewBox="0 0 1 1"><text>a&nbsp;b</text></svg>';
                ui = new GameUI(stubParticles(), { safeIcons: true });
                ui.showAchievement({ icon: markup, name: 'A', xp: 1 });
                expect(popupIcon().querySelector('svg')).toBeNull();
                expect(popupIcon().textContent).toBe(markup);
            });

            it('should fall back to text when the root is not svg', () => {
                const markup = '<g xmlns="http://www.w3.org/2000/svg"><circle r="1"/></g>';
                ui = new GameUI(stubParticles(), { safeIcons: true });
                ui.showAchievement({ icon: markup, name: 'A', xp: 1 });
                expect(popupIcon().querySelector('g, circle')).toBeNull();
                expect(popupIcon().textContent).toBe(markup);
            });

            it('should fall back to text when the parser reports an error', () => {
                // Some browsers return the partial document with a parsererror
                // element inside it instead of replacing the root.
                const real = new DOMParser().parseFromString(svg, 'image/svg+xml');
                vi.stubGlobal('DOMParser', class {
                    parseFromString() {
                        return {
                            documentElement: real.documentElement,
                            getElementsByTagName: () => [{}]
                        };
                    }
                });
                ui = new GameUI(stubParticles(), { safeIcons: true });
                ui.showAchievement({ icon: svg, name: 'A', xp: 1 });
                expect(popupIcon().querySelector('svg')).toBeNull();
                expect(popupIcon().textContent).toBe(svg);
            });

            it('should drop elements that are not in the svg namespace', () => {
                const root = render(wrap('<title xmlns="http://www.w3.org/1999/xhtml">x</title>'
                    + '<desc xmlns="http://www.w3.org/1999/xhtml">y</desc>'
                    + '<text xmlns="http://www.w3.org/1999/xhtml">z</text><circle r="1"/>'));
                expect(root.children.length).toBe(1);
                expect(root.textContent).toBe('');
            });

            it('should drop a url() stop-color', () => {
                const root = render(wrap('<stop stop-color="url(a)"/><stop stop-color="url(#a)"/>'));
                for (const stop of root.querySelectorAll('stop')) {
                    expect(stop.hasAttribute('stop-color')).toBe(false);
                }
            });

            it('should keep CDATA text', () => {
                const root = render(wrap('<text><![CDATA[a<b]]></text>'));
                expect(root.querySelector('text').textContent).toBe('a<b');
            });

            it('should drop the class attribute', () => {
                const root = render(wrap('<circle class="btn" r="1"/>'));
                expect(root.querySelector('circle').hasAttribute('class')).toBe(false);
            });

            it('should drop parenthesised values outside transforms and colours', () => {
                const root = render(wrap('<circle r="1" font-family="foo(bar)" transform="rotate(45) url(x)" '
                    + 'stop-color="rgb(1,2,3)"/><stop stop-color="rgb(1,2,3)"/>'
                    + '<g transform="translate(1, 2) scale(2)" fill="rgb(1, 2, 3)"/>'));
                const circle = root.querySelector('circle');
                expect(circle.hasAttribute('font-family')).toBe(false);
                expect(circle.hasAttribute('transform')).toBe(false);
                const g = root.querySelector('g');
                expect(g.getAttribute('transform')).toBe('translate(1, 2) scale(2)');
                expect(g.getAttribute('fill')).toBe('rgb(1, 2, 3)');
                expect(root.querySelector('stop').getAttribute('stop-color')).toBe('rgb(1,2,3)');
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
                const grad = root.querySelector('linearGradient');
                expect(grad.id).toMatch(/^dj-icon-\d+-grad$/);
                expect(root.querySelector('path').getAttribute('fill')).toBe(`url(#${grad.id})`);
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
