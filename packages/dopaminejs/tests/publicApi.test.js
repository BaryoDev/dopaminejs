import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pins the public surface of every published package.
 *
 * These packages are installed by other people's code, so renaming an export, changing an
 * arity, or dropping a member is a breaking change for someone even when all 95 behavioural
 * tests still pass. Rendering the surface to text and diffing it against a checked-in file
 * turns that into a failing test and a reviewable diff.
 *
 * A failure here is not necessarily wrong. Read the diff, decide whether the change is
 * additive or breaking, then approve it by copying the .received.txt over the .approved.txt
 * and committing both that and whatever version bump the change implies.
 */

const here = dirname(fileURLToPath(import.meta.url));
const approvedDir = join(here, 'approved-api');

/**
 * Renders an ES module namespace as stable, sorted text.
 *
 * Only the shape is recorded, never a value: values change between builds for reasons that
 * are not API changes, and a snapshot that churns is one people stop reading.
 */
function renderSurface(namespace) {
    return Object.keys(namespace)
        .sort()
        .map((name) => {
            const value = namespace[name];
            const kind = describeKind(value);
            return `${name}: ${kind}`;
        })
        .join('\n');
}

function describeKind(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';

    const type = typeof value;

    if (type !== 'function') return type;

    // A class and a plain function are different contracts to a consumer, and arity is part
    // of the signature, so both are recorded.
    const isClass = /^class[\s{]/.test(Function.prototype.toString.call(value));
    const statics = Object.getOwnPropertyNames(value)
        .filter((k) => !['length', 'name', 'prototype'].includes(k) && !k.startsWith('_'))
        .sort();
    // Underscore-prefixed members are private by convention. Pinning them would make every
    // internal refactor trip this gate, and a guard that cries wolf is one people learn to
    // approve without reading.
    const proto = value.prototype
        ? Object.getOwnPropertyNames(value.prototype)
              .filter((k) => k !== 'constructor' && !k.startsWith('_'))
              .sort()
        : [];

    const parts = [`${isClass ? 'class' : 'function'}(${value.length})`];
    if (statics.length) parts.push(`static[${statics.join(',')}]`);
    if (proto.length) parts.push(`proto[${proto.join(',')}]`);

    return parts.join(' ');
}

function compare(packageName, actual) {
    if (!existsSync(approvedDir)) mkdirSync(approvedDir, { recursive: true });

    const approvedPath = join(approvedDir, `${packageName}.approved.txt`);
    const receivedPath = join(approvedDir, `${packageName}.received.txt`);

    if (!existsSync(approvedPath)) {
        writeFileSync(receivedPath, actual);
        throw new Error(
            `No approved API file for ${packageName}. A new package needs its surface approved once.\n` +
                `Review ${receivedPath} and, if it is what you meant to publish, rename it to ` +
                `${packageName}.approved.txt.`
        );
    }

    const approved = readFileSync(approvedPath, 'utf8').trim();

    if (approved === actual.trim()) return;

    writeFileSync(receivedPath, actual);

    const before = approved.split('\n');
    const after = actual.trim().split('\n');
    const removed = before.filter((l) => !after.includes(l));
    const added = after.filter((l) => !before.includes(l));

    const lines = [];
    if (removed.length) lines.push(`Removed or changed (${removed.length}):`, ...removed.map((l) => `  - ${l}`));
    if (added.length) lines.push(`Added (${added.length}):`, ...added.map((l) => `  + ${l}`));

    throw new Error(
        `The public API of ${packageName} changed.\n\n${lines.join('\n')}\n\n` +
            `If the change is intended, copy\n  ${receivedPath}\nover\n  ${approvedPath}\n` +
            `and make sure the version bump matches: additions are a minor, anything removed or ` +
            `changed in place is a major.`
    );
}

describe('public API surface', () => {
    it('dopaminejs has not changed', async () => {
        const mod = await import('../src/index.js');
        expect(() => compare('dopaminejs', renderSurface(mod))).not.toThrow();
    });
});
