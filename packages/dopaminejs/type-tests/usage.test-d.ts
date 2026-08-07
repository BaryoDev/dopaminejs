/**
 * Compile-only check for the public type declarations.
 *
 * Never executed. `npm run typecheck` runs tsc over it, so anything the
 * declarations get wrong about the API surface fails the build. Written the
 * way a consumer would actually use the library, not to maximise coverage.
 */

import Dopamine, {
    RewardSystem,
    DataService,
    GameUI,
    ParticleSystem,
    SoundManager,
    DopamineKernel,
    EventBus,
    Game,
    Scene,
    GameObject,
    Component,
    Vector2,
    Collider,
    createMemoryStorage,
    type Player,
    type AchievementDefinition,
    type Plugin
} from '../types/index.js';

// The zero-config path.
async function quickstart(): Promise<void> {
    const dopamine = new Dopamine();
    const { rewardSystem, gameUI } = await dopamine.init();

    const result = await rewardSystem.addXP(50, 'level cleared');
    if (result.leveledUp) {
        gameUI.showLevelUp(result.newLevel - 1, result.newLevel);
    }

    const { progress, needed, total } = rewardSystem.getXPForNextLevel();
    gameUI.updateXP(total - needed, needed, total);
    const clamped: number = progress;
    void clamped;

    await rewardSystem.recordGame('breakout', { score: 4200, deaths: 2 });
    gameUI.destroy();
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

// Injected storage, and the reward system bridged onto a kernel bus.
async function wiredUp(): Promise<void> {
    const data = new DataService({ storage: createMemoryStorage(), prefix: 'game_' });
    const bus = new EventBus();

    const rewards = new RewardSystem(data, { achievements, events: bus });
    await rewards.init();

    bus.on(EventBus.Events.LEVEL_UP, (payload: { oldLevel: number; newLevel: number }) => {
        void payload.newLevel;
    }, 10);

    const unsubscribe = rewards.on('xp_gained', () => { });
    unsubscribe();

    const hasListeners: boolean = bus.hasListeners(EventBus.Events.XP_GAINED);
    void hasListeners;
}

// Particles and audio.
function effectsAndSound(): void {
    const particles = new ParticleSystem({ container: '#game', zIndex: '10' });
    particles.confetti(100, 100, 40);
    particles.emit({ x: 10, y: 10, count: 5, color: '#f00' });
    particles.registerEffect('blood', (x, y) => void [x, y]);
    particles.destroy();

    const sound = new SoundManager({ volume: 0.5 });
    if (sound.initAudio()) {
        sound.setVolume(0.8);
        void sound.play('jump');
    }

    const ui = new GameUI(particles);
    ui.showSummary({
        score: 4200,
        metrics: { Coins: 12, Time: '2:04' },
        onReplay: () => { },
        onExit: () => { }
    });
}

// Engine layer plus a plugin.
class Player1 extends Component {
    override update(dt: number): void {
        this.gameObject!.position = this.gameObject!.position.add(new Vector2(dt, 0));
    }
}

const debugPlugin: Plugin = {
    name: 'debug',
    version: '1.0.0',
    init(kernel: DopamineKernel) {
        kernel.events.on(EventBus.Events.TICK, () => { });
    },
    destroy() { }
};

function engine(): void {
    const game = new Game({ width: 800, height: 600 });
    game.kernel.plugins.use(debugPlugin);

    const scene = new Scene();
    const hero = new GameObject(10, 20);
    hero.addComponent(new Player1());
    hero.addComponent(new Collider('box', 32, 32));

    const found = hero.getComponent(Collider);
    void found?.getBounds().width;

    scene.add(hero);
    game.setScene(scene);
    game.start();
    game.destroy();
}

void quickstart;
void wiredUp;
void effectsAndSound;
void engine;
