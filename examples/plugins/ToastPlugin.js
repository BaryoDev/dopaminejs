/**
 * Floats a short message when the player earns XP.
 */
export const ToastPlugin = {
    name: 'toast',
    version: '1.0.0',
    api: 3,
    requires: ['ui'],

    install(ctx) {
        const off = ctx.events.on('xp_gained', ({ amount }) => {
            // Read the part when the event fires, never at install time.
            ctx.parts.ui?.text({ text: `+${amount} XP` });
        });
        return () => off();
    }
};
