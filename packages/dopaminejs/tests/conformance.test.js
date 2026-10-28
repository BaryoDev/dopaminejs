import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { merge } from '../src/dopamine/core/merge.js';
import { emptyDoc, validate, view } from '../src/dopamine/core/store.js';

// Runs the language-neutral cases in spec/fixtures. The format is described in
// spec/README.md. Anything this runner does not understand fails the test, so
// a fixture can never silently check nothing.

const FIXTURE_DIR = fileURLToPath(new URL('../../../spec/fixtures/', import.meta.url));
const EVENTS = ['xp_gained', 'level_up', 'achievement_unlocked', 'personal_best', 'streak_updated', 'save_failed', 'load_failed'];
const STORAGE_KEY = 'dopamine_player';
const DEVICE_KEY = 'dopamine_device';
const CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const CASE_KEYS = ['name', 'note', 'config', 'clock', 'device', 'savedJson', 'savedRaw', 'afterInit', 'steps', 'storage'];
const STORAGE_OPTION_KEYS = ['failWrites'];
const CONFIG_KEYS = ['builtinAchievements', 'achievements'];
const ACHIEVEMENT_KEYS = ['name', 'description', 'icon', 'xp', 'when'];
const EXPECT_KEYS = ['player', 'playerExact', 'doc', 'docExact', 'absent', 'achievements', 'events', 'returns', 'returnsExact', 'same', 'throws', 'code'];
const OPS = {
    setClock: ['at'],
    reload: ['device'],
    addXP: ['amount', 'reason'],
    record: ['activity', 'result'],
    unlockAchievement: ['id'],
    markAchievementsSeen: ['ids'],
    getXPForNextLevel: [],
    export: ['as'],
    import: ['doc', 'from', 'silent'],
    merge: ['a', 'b', 'as'],
    validate: ['doc', 'as']
};

function assertKeys(where, object, allowed) {
    for (const key of Object.keys(object)) {
        if (!allowed.includes(key)) {
            throw new Error(`${where}: unknown key "${key}"`);
        }
    }
}

function getPath(root, path) {
    let node = root;
    for (const part of path.split('.')) {
        if (!isRecord(node) || !hasOwn(node, part)) return { found: false };
        node = node[part];
    }
    return { found: true, value: node };
}

