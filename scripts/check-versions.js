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

import { readdirSync, readFileSync, existsSync } from 'node:fs';
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
            if (!existsSync(join(PACKAGES_DIR, dir, rel))) {
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
}

if (problems.length > 0) {
    console.error('Package manifest problems:\n');
    for (const problem of problems) {
        console.error(`  - ${problem}`);
    }
    process.exit(1);
}

console.log(`Checked ${manifests.length} package manifests, all publishable.`);
