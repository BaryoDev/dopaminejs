# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | ✅ Yes    |
| 1.x     | ❌ No     |

## Scope

DopamineJS packages that handle data or external communication:

- **`dopaminejs`** — `RewardSystem` persists player state to `localStorage` by default. Supply a custom `storage` implementation to move this server-side or to an encrypted store.
- **`dopaminejs-plugin-ecosystem`** — `WebhookIntegration` sends HTTP POST requests to your configured endpoint on reward events. Validate and authenticate all incoming webhook payloads on your server.

All other packages (`dopaminejs-themes`, `plugin-debug-overlay`, `plugin-feedback-effects`, `plugin-howler-audio`, `plugin-sound-packs`, `plugin-webgl-particles`) are client-side rendering utilities and do not handle user data.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via **GitHub's Security Advisory feature**:

1. Go to [https://github.com/BaryoDev/dopaminejs/security/advisories/new](https://github.com/BaryoDev/dopaminejs/security/advisories/new)
2. Describe the vulnerability, affected package(s), version, and reproduction steps.

Alternatively, email **security@baryo.dev** with the subject line `[SECURITY] dopaminejs — <short description>`.

## Response Time

| Action | Target |
|--------|--------|
| Acknowledgement | Within 48 hours |
| Initial triage | Within 5 business days |
| Fix or mitigation | Within 30 days for high/critical severity |

We will coordinate disclosure timing with you. We aim to publish a security advisory and release a patch before public disclosure.
