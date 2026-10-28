import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { validate } from '../src/dopamine/core/store.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';

const specFile = (name) => fileURLToPath(new URL(`../../../spec/${name}`, import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(specFile(name), 'utf8'));
const schema = readJson('schema.json');

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Just enough JSON Schema for spec/schema.json: type, const, required,
// properties, additionalProperties, items, pattern, minimum and $ref.
function check(node, value, path = '$') {
    if (node.$ref) {
        const target = node.$ref.replace('#/', '').split('/').reduce((at, key) => at[key], schema);
        return check(target, value, path);
    }
    const errors = [];
    if ('const' in node && value !== node.const) errors.push(`${path}: expected ${node.const}`);
    if (node.type === 'object' && !isObject(value)) return [`${path}: expected object`];
    if (node.type === 'array' && !Array.isArray(value)) return [`${path}: expected array`];
    if (node.type === 'string' && typeof value !== 'string') return [`${path}: expected string`];
    if (node.type === 'boolean' && typeof value !== 'boolean') return [`${path}: expected boolean`];
    if (node.type === 'number' && !Number.isFinite(value)) return [`${path}: expected number`];
    if (node.type === 'integer' && !Number.isInteger(value)) return [`${path}: expected integer`];
    if (typeof value === 'number' && 'minimum' in node && value < node.minimum) errors.push(`${path}: below ${node.minimum}`);
    if (typeof value === 'string' && node.pattern && !new RegExp(node.pattern).test(value)) errors.push(`${path}: does not match ${node.pattern}`);

    if (isObject(value) && node.type === 'object') {
        for (const key of node.required || []) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${path}: missing ${key}`);
        }
        for (const key of Object.keys(value)) {
            const known = node.properties && Object.prototype.hasOwnProperty.call(node.properties, key);
            if (known) errors.push(...check(node.properties[key], value[key], `${path}.${key}`));
            else if (node.additionalProperties === false) errors.push(`${path}: unexpected ${key}`);
            else if (isObject(node.additionalProperties)) errors.push(...check(node.additionalProperties, value[key], `${path}.${key}`));
        }
    }
    if (Array.isArray(value) && node.items) {
        value.forEach((item, i) => errors.push(...check(node.items, item, `${path}[${i}]`)));
    }
    return errors;
}

const valid = (doc) => check(schema, doc);

const validated = (doc, options) => {
    try {
        return validate(doc, options);
    } catch {
        return null;
    }
};

describe('spec/schema.json', () => {
    it('should name contract 3 in spec/VERSION', () => {
        expect(readFileSync(specFile('VERSION'), 'utf8')).toMatch(/contract:\s*3/);
        expect(schema.properties.v.const).toBe(3);
    });

    it('should accept the smallest document', () => {
        expect(valid({ v: 3 })).toEqual([]);
    });

    it('should refuse a 2.x document until it is migrated', () => {
        expect(valid({ name: 'Ana', xp: 100, level: 2 }).length).toBeGreaterThan(0);
        expect(valid({ v: 2 }).length).toBeGreaterThan(0);
    });

    it('should refuse fields it does not know', () => {
        expect(valid({ v: 3, extra: 1 })).toEqual(['$: unexpected extra']);
    });

    it('should refuse a bad play date and a negative amount', () => {
        expect(valid({ v: 3, playDates: ['2026-1-1'] }).length).toBe(1);
        expect(valid({ v: 3, xpBy: { a: -1 } }).length).toBe(1);
        expect(valid({ v: 3, gamesBy: { a: 1.5 } }).length).toBe(1);
    });

    it('should hold for what export() returns', async () => {
        const rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));
        await rewards.init();
        await rewards.record('snake', { score: 120, apples: 4 });
        await rewards.addXP(-5);

        expect(valid(rewards.export())).toEqual([]);
    });

    it('should hold for every document validate() returns from the merge fixtures', () => {
        const fixture = readJson('fixtures/merge.json');
        const seen = [];
        for (const test of fixture.cases) {
            for (const step of test.steps) {
                if (step.expect?.code) continue;
                for (const key of ['a', 'b', 'doc']) {
                    if (isObject(step[key]) && step[key].v === 3) seen.push(step[key]);
                }
            }
        }

        let checked = 0;
        for (const doc of seen) {
            const out = validated(doc);
            if (!out) continue;
            checked++;
            expect(valid(out), JSON.stringify(doc)).toEqual([]);
        }
        expect(checked).toBeGreaterThan(5);
    });

    it('should hold for every saved player the migrate fixtures load', () => {
        const fixture = readJson('fixtures/migrate.json');
        let checked = 0;
        for (const test of fixture.cases) {
            if (!isObject(test.savedJson)) continue;
            const out = validated(test.savedJson, { now: Date.parse('2026-08-07T09:00:00Z') });
            if (!out) continue;
            checked++;
            expect(valid(out), test.name).toEqual([]);
        }
        expect(checked).toBeGreaterThan(10);
    });
});
