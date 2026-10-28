import type { DopaminePlugin } from './index';

export interface GameFeedbackText {
    /** Default `{n}× COMBO!`. `{n}` is the multiplier. */
    combo?: string;
    /** Default `CLOSE CALL!`. */
    nearMiss?: string;
    /** Default `LUCKY {n}×!`. */
    luckyMoment?: string;
    /** Default `Game Over`. */
    gameOver?: string;
    /** Default `Play Again`. */
    playAgain?: string;
    /** Default `Exit`. */
    exit?: string;
}

export interface GameFeedbackOptions {
    /** Replaces the built-in strings, rendered as text. An empty string hides one. */
    text?: GameFeedbackText;
}

export interface RunSummary {
    score: number | string;
    /** Label and value pairs listed under the score. */
    metrics?: Record<string, number | string>;
    /** Default: reload the page. */
    onReplay?: () => void;
    /** The button is left out without it. */
    onExit?: () => void;
}

/**
 * Needs the `ui` part. The methods do nothing before install and after dispose.
 */
export interface GameFeedback extends DopaminePlugin {
    requires: ['ui'];
    combo(multiplier: number, x: number, y: number): void;
    nearMiss(x: number, y: number): void;
    luckyMoment(multiplier: number, x: number, y: number): void;
    /** Returns the overlay, which is removed when the plugin is disposed. Null without a DOM. */
    summary(data: RunSummary): HTMLElement | null;
}

/** Adds the `jump`, `score` and `gameover` sound keys to `parts.sound` while installed. */
export function gameFeedback(options?: GameFeedbackOptions): GameFeedback;
