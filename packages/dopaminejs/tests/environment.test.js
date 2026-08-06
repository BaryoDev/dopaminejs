/**
 * Runs in the default node environment on purpose: no window, no document,
 * no localStorage. Importing and constructing the storage-backed pieces must
 * not throw, so the package can be imported during SSR or in a worker.
 */
import { describe, it, expect } from 'vitest';
import { DataService } from '../src/dopamine/core/DataService.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';

describe('non-browser environment', () => {
    it('has no window to fall back on', () => {
        expect(typeof window).toBe('undefined');
    });

    it('should construct DataService without localStorage', () => {
        expect(() => new DataService()).not.toThrow();
    });

    it('should degrade DataService to an in-memory store', async () => {
        const service = new DataService();

        await service.save('player', { xp: 10 });

        expect(await service.load('player', null)).toEqual({ xp: 10 });
    });

    it('should construct SoundManager without localStorage', () => {
        expect(() => new SoundManager()).not.toThrow();
    });

    it('should treat a missing Web Audio API as muted rather than throwing', () => {
        const manager = new SoundManager();

        expect(() => manager.play('jump')).not.toThrow();
        expect(() => manager.playTone(440, 0.1)).not.toThrow();
    });
});
