# DopamineJS Monorepo

> **Game Feel Engine for the Web** - Add juice, rewards, and feedback to HTML5 games

This is a monorepo containing:
- **dopaminejs** (MPL-2.0) - Core engine
- **dopaminejs-themes** (MIT) - Official themes
- **dopaminejs-plugin-\*** (MIT) - Official plugins, one package each

## 📦 Packages

### Core Package (MPL-2.0)

```bash
npm install dopaminejs
```

The core engine with:
- TypeScript declarations included, no `@types` package needed
- Plugin architecture (Kernel, EventBus, SystemRegistry)
- Default implementations (Canvas particles, Web Audio, basic physics)
- Reward system (XP, levels, achievements)
- Component-based game objects

**License**: MPL-2.0 (copyleft for core improvements)

---

### Plugin Packages (MIT)

Install only what you use. Each plugin is its own package.

| Package | Provides |
|---|---|
| `dopaminejs-plugin-webgl-particles` | `WebGLParticlePlugin` - GPU particles (10,000+) |
| `dopaminejs-plugin-howler-audio` | `HowlerAudioPlugin` - Advanced audio (Howler.js) |
| `dopaminejs-plugin-sound-packs` | Sound packs (retro, modern, cute, scifi) |
| `dopaminejs-plugin-ecosystem` | `BattlePassPlugin`, `LeaderboardPlugin`, webhooks |
| `dopaminejs-plugin-feedback-effects` | Floating text and confetti feedback |
| `dopaminejs-plugin-debug-overlay` | `DebugOverlayPlugin` - FPS and system inspector |

```bash
npm install dopaminejs-plugin-webgl-particles
```

> The bundled `dopaminejs-plugins` package was retired in 2.1.0 and unpublished
> from npm. Install the individual packages above instead; see
> [docs/MIGRATION.md](./docs/MIGRATION.md).

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
import { WebGLParticlePlugin } from 'dopaminejs-plugin-webgl-particles';
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

## 🚢 Releasing

Publishing is automated. There is no manual `npm publish` step and no npm token
in this repository; GitHub Actions authenticates via npm Trusted Publishing
(OIDC), which also attaches a provenance attestation to every release.

1. Bump the version of each package you want to publish.
2. Update `CHANGELOG.md`.
3. Tag with the core package's version and push:

```bash
git tag v2.1.0
git push origin v2.1.0
```

The `Publish` workflow (`.github/workflows/publish.yml`, the filename npm's
Trusted Publisher config is pinned to) verifies manifests, runs the tests, builds every
package, checks the tag matches `dopaminejs`'s version, then publishes only
those packages whose version is not already on npm. Re-running after a partial
failure is safe: already-published packages are skipped.

To preview without publishing, run the workflow manually from the Actions tab
with **dry run** left checked.

If a publish fails with `ENEEDAUTH`, run the workflow manually with **dry run**
checked. That runs a per-package OIDC diagnostic and prints the registry's
actual response, which `npm publish` hides:

- `HTTP 201` - trusted publishing is configured correctly for that package
- `HTTP 404 "package not found"` - no Trusted Publisher record exists for that
  package name, even though the package itself is on npm. Configure it at
  `npmjs.com/package/<name>/access`.

> The filename `publish.yml` is load-bearing. npm matches the OIDC request
> against the exact workflow filename registered on each package's Trusted
> Publisher config, so renaming this file breaks publishing until all eight
> packages are reconfigured on npmjs.com.

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
- **dopaminejs-themes**: MIT
- **dopaminejs-plugin-\***: MIT

See individual package LICENSE files for details.
