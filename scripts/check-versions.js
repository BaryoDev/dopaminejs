#!/usr/bin/env node
/**
 * Sanity checks the workspace before a release can happen.
 *
 * Run in CI on every push so a malformed manifest is caught at PR time rather
 * than halfway through a publish, when some packages are already live.
 *
 * Pass --dist (after a build) to also verify that every declared entry point
 * actually exists. dopaminejs-themes@1.0.0 shipped with main pointing at
 * themes.umd.js while the build emitted themes.umd.cjs, so every require() of
 * it failed; nothing in the pipeline noticed.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/;
const CHECK_DIST = process.argv.includes('--dist');

const problems = [];

/**
 * Every relative path a consumer can resolve: main, module, style, and each
 * leaf of the exports map.
 *
 * @param {Object} pkg
 * @returns {Array<{field: string, path: string}>}
 */
function entryPoints(pkg) {
    const found = [];

    for (const field of ['main', 'module', 'style', 'browser', 'types']) {
        if (typeof pkg[field] === 'string') {
            found.push({ field, path: pkg[field] });
        }
    }

    const walk = (node, trail) => {
        if (typeof node === 'string') {
            found.push({ field: `exports${trail}`, path: node });
            return;
        }
        if (node && typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
                walk(value, `${trail}["${key}"]`);
            }
        }
    };
    walk(pkg.exports, '');

    return found.filter((entry) => entry.path.startsWith('.'));
}

/**
 * An exports pattern such as "./spec/*" must match at least one file.
 */
function patternMatches(base, rel) {
    const dir = join(base, rel.slice(0, rel.indexOf('*')));
    return existsSync(dir) && statSync(dir).isDirectory() && readdirSync(dir).length > 0;
}

/**
 * Does a simple range accept a version? Handles exact, ^x.y.z, >=x.y.z and *.
 * Anything else counts as not accepting, so a new range style fails loudly.
 *
 * @param {string} range
 * @param {string} version
 * @returns {boolean}
 */
function accepts(range, version) {
    const parse = (text) => text.split('-')[0].split('.').map(Number);
    const v = parse(version);
    const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    if (range === '*') return true;
    const match = /^(\^|>=)?(\d+\.\d+\.\d+)$/.exec(range);
    if (!match) return false;
    const base = parse(match[2]);
    if (!match[1]) return cmp(v, base) === 0;
    if (cmp(v, base) < 0) return false;
    if (match[1] === '>=') return true;
    return base[0] > 0 ? v[0] === base[0] : v[0] === 0 && v[1] === base[1];
}

const manifests = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
        const path = join(PACKAGES_DIR, entry.name, 'package.json');
        return existsSync(path)
            ? { dir: entry.name, path, pkg: JSON.parse(readFileSync(path, 'utf8')) }
            : null;
    })
    .filter(Boolean);

if (manifests.length === 0) {
    problems.push('No package manifests found under packages/');
}

const seen = new Map();
const versions = new Map(manifests.filter(({ pkg }) => pkg.name).map(({ pkg }) => [pkg.name, pkg.version]));

for (const { dir, path, pkg } of manifests) {
    if (!pkg.name) {
        problems.push(`${path}: missing "name"`);
        continue;
    }

    if (seen.has(pkg.name)) {
        problems.push(`${pkg.name}: declared by both ${seen.get(pkg.name)} and ${dir}`);
    }
    seen.set(pkg.name, dir);

    if (pkg.private) continue;

    if (!SEMVER.test(pkg.version || '')) {
        problems.push(`${pkg.name}: version "${pkg.version}" is not semver`);
    }

    if (!pkg.license) {
        problems.push(`${pkg.name}: missing "license"`);
    }

    if (!existsSync(join(PACKAGES_DIR, dir, 'LICENSE'))) {
        problems.push(`${pkg.name}: no LICENSE file in ${PACKAGES_DIR}/${dir}/`);
    }

    if (!pkg.repository) {
        // npm requires a repository field to attach provenance.
        problems.push(`${pkg.name}: missing "repository" (required for provenance)`);
    }

    if (CHECK_DIST) {
        for (const { field, path: rel } of entryPoints(pkg)) {
            const base = join(PACKAGES_DIR, dir);
            const found = rel.includes('*') ? patternMatches(base, rel) : existsSync(join(base, rel));
            if (!found) {
                problems.push(`${pkg.name}: "${field}" points at ${rel}, which the build does not emit`);
            }
        }
    }

    // A workspace package must never depend on a sibling by "*" or "workspace:*"
    // at publish time; consumers cannot resolve those.
    for (const field of ['dependencies', 'peerDependencies']) {
        for (const [dep, range] of Object.entries(pkg[field] || {})) {
            if (seen.has(dep) && /^(\*|workspace:)/.test(range)) {
                problems.push(`${pkg.name}: ${field}.${dep} uses unpublishable range "${range}"`);
            }
        }
    }

    // A peer range must accept the sibling version in this same tree, or a
    // release installs a plugin that the core it ships with rejects.
    for (const [dep, range] of Object.entries(pkg.peerDependencies || {})) {
        if (versions.has(dep) && !accepts(range, versions.get(dep))) {
            problems.push(`${pkg.name}: peerDependencies.${dep} "${range}" does not accept ${dep}@${versions.get(dep)} in this tree`);
        }
    }
}

if (problems.length > 0) {
    console.error('Package manifest problems:\n');
    for (const problem of problems) {
        console.error(`  - ${problem}`);
    }
    process.exit(1);
}

console.log(`Checked ${manifests.length} package manifests, all publishable.`);
