/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { theme, Themes } from '../../dopaminejs-themes/src/index.js';
import { createTestHost, conformance } from '../src/testing.js';

let hosts = [];
afterEach(() => {
    for (const test of hosts) test.dispose();
    hosts = [];
});

const uiWithRoot = () => {
    const root = document.createElement('div');
    return { root, hud() {}, popup() {}, text() {}, destroy() {} };
};

const start = (plugin, ui = uiWithRoot(), host = {}) => {
    const test = createTestHost({ parts: { ui }, plugins: [plugin], ...host });
    hosts.push(test);
    return { test, ui };
};

describe('theme', () => {
    it('applies the variables to parts.ui.root', () => {
        const { ui } = start(theme('neon'));

        expect(ui.root.style.getPropertyValue('--dopamine-primary')).toBe(Themes.neon['--dopamine-primary']);
        expect(document.documentElement.style.getPropertyValue('--dopamine-primary'))
            .not.toBe(Themes.neon['--dopamine-primary']);
    });

    it('puts the old values back when disposed', () => {
        const ui = uiWithRoot();
        ui.root.style.setProperty('--dopamine-bg', 'red');
        const test = createTestHost({ parts: { ui } });
        hosts.push(test);

        const dispose = test.use(theme('neon'));
        expect(ui.root.style.getPropertyValue('--dopamine-bg')).toBe(Themes.neon['--dopamine-bg']);
        dispose();

        expect(ui.root.style.getPropertyValue('--dopamine-bg')).toBe('red');
        expect(ui.root.style.getPropertyValue('--dopamine-primary')).toBe('');
    });

    it('takes an object of variables and skips anything that is not a css variable', () => {
        const { ui } = start(theme({ '--dopamine-primary': '#123456', color: 'red', '--dopamine-x': 5 }));

        expect(ui.root.style.getPropertyValue('--dopamine-primary')).toBe('#123456');
        expect(ui.root.style.color).toBe('');
    });

    it('emits theme:changed', () => {
        const test = createTestHost({ parts: { ui: uiWithRoot() } });
        hosts.push(test);
        test.use(theme('retro'));

        expect(test.events.log.at(-1)).toEqual({ event: 'theme:changed', data: { theme: 'retro' } });
    });

    it('warns and applies nothing for an unknown name', () => {
        const warn = vi.fn();
        const { ui } = start(theme('__proto__'), uiWithRoot(), { log: { warn } });

        expect(warn).toHaveBeenCalledTimes(1);
        expect(ui.root.getAttribute('style')).toBeNull();
    });

    it('does nothing when the ui has no root', () => {
        expect(() => start(theme('neon'), { root: null, hud() {}, popup() {}, text() {}, destroy() {} })).not.toThrow();
    });
});

conformance.plugin(() => theme('cute'));
