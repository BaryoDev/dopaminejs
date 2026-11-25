import { defineConfig } from 'vite';
import { resolve } from 'path';

// The all-in-one script tag build: the main entry, celebrate, the certificate
// and auto in one file, `window.Dopamine` holds the named exports. Run after
// the main build, which owns dist/ and style.css, so this one must not empty
// the folder.
export default defineConfig({
    publicDir: false,
    build: {
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, 'src/all.js'),
            name: 'Dopamine',
            formats: ['iife'],
            fileName: () => 'dopamine.all.global.js'
        },
        rollupOptions: {
            output: { exports: 'named' }
        }
    }
});
