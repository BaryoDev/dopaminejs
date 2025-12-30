/**
 * Reward System Module
 * Manages achievements, XP, levels, streaks, and rewards
 */

import { EventEmitter } from './EventEmitter.js';

export class RewardSystem extends EventEmitter {
    constructor(dataService, config = {}) {
        super();
        this.dataService = dataService;
        this.player = null;
        this.achievements = { ...this._initAchievements(), ...(config.achievements || {}) };
    }

    /**
     * Initialize the reward system for current player
     * @returns {Promise<Object>} Player data
     */
    async init() {
        this.player = await this.dataService.load('player', this._getDefaultPlayer());

        // Check daily streak
        this._updateDailyStreak();

        // Save updated player data
        await this.save();

        return this.player;
    }

    /**
     * Get default player data structure
     */
    _getDefaultPlayer() {
        return {
            name: 'Player',
            xp: 0,
            level: 1,
            totalGamesPlayed: 0,
            createdAt: Date.now(),
            lastPlayedAt: Date.now(),
            streak: {
                current: 1,
                longest: 1,
                lastPlayDate: this._getTodayDateString()
            },
            achievements: {}, // achievement_id: { unlockedAt: timestamp, seen: boolean }
            stats: {
                // Dynamic stats object, games will add their own keys
            }
        };
    }

    /**
     * Save player data
     */
    async save() {
        if (this.player) {
            this.player.lastPlayedAt = Date.now();
            await this.dataService.save('player', this.player);
        }
    }

    /**
     * Add XP and handle level ups
     * @param {number} amount - XP to add
     * @param {string} reason - Why XP was awarded (for notifications)
     * @returns {Object} { leveledUp: boolean, newLevel: number, xpGained: number }
     */
    async addXP(amount, reason = '') {
        const oldLevel = this.player.level;
        this.player.xp += amount;

        // Check for level up
        const newLevel = this._calculateLevel(this.player.xp);
        const leveledUp = newLevel > oldLevel;

        if (leveledUp) {
            this.player.level = newLevel;
        }

        await this.save();

        // Notify listeners
        this.emit('xp_gained', { amount, reason, leveledUp, newLevel });

        if (leveledUp) {
            this.emit('level_up', { oldLevel, newLevel });
        }

        return { leveledUp, newLevel, xpGained: amount };
    }

    /**
     * Calculate level from XP (exponential curve)
     */
    _calculateLevel(xp) {
        // Formula: XP = 50 * level * (level - 1)
        // Solving for level: level = (1 + sqrt(1 + 8*XP/50)) / 2
        const level = Math.floor((1 + Math.sqrt(1 + 8 * xp / 50)) / 2);
        return Math.max(1, level);
    }

    /**
     * Get XP needed for next level
     */
    getXPForNextLevel() {
        const nextLevel = this.player.level + 1;
        const xpNeeded = 50 * nextLevel * (nextLevel - 1);
        const currentLevelXP = 50 * this.player.level * (this.player.level - 1);
        return {
            total: xpNeeded,
            needed: xpNeeded - this.player.xp,
            progress: (this.player.xp - currentLevelXP) / (xpNeeded - currentLevelXP)
        };
    }

    /**
     * Record game result and award XP
     * @param {string} gameName - Unique ID for the game
     * @param {Object} result - Game-specific result data
     */
    async recordGame(gameName, result) {
        // Initialize stats for this game if not exists
        if (!this.player.stats[gameName]) {
            this.player.stats[gameName] = { totalPlays: 0, highScore: 0 };
        }

        const stats = this.player.stats[gameName];

        // Update stats
        stats.totalPlays++;
        this.player.totalGamesPlayed++;

        // Update high score if applicable
        if (result.score !== undefined && result.score > stats.highScore) {
            stats.highScore = result.score;
            this.emit('new_high_score', { gameName, score: result.score });
        }

        // Merge other result data into stats
        Object.keys(result).forEach(key => {
            if (key !== 'score') {
                stats[key] = (stats[key] || 0) + (typeof result[key] === 'number' ? result[key] : 0);
            }
        });

        // Base XP for playing
        let xp = 10;

        // Score-based bonus
        if (result.score) {
            xp += Math.floor(result.score / 5);
        }

        // Streak multiplier
        xp = Math.floor(xp * this.getStreakMultiplier());

        await this.addXP(xp, `Played ${gameName}`);

        // Check for achievements
        await this.checkAchievements(gameName, result);

        await this.save();
    }

