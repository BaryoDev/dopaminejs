import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'DopamineVue',
            formats: ['es', 'cjs'],
            fileName: format => (format === 'es' ? 'index.js' : 'index.cjs'),
        },
        rollupOptions: {
            // vue and dopaminejs are peer dependencies, never bundle them
            external: ['vue', 'dopaminejs'],
            output: {
                exports: 'named',
            },
        },
    },
});
