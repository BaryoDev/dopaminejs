import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as core from '../src/progression.js';
import { DopamineError } from '../src/dopamine/core/DopamineError.js';

const EXPECTED = ['DataService', 'DopamineError', 'EventEmitter', 'RewardSystem', 'createMemoryStorage', 'merge', 'resolveStorage', 'validate'];

const run = async (mod) => {
    const rewards = new mod.RewardSystem(new mod.DataService({ storage: mod.createMemoryStorage() }));
    await rewards.init();
    await rewards.record('snake', { score: 50 });
    return rewards;
};

describe('dopaminejs/core', () => {
    it('should export the progression API and nothing from the browser layers', () => {
        const names = Object.keys(core).filter((key) => key !== 'default').sort();
        expect(names).toEqual([...EXPECTED].sort());
    });

    it('should export the same DopamineError the system throws', async () => {
        expect(core.DopamineError).toBe(DopamineError);
        const rewards = await run(core);
        await expect(rewards.import({ v: 99 })).rejects.toBeInstanceOf(core.DopamineError);
    });

    it('should merge and validate a saved player', async () => {
        const rewards = await run(core);
        const doc = rewards.export();

        expect(core.validate(doc).v).toBe(3);
        expect(core.merge(doc, doc)).toEqual(core.validate(doc));
    });

    it('should round trip in plain Node with the memory store', async () => {
        const rewards = await run(core);

        expect(rewards.snapshot().totalGamesPlayed).toBe(1);
        expect(rewards.snapshot().stats.snake.best).toBe(50);
    });

    const built = fileURLToPath(new URL('../dist/core.js', import.meta.url));
    it.skipIf(!existsSync(built))('should give the built core the same surface', async () => {
        const mod = await import(pathToFileURL(built).href);
        const names = Object.keys(mod).filter((key) => key !== 'default').sort();

        expect(names).toEqual([...EXPECTED].sort());
        const rewards = await run(mod);
        expect(rewards.snapshot().totalGamesPlayed).toBe(1);
    });
});
