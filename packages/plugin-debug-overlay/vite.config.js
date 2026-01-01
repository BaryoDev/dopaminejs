import { defineConfig } from 'vite';
export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.js',
            name: 'DebugOverlayPlugin',
            formats: ['es', 'umd'],
            fileName: (format) => `index.${format === 'es' ? 'mjs' : 'umd.cjs'}`
        },
        rollupOptions: {
            external: ['dopaminejs'],
            output: { globals: { dopaminejs: 'Dopamine' } }
        }
    }
});
