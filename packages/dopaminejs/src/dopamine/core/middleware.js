import { isRecord } from './store.js';

const PHASES = ['beforeXP', 'afterXP', 'beforeRecord', 'afterRecord', 'beforeUnlock', 'afterUnlock'];

export class Middleware {
    constructor() {
        this._list = [];
    }

    use(middleware) {
        if (!isRecord(middleware) || !PHASES.some((phase) => typeof middleware[phase] === 'function')) {
            throw new TypeError(`[DopamineJS] use expects an object with one of: ${PHASES.join(', ')}`);
        }
        this._list.push(middleware);
        return () => {
            const at = this._list.indexOf(middleware);
            if (at >= 0) this._list.splice(at, 1);
        };
    }

    /**
     * Run a before hook in `use` order. A hook may return a patch (merged
     * over the context, only for keys the context has), false to reject, or
     * nothing. A throwing hook is logged and skipped.
     * @returns {Promise<Object|false>} the context after patches, or false
     */
    async before(phase, context, accept = () => true) {
        for (const middleware of [...this._list]) {
            if (typeof middleware[phase] !== 'function') continue;
            let result;
            try {
                result = await middleware[phase](Object.freeze({ ...context }));
            } catch (error) {
                console.error(`[DopamineJS] ${phase} hook threw:`, error);
                continue;
            }
            if (result === false) return false;
            if (!isRecord(result)) continue;
            const next = { ...context };
            for (const key of Object.keys(context)) {
                if (Object.prototype.hasOwnProperty.call(result, key)) next[key] = result[key];
            }
            if (accept(next)) context = next;
        }
        return context;
    }

    async after(phase, context) {
        for (const middleware of [...this._list]) {
            if (typeof middleware[phase] !== 'function') continue;
            try {
                await middleware[phase](Object.freeze({ ...context }));
            } catch (error) {
                console.error(`[DopamineJS] ${phase} hook threw:`, error);
            }
        }
    }
}
