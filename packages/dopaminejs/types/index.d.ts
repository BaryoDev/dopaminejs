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
    /** Local calendar day, YYYY-MM-DD. Not UTC. Absent until the first play. */
    lastPlayDate?: string;
}

export interface UnlockedAchievement {
    unlockedAt: number;
    seen: boolean;
    /** XP the achievement paid when it was unlocked. */
    reward: number;
}

/** A frozen copy of the player with the derived values. */
export interface Player {
    name: string;
    xp: number;
    level: number;
    totalGamesPlayed: number;
    createdAt: number;
    lastPlayedAt: number;
    streak: PlayerStreak;
    achievements: Record<string, UnlockedAchievement>;
    /** Per-activity stats: `plays`, `best`, and any other number a result carried. */
    stats: Record<string, { plays: number; best: number } & Record<string, number>>;
}

/**
 * The saved document. It merges: see `merge`. Treat it as opaque and pass it
 * to `merge`, `validate` and `import`.
 */
export interface PlayerDocument {
    v: 3;
    name: string;
    createdAt: number;
    lastPlayedAt: number;
    level: number;
    longest: number;
    /** Local days, YYYY-MM-DD, sorted, at most the last 400. */
    playDates: string[];
    xpBy: Record<string, number>;
    xpSpentBy: Record<string, number>;
    gamesBy: Record<string, number>;
    playsBy: Record<string, Record<string, number>>;
    best: Record<string, number>;
    sumsBy: Record<string, Record<string, Record<string, number>>>;
    achievements: Record<string, UnlockedAchievement>;
}

export interface Clock {
    now(): number;
    /** Local calendar day, YYYY-MM-DD, never UTC. Defaults to now. */
    localDate(ms?: number): string;
}

export type DopamineErrorCode = 'invalid_document' | 'unsupported_version' | 'too_many_devices';

export class DopamineError extends Error {
    constructor(code: string, message?: string);
    readonly code: DopamineErrorCode | string;
}

export interface ValidateOptions {
    /** Fills missing timestamps. Default 0. */
    now?: number;
    /** A local date (YYYY-MM-DD). When set, play dates older than 400 days counting from it are dropped. Default: none are dropped. */
    today?: string;
    /** XP a 2.x save already holds for each achievement id. Default: the built-ins. */
    rewards?: Record<string, number>;
}

/** Clean any value into a version 3 document, or throw a DopamineError. Pure. */
export function validate(input: unknown, options?: ValidateOptions): PlayerDocument;
/**
 * Join two saves. Pure, and the same in any order or grouping.
 * @throws DopamineError `too_many_devices`, `unsupported_version`, `invalid_document`.
 */
export function merge(a: unknown, b: unknown, options?: ValidateOptions): PlayerDocument;

export interface Middleware {
    beforeXP?(context: { amount: number; reason: string }): Partial<{ amount: number; reason: string }> | false | void | Promise<Partial<{ amount: number; reason: string }> | false | void>;
    afterXP?(context: { amount: number; reason: string; total: number; level: number }): void | Promise<void>;
    beforeRecord?(context: { activity: string; result: GameResult }): Partial<{ activity: string; result: GameResult }> | false | void | Promise<Partial<{ activity: string; result: GameResult }> | false | void>;
    afterRecord?(context: { activity: string; result: GameResult; xp: number }): void | Promise<void>;
    beforeUnlock?(context: { id: string; reward: number }): Partial<{ reward: number }> | false | void | Promise<Partial<{ reward: number }> | false | void>;
    afterUnlock?(context: { id: string; reward: number }): void | Promise<void>;
}

export interface AchievementDefinition {
    name: string;
    description?: string;
    /**
     * A string is rendered as HTML (an <img> or inline SVG is allowed), or as
     * allowlisted SVG or text when GameUI is built with `safeIcons: true`. A
     * Node is moved into the popup, not copied.
     */
    icon?: string | Node;
    /** Omitted means 0. Never undefined at runtime. */
    xp?: number;
    check(player: Player, activity?: string, result?: GameResult): boolean;
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
    /** Time source. Tests pass one; the default reads the system clock. */
    clock?: Clock;
}

