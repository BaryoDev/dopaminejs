import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'DopamineReact',
            formats: ['es', 'cjs'],
            fileName: format => (format === 'es' ? 'index.js' : 'index.cjs'),
        },
        rollupOptions: {
            // react and dopaminejs are peer dependencies, never bundle them
            external: ['react', 'react/jsx-runtime', 'dopaminejs'],
            output: {
                exports: 'named',
            },
        },
    },
});
