/**
 * Debug overlay: the player snapshot and the last events, redrawn on its own
 * timer. For development builds.
 */

const EVENTS = [
    'xp_gained',
    'level_up',
    'achievement_unlocked',
    'personal_best',
    'streak_updated',
    'save_failed',
    'load_failed'
];

const KEEP = 20;

const show = (data) => {
    try {
        return JSON.stringify(data) ?? '';
    } catch {
        return '[unreadable]';
    }
};

/**
 * @param {Object} [options]
 * @param {number} [options.interval=500] - Redraw every this many ms (50 or more).
 * @param {HTMLElement} [options.container=document.body]
 */
export function debugOverlay(options = {}) {
    const opts = options !== null && typeof options === 'object' ? options : {};
    const interval = Number.isFinite(opts.interval) && opts.interval >= 50 ? opts.interval : 500;

    return {
        name: 'debug-overlay',
        version: '2.0.0',
        api: 3,

        install(ctx) {
            if (!ctx.env.hasDom) return undefined;

            const seen = [];
            const box = document.createElement('div');
            box.id = 'dopamine-debug-overlay';
            box.style.cssText = 'position:fixed;top:10px;right:10px;max-width:320px;max-height:80vh;overflow:auto;'
                + 'background:rgba(0,0,0,0.8);color:#0f0;font:12px monospace;padding:10px;border-radius:4px;'
                + 'z-index:10000;pointer-events:none';
            const title = document.createElement('strong');
            title.textContent = 'DopamineJS debug';
            const player = document.createElement('pre');
            const log = document.createElement('pre');
            player.style.cssText = 'margin:6px 0;white-space:pre-wrap';
            log.style.cssText = 'margin:0;white-space:pre-wrap';
            box.append(title, player, log);
            (opts.container || document.body).append(box);

            const draw = () => {
                try {
                    player.textContent = JSON.stringify(ctx.progress.snapshot(), null, 1);
                } catch {
                    player.textContent = 'no player loaded yet';
                }
                log.textContent = seen.join('\n');
            };

            const offs = EVENTS.map((name) => ctx.events.on(name, (data) => {
                seen.push(`${name} ${show(data)}`);
                if (seen.length > KEEP) seen.shift();
            }));

            draw();
            const timer = setInterval(draw, interval);

            return () => {
                clearInterval(timer);
                for (const off of offs) off();
                box.remove();
            };
        }
    };
}