export type RewardEvent =
    | 'xp_gained'
    | 'level_up'
    | 'achievement_unlocked'
    /** Payload `{ activity, score }`. */
    | 'personal_best'
    /** Payload `{ current, longest }`. Fires when the day rolls over. */
    | 'streak_updated'
    /** Payload `{ key }`. The storage write failed; state lives in memory only. */
    | 'save_failed'
    /**
     * Payload `{ key, reason, error?, backedUp? }`. `reason: 'read'`: storage
     * could not be read, so nothing is saved this session (call `init()` again
     * to retry). `reason: 'corrupt'`: the saved value was not JSON; it is kept
     * under `player_corrupt` as a JSON string and a new player starts. If that
     * backup fails, `backedUp` is false and nothing is saved this session.
     * A `load()` override must pass its third argument on, or a failed read
     * looks like an empty one.
     */
    | 'load_failed';

export class EventEmitter {
    on(event: string, callback: (data?: unknown) => void): () => void;
    off(event: string, callback: (data?: unknown) => void): void;
    emit(event: string, data?: unknown): void;
    clear(): void;
}

export class RewardSystem extends EventEmitter {
    constructor(dataService: DataService, config?: RewardSystemConfig);

    achievements: Record<string, AchievementDefinition>;
    /** Kernel bus events are mirrored onto, if one was supplied. */
    events: EventBus | null;
    /**
     * True when the last `init()` could not read the saved player, so nothing
     * is saved until `init()` is called again and the read works.
     */
    readonly loadFailed: boolean;

    init(): Promise<Player>;
    /** A frozen copy of the player with the derived values. */
    snapshot(): Player;
    /** The versioned document, a detached copy. */
    export(): PlayerDocument;
    /**
     * Merge a document into this player. Unless `silent`, announces the XP,
     * level and achievements that went up.
     */
    import(doc: unknown, options?: { silent?: boolean }): Promise<Player>;
    /** Hooks run in `use` order. Returns a function that removes it. */
    use(middleware: Middleware): () => void;
    /** Adds a rule at runtime. Returns a function that removes it. */
    defineAchievement(id: string, definition: AchievementDefinition): () => void;
    save(): Promise<void>;

    /** @throws TypeError if `amount` is not finite. */
    addXP(amount: number, reason?: string): Promise<AddXPResult>;
    getXPForNextLevel(): XPProgress;

    /**
     * Persists once for the whole call, not once per internal mutation.
     * @throws TypeError for an empty or reserved activity name, or a `score`
     *   that is not a finite number.
     * @returns false when a `beforeRecord` hook rejected it.
     */
    record(activity: string, result?: GameResult): Promise<boolean>;

    checkAchievements(activity: string, result: GameResult): Promise<AchievementDefinition[]>;
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

/**
 * Promise-returning store such as AsyncStorage or an IndexedDB wrapper.
 * DataService accepts either kind. SoundManager reads its mute flag in the
 * constructor and needs the synchronous one.
 */
export interface AsyncStorageLike {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export interface DataServiceConfig {
    /** Defaults to localStorage, falling back to an in-memory store. */
    storage?: StorageLike | AsyncStorageLike;
    /** Key prefix, default 'dopamine_'. */
    prefix?: string;
}

export class DataService {
    constructor(config?: DataServiceConfig);
    storage: StorageLike | AsyncStorageLike;
    prefix: string;
    save(key: string, data: unknown): Promise<boolean>;
    /**
     * Resolves `defaultValue` when the read fails, unless `strict` is set:
     * then a storage error rejects as is, and unparseable data rejects with
     * `code: 'DOPAMINE_CORRUPT'` and the raw string on `raw`. `RewardSystem`
     * relies on this, so an override must pass `options` on.
     */
    load<T = unknown>(key: string, defaultValue?: T | null, options?: { strict?: boolean }): Promise<T | null>;
    clear(key: string): Promise<void>;
}

/** Storage backed by a Map. Used when localStorage is absent or blocked. */
export function createMemoryStorage(): StorageLike;
/** localStorage if present and writable, otherwise an in-memory store. */
export function resolveStorage(): StorageLike;

export interface Haptics {
    /** A 10 ms buzz. */
    tap(): void;
    /** Buzzes 10, 40, 10 ms. */
    double(): void;
    setEnabled(enabled: boolean): void;
}

/** Silent where the Vibration API is missing or blocked. */
export function createHaptics(options?: { nav?: { vibrate?: (pattern: number | number[]) => unknown }; enabled?: boolean }): Haptics;

/** The reduced-motion query, or `{ matches: false }` without matchMedia. */
export function prefersReducedMotion(win?: { matchMedia?: (query: string) => { matches: boolean } }): { matches: boolean };

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

export interface GameUIConfig {
    /**
     * When true, a string icon (achievement or streak) is parsed as SVG and
     * rebuilt from an allowlist of elements and attributes, and any other
     * string is shown as text. The string must be well-formed XML, so
     * `&nbsp;` falls back to text. An `<svg>` with no xmlns is accepted.
     * Default false: string icons are HTML.
     */
    safeIcons?: boolean;
    /** Replaces the built-in popup strings. Rendered as text. */
    text?: {
        /** Default `LEVEL UP!`. */
        levelUp?: string;
        /** Default `Achievement Unlocked!`. */
        achievementUnlocked?: string;
        /** Default `CLOSE CALL!`. */
        nearMiss?: string;
    };
    icons?: {
        /**
         * A string is HTML (unless `safeIcons` is on), a Node is moved into
         * the badge, not copied. Default is a fire emoji.
         */
        streak?: string | Node;
    };
}

export class GameUI {
    constructor(particleSystem: ParticleSystem, config?: GameUIConfig);

