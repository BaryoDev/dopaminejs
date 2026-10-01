# DopamineJS Themes

Official theme collection for DopamineJS - beautiful UI themes for your game.

## 📦 Installation

```bash
npm install dopaminejs dopaminejs-themes
```

## 🎨 Usage

```javascript
import { themeEngine } from 'dopaminejs-themes';

// Set a preset theme
themeEngine.setTheme('dark-cyberpunk');
```

A theme sets `--dopamine-*` CSS variables on the document root. The core
`dopaminejs/style.css` does not read them yet, so setting a theme does not
restyle the built-in overlay. Use the variables in your own CSS:

```css
.my-panel {
    background: var(--dopamine-bg);
    color: var(--dopamine-text);
    border-radius: var(--dopamine-border-radius);
}
```

## 🌈 Available Themes

### Modern (Default)
Clean, professional design with indigo accents
```javascript
themeEngine.setTheme('modern');
```

### Dark Cyberpunk
Neon cyan and magenta on black
```javascript
themeEngine.setTheme('dark-cyberpunk');
```

### Neon
Vibrant pink and purple with glowing effects
```javascript
themeEngine.setTheme('neon');
```

### Retro
8-bit pixel art style with orange accents
```javascript
themeEngine.setTheme('retro');
```

### Cute
Pastel colors with rounded corners
```javascript
themeEngine.setTheme('cute');
```

---

## 🎨 Custom Themes

Create your own theme:

```javascript
themeEngine.registerTheme('my-theme', {
    '--dopamine-primary': '#ff0000',
    '--dopamine-secondary': '#00ff00',
    '--dopamine-bg': '#000000',
    '--dopamine-text': '#ffffff',
    // ... more CSS variables
});

themeEngine.setTheme('my-theme');
```

### Available CSS Variables

```css
--dopamine-primary        /* Primary color */
--dopamine-secondary      /* Secondary color */
--dopamine-success        /* Success state */
--dopamine-warning        /* Warning state */
--dopamine-error          /* Error state */
--dopamine-bg             /* Background */
--dopamine-bg-light       /* Light background */
--dopamine-text           /* Text color */
--dopamine-text-dim       /* Dimmed text */
--dopamine-border         /* Border color */
--dopamine-shadow         /* Shadow color */
--dopamine-font           /* Font family */
--dopamine-border-radius  /* Border radius */
--dopamine-animation-speed /* Animation duration */
```

---

## 📝 License

MIT License - use freely in your projects!

See [LICENSE](./LICENSE) for details.

---

## 🔗 Links

- [DopamineJS Core](https://github.com/BaryoDev/dopaminejs)
- [Documentation](https://github.com/BaryoDev/dopaminejs#readme)
