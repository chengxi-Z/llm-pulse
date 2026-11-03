<!--
Template: data source strategy
Used by: scripts/scaffold.mjs -> docs/DATA-SOURCES.md in the generated project.
Placeholders are substituted by the scaffold. Keep this file English-only.
This file is the executable memory of the project: every source that was tried,
its result, and the fallback. Update it during POC and after every release.
-->

# {{PROJECT_NAME}} — Data Source Strategy

> Domain: {{DOMAIN}} ｜ Owner: {{OWNER}} ｜ Last updated: {{DATE}}
> Principle: **real, traceable, degradable data** — a missing section is
> acceptable; a fabricated one is not.

## 1. Source types (pick the highest available, in this order)

| Priority | Type | Why | Typical shape |
| --- | --- | --- | --- |
| 1 | Official API | stable schema, cheap, licensed | JSON |
| 2 | Official dataset / CSV / parquet-as-CSV | authoritative numbers, versioned | CSV, JSON, zip |
| 3 | Official RSS / Atom | low cost, timestamped | XML |
| 4 | Public HTML page | last resort, structure changes | HTML |
| 5 | Public mirror (only when legitimate) | reachability inside restricted networks | same shape as upstream |

Never scrape a private page, bypass a paywall, ignore `robots.txt`, or store
article full text. Keep `sourceName` + `sourceUrl` for every item and a removal
contact note on the about page.

## 2. Source matrix template

Fill one row per candidate **during POC**; keep the failures, they are evidence.

| id | Name | Type | URL | local | ci | Fields taken | Fallback | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| entity-api | Vendor public API | api | https://example.com/api/items | ok | ok | id, name, price | snapshot | primary entity source |
| leaderboard | Public leaderboard | dataset | https://example.com/scores.csv | ok | ok | rank, score | snapshot | official weights |
| blog-rss | Official blog RSS | rss | https://example.com/feed.xml | ok | ok | title, date, link | skip | 120-day window |
| region-blocked | Another API | api | https://example.org/api | blocked | ok | id, score | snapshot | blocked on some networks |

Registry template for `config/sources.json` (consumed by `scripts/fetch-data.mjs`):

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "id": "entity-api",
      "name": "Vendor public API",
      "url": "https://example.com/api/items",
      "type": "api",
      "file": "json",
      "enabled": true
    }
  ]
}
```

`type` is one of `api | dataset | rss | html`; `file` is the snapshot extension
(`json`, `xml`, `csv`, `html`). The skeleton fetch script probes sources and
saves raw snapshots; normalizers then map each snapshot into the data contract.

## 3. Dual-mode execution (local vs CI)

- `--mode=local`: only sources reachable from a normal developer machine.
- `--mode=ci`: the full set, executed on GitHub Actions where the network is
  unrestricted and authenticated API limits are higher.
- Same code path, different enable table. One boolean per source, not a fork.
- The site reads only the generated JSON, so local and CI produce the same shape;
  differences are visible through `meta.sources[].status` and `meta.mode`.
- Document which mode produced a committed snapshot; never mix modes silently.

## 4. Per-source status semantics

| status | Meaning | When |
| --- | --- | --- |
| `ok` | fetched and normalized successfully | live fetch or clean snapshot replay |
| `degraded` | live fetch failed, previous snapshot used, data still usable | timeout, 429, 5xx, parse error with snapshot |
| `blocked` | disabled in this mode, or failed with no snapshot | CI-only source in local mode, hard block, no public API |

Rules:
- A single source failure never aborts the whole run and never overwrites good
  snapshot data with an empty result.
- The site shows status lights and a short note; the assistant context excludes
  sections whose source is blocked.
- `blocked` with a reason is honest; an empty page with no explanation is a bug.

## 5. Snapshot, retry, and determinism

- Every successful raw response is written to `data/snapshot/<id>.<ext>`
  (git-ignored). On failure, replay the last snapshot and mark `degraded`.
- HTTP layer: timeout (10-15 s), 1-2 exponential-backoff retries on 429/5xx/
  network errors, and a per-source concurrency cap.
- Deterministic output: stable sort orders (by id, by publishedAt desc + id),
  timestamps injected through a `--now` parameter, no dependence on wall-clock
  in normalizers. Replay of the same snapshot must produce byte-identical JSON.
- Freshness windows are explicit: e.g. updates only from the last 120 days,
  entities created in the last 45 days for "new" sections. A source that stops
  publishing is noted (`ok` + note), not silently treated as broken.

## 6. Network restrictions and mirrors (field notes)

The reference implementation was built on a network where some public hosts
were unreachable. Lessons that generalize:

- Expect a split between your laptop and CI. Make the CI path the source of
  truth for "full data", and treat local mode as a development subset.
- Use a legitimate public mirror only when it serves the same official data;
  record the mirror in the source notes. A mirror is a reachability fix, not a
  license to scrape differently.
- Prefer Node's built-in `fetch` (Node >= 20) or Python `urllib` over shell
  HTTP clients when the sandbox's TLS stack is unreliable; route all network
  access through one small HTTP helper so retries/timeouts are consistent.
- Unauthenticated GitHub API allows ~60 requests/hour; use a token in CI
  (~5000/hour) and degrade stars updates gracefully when rate-limited.
- Some sites are SPAs whose real data lives in an embedded JSON payload, an
  official data file, or a public API discovered in the page's JS bundle. Check
  the official data page / `use this data` section before writing an HTML parser.

## 7. Compliance and safety

- Public data only; attribute every source; do not copy full article text.
- Do not put secrets, tokens, or private URLs in the repository or client bundle.
- Respect rate limits and `robots.txt`; set a descriptive User-Agent; cache.
- Provide a removal/contact route on the about page and honor it.
- Report third-party scores as-is with `sourceName`, `sourceUrl`, `updatedAt`;
  never present a derived metric as an official quality ranking.

## 8. POC probe checklist (run before writing normalizers)

1. List >= 10 candidate sources; record status, latency, byte size, and 3 sample fields.
2. For each "ok" source, save one raw sample as a test fixture.
3. For failed sources, classify: blocked by network, changed structure, no API,
   or gone. Try the official data download page before declaring failure.
4. Choose one primary source per data file; define the fallback chain.
5. Write the degradation test: force one failure and assert the run survives.
6. Update this matrix and hand the summary to the acceptance report.
