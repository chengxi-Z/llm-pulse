---
name: one-sentence-project
description: Turn a one-sentence request about tracking public information into a deployable static project. Use when the user asks for a public site that monitors a field (AI models, open-source projects, papers, policy, competitors), shows updates / rankings / resources with an optional BYOK AI assistant, and ships to GitHub Pages with scheduled refresh. Covers requirements, data contract, POC gate, MVP, release and acceptance; not for generic web apps, backends, accounts or real-time feeds.
---

# One-Sentence Project: from a sentence to a live data site

This skill encodes a method that was used to ship a real public tracker: a
one-sentence request became a requirements document, a data contract, a POC
report, a static site with an AI assistant, a GitHub Actions refresh pipeline,
a GitHub Pages release and an evidence-backed acceptance report. The reference
implementation is [AI Pulse](https://github.com/chengxi-Z/llm-pulse)
(LLM progress tracker; 451 models, 9-10 public leaderboards, ~89 updates from 8
feeds, 60 unit tests, daily refresh).

The method is domain-agnostic. Anything that changes over time and is publicly
documented can be tracked the same way: open-source ecosystems, papers, policy,
pricing, competitors, standards, releases. Use the bundled scaffold and checker
to make the process executable, not just a document to read.

## When to Use

Use this skill when **all** of these are true:

- The user gives a short brief (often one sentence) and expects a **working,
  public artifact**, not a design document alone.
- The subject is **information that changes over time** and is documented in
  public sources (APIs, datasets, RSS, public pages).
- The expected deliverable is a **lightweight public website** with sections
  such as updates, rankings, a searchable library or a project showcase.
- The user expects **freshness** (manual or scheduled refresh) and a **public
  URL** (GitHub Pages is the default).
- An **AI assistant** may be in scope as a browser-only BYOK add-on with an
  offline fallback.

Good triggers: "track the latest LLM releases and build me a site"; "make a
radar for my open-source ecosystem"; "I want a public paper tracker with
rankings and an assistant"; "monitor these competitors' public changelogs";
"build and publish it, you decide the details".

## When Not to Use

Do not use this skill for:

- **Generic web applications**: SaaS dashboards, CRUD backends, user accounts,
  payments, admin panels, real-time collaboration. This method is static-first
  by design and has no backend.
- **Real-time or high-frequency data**: live scores, tick-by-tick prices, chat,
  streaming telemetry. A scheduled static refresh is daily-ish, not real-time.
- **Private or credentialed data**: internal databases, paid APIs the user
  cannot legally share, scrape targets behind login. The method forbids
  bypassing access controls.
- **A single one-off page** with no ongoing data: use a plain HTML task instead.
- **Native apps, mini-programs, CMS-heavy content sites, pixel-only design
  work**: out of scope; the output here is a static site plus a data pipeline.
- **Compliance-risky collection**: paywalled full text, personal data, sources
  whose terms forbid automated access. Stop and clarify before building.

If the request is in scope but under-specified, do not refuse: ask at most three
questions (see Input Contract) and proceed with documented defaults.

## Input Contract

A one-sentence request must yield at least four elements. Extract them before
writing any code; if one is missing, ask, otherwise choose a default and record
it in the spec's decision log.

| Element | Question to answer | Example |
| --- | --- | --- |
| Domain | What field is being tracked, for whom? | LLM progress for developers and AI enthusiasts |
| Tracking target | What exactly changes and where is it documented? | new model releases, prices, public leaderboards, official RSS |
| Display form | Which sections/pages does the user expect? | updates timeline, rankings, model library, resources, projects, about |
| Publish target | Where does it go live and how is it refreshed? | public GitHub Pages, daily scheduled refresh, RSS/JSON feed |

Optional but useful: UI language(s), visual direction, brand name, repo owner,
refresh cadence, whether the AI assistant is in scope.

### Clarifying questions (maximum 3, only if the answer changes the build)

1. "Which public sources are authoritative for you, and is any of the data
   private or paid?"
2. "Which display form matters most: timeline, ranking table, searchable
   library, or project showcase?"
3. "Publish to GitHub Pages under a new public repository (default), or must it
   live under an existing domain/account?"

### Defaults when the user says "you decide"

- Public GitHub repository, MIT license, GitHub Pages hosting.
- Static site: HTML + CSS + native ESM JavaScript, zero npm runtime dependencies,
  zero build step.
- Data pipeline: Node.js 20+ scripts, pre-generated JSON (`schemaVersion: 1`),
  daily GitHub Actions refresh plus manual trigger.
- UI: light-luxe visual system with five themes and system dark mode, responsive
  at 360/768/1024/1440, English code and comments, user's language for content.
- AI assistant: optional, browser-only BYOK, offline retrieval fallback.
- Acceptance evidence: commands, URLs, tests, screenshots, CI run IDs.

## Workflow

Seven phases. A single agent runs them sequentially; a multi-agent team may run
independent phases in parallel, but **write scopes must be disjoint and every
phase still has to pass its gate**. The gates are hard stops: a skipped POC is
how a project discovers after building the UI that its "data source" is blocked
or fabricated.

Start by generating the skeleton:

```bash
node skills/one-sentence-project/scripts/scaffold.mjs <targetDir> \
  --name <repo-slug> --domain "<what the site tracks>"
```

The scaffold creates `docs/`, `data/`, `config/`, `scripts/`, `site/`, `tests/`
and `.github/workflows/`, with documentation pre-filled from `references/` and a
valid empty data contract.

### Phase 0 - Intake and standard

- **Work**: decode the sentence into the Input Contract; write the goals,
  measurable targets and explicit non-goals.
- **Deliverables**: `docs/SPEC.md` sections 1-3 (request, goals, non-goals).
- **Exit criteria**: all four input elements are filled; non-goals are written;
  at most three clarifying questions were asked; the scaffold exists.

### Phase 1 - Contract

- **Work**: define the information model and the six-file data contract v1;
  define acceptance criteria in the three-gate checklist.
- **Deliverables**: `docs/DATA-CONTRACT.md`, `docs/ACCEPTANCE.md`,
  `docs/DATA-SOURCES.md` (candidate matrix), `docs/DESIGN-TOKENS.md`.
- **Exit criteria**: contract fields, enums and cross-file rules are explicit;
  changing the contract later would require a `schemaVersion` bump; non-goals
  and quality bars are unambiguous.

### Phase 2 - Team or task split (optional)

- **Work**: one agent: keep a linear task list. A team: split by module with
  disjoint write scopes, ordered dependencies and one integrator.
- **Deliverables**: shared task board or checklist with owners and scopes.
- **Exit criteria**: no overlapping write scopes; dependent tasks ordered;
  integration and final acceptance owned by one lead.
- **Note**: multi-agent orchestration is an **optional enhancement**. The same
  phases and gates work for a single agent; the scaffold's `AGENTS.md` is
  written to serve both.

### Phase 3 - POC gate (hard gate)

- **Work**: probe at least 10 candidate sources; prove real data can be
  normalized into the contract; render one prototype page; verify degradation.
- **Deliverables**: `docs/POC-REPORT.md`, source matrix with HTTP status /
  latency / sample fields, one successful pipeline run producing all six JSON
  files, a prototype page with real data, degradation evidence.
- **Exit criteria**: contract validation passes; at least two sources work in
  local mode; spot-checked items resolve to real public URLs; a forced source
  failure degrades without aborting; the report is written within the timebox.
- **Stop rule**: if the data cannot be obtained truthfully, reshape the plan or
  descope the section. Do not proceed to MVP on placeholder data.

### Phase 4 - MVP

- **Work**: implement all planned pages with real data, empty and error states,
  filters/search, responsive layout, theme switching, i18n (if in scope), the
  optional assistant, feed/share, and unit tests.
- **Deliverables**: `site/`, `tests/`, `README.md`, screenshots.
- **Exit criteria**: `docs/ACCEPTANCE.md` Phase M fully checked; validator 0
  errors; tests green; no console errors; performance budget recorded.

### Phase 5 - Release

- **Work**: create the public repository, wire CI and the scheduled Pages
  deployment, run the first full refresh, verify the live site.
- **Deliverables**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  live URL, `docs/RELEASE.md` (optional), version tag.
- **Exit criteria**: CI green; Pages deployment green; live URL 200; feeds and
  `data/*.json` reachable; scheduled refresh registered and manually triggered
  once; live headless check has no console errors.

### Phase 6 - Acceptance and report

- **Work**: write the acceptance report with method, evidence per gate, known
  limitations, roadmap and a short user review checklist; run one independent
  verification (someone who did not build it reproduces two checks).
- **Deliverables**: final `docs/ACCEPTANCE.md`; release notes; user review list.
- **Exit criteria**: every gate has evidence; limitations are concrete; the
  report distinguishes verified, degraded and unverified behavior honestly.

## Quality Gates

Non-negotiable gates, with the check to run:

1. **No fabricated data.** Every item is traceable to a public source URL; a
   missing section shows an empty or degraded state instead of zeros or guesses.
2. **Source provenance.** Every update/ranking/resource carries `sourceName`
   and a clickable `sourceUrl`; derived rankings say what they are derived from
   and are labeled as not a quality ranking.
3. **Dual-mode data sources.** `local` (developer machine) and `ci` (full set on
   GitHub Actions) share one code path; per-source status is `ok`, `degraded`
   or `blocked`, visible on the site and in `data/meta.json`.
4. **Snapshot and degradation.** Raw responses are snapshotted; a failed source
   falls back to the last snapshot and never overwrites good data with nothing.
5. **Contract validation.** `node scripts/validate.mjs` passes in CI, and
   `--strict` is the release gate. Cross-file references and contiguous ranks
   are checked, not just JSON syntax.
6. **Browser acceptance.** Pages are checked in a real or headless browser:
   `page-ready` markers, no console errors, no horizontal overflow at 360 and
   1440 px, keyboard operation of custom widgets.
7. **Performance budget.** CSS and JS raw + gzip sizes recorded; no external
   fonts, CDNs, analytics or hotlinked images; data JSON size kept in check.
8. **Accessibility.** Body-text contrast >= 4.5:1 in every theme, semantic
   landmarks, skip link, visible focus, ARIA on dynamic widgets, reduced-motion
   support.
9. **Internationalization (if in scope).** Dictionary key parity, no missing
   keys in any state, `<html lang>` updates, switch without reload, localized
   dates/numbers; source text language is allowed to stay original.
10. **Security.** No secrets in the repository or client bundle; AI keys are
    user-supplied and stored in the browser; all injected data text is escaped;
    data text is treated as text, never HTML.
11. **Reproducibility.** Deterministic sort orders; injected clock for snapshot
    replay; running the same snapshot twice produces byte-identical JSON.
12. **Documentation and evidence.** README runs locally in three commands; each
    phase ends with command output, URL, test result or screenshot, not "done".

Self-check the skill package and a generated skeleton with:

```bash
node skills/one-sentence-project/scripts/check-project.mjs --self
node skills/one-sentence-project/scripts/check-project.mjs --skeleton <targetDir>
```

`--self` validates the package (frontmatter, references, scripts, README links,
source-repository mapping). `--skeleton` validates a generated project (required
files, contract JSON, package metadata, docs, workflows, generated scripts and a
run of the generated validator). Both exit non-zero on failure, so they can be
added to CI as-is.

## Value

What this skill actually delivers, stated conservatively:

- **A one-sentence brief becomes a live artifact.** The reference project shipped
  a public site with real data, scheduled refresh, an assistant, feeds and an
  acceptance report. The method is packaged, not anecdotal: `scaffold.mjs`
  produces a working skeleton in one command and `check-project.mjs` verifies it.
- **Portable to any "continuously track public information" domain.** The six
  contract layers (entities, updates, rankings, resources, projects, metadata)
  map onto models, repositories, papers, policies, competitors, releases and
  standards with minimal renaming. `examples/prompts.md` provides bilingual
  prompts for five domains with expected deliverables.
- **Real pitfalls are encoded as defaults**, not discovered again:
  - **dual-mode sources + legitimate public mirrors** for networks where some
    hosts are unreachable; local and CI produce the same contract shape;
  - **static-first** (no build chain, no framework) so Pages hosting stays simple
    and resilient; generated JSON is the boundary between pipeline and UI;
  - **snapshot fallback and honest `degraded`/`blocked` states** instead of fake
    data or a broken deploy;
  - **BYOK assistant** with an offline fallback, so a CORS-restricted endpoint
    degrades gracefully and no server-side secret exists;
  - **GitHub Actions cron refresh + Pages deploy** as the maintenance loop, with
    CI validation as the regression gate;
  - **acceptance methodology**: POC/MVP/Release gates, evidence per item,
    independent verification, recorded known limitations.
- **Contract-first prevents the most expensive rework.** UI built against a
  stable JSON contract can be redesigned without touching the pipeline; and a
  contract validator catches poisoned data before it reaches users.
- **Honest about what stays human.** The skill does not pick your sources for
  you, judge legal compliance for you, or guarantee that "light-luxe" looks good.
  It gives the procedure, the artifacts to fill, and the checks to prove claims.

## Boundaries

Be explicit with the user about all of these before starting:

1. **Not a general-purpose web framework.** The output is a static site plus
   Node scripts. If the requirement is a web app with server logic, this skill is
   the wrong tool.
2. **No backend, no accounts, no database.** No login, no user data, no
   server-side rendering, no admin panel. State is either in generated JSON or
   in the visitor's browser (`localStorage`).
3. **No real-time or high-frequency data.** Freshness is bounded by the
   scheduled pipeline (typically daily) and by the source's own update cadence.
   Do not promise live feeds.
4. **Dependencies on the environment**: Node.js 20+, a GitHub repository and
   Actions, a public and legally usable source, and a browser for visual
   acceptance. Networks with restrictions may force a local/CI split or a
   legitimate mirror.
5. **AI assistant constraints**: BYOK only (user supplies base URL, model and
   key); the endpoint must allow browser CORS; no key leaves the browser; an
   offline fallback is mandatory because online cannot be guaranteed.
6. **Compliance belongs to the project owner.** Public sources, attribution,
   robots/ToS respect, no full-text copying, and a removal contact are required;
   the skill cannot audit legal status for the user.
7. **Aesthetics and content need human review.** The five-theme system and
   tokens are a starting point; screenshots must be reviewed by the user. Curated
   resources, project descriptions and editorial summaries need a human editor.
8. **Multi-agent orchestration is optional.** The same phases work for a single
   agent. Splitting across a team adds coordination cost and is worth it only
   when modules are genuinely independent.
9. **A skeleton is a starting point, not a finished product.** Seed data is
   empty by design, pages are minimal, and the release gates still have to be
   passed by real work.
10. **Verification is limited by the environment.** Without a browser, visual
    and console checks are "unverified", not "passed"; record that honestly.
11. **Scope creep is the default failure mode.** The non-goals list and the
    acceptance checklist are the defense; use them to say no.

## Examples

Full bilingual prompts and deliverable lists live in `examples/prompts.md`.
Short examples:

1. **LLM tracker** - "Track the latest LLM releases, rankings and learning
   resources, build a public lightweight luxury-feel website with a BYOK AI
   assistant, and publish it on GitHub."
   Expected: static site with 5 data sections, 6-file contract, daily refresh,
   Pages release, acceptance report.
2. **Open-source ecosystem radar** - "Watch the top projects in the Rust async
   ecosystem and give me a public page with star trends, releases and an RSS
   feed." Expected: entity/news/project layers, GitHub API refresh with graceful
   rate-limit degradation, feed, Pages release.
3. **Paper radar** - "Build a public radar for new papers in multimodal
   reasoning, grouped by topic, with weekly refresh and an assistant that
   answers from the catalog." Expected: paper entity layer, topic tags, scheduled
   CI refresh from an open API/dataset, offline assistant retrieval.
4. **Policy tracker** - "Track new AI regulation updates from public
   government pages and publish a searchable timeline with sources." Expected:
   HTML/RSS source adaptation, provenance-heavy news layer, no fabricated
   summaries, provenance and disclaimer page.
5. **Competitor watch** - "Monitor public changelogs and pricing pages of these
   five competitors and publish an internal-style weekly digest site." Expected:
   compact contract, diff-based updates, snapshot fallback, clear "derived"
   labeling, review checklist before publishing publicly.

## Anti-patterns

Avoid these; each one has a matching gate above.

- Building the UI before the data contract and the source POC exist.
- Inventing rankings, filling missing values with zeros, or presenting a derived
  metric as an official score.
- Letting one failed source abort the whole pipeline, or overwriting a good
  snapshot with an empty result.
- Assuming one network mode: the developer machine and CI will not see the same
  sources.
- Skipping the POC gate and discovering blocked sources after the MVP.
- Declaring pages "verified" from screenshots only, with no command output, DOM
  assertion or console check.
- Committing API keys, or hiding a server-side proxy from the user while calling
  the assistant "BYOK".
- Hard-coding theme colors in components, so theme switching silently breaks.
- Showing a blocked source as an empty section with no status or explanation.
- Adding UI strings in one language only, or letting localized UI leak raw keys.
- Writing an acceptance report that says "all good" without evidence, or hiding
  known limitations.
- Expanding scope because a new source is interesting: check the non-goals first.

## Package Contents

| Path | Purpose |
| --- | --- |
| `SKILL.md` | This playbook: triggers, input contract, phases, gates, value, boundaries |
| `references/requirements-template.md` | SPEC template (request, goals, non-goals, information model, risks) |
| `references/data-contract-template.md` | Six-file contract v1, frontend hooks, validation rules, versioning |
| `references/acceptance-checklist.md` | POC / MVP / Release gates with required evidence |
| `references/data-source-strategy.md` | Source matrix, dual mode, degradation, snapshots, compliance, probe checklist |
| `references/design-tokens.md` | Five-theme light-luxe token system + extractable `theme.css` |
| `examples/prompts.md` | Bilingual one-sentence prompts for five domains with deliverables |
| `scripts/scaffold.mjs` | Generates the project skeleton (zero-dependency Node ESM) |
| `scripts/check-project.mjs` | Verifies the skill package (`--self`) and a generated skeleton (`--skeleton`) |

The scaffold substitutes double-brace placeholders from the reference templates;
keep the templates English and do not hand-edit generated docs without also
updating the template, or the next regeneration will lose the change.

## Install and CI

Copy the `one-sentence-project/` directory into your agent's skills directory
(the folder name must equal the frontmatter `name`). No dependencies are needed.
For CI, after `actions/setup-node` with Node.js 20:

```yaml
- name: Skill self-check
  run: node skills/one-sentence-project/scripts/check-project.mjs --self
- name: Skill scaffold smoke test
  run: |
    node skills/one-sentence-project/scripts/scaffold.mjs _tmp/skill-demo --name demo --domain "LLM tracking" --force
    node skills/one-sentence-project/scripts/check-project.mjs --skeleton _tmp/skill-demo
```

Both steps are zero-dependency and complete in seconds.
