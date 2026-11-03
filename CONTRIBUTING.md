# Contributing to AI Pulse

Thanks for your interest in improving AI Pulse. This project is a **static, data-driven
website** that tracks public information about large language models. It has no backend, no
runtime dependencies, and no build step — which keeps contributing pleasantly small.

- Website: <https://chengxi-z.github.io/llm-pulse/>
- Chinese README: [README.md](README.md) · English README: [README.en.md](README.en.md)
- Internal specs: [docs/SPEC.md](docs/SPEC.md), [docs/DATA-CONTRACT.md](docs/DATA-CONTRACT.md),
  [docs/V1.1-CONTRACT.md](docs/V1.1-CONTRACT.md), [docs/V1.2-CONTRACT.md](docs/V1.2-CONTRACT.md),
  [docs/EN-STYLE.md](docs/EN-STYLE.md), [docs/SKILLS.md](docs/SKILLS.md),
  [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)

---

## 1. Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | **≥ 20** | Zero npm dependencies — do not run `npm install` for the site itself. |
| Git | any recent | Conventional Commits in English. |
| Python | optional | Only used for ad-hoc Unicode / feed sanity checks. |

No package manager is required to run the site. `package.json` only declares scripts and
metadata; `node_modules` must never be committed.

## 2. Local development

```bash
git clone https://github.com/chengxi-Z/llm-pulse.git
cd llm-pulse

node scripts/serve.mjs            # http://127.0.0.1:4173 — data/ is mapped to /data/
node scripts/fetch-data.mjs --mode=local   # refresh local data from reachable sources
node scripts/build-feed.mjs       # regenerate site/feed.xml + site/feed.json
```

Useful checks (run these before opening a PR):

```bash
node --test                         # unit tests (data pipeline, assistant core, feeds)
node scripts/validate.mjs --strict  # data contract + site/feed integrity
node scripts/check-i18n.mjs --strict      # zh/en dictionary parity, no Chinese residue in en
node scripts/check-comments.mjs --strict  # comments and docstrings must be English
node skills/one-sentence-project/scripts/check-project.mjs --self
```

## 3. Repository layout

```
data/                  generated data (schemaVersion: 1) + snapshot/ raw captures
site/                  static site (publish root): 8 pages + 404 + assets/i18n
  assets/css/          design tokens (5 themes) + base + components + dashboard + skills + assistant + share
  assets/js/           data / render / app / i18n / dashboard + assistant(-core) + share (ESM, no deps)
  assets/i18n/         zh.json (source of truth) + en.json
scripts/               Node data pipeline, validators, preview server, i18n/comment checkers
skills/                reusable Agent Skill: one-sentence-project
tests/                 node:test suites
docs/                  specs, data contract, POC/acceptance reports, DISTRIBUTION/SKILLS playbooks, screenshots
.github/               workflows (ci / deploy / refresh-data) + ISSUE_TEMPLATE/skill-submission.yml
```

## 4. Data contract first

All site data comes from `data/{meta,models,news,rankings,resources,projects,skills}.json`
(see [docs/DATA-CONTRACT.md](docs/DATA-CONTRACT.md)). Rules:

1. **Never invent data.** Every entry must come from a public, citable source with a URL and
   an update time. If a source is unavailable, mark the source as `degraded`/`blocked` and
   show an empty/degraded state — never fabricated numbers.
2. **Normalize in `scripts/normalize.mjs`.** It is pure (no network, injected `now`), so every
   transformation must stay unit-testable. Keep the field shapes and enums in the contract.
3. **Degrade, don't crash.** One failing source must not break the pipeline; snapshots under
   `data/snapshot/` are the fallback for offline replay and degradation.
4. **No secrets in the repository.** GitHub Actions uses `GITHUB_TOKEN` (read-only) plus the
   optional notification secrets documented in [docs/AI-SHARE.md](docs/AI-SHARE.md).
5. **Skills are data too.** `data/skills.json` follows schema v1 (`schemaVersion`, `count`,
   `items[]`, detailed in [DATA-CONTRACT §6.1](docs/DATA-CONTRACT.md)) and is validated by
   `scripts/validate.mjs`. Do not hardcode skill content in the page; add entries to the JSON.
   Skills are not a place for engagement bait: no fabricated stars, no unverifiable claims, no
   copied content without attribution.

### 4.1 Bilingual skill fields

