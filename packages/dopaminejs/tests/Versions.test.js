import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const script = join(root, 'scripts/check-versions.js');

const manifests = readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => JSON.parse(readFileSync(join(root, 'packages', entry.name, 'package.json'), 'utf8')));
const core = manifests.find((pkg) => pkg.name === 'dopaminejs');

const run = (cwd) => spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });

function fixture(peerRange) {
    const dir = mkdtempSync(join(tmpdir(), 'versions-'));
    const make = (folder, pkg) => {
        mkdirSync(join(dir, 'packages', folder), { recursive: true });
        writeFileSync(join(dir, 'packages', folder, 'LICENSE'), 'MPL-2.0');
        writeFileSync(
            join(dir, 'packages', folder, 'package.json'),
            JSON.stringify({ license: 'MPL-2.0', repository: 'x', ...pkg })
        );
    };
    make('core', { name: 'dopaminejs', version: '3.0.0' });
    make('plugin', { name: 'dopaminejs-plugin-x', version: '2.0.0', peerDependencies: { dopaminejs: peerRange } });
    return dir;
}

describe('scripts/check-versions.js', () => {
    it('fails when a peer range excludes the core version', () => {
        const dir = fixture('^2.5.0');
        try {
            const result = run(dir);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain('peerDependencies.dopaminejs "^2.5.0" does not accept');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('passes when every public package accepts it', () => {
        const dir = fixture('^3.0.0');
        try {
            expect(run(dir).status).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const real = run(root);
        expect(real.stderr).toBe('');
        expect(real.status).toBe(0);
    });
});

describe('release manifests', () => {
    it('tag version equals the core package version', () => {
        const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        expect(rootPkg.version).toBe(core.version);
        if (process.env.GITHUB_REF_TYPE === 'tag') {
            expect(process.env.GITHUB_REF_NAME).toBe(`v${core.version}`);
        }
        expect(`v${core.version}`).toBe('v3.1.0');
    });

    it('the public package set matches the expected list', () => {
        const publicNames = manifests.filter((pkg) => !pkg.private).map((pkg) => pkg.name).sort();
        expect(publicNames).toEqual([
            'dopaminejs',
            'dopaminejs-plugin-debug-overlay',
            'dopaminejs-plugin-ecosystem',
            'dopaminejs-plugin-howler-audio',
            'dopaminejs-plugin-sound-packs',
            'dopaminejs-plugin-webgl-particles',
            'dopaminejs-react',
            'dopaminejs-themes'
        ]);
    });
});
