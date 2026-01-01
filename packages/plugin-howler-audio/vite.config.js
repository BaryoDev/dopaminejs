import { defineConfig } from 'vite';
export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.js',
            name: 'HowlerAudioPlugin',
            formats: ['es', 'umd'],
            fileName: (format) => `index.${format === 'es' ? 'mjs' : 'umd.cjs'}`
        },
        rollupOptions: {
            external: ['dopaminejs', 'howler'],
            output: { globals: { dopaminejs: 'Dopamine', howler: 'Howler' } }
        }
    }
});