Skill items carry English content with optional `*Zh` variants: `name` / `nameZh`,
`description` / `descriptionZh`, `whenToUse` / `whenToUseZh`, `whenNotToUse` /
`whenNotToUseZh`, `usageSteps` / `usageStepsZh`. The frontend picks the current language and
falls back to the other language when a variant is missing. These data fields are **not** part
of the i18n dictionaries — the dictionaries only cover UI chrome.

Required per item: `id` (stable slug), `name`, `description`, `category`, `author`, `url`,
`license`, `sourceType` (`mine` | `official` | `community`), `tags`, `lang`, `updatedAt`.
Recommended: `repo`, `stars`, `featured`, `whenToUse`/`whenNotToUse`, `install`
(`target` + `command`), `usageSteps`, `skillPath`.

## 5. Code style

- **ESM only** (`import`/`export`), `.mjs` for Node scripts, `.js` (ESM) in `site/assets/js/`.
- **No runtime dependencies** — the browser code must stay dependency-free; Node scripts use
  built-in modules only. Do not add a bundler or build step.
- **Comments and JSDoc are English only** (see `docs/EN-STYLE.md` §10 and the checker
  `scripts/check-comments.mjs`). Explain *why*; keep comments accurate.
- Identifiers, enum values, CSS class names and data fields are English (already the case).
- User-visible strings **must not be hardcoded** in HTML/JS: use `data-i18n` /
  `data-i18n-attr` / `t('key')` and the dictionaries.
- Keep the browser payload small: no external fonts, images or scripts; CSS tokens drive every
  color. Run the page-performance budget checks from the acceptance checklist.
- Do not introduce `data-i18n-html` (XSS-safe design: the engine only sets `textContent`).

## 6. Internationalization (i18n)

`zh.json` is the source of truth; `en.json` must always mirror its key set.

To add or change a user-visible string:

1. Add the key to `site/assets/i18n/zh.json` **and** `site/assets/i18n/en.json` in the same
   change. Keys are flat, dot-separated (`nav.home`, `page.news.title`, `board.<id>.name`).
2. Keep `{placeholder}` sets identical in both languages (`{count}`, `{date}`, `{n}`, ...).
3. Use the string from HTML via `data-i18n="key"` / `data-i18n-attr="attr:key"`, or from JS
   with `t('key', { ... })`. Never hardcode the text. Dynamic copy feedback may pass a key
   through `data-copy-label-key` / `data-copy-fail-key` attributes — the checker resolves those
   as key references too, so keep the values as flat dictionary keys.
4. Follow the terminology, tone and length budgets in [docs/EN-STYLE.md](docs/EN-STYLE.md).
5. Run `node scripts/check-i18n.mjs --strict` — it must report **0 errors** (missing keys,
   empty values, key-set mismatch, Chinese residue in `en.json`, placeholder mismatch).
   Unused keys and unresolvable dynamic `t()` calls are warnings; `--strict-unused` tightens
   the unused-key check before a release.
6. For leaderboard display names use `board.<board-id>.name` / `.desc` / `.metric` through the
   explicit mapping constants in `site/assets/js/render.js`; unknown ids fall back to source data.
7. Enum-like data values (skill categories/sources, news kinds, modalities, resource types) also
   use explicit mapping constants + `t('data.*')` keys — never inline translated strings.
8. v1.2 namespaces: `nav.skills`, `page.skills.*`, `dashboard.*` (KPI / trend / orgs / price),
   `skills.*` (page, guide modal, submit flow, install), `projects.skills.*`, `about.follow.*`,
   `footer.address*`, `subscribe.address.*`, `share.*` distribution additions,
   `data.skillCategory.*`, `data.skillSource.*`, `share.kind.skill`. Add new strings to both
   dictionaries even if the markup lands later; unused keys are warnings, missing keys are errors.

Data payloads (model names, news titles, resource/project descriptions, source names, skill
content with its `*Zh` fields) are not translated in the dictionaries — they are published
content. English-mode data enrichment can land later via optional `*En` data fields (see roadmap).

## 7. Assistant, share, dashboard and skills code

`site/assets/js/assistant.js`, `assistant-core.js`, `share.js`, `dashboard.js` and `skills.js`
are ESM modules with no dependencies. Keep `assistant-core.js` **pure and DOM-free** (it runs in
Node tests); the DOM layer passes `{ lang }` into content functions. The i18n engine
(`site/assets/js/i18n.js`) is Node-safe: top-level code must never touch
`document`/`localStorage` — guard browser access. Never send API keys anywhere except the endpoint
the user configured (BYOK); keys stay in `localStorage`.

