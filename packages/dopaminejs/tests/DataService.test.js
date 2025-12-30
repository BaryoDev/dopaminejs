```javascript
import { describe, it, expect, beforeEach } from 'vitest';
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
});
