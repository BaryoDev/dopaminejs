# DopamineJS Monorepo

> **Game Feel Engine for the Web** - Add juice, rewards, and feedback to HTML5 games

This is a monorepo containing:
- **dopaminejs** (MPL-2.0) - Core engine
- **dopaminejs-plugins** (MIT) - Official plugins
- **dopaminejs-themes** (MIT) - Official themes

## 📦 Packages

### Core Package (MPL-2.0)

```bash
npm install dopaminejs
```

The core engine with:
- Plugin architecture (Kernel, EventBus, SystemRegistry)
- Default implementations (Canvas particles, Web Audio, basic physics)
- Reward system (XP, levels, achievements)
- Component-based game objects

**License**: MPL-2.0 (copyleft for core improvements)

---

### Plugins Package (MIT)

```bash
npm install dopaminejs-plugins
```

Official plugins:
- `HowlerAudioPlugin` - Advanced audio (Howler.js)
- `WebGLParticlePlugin` - GPU particles (10,000+)
- `BattlePassPlugin` - Tier progression
- `LeaderboardPlugin` - Backend sync
- Sound packs (retro, modern, cute, scifi)

**License**: MIT (use freely, even commercially)

---

### Themes Package (MIT)

```bash
npm install dopaminejs-themes
```

UI themes:
- Modern, Dark Cyberpunk, Neon, Retro, Cute
- CSS variable-based
- Easy customization

**License**: MIT (use freely, even commercially)

---

## 🚀 Quick Start

```javascript
import { Game } from 'dopaminejs';
import { WebGLParticlePlugin } from 'dopaminejs-plugins';
import { themeEngine } from 'dopaminejs-themes';

const game = new Game();

// Add plugins
game.kernel.plugins.use(WebGLParticlePlugin);

// Set theme
themeEngine.setTheme('dark-cyberpunk');

game.start();
```

---

## 🏗️ Development

This is a monorepo using npm workspaces:

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Test all packages
npm run test

# Work on specific package
cd packages/dopaminejs
npm run dev
```

---

## 📝 Licensing

### Why Different Licenses?

- **Core (MPL-2.0)**: Ensures improvements to the core engine are shared back
- **Plugins/Themes (MIT)**: Maximum freedom for extensions and customization

### Can I use this commercially?

**Yes!** Both MPL-2.0 and MIT allow commercial use:
- MPL-2.0: You can use the core in commercial projects. If you modify the core files, share those modifications.
- MIT: Plugins and themes have zero restrictions.

---

## 🔗 Links

- [Documentation](./docs/)
- [Plugin Development Guide](./docs/PLUGIN_GUIDE.md)
- [Examples](./examples/)
- [Issues](https://github.com/BaryoDev/dopaminejs/issues)

---

## 📄 License

- **dopaminejs**: MPL-2.0
- **dopaminejs-plugins**: MIT
- **dopaminejs-themes**: MIT

See individual package LICENSE files for details.