Dashboard rules (v1.2): render only from `data/*.json` (no invented numbers), use pure
SVG/CSS/JS (no chart library, no external fonts/images), keep the new JS ≤12 KB raw and CSS
≤8 KB raw, run animations once on first view, and render final values immediately under
`prefers-reduced-motion: reduce`. A dashboard failure must only affect that section — never block
the rest of the page.

Skills page rules (v1.2): content comes from `data/skills.json`; usage guides copy via the
Clipboard API with a `document.execCommand` fallback; the modal traps focus, closes on Esc and
restores focus; install commands and directories are displayed as text and never executed.

## 8. Commit messages

Conventional Commits, **English**, imperative mood, ≤ 72 characters for the subject:

```
feat(ui): add five-theme picker and back-to-top button
fix(i18n): align English leaderboard metric labels
docs: add CONTRIBUTING and English README
test(data): cover snapshot degradation path
chore(ci): run check-comments in CI
```

Scopes in use: `ui`, `i18n`, `data`, `assistant`, `share`, `dashboard`, `skills`, `feed`,
`docs`, `ci`, `skill`.
Explain the "why" in the body when the change is not obvious. Reference issues with `Closes #12`.

## 9. Pull request flow

1. Fork the repository and branch from `main` (`feat/<topic>`, `fix/<topic>`, `docs/<topic>`).
2. Keep PRs focused: one logical change, no unrelated formatting churn.
3. Run the checks from §2 locally and make sure they pass.
4. Include **evidence** for UI changes: screenshots (light/dark, zh/en, desktop/mobile) and/or
   the CDP/headless assertion commands you ran.
5. Open the PR with: what changed, why, how it was verified, and known limitations/boundaries.
6. CI must be green (`ci.yml`: data contract, tests, feeds, site validation; i18n and comment
   checkers are part of the release gate).
7. A maintainer reviews for: data authenticity, contract compliance, i18n key parity, English
   style, accessibility, and visual consistency. Squash-merge with a Conventional Commit title.

<a id="skills"></a>
## 10. Skills contributions (My Skills library)

