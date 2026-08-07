/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as api from '../src/index.js';

/**
 * A .d.ts can promise anything; tsc only checks it against itself. This
 * compares the declared runtime exports to what the module actually exports,
 * so declarations cannot drift away from the implementation unnoticed.
 */
const here = dirname(fileURLToPath(import.meta.url));
const declarations = readFileSync(join(here, '../types/index.d.ts'), 'utf8');

/** Names the .d.ts claims exist at runtime. Types and interfaces are excluded. */
const declaredRuntimeExports = () => {
    const names = new Set();
    const pattern = /^export\s+(?:declare\s+)?(?:abstract\s+)?(class|const|function)\s+([A-Za-z_$][\w$]*)/gm;

    let match;
    while ((match = pattern.exec(declarations)) !== null) {
        names.add(match[2]);
    }
    return [...names];
};

describe('type declarations', () => {
    it('should declare a non-trivial number of runtime exports', () => {
        // Guards against the regex silently matching nothing and the suite
        // passing vacuously.
        expect(declaredRuntimeExports().length).toBeGreaterThan(20);
    });

    it('should not declare any runtime export the module does not have', () => {
        const missing = declaredRuntimeExports().filter((name) => !(name in api));

        expect(missing, `declared in index.d.ts but not exported: ${missing.join(', ')}`)
            .toEqual([]);
    });

    it('should declare every value the module exports', () => {
        const declared = new Set(declaredRuntimeExports());
        const undeclared = Object.keys(api)
            .filter((name) => name !== 'default')
            .filter((name) => !declared.has(name));

        expect(undeclared, `exported but missing from index.d.ts: ${undeclared.join(', ')}`)
            .toEqual([]);
    });

    it('should have a default export, as declared', () => {
        expect(typeof api.default).toBe('function');
    });
});
