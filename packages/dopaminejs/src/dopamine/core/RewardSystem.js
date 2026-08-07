/**
 * Reward System Module
 * Manages achievements, XP, levels, streaks, and rewards
 */

import { EventEmitter } from './EventEmitter.js';

export class RewardSystem extends EventEmitter {
    /**
     * @param {Object} dataService - Persistence, see DataService
     * @param {Object} [config]
     * @param {Object} [config.achievements] - Extra achievement definitions
     * @param {Object} [config.events] - Kernel EventBus to mirror events onto
     * @param {Object} [config.kernel] - Kernel; its `events` bus is used if present
     */
    constructor(dataService, config = {}) {
        super();
        this.dataService = dataService;
        this.player = null;
        this.achievements = { ...this._initAchievements(), ...(config.achievements || {}) };

        // Optional bridge to the kernel bus. EventBus.Events already declared
        // XP_GAINED, LEVEL_UP and ACHIEVEMENT_UNLOCKED with nothing emitting
        // them; this connects the two event systems without changing the
        // existing rewardSystem.on(...) surface that games already use.
        this.events = config.events || config.kernel?.events || null;

        // Write batching. Every mutation used to hit storage directly, so one
        // recordGame produced four full serializations of the player object.
        this._batchDepth = 0;
        this._pendingSave = false;
    }

    /**
     * Emit locally, and mirror onto the kernel bus when one is attached.
     * @private
     */
    _publish(event, data) {
        this.emit(event, data);
        if (this.events) {
            this.events.emit(event, data);
        }
    }

    /**
     * Run `fn` with saves collapsed into a single write at the end.
     *
     * Nested batches are counted, so an inner operation that batches on its
     * own still results in exactly one write for the outermost call.
     *
     * @param {Function} fn
     * @private
     */
    async _batch(fn) {
        this._batchDepth++;
        try {
            return await fn();
        } finally {
            this._batchDepth--;
            if (this._batchDepth === 0 && this._pendingSave) {
                this._pendingSave = false;
                await this._write();
            }
        }
    }

    /**
     * Initialize the reward system for current player
     * @returns {Promise<Object>} Player data
     */
    async init() {
        const saved = await this.dataService.load('player', null);
        this.player = this._migrate(saved);

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
     * Merge a persisted player record onto the current default shape.
     *
     * Saves written by older versions are missing whatever fields were added
     * since. Without this the first property access on a new field throws
     * before the game has drawn a frame.
     *
     * @param {Object|null} saved - Previously persisted player, if any
     * @returns {Object} Player object guaranteed to have every field
     * @private
     */
    _migrate(saved) {
        const defaults = this._getDefaultPlayer();

        if (!saved || typeof saved !== 'object') {
            return defaults;
        }

        return {
            ...defaults,
            ...saved,
            streak: { ...defaults.streak, ...(saved.streak || {}) },
            achievements: saved.achievements || {},
            stats: saved.stats || {}
        };
    }

    /**
     * Save player data
     */
    async save() {
        if (!this.player) return;

        // Inside a batch, mark dirty and let the outermost call do the write.
        if (this._batchDepth > 0) {
            this._pendingSave = true;
            return;
        }

        await this._write();
    }

    /**
     * The actual persistence call. Bypasses batching.
     * @private
     */
    async _write() {
        this.player.lastPlayedAt = Date.now();
        await this.dataService.save('player', this.player);
    }

    /**
     * Add XP and handle level ups
     * @param {number} amount - XP to add
     * @param {string} reason - Why XP was awarded (for notifications)
     * @returns {Object} { leveledUp: boolean, newLevel: number, xpGained: number }
     */
    async addXP(amount, reason = '') {
        if (!Number.isFinite(amount)) {
            // Adding undefined/NaN here would poison player.xp permanently:
            // NaN survives every subsequent arithmetic op and gets persisted.
            throw new TypeError(`[DopamineJS] addXP expects a finite number, received ${amount}`);
        }

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
        this._publish('xp_gained', { amount, reason, leveledUp, newLevel });

        if (leveledUp) {
            this._publish('level_up', { oldLevel, newLevel });
        }

        return { leveledUp, newLevel, xpGained: amount };
    }

    /**
     * Calculate level from XP (exponential curve)
     */
    _calculateLevel(xp) {
        // Curve: XP = 50 * level * (level - 1)
        // 50L² - 50L - xp = 0  =>  L = (1 + sqrt(1 + 4*xp/50)) / 2
        const level = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2);
        return Math.max(1, level);
    }

    /**
     * Get XP needed for next level
     */
    getXPForNextLevel() {
        const nextLevel = this.player.level + 1;
        const xpNeeded = 50 * nextLevel * (nextLevel - 1);
        const currentLevelXP = 50 * this.player.level * (this.player.level - 1);
        const band = xpNeeded - currentLevelXP;

        // Clamped: a save written before the curve fix banked levels at half
        // the XP, so player.xp can sit below its own level's floor. Those
        // players keep the level they earned and start the band at 0.
        const progress = band > 0
            ? Math.max(0, Math.min(1, (this.player.xp - currentLevelXP) / band))
            : 0;

        return {
            total: xpNeeded,
            needed: Math.max(0, xpNeeded - this.player.xp),
            progress
        };
    }

    /**
     * Record game result and award XP
     * @param {string} gameName - Unique ID for the game
     * @param {Object} result - Game-specific result data
     */
    async recordGame(gameName, result) {
        // Batched: addXP and each unlockAchievement below also save, which
        // meant four full serializations of the player object per game.
        return this._batch(() => this._recordGame(gameName, result));
    }

    /**
     * @private
     */
    async _recordGame(gameName, result) {
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
            this._publish('new_high_score', { gameName, score: result.score });
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

            // Check conditions are user-supplied; one throwing must not stop
            // the others from ever unlocking.
            let met = false;
            try {
                met = achievement.check(this.player, gameName, result);
            } catch (error) {
                console.error(`[DopamineJS] Achievement "${id}" check threw:`, error);
                continue;
            }

            if (met) {
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

        // Award XP. `xp` is optional in a user-defined achievement.
        await this.addXP(Number.isFinite(achievement.xp) ? achievement.xp : 0,
            `Achievement: ${achievement.name}`);

        this._publish('achievement_unlocked', achievement);
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
     * Format a Date as a YYYY-MM-DD string in the player's local timezone.
     *
     * Deliberately not toISOString(), which formats in UTC. For anyone east or
     * west of Greenwich that shifts the calendar day for part of every day and
     * makes streaks reset or double-count.
     *
     * @param {Date} date
     * @returns {string}
     * @private
     */
    _toLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get today's local date as YYYY-MM-DD string
     */
    _getTodayDateString() {
        return this._toLocalDateString(new Date());
    }

    /**
     * Get yesterday's local date as YYYY-MM-DD string
     */
    _getYesterdayDateString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this._toLocalDateString(yesterday);
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
