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
        // Pinned to a non-UTC zone so date handling is exercised the way real
        // players experience it. CI runners default to UTC, which hides
        // local-vs-UTC calendar bugs entirely.
        env: {
            TZ: 'Asia/Manila'
        }
    }
});
