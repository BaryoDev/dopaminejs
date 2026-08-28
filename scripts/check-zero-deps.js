#!/usr/bin/env node
/**
 * Verifies that packages/dopaminejs/package.json has an empty (or absent) `dependencies` field.
 *
 * DopamineJS ships zero runtime dependencies. A contributor reaching for a convenient
 * dependency passes all tests today; this script makes that a CI failure instead.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '../packages/dopaminejs/package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const deps = pkg.dependencies;

if (deps && Object.keys(deps).length > 0) {
    console.error('❌ Zero-dependency promise broken!');
    console.error('   packages/dopaminejs/package.json has runtime dependencies:');
    for (const [name, version] of Object.entries(deps)) {
        console.error(`     - ${name}: ${version}`);
    }
    console.error('');
    console.error('   The core package must ship with zero runtime dependencies.');
    console.error('   Move any new runtime dep to peerDependencies or a satellite plugin package.');
    process.exit(1);
}

console.log('✓ Zero dependencies confirmed — packages/dopaminejs has no runtime dependencies.');
