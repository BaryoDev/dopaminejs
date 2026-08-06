/**
 * Storage resolution for environments that may not have localStorage.
 *
 * Three cases need to work:
 *  - Browser: localStorage.
 *  - SSR / worker / test runner: no `window` at all, so importing the package
 *    must not throw at module or constructor time.
 *  - Safari private browsing and storage-blocked iframes: localStorage exists
 *    but every write throws QuotaExceededError.
 */

/**
 * A Storage-shaped object backed by a Map. Values do not survive a reload,
 * which is the correct degradation: the game runs, progress just is not kept.
 *
 * @returns {{getItem: Function, setItem: Function, removeItem: Function, clear: Function}}
 */
export function createMemoryStorage() {
    const map = new Map();

    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); },
        removeItem: (key) => { map.delete(key); },
        clear: () => { map.clear(); }
    };
}

/**
 * Return localStorage if it is present and writable, otherwise a memory store.
 *
 * @returns {Object} Storage-shaped object
 */
export function resolveStorage() {
    try {
        if (typeof localStorage === 'undefined') {
            return createMemoryStorage();
        }

        // Presence is not enough: blocked contexts throw only on write.
        const probe = '__dopamine_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);

        return localStorage;
    } catch {
        return createMemoryStorage();
    }
}
