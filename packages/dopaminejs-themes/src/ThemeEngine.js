/**
 * Theme Engine
 * CSS variable-based theming system for GameUI
 */

export const Themes = {
    /**
     * Default modern theme
     */
    modern: {
        '--dopamine-primary': '#6366f1',
        '--dopamine-secondary': '#8b5cf6',
        '--dopamine-success': '#10b981',
        '--dopamine-warning': '#f59e0b',
        '--dopamine-error': '#ef4444',
        '--dopamine-bg': '#1f2937',
        '--dopamine-bg-light': '#374151',
        '--dopamine-text': '#f9fafb',
        '--dopamine-text-dim': '#9ca3af',
        '--dopamine-border': '#4b5563',
        '--dopamine-shadow': 'rgba(0, 0, 0, 0.3)',
        '--dopamine-font': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        '--dopamine-border-radius': '8px',
        '--dopamine-animation-speed': '0.3s',
    },

    /**
     * Dark cyberpunk theme
     */
    'dark-cyberpunk': {
        '--dopamine-primary': '#00ffff',
        '--dopamine-secondary': '#ff00ff',
        '--dopamine-success': '#00ff00',
        '--dopamine-warning': '#ffff00',
        '--dopamine-error': '#ff0000',
        '--dopamine-bg': '#0a0a0a',
        '--dopamine-bg-light': '#1a1a1a',
        '--dopamine-text': '#00ffff',
        '--dopamine-text-dim': '#00aaaa',
        '--dopamine-border': '#00ffff',
        '--dopamine-shadow': 'rgba(0, 255, 255, 0.3)',
        '--dopamine-font': '"Orbitron", "Courier New", monospace',
        '--dopamine-border-radius': '0px',
        '--dopamine-animation-speed': '0.15s',
    },

    /**
     * Neon theme
     */
    neon: {
        '--dopamine-primary': '#ff006e',
        '--dopamine-secondary': '#8338ec',
        '--dopamine-success': '#06ffa5',
        '--dopamine-warning': '#ffbe0b',
        '--dopamine-error': '#ff006e',
        '--dopamine-bg': '#000814',
        '--dopamine-bg-light': '#001d3d',
        '--dopamine-text': '#ffffff',
        '--dopamine-text-dim': '#adb5bd',
        '--dopamine-border': '#ff006e',
        '--dopamine-shadow': 'rgba(255, 0, 110, 0.5)',
        '--dopamine-font': '"Poppins", sans-serif',
        '--dopamine-border-radius': '12px',
        '--dopamine-animation-speed': '0.2s',
    },

    /**
     * Retro 8-bit theme
     */
    retro: {
        '--dopamine-primary': '#ff6b35',
        '--dopamine-secondary': '#f7931e',
        '--dopamine-success': '#7bc043',
        '--dopamine-warning': '#fbb03b',
        '--dopamine-error': '#e63946',
        '--dopamine-bg': '#2d3142',
        '--dopamine-bg-light': '#4f5d75',
        '--dopamine-text': '#ffffff',
        '--dopamine-text-dim': '#bfc0c0',
        '--dopamine-border': '#ff6b35',
        '--dopamine-shadow': 'rgba(0, 0, 0, 0.5)',
        '--dopamine-font': '"Press Start 2P", monospace',
        '--dopamine-border-radius': '0px',
        '--dopamine-animation-speed': '0.1s',
    },

    /**
     * Pastel cute theme
     */
    cute: {
        '--dopamine-primary': '#ffadad',
        '--dopamine-secondary': '#ffd6a5',
        '--dopamine-success': '#caffbf',
        '--dopamine-warning': '#fdffb6',
        '--dopamine-error': '#ffadad',
        '--dopamine-bg': '#ffffff',
        '--dopamine-bg-light': '#f8f9fa',
        '--dopamine-text': '#495057',
        '--dopamine-text-dim': '#adb5bd',
        '--dopamine-border': '#dee2e6',
        '--dopamine-shadow': 'rgba(0, 0, 0, 0.1)',
        '--dopamine-font': '"Quicksand", sans-serif',
        '--dopamine-border-radius': '20px',
        '--dopamine-animation-speed': '0.4s',
    },
};

/**
 * Theme Engine class
 */
export class ThemeEngine {
    constructor() {
        this.currentTheme = 'modern';
        this.customThemes = new Map();
    }

    /**
     * Set the active theme
     * @param {string} themeName - Name of the theme
     */
    setTheme(themeName) {
        const theme = this.customThemes.get(themeName) || Themes[themeName];

        if (!theme) {
            console.warn(`[ThemeEngine] Theme "${themeName}" not found`);
            return;
        }

        // Apply CSS variables to root
        const root = document.documentElement;
        for (const [key, value] of Object.entries(theme)) {
            root.style.setProperty(key, value);
        }

        this.currentTheme = themeName;

        // Emit event
        window.dispatchEvent(new CustomEvent('dopamine:theme-changed', {
            detail: { theme: themeName }
        }));
    }

    /**
     * Register a custom theme
     * @param {string} name - Theme name
     * @param {Object} variables - CSS variable definitions
     */
    registerTheme(name, variables) {
        this.customThemes.set(name, variables);
    }

    /**
     * Get list of available themes
     * @returns {string[]}
     */
    getAvailableThemes() {
        return [
            ...Object.keys(Themes),
            ...Array.from(this.customThemes.keys())
        ];
    }

    /**
     * Get current theme name
     * @returns {string}
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Export singleton instance
export const themeEngine = new ThemeEngine();

// Auto-apply default theme
if (typeof document !== 'undefined') {
    themeEngine.setTheme('modern');
}
