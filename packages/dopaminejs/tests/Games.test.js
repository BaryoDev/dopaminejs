/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameFeedback } from '../src/games.js';
import { createTestHost } from '../src/testing.js';

const make = (options, host = {}) => {
    const games = gameFeedback(options);
    const test = createTestHost({ plugins: [games], ...host });
    hosts.push(test);
    return { games, test };
};

let hosts = [];

afterEach(() => {
    for (const test of hosts) test.dispose();
    hosts = [];
    document.body.innerHTML = '';
});

describe('gameFeedback', () => {
    it('combo draws through parts.ui and parts.particles', () => {
        const { games, test } = make();
        games.combo(3, 10, 20);
        expect(test.texts).toEqual([{ text: '3× COMBO!', x: 10, y: 20, color: '#ff6b6b', size: '32px' }]);
        expect(test.bursts).toEqual([{ kind: 'fire', at: { x: 10, y: 20 }, opts: { count: 20 } }]);
    });

    it('luckyMoment shows the multiplier and bursts stars and confetti', () => {
        const { games, test } = make();
        games.luckyMoment(5, 1, 2);
        expect(test.texts[0].text).toBe('LUCKY 5×!');
        expect(test.bursts.map((b) => b.kind)).toEqual(['stars', 'confetti']);
    });

    it('nearMiss shows the configured text', () => {
        const { games, test } = make({ text: { nearMiss: 'So close' } });
        games.nearMiss(4, 5);
        expect(test.texts[0].text).toBe('So close');
        expect(test.bursts[0].kind).toBe('sparkle');
    });

    it('an empty text hides the floating text and keeps the burst', () => {
        const { games, test } = make({ text: { combo: '' } });
        games.combo(2, 0, 0);
        expect(test.texts).toEqual([]);
        expect(test.bursts).toHaveLength(1);
    });

    it('ignores a text option that is not a string', () => {
        const { games, test } = make({ text: { combo: 5, gameOver: null } });
        games.combo(2, 0, 0);
        expect(test.texts[0].text).toBe('2× COMBO!');
    });

    it('works without a particles part', () => {
        const { games, test } = make({}, { parts: { particles: false } });
        games.combo(2, 0, 0);
        expect(test.texts).toHaveLength(1);
    });

    it('summary text option replaces Game Over', () => {
        const { games } = make({ text: { gameOver: 'Run over', playAgain: 'Again' } });
        const box = games.summary({ score: 120, metrics: { Coins: 4 } });
        expect(box.querySelector('h1').textContent).toBe('Run over');
        expect(box.querySelector('div').textContent).toBe('120');
        expect(box.querySelector('.btn').textContent).toBe('Again');
        expect(box.textContent).toContain('Coins:');
    });

    it('an empty summary heading hides it', () => {
        const { games } = make({ text: { gameOver: '' } });
        const box = games.summary({ score: 1 });
        expect(box.querySelector('h1')).toBeNull();
    });

    it('summary wires replay and exit with listeners', () => {
        const { games } = make();
        let replayed = 0;
        let exited = 0;
        const box = games.summary({ score: 1, onReplay: () => { replayed += 1; }, onExit: () => { exited += 1; } });
        const [replay, exit] = box.querySelectorAll('.btn');
        replay.click();
        exit.click();
        expect([replayed, exited]).toEqual([1, 1]);
        expect(box.innerHTML).not.toContain('onclick');
    });

    it('summary shows the score as text, not markup', () => {
        const { games } = make();
        const box = games.summary({ score: '<img src=x onerror=alert(1)>', metrics: { '<b>': '<i>' } });
        expect(box.querySelector('img')).toBeNull();
        expect(box.querySelector('b')).toBeNull();
    });

    it('the plugin throws plugin_requires without a ui part', () => {
        let code = null;
        try {
            createTestHost({ parts: { ui: false }, plugins: [gameFeedback()] });
        } catch (error) {
            code = error.code;
        }
        expect(code).toBe('plugin_requires');
    });

    it('registers the game sound keys', () => {
        const { test } = make();
        expect([...test.soundKeys].sort()).toEqual(['gameover', 'jump', 'score']);
    });

    it('dispose removes the sound keys and the DOM it added', () => {
        const { games, test } = make();
        games.summary({ score: 1 });
        expect(document.querySelector('.message-box')).not.toBeNull();

        test.dispose();
        expect(test.soundKeys.size).toBe(0);
        expect(document.querySelector('.message-box')).toBeNull();

        games.combo(1, 0, 0);
        expect(test.texts).toEqual([]);
    });

    it('importing dopaminejs does not include the games entry', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const seen = new Set();
        const walk = (file) => {
            if (seen.has(file)) return;
            seen.add(file);
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/(?:from|import)\s+['"](\.[^'"]+\.js)['"]/g)) {
                walk(resolve(dirname(file), match[1]));
            }
        };
        walk(resolve(here, '../src/index.js'));
        const names = [...seen].map((file) => file.slice(resolve(here, '../src').length));
        expect(names).not.toContain('/games.js');
        expect(names).not.toContain('/testing.js');
        expect(readFileSync(resolve(here, '../src/index.js'), 'utf8')).not.toMatch(/gameFeedback|testing/);
    });
});
