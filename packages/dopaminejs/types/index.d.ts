/**
 * Type declarations for dopaminejs.
 *
 * Hand-written to match src/index.js. The runtime is plain JavaScript with
 * JSDoc; these exist so TypeScript consumers get completion and checking
 * without the project adopting TypeScript.
 */

// ---------------------------------------------------------------------------
// Reward system
// ---------------------------------------------------------------------------

export interface PlayerStreak {
    current: number;
    longest: number;
    /** Local calendar day, YYYY-MM-DD. Not UTC. */
    lastPlayDate: string;
}

export interface UnlockedAchievement {
    unlockedAt: number;
    seen: boolean;
}

export interface Player {
    name: string;
    xp: number;
    level: number;
    totalGamesPlayed: number;
    createdAt: number;
    lastPlayedAt: number;
    streak: PlayerStreak;
    achievements: Record<string, UnlockedAchievement>;
    /** Per-game stats. Games add their own keys. */
    stats: Record<string, Record<string, number>>;
}

export interface AchievementDefinition {
    name: string;
    description?: string;
    /** Rendered as HTML, so an <img> or inline SVG is allowed here. */
    icon?: string;
    /** Omitted means 0. Never undefined at runtime. */
    xp?: number;
    check(player: Player, gameName?: string, result?: GameResult): boolean;
}

export interface GameResult {
    score?: number;
    [metric: string]: number | undefined;
}

export interface XPProgress {
    /** Total XP marking the next level. */
    total: number;
    /** XP still required, floored at 0. */
    needed: number;
    /** Position within the current level band, 0 to 1 inclusive. */
    progress: number;
}

export interface AddXPResult {
    leveledUp: boolean;
    newLevel: number;
    xpGained: number;
}

export interface RewardSystemConfig {
    achievements?: Record<string, AchievementDefinition>;
    /** Mirror reward events onto a kernel EventBus. */
    events?: EventBus;
    /** Alternative to `events`; the kernel's bus is used. */
    kernel?: DopamineKernel;
}

export type RewardEvent =
    | 'xp_gained'
    | 'level_up'
    | 'achievement_unlocked'
    | 'new_high_score';

export class EventEmitter {
    on(event: string, callback: (data?: unknown) => void): () => void;
    off(event: string, callback: (data?: unknown) => void): void;
    emit(event: string, data?: unknown): void;
    clear(): void;
}

export class RewardSystem extends EventEmitter {
    constructor(dataService: DataService, config?: RewardSystemConfig);

    player: Player | null;
    achievements: Record<string, AchievementDefinition>;
    /** Kernel bus events are mirrored onto, if one was supplied. */
    events: EventBus | null;

    init(): Promise<Player>;
    save(): Promise<void>;

    /** @throws TypeError if `amount` is not finite. */
    addXP(amount: number, reason?: string): Promise<AddXPResult>;
    getXPForNextLevel(): XPProgress;

    /** Persists once for the whole call, not once per internal mutation. */
    recordGame(gameName: string, result: GameResult): Promise<void>;

    checkAchievements(gameName: string, result: GameResult): Promise<AchievementDefinition[]>;
    unlockAchievement(achievementId: string): Promise<boolean>;
    getUnlockedAchievements(): Array<AchievementDefinition & UnlockedAchievement & { id: string }>;
    getUnseenAchievements(): Array<AchievementDefinition & UnlockedAchievement & { id: string }>;
    markAchievementsSeen(achievementIds: string[]): Promise<void>;
    getStreakMultiplier(): number;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface DataServiceConfig {
    /** Defaults to localStorage, falling back to an in-memory store. */
    storage?: StorageLike;
    /** Key prefix, default 'dopamine_'. */
    prefix?: string;
}

export class DataService {
    constructor(config?: DataServiceConfig);
    storage: StorageLike;
    prefix: string;
    save(key: string, data: unknown): Promise<boolean>;
    load<T = unknown>(key: string, defaultValue?: T | null): Promise<T | null>;
    clear(key: string): Promise<void>;
}

/** Storage backed by a Map. Used when localStorage is absent or blocked. */
export function createMemoryStorage(): StorageLike;
/** localStorage if present and writable, otherwise an in-memory store. */
export function resolveStorage(): StorageLike;

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export interface SummaryData {
    score: number | string;
    /** Label to value pairs. Rendered as text. */
    metrics?: Record<string, number | string>;
    /** Defaults to reloading the page. */
    onReplay?: () => void;
    /** Exit button is omitted when this is not supplied. */
    onExit?: () => void;
}

export class GameUI {
    constructor(particleSystem: ParticleSystem);

