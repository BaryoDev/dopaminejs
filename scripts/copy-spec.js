#!/usr/bin/env node
/**
 * Copies the root spec/ into the package so the npm tarball carries it. The
 * copy is built, never committed (see .gitignore).
 */
import { cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const SPEC_SOURCE = resolve(here, '../spec');
export const SPEC_TARGET = resolve(here, '../packages/dopaminejs/spec');

export function copySpec(from = SPEC_SOURCE, to = SPEC_TARGET) {
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    copySpec();
}
