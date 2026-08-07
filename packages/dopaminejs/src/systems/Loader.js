import { deprecatedGlobal } from './deprecate.js';

/**
 * Asset Loader
 * Loads and caches images, audio, etc.
 */
export class Loader {
    constructor() {
        this.assets = new Map();
        this.kernel = null;
    }

    /**
     * ISystem interface - called when registered
     */
    init(kernel) {
        this.kernel = kernel;
    }

    /**
     * ISystem interface - cleanup
     */
    destroy() {
        this.assets.clear();
    }

    async loadImage(key, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.assets.set(key, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    get(key) {
        return this.assets.get(key);
    }
}

// DEPRECATED: kept for v1 compatibility. Warns on first use, not on import.
export const GlobalLoader = deprecatedGlobal(
    new Loader(),
    '[DopamineJS] GlobalLoader is deprecated. Use kernel.loader instead.'
);
