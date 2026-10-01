import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataService } from '../src/dopamine/core/DataService.js';

describe('DataService', () => {
    let dataService;
    let mockStorage;

    beforeEach(() => {
        mockStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        dataService = new DataService({ storage: mockStorage });
    });

    it('should save data with prefix', async () => {
        const key = 'test';
        const data = { foo: 'bar' };

        await dataService.save(key, data);

        expect(mockStorage.setItem).toHaveBeenCalledWith(
            'dopamine_test',
            JSON.stringify(data)
        );
    });

    it('should load data with prefix', async () => {
        const key = 'test';
        const data = { foo: 'bar' };
        mockStorage.getItem.mockReturnValue(JSON.stringify(data));

        const result = await dataService.load(key);

        expect(mockStorage.getItem).toHaveBeenCalledWith('dopamine_test');
        expect(result).toEqual(data);
    });

    it('should return default value if data not found', async () => {
        mockStorage.getItem.mockReturnValue(null);

        const result = await dataService.load('missing', 'default');

        expect(result).toBe('default');
    });

    it('should write to synchronous storage before save returns', () => {
        dataService.save('test', { foo: 'bar' });

        expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should keep overlapping writes in call order on promise storage', async () => {
        const stored = {};
        const inFlight = [];
        const service = new DataService({
            storage: {
                getItem: (key) => Promise.resolve(stored[key] ?? null),
                setItem: (key, value) => new Promise((resolve) => {
                    inFlight.push(() => { stored[key] = value; resolve(); });
                }),
                removeItem: () => Promise.resolve()
            }
        });

        const first = service.save('player', { xp: 10 });
        const second = service.save('player', { xp: 30 });

        // Finish the newest request first, the way a slow network can.
        while (inFlight.length > 0) {
            inFlight.pop()();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        await Promise.all([first, second]);

        expect(await service.load('player')).toEqual({ xp: 30 });
    });
});
