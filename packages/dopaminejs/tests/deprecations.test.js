/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The deprecated v1 globals warned at module scope, so simply importing the
 * package printed three warnings even for consumers who never touch them.
 * A deprecation notice should cost you something only when you use the
 * deprecated thing.
 */
describe('deprecated globals', () => {
    let warn;

    beforeEach(() => {
        vi.resetModules();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        warn.mockRestore();
    });

    it('should not warn merely because the module was imported', async () => {
        await import('../src/index.js');

        expect(warn).not.toHaveBeenCalled();
    });

    it('should warn when a deprecated global is actually used', async () => {
        const { GlobalPhysics } = await import('../src/index.js');
        expect(warn).not.toHaveBeenCalled();

        GlobalPhysics.checkCollision;

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('GlobalPhysics is deprecated'));
    });

    it('should warn once per global, not on every access', async () => {
        const { GlobalInput } = await import('../src/index.js');

        GlobalInput.isKeyDown;
        GlobalInput.isKeyDown;
        GlobalInput.mouse;

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should still work as the underlying system', async () => {
        const { GlobalInput } = await import('../src/index.js');

        expect(typeof GlobalInput.isKeyDown).toBe('function');
        expect(GlobalInput.isKeyDown('a')).toBe(false);
    });
});
