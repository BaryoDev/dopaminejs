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

export type DopamineErrorCode =
    | 'invalid_document' | 'unsupported_version' | 'too_many_devices'
    | 'plugin_api' | 'plugin_order' | 'plugin_requires' | 'plugin_invalid'
    | 'plugin_duplicate' | 'plugin_event' | 'invalid_progress' | 'disposed';

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
     * A string is shown as allowlisted SVG or text, or as HTML when RewardUI
     * is built with `safeIcons: false`. A Node is moved into the popup, not
     * copied.
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
    /** Time source. Tests pass one; the default reads the system clock. */
    clock?: Clock;
    /**
     * What marks today as a play day. `'any'` (default): `record()` or
     * `addXP()`. `'record'`: `record()` only. XP from an achievement reward
     * never marks a day.
     */
    streakDays?: 'any' | 'record';
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

export interface RewardUIConfig {
    /**
     * A string icon (achievement or streak) is parsed as SVG and rebuilt from
     * an allowlist of elements and attributes, and any other string is shown
     * as text. The string must be well-formed XML, so `&nbsp;` falls back to
     * text. An `<svg>` with no xmlns is accepted. Default true. False renders
     * string icons as HTML, for icons you trust.
     */
    safeIcons?: boolean;
    /** Replaces the built-in popup strings. Rendered as text. */
    text?: {
        /** Default `LEVEL UP!`. */
        levelUp?: string;
        /** Default `Achievement Unlocked!`. */
        achievementUnlocked?: string;
    };
    icons?: {
        /**
         * A string follows `safeIcons`, a Node is moved into the badge, not
         * copied. Default is a fire emoji.
         */
        streak?: string | Node;
    };
    /**
     * Add the stylesheet from code, once per page, and remove it on destroy.
     * A string is used as the CSS text. Default false: import
     * `dopaminejs/style.css` instead.
     */
    injectCss?: boolean | string;
}

export interface HudState {
    xp: number;
    level: number;
    /** Position within the current level, 0 to 1. */
    progress?: number;
    streak: number;
    /** XP total that marks the next level. */
    next?: number;
}

export type PopupKind = 'achievement' | 'level' | 'notice' | 'custom';

export interface Popup {
    kind: PopupKind;
    /** Achievement name, notice message, or the level-up heading. */
    title?: string;
    /** Achievement description, or the new level for `level`. */
    body?: string;
    /** A string follows `safeIcons`. A Node is appended. */
    icon?: string | Node;
    /** An extra line under an achievement, such as `+50 XP`. */
    meta?: string;
    tier?: 'common' | 'rare' | 'legendary';
}

export interface FloatingText {
    text: string;
    x?: number;
    y?: number;
    color?: string;
    /** A CSS font size such as `32px`. */
    size?: string;
}

export interface BurstOptions {
    count?: number;
    color?: string;
}

export type BurstKind = 'confetti' | 'sparkle' | 'fire' | 'stars' | 'coins';

export interface RewardUILike {
    hud(state: HudState): void;
    popup(popup: Popup): void;
    text(text: FloatingText): void;
    readonly root: HTMLElement | null;
    destroy(): void;
}

export interface ParticleRenderer {
    /** An unknown kind does nothing. */
    burst(kind: BurstKind, at?: { x: number; y: number }, opts?: BurstOptions): void;
    destroy(): void;
}

export interface SoundPlayer {
    /** An unknown key does nothing. */
    play(key: string): unknown;
    /** Optional. Adds a key and returns a remover. `SoundManager` has it. */
    register?(key: string, source: string | SoundSynth): () => void;
    destroy(): void;
}

export interface Parts {
    readonly ui: RewardUILike | null;
    readonly particles: ParticleRenderer | null;
    readonly sound: SoundPlayer | null;
    readonly haptics: Haptics | null;
}

export class RewardUI implements RewardUILike {
    /** `parts.particles` is read on every call. */
    constructor(parts?: Pick<Parts, 'particles'>, config?: RewardUIConfig);

    readonly root: HTMLElement | null;

    hud(state: HudState): void;
    popup(popup: Popup): void;
    text(text: FloatingText): void;