// Every key in `want` must be an own key of `got` and match. Arrays match
// element by element and by length. Plain values match by ===.
function matchSubset(got, want, where) {
    if (isRecord(want)) {
        if (!isRecord(got)) throw new Error(`${where}: expected an object, got ${JSON.stringify(got)}`);
        for (const key of Object.keys(want)) {
            if (!hasOwn(got, key)) throw new Error(`${where}.${key}: missing`);
            matchSubset(got[key], want[key], `${where}.${key}`);
        }
        return;
    }
    if (Array.isArray(want)) {
        if (!Array.isArray(got) || got.length !== want.length) {
            throw new Error(`${where}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
        }
        want.forEach((item, i) => matchSubset(got[i], item, `${where}[${i}]`));
        return;
    }
    if (got !== want) {
        throw new Error(`${where}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
}

// A fixture condition is data; the runner turns it into a check function.
function makeCheck(id, when) {
    if (!isRecord(when)) throw new Error(`achievement ${id}: "when" is required`);
    const keys = Object.keys(when);
    const only = (...allowed) => assertKeys(`achievement ${id}.when`, when, allowed);

    if (hasOwn(when, 'always')) { only('always'); return () => true; }
    if (hasOwn(when, 'never')) { only('never'); return () => false; }
    if (hasOwn(when, 'throws')) { only('throws'); return () => { throw new Error('check failed on purpose'); }; }
    if (hasOwn(when, 'player')) {
        only('player', 'gte');
        if (typeof when.player !== 'string' || typeof when.gte !== 'number') {
            throw new Error(`achievement ${id}: "player" must be a path and "gte" a number`);
        }
        const probe = view(emptyDoc(0), '2026-01-01');
        const field = getPath(probe, when.player);
        if (!field.found || typeof field.value !== 'number') {
            throw new Error(`achievement ${id}: "${when.player}" is not a numeric player field`);
        }
        return (player) => getPath(player, when.player).value >= when.gte;
    }
    if (hasOwn(when, 'activity')) { only('activity'); return (player, activity) => activity === when.activity; }
    if (hasOwn(when, 'score_gte')) {
        only('score_gte');
        if (typeof when.score_gte !== 'number') throw new Error(`achievement ${id}: "score_gte" must be a number`);
        return (player, activity, result) => result.score !== undefined && result.score >= when.score_gte;
    }
    throw new Error(`achievement ${id}: unknown condition ${JSON.stringify(keys)}`);
}

function buildConfig(config = {}) {
    assertKeys('config', config, CONFIG_KEYS);
    const achievements = {};
    for (const [id, def] of Object.entries(config.achievements || {})) {
        assertKeys(`achievement ${id}`, def, ACHIEVEMENT_KEYS);
        const { when, ...rest } = def;
        achievements[id] = { ...rest, check: makeCheck(id, when) };
    }
    return achievements;
}

function nonEmpty(value, where) {
    const size = Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length : -1;
    if (size < 0) throw new Error(`${where}: expected an object or array`);
    if (size === 0) throw new Error(`${where}: empty, so it checks nothing`);
}

function runCase(testCase) {
    return async () => {
        assertKeys('case', testCase, CASE_KEYS);
        if (!CLOCK.test(testCase.clock || '')) throw new Error('clock must be YYYY-MM-DDTHH:MM:SS local time');
        if (!testCase.afterInit && !(Array.isArray(testCase.steps) && testCase.steps.length > 0)) {
            throw new Error('case has no afterInit and no steps, so it checks nothing');
        }
        assertKeys('storage', testCase.storage || {}, STORAGE_OPTION_KEYS);
        const customAchievements = buildConfig(testCase.config);
        const builtins = testCase.config?.builtinAchievements !== false;

        // The core gets a clock object, so no test fakes Date.
        let nowMs = new Date(testCase.clock).getTime();
        const clock = {
            now: () => nowMs,
            localDate(ms = nowMs) {
                const date = new Date(ms);
                const pad = (value) => String(value).padStart(2, '0');
                return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
            }
        };
        const registry = {};
        const docOf = (value, where) => {
            if (typeof value === 'string') {
                if (!hasOwn(registry, value)) throw new Error(`${where}: no saved document named "${value}"`);
                return registry[value];
            }
            return value;
        };
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const memory = createMemoryStorage();
            if (testCase.savedRaw !== undefined) memory.setItem(STORAGE_KEY, testCase.savedRaw);
            if (testCase.savedJson !== undefined) memory.setItem(STORAGE_KEY, JSON.stringify(testCase.savedJson));
            if (testCase.device !== undefined) memory.setItem(DEVICE_KEY, JSON.stringify(testCase.device));
            const storage = testCase.storage?.failWrites === true
                ? { ...memory, setItem: () => { throw new Error('storage write blocked'); } }
                : memory;

            let events = [];
            let rewards;

            const start = async () => {
                rewards = new RewardSystem(new DataService({ storage }), { achievements: customAchievements, clock });
                if (!builtins) rewards.achievements = { ...customAchievements };
                for (const name of EVENTS) {
                    rewards.on(name, (payload) => events.push({ ...payload, event: name }));
                }
                events = [];
                await rewards.init();
            };

            const verify = (expectation, label, returned) => {
                assertKeys(`${label} expect`, expectation, EXPECT_KEYS);
                nonEmpty(expectation, `${label} expect`);
                for (const key of ['player', 'playerExact', 'doc', 'docExact', 'returnsExact']) {
                    if (hasOwn(expectation, key)) {
                        if (!isRecord(expectation[key])) throw new Error(`${label} ${key}: expected an object`);
                        nonEmpty(expectation[key], `${label} ${key}`);
                    }
                }
                if (hasOwn(expectation, 'returns') && isRecord(expectation.returns)) {
                    nonEmpty(expectation.returns, `${label} returns`);
                }
                for (const key of ['absent', 'achievements', 'events']) {
                    if (hasOwn(expectation, key)) {
                        if (!Array.isArray(expectation[key])) throw new Error(`${label} ${key}: expected an array`);
                        // Empty events or achievements lists are real checks (nothing fired, nothing unlocked).
                        if (key === 'absent') nonEmpty(expectation[key], `${label} ${key}`);
                    }
                }
                const player = rewards.snapshot();

                if (hasOwn(expectation, 'player')) matchSubset(player, expectation.player, `${label} player`);
                if (hasOwn(expectation, 'playerExact')) {
                    for (const [path, want] of Object.entries(expectation.playerExact)) {
                        const found = getPath(player, path);
                        if (!found.found) throw new Error(`${label} playerExact.${path}: missing`);
                        expect(found.value, `${label} playerExact.${path}`).toStrictEqual(want);
                    }
                }
                if (hasOwn(expectation, 'doc')) matchSubset(rewards.export(), expectation.doc, `${label} doc`);
                if (hasOwn(expectation, 'docExact')) {
                    const doc = rewards.export();
                    for (const [path, want] of Object.entries(expectation.docExact)) {
                        const found = getPath(doc, path);
                        if (!found.found) throw new Error(`${label} docExact.${path}: missing`);
                        expect(found.value, `${label} docExact.${path}`).toStrictEqual(want);
                    }
                }
                if (hasOwn(expectation, 'returnsExact')) {
                    for (const [path, want] of Object.entries(expectation.returnsExact)) {
                        const found = getPath(returned, path);
                        if (!found.found) throw new Error(`${label} returnsExact.${path}: missing`);
                        expect(found.value, `${label} returnsExact.${path}`).toStrictEqual(want);
                    }
                }
                if (hasOwn(expectation, 'same')) {
                    if (!Array.isArray(expectation.same) || expectation.same.length === 0) throw new Error(`${label} same: expected a list of pairs`);
                    for (const pair of expectation.same) {
                        if (!Array.isArray(pair) || pair.length !== 2 || !hasOwn(registry, pair[0]) || !hasOwn(registry, pair[1])) {
                            throw new Error(`${label} same: ${JSON.stringify(pair)} must name two saved documents`);
                        }
                        expect(registry[pair[0]], `${label} same ${pair[0]} and ${pair[1]}`).toStrictEqual(registry[pair[1]]);
                    }
                }
                for (const path of expectation.absent || []) {
                    if (getPath(player, path).found) throw new Error(`${label} absent.${path}: present`);
                }
                if (hasOwn(expectation, 'achievements')) {
                    expect(Object.keys(player.achievements).sort(), `${label} achievements`).toEqual([...expectation.achievements].sort());
                }
                if (hasOwn(expectation, 'returns')) matchSubset(returned, expectation.returns, `${label} returns`);
                if (hasOwn(expectation, 'events')) {
                    if (events.length !== expectation.events.length) {
                        throw new Error(`${label} events: expected ${JSON.stringify(expectation.events.map((e) => e.event))}, got ${JSON.stringify(events.map((e) => e.event))}`);
                    }
                    expectation.events.forEach((want, i) => matchSubset(events[i], want, `${label} events[${i}]`));
                }
            };

            await start();
            if (testCase.afterInit) verify(testCase.afterInit, 'afterInit');

            const steps = testCase.steps || [];
            for (const [index, step] of steps.entries()) {
                const label = `step ${index + 1} (${step.op})`;
                if (!hasOwn(OPS, step.op)) throw new Error(`${label}: unknown op`);
                assertKeys(label, step, ['op', 'expect', ...OPS[step.op]]);
                if (step.op === 'validate' || step.op === 'merge' || step.op === 'import') {
                    const given = step.op === 'merge' ? ['a', 'b'] : [step.op === 'import' && hasOwn(step, 'from') ? 'from' : 'doc'];
                    for (const key of given) if (!hasOwn(step, key)) throw new Error(`${label}: ${key} is required`);
                }
                if (step.op !== 'setClock' && !step.expect) throw new Error(`${label}: expect is required`);

                if (step.op === 'setClock' && !CLOCK.test(step.at || '')) throw new Error(`${label}: at must be YYYY-MM-DDTHH:MM:SS local time`);

                events = [];
                let returned;
                let thrown = null;

                try {
                    switch (step.op) {
                        case 'setClock':
                            nowMs = new Date(step.at).getTime();
                            break;
                        case 'reload':
                            if (step.device !== undefined) memory.setItem(DEVICE_KEY, JSON.stringify(step.device));
                            await start();
                            break;
                        case 'addXP':
                            returned = await rewards.addXP(step.amount, step.reason);
                            break;
                        case 'record':
                            returned = await rewards.record(step.activity, step.result);
                            break;
                        case 'unlockAchievement':
                            returned = await rewards.unlockAchievement(step.id);
                            break;
                        case 'markAchievementsSeen':
                            returned = await rewards.markAchievementsSeen(step.ids);
                            break;
                        case 'getXPForNextLevel':
                            returned = rewards.getXPForNextLevel();
                            break;
                        case 'export':
                            returned = rewards.export();
                            registry[step.as] = returned;
                            break;
                        case 'import':
                            returned = await rewards.import(hasOwn(step, 'from') ? docOf(step.from, label) : step.doc, { silent: step.silent === true });
                            break;
                        case 'merge':
                            returned = merge(docOf(step.a, label), docOf(step.b, label));
                            if (step.as) registry[step.as] = returned;
                            break;
                        case 'validate':
                            returned = validate(docOf(step.doc, label));
                            if (step.as) registry[step.as] = returned;
                            break;
                    }
                } catch (error) {
                    thrown = error;
                }

                const wantThrow = step.expect?.throws;
                if (wantThrow) {
                    if (!thrown) throw new Error(`${label}: expected ${wantThrow}, nothing was thrown`);
                    expect(thrown.name, `${label} error`).toBe(wantThrow);
                    if (hasOwn(step.expect, 'code')) expect(thrown.code, `${label} error code`).toBe(step.expect.code);
                } else if (thrown) {
                    throw thrown;
                }

                if (step.expect) verify(step.expect, label, returned);
            }
        } finally {
            errorSpy.mockRestore();
        }
    };
}

const files = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort();

describe('conformance fixtures', () => {
    it('finds fixture files with cases in them', () => {
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const suite = JSON.parse(readFileSync(FIXTURE_DIR + file, 'utf8'));
            expect(Array.isArray(suite.cases) && suite.cases.length > 0, file).toBe(true);
        }
    });

    for (const file of files) {
        const suite = JSON.parse(readFileSync(FIXTURE_DIR + file, 'utf8'));

        describe(`${file}`, () => {
            for (const testCase of suite.cases) {
                it(testCase.name, runCase(testCase));
            }
        });
    }
});
