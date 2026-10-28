import type {
    Clock,
    Dopamine,
    DopamineOptions,
    DopaminePlugin,
    Haptics,
    HudState,
    FloatingText,
    BurstKind,
    BurstOptions,
    Parts,
    Popup,
    RewardSystem,
    RewardUILike,
    ParticleRenderer,
    SoundPlayer,
    StorageLike
} from './index';

export interface TestHostOptions extends Omit<DopamineOptions, 'clock' | 'storage' | 'ui' | 'particles' | 'sound' | 'haptics' | 'progress'> {
    /** Local time `YYYY-MM-DDTHH:MM:SS`, default `2026-01-15T09:00:00`. A Clock object cannot be advanced. */
    clock?: string | Clock;
    /** Default is a memory store. */
    storage?: StorageLike;
    /** Replaces the recording part of the same name. `false` means none. */
    parts?: {
        ui?: RewardUILike | false;
        particles?: ParticleRenderer | false;
        sound?: SoundPlayer | false;
        haptics?: Haptics | false;
    };
}

export interface RecordedEvent {
    event: string;
    data: unknown;
}

export interface TestHost {
    host: Dopamine;
    progress: RewardSystem;
    parts: Readonly<Parts>;
    ready: Promise<Dopamine>;
    use: Dopamine['use'];
    dispose(): void;
    clock: Clock;
    /** What the recording ui was asked to show. */
    popups: Popup[];
    texts: FloatingText[];
    huds: HudState[];
    bursts: Array<{ kind: BurstKind; at?: { x: number; y: number }; opts?: BurstOptions }>;
    /** Keys passed to the recording sound part's `play`. */
    sounds: string[];
    /** Keys currently registered on the recording sound part. */
    soundKeys: Set<string>;
    haptics: string[];
    events: {
        /** Every event on the bus in order, plugin events included. */
        log: RecordedEvent[];
        on(event: string, callback: (data: any) => void): () => void;
        off(event: string, callback: (data: any) => void): void;
        emit(event: string, data?: unknown): void;
    };
    advance(ms: number): void;
    advanceDays(days: number): void;
    setClock(at: string): void;
}

export function createTestHost(options?: TestHostOptions): TestHost;

export type SuiteName = 'particles' | 'sound' | 'ui' | 'storage' | 'plugin';

/** Each suite is a vitest `describe` block. */
export const conformance: {
    particles(make: () => ParticleRenderer): void;
    sound(make: () => SoundPlayer): void;
    ui(make: (parts: Parts) => RewardUILike): void;
    storage(make: () => StorageLike): void;
    plugin(make: () => DopaminePlugin): void;
};

/** Runs a suite outside vitest's describe and returns the titles that failed. */
export function conformanceFailures(name: SuiteName, make: (...args: any[]) => unknown): Promise<string[]>;

export interface Fixture {
    suite: string;
    description: string;
    cases: unknown[];
}

/** Reads `spec/` from the package, or from `dir`. */
export function loadFixtures(dir?: string): {
    contract: number;
    schema: Record<string, unknown>;
    suites: Record<string, Fixture>;
};
