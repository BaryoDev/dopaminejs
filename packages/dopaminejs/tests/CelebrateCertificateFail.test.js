/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { celebrate, destroyCelebrations } from '../src/celebrate.js';
import { ParticleSystem } from '../src/dopamine/effects/ParticleSystem.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';

// The certificate chunk fails to load, as it does offline.
vi.mock('../src/certificate.js', () => {
    throw new Error('chunk failed');
});

describe("celebrate('certificate') when the certificate code does not load", () => {
    afterEach(() => {
        destroyCelebrations();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('logs one error, does not throw and opens no certificate', async () => {
        vi.spyOn(ParticleSystem.prototype, 'burst').mockImplementation(() => {});
        vi.spyOn(SoundManager.prototype, 'play').mockResolvedValue(undefined);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => celebrate('certificate', { certificate: { title: 'Done' } })).not.toThrow();
        await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1));

        expect(document.querySelector('.dopamine-certificate-overlay')).toBeNull();
    });
});
