import type { Parts } from './index';

export type CelebratePreset = 'complete' | 'milestone' | 'streak' | 'certificate';

export interface CelebrateOptions {
    /** Replaces the preset title. Rendered as text. */
    title?: string;
    /** A line under the title. Rendered as text. */
    body?: string;
    /** Replaces the preset icon. A string is shown as text, a Node is appended. Through `parts` it follows `safeIcons`. */
    icon?: string | Node;
    /** Confetti is centred on this element, else on the viewport. */
    target?: Element;
    /** A sound key to play. `false` plays nothing. Default is the preset sound. */
    sound?: string | false;
    /**
     * Send the toast, confetti and sound through a host's parts, such as `dopamine.parts`.
     * A part the host does not have is skipped, with no standalone fallback.
     */
    parts?: Partial<Parts>;
}

/**
 * Show a toast, fire confetti and play a sound. Works without createDopamine().
 * An unknown preset does nothing. With reduced motion on there is no confetti.
 * Never throws.
 */
export function celebrate(preset: CelebratePreset, options?: CelebrateOptions): void;

/** Remove the toast, its timer and what the standalone route created. */
export function destroyCelebrations(): void;
