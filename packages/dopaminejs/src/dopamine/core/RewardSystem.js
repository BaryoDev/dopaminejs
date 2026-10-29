/**
 * Reward System Module
 * Manages achievements, XP, levels, streaks, and rewards
 *
 * The saved player is a document that merges (see merge.js). Nothing hands
 * the document out: callers get frozen snapshots.
 */

import { EventEmitter } from './EventEmitter.js';
import { DopamineError } from './DopamineError.js';
import { systemClock } from './clock.js';
import { levelFor, thresholdFor } from './levels.js';
import { builtinAchievements, rewardsOf } from './achievements.js';
import { Middleware } from './middleware.js';
import { merge } from './merge.js';
import { currentStreak, longestRun, trimDays } from './streaks.js';
import {
    LEGACY, MAX_DEVICES, cap, deviceIds, emptyDoc, validate, view, xpOf, levelOf, clone, freeze, isSafeKey, hasOwn, isRecord
} from './store.js';

const DEVICE_KEY = 'device';

const randomId = () => {
    const bytes = new Uint8Array(8);
    const random = globalThis.crypto;
    if (typeof random?.getRandomValues === 'function') {
        random.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const isDeviceId = (id) => isSafeKey(id) && id !== LEGACY;

export class RewardSystem extends EventEmitter {
    /**
     * @param {Object} dataService - Persistence, see DataService
     * @param {Object} [config]
     * @param {Object} [config.achievements] - Extra achievement definitions
     * @param {{ now(): number, localDate(ms?: number): string }} [config.clock] - Time source
     * @param {'any'|'record'} [config.streakDays] - What marks today as a play day.
     *   'any' (default): record() or addXP(). 'record': record() only. XP from an
     *   achievement reward never marks a day.
     */
    constructor(dataService, config = {}) {
        super();
        this.dataService = dataService;
        this.clock = config.clock && typeof config.clock.now === 'function' && typeof config.clock.localDate === 'function'
            ? config.clock
            : systemClock;
        this.achievements = { ...builtinAchievements(), ...(config.achievements || {}) };
        this.streakDays = config.streakDays === 'record' ? 'record' : 'any';

        this._doc = null;
        this._deviceId = null;
        this._deviceSaved = false;
        this._middleware = new Middleware();

        // Write batching: one record is one write.
        this._batchDepth = 0;
        this._pendingSave = false;

        // Set when init() could not read storage. Saving stays off until a
        // later init() reads it, so the saved player is never replaced.
        this._loadFailed = false;
        this._readFailed = false;
    }

    /**
     * True when the last init() could not read the saved player, so nothing
     * is saved until init() is called again and the read works.
     * @returns {boolean}
     */
    get loadFailed() {
        return this._readFailed;
    }

    /**
     * Emit a frozen copy of the payload.
     * @private
     */
    _publish(event, data) {
        const payload = Object.freeze({ ...data });
        this.emit(event, payload);
    }

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

    _options() {
        return { now: this.clock.now(), today: this.clock.localDate(), rewards: rewardsOf(this.achievements) };
    }

    /**
     * Initialize the reward system for current player
     * @returns {Promise<Object>} Frozen snapshot of the player
     */
    async init() {
        const saved = await this._readSaved();
        // A failed retry keeps the progress made since the first init.
        if (!(this._loadFailed && this._doc)) this._doc = this._load(saved);
        await this._readDevice();
        await this.save();
        return this.snapshot();
    }

    /**
     * Read the saved player. A failed read turns off saving for this
     * session, so the new player built from the default never overwrites
     * the real one. Calling init() again retries the read.
     * @private
     */
    async _readSaved() {
        // Stay blocked until the read succeeds, so a write made while a
        // retry is in flight cannot land.
        this._loadFailed = true;
        try {
            const saved = await this.dataService.load('player', null, { strict: true });
            this._loadFailed = false;
            this._readFailed = false;
            return saved;
        } catch (error) {
            if (error?.code === 'DOPAMINE_CORRUPT') {
                // Keep the unreadable value instead of losing it on the next save.
                const kept = await this.dataService.save('player_corrupt', error.raw);
                if (kept) this._loadFailed = false;
                this._readFailed = !kept;
                this._publish('load_failed', { key: 'player', reason: 'corrupt', backedUp: kept });
                return null;
            }
            this._readFailed = true;
            this._publish('load_failed', { key: 'player', reason: 'read', error });
            return null;
        }
    }

    /**
     * Saved state is untrusted: it goes through validate. A document from a
     * newer version or with too many devices is left alone in storage.
     * @private
     */
    _load(saved) {
        if (!isRecord(saved)) return emptyDoc(this.clock.now());
        try {
            return validate(saved, this._options());
        } catch (error) {
            if (!(error instanceof DopamineError)) throw error;
            this._loadFailed = true;
            this._readFailed = true;
            this._publish('load_failed', { key: 'player', reason: error.code, error });
            return emptyDoc(this.clock.now());
        }
    }

    /**
     * The device id is made once, kept under its own key and never part of
     * the merged document.
     * @private
     */
    async _readDevice() {
        if (this._deviceId) return;
        let stored = null;
        try {
            stored = await this.dataService.load(DEVICE_KEY, null, { strict: true });
        } catch {
            // Unreadable: use a fresh id, saved with the first write that works.
            this._deviceId = randomId();
            return;
        }
        if (isDeviceId(stored)) {
            this._deviceId = stored;
            this._deviceSaved = true;
        } else {
            this._deviceId = randomId();
        }
    }

    /**
     * A write that would add a device past the cap is refused, so the stored
     * save never becomes one that validate rejects.
     * @private
     */
    _hasSlot() {
        const ids = deviceIds(this._doc);
        if (ids.has(this._deviceId) || ids.size < MAX_DEVICES) return true;
        this._publish('load_failed', { key: 'player', reason: 'too_many_devices' });
        return false;
    }

    _requirePlayer() {
        if (!this._doc) {
            throw new Error('[DopamineJS] RewardSystem.init() must be awaited before use');
        }
    }

    /**
     * A frozen copy of the player with the derived values: xp, level,
     * totalGamesPlayed, streak and per-activity stats.
     */
    snapshot() {
        this._requirePlayer();
        return freeze(view(this._doc, this.clock.localDate()));
    }

    /**
     * The versioned document, a detached copy.
     */
    export() {
        this._requirePlayer();
        return clone(this._doc);
    }

    /**
     * Merge a document from elsewhere into this player. It is validated the
     * same way a load is. Unless `silent`, the XP, level and achievements
     * that went up are announced.
     *
     * @param {Object} doc
     * @param {{ silent?: boolean }} [options]
     */
    async import(doc, { silent = false } = {}) {
        this._requirePlayer();
        const before = this.snapshot();
        const incoming = validate(doc, this._options());
        const merged = merge(this._doc, incoming, this._options());
        merged.level = levelOf(merged);
        this._doc = merged;

        const after = this.snapshot();
        await this.save();
        if (silent) return after;

        const gained = after.xp - before.xp;
        const leveledUp = after.level > before.level;
        if (gained > 0) {
            this._publish('xp_gained', {
                amount: gained, reason: 'import', leveledUp, newLevel: after.level, total: after.xp
            });
        }
        if (leveledUp) {
            this._publish('level_up', { oldLevel: before.level, newLevel: after.level, totalXP: after.xp });
        }
        for (const id of Object.keys(after.achievements)) {
            if (!hasOwn(before.achievements, id)) {
                this._publish('achievement_unlocked', { ...this.achievements[id], id });
            }
        }
        return after;
    }

    /**
     * Replace the player with a new one and save it. The device id stays, so
     * the new player counts under the same device. No event is emitted.
     *
     * This is an explicit request, so it also writes when the last init()
     * could not read the saved player: the stored player is replaced and
     * `loadFailed` goes back to false.
     *
     * @returns {Promise<Object>} Frozen snapshot of the new player
     */
    async reset() {
        this._requirePlayer();
        await this._batch(async () => {
            this._doc = emptyDoc(this.clock.now());
            this._loadFailed = false;
            this._readFailed = false;
            await this.save();
        });
        return this.snapshot();
    }

    /**
     * Add a middleware object with any of beforeXP, afterXP, beforeRecord,
     * afterRecord, beforeUnlock and afterUnlock. Hooks run in `use` order.
     * @returns {Function} Removes it again
     */
    use(middleware) {
        return this._middleware.use(middleware);
    }

    /**
     * Add an achievement rule at runtime.
     * @returns {Function} Removes it again
     */
    defineAchievement(id, definition) {
        if (!isSafeKey(id)) {
            throw new TypeError(`[DopamineJS] defineAchievement expects an id, received ${String(id)}`);
        }
        if (!isRecord(definition) || typeof definition.check !== 'function') {
            throw new TypeError('[DopamineJS] defineAchievement expects a definition with a check function');
        }
        const previous = hasOwn(this.achievements, id) ? this.achievements[id] : undefined;
        this.achievements[id] = definition;
        return () => {
            if (this.achievements[id] !== definition) return;
            if (previous) this.achievements[id] = previous;
            else delete this.achievements[id];
        };
    }

    /**
     * Save player data
     */
    async save() {
        if (!this._doc) return;

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
        if (this._loadFailed) return;
        this._doc.lastPlayedAt = this.clock.now();
        if (!this._deviceSaved) {
            this._deviceSaved = (await this.dataService.save(DEVICE_KEY, this._deviceId)) !== false;
        }
        const saved = await this.dataService.save('player', this._doc);

        // DataService logs and returns false rather than throwing, so a full
        // or blocked storage would otherwise lose progress without a sign.
        if (saved === false) {
            this._publish('save_failed', { key: 'player' });
        }
    }

    /**
     * Add XP and handle level ups. A negative amount is kept as XP spent on
     * this device and stops at zero.
     * @param {number} amount - XP to add
     * @param {string} reason - Why XP was awarded (for notifications)
     * @returns {Object} { leveledUp: boolean, newLevel: number, xpGained: number }
     */
    async addXP(amount, reason = '') {
        if (!Number.isFinite(amount)) {
            // Adding undefined/NaN here would poison the total permanently:
            // NaN survives every subsequent arithmetic op and gets persisted.
            throw new TypeError(`[DopamineJS] addXP expects a finite number, received ${amount}`);
        }

        this._requirePlayer();
        if (!this._hasSlot()) return { leveledUp: false, newLevel: levelOf(this._doc), xpGained: 0 };

        const context = await this._middleware.before('beforeXP', { amount, reason }, (next) => Number.isFinite(next.amount));
        if (context === false) {
            return { leveledUp: false, newLevel: levelOf(this._doc), xpGained: 0 };
        }

        if (this.streakDays === 'any' && context.amount > 0) this._markDay();

        const result = await this._applyXP(context.amount, context.reason, (doc, applied) => {
            if (applied >= 0) {
                doc.xpBy[this._deviceId] = cap((hasOwn(doc.xpBy, this._deviceId) ? doc.xpBy[this._deviceId] : 0) + applied);
            } else {
                doc.xpSpentBy[this._deviceId] = cap((hasOwn(doc.xpSpentBy, this._deviceId) ? doc.xpSpentBy[this._deviceId] : 0) - applied);
            }
        });

        await this._middleware.after('afterXP', {
            amount: result.xpGained, reason: context.reason, total: xpOf(this._doc), level: result.newLevel
        });
        return result;
    }

    /**
     * Change the total, then announce it. Levels are never taken back, so a
     * negative amount or a level banked under an older curve reports the
     * stored one.
     * @private
     */
    async _applyXP(amount, reason, change) {
        const doc = this._doc;
        const oldLevel = levelOf(doc);

        // XP stops at zero, so a large negative amount removes less than asked.
        amount = Math.max(amount, -xpOf(doc));
        change(doc, amount);
        return this._announceXP(oldLevel, amount, reason);
    }

    async _announceXP(oldLevel, amount, reason) {
        const doc = this._doc;
        const total = xpOf(doc);
        const newLevel = Math.max(oldLevel, levelFor(total));
        const leveledUp = newLevel > oldLevel;
        if (newLevel > doc.level) doc.level = newLevel;

        await this.save();

        this._publish('xp_gained', { amount, reason, leveledUp, newLevel, total });
        if (leveledUp) {
            this._publish('level_up', { oldLevel, newLevel, totalXP: total });
        }

        return { leveledUp, newLevel, xpGained: amount };
    }

    /**
     * Get XP needed for next level
     */
    getXPForNextLevel() {
        this._requirePlayer();

        const level = levelOf(this._doc);
        const xp = xpOf(this._doc);
        const xpNeeded = thresholdFor(level + 1);
        const currentLevelXP = thresholdFor(level);
        const band = xpNeeded - currentLevelXP;

        // Clamped: a level banked under an older curve can sit above its own
        // XP floor. Those players keep the level and start the band at 0.
        const progress = band > 0
            ? Math.max(0, Math.min(1, (xp - currentLevelXP) / band))
            : 0;

        return {
            total: xpNeeded,
            needed: Math.max(0, xpNeeded - xp),
            progress
        };
    }

    _checkRecord(activity, result) {
        if (!isSafeKey(activity)) {
            throw new TypeError(`[DopamineJS] record expects an activity name, received ${String(activity)}`);
        }

        if (!isRecord(result)) {
            throw new TypeError('[DopamineJS] record expects a result object');
        }

        // Checked before anything is touched, so a bad score cannot leave the
        // play counted and the XP missing.
        if (result.score !== undefined && !Number.isFinite(result.score)) {
            throw new TypeError(`[DopamineJS] record expects a finite score, received ${String(result.score)}`);
        }
    }

    /**
     * Record a play and award XP
     * @param {string} activity - Unique ID for the game or activity
     * @param {Object} result - Result data. `score` sets the best; other numbers add up.
     * @returns {Promise<boolean>} False when a beforeRecord hook rejected it
     */
    async record(activity, result = {}) {
        this._requirePlayer();
        this._checkRecord(activity, result);
        if (!this._hasSlot()) return false;

        const context = await this._middleware.before('beforeRecord', { activity, result }, (next) => {
            try {
                this._checkRecord(next.activity, next.result);
                return true;
            } catch {
                return false;
            }
        });
        if (context === false) return false;

        // Batched: addXP and each unlockAchievement below also save.
        const xp = await this._batch(() => this._record(context.activity, context.result));
        await this._middleware.after('afterRecord', { activity: context.activity, result: context.result, xp });
        return true;
    }

    /**
     * Count today as a play day. A new player starts at 1 without an event.
     * @private
     */
    _markDay() {
        const doc = this._doc;
        const today = this.clock.localDate();
        if (doc.playDates.includes(today)) return;
        const firstEver = doc.playDates.length === 0;
        doc.playDates = trimDays([...doc.playDates, today], today);
        doc.longest = Math.max(doc.longest, longestRun(doc.playDates));
        if (!firstEver) {
            this._publish('streak_updated', {
                current: currentStreak(doc.playDates, today),
                longest: Math.max(doc.longest, longestRun(doc.playDates))
            });
        }
    }

    /**
     * @private
     */
    async _record(activity, result) {
        const doc = this._doc;
        const device = this._deviceId;
        const bump = (map, by) => {
            map[device] = cap((hasOwn(map, device) ? map[device] : 0) + by);
        };

        this._markDay();

        if (!hasOwn(doc.playsBy, activity)) {
            doc.playsBy[activity] = {};
            doc.best[activity] = 0;
            doc.sumsBy[activity] = {};
        }

        bump(doc.playsBy[activity], 1);
        bump(doc.gamesBy, 1);

        if (result.score !== undefined && result.score > doc.best[activity]) {
            doc.best[activity] = result.score;
            this._publish('personal_best', { activity, score: result.score });
        }

        // Other numbers add up per device. A negative or non-numeric value
        // adds nothing, so a device's total only grows.
        for (const key of Object.keys(result)) {
            if (key === 'score' || key === 'plays' || key === 'best' || !isSafeKey(key)) continue;
            if (!hasOwn(doc.sumsBy[activity], key)) doc.sumsBy[activity][key] = {};
            bump(doc.sumsBy[activity][key], Number.isFinite(result[key]) && result[key] > 0 ? result[key] : 0);
        }

        // Base XP for playing
        let xp = 10;

        // Score-based bonus. A negative score earns nothing extra.
        if (result.score) {
            xp += Math.max(0, Math.floor(result.score / 5));
        }

        xp = Math.floor(xp * this.getStreakMultiplier());

        await this.addXP(xp, `Played ${activity}`);
        await this.checkAchievements(activity, result);
        await this.save();
        return xp;
    }

    /**
     * Check and unlock achievements
     */
    async checkAchievements(activity, result) {
        const unlockedAchievements = [];

        for (const [id, achievement] of Object.entries(this.achievements)) {
            // Skip if already unlocked
            if (hasOwn(this._doc.achievements, id)) continue;

            // Check conditions are user-supplied; one throwing must not stop
            // the others from ever unlocking.
            let met = false;
            try {
                met = achievement.check(this.snapshot(), activity, result);
            } catch (error) {
                console.error(`[DopamineJS] Achievement "${id}" check threw:`, error);
                continue;
            }

            if (met && await this.unlockAchievement(id)) {
                unlockedAchievements.push(achievement);
            }
        }

        return unlockedAchievements;
    }

    /**
     * Unlock an achievement
     */
    async unlockAchievement(achievementId) {
        this._requirePlayer();

        if (!isSafeKey(achievementId) || !hasOwn(this.achievements, achievementId)) return false;

        // Already unlocked: paying the XP again would let one call farm levels.
        if (hasOwn(this._doc.achievements, achievementId)) return false;

        const achievement = this.achievements[achievementId];
        if (!achievement) return false;

        const { [achievementId]: reward } = rewardsOf(this.achievements);
        const context = await this._middleware.before(
            'beforeUnlock',
            { id: achievementId, reward },
            (next) => Number.isFinite(next.reward) && next.reward >= 0
        );
        if (context === false) return false;

        const doc = this._doc;
        const oldLevel = levelOf(doc);
        doc.achievements[achievementId] = { unlockedAt: this.clock.now(), seen: false, reward: context.reward };

        // The reward is part of the achievement, not of any device's XP.
        await this._announceXP(oldLevel, context.reward, `Achievement: ${achievement.name}`);

        this._publish('achievement_unlocked', { ...achievement, id: achievementId });
        await this.save();
        await this._middleware.after('afterUnlock', { id: achievementId, reward: context.reward });

        return true;
    }

    /**
     * Get all unlocked achievements
     */
    getUnlockedAchievements() {
        this._requirePlayer();
        return Object.entries(this._doc.achievements)
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
            if (hasOwn(this._doc.achievements, id)) {
                this._doc.achievements[id].seen = true;
            }
        }
        await this.save();
    }

    /**
     * Get streak multiplier for XP
     */
    getStreakMultiplier() {
        const streak = this.snapshot().streak.current;
        if (streak >= 7) return 2.0;  // 2× at 7 days
        if (streak >= 5) return 1.5;  // 1.5× at 5 days
        if (streak >= 3) return 1.25; // 1.25× at 3 days
        return 1.0;
    }
}
