/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { conformance, conformanceFailures } from '../src/testing.js';
import { ParticleSystem } from '../src/dopamine/effects/ParticleSystem.js';
import { SoundManager } from '../src/dopamine/audio/SoundManager.js';
import { RewardUI } from '../src/dopamine/ui/RewardUI.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import { gameFeedback } from '../src/games.js';

class AudioContextMock {
    constructor() {
        this.state = 'running';
        this.destination = {};
        this.currentTime = 0;
    }
    resume() {}
    close() {}
    createOscillator() {
        return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 }, type: 'sine' };
    }
    createGain() {
        return { connect: vi.fn(), gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
    }
}

beforeEach(() => {
    window.AudioContext = AudioContextMock;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
        fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(),
        lineTo: vi.fn(), closePath: vi.fn(), drawImage: vi.fn(), scale: vi.fn(), setTransform: vi.fn()
    }));
    vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 0));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('default ParticleSystem passes conformance.particles', () => {
    conformance.particles(() => new ParticleSystem());
});

describe('default SoundManager passes conformance.sound', () => {
    conformance.sound(() => new SoundManager({ storage: createMemoryStorage() }));
});

describe('default RewardUI passes conformance.ui', () => {
    conformance.ui((parts) => new RewardUI(parts));
});

describe('memory storage passes conformance.storage', () => {
    conformance.storage(() => createMemoryStorage());
});

describe('a minimal plugin passes conformance.plugin', () => {
    conformance.plugin(() => ({ name: 'minimal', version: '1.0.0', api: 3, install: () => () => {} }));
});

describe('gameFeedback passes conformance.plugin', () => {
    conformance.plugin(() => gameFeedback());
});

describe('suite wiring', () => {
    it('reports no failures for the defaults', async () => {
        expect(await conformanceFailures('storage', () => createMemoryStorage())).toEqual([]);
        expect(await conformanceFailures('ui', (parts) => new RewardUI(parts))).toEqual([]);
    });
});
