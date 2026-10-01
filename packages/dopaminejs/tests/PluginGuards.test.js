/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { DopamineKernel } from '../src/core/DopamineKernel.js';
import { RewardSystem } from '../src/dopamine/core/RewardSystem.js';
import { DataService } from '../src/dopamine/core/DataService.js';
import { createMemoryStorage } from '../src/dopamine/utils/storage.js';
import {
    BattlePassPlugin,
    LeaderboardPlugin,
    RewardMiddleware,
    WebhookIntegration
} from '../../plugin-ecosystem/src/index.js';
import { FeedbackSystem } from '../../plugin-feedback-effects/src/FeedbackSystem.js';
import { FloatingText } from '../../plugin-feedback-effects/src/FloatingText.js';
import { DebugOverlayPlugin } from '../../plugin-debug-overlay/src/index.js';
import { WebGLParticleSystem } from '../../plugin-webgl-particles/src/WebGLParticleSystem.js';
import { WebGLParticlePlugin } from '../../plugin-webgl-particles/src/WebGLParticlePlugin.js';
import { FeedbackPlugin } from '../../plugin-feedback-effects/src/FeedbackPlugin.js';
import { HowlerAudioPlugin } from '../../plugin-howler-audio/src/HowlerAudioPlugin.js';
import { buildState } from '../../dopaminejs-react/src/state.js';

const hmacHex = async (secret, body) => {
    const encoder = new TextEncoder();
    const key = await webcrypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const digest = await webcrypto.subtle.sign('HMAC', key, encoder.encode(body));
    return Buffer.from(digest).toString('hex');
};

const rewardsOn = async (kernel) => {
    const rewards = new RewardSystem(
        new DataService({ storage: createMemoryStorage() }),
        { events: kernel.events }
    );
    await rewards.init();
    return rewards;
};

describe('WebhookIntegration', () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn(async () => ({ ok: true }));
        vi.stubGlobal('fetch', fetchMock);
        if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should sign the exact body with HMAC-SHA256 and never send the secret', async () => {
        const webhook = new WebhookIntegration({ webhookUrl: 'https://example.test/hook', secret: 'hunter2' });

        await webhook.send('level_up', { level: 2 });

        const [, request] = fetchMock.mock.calls[0];
        const signature = request.headers['X-Dopamine-Signature'];

        expect(signature).toBe(`sha256=${await hmacHex('hunter2', request.body)}`);
        expect(JSON.parse(request.body)).toMatchObject({ event: 'level_up', data: { level: 2 } });
        expect(request.body).not.toContain('signature');

        // The old header was base64("secret:payload").
        expect(signature).not.toContain(btoa('hunter2').slice(0, 8));
        expect(JSON.stringify(request)).not.toContain('hunter2');
    });

    it('should send unsigned when there is no secret', async () => {
        const webhook = new WebhookIntegration({ webhookUrl: 'https://example.test/hook' });

        await webhook.send('level_up', { level: 2 });

        expect(fetchMock.mock.calls[0][1].headers['X-Dopamine-Signature']).toBeUndefined();
    });

    it('should not settle a send until its own request has gone out', async () => {
        const webhook = new WebhookIntegration({ webhookUrl: 'https://example.test/hook', secret: 'hunter2' });

        webhook.send('level_up', { level: 2 });
        await webhook.send('level_up', { level: 3 });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should cap the queue while the endpoint is slow', async () => {
        let release;
        fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ ok: true }); }));
        const webhook = new WebhookIntegration({ webhookUrl: 'https://example.test/hook', maxQueue: 3 });

        const first = webhook.send('e', { n: 0 });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        for (let n = 1; n <= 10; n++) webhook.send('e', { n });

        expect(webhook.queue.length).toBe(3);

        release();
        await first;

        const sent = fetchMock.mock.calls.map(([, request]) => JSON.parse(request.body).data.n);
        expect(sent).toEqual([0, 8, 9, 10]);
    });

    it('should keep sending after a request fails', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock.mockRejectedValueOnce(new Error('offline'));
        const webhook = new WebhookIntegration({ webhookUrl: 'https://example.test/hook' });

        await webhook.send('a', {});
        await webhook.send('b', {});

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(webhook.sending).toBe(false);
        error.mockRestore();
    });
});