    container: HTMLElement | null;

    updateXP(current: number, needed: number, total: number): void;
    updateLevel(level: number): void;
    updateStreak(days: number): void;

    showAchievement(achievement: AchievementDefinition): void;
    showLevelUp(oldLevel: number, newLevel: number): void;
    showFloatingText(text: string, x: number, y: number, color?: string, size?: string): void;
    showCombo(multiplier: number, x: number, y: number): void;
    showNearMiss(x: number, y: number): void;
    showLuckyMoment(multiplier: number, x: number, y: number): void;
    showNotification(message: string, type?: 'normal' | 'rare' | 'legendary'): void;
    showSummary(data: SummaryData): HTMLElement;

    /** Removes the overlay, any transient popups, and all pending timers. */
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export interface ParticleSystemConfig {
    /** Element or selector. Defaults to document.body. */
    container?: HTMLElement | string;
    canvasId?: string;
    zIndex?: string;
}

export interface ParticleConfig {
    x: number;
    y: number;
    count?: number;
    color?: string;
    size?: number;
    life?: number;
    decay?: number;
    gravity?: number;
    spread?: number;
    speed?: number;
    type?: string;
    sprite?: string;
}

export class ParticleSystem {
    constructor(config?: ParticleSystemConfig);

    canvas: HTMLCanvasElement;
    /** Width in CSS pixels. The backing store is scaled by devicePixelRatio. */
    width: number;
    height: number;
    isAnimating: boolean;

    registerSprite(key: string, url: string): void;
    registerEffect(name: string, callback: (x: number, y: number, ...args: unknown[]) => void): void;
    play(name: string, x: number, y: number, ...args: unknown[]): void;
    emit(config: ParticleConfig): void;

    confetti(x: number, y: number, count?: number): void;
    coinShower(x: number, y: number, count?: number): void;
    sparkle(x: number, y: number, count?: number, color?: string): void;
    fire(x: number, y: number, count?: number): void;
    starBurst(x: number, y: number, count?: number): void;

    clear(): void;
    /** Stops animation, detaches resize handling, removes the canvas. */
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export interface SoundManagerConfig {
    storageKey?: string;
    storage?: StorageLike;
    /** Master volume 0 to 1, default 1. */
    volume?: number;
    /** Key to URL map, preloaded on construction. */
    customSounds?: Record<string, string>;
}

export class SoundManager {
    constructor(config?: SoundManagerConfig);

    muted: boolean;
    assets: Map<string, AudioBuffer>;
    customSounds: Record<string, string>;

    /** Returns false when no Web Audio API is available, rather than throwing. */
    initAudio(): boolean;
    setVolume(value: number): number;
    getVolume(): number;
    toggleMute(): boolean;

    registerSound(key: string, url: string): void;
    preloadSounds(soundMap: Record<string, string>): Promise<void>;
    loadSound(key: string, url: string): Promise<void>;
    play(key: string): Promise<void>;
    playTone(frequency: number, duration: number, type?: OscillatorType, volume?: number): void;

    playJump(force?: boolean): void;
    playScore(force?: boolean): void;
    playGameOver(force?: boolean): void;
    playClick(force?: boolean): void;
    playSuccess(force?: boolean): void;
    playError(force?: boolean): void;
}

// ---------------------------------------------------------------------------
// Kernel
// ---------------------------------------------------------------------------

export interface EventBusEvents {
    TICK: 'tick';
    FIXED_UPDATE: 'fixed_update';
    RENDER: 'render';
    COLLISION_ENTER: 'collision_enter';
    COLLISION_EXIT: 'collision_exit';
    XP_GAINED: 'xp_gained';
    LEVEL_UP: 'level_up';
    ACHIEVEMENT_UNLOCKED: 'achievement_unlocked';
    NEW_HIGH_SCORE: 'new_high_score';
    STREAK_UPDATED: 'streak_updated';
    SYSTEM_REGISTERED: 'system_registered';
    SYSTEM_UNREGISTERED: 'system_unregistered';
    PLUGIN_LOADED: 'plugin_loaded';
    PLUGIN_UNLOADED: 'plugin_unloaded';
}

export class EventBus {
    static readonly Events: EventBusEvents;

