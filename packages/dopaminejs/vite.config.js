import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    resolve: {
        alias: {
            // During tests, satellite packages that import 'dopaminejs' as a peer dep
            // should resolve to the local source, not a pre-built dist.
            dopaminejs: resolve(__dirname, 'src/index.js'),
        },
    },
    build: {
        lib: {
            // Two entry points: the root barrel and the engine-only subpath.
            entry: {
                dopamine: resolve(__dirname, 'src/index.js'),
                engine: resolve(__dirname, 'src/engine.js'),
            },
            name: 'Dopamine',
        },
        rollupOptions: {
            // Ensure external dependencies are not bundled into your library
            external: [],
            output: {
                // The barrel re-exports everything as named exports and also has a default
                // export for v1.x compat. Setting 'named' tells Rollup that named imports
                // are the primary surface, which silences the "named and default exports
                // together" warning without changing the published API shape.
                exports: 'named',
                globals: {}
            }
        }
    },
    test: {
        // The suite must run in a non-UTC zone or the streak date tests are
        // vacuous. That is set at process start by scripts/run-tests.js, not
        // here: `test.env` is applied after Node has cached the zone.
        globals: false
    }
});
