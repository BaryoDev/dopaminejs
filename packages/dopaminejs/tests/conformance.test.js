import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

// Runs the language-neutral cases in spec/fixtures. The format is described in
// spec/README.md. Anything this runner does not understand fails the test, so
// a fixture can never silently check nothing.

const FIXTURE_DIR = fileURLToPath(new URL('../../../spec/fixtures/', import.meta.url));
const EVENTS = ['xp_gained', 'level_up', 'achievement_unlocked', 'new_high_score', 'streak_updated', 'save_failed'];
const STORAGE_KEY = 'dopamine_player';
const CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const CASE_KEYS = ['name', 'note', 'config', 'clock', 'savedJson', 'savedRaw', 'afterInit', 'steps'];
const CONFIG_KEYS = ['builtinAchievements', 'achievements'];
const ACHIEVEMENT_KEYS = ['name', 'description', 'icon', 'xp', 'when'];
const EXPECT_KEYS = ['player', 'playerExact', 'absent', 'achievements', 'events', 'returns', 'throws'];
const OPS = {
    setClock: ['at'],
    reload: [],
    addXP: ['amount', 'reason'],
    recordGame: ['game', 'result'],
    unlockAchievement: ['id'],
    markAchievementsSeen: ['ids'],
    getXPForNextLevel: []
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
        return (player) => getPath(player, when.player).value >= when.gte;
    }
    if (hasOwn(when, 'game')) { only('game'); return (player, game) => game === when.game; }
    if (hasOwn(when, 'score_gte')) {
        only('score_gte');
        return (player, game, result) => result.score !== undefined && result.score >= when.score_gte;
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

function runCase(testCase) {
    return async () => {
        assertKeys('case', testCase, CASE_KEYS);
        if (!CLOCK.test(testCase.clock || '')) throw new Error('clock must be YYYY-MM-DDTHH:MM:SS local time');
        const customAchievements = buildConfig(testCase.config);
        const builtins = testCase.config?.builtinAchievements !== false;

        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(testCase.clock));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const storage = createMemoryStorage();
            if (testCase.savedRaw !== undefined) storage.setItem(STORAGE_KEY, testCase.savedRaw);
            if (testCase.savedJson !== undefined) storage.setItem(STORAGE_KEY, JSON.stringify(testCase.savedJson));

            let events = [];
            let rewards;

            const start = async () => {
                rewards = new RewardSystem(new DataService({ storage }), { achievements: customAchievements });
                if (!builtins) rewards.achievements = { ...customAchievements };
                for (const name of EVENTS) {
                    rewards.on(name, (payload) => events.push({ ...payload, event: name }));
                }
                events = [];
                await rewards.init();
            };

            const verify = (expectation, label, returned) => {
                assertKeys(`${label} expect`, expectation, EXPECT_KEYS);
                if (Object.keys(expectation).length === 0) throw new Error(`${label}: empty expectation`);
                const player = rewards.player;

                if (hasOwn(expectation, 'player')) matchSubset(player, expectation.player, `${label} player`);
                if (hasOwn(expectation, 'playerExact')) {
                    for (const [path, want] of Object.entries(expectation.playerExact)) {
                        const found = getPath(player, path);
                        if (!found.found) throw new Error(`${label} playerExact.${path}: missing`);
                        expect(found.value, `${label} playerExact.${path}`).toEqual(want);
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
                if (step.op !== 'setClock' && !step.expect) throw new Error(`${label}: expect is required`);

                events = [];
                let returned;
                let thrown = null;

                try {
                    switch (step.op) {
                        case 'setClock':
                            if (!CLOCK.test(step.at || '')) throw new Error(`${label}: at must be YYYY-MM-DDTHH:MM:SS local time`);
                            vi.setSystemTime(new Date(step.at));
                            break;
                        case 'reload':
                            await start();
                            break;
                        case 'addXP':
                            returned = await rewards.addXP(step.amount, step.reason);
                            break;
                        case 'recordGame':
                            returned = await rewards.recordGame(step.game, step.result);
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
                    }
                } catch (error) {
                    thrown = error;
                }

                const wantThrow = step.expect?.throws;
                if (wantThrow) {
                    if (!thrown) throw new Error(`${label}: expected ${wantThrow}, nothing was thrown`);
                    expect(thrown.name, `${label} error`).toBe(wantThrow);
                } else if (thrown) {
                    throw thrown;
                }

                if (step.expect) verify(step.expect, label, returned);
            }
        } finally {
            errorSpy.mockRestore();
            vi.useRealTimers();
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
