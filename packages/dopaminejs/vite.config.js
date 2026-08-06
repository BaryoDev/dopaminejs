import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'Dopamine',
            fileName: 'dopamine'
        },
        rollupOptions: {
            // Ensure external dependencies are not bundled into your library
            external: [],
            output: {
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
