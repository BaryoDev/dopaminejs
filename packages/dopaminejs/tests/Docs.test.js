import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

function files() {
    const list = ['README.md', 'ARCHITECTURE.md', 'CLAUDE.md', 'demo.html'].map((f) => join(root, f));
    for (const f of readdirSync(join(root, 'docs'))) {
        if (f !== 'MIGRATION-3.0.md') list.push(join(root, 'docs', f));
    }
    list.push(...walk(join(root, 'examples')));
    for (const pkg of readdirSync(join(root, 'packages'))) {
        const readme = join(root, 'packages', pkg, 'README.md');
        if (existsSync(readme)) list.push(readme);
    }
    return list;
}

describe('docs', () => {
    it('no README, doc or example names Game, Scene, GameObject, kernel, ScreenShake or recordGame outside docs/MIGRATION-3.0.md', () => {
        const banned = /\b(Game|Scene|GameObject|kernel|ScreenShake|recordGame)\b/;
        const hits = [];
        for (const file of files()) {
            readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                if (banned.test(line)) hits.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
            });
        }
        expect(hits).toEqual([]);
    });

    it('has one migration guide', () => {
        expect(existsSync(join(root, 'docs/MIGRATION-3.0.md'))).toBe(true);
        expect(existsSync(join(root, 'docs/MIGRATION.md'))).toBe(false);
    });
});
