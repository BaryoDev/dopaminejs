# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

## Scope

DopamineJS packages that handle data or external communication:

- **`dopaminejs`**: `RewardSystem` persists player state to `localStorage` by default. Pass a custom `storage` to move it elsewhere. Synchronous and promise-returning storages both work.
- **`dopaminejs-react`**: `RewardsProvider` wraps `RewardSystem`, so the same storage note applies. Pass a `storage` prop to override.
- **`dopaminejs-plugin-ecosystem`**: `WebhookIntegration` and `LeaderboardPlugin` POST reward events to the endpoint you configure. Nothing is sent until you set a `webhookUrl`.

The other packages (`dopaminejs-themes`, `plugin-debug-overlay`, `plugin-feedback-effects`, `plugin-howler-audio`, `plugin-sound-packs`, `plugin-webgl-particles`) only render and do not handle user data.

## What the library does not protect

These are properties of a client-side library, not vulnerabilities. Reports about them will be closed.

- **Player state is editable by the player.** XP, levels, streaks and achievements live in the browser. Anyone can change them in dev tools. Saved state is validated on load so a bad value cannot crash the app or reach `Object.prototype`, but it is not trusted. If a number matters (prizes, rankings, payments), compute it on your server.
- **`achievement.icon` is rendered as HTML.** This is on purpose, so an icon can be an `<img>` or an SVG. Every other achievement field is rendered as text. Never build `icon` from user input.
- **A webhook secret in browser code is visible to players.** With a `secret`, `WebhookIntegration` sends `X-Dopamine-Signature: sha256=<hex>`, the HMAC-SHA256 of the exact request body. That proves the body was not altered in transit. It does not prove the sender is honest, because the player holds the key. Verify the signature on the raw body, then treat the payload as a claim. Where `crypto.subtle` is missing (plain HTTP pages), requests go out unsigned with one console warning.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via **GitHub's Security Advisory feature**:

1. Go to [https://github.com/BaryoDev/dopaminejs/security/advisories/new](https://github.com/BaryoDev/dopaminejs/security/advisories/new)
2. Describe the vulnerability, affected package(s), version, and reproduction steps.

Alternatively, email **security@baryo.dev** with the subject line `[SECURITY] dopaminejs: <short description>`.

## Response Time

| Action | Target |
|--------|--------|
| Acknowledgement | Within 48 hours |
| Initial triage | Within 5 business days |
| Fix or mitigation | Within 30 days for high/critical severity |

We will coordinate disclosure timing with you. We aim to publish a security advisory and release a patch before public disclosure.