    container: HTMLElement | null;

    /** `progress` is the position within the current level, 0 to 1. */
    updateXP(current: number, needed: number, total: number, progress?: number): void;
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
    /** Cap on live particles, default 5000. Emits past it are dropped. */
    maxParticles?: number;
    /** Skip effects under prefers-reduced-motion. Default true. */
    respectReducedMotion?: boolean;
}

export interface ParticleConfig {
    x: number;
    y: number;
    count?: number;
    /** One colour, or a list to pick from at random per particle. */
    color?: string | string[];
    size?: number;
    life?: number;
    decay?: number;
    gravity?: number;
    spread?: number;
    /** Direction in radians. */
    angle?: number;
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
    /** Key to URL map, loaded when the audio context is first created. */
    customSounds?: Record<string, string>;
}

export class SoundManager {
    constructor(config?: SoundManagerConfig);

    muted: boolean;
    assets: Map<string, AudioBuffer>;
    customSounds: Record<string, string>;

    /** Returns false when no Web Audio API is available, rather than throwing. */
    initAudio(): boolean;
    /** Calls initAudio() on the first of `events` on `target`, then removes its listeners. Returns a remover. */
    unlockOn(target: EventTarget, events?: string[]): () => void;
    setVolume(value: number): number;
    getVolume(): number;
    toggleMute(): boolean;

    registerSound(key: string, url: string): void;
    /** Registers every key, then loads the files. Before the audio context exists they load when it is created. */
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

    /** Cancels queued tones, closes the audio context, drops decoded buffers. */
    destroy(): void;
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
    PERSONAL_BEST: 'personal_best';
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
    /** Calls the plugin's `destroy()`, then unregisters the systems it registered during `init()`. */
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

export interface BoxBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface CircleBounds {
    x: number;
    y: number;
    radius: number;
}

/** A box collider returns edges, a circle collider returns centre and radius. */
export type Bounds = BoxBounds | CircleBounds;

export class Collider extends Component {
    constructor(type?: 'box' | 'circle', width?: number, height?: number, radius?: number);
    type: 'box' | 'circle';
    width: number;
    height: number;
    radius: number;
    tag: string | null;
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
    x: number;
    y: number;
    rotation: number;
    scale: { x: number; y: number };
    components: Component[];
    children: GameObject[];
    parent: GameObject | null;
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

/** Payload of `collision_enter` and `collision_exit` on the kernel event bus. */
export interface CollisionEvent {
    a: Collider;
    b: Collider;
}

export class Physics {
    init(kernel: DopamineKernel): void;
    fixedUpdate(dt: number): void;
    destroy(): void;
    add(collider: Collider): void;
    /** Emits `collision_exit` for each pair the collider was overlapping in. */
    remove(collider: Collider): void;
    /**
     * Emits `collision_enter` once when a pair starts to overlap and
     * `collision_exit` once when it stops. `onCollisionEnter` on a component
     * runs on every step while the pair overlaps.
     */
    step(): void;
    /** Every collider that overlaps `source`. With a tag, only colliders carrying it. */
    checkOverlap(source: Collider, targetTag?: string): Collider[];
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
    /** Removes the overlay and canvas, closes audio, detaches from reward events. */
    destroy(): void;
}
