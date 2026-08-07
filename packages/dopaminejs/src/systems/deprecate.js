/**
 * Deprecation helper for the v1 global singletons.
 *
 * These used to warn at module scope, which meant importing the package
 * printed a warning for every legacy global whether or not the consumer
 * touched one. A deprecation notice should cost you something only when you
 * use the deprecated thing, otherwise it is just noise that trains people to
 * ignore warnings.
 *
 * @param {Object} instance - The real system to delegate to
 * @param {string} message - Warning text, emitted once on first use
 * @returns {Object} A proxy that warns on first property access
 */
export function deprecatedGlobal(instance, message) {
    let warned = false;

    return new Proxy(instance, {
        get(target, prop, receiver) {
            if (!warned) {
                warned = true;
                console.warn(message);
            }

            const value = Reflect.get(target, prop, receiver);
            // Methods must stay bound to the real instance, not the proxy,
            // or internal `this` access re-enters the trap on every field.
            return typeof value === 'function' ? value.bind(target) : value;
        },

        set(target, prop, value) {
            if (!warned) {
                warned = true;
                console.warn(message);
            }
            return Reflect.set(target, prop, value);
        }
    });
}
