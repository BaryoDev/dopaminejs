import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const script = join(root, 'scripts/wiki-recipes.js');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

const ALL_JS = /https:\/\/cdn\.jsdelivr\.net\/npm\/dopaminejs@([^/"]+)\/dist\/dopamine\.all\.global\.js"\s+integrity="([^"]+)"/;
const USAGE = 'Usage: node scripts/wiki-recipes.js <dir of a dopaminejs.wiki clone>';
const PINNED = [
    'Recipe-Video-Completion',
    'Recipe-Course-Certificate',
    'Recipe-Reading-Streak',
    'Recipe-Onboarding-Checklist',
    'Recipe-Form-Completion'
];

describe('wiki recipe generator', () => {
    let dir;

    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'wiki-recipes-'));
        execFileSync(process.execPath, [script, dir]);
    });

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('should write the seven recipe pages and nothing else', () => {
        expect(readdirSync(dir).sort()).toEqual([
            ...PINNED, 'Recipe-React', 'Recipe-Vue'
        ].map((name) => `${name}.md`).sort());
    });

    it('should pin the README version and all-in-one integrity in the five pinned pages', () => {
        const pin = readme.match(ALL_JS);
        expect(pin).not.toBeNull();
        for (const name of PINNED) {
            const text = readFileSync(join(dir, `${name}.md`), 'utf8');
            expect(text, name).toContain(`dopaminejs@${pin[1]}/`);
            expect(text, name).toContain(pin[2]);
        }
    });

    it('should write no version other than the README pin, and none in the React and Vue pages', () => {
        const pin = readme.match(ALL_JS)[1];
        for (const name of PINNED) {
            const text = readFileSync(join(dir, `${name}.md`), 'utf8');
            const versions = text.match(/\d+\.\d+\.\d+/g) ?? [];
            expect(versions.length, name).toBeGreaterThan(0);
            for (const version of versions) expect(version, name).toBe(pin);
        }
        for (const name of ['Recipe-React', 'Recipe-Vue']) {
            expect(readFileSync(join(dir, `${name}.md`), 'utf8').match(/\d+\.\d+\.\d+/), name).toBeNull();
        }
    });

    it('should exit 1 with no argument', () => {
        let error;
        try {
            execFileSync(process.execPath, [script], { stdio: 'pipe' });
        } catch (e) {
            error = e;
        }
        expect(error).toBeDefined();
        expect(error.status).toBe(1);
        expect(String(error.stderr)).toContain(USAGE);
    });

    it('should exit 1 with the usage line for a folder that does not exist', () => {
        let error;
        try {
            execFileSync(process.execPath, [script, join(dir, 'missing')], { stdio: 'pipe' });
        } catch (e) {
            error = e;
        }
        expect(error).toBeDefined();
        expect(error.status).toBe(1);
        expect(String(error.stderr)).toContain(USAGE);
    });

    it('should define progress in every js block that uses it', () => {
        for (const file of readdirSync(dir)) {
            const text = readFileSync(join(dir, file), 'utf8');
            // A bare `progress`, not the host.progress property.
            for (const block of text.matchAll(/```js\n(.*?)\n```/gs)) {
                if (/(?<![.\w])progress\b/.test(block[1])) expect(block[1], file).toContain('const progress =');
            }
        }
    });
});
