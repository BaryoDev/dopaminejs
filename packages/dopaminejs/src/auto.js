/**
 * The `dopaminejs/auto` subpath: rewards from HTML data attributes. Importing
 * it does nothing. `auto({ host })` reads `data-dopamine-*` attributes from the
 * page and sends XP, achievements, a celebration or a certificate through a
 * host made by createDopamine(). Nothing in the main entry imports it, and it
 * imports nothing statically: celebrate and certificate load on demand.
 */

// Options come from callers and attributes come from the page, so an inherited
// property must not count. A local copy: importing hasOwn from core/store.js
// splits a shared chunk and grows the main bundles.
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const ON = 'data-dopamine-on';
const SELECTOR = `[${ON}]`;
const SENTINEL = 'data-dopamine-sentinel';
const CERTIFICATE_FIELDS = ['title', 'recipient', 'date', 'issuer', 'logo'];
const DEFAULT_MAX_XP = 1000;

// Once per page load, so these outlive destroyAuto() and a later auto().
const fired = new WeakSet();
const warned = new WeakSet();

// What the active auto() made, until destroyAuto().
let active = null;

const quote = (value) => JSON.stringify(String(value).slice(0, 40));

// At most one warning per element, so a page of bad markup stays quiet.
function warn(el, message) {
    if (warned.has(el)) return;
    warned.add(el);
    console.warn(`[DopamineJS] ${message}`);
}

const failed = (what) => (error) => console.warn(`[DopamineJS] ${what} failed`, error);

function remove(state, el) {
    const own = state.own.get(el);
    if (!own) return;
    state.own.delete(el);
    state.watch.delete(own.node);
    state.io?.unobserve(own.node);
    own.sentinel?.remove();
}

function act(state, el) {
    const { host, maxXP } = state;

    const rawXP = el.getAttribute('data-dopamine-xp');
    if (rawXP !== null) {
        const text = rawXP.trim();
        if (!/^\d+$/.test(text) || Number(text) > maxXP) {
            warn(el, `data-dopamine-xp ${quote(rawXP)} is not a whole number up to ${maxXP}`);
        } else if (Number(text) > 0) {
            const amount = Number(text);
            Promise.resolve(host.ready).then(() => host.progress.addXP(amount)).catch(failed('addXP'));
        }
    }

    const id = el.getAttribute('data-dopamine-achievement');
    if (id !== null) {
        const table = host.progress.achievements;
        if (table === null || typeof table !== 'object' || !hasOwn(table, id)) {
            warn(el, `data-dopamine-achievement ${quote(id)} is not an achievement of this host`);
        } else {
            Promise.resolve(host.ready).then(() => host.progress.unlockAchievement(id)).catch(failed('unlockAchievement'));
        }
    }

    let certificate;
    for (const field of CERTIFICATE_FIELDS) {
        const value = el.getAttribute(`data-dopamine-certificate-${field}`);
        if (value !== null) (certificate ??= {})[field] = value;
    }

    const preset = el.getAttribute('data-dopamine-celebrate');
    if (preset !== null) {
        const options = { parts: host.parts, target: el };
        if (certificate) options.certificate = certificate;
        import('./celebrate.js').then((m) => m.celebrate(preset, options)).catch(failed('celebrate'));
    } else if (certificate) {
        import('./certificate.js').then((m) => m.showCertificate(certificate)).catch(failed('showCertificate'));
    }
}

function fire(state, el) {
    if (!el.hasAttribute('data-dopamine-repeat')) {
        // Marked before anything async, so a double click awards once.
        if (fired.has(el)) return;
        fired.add(el);
        remove(state, el);
    }
    act(state, el);
}

function track(state, el) {
    if (state.own.has(el)) return;
    const trigger = el.getAttribute(ON);
    if (trigger === 'click' || trigger === 'submit' || trigger === 'ended') return;
    if (trigger !== 'read' && trigger !== 'visible') {
        warn(el, `${ON} ${quote(trigger)} is not click, submit, ended, read or visible`);
        return;
    }
    if (!state.io) {
        if (!state.noObserver) {
            state.noObserver = true;
            console.warn('[DopamineJS] IntersectionObserver is missing, so read and visible are skipped');
        }
        return;
    }
    if (fired.has(el) && !el.hasAttribute('data-dopamine-repeat')) return;
    let node = el;
    let sentinel = null;
    if (trigger === 'read') {
        sentinel = el.ownerDocument.createElement('span');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.setAttribute(SENTINEL, '');
        sentinel.style.cssText = 'display:block;height:1px;width:1px';
        el.appendChild(sentinel);
        node = sentinel;
    }
    state.own.set(el, { node, sentinel });
    state.watch.set(node, el);
    state.io.observe(node);
}