    /**
     * Check and unlock achievements
     */
    async checkAchievements(gameName, result) {
        const unlockedAchievements = [];

        for (const [id, achievement] of Object.entries(this.achievements)) {
            // Skip if already unlocked
            if (this.player.achievements[id]) continue;

            // Check if achievement condition is met
            if (achievement.check(this.player, gameName, result)) {
                await this.unlockAchievement(id);
                unlockedAchievements.push(achievement);
            }
        }

        return unlockedAchievements;
    }

    /**
     * Unlock an achievement
     */
    async unlockAchievement(achievementId) {
        const achievement = this.achievements[achievementId];
        if (!achievement) return false;

        // Mark as unlocked
        this.player.achievements[achievementId] = {
            unlockedAt: Date.now(),
            seen: false
        };

        // Award XP
        await this.addXP(achievement.xp, `Achievement: ${achievement.name}`);

        this.emit('achievement_unlocked', achievement);
        await this.save();

        return true;
    }

    /**
     * Get all unlocked achievements
     */
    getUnlockedAchievements() {
        return Object.entries(this.player.achievements)
            .map(([id, data]) => ({
                ...this.achievements[id],
                id,
                ...data
            }));
    }

    /**
     * Get achievements user hasn't seen the notification for yet
     */
    getUnseenAchievements() {
        return this.getUnlockedAchievements().filter(a => !a.seen);
    }

    /**
     * Mark achievements as seen
     */
    async markAchievementsSeen(achievementIds) {
        for (const id of achievementIds) {
            if (this.player.achievements[id]) {
                this.player.achievements[id].seen = true;
            }
        }
        await this.save();
    }

    /**
     * Update daily streak
     */
    _updateDailyStreak() {
        const today = this._getTodayDateString();
        const lastPlayed = this.player.streak.lastPlayDate;

        if (lastPlayed === today) {
            // Already played today
            return;
        }

        const yesterday = this._getYesterdayDateString();

        if (lastPlayed === yesterday) {
            // Streak continues!
            this.player.streak.current++;
            if (this.player.streak.current > this.player.streak.longest) {
                this.player.streak.longest = this.player.streak.current;
            }
        } else {
            // Streak broken
            this.player.streak.current = 1;
        }

        this.player.streak.lastPlayDate = today;
    }

    /**
     * Get streak multiplier for XP
     */
    getStreakMultiplier() {
        const streak = this.player.streak.current;
        if (streak >= 7) return 2.0;  // 2× at 7 days
        if (streak >= 5) return 1.5;  // 1.5× at 5 days
        if (streak >= 3) return 1.25; // 1.25× at 3 days
        return 1.0;
    }

    /**
     * Get today's date as YYYY-MM-DD string
     */
    _getTodayDateString() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get yesterday's date as YYYY-MM-DD string
     */
    _getYesterdayDateString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    /**
     * Initialize achievement definitions
     * Can be extended by games
     */
    _initAchievements() {
        return {
            // Universal achievements
            'first_game': {
                name: 'First Steps',
                description: 'Play your first game',
                icon: '🎮',
                xp: 50,
                check: (player) => player.totalGamesPlayed >= 1
            },
            'level_5': {
                name: 'Rising Star',
                description: 'Reach level 5',
                icon: '⭐',
                xp: 100,
                check: (player) => player.level >= 5
            },
            'level_10': {
                name: 'Expert Player',
                description: 'Reach level 10',
                icon: '🏆',
                xp: 250,
                check: (player) => player.level >= 10
            },
            'streak_3': {
                name: 'Dedicated',
                description: 'Play 3 days in a row',
                icon: '🔥',
                xp: 100,
                check: (player) => player.streak.current >= 3
            },
            'streak_7': {
                name: 'Unstoppable',
                description: 'Play 7 days in a row',
                icon: '💥',
                xp: 300,
                check: (player) => player.streak.current >= 7
            }
        };
    }
}
