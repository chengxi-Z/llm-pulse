# Security Policy / 安全政策

AI Pulse (照胆云) is a **static, open-source** project that aggregates public information about AI models.
It has **no backend, no accounts, no analytics, and no tracking**. This document describes the threat model,
privacy guarantees and how to report a vulnerability.


## Supported versions

| Version | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| Previous releases | Best effort |

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use one of:

1. GitHub **Security Advisories** (preferred): <https://github.com/chengxi-Z/llm-pulse/security/advisories/new>
2. Contact [@chengxi-Z](https://github.com/chengxi-Z) on GitHub to request a private channel.

Please include: affected page/file, reproduction steps, impact, and (if possible) a suggested fix.
We aim to acknowledge reports within **72 hours** and to release fixes for confirmed high-severity issues as soon as possible.
Please allow a reasonable window for a fix before public disclosure (coordinated disclosure).

## Threat model (summary)

| Asset | Threat | Mitigation |
| --- | --- | --- |
| Visitor browser | XSS via untrusted upstream data (RSS, leaderboards, Hacker News), malicious links, third-party scripts | All external data is escaped (`esc()`/`textContent`) before rendering; no third-party scripts/fonts/CDNs; external links limited to `http(s):` with `rel="noopener noreferrer"`; a Content-Security-Policy (CSP) and `referrer: no-referrer` meta tag on every page |
| Visitor BYOK API key | Leakage, unwanted upload, logging | Key lives **only in `localStorage`** on the visitor's browser; never sent to this site (there is no server); never logged, never injected into prompts/context; user can clear it in settings |
| Repository / maintainer | PII leakage (local paths/usernames), credentials, supply-chain attacks | PII and secret scans in CI (`scripts/security-check.mjs`); history rebuilt at v1.4 to remove earlier local-path mentions; Actions pinned to commit SHAs; least-privilege workflow permissions; CodeQL + Dependabot enabled |
| Upstream data | Malformed/malicious content, oversized payloads | Fetch scripts strip HTML and validate schema; page renders escaped text; JSON size limits; URL scheme allowlist |
| Sharing / distribution | Forged cards, privacy leakage in shared images | Share cards contain only public site data (no user data); links point to this site/repo only |

## Privacy statement

- The site uses **no analytics, cookies, fingerprinting, or third-party requests**.
- **BYOK AI assistant**: requests go **directly from your browser to the endpoint you configure** (DeepSeek / OpenRouter / Ollama / any OpenAI-compatible service). Your key and prompts are visible to that provider according to *their* privacy policy — never to this site. Offline mode works without any key and makes no network requests.
- Share cards are generated **locally in your browser** via Canvas; nothing is uploaded.
- The project does not collect, store or sell any personal data. Server logs are GitHub Pages logs, controlled by GitHub.

## Safe usage notes

- Treat the BYOK API key as a secret; avoid storing long-lived keys on shared/public computers; use the "clear key" action when done.
- The AI assistant can be wrong; do not treat its output as professional advice.
- Third-party leaderboard scores are aggregated as-is; see the About page for methodology and disclaimers.

## Out of scope

- Vulnerabilities in third-party services linked from the site (report to those vendors).
- Issues that require compromised local devices/browsers or browser extensions reading `localStorage`.
- Rate-limiting / DDoS of GitHub Pages (handled by GitHub).
- Data accuracy complaints (not a security issue; open a normal issue).

## Security practices in this repo

- Runtime: **zero third-party dependencies**, pure HTML/CSS/ESM.
- CI: `node scripts/security-check.mjs --strict`, `tests/security.test.mjs`, `node --test`, data contract validation, i18n checks, and CodeQL (JavaScript/TypeScript). The About page describes the data methodology: https://chengxi-z.github.io/llm-pulse/about.html
- Actions are pinned to immutable commit SHAs; permissions are scoped per workflow/job.
- Secrets are never committed; example keys are placeholders only.

Current release: **v1.4.0** (history rebuilt for privacy; see `docs/SECURITY-AUDIT.md` for residual risks).

Thank you for helping keep the project and its visitors safe.
