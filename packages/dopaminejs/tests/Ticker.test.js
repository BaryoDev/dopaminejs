/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Ticker } from '../src/systems/Ticker.js';

describe('Ticker', () => {
    let ticker;
    let frames;
    let nextHandle;

    beforeEach(() => {
        frames = new Map();
        nextHandle = 1;

        // Manual frame pump: nothing runs until we call flush().
        vi.stubGlobal('requestAnimationFrame', (cb) => {
            const handle = nextHandle++;
            frames.set(handle, cb);
            return handle;
        });
        vi.stubGlobal('cancelAnimationFrame', (handle) => {
            frames.delete(handle);
        });

        ticker = new Ticker();
    });

    afterEach(() => {
        ticker.stop();
        vi.unstubAllGlobals();
    });

    /** Run every currently-queued frame callback once. */
    const flush = (time) => {
        const queued = [...frames.entries()];
        frames.clear();
        for (const [, cb] of queued) {
            cb(time);
        }
        return queued.length;
    };

    it('should call registered callbacks once per frame', () => {
        const spy = vi.fn();
        ticker.add(spy);
        ticker.start();

        flush(1016);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not start a second frame loop when start is called twice', () => {
        const spy = vi.fn();
        ticker.add(spy);

        ticker.start();
        ticker.start();
        flush(1016);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not double-step when restarted before the pending frame fires', () => {
        const spy = vi.fn();
        ticker.add(spy);

        ticker.start();
        ticker.stop();   // pending frame is still queued at this point
        ticker.start();  // must not leave two live chains
        flush(1016);
        flush(1032);

        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should cancel the pending frame on stop', () => {
        ticker.start();
        ticker.stop();

        expect(frames.size).toBe(0);
    });
});
