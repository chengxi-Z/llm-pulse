<!--
Template: acceptance checklist (POC / MVP / Release)
Used by: scripts/scaffold.mjs -> docs/ACCEPTANCE.md in the generated project.
Placeholders are substituted by the scaffold. Keep this file English-only.
Rule: a checklist item is only "pass" with evidence (command output, URL, file,
screenshot path). "Looks fine" is not evidence.
-->

# {{PROJECT_NAME}} — Acceptance Checklist

> Domain: {{DOMAIN}} ｜ Target: {{BASE_URL}} ｜ Date: {{DATE}}
> Three gates: **POC** (is it possible?), **MVP** (is it good enough?),
> **Release** (is it live and provable?). Do not skip a gate to save time:
> skipping POC is how projects discover their data source was fake or blocked
> after the UI is already built.

## 1. Phase P — POC gate

Goal: prove the data path and one rendered page with real data, or stop and
reshape the plan before building the UI.

| # | Check | Evidence |
| --- | --- | --- |
| P1 | Source matrix lists >= 10 candidate sources with HTTP status, latency, bytes, sample fields | `docs/DATA-SOURCES.md`, probe log |
| P2 | At least 2 sources return real data in `local` mode; at least 1 works in `ci` mode | probe output |
| P3 | One pipeline run produces schema-valid JSON for all six files | `node scripts/validate.mjs` |
| P4 | Data is real, not fabricated: spot-check 3 items back to their source URLs | notes in POC report |
| P5 | A prototype page renders that JSON without console errors | screenshot + DOM assertion |
| P6 | Degradation path verified: break one source, confirm the run still exits 0 with `degraded`/`blocked` status | terminal output |
| P7 | AI assistant feasibility proven (BYOK stream and/or offline fallback) or explicitly descoped with a reason | test or note |
| P8 | POC report written within the agreed timebox | `docs/POC-REPORT.md` |

Exit criteria: P1-P6 checked with evidence; if P3 or P4 fails, do not start MVP.

## 2. Phase M — MVP gate

### 2.1 Function

- [ ] All planned pages render real data on desktop and mobile views.
- [ ] Timeline: filters + search + source links work; each item exposes its source.
- [ ] Rankings: metric explanation, source name/URL, updatedAt; ranks contiguous.
- [ ] Entity library: search + >= 3 filters + sorting + pagination or virtual limit.
- [ ] Learning resources and project showcase: filters, external links, one-line value.
- [ ] AI assistant: configured key path (BYOK) plus offline fallback; no key is not a crash.
- [ ] Share/subscribe: social share or share card works; feed generated and valid.
- [ ] Empty states and fetch-failure states render for every data-driven section.
- [ ] Source status is visible on the site (ok / degraded / blocked).

### 2.2 Quality

- [ ] `node scripts/validate.mjs` -> 0 errors (warnings triaged).
- [ ] `node --test` -> all tests pass.
- [ ] No console errors on any page (browser automation or manual console check).
- [ ] No horizontal page overflow at 360 px and 1440 px.
- [ ] Contrast >= 4.5:1 for body text; keyboard reachable controls; visible focus.
- [ ] No secrets in the repository; API keys are user-supplied and local-only.
- [ ] All data text is escaped before injection (XSS spot-check with a `<script>` sample).
- [ ] Performance budget respected: CSS/JS raw and gzip sizes recorded.
- [ ] i18n (if in scope): dictionary key parity, no missing key on any page/state,
      `html lang` updates, and data-original language is allowed but UI is not.
- [ ] README lets a new contributor preview locally in three commands.

### 2.3 Independent verification

Ask one person or agent that did not build the feature to reproduce two checks
(for example: add a data source, and run the release validator). Record who
verified what; cross-checking catches "works on my machine" evidence.

## 3. Phase R — Release gate

### 3.1 Repository and automation

- [ ] Public repository `{{OWNER}}/{{PROJECT_SLUG}}`, license file present.
- [ ] `ci.yml` green on `main` (validate + tests).
- [ ] `deploy.yml` green: refresh -> validate -> stage -> deploy Pages.
- [ ] Scheduled refresh registered (cron) and a manual `workflow_dispatch` run succeeds.
- [ ] No generated artifacts committed unintentionally; `_artifact/`, `_tmp/` ignored.
- [ ] README states the live URL, local commands, data sources, and disclaimers.

### 3.2 Live checks

- [ ] Live URL returns 200 over HTTPS.
- [ ] All pages return 200 and render (headless browser or DOM dump); no console errors.
- [ ] `data/*.json` and feeds are reachable and parse.
- [ ] Live data timestamp is fresh (<= 24 h) and matches `generatedAt`.
- [ ] Every ranking board on the live site links to its public source.
- [ ] Broken-link check on curated external links: no 404; blocked-by-network
      links are classified honestly as unverified, not as broken.

### 3.3 Report

- [ ] `docs/ACCEPTANCE.md` records method, evidence, results per gate.
- [ ] Known limitations listed with concrete reasons (no vague "minor issues").
- [ ] Roadmap / next steps listed.
- [ ] User review checklist (<= 10 items, <= 10 minutes) included.
- [ ] Version, commit, Actions run IDs and live URL recorded.

## 4. Honesty rules (apply to every gate)

1. Never mark an item pass without evidence; prefer "not verified" over a guess.
2. Missing data is displayed as missing; never fill gaps with zeros or invented items.
3. Source status must match reality: `blocked` is acceptable, silently empty is not.
4. Record environment limits (firewall, rate limit, no browser) instead of hiding them.
5. If the user asks to ship without a gate, document the accepted risk and what is unverified.

## 5. Evidence index (fill at release)

| Evidence | Path / URL |
| --- | --- |
| Contract validation | `node scripts/validate.mjs --strict` output |
| Unit tests | `node --test` output |
| POC report | `docs/POC-REPORT.md` |
| Screenshots | `docs/screenshots/` |
| CI runs | Actions run URLs |
| Live site | {{BASE_URL}} |
| Data snapshot | `data/snapshot/` (local only, not committed) |
