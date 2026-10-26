const NO_PREFERENCE = Object.freeze({ matches: false });

/**
 * The reduced-motion media query, or `{ matches: false }` where there is no
 * matchMedia (SSR, tests). The live query updates when the user changes it.
 */
export function prefersReducedMotion(win = globalThis.window) {
    return (typeof win?.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)')) || NO_PREFERENCE;
}
