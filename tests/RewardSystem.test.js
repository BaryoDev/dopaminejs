import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RewardSystem } from '../src/core/RewardSystem';
import { DataService } from '../src/core/DataService';

describe('RewardSystem', () => {
    let rewardSystem;
    let mockDataService;

    beforeEach(async () => {
        mockDataService = new DataService({
            storage: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn()
            }
        });

        // Mock load to return default player
        mockDataService.load = vi.fn().mockImplementation((key, def) => Promise.resolve(def));
        mockDataService.save = vi.fn().mockResolvedValue(true);

        rewardSystem = new RewardSystem(mockDataService);
        await rewardSystem.init();
    });

    it('should initialize with default player data', () => {
        expect(rewardSystem.player).toBeDefined();
        expect(rewardSystem.player.level).toBe(1);
        expect(rewardSystem.player.xp).toBe(0);
    });

    it('should add XP and level up', async () => {
        const xpAmount = 100; // Enough for level 2 (needs 100 XP: 50 * 2 * 1)
        // Wait, formula is XP = 50 * level * (level - 1)
        // Level 1: 0 XP
        // Level 2: 50 * 2 * 1 = 100 XP needed total?
        // Let's check getXPForNextLevel logic.
        // nextLevel = 2. xpNeeded = 50 * 2 * 1 = 100.

        const result = await rewardSystem.addXP(100);

        expect(result.xpGained).toBe(100);
        expect(result.leveledUp).toBe(true);
        expect(result.newLevel).toBe(2);
        expect(rewardSystem.player.level).toBe(2);
    });

    it('should emit events when adding XP', async () => {
        const spy = vi.fn();
        rewardSystem.on('xp_gained', spy);

        await rewardSystem.addXP(10);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            amount: 10,
            leveledUp: false
        }));
    });

    it('should unlock achievements', async () => {
        const achievementSpy = vi.fn();
        rewardSystem.on('achievement_unlocked', achievementSpy);

        // 'first_game' achievement requires 1 game played
        await rewardSystem.recordGame('test_game', { score: 10 });

        expect(rewardSystem.player.totalGamesPlayed).toBe(1);
        expect(rewardSystem.player.achievements['first_game']).toBeDefined();
        expect(achievementSpy).toHaveBeenCalled();
    });
});
