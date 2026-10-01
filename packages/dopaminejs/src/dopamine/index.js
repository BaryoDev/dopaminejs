import { RewardSystem } from './core/RewardSystem.js';
import { DataService } from './core/DataService.js';
import { GameUI } from './ui/GameUI.js';
import { ParticleSystem } from './effects/ParticleSystem.js';
import { SoundManager } from './audio/SoundManager.js';
import './ui/dopamine.css';

export { RewardSystem, DataService, GameUI, ParticleSystem, SoundManager };

export default class Dopamine {
    constructor(config = {}) {
        this.config = config;

        // Initialize subsystems with config
        this.dataService = new DataService(config.data || {});
        this.rewardSystem = new RewardSystem(this.dataService, config.rewards || {});
        this.soundManager = new SoundManager(config.sound || {});
        this.particleSystem = new ParticleSystem(config.particles || {});
        this.gameUI = new GameUI(this.particleSystem);

        // Bind UI to RewardSystem events
        this._bindEvents();
    }

    async init() {
        await this.rewardSystem.init();
        this._syncUI();
        return {
            rewardSystem: this.rewardSystem,
            gameUI: this.gameUI,
            particleSystem: this.particleSystem,
            soundManager: this.soundManager
        };
    }

    /**
     * Draw the loaded player. Without this the overlay keeps its placeholder
     * (level 1, 0 XP, streak 1) until the first event arrives.
     * @private
     */
    _syncUI() {
        const { player } = this.rewardSystem;
        const { total, needed, progress } = this.rewardSystem.getXPForNextLevel();

        this.gameUI.updateXP(player.xp, needed, total, progress);
        this.gameUI.updateLevel(player.level);
        this.gameUI.updateStreak(player.streak.current);
    }

    _bindEvents() {
        const rewards = this.rewardSystem;

        this._unsubscribe = [
            rewards.on('xp_gained', () => {
                const { total, needed, progress } = rewards.getXPForNextLevel();
                this.gameUI.updateXP(rewards.player.xp, needed, total, progress);
            }),

            rewards.on('level_up', (data) => {
                this.gameUI.updateLevel(data.newLevel);
                this.gameUI.showLevelUp(data.oldLevel, data.newLevel);
            }),

            rewards.on('achievement_unlocked', (achievement) => {
                this.gameUI.showAchievement(achievement);
            }),

            rewards.on('streak_updated', (data) => {
                this.gameUI.updateStreak(data.current);
            }),

            rewards.on('new_high_score', (data) => {
                this.gameUI.showNotification(`New High Score: ${data.score}!`, 'legendary');
                this.soundManager.playSuccess();
            })
        ];
    }

    /**
     * Remove the overlay and canvas, stop audio, and detach from the reward
     * system. The reward system itself stays usable.
     */
    destroy() {
        for (const unsubscribe of this._unsubscribe) {
            unsubscribe();
        }
        this._unsubscribe = [];

        this.gameUI.destroy();
        this.particleSystem.destroy();
        this.soundManager.destroy();
    }
}
