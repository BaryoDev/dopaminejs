/**
 * The `dopaminejs/celebrate` subpath: one call shows a toast, fires confetti
 * and plays a sound. It works without createDopamine(). Pass `parts` to send
 * the three through a host instead. Nothing in the main entry imports it.
 */

import { ParticleSystem } from './dopamine/effects/ParticleSystem.js';
import { SoundManager } from './dopamine/audio/SoundManager.js';
import { prefersReducedMotion } from './dopamine/feel/motion.js';

const preset = (title, icon, sound, count) => Object.freeze({ title, icon, sound, count });

const PRESETS = Object.freeze(Object.assign(Object.create(null), {
    complete: preset('Complete!', '\u{2705}', 'achievement', 40),
    milestone: preset('Milestone reached', '\u{1F3C1}', 'level_up', 60),
    streak: preset('Streak kept', '\u{1F525}', 'achievement', 40),
    certificate: preset('Certificate earned', '\u{1F393}', 'level_up', 80)
}));

const TOAST_MS = 3000;
const TOAST_STYLE = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;'
    + 'display:flex;align-items:center;gap:12px;max-width:min(90vw,420px);padding:12px 18px;'
    + 'border-radius:10px;background:#1f2937;color:#fff;border:1px solid rgba(255,255,255,0.25);'
    + 'box-shadow:0 6px 24px rgba(0,0,0,0.35);font:16px/1.3 system-ui,sans-serif;pointer-events:none';

const hasBody = (body) => body !== undefined && body !== null && body !== '';

const REGION_STYLE = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

// Options come from callers, so an inherited property must not count. A local
// copy: importing hasOwn from core/store.js splits a shared chunk and grows the main CJS bundle.
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const ownValue = (object, key) =>
    (object !== null && typeof object === 'object' && hasOwn(object, key) ? object[key] : undefined);

// What the standalone route made, until destroyCelebrations().
let particles = null;
let sound = null;
let toast = null;
let timer = null;
let region = null;
let regionTimer = null;

// A part that throws or rejects is logged, so the other two still run.
const attempt = (fn) => {
    try {
        const result = fn();
        if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
            result.then(undefined, (error) => console.error(error));
        }
    } catch (error) {
        console.error(error);
    }
};

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

function removeToast() {
    clearTimeout(timer);
    timer = null;
    toast?.remove();
    toast = null;
}

// A live region that arrives with its text is often skipped, so one hidden
// region is put in the page empty and its text is always set a tick later.
// A page that replaces its body leaves the old region detached, so that one
// counts as missing.
function announce(message) {
    clearTimeout(regionTimer);
    if (region && !region.isConnected) region = null;
    if (!region) {
        region = document.createElement('div');
        region.className = 'dopamine-celebrate-live';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.style.cssText = REGION_STYLE;
        document.body.appendChild(region);
    }
    regionTimer = setTimeout(() => {
        regionTimer = null;
        if (region) region.textContent = message;
    }, 0);
}

function showToast(title, body, icon) {
    removeToast();
    const el = document.createElement('div');
    el.className = 'dopamine-celebrate-toast';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = TOAST_STYLE;

    const add = (text) => {
        const child = document.createElement('div');
        child.textContent = text;
        return child;
    };
    if (typeof Node !== 'undefined' && icon instanceof Node) {
        const holder = document.createElement('div');
        holder.appendChild(icon);
        el.appendChild(holder);
    } else if (typeof icon === 'string' && icon !== '') {
        const holder = add(icon);
        holder.style.fontSize = '28px';
        el.appendChild(holder);
    }
    const text = document.createElement('div');
    const name = add(title);
    name.style.fontWeight = '600';
    text.appendChild(name);
    if (hasBody(body)) text.appendChild(add(body));
    el.appendChild(text);

    document.body.appendChild(el);
    toast = el;
    timer = setTimeout(removeToast, TOAST_MS);
    announce(hasBody(body) ? `${title}. ${body}` : String(title));
}

/**
 * Show a toast, fire confetti and play a sound. Presets: complete, milestone,
 * streak, certificate. An unknown preset does nothing. Never throws.
 *
 * @param {'complete'|'milestone'|'streak'|'certificate'} name
 * @param {{ title?: string, body?: string, icon?: string|Node, target?: Element,
 *   sound?: string|false, parts?: Object }} [options] - `parts` sends the toast,
 *   confetti and sound through a host's parts.
 *   A part the host does not have is skipped, with no standalone fallback.
 * @returns {undefined}
 */
export function celebrate(name, options) {
    if (typeof name !== 'string' || !hasOwn(PRESETS, name)) return;
    const { title, icon, sound: presetSound, count } = PRESETS[name];
    const shownTitle = ownValue(options, 'title') ?? title;
    const body = ownValue(options, 'body');
    const shownIcon = ownValue(options, 'icon') ?? icon;
    const soundOption = ownValue(options, 'sound');
    const key = soundOption === false ? null : (typeof soundOption === 'string' ? soundOption : presetSound);
    const given = ownValue(options, 'parts');
    const routed = given !== null && typeof given === 'object';

    if (typeof document === 'undefined' || typeof window === 'undefined') {
        // No DOM: only a host's parts can still do something.
        if (!routed) return;
    }
    const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
    const motionAllowed = () => prefersReducedMotion(window).matches !== true;

    attempt(() => {
        if (routed) {
            return given.ui?.popup({ kind: 'custom', title: shownTitle, body, icon: shownIcon, burst: false });
        }
        showToast(shownTitle, body, shownIcon);
    });
    attempt(() => {
        if (!hasDom || !motionAllowed()) return;
        const at = centreOf(ownValue(options, 'target'));
        if (routed) return given.particles?.burst?.('confetti', at, { count });
        particles ??= new ParticleSystem({ canvasId: 'dopamine-celebrate-canvas' });
        particles.burst('confetti', at, { count });
    });
    if (key === null) return;
    attempt(() => {
        if (routed) return given.sound?.play?.(key);
        sound ??= new SoundManager();
        // The manager reads the mute flag once, so take a mute made elsewhere.
        sound.muted = sound.storage.getItem(sound.storageKey) === 'true';
        return sound.play(key);
    });
}

/** Remove the toast, the live region, the timers, and the particle system and sound manager the standalone route made. */
export function destroyCelebrations() {
    removeToast();
    clearTimeout(regionTimer);
    regionTimer = null;
    region?.remove();
    region = null;
    const made = [particles, sound];
    particles = null;
    sound = null;
    for (const part of made) attempt(() => part?.destroy());
}
