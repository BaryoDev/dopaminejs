export interface CertificateFields {
    /** The heading. Rendered as text. The dialog is labelled by it. */
    title?: string;
    /** Who earned it. Rendered as text. */
    recipient?: string;
    /** Rendered as text, as given. */
    date?: string;
    /** Who awarded it. Rendered as text. */
    issuer?: string;
    /**
     * A string follows `safeIcons`: text or allowlisted SVG by default, HTML only
     * with `safeIcons: false`. An image or other Node is moved in, never parsed.
     */
    logo?: string | Node;
}

export interface CertificateOptions {
    /** Default true. Same meaning as in `RewardUI`. */
    safeIcons?: boolean;
}

/**
 * Open a completion certificate in a modal with Download (PNG), Print and Close.
 * Only one is open at a time, and a second call closes the first. Closing
 * returns focus to the element that had it. Never throws.
 */
export function showCertificate(fields: CertificateFields, options?: CertificateOptions): void;

/** Close the open certificate and remove its DOM, print style and listeners. */
export function destroyCertificate(): void;
