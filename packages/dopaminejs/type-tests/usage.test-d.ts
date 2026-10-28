/**
 * Compile-only check for the public type declarations.
 *
 * Never executed. `npm run typecheck` runs tsc over it, so anything the
 * declarations get wrong about the API surface fails the build. Written the
 * way a consumer would actually use the library, not to maximise coverage.
 */

import {
    createDopamine,
    HOST_API,
    RewardSystem,
    DataService,
    RewardUI,
    ParticleSystem,
    SoundManager,
    createMemoryStorage,
    type Player,
    type AchievementDefinition,
    type DopaminePlugin,
    type PluginContext
} from '../types/index.js';
import {
    RewardSystem as CoreRewardSystem,
    DataService as CoreDataService,
    EventEmitter as CoreEmitter,
    createMemoryStorage as createCoreMemoryStorage,
    resolveStorage as resolveCoreStorage,
    type StorageLike as CoreStorage
} from '../types/core.js';
// The web-only layer is not part of the core entry, so this must not compile.
// @ts-expect-error
import { RewardUI as CoreRewardUI } from '../types/core.js';

void CoreRewardUI;

// The zero-config path.
async function quickstart(): Promise<void> {
    const dopamine = await createDopamine().ready;

    const result = await dopamine.progress.addXP(50, 'level cleared');
    if (result.leveledUp) {
        dopamine.parts.ui?.popup({ kind: 'level', body: String(result.newLevel) });
    }

    const { progress, needed, total } = dopamine.progress.getXPForNextLevel();
    dopamine.parts.ui?.hud({ xp: total - needed, level: 1, progress, streak: 1, next: total });

    await dopamine.progress.record('breakout', { score: 4200, deaths: 2 });
    dopamine.dispose();
}

// Custom achievements, including one that omits xp.
const achievements: Record<string, AchievementDefinition> = {
    die_100_times: {
        name: 'You Tried',
        description: 'Lose 100 times',
        icon: '<img src="skull.png" width="20">',
        xp: 50,
        check: (player: Player) => (player.stats.breakout?.deaths ?? 0) >= 100
    },
    quiet_win: {
        name: 'Quiet Win',
        check: () => true
    }
};

// Parts, a factory that falls back, and injected storage.
async function wiredUp(): Promise<void> {
    const data = new DataService({ storage: createMemoryStorage(), prefix: 'game_' });
    const rewards = new RewardSystem(data, { achievements });
    const host = createDopamine({
        progress: rewards,
        particles: () => null,
        sound: false,
        ui: (env) => (env.hasDom ? new RewardUI({ particles: null }, { injectCss: true }) : null)
    });
    await host.ready;

    const unsubscribe = host.events.on('xp_gained', () => { });
    unsubscribe();

    // @ts-expect-error parts has getters only
    host.parts.ui = null;
}

// A plugin.
const logger: DopaminePlugin = {
    name: 'logger',
    version: '1.0.0',
    api: HOST_API,
    requires: ['ui'],
    install(ctx: PluginContext) {
        const off = ctx.events.on('level_up', () => ctx.log.info('level up'));
        ctx.events.emit('logger:ready', {});
        void ctx.storage.getItem('seen');
        ctx.expose({ off });
        return off;
    }
};

// @ts-expect-error api must be 3
const wrongApi: DopaminePlugin = { name: 'x', version: '1', api: 2, install() { } };
void wrongApi;

function plugins(): void {
    const host = createDopamine({ plugins: [logger] });
    const remove: () => void = host.use({
        name: 'later',
        version: '1.0.0',
        api: 3,
        after: ['logger'],
        async install(ctx) {
            void ctx.plugin('logger');
        }
    });
    remove();
}

// Particles, audio and the UI.
function effectsAndSound(): void {
    const particles = new ParticleSystem({ container: '#game', zIndex: '10' });
    particles.confetti(100, 100, 40);
    particles.burst('stars', { x: 5, y: 5 }, { count: 8 });
    particles.emit({ x: 10, y: 10, count: 5, color: '#f00' });
    particles.registerEffect('blood', (x, y) => void [x, y]);
    particles.play('blood', { x: 1, y: 2 });
    particles.destroy();

    const sound = new SoundManager({ volume: 0.5 });
    if (sound.initAudio()) {
        sound.setVolume(0.8);
        void sound.play('personal_best');
    }

    const ui = new RewardUI({ particles });
    const custom = new RewardUI({ particles }, {
        text: { levelUp: 'Level!' },
        icons: { streak: document.createElement('span') },
        safeIcons: false
    });
    custom.destroy();
    ui.popup({ kind: 'achievement', title: 'First win', body: 'Win once', icon: 'trophy', tier: 'rare' });
    ui.text({ text: '+50 XP', x: 10, y: 20, color: '#fff' });
    const root: HTMLElement | null = ui.root;
    void root;
}

function coreEntry(): void {
    const rewards = new CoreRewardSystem(new CoreDataService({ storage: createCoreMemoryStorage() }));
    const stop = rewards.on('level_up', () => { });
    stop();
    void new CoreEmitter();
    const store: CoreStorage = resolveCoreStorage();
    void store;
}

void quickstart;
void wiredUp;
void plugins;
void effectsAndSound;
void coreEntry;

// The games and testing entries.
import { gameFeedback } from '../types/games.js';
import { createTestHost, conformance, loadFixtures } from '../types/testing.js';

async function gamesAndTesting(): Promise<void> {
    const games = gameFeedback({ text: { gameOver: 'Run over', exit: '' } });
    const test = createTestHost({ clock: '2026-03-01T10:00:00', plugins: [games] });
    await test.ready;
    games.combo(3, 10, 20);
    games.summary({ score: 120, metrics: { Coins: 4 }, onExit: () => {} });
    test.advanceDays(1);
    const kinds: string[] = test.bursts.map((b) => b.kind);
    const logged: string[] = test.events.log.map((e) => e.event);
    const contract: number = loadFixtures().contract;
    void kinds;
    void logged;
    void contract;
    conformance.plugin(() => gameFeedback());
    conformance.storage(() => createMemoryStorage());
}

void gamesAndTesting;
