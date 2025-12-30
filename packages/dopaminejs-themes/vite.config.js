import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.js',
            name: 'DopamineThemes',
            formats: ['es', 'umd'],
            fileName: (format) => `themes.${format === 'es' ? 'mjs' : 'umd.cjs'}`
        },
        rollupOptions: {
            external: ['dopaminejs'],
            output: {
                globals: {
                    dopaminejs: 'Dopamine'
                }
            }
        }
    }
});