    /** Higher priority runs first. */
    on(event: string, callback: (data?: any) => void, priority?: number): this;
    once(event: string, callback: (data?: any) => void): this;
    /** Removes every registration of `callback` for `event`. */
    off(event: string, callback: (data?: any) => void): this;
    /** A throwing listener is logged and does not abort the remaining ones. */
    emit(event: string, data?: any): void;
    clear(event?: string): void;
    hasListeners(event: string): boolean;
}

export interface ISystemLike {
    init?(kernel: DopamineKernel): void;
    update?(dt: number): void;
    fixedUpdate?(dt: number): void;
    destroy?(): void;
}

export interface SystemRegisterOptions {
    /** Higher runs earlier. Default 0. */
    priority?: number;
    /** Names of systems that must update first. */
    dependencies?: string[];
}

export class SystemRegistry {
    constructor(kernel: DopamineKernel);
    register(name: string, system: ISystemLike, options?: SystemRegisterOptions): this;
    get<T = ISystemLike>(name: string): T | undefined;
    has(name: string): boolean;
    unregister(name: string): boolean;
    update(dt: number): void;
    fixedUpdate(dt: number): void;
    getSystemNames(): string[];
    clear(): void;
}

export interface Plugin {
    name: string;
    version?: string;
    init(kernel: DopamineKernel): void | Promise<void>;
    destroy?(): void;
}

export class PluginRegistry {
    constructor(kernel: DopamineKernel);
    use(plugin: Plugin): this;
    useAsync(plugin: Plugin): Promise<this>;
    remove(name: string): boolean;
    get(name: string): Plugin | undefined;
    has(name: string): boolean;
    getPluginNames(): string[];
    getLoadOrder(): string[];
    clear(): void;
}

export interface KernelConfig {
    width?: number;
    height?: number;
    backgroundColor?: string;
    canvas?: HTMLCanvasElement;
    renderer?: Record<string, unknown>;
    /** Seconds per fixed update. Default 1/60. */
    fixedTimestep?: number;
}

export class DopamineKernel {
    constructor(config?: KernelConfig);

    config: KernelConfig;
    events: EventBus;
    systems: SystemRegistry;
    plugins: PluginRegistry;
    fixedTimestep: number;

    readonly physics: Physics;
    readonly input: Input;
    readonly loader: Loader;
    readonly renderer: Renderer;
    readonly ticker: Ticker;

