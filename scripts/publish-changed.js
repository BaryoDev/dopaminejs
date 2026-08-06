#!/usr/bin/env node
/**
 * Publish every workspace package whose version is not yet on npm.
 *
 * Idempotent by design: re-running after a partial failure republishes only
 * what is still missing, so a flaky network on package 5 of 8 does not need
 * manual cleanup. Version bumps are the release signal; this script never
 * edits a version itself.
 *
 * Auth comes from npm Trusted Publishing (OIDC) in CI, so no token is read.
 *
 * Flags:
 *   --dry-run   report what would publish, publish nothing
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const PACKAGES_DIR = 'packages';

/** @returns {string} stdout, trimmed */
const run = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();

/**
 * Versions already on the registry for a package name.
 * @returns {string[]} empty if the package has never been published
 */
function publishedVersions(name) {
    try {
        return JSON.parse(run('npm', ['view', name, 'versions', '--json']));
    } catch {
        // E404 for a brand-new package is the expected path, not an error.
        return [];
    }
}

const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES_DIR, entry.name))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => ({ dir, pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
    .filter(({ pkg }) => !pkg.private);

const toPublish = [];
const skipped = [];

for (const { dir, pkg } of packages) {
    const versions = publishedVersions(pkg.name);

    if (versions.includes(pkg.version)) {
        skipped.push(`${pkg.name}@${pkg.version} (already on npm)`);
    } else {
        toPublish.push({ dir, name: pkg.name, version: pkg.version, isNew: versions.length === 0 });
    }
}

console.log('Skipping:');
console.log(skipped.length ? skipped.map((s) => `  - ${s}`).join('\n') : '  (nothing)');

console.log('\nPublishing:');
console.log(
    toPublish.length
        ? toPublish.map((p) => `  - ${p.name}@${p.version}${p.isNew ? ' (first release)' : ''}`).join('\n')
        : '  (nothing)'
);

if (toPublish.length === 0) {
    console.log('\nNothing to do.');
    process.exit(0);
}

if (DRY_RUN) {
    console.log('\n--dry-run: stopping before publish.');
    process.exit(0);
}

const failures = [];

for (const { dir, name, version } of toPublish) {
    console.log(`\n>>> npm publish ${name}@${version}`);
    try {
        // --access public: these are unscoped, but being explicit keeps the
        // intent obvious and survives a future move to a scope.
        //
        // No --provenance: under Trusted Publishing npm attaches provenance
        // automatically. Passing it explicitly makes npm sign before it has
        // established credentials, which buries the real auth failure under a
        // successful-looking signing step.
        execFileSync('npm', ['publish', '--access', 'public'], {
            cwd: dir,
            stdio: 'inherit'
        });
    } catch (error) {
        // Keep going: one failure should not block the packages after it.
        console.error(`!!! ${name}@${version} failed: ${error.message}`);
        failures.push(`${name}@${version}`);
    }
}

if (failures.length > 0) {
    console.error(`\n${failures.length} package(s) failed: ${failures.join(', ')}`);
    console.error('Re-run the workflow; already-published packages are skipped.');
    process.exit(1);
}

console.log(`\nPublished ${toPublish.length} package(s).`);
