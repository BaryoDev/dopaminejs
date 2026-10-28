/**
 * Game feedback as a plugin: combo, near miss, lucky moment and the run
 * summary, drawn through the ui and particles parts, plus the jump, score and
 * gameover sounds. Nothing here runs at import time.
 */

const TEXT = {
    combo: '{n}× COMBO!',
    nearMiss: 'CLOSE CALL!',
    luckyMoment: 'LUCKY {n}×!',
    gameOver: 'Game Over',
    playAgain: 'Play Again',
    exit: 'Exit'
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const SOUNDS = {
    jump: (s) => s.playTone(400, 0.1, 'square', 0.2),
    score: (s, later) => {
        s.playTone(800, 0.15, 'sine', 0.25);
        later(() => s.playTone(1000, 0.15, 'sine', 0.25), 50);
    },
    gameover: (s, later) => {
        s.playTone(300, 0.2, 'sawtooth', 0.3);
        later(() => s.playTone(200, 0.2, 'sawtooth', 0.3), 100);
        later(() => s.playTone(150, 0.3, 'sawtooth', 0.3), 200);
    }
};

const el = (tag, text, css) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (css) node.style.cssText = css;
    return node;
};

/**
 * @param {Object} [options]
 * @param {{combo?: string, nearMiss?: string, luckyMoment?: string,
 *   gameOver?: string, playAgain?: string, exit?: string}} [options.text]
 *   Replaces the built-in strings. `{n}` is the multiplier. An empty string
 *   hides that text.
 */
export function gameFeedback(options) {
    const strings = { ...TEXT };
    const custom = options !== null && typeof options === 'object' && hasOwn(options, 'text') ? options.text : null;
    for (const key of Object.keys(TEXT)) {
        if (custom !== null && typeof custom === 'object' && hasOwn(custom, key) && typeof custom[key] === 'string') {
            strings[key] = custom[key];
        }
    }

    let ctx = null;
    const overlays = new Set();

    const text = (key, n, x, y, color, size) => {
        const label = strings[key].replace('{n}', () => String(n));
        if (label !== '') ctx.parts.ui.text({ text: label, x, y, color, size });
    };
    const burst = (kind, x, y, opts) => ctx.parts.particles?.burst(kind, { x, y }, opts);

    const feedback = {
        name: 'games',
        version: '1.0.0',
        api: 3,
        requires: ['ui'],

        combo(multiplier, x, y) {
            if (!ctx) return;
            text('combo', multiplier, x, y, '#ff6b6b', '32px');
            burst('fire', x, y, { count: 20 });
        },

        nearMiss(x, y) {
            if (!ctx) return;
            text('nearMiss', '', x, y, '#45b7d1', '20px');
            burst('sparkle', x, y, { count: 15, color: '#45b7d1' });
        },

        luckyMoment(multiplier, x, y) {
            if (!ctx) return;
            text('luckyMoment', multiplier, x, y, '#ffd700', '36px');
            burst('stars', x, y, { count: 12 });
            burst('confetti', x, y, { count: 25 });
        },

        /**
         * @param {{ score: number|string, metrics?: Object, onReplay?: Function, onExit?: Function }} data
         * @returns {HTMLElement|null} The overlay, removed when the plugin is disposed.
         */
        summary(data) {
            if (!ctx || !ctx.env.hasDom || data === null || typeof data !== 'object') return null;
            const box = el('div', undefined, 'display:flex;flex-direction:column;align-items:center;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000');
            box.className = 'message-box';
            if (strings.gameOver !== '') box.append(el('h1', strings.gameOver));
            box.append(el('div', data.score, 'font-size:3rem;font-weight:bold;color:#e06020;margin:10px 0'));

            const metrics = el('div', undefined, 'width:100%;margin-bottom:20px');
            const list = data.metrics !== null && typeof data.metrics === 'object' ? data.metrics : {};
            for (const [label, value] of Object.entries(list)) {
                const row = el('div', undefined, 'display:flex;justify-content:space-between;width:100%');
                row.append(el('span', `${label}:`), el('strong', value));
                metrics.append(row);
            }
            box.append(metrics);

            // Listeners, not onclick attributes, so a script-src CSP allows it.
            const button = (label, handler) => {
                const b = el('button', label);
                b.className = 'btn';
                b.addEventListener('click', handler);
                box.append(b);
            };
            if (strings.playAgain !== '') {
                button(strings.playAgain, typeof data.onReplay === 'function' ? data.onReplay : () => window.location.reload());
            }
            if (typeof data.onExit === 'function' && strings.exit !== '') button(strings.exit, data.onExit);

            document.body.append(box);
            overlays.add(box);
            return box;
        },

        install(context) {
            ctx = context;
            const removers = Object.keys(SOUNDS).map((key) => ctx.parts.sound?.register?.(key, SOUNDS[key]));
            context.expose(feedback);
            return () => {
                for (const remove of removers) remove?.();
                for (const box of overlays) box.remove();
                overlays.clear();
                ctx = null;
            };
        }
    };
    return feedback;
}
