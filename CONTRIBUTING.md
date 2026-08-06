# Contributing to DopamineJS

Thank you for your interest in contributing to DopamineJS! This guide will help you get started.

## 📦 Monorepo Structure

DopamineJS uses a monorepo with npm workspaces:

```
dopaminejs/
├── packages/
│   ├── dopaminejs/            # Core (MPL-2.0)
│   ├── dopaminejs-themes/     # Themes (MIT)
│   └── plugin-*/              # One package per plugin (MIT)
├── examples/                  # Reference code, not published
└── scripts/                   # Release tooling
```

## 🚀 Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/dopaminejs.git
cd dopaminejs
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for all packages in the workspace.

### 3. Build All Packages

```bash
npm run build
```

### 4. Run Tests

```bash
npm test
```

## 🏗️ Development Workflow

### Working on Core

```bash
cd packages/dopaminejs
npm run dev
```

### Working on Plugins

Each plugin is its own package under `packages/plugin-*`:

```bash
cd packages/plugin-webgl-particles
npm run build
```

### Working on Themes

```bash
cd packages/dopaminejs-themes
npm run build
```

## 📝 Contribution Guidelines

### Code Style

- Use ES6+ features
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new particle effect
fix: resolve collision detection bug
docs: update plugin guide
refactor: simplify event bus logic
test: add tests for system registry
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Add tests if applicable
4. Run `npm test` to ensure all tests pass
5. Run `npm run build` to ensure builds succeed
6. Commit with conventional commit messages
7. Push and create a pull request

### What to Contribute

#### Core (MPL-2.0)
- Bug fixes
- Performance improvements
- New system interfaces
- Core architecture enhancements

#### Plugins (MIT)
- New plugins (audio, physics, visual effects)
- Plugin improvements
- Sound pack additions

#### Themes (MIT)
- New theme presets
- Theme engine improvements

#### Documentation
- Tutorials
- Examples
- API documentation
- Translation

## 🧪 Testing

### Running Tests

```bash
# All packages
npm test

# Specific package
npm test --workspace=dopaminejs
```

### Writing Tests

Place tests in `tests/` directory:

```javascript
import { describe, it, expect } from 'vitest';
import { MyFeature } from '../src/MyFeature.js';

describe('MyFeature', () => {
    it('should work correctly', () => {
        const feature = new MyFeature();
        expect(feature.value).toBe(42);
    });
});
```

## 📄 Licensing

### Core Contributions (MPL-2.0)
By contributing to `packages/dopaminejs`, you agree to license your contributions under MPL-2.0.

### Plugin/Theme Contributions (MIT)
By contributing to `packages/dopaminejs-themes` or any `packages/plugin-*`, you agree to license your contributions under MIT.

## 🎨 Creating Plugins

See [Plugin Development Guide](./PLUGIN_GUIDE.md) for detailed instructions.

### Quick Start

```javascript
export const MyPlugin = {
    name: 'my-plugin',
    version: '1.0.0',
    
    init(kernel) {
        // Your plugin logic
    },
    
    destroy() {
        // Cleanup
    }
};
```

## 🐛 Reporting Bugs

Use [GitHub Issues](https://github.com/BaryoDev/dopaminejs/issues) with:

- Clear title
- Steps to reproduce
- Expected vs actual behavior
- Environment (browser, OS, DopamineJS version)
- Code sample if possible

## 💡 Feature Requests

Open an issue with:

- Clear description of the feature
- Use case / motivation
- Proposed API (if applicable)
- Willingness to implement

## 📞 Getting Help

- [GitHub Discussions](https://github.com/BaryoDev/dopaminejs/discussions)
- [GitHub Issues](https://github.com/BaryoDev/dopaminejs/issues)

## 🙏 Thank You!

Every contribution helps make DopamineJS better for everyone!