// The element itself, then what it holds. A sentinel matches nothing, so the
// observer adding or removing one changes nothing.
function matching(node) {
    if (node.nodeType !== 1) return [];
    const found = node.matches(SELECTOR) ? [node] : [];
    return found.concat([...node.querySelectorAll(SELECTOR)]);
}

function scan(state, node) {
    for (const el of matching(node)) track(state, el);
}

/**
 * Turn `data-dopamine-*` attributes into rewards. Put `data-dopamine-on` on an
 * element with one of `click`, `submit`, `ended`, `read` or `visible`, plus any
 * of `data-dopamine-xp` (a whole number up to `maxXP`), `data-dopamine-achievement`
 * (an id the host has), `data-dopamine-celebrate` (a celebrate preset) and
 * `data-dopamine-certificate-title`, `-recipient`, `-date`, `-issuer`, `-logo`.
 * `data-dopamine-repeat` lets an element fire every time. Without it each
 * element fires once per page load, even across destroyAuto() and auto().
 *
 * `read` appends an invisible one pixel sentinel as the last child and fires when
 * it scrolls into view. `visible` fires when the element does. Elements added or
 * removed later are picked up, but a changed attribute is not watched. A bad
 * value is ignored with one console warning for that element. Never touches the
 * host's lifetime. Calling it again replaces the earlier call.
 *
 * @param {{ host: Object, root?: Document|Element, maxXP?: number }} options -
 *   `host` is a createDopamine() result. `root` holds every listener and
 *   observer, default `document`. `maxXP` default 1000.
 * @returns {undefined}
 * @throws {TypeError} when `host` or `host.progress` is missing, or `root` is
 *   not a Document or an Element
 */
export function auto(options) {
    const host = options !== null && typeof options === 'object' && hasOwn(options, 'host') ? options.host : undefined;
    if (host === null || typeof host !== 'object' || host.progress === null || typeof host.progress !== 'object') {
        throw new TypeError('auto() needs a host from createDopamine()');
    }
    if (typeof document === 'undefined') return;
    const given = hasOwn(options, 'root') ? options.root : undefined;
    const root = given ?? document;
    // Checked before anything attaches: `window` takes listeners but not a
    // MutationObserver, and a half set up call would leave listeners behind.
    if (root === null || typeof root !== 'object' || (root.nodeType !== 1 && root.nodeType !== 9)) {
        throw new TypeError('auto() root must be a Document or an Element');
    }
    destroyAuto();
    const limit = hasOwn(options, 'maxXP') ? options.maxXP : undefined;
    const maxXP = Number.isInteger(limit) && limit >= 0 ? limit : DEFAULT_MAX_XP;

    const state = {
        host,
        maxXP,
        root,
        io: null,
        mo: null,
        own: new Map(),
        watch: new Map(),
        noObserver: false,
        listeners: []
    };
    // Active before anything attaches, so destroyAuto() can undo a partial setup.
    active = state;

    const delegate = (type) => (event) => {
        const origin = event.target;
        const start = origin && typeof origin.closest === 'function' ? origin : origin?.parentElement;
        const el = start?.closest(`[${ON}="${type}"]`);
        if (el && root.contains(el)) fire(state, el);
    };
    // `ended` does not bubble, so it is heard in the capture phase.
    for (const [type, capture] of [['click', false], ['submit', false], ['ended', true]]) {
        const handler = delegate(type);
        state.listeners.push({ type, handler, capture });
        root.addEventListener(type, handler, capture);
    }

    if (typeof IntersectionObserver === 'function') {
        state.io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const el = state.watch.get(entry.target);
                if (el && entry.isIntersecting) fire(state, el);
            }
        }, { threshold: 0 });
    }
    if (state.io && typeof MutationObserver === 'function') {
        state.mo = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of record.removedNodes) {
                    for (const el of matching(node)) remove(state, el);
                }
                for (const node of record.addedNodes) scan(state, node);
            }
        });
        state.mo.observe(root, { childList: true, subtree: true });
    }

    scan(state, root.nodeType === 9 ? root.documentElement ?? root : root);
}

/**
 * Remove the listeners, disconnect the observers and take out every sentinel.
 * The host is not disposed. Safe to call twice, or before auto().
 * @returns {undefined}
 */
export function destroyAuto() {
    const state = active;
    active = null;
    if (!state) return;
    for (const { type, handler, capture } of state.listeners) {
        state.root.removeEventListener(type, handler, capture);
    }
    state.io?.disconnect();
    state.mo?.disconnect();
    for (const { sentinel } of state.own.values()) sentinel?.remove();
    state.own.clear();
    state.watch.clear();
}
