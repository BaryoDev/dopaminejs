import type { Dopamine } from './index';

export interface AutoOptions {
    /** A `createDopamine()` result. XP, achievements and celebrations go through it. */
    host: Dopamine;
    /** Where the listeners and observers attach. Default `document`. */
    root?: Document | Element;
    /** The largest `data-dopamine-xp` a page may award. A value that is not a whole number of 0 or more falls back to 1000. */
    maxXP?: number;
}

/**
 * Turn `data-dopamine-*` attributes into rewards. `data-dopamine-on` is one of
 * `click`, `submit`, `ended`, `read` or `visible`. The other attributes are
 * `data-dopamine-xp`, `-achievement`, `-celebrate`, `-repeat` and
 * `-certificate-title`, `-recipient`, `-date`, `-issuer` and `-logo`.
 * Each element fires once per page load unless it has `data-dopamine-repeat`.
 * XP, achievement and celebrate values are trimmed, and a bad value or an
 * unknown celebrate preset is ignored with one warning for that element. `read`
 * keeps its sentinel as the last child. Click and submit are heard in the
 * capture phase at the root.
 * Elements added or removed later are picked up; a changed attribute is not.
 * Throws a `TypeError` when `host` is missing or `root` is not a Document or
 * an Element. Calling it again replaces the earlier call.
 */
export function auto(options: AutoOptions): void;

/** Remove the listeners, observers and sentinels. The host is not disposed. */
export function destroyAuto(): void;
