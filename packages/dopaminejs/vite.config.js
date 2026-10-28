import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';
import { copySpec } from '../../scripts/copy-spec.js';

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

// The package ships spec/ so another runtime can pin a version and read the
// fixtures. The copy is git-ignored and made on every build.
const copySpecFiles = () => ({
    name: 'copy-spec',
    apply: 'build',
    buildStart() {
        copySpec();
    }
});

export default defineConfig({
    plugins: [copyStyles(), copySpecFiles()],
    resolve: {
        alias: {
            // During tests, satellite packages that import 'dopaminejs' as a peer dep
            // should resolve to the local source, not a pre-built dist.
            dopaminejs: resolve(__dirname, 'src/index.js'),
        },
    },
    build: {
        lib: {
            // The root barrel, the browser-free progression subpath
            // (./core), and the games and testing subpaths.
            entry: {
                dopamine: resolve(__dirname, 'src/index.js'),
                core: resolve(__dirname, 'src/progression.js'),
                games: resolve(__dirname, 'src/games.js'),
                testing: resolve(__dirname, 'src/testing.js'),
            },
            name: 'Dopamine',
        },
        rollupOptions: {
            // The testing entry uses the consumer's vitest and Node's fs.
            external: ['vitest', /^node:/],
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