describe('RewardMiddleware', () => {
    it('should reject inherited property names as hook events', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const middleware = new RewardMiddleware();

        expect(() => middleware.use('constructor', () => {})).not.toThrow();
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe('LeaderboardPlugin', () => {
    let kernel;
    let fetchMock;

    beforeEach(() => {
        kernel = new DopamineKernel();
        fetchMock = vi.fn(async () => ({ ok: true }));
        vi.stubGlobal('fetch', fetchMock);
        delete LeaderboardPlugin.config;
    });

    afterEach(() => {
        kernel.destroy();
        vi.unstubAllGlobals();
        delete LeaderboardPlugin.config;
    });

    it('should send nothing until it is given an endpoint', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        kernel.plugins.use(LeaderboardPlugin);
        const rewards = await rewardsOn(kernel);

        await rewards.addXP(100);
        await rewards.unlockAchievement('first_game');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('should report level, total XP and the achievement id', async () => {
        kernel.plugins.use(LeaderboardPlugin.configure({
            webhookUrl: 'https://example.test/board',
            playerId: 'p1'
        }));
        const rewards = await rewardsOn(kernel);

        await rewards.addXP(100);
        await rewards.unlockAchievement('first_game');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

        const bodies = fetchMock.mock.calls.map(([, request]) => JSON.parse(request.body));
        expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/board');
        expect(bodies[0]).toMatchObject({ event: 'level_up', data: { playerId: 'p1', level: 2, xp: 100 } });
        expect(bodies[1]).toMatchObject({ event: 'achievement', data: { playerId: 'p1', achievementId: 'first_game' } });
    });

    it('should stop sending once the plugin is removed', async () => {
        kernel.plugins.use(LeaderboardPlugin.configure({ webhookUrl: 'https://example.test/board', playerId: 'p1' }));
        const rewards = await rewardsOn(kernel);

        kernel.plugins.remove('leaderboard');
        await rewards.addXP(100);

        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('BattlePassPlugin', () => {
    let kernel;

    beforeEach(() => {
        kernel = new DopamineKernel();
    });

    afterEach(() => {
        kernel.destroy();
    });

    it('should unlock tiers from the running XP total', async () => {
        const unlocked = [];
        kernel.events.on('battlepass:tier-unlocked', (tier) => unlocked.push(tier.reward));
        kernel.plugins.use(BattlePassPlugin);
        const rewards = await rewardsOn(kernel);

        await rewards.addXP(10);
        expect(unlocked).toEqual(['Bronze Badge']);

        await rewards.addXP(600);
        expect(unlocked).toEqual(['Bronze Badge', 'Silver Badge']);
    });

    it('should stop listening once removed and start unclaimed when used again', async () => {
        const unlocked = [];
        kernel.events.on('battlepass:tier-unlocked', (tier) => unlocked.push(tier.reward));
        kernel.plugins.use(BattlePassPlugin);
        const rewards = await rewardsOn(kernel);
        await rewards.addXP(10);

        kernel.plugins.remove('battle-pass');
        await rewards.addXP(600);
        expect(unlocked).toEqual(['Bronze Badge']);

        kernel.plugins.use(BattlePassPlugin);
        await rewards.addXP(1);
        expect(unlocked).toEqual(['Bronze Badge', 'Bronze Badge', 'Silver Badge']);
    });
});

describe('FeedbackSystem', () => {
    const setup = () => {
        const scene = { add: vi.fn() };
        const kernel = { systems: { get: () => ({ currentScene: scene }) } };
        const textOf = (call) => call[0].components.find((c) => c instanceof FloatingText);
        return { scene, feedback: new FeedbackSystem(kernel), textOf };
    };

    it('should use the colour of the effect type', () => {
        const { scene, feedback, textOf } = setup();

        feedback.trigger('oops', 0, 0);
        feedback.trigger('faster', 0, 0);
        feedback.trigger('oops', 0, 0, { color: '#123456' });
        feedback.trigger('custom', 0, 0, { text: 'Hi' });

        const colors = scene.add.mock.calls.map((call) => textOf(call).color);
        expect(colors).toEqual(['#FF4444', '#50fa7b', '#123456', '#FFFFFF']);
    });

    it('should cap confetti and ignore a count that is not a number', () => {
        const { scene, feedback } = setup();

        feedback.emitConfetti(0, 0, Infinity);
        feedback.emitConfetti(0, 0, 'lots');
        expect(scene.add).not.toHaveBeenCalled();

        feedback.emitConfetti(0, 0, 100000);
        expect(scene.add).toHaveBeenCalledTimes(500);
    });
});

describe('DebugOverlayPlugin', () => {
    it('should stop listening to ticks once removed', () => {
        const kernel = new DopamineKernel();
        kernel.plugins.use(DebugOverlayPlugin);

        kernel.events.emit('tick', { dt: 0 });
        expect(document.getElementById('dopamine-debug-overlay').textContent).toContain('FPS: 0');

        kernel.plugins.remove('debug-overlay');
        expect(document.getElementById('dopamine-debug-overlay')).toBeNull();

        // The tick handler reads the system list on every frame.
        const read = vi.spyOn(kernel.systems, 'getSystemNames');
        kernel.events.emit('tick', { dt: 0.016 });
        expect(read).not.toHaveBeenCalled();

        kernel.destroy();
    });
});

describe('WebGLParticleSystem', () => {
    const fakeGl = () => new Proxy({ calls: [] }, {
        get(target, prop) {
            if (prop in target) return target[prop];
            if (typeof prop === 'string' && prop === prop.toUpperCase()) return 1;
            return (...args) => {
                target.calls.push(prop);
                if (prop === 'getProgramParameter' || prop === 'getShaderParameter') return true;
                return {};
            };
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should stay inert when the browser has no WebGL', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const system = new WebGLParticleSystem({ maxParticles: 10 });

        expect(() => system.init({})).not.toThrow();
        system.emit({ count: 5 });
        expect(() => system.update(0.016)).not.toThrow();
        expect(() => system.destroy()).not.toThrow();
        expect(error).toHaveBeenCalledTimes(1);
    });

    it('should not loop forever on an unbounded confetti count', () => {
        const system = new WebGLParticleSystem({ maxParticles: 10 });

        system.confetti(0, 0, Infinity);

        expect(system.particleCount).toBe(10);
    });

    it('should fall back to the default size for a bad maxParticles', () => {
        expect(new WebGLParticleSystem({ maxParticles: -5 }).maxParticles).toBe(10000);
        expect(new WebGLParticleSystem({ maxParticles: Infinity }).maxParticles).toBe(10000);
        expect(new WebGLParticleSystem({ maxParticles: 'many' }).maxParticles).toBe(10000);
    });

    it('should skip drawing while the context is lost and rebuild when it returns', () => {
        const gl = fakeGl();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl);
        const system = new WebGLParticleSystem({ maxParticles: 10 });
        system.init({});
        system.emit({ count: 3, lifetime: 100 });

        const lost = new Event('webglcontextlost', { cancelable: true });
        system.canvas.dispatchEvent(lost);
        expect(lost.defaultPrevented).toBe(true);

        gl.calls.length = 0;
        system.update(0.016);
        expect(gl.calls).not.toContain('drawArrays');

        system.canvas.dispatchEvent(new Event('webglcontextrestored'));
        expect(gl.calls).toContain('createProgram');
        expect(gl.calls).toContain('createBuffer');

        system.update(0.016);
        expect(gl.calls).toContain('drawArrays');

        system.destroy();
    });
});

describe('removing a plugin', () => {
    let kernel;

    const fakeGl = () => new Proxy({}, {
        get(target, prop) {
            if (typeof prop === 'string' && prop === prop.toUpperCase()) return 1;
            return () => (prop === 'getProgramParameter' || prop === 'getShaderParameter' ? true : {});
        }
    });

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        kernel = new DopamineKernel({ canvas: document.createElement('canvas') });
    });

    afterEach(() => {
        kernel.destroy();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should unregister the feedback system with FeedbackPlugin', () => {
        kernel.plugins.use(FeedbackPlugin);
        expect(kernel.systems.get('feedback')).toBeInstanceOf(FeedbackSystem);

        kernel.plugins.remove('feedback-effects');

        expect(kernel.systems.has('feedback')).toBe(false);
    });

    it('should unregister the particle system with WebGLParticlePlugin', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(fakeGl);
        kernel.plugins.use(WebGLParticlePlugin);
        expect(kernel.systems.get('particles')).toBeInstanceOf(WebGLParticleSystem);

        kernel.plugins.remove('webgl-particles');

        expect(kernel.systems.has('particles')).toBe(false);
    });

    it('should unregister the audio system HowlerAudioPlugin put in place of another', () => {
        const original = { destroy: vi.fn() };
        kernel.systems.register('audio', original);
        kernel.plugins.use(HowlerAudioPlugin);
        const howler = kernel.systems.get('audio');
        expect(howler).not.toBe(original);

        kernel.plugins.remove('howler-audio');

        expect(kernel.systems.has('audio')).toBe(false);
    });
});

describe('WebGLParticlePlugin without WebGL', () => {
    let kernel;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        kernel = new DopamineKernel({ canvas: document.createElement('canvas') });
    });

    afterEach(() => {
        kernel.destroy();
        vi.restoreAllMocks();
    });

    it('should leave an existing particle system in place and say so', () => {
        const existing = { destroy: vi.fn() };
        kernel.systems.register('particles', existing);
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

        kernel.plugins.use(WebGLParticlePlugin);

        expect(kernel.systems.get('particles')).toBe(existing);
        expect(existing.destroy).not.toHaveBeenCalled();

        const logged = [...console.error.mock.calls, ...console.warn.mock.calls].flat().join(' ');
        expect(logged).toContain('WebGL is not supported');
        expect(logged).toContain('left in place');
        expect(logged).not.toMatch(/falling back/i);
    });

    it('should not remove a particle system it did not register when the plugin is removed', () => {
        const existing = { destroy: vi.fn() };
        kernel.systems.register('particles', existing);
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        kernel.plugins.use(WebGLParticlePlugin);

        kernel.plugins.remove('webgl-particles');

        expect(kernel.systems.get('particles')).toBe(existing);
    });

    it('should register nothing when there is no particle system', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

        kernel.plugins.use(WebGLParticlePlugin);

        expect(kernel.systems.has('particles')).toBe(false);
    });
});

describe('React state snapshot', () => {
    it('should report progress within the level', async () => {
        const storage = createMemoryStorage();
        storage.setItem('dopamine_player', JSON.stringify({ xp: 1250, level: 5 }));
        const rewards = new RewardSystem(new DataService({ storage }));
        await rewards.init();

        expect(buildState(rewards)).toMatchObject({ level: 5, xp: 1250, progress: 0.5 });
    });

    it('should return the empty state before init', () => {
        const rewards = new RewardSystem(new DataService({ storage: createMemoryStorage() }));

        expect(buildState(rewards)).toEqual({ player: {}, level: 1, xp: 0, progress: 0, achievements: [] });
    });
});