    /** Removes the overlay, any transient popups, the injected styles and all pending timers. */
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
    /** `play(name, { x, y })` or `play(name, x, y)`. */
    play(name: string, x: number | { x: number; y: number }, y?: number, ...args: unknown[]): void;
    emit(config: ParticleConfig): void;
    burst(kind: BurstKind, at?: { x: number; y: number }, opts?: BurstOptions): void;

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

/** A synth key. `later` is a timeout that destroy() cancels. */
export type SoundSynth = (sound: SoundManager, later: (fn: () => void, ms: number) => void) => void;

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
    /**
     * Add a key. A string is a file URL. A function is a synth, called as
     * `(sound, later)` when the key plays; `later` is a timeout that destroy()
     * cancels. Returns a remover.
     */
    register(key: string, source: string | SoundSynth): () => void;
    /** Registers every key, then loads the files. Before the audio context exists they load when it is created. */
    preloadSounds(soundMap: Record<string, string>): Promise<void>;
    loadSound(key: string, url: string): Promise<void>;
    /** Presets: `xp`, `level_up`, `achievement`, `personal_best`, `click`, `error`. An unknown key is ignored. */
    play(key: string): Promise<void>;
    playTone(frequency: number, duration: number, type?: OscillatorType, volume?: number): void;

    playClick(force?: boolean): void;
    playXP(force?: boolean): void;
    playLevelUp(force?: boolean): void;
    playAchievement(force?: boolean): void;
    playPersonalBest(force?: boolean): void;
    playError(force?: boolean): void;

    /** Cancels queued tones, closes the audio context, drops decoded buffers. */
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Host and plugins
// ---------------------------------------------------------------------------

/** The plugin API version this build accepts. */
export const HOST_API: 3;

export type PartName = 'ui' | 'particles' | 'sound' | 'haptics';

/** A part is a value, a factory, or `false` for none. A factory returning null means the default. */
export type PartOption<T> = T | false | null | ((env: HostEnv) => T | null | undefined);

export interface HostEnv {
    hasDom: boolean;
    reducedMotion: boolean;
}

export interface PluginStorage {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
}

export interface Logger {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

/** The host bus as a plugin sees it. */
export interface PluginEvents {
    /** Removed by the host when the plugin is disposed, even if the plugin forgets. */
    on(event: string, callback: (data: any) => void): () => void;
    off(event: string, callback: (data: any) => void): void;
    /** The event name must start with `<plugin name>:`. */
    emit(event: string, data?: unknown): void;
}

export interface PluginContext {
    progress: RewardSystem;
    /** Live getters. Read them at call time, never keep them. */
    parts: Readonly<Parts>;
    events: PluginEvents;
    /** Keys are prefixed with `dopamine_<name>_`. */
    storage: PluginStorage;
    clock: Clock;
    log: Logger;
    env: HostEnv;
    /** The handle another plugin passed to `expose`, or null. */
    plugin(name: string): unknown | null;
    expose(handle: unknown): void;
}

export type Disposer = () => void;

export interface DopaminePlugin {
    name: string;
    version: string;
    api: 3;
    /** Plugins that must already be installed. */
    after?: string[];
    /** Parts that must be set. */
    requires?: PartName[];
    install(context: PluginContext): Disposer | void | Promise<Disposer | void>;
}

export interface DopamineOptions {
    progress?: RewardSystem | ((env: HostEnv) => RewardSystem | null) | null;
    ui?: PartOption<RewardUILike>;
    particles?: PartOption<ParticleRenderer>;
    sound?: PartOption<SoundPlayer>;
    haptics?: PartOption<Haptics>;
    storage?: StorageLike;
    clock?: Clock;
    /** Passed to the default progress object. See `RewardSystemConfig`. */
    streakDays?: 'any' | 'record';
    plugins?: DopaminePlugin[];
    log?: Partial<Logger>;
}

export interface Dopamine {
    progress: RewardSystem;
    /** Getters only. */
    parts: Readonly<Parts>;
    /** The progress emitter. Plugin events are `name:event`. */
    events: EventEmitter;
    /** Resolves with the host once plugins are installed and progress is loaded. */
    ready: Promise<Dopamine>;
    /** Install a plugin later. Returns its disposer. */
    use(plugin: DopaminePlugin): Disposer;
    /** Disposes plugins in reverse, then the parts, then clears the bus. */
    dispose(): void;
}

/**
 * Builds the feedback layer from parts and installs plugins on it. A sync
 * caller gets a usable host at once. Plugins that are refused throw here; an
 * async install that fails rejects `ready`.
 */
export function createDopamine(options?: DopamineOptions): Dopamine;
