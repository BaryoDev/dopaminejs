import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';

// No module imports the stylesheet (importing the package must not touch the
// page), so it is copied to dist/style.css for `dopaminejs/style.css`.
const copyStyles = () => ({
    name: 'copy-styles',
    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: 'style.css',
            source: readFileSync(resolve(__dirname, 'src/dopamine/ui/dopamine.css'), 'utf8')
        });
    }
});

export default defineConfig({
    plugins: [copyStyles()],
    resolve: {
        alias: {
            // During tests, satellite packages that import 'dopaminejs' as a peer dep
            // should resolve to the local source, not a pre-built dist.
            dopaminejs: resolve(__dirname, 'src/index.js'),
        },
    },
    build: {
        lib: {
            // Two entry points: the root barrel and the browser-free
            // progression subpath (published as ./core).
            entry: {
                dopamine: resolve(__dirname, 'src/index.js'),
                core: resolve(__dirname, 'src/progression.js'),
            },
            name: 'Dopamine',
        },
        rollupOptions: {
            // Ensure external dependencies are not bundled into your library
            external: [],
            output: {
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
