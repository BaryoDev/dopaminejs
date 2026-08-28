import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'DopamineReact',
        },
        rollupOptions: {
            // react and dopaminejs are peer dependencies — never bundle them
            external: ['react', 'react/jsx-runtime', 'dopaminejs'],
            output: {
                exports: 'named',
                globals: {
                    react: 'React',
                    dopaminejs: 'Dopamine',
                },
            },
        },
    },
});
