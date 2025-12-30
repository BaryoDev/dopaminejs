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
        console.log('DopamineJS Initialized 🚀');
        return {
            rewardSystem: this.rewardSystem,
            gameUI: this.gameUI,
            particleSystem: this.particleSystem,
            soundManager: this.soundManager
        };
    }

    _bindEvents() {
        this.rewardSystem.on('xp_gained', (data) => {
            const { total, needed } = this.rewardSystem.getXPForNextLevel();
            this.gameUI.updateXP(this.rewardSystem.player.xp, needed, total);

            if (data.xpGained > 0) {
                // Show floating text for XP gain
                // We might need a way to know WHERE to show this, or just show it in a standard place
                // For now, let's just update the bar
            }
        });

        this.rewardSystem.on('level_up', (data) => {
            this.gameUI.updateLevel(data.newLevel);
            this.gameUI.showLevelUp(data.oldLevel, data.newLevel);
        });

        this.rewardSystem.on('achievement_unlocked', (achievement) => {
            this.gameUI.showAchievement(achievement);
        });

        this.rewardSystem.on('new_high_score', (data) => {
            this.gameUI.showNotification(`New High Score: ${data.score}!`, 'legendary');
            this.soundManager.playSuccess();
        });
    }
}