The public [Skills page](https://chengxi-z.github.io/llm-pulse/skills.html) lists real, public
Agent Skills from three sources: `mine` (built in this repository), `official` (maintained by
model/platform vendors) and `community` (public community repositories). Third-party skills are
**indexed with metadata only** — their content is never hosted here.

### What we accept

- A real, reachable skill: a public repository, a skill directory containing `SKILL.md`, or a
  curated collection of skills.
- A truthful license: the SPDX name when the repository declares one, or `null` when no license
  is declared (index-only entries must not copy content).
- No malicious content: no credential theft, data exfiltration, destructive commands or obfuscated
  scripts. Maintainers read `SKILL.md` and any scripts before merging.
- A usable guide: when to use it, when not to use it, an install command and short usage steps.
- No duplicates, and a sensible category/tags.

We do **not** accept: infringing or unauthorized content, empty/ad-only repositories, unreachable
links, or skills that require uploading secrets to "try" them.

### Three ways to submit

1. **GitHub Issue form (recommended)** — open the
   [skill submission form](https://github.com/chengxi-Z/llm-pulse/issues/new?template=skill-submission.yml)
   and fill in the fields. A maintainer reviews it and updates the data file.
2. **Download the JSON template** — the Skills page generates a `skill.json` template from your
   form input; use it as the basis for a pull request.
3. **Fork and open a pull request** — add one entry to [`data/skills.json`](data/skills.json)
   following the schema in [DATA-CONTRACT §6.1](docs/DATA-CONTRACT.md), then open a PR. Preview
   locally with `node scripts/serve.mjs` and open `/skills.html` to verify the card and guide.

### Data rules (summary)

- `id` is a unique kebab-case slug; `count` must equal the number of `items`.
- English fields are primary: `name`, `description`, `whenToUse`, `whenNotToUse`, `usageSteps`.
  Provide Chinese variants with a `Zh` suffix (`nameZh`, `descriptionZh`, ...); the UI falls back
  to the other language when a translation is missing. These data fields are **not** part of the
  i18n dictionaries.
- `url` must be a public http(s) link; `repo` must be `owner/name` when present; `stars` is a
  number or `null`; `updatedAt` is an ISO 8601 timestamp.
- `sourceType` is `mine | official | community`; `category` is one of
  `methodology | data | writing | design | dev | research | other`.
- `install.target` and `install.command` are required and displayed as copy-only text (nothing is
  executed automatically); `usageSteps` is a short array (3 steps is usually enough).

### Review criteria

A submission is merged only when all of the following are true:

- [ ] The source link is publicly reachable (maintainers verify it, e.g. via the GitHub API).
- [ ] The license is stated truthfully; "none declared" is acceptable only for index-only entries.
- [ ] The skill contains no malicious or privacy-invasive behavior.
- [ ] The entry includes install and usage guidance.
- [ ] Bilingual fields are complete (English primary, Chinese where possible).
- [ ] The entry is not a duplicate and the category/tags are reasonable.

### Verifying locally

```bash
node scripts/validate.mjs   # data contract check (0 errors required; covers data/skills.json)
node scripts/serve.mjs      # preview http://127.0.0.1:4173/skills.html
node --test                 # unit tests
node scripts/check-i18n.mjs --strict      # UI dictionaries stay aligned
node scripts/check-comments.mjs --strict  # comments are English only
```

For the full guide see [docs/SKILLS.md](docs/SKILLS.md); for the bundled Skill package see
[skills/README.md](skills/README.md).

### License and security

- **Index only**: this repository stores metadata, not third-party skill content. Respect the
  upstream license before copying or redistributing anything.
- Never submit API keys, cookies, private URLs or personal data.
- Report malicious or infringing entries through the issue form with a `report` note; maintainers
  remove them after verification.

### Adding an entry directly

Add one object to the `items` array in `data/skills.json`:

```jsonc
{
  "id": "my-skill",                 // stable slug, unique
  "name": "My Skill",
  "nameZh": "我的技能",
  "description": "One sentence of real value.",
  "descriptionZh": "一句话价值。",
  "category": "methodology",        // methodology | data | writing | design | dev | research | other
  "author": "your-github-handle",
  "repo": "owner/repo",             // optional
  "url": "https://github.com/owner/repo/tree/main/skills/my-skill",
  "license": "MIT",
  "stars": null,                    // optional number
  "updatedAt": "2026-11-03T00:00:00.000Z",
  "sourceType": "community",        // mine | official | community
  "tags": ["methodology"],
  "featured": false,
  "lang": "en",                     // en | zh | multi
  "whenToUse": "...",
  "whenNotToUse": "...",
  "install": { "target": "~/.dsh/skills/my-skill", "command": "copy the folder here" },
  "usageSteps": ["step one", "step two"],
  "skillPath": "skills/my-skill/SKILL.md"
}
```

Then run `node scripts/validate.mjs --strict` (schema/enum/dedupe checks), `node --test`, and the
checks from §2. Update `count` if the pipeline does not do it for you. Never put secrets, tokens or
private repository URLs into a skill entry.

## 11. Contributing to the bundled Skill

`skills/one-sentence-project/` packages this project's workflow as a reusable Agent Skill.
Contributions are welcome for new reference templates, scaffold improvements, additional
examples, and quality gates. Keep `SKILL.md` frontmatter (`name`, `description`) valid, run:

```bash
node skills/one-sentence-project/scripts/check-project.mjs --self
node skills/one-sentence-project/scripts/scaffold.mjs _tmp/my-skill-demo --name demo --domain "example domain"
node skills/one-sentence-project/scripts/check-project.mjs --skeleton _tmp/my-skill-demo
```

and keep the Skill's value/boundary statements honest — no inflated claims.

## 12. Scope boundaries

AI Pulse is **not** a general web framework, has no backend/accounts/database/SSR, and is not
real-time (freshness is daily). Please keep contributions within that architecture; features
such as authentication, server-side APIs, payments or high-frequency streaming need a separate
discussion and a different project shape.

## 13. Code of conduct

Be respectful and constructive. Harassment, discrimination and personal attacks are not
tolerated. Assume good intent, critique ideas rather than people, and keep discussion in the
issue/PR thread so maintainers and contributors can follow along.

---

Questions? Open a GitHub Issue with the `question` label. For data-source corrections, include
the public URL and the timestamp so the fix is traceable.