    start(): void;
    stop(): void;
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Engine core
// ---------------------------------------------------------------------------

export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    add(v: Vector2): Vector2;
    sub(v: Vector2): Vector2;
    scale(s: number): Vector2;
    distance(v: Vector2): number;
    normalize(): Vector2;
    clone(): Vector2;
    static distance(a: Vector2, b: Vector2): number;
}

export class Component {
    gameObject: GameObject | null;
    kernel: DopamineKernel | null;
    onAttach(): void;
    onDetach(): void;
    update(dt: number): void;
    render(ctx: CanvasRenderingContext2D): void;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class Collider extends Component {
    constructor(type?: 'box' | 'circle', width?: number, height?: number, radius?: number);
    type: 'box' | 'circle';
    width: number;
    height: number;
    radius: number;
    getBounds(): Bounds;
}

export class Sprite extends Component {
    constructor(image: HTMLImageElement | HTMLCanvasElement);
    setFrame(x: number, y: number, w: number, h: number): void;
    setTexture(image: HTMLImageElement | HTMLCanvasElement): void;
}

export class Animator extends Component {
    addAnimation(name: string, frames: unknown[], fps?: number, loop?: boolean): void;
    play(name: string): void;
}

export class GameObject {
    constructor(x?: number, y?: number);
    position: Vector2;
    rotation: number;
    scale: Vector2;
    components: Component[];
    children: GameObject[];
    kernel: DopamineKernel | null;
    tag?: string;
    addChild(child: GameObject): GameObject;
    addComponent<T extends Component>(component: T): T;
    getComponent<T extends Component>(type: new (...args: any[]) => T): T | undefined;
    update(dt: number): void;
    render(ctx: CanvasRenderingContext2D): void;
}

export class Scene {
    gameObjects: GameObject[];
    kernel: DopamineKernel | null;
    onEnter(): void;
    onExit(): void;
    add(gameObject: GameObject): GameObject;
    remove(gameObject: GameObject): void;
    update(dt: number): void;
    render(ctx: CanvasRenderingContext2D): void;
}

export class Renderer {
    constructor(options?: Record<string, unknown>);
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    clear(): void;
    resize(width: number, height: number): void;
}

export class Ticker {
    add(callback: (dt: number) => void): void;
    remove(callback: (dt: number) => void): void;
    /** Cancels any pending frame first, so restarting cannot double-step. */
    start(): void;
    stop(): void;
    running: boolean;
    callbacks: Set<(dt: number) => void>;
}

export class Loader {
    init(kernel: DopamineKernel): void;
    destroy(): void;
    loadImage(key: string, url: string): Promise<HTMLImageElement>;
    get(key: string): HTMLImageElement | undefined;
}

export class Input {
    init(kernel: DopamineKernel): void;
    destroy(): void;
    isKeyDown(key: string): boolean;
    isMouseButtonDown(button?: number): boolean;
    mouse: { x: number; y: number };
}

export class Physics {
    init(kernel: DopamineKernel): void;
    fixedUpdate(dt: number): void;
    destroy(): void;
    add(collider: Collider): void;
    remove(collider: Collider): void;
    step(): void;
    checkOverlap(source: Collider, targetTag: string): GameObject | null;
    addBody(body: Collider): void;
    removeBody(body: Collider): void;
    checkCollision(a: Collider, b: Collider): boolean;
    /** Not implemented. Always null. */
    raycast(origin: Vector2, direction: Vector2, distance: number): null;
    /** Not implemented. */
    setGravity(x: number, y: number): void;
}

export class Director {
    constructor(game: Game);
    run(scene: Scene): void;
}

export class Game {
    constructor(config?: KernelConfig);
    kernel: DopamineKernel;
    scene: Scene | null;
    start(): void;
    stop(): void;
    setScene(newScene: Scene): void;
    destroy(): void;
}

export class TextureGenerator {
    static createGround(width: number, height: number, color?: string): HTMLCanvasElement;
    static createCharacterSheet(colorBody: string, colorDetail: string): HTMLCanvasElement;
}

export class ParticleEmitter extends Component {
    constructor(particleSystem: ParticleSystem);
    play(effectName: string, options?: Record<string, unknown>): void;
}

export class ScreenShake extends Component {
    shake(intensity?: number, duration?: number): void;
}

/** Deprecated singletons kept for v1 compatibility. Prefer kernel.<system>. */
export const GlobalLoader: Loader;
export const GlobalInput: Input;
export const GlobalPhysics: Physics;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export const ISystem: Record<string, unknown>;
export const System: Record<string, unknown>;
export const IPhysicsSystem: Record<string, unknown>;
export const IAudioSystem: Record<string, unknown>;
export const IParticleSystem: Record<string, unknown>;

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

export interface DopamineConfig {
    data?: DataServiceConfig;
    rewards?: RewardSystemConfig;
    sound?: SoundManagerConfig;
    particles?: ParticleSystemConfig;
}

export interface DopamineSubsystems {
    rewardSystem: RewardSystem;
    gameUI: GameUI;
    particleSystem: ParticleSystem;
    soundManager: SoundManager;
}

/**
 * Wires DataService, RewardSystem, SoundManager, ParticleSystem and GameUI
 * together and binds the UI to reward events.
 */
export default class Dopamine {
    constructor(config?: DopamineConfig);
    config: DopamineConfig;
    dataService: DataService;
    rewardSystem: RewardSystem;
    soundManager: SoundManager;
    particleSystem: ParticleSystem;
    gameUI: GameUI;
    init(): Promise<DopamineSubsystems>;
}
