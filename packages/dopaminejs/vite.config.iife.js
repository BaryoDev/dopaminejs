import { defineConfig } from 'vite';
import { resolve } from 'path';

// The script tag build: one file, no module loader, `window.Dopamine` holds
// the named exports. Run after the main build, which owns dist/ and
// style.css, so this one must not empty the folder.
export default defineConfig({
    publicDir: false,
    build: {
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'Dopamine',
            formats: ['iife'],
            fileName: () => 'dopamine.global.js'
        },
        rollupOptions: {
            output: { exports: 'named' }
        }
    }
});
