# DopamineJS Plugins

Official plugin collection for DopamineJS - extend your game with advanced features.

## 📦 Installation

```bash
npm install dopaminejs dopaminejs-plugins
```

## 🎵 Available Plugins

### Audio Plugins

#### HowlerAudioPlugin
Advanced audio system using Howler.js

```javascript
import { Game } from 'dopaminejs';
import { HowlerAudioPlugin } from 'dopaminejs-plugins';

const game = new Game();
await game.kernel.plugins.useAsync(HowlerAudioPlugin);
```

**Features**:
- Spatial audio
- Audio sprites
- Better cross-browser support
- Advanced playback control

---

### Visual Plugins

#### WebGLParticlePlugin
GPU-accelerated particles (10,000+ at 60 FPS)

```javascript
import { WebGLParticlePlugin } from 'dopaminejs-plugins';

game.kernel.plugins.use(WebGLParticlePlugin);
```

**Performance**: 10x-100x faster than Canvas

---

### Ecosystem Plugins

#### BattlePassPlugin
Tier-based progression system

```javascript
import { BattlePassPlugin } from 'dopaminejs-plugins';

game.kernel.plugins.use(BattlePassPlugin);
```

#### LeaderboardPlugin
Backend leaderboard integration

```javascript
import { LeaderboardPlugin } from 'dopaminejs-plugins';

game.kernel.plugins.use(LeaderboardPlugin);
```

---

## 🎨 Sound Packs

Pre-configured sound collections:

```javascript
import { getSoundPack } from 'dopaminejs-plugins';

const soundManager = new SoundManager({
    soundPack: 'retro'  // or 'modern', 'cute', 'scifi'
});
```

**Available Packs**:
- `retro` - 8-bit arcade sounds
- `modern` - Smooth, polished
- `cute` - High-pitched, cheerful
- `scifi` - Futuristic, electronic

---

## 📝 License

MIT License - feel free to use in commercial projects!

See [LICENSE](./LICENSE) for details.

---

## 🔗 Links

- [DopamineJS Core](https://github.com/BaryoDev/dopaminejs)
- [Documentation](https://github.com/BaryoDev/dopaminejs#readme)
- [Plugin Development Guide](https://github.com/BaryoDev/dopaminejs/blob/main/docs/PLUGIN_GUIDE.md)
