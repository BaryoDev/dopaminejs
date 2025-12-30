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
    }
});
