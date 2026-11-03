<!--
Template: requirements / SPEC
Used by: scripts/scaffold.mjs -> docs/SPEC.md in the generated project.
Placeholders (double-brace tokens) are substituted by the scaffold; supported keys:
PROJECT_NAME, PROJECT_SLUG, DOMAIN, DATE, GENERATED_AT, OWNER, BASE_URL.
Keep this file English-only. Do not use the literal double-brace syntax in prose
examples, because the skeleton checker treats unresolved tokens as an error.
-->

# {{PROJECT_NAME}} — Product & Technical Spec (SPEC v0.1)

> Domain: {{DOMAIN}}
> Owner: {{OWNER}} ｜ Date: {{DATE}} ｜ Generated: {{GENERATED_AT}}
> Status: draft (fill before the Contract gate) ｜ Source of truth for this project.

This document converts the user's original one-sentence request into a standard
that every later phase can be checked against. Keep it short, concrete, and
measurable. If a later decision changes scope, append to the decision log
(section 11) instead of silently editing earlier sections.

## 1. One-sentence request

> Paste the user's sentence here verbatim. Example shape:
> "Track the latest progress in <field>, build a public lightweight website that
> shows updates / rankings / learning resources with an AI assistant, and ship it
> to GitHub."

### 1.1 Decoded input contract

| Element | Value | Source |
| --- | --- | --- |
| Domain | {{DOMAIN}} | user sentence |
| Tracking target | <what exactly changes over time: releases, rankings, prices, papers, policies, competitors> | user sentence |
| Display form | <pages and sections the user expects> | user sentence |
| Publish target | public URL, GitHub repo `{{OWNER}}/{{PROJECT_SLUG}}`, GitHub Pages `{{BASE_URL}}` | default |
| Refresh cadence | daily (GitHub Actions cron) + manual trigger | default |
| Language | UI language(s); if unstated default to the user's language | user sentence |

### 1.2 Clarifying questions (ask at most 3, only if the answer changes the build)

1. Which sources should be treated as authoritative, and is any of them private?
2. Which display form matters most (timeline, ranking table, searchable library, project showcase)?
3. Where should it be published: public GitHub Pages (default), an existing domain, or a local demo?

Never block on cosmetic details: choose a sensible default, record it in
section 11, and continue.

## 2. Goals (measurable)

| Goal | Measure | Target at release |
| --- | --- | --- |
| Fresh information | data age on the live site | <= 24 h after the scheduled run |
| Source coverage | live source types | >= 4 (API / dataset / RSS / HTML) |
| Usable pages | pages rendering real data | all planned pages, mobile + desktop |
| Trustworthy data | contract validation | 0 errors; every item traceable to a source URL |
| Public and verifiable | live checks | public URL 200, feeds valid, no console errors |
| Maintainable | contribution cost | add one source with one file + registry entry |

## 3. Non-goals (explicit)

- No user accounts, no login, no database, no server-side rendering, no backend process.
- No fabricated or interpolated data: missing data is shown as an empty or degraded state.
- No full-text copying of source articles; no bypassing access controls.
- No native app, no paid subscription system, no CMS.
- <add domain-specific non-goals here>

## 4. Information model

Six contract files, one entity layer each (see `docs/DATA-CONTRACT.md`):

| File | Content | Example for this domain |
| --- | --- | --- |
| `data/entities.json` | the tracked objects | <model / repository / paper / policy / competitor> |
| `data/news.json` | time-ordered updates | <release, benchmark, pricing, research, policy> |
| `data/rankings.json` | public rankings / leaderboards | <score, rank, source, updatedAt> |
| `data/resources.json` | curated learning material | <course, tutorial, paper, tool> |
| `data/projects.json` | showcase of projects | <self / community> |
| `data/meta.json` | site metadata + source status | <ok / degraded / blocked> |

Rules: stable slugs for IDs; ISO 8601 UTC timestamps; prices use an explicit
currency + unit; every item carries `sourceName` and a public `sourceUrl`.

## 5. Information architecture

| Page | Purpose | Must show |
| --- | --- | --- |
| `/` | overview | headline stats, latest updates, top ranking, data freshness |
| `/news.html` | timeline | filters, search, source links |
| `/rankings.html` | rankings | metric explanation, source, updatedAt |
| `/entities.html` | library | search, filters, sorting |
| `/resources.html` | learning | type / level / language filters |
| `/projects.html` | showcase | one-line value, tags, links |
| `/about.html` | method | sources, refresh mechanism, disclaimer |

Every page: navigation, theme switch, language switch (if i18n is in scope),
empty and error states, no white screen without JavaScript data.

## 6. Data sources

Track the source matrix in `docs/DATA-SOURCES.md`; do not duplicate it here.
Rules that are not negotiable:

- dual mode: `local` (sources reachable from a developer machine) and `ci`
  (full source set on GitHub Actions);
- per-source status `ok` / `degraded` / `blocked`, visible on the site;
- single-source failure must not abort the pipeline or wipe good data;
- snapshot fallback for every source; no data at all is better than fake data.

## 7. Visual and UX bar

See `docs/DESIGN-TOKENS.md`. Baseline: light-luxe design tokens (no hard-coded
colors in components), responsive at 360 / 768 / 1024 / 1440, reduced-motion
support, contrast >= 4.5:1 for body text, no external fonts or CDNs, and a
performance budget (CSS <= 120 KB raw, JS <= 200 KB raw, both gzip-tested).

## 8. AI assistant (optional module)

- Browser-only BYOK: base URL / model / API key are stored in the user's
  `localStorage`; nothing is sent to a server operated by this project.
- Offline fallback: deterministic retrieval answers over the shipped JSON data.
- Context injection is capped (<= 6 KB) and composed only from public site data.
- If the chosen endpoint does not allow CORS, the assistant must degrade
  gracefully and explain why; no hidden proxy is added.

## 9. Release and automation

- Repository `{{OWNER}}/{{PROJECT_SLUG}}`, MIT license unless the user says otherwise.
- `ci.yml`: contract validation + unit tests on every push and pull request.
- `deploy.yml`: scheduled refresh -> validate -> stage `_artifact/` -> GitHub Pages.
- Local preview: `node scripts/serve.mjs` (zero dependencies).
- Release gate: every item in `docs/ACCEPTANCE.md` is checked with evidence.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A source changes its HTML/API shape | missing section | normalize defensively; degrade the source, keep snapshots |
| Network restrictions (firewall, rate limit) | incomplete local data | dual mode; mirror when a public mirror is legitimate; CI for the full set |
| Ranking definitions differ | user confusion | label metric + source + updatedAt; never re-rank |
| CORS on the LLM endpoint | assistant unusable | BYOK + offline fallback + documented alternatives |
| Scope creep | never shipped | non-goals in section 3; acceptance checklist as the only gate |

## 11. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| {{DATE}} | Scaffold generated; static-first architecture chosen | zero build step, GitHub Pages, low maintenance |

## 12. Acceptance

The release gate is `docs/ACCEPTANCE.md`. Any deviation must be recorded there
under "Known limitations" with a concrete reason; never hide a missing feature.

## Appendix A — reference implementation (what was actually shipped)

The method behind this template shipped a public LLM tracking site with:
451 models from a public API, 9-10 leaderboards across 5 sources, ~89 updates
from 7 RSS feeds + one HTML change log, 22 curated resources, 13 projects,
60 unit tests, 0 contract errors, and daily GitHub Actions refresh deployed to
GitHub Pages. Use these numbers as a realism check, not as a target to copy.
