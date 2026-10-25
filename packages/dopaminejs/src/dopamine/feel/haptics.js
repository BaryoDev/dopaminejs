/**
 * Short vibrations for hits and wins. A browser without the Vibration API
 * (iOS Safari) or one that blocks it is silent, never an error.
 */
export function createHaptics({ nav = globalThis.navigator, enabled = true } = {}) {
    let on = Boolean(enabled);
    const buzz = (pattern) => {
        if (!on || typeof nav?.vibrate !== 'function') return;
        try {
            nav.vibrate(pattern);
        } catch {}
    };
    return {
        tap: () => buzz(10),
        double: () => buzz([10, 40, 10]),
        setEnabled(value) {
            on = Boolean(value);
        },
    };
}
