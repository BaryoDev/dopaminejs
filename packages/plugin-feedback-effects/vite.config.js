import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'DopamineFeedbackEffects',
            fileName: (format) => `plugin-feedback-effects.${format}.js`
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
