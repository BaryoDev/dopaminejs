/**
 * host.celebrate(): one call that shows a toast, fires confetti and plays a
 * sound. Internal, the host adds it to its object. It owns no timers,
 * listeners or DOM nodes, the card belongs to the UI part.
 */

import { prefersReducedMotion } from './feel/motion.js';

const preset = (title, icon, sound, count) => Object.freeze({ title, icon, sound, count });

const PRESETS = Object.freeze(Object.assign(Object.create(null), {
    complete: preset('Complete!', '\u{2705}', 'achievement', 40),
    milestone: preset('Milestone reached', '\u{1F3C1}', 'level_up', 60),
    streak: preset('Streak kept', '\u{1F525}', 'achievement', 40),
    certificate: preset('Certificate earned', '\u{1F393}', 'level_up', 80)
}));

// Options come from callers, so an inherited property must not count.
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const ownValue = (object, key) =>
    (object !== null && typeof object === 'object' && hasOwn(object, key) ? object[key] : undefined);

// Where the confetti goes: the middle of the target, else the viewport.
function centreOf(target) {
    if (typeof target?.getBoundingClientRect === 'function') {
        const { left, top, width, height } = target.getBoundingClientRect();
        if ((width !== 0 || height !== 0) && Number.isFinite(left + top + width + height)) {
            return { x: left + width / 2, y: top + height / 2 };
        }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * @param {{ parts: Object, env: { hasDom: boolean }, log: { error: Function },
 *   isDisposed: () => boolean, settle: (value: any, log: Object) => void }} deps
 */
export function createCelebrate({ parts, env, log, isDisposed, settle }) {
    // A part that throws or rejects is logged, so the other two still run.
    const attempt = (fn) => {
        try {
            settle(fn(), log);
        } catch (error) {
            log.error(error);
        }
    };

    return function celebrate(name, options) {
        if (isDisposed() || typeof name !== 'string' || !hasOwn(PRESETS, name)) return;
        const { title, icon, sound, count } = PRESETS[name];
        const target = ownValue(options, 'target');
        const soundOption = ownValue(options, 'sound');
        const key = soundOption === false ? null : (typeof soundOption === 'string' ? soundOption : sound);

        attempt(() => parts.ui?.popup({
            kind: 'custom',
            title: ownValue(options, 'title') ?? title,
            body: ownValue(options, 'body'),
            icon: ownValue(options, 'icon') ?? icon,
            burst: false
        }));
        attempt(() => {
            if (env.hasDom && prefersReducedMotion(window).matches !== true) {
                parts.particles?.burst?.('confetti', centreOf(target), { count });
            }
        });
        if (key !== null) attempt(() => parts.sound?.play?.(key));
    };
}
