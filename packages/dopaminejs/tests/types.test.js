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
    it('should declare exactly the 3.0 runtime exports', () => {
        // Also guards against the regex silently matching nothing.
        expect(declaredRuntimeExports().slice().sort()).toEqual([
            'DataService', 'DopamineError', 'EventEmitter', 'HOST_API', 'ParticleSystem',
            'RewardSystem', 'RewardUI', 'SoundManager', 'createDopamine', 'createHaptics',
            'createMemoryStorage', 'merge', 'prefersReducedMotion', 'resolveStorage', 'validate'
        ]);
    });

    it('should not declare any runtime export the module does not have', () => {
        const missing = declaredRuntimeExports().filter((name) => !(name in api));

        expect(missing, `declared in index.d.ts but not exported: ${missing.join(', ')}`)
            .toEqual([]);
    });

    it('should declare every value the module exports', () => {
        const declared = new Set(declaredRuntimeExports());
        const undeclared = Object.keys(api)
            .filter((name) => !declared.has(name));

        expect(undeclared, `exported but missing from index.d.ts: ${undeclared.join(', ')}`)
            .toEqual([]);
    });

    it('should have no default export', () => {
        expect(api.default).toBeUndefined();
    });
});

describe('certificate type declarations', () => {
    it('declare exactly what dopaminejs/certificate exports', async () => {
        const text = readFileSync(join(here, '../types/certificate.d.ts'), 'utf8');
        const declared = [...text.matchAll(/^export\s+(?:declare\s+)?(?:class|const|function)\s+([A-Za-z_$][\w$]*)/gm)]
            .map((match) => match[1]);
        const mod = await import('../src/certificate.js');

        expect(declared.length).toBeGreaterThan(0);
        expect(declared.slice().sort()).toEqual(Object.keys(mod).sort());
    });
});
