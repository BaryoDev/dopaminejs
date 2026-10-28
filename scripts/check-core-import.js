#!/usr/bin/env node
/**
 * Imports the BUILT `dopaminejs/core` in a plain Node process and runs a
 * RewardSystem round trip, to prove the progression API has no browser
 * dependency. Run after `npm run build`.
 *
 * Browser globals are replaced with tripwires that record every read, so a
 * module that reaches for one fails this script even if it guards the read
 * with try/catch or typeof. No jsdom, no stand-in values: each global reads
 * as undefined.
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../packages/dopaminejs/dist');

const BROWSER_GLOBALS = [
    'window', 'document', 'localStorage', 'sessionStorage', 'navigator',
    'self', 'location', 'AudioContext', 'webkitAudioContext', 'requestAnimationFrame',
    'HTMLElement', 'Element', 'Image', 'Audio', 'matchMedia', 'indexedDB',
    'MutationObserver', 'IntersectionObserver', 'CustomEvent', 'getComputedStyle',
    'cancelAnimationFrame'
];

const reads = [];
let armed = true;

for (const name of BROWSER_GLOBALS) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
            if (armed) reads.push(name);
            return undefined;
        },
        set() {}
    });
}

const failures = [];
const check = (condition, message) => {
    if (!condition) failures.push(message);
};

const EXPECTED = ['DataService', 'DopamineError', 'EventEmitter', 'RewardSystem', 'createMemoryStorage', 'merge', 'resolveStorage', 'validate'];

async function roundTrip(label, mod, makeStorage) {
    const { RewardSystem, DataService, EventEmitter, createMemoryStorage, merge, validate } = mod;

    for (const name of EXPECTED) {
        check(typeof mod[name] === 'function', `${label}: ${name} missing`);
    }

    // Nothing from the UI, effects, sound or engine layers belongs here.
    const extras = Object.keys(mod).filter((key) => !EXPECTED.includes(key) && key !== 'default');
    check(extras.length === 0, `${label}: unexpected exports ${extras.join(', ')}`);
    check(new RewardSystem(new DataService({ storage: createMemoryStorage() })) instanceof EventEmitter,
        `${label}: RewardSystem is not an EventEmitter`);

    const storage = makeStorage(createMemoryStorage);
    const data = new DataService({ storage });
    const rewards = new RewardSystem(data);
    const seen = [];
    rewards.on('xp_gained', (event) => seen.push(event));

    await rewards.init();
    await rewards.record('check', { score: 100, won: true });

    check(rewards.snapshot().xp > 0, `${label}: record awarded no XP`);
    check(seen.length > 0, `${label}: xp_gained never fired`);

    const doc = rewards.export();
    check(merge(doc, doc).xpBy !== undefined, `${label}: merge returned no document`);
    check(validate(doc).v === 3, `${label}: validate did not return a v3 document`);

    // A fresh instance over the same storage must see the saved player.
    check(typeof await data.storage.getItem('dopamine_player') === 'string', `${label}: nothing was saved to the store`);
    const again = new RewardSystem(data);
    await again.init();
    check(again.snapshot().xp === rewards.snapshot().xp, `${label}: saved XP did not survive a reload`);

    return rewards.snapshot().xp;
}

const asPromises = (createMemoryStorage) => {
    const inner = createMemoryStorage();
    return {
        getItem: async (key) => inner.getItem(key),
        setItem: async (key, value) => { inner.setItem(key, value); },
        removeItem: async (key) => { inner.removeItem(key); }
    };
};

try {
    const esm = await import(pathToFileURL(resolve(dist, 'core.js')).href);
    const cjs = createRequire(import.meta.url)(resolve(dist, 'core.cjs'));

    armed = true;
    const esmXp = await roundTrip('esm sync storage', esm, (make) => make());
    const esmAsyncXp = await roundTrip('esm async storage', esm, asPromises);
    const cjsXp = await roundTrip('cjs sync storage', cjs, (make) => make());
    armed = false;

    check(reads.length === 0, `browser globals were read: ${[...new Set(reads)].join(', ')}`);
    check(esmXp === esmAsyncXp && esmXp === cjsXp, 'storage kind or module format changed the XP awarded');

    // No storage given: DataService falls back through resolveStorage, which
    // probes localStorage and nothing else, then lands on a memory store.
    reads.length = 0;
    armed = true;
    const defaultXp = await roundTrip('esm default storage', esm, () => undefined);
    check(defaultXp === esmXp, 'default storage changed the XP awarded');
    armed = false;
    const other = [...new Set(reads)].filter((name) => name !== 'localStorage');
    check(other.length === 0, `default storage read more than localStorage: ${other.join(', ')}`);
    check(reads.includes('localStorage'), 'default storage never probed localStorage, the check is stale');
} catch (error) {
    failures.push(`import or round trip threw: ${error?.stack || error}`);
}

if (failures.length > 0) {
    console.error('dopaminejs/core import check failed:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}

console.log('dopaminejs/core import check passed: ESM and CJS builds ran init, record, merge and validate with no browser globals.');
