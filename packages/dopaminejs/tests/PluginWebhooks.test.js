import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { webhooks, WebhookIntegration } from '../../plugin-ecosystem/src/index.js';
import { createTestHost, conformance } from '../src/testing.js';

const URL = 'https://example.com/hook';
const LEVEL = { oldLevel: 1, newLevel: 2, totalXP: 100 };

let hosts = [];
afterEach(() => {
    for (const test of hosts) test.dispose();
    hosts = [];
    vi.unstubAllGlobals();
});

const fakeFetch = () => {
    const calls = [];
    const send = async (url, init) => {
        calls.push({ url, ...init });
        return { ok: true, statusText: 'OK' };
    };
    return { calls, send };
};

const start = async (options, host = {}) => {
    const test = createTestHost({ plugins: [webhooks(options)], ...host });
    hosts.push(test);
    await test.ready;
    return test;
};

describe('webhooks', () => {
    it('posts a signed body on a core event', async () => {
        const { calls, send } = fakeFetch();
        const plugin = webhooks({ url: URL, secret: 'shh', fetch: send });
        const test = createTestHost({ plugins: [plugin] });
        hosts.push(test);
        await test.ready;

        test.progress.emit('level_up', LEVEL);
        await plugin.flush();

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(URL);
        expect(calls[0].method).toBe('POST');
        expect(JSON.parse(calls[0].body)).toEqual({
            event: 'level_up',
            data: LEVEL,
            timestamp: test.clock.now()
        });
        const expected = createHmac('sha256', 'shh').update(calls[0].body).digest('hex');
        expect(calls[0].headers['X-Dopamine-Signature']).toBe(`sha256=${expected}`);
    });

    it('sends only the events it was given', async () => {
        const { calls, send } = fakeFetch();
        const plugin = webhooks({ url: URL, events: ['streak_updated'], fetch: send });
        const test = createTestHost({ plugins: [plugin] });
        hosts.push(test);
        await test.ready;

        test.progress.emit('level_up', LEVEL);
        test.progress.emit('streak_updated', { current: 2, longest: 2 });
        await plugin.flush();

        expect(calls.map((c) => JSON.parse(c.body).event)).toEqual(['streak_updated']);
        expect(calls[0].headers).not.toHaveProperty('X-Dopamine-Signature');
    });

    it('unsigned send warns once', async () => {
        vi.stubGlobal('crypto', {});
        const { calls, send } = fakeFetch();
        const warn = vi.fn();
        const plugin = webhooks({ url: URL, secret: 'shh', fetch: send });
        const test = createTestHost({ plugins: [plugin], log: { warn } });
        hosts.push(test);
        await test.ready;

        test.progress.emit('level_up', LEVEL);
        test.progress.emit('level_up', LEVEL);
        await plugin.flush();

        expect(calls).toHaveLength(2);
        expect(calls[0].headers).not.toHaveProperty('X-Dopamine-Signature');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('crypto.subtle');
    });

    it('dispose flushes and removes listeners', async () => {
        const calls = [];
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const send = async (url, init) => {
            calls.push(init.body);
            await gate;
            return { ok: true, statusText: 'OK' };
        };
        const plugin = webhooks({ url: URL, fetch: send });
        const test = createTestHost();
        hosts.push(test);
        await test.ready;
        const count = () => [...test.progress.listeners.values()].reduce((sum, set) => sum + set.size, 0);
        const before = count();
        const dispose = test.use(plugin);
        expect(count()).toBe(before + 3);

        test.progress.emit('level_up', LEVEL);
        test.progress.emit('level_up', LEVEL);
        dispose();
        expect(count()).toBe(before);
        test.progress.emit('level_up', LEVEL);

        release();
        await plugin.flush();
        expect(calls).toHaveLength(2);
    });

    it('sends nothing and says so without a url', async () => {
        const { calls, send } = fakeFetch();
        const warn = vi.fn();
        const test = createTestHost({ plugins: [webhooks({ fetch: send })], log: { warn } });
        hosts.push(test);
        await test.ready;

        test.progress.emit('level_up', LEVEL);

        expect(calls).toHaveLength(0);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('drops the oldest body past maxQueue', async () => {
        const calls = [];
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const hook = new WebhookIntegration({
            webhookUrl: URL,
            maxQueue: 2,
            fetch: async (url, init) => { calls.push(JSON.parse(init.body).data); await gate; return { ok: true }; }
        });

        for (const n of [1, 2, 3, 4]) hook.send('level_up', n);
        release();
        await hook.flush();

        expect(calls).toEqual([1, 3, 4]);
    });

    it('does not export the 2.x plugins', async () => {
        const mod = await import('../../plugin-ecosystem/src/index.js');
        expect(Object.keys(mod).sort()).toEqual(['WebhookIntegration', 'webhooks']);
    });
});

describe('webhooks plugin shape', () => {
    it('is a 3.0 plugin', () => {
        const plugin = webhooks({ url: URL });
        expect(plugin).toMatchObject({ name: 'webhooks', api: 3 });
        expect(typeof plugin.install).toBe('function');
    });
});

conformance.plugin(() => webhooks({ url: URL, secret: 'shh', fetch: fakeFetch().send }));
