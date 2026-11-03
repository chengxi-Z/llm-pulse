<!--
Template: data contract (schema v1)
Used by: scripts/scaffold.mjs -> docs/DATA-CONTRACT.md in the generated project.
Placeholders are substituted by the scaffold. Keep this file English-only.
Changing a shipped contract is a breaking change: bump schemaVersion and ask
the project owner before removing or renaming fields.
-->

# {{PROJECT_NAME}} — Data Contract (DATA-CONTRACT v1)

> Generated for domain: {{DOMAIN}} ｜ Owner: {{OWNER}} ｜ Date: {{DATE}}
> Writer: `scripts/fetch-data.mjs` (plus normalizers) ｜ Validator: `scripts/validate.mjs`
> The frontend is a read-only consumer of these files. This contract is the
> boundary between the data pipeline and the site: change it deliberately.

## 0. Global conventions

- Location: `data/{meta,entities,news,rankings,resources,projects}.json`.
- Required top-level fields in every file: `schemaVersion` (number, `1`),
  `generatedAt` (ISO 8601 UTC, e.g. `2026-01-01T12:00:00.000Z`), `source`
  (non-empty string: generation mode or source summary).
- List files also carry a count field where defined (`count`) or derive from
  `generatedAt`; the frontend must handle empty arrays and missing optional fields.
- IDs are stable lowercase slugs or source-side stable IDs; they must not change
  between fetches for the same real-world object.
- Text fields are plain text only (no HTML). `summary` <= 240 characters,
  `description` <= 120 characters. Nullable fields use `null` or are omitted,
  never an empty string.
- Timestamps are ISO 8601 UTC. Display-time localization happens in the browser.
- Money: `pricing.currency` + `pricing.unit` must be explicit.
- Enum values are lowercase ASCII; unknown enum values are a contract error.

## 1. `data/meta.json` — site metadata and source status

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "mode": "local",                     // "local" | "ci" | "seed"
  "site": { "name": "{{PROJECT_NAME}}", "brand": "{{PROJECT_NAME}}", "version": "0.1.0" },
  "stats": {
    "entities": 0, "news": 0, "boards": 0,
    "resources": 0, "projects": 0, "orgs": 0,
    "sourcesOk": 0, "sourcesDegraded": 0
  },
  "sources": [
    {
      "id": "example-api",
      "name": "Example public API",
      "url": "https://example.com/api/v1/items",
      "type": "api",                   // "api" | "dataset" | "rss" | "html"
      "status": "ok",                  // "ok" | "degraded" | "blocked"
      "lastFetchedAt": "2026-01-01T12:00:00.000Z",
      "items": 120,
      "note": null
    }
  ],
  "latestHighlights": []               // optional, <= 3 short strings for the home page
}
```

Frontend use: headline counters, freshness label, source status lights, about page.

## 2. `data/entities.json` — the tracked objects

The domain-specific core. Rename the file only before the first release, and
update `docs/SPEC.md`, `scripts/validate.mjs`, and the frontend together.
Reference implementation: this layer held LLM models (`models.json`).

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "source": "example-api",
  "count": 1,
  "entities": [
    {
      "id": "vendor/model-slug",
      "name": "Display name",
      "org": "Vendor or maintainer",
      "releaseDate": "2026-01-01",     // "YYYY-MM-DD" or null
      "description": "One sentence, <= 120 characters.",  // optional
      "tags": ["tag-a", "tag-b"],
      "links": { "official": "https://example.com/model", "api": null },
      "metrics": { "contextWindow": 128000, "price": 1.5 },  // domain-specific, optional
      "status": "active",               // domain-specific enum, optional
      "sourceIds": ["example-api"]
    }
  ]
}
```

Rules: `id`, `name`, `org` are required; `count` equals `entities.length` when
present; `sourceIds` reference values documented in `docs/DATA-SOURCES.md`.

## 3. `data/news.json` — time-ordered updates

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "source": "rss+diff",
  "items": [
    {
      "id": "release-example-2026-01-01",
      "title": "Headline of the update",
      "summary": "What changed in one or two sentences, plain text.",
      "kind": "release",               // "release" | "benchmark" | "oss" | "pricing" | "research" | "policy"
      "sourceName": "Example Blog",
      "sourceUrl": "https://example.com/blog/post",
      "url": "https://example.com/blog/post",   // optional; fallback to sourceUrl
      "publishedAt": "2026-01-01T00:00:00.000Z",
      "tags": ["tag"],
      "entities": ["vendor/model-slug"],        // reference implementation used `models`
      "importance": 3,                 // 1..3
      "lang": "en"                     // "zh" | "en"
    }
  ]
}
```

Rules: unique `id`; `publishedAt` is the source publication time; `importance`
is an editorial weight (3 = headline); never invent summaries — if no summary is
available, use the source title or omit the item.

## 4. `data/rankings.json` — public rankings and leaderboards

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "source": "example-leaderboard",
  "boards": [
    {
      "id": "example-main",
      "name": "Example main leaderboard",
      "description": "What the metric measures and what it does not measure.",
      "sourceName": "Example Leaderboard",
      "sourceUrl": "https://example.com/leaderboard",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "metric": { "name": "Score", "unit": "points", "higherIsBetter": true },
      "entries": [
        { "rank": 1, "model": "Display name", "org": "Vendor", "score": 1482, "scoreDisplay": "1482", "votes": null, "delta": null }
      ]
    }
  ]
}
```

Rules: `rank` is contiguous starting at 1; `entries` must be non-empty when the
board exists; a board that cannot be fetched is removed from the array and
reported through `meta.sources[].status` instead of being filled with fake
scores; derived boards must say so in `description` (for example "derived from
the public catalog; not a quality ranking").

## 5. `data/resources.json` — curated learning resources

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "source": "curated",
  "items": [
    {
      "id": "example-course",
      "title": "Example course",
      "type": "course",                // "course" | "tutorial" | "paper" | "tool" | "awesome" | "video" | "book"
      "level": "beginner",             // "beginner" | "intermediate" | "advanced"
      "lang": "en",                    // "en" | "zh" | "multi"
      "url": "https://example.com/course",
      "author": "Author or organization",
      "description": "What the reader gets from it, plain text.",
      "tags": ["tag"],
      "free": true,
      "featured": false,
      "addedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Rules: human-curated; every link must be public and reachable (link check
before release); no affiliate or paywalled-only entries marked as free.

## 6. `data/projects.json` — project showcase

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "source": "curated+github",
  "items": [
    {
      "id": "owner/repo",
      "name": "Project name",
      "owner": "owner",
      "url": "https://github.com/owner/repo",
      "repo": "owner/repo",            // "owner/name" or null
      "summary": "One-line value proposition.",
      "tags": ["tag"],
      "highlight": "Why it matters.",
      "sourceType": "community",       // "self" | "community"
      "license": "MIT",
      "stars": 1200,                   // number or null
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "why": "Optional curator note."
    }
  ]
}
```

Rules: `sourceType` distinguishes the author's own work from community picks;
`stars` is refreshed from a public API with graceful degradation; never present
a guessed star count.

## 7. Frontend contract (DOM / file hooks)

- Shared header navigation; each page sets `<body data-page="index|news|rankings|entities|resources|projects|about">`.
- Data is loaded from the site root as `./data/*.json` (never `../data/`):
  - local preview: `scripts/serve.mjs` maps the repo `data/` folder to `/data/`;
  - release: `scripts/stage-site.mjs` copies `data/` into the published artifact.
- One shared loader module with functions such as `loadAll()`, `fmtNumber`,
  `relativeTime`, `escapeHtml`, `debounce`.
- Every data-driven section shows an empty state or a degraded-state note when
  its fetch fails; no page may go blank.
- Dates are rendered in the user's locale; numbers use thousands separators.
- All injected text goes through an escaping helper; never inject raw HTML from data.

## 8. Validation rules (`scripts/validate.mjs`)

1. All six files exist, parse as JSON, have `schemaVersion === 1`, a parseable
   `generatedAt`, and a non-empty `source`.
2. Required fields per level are present and non-empty; arrays contain objects
   with their required fields.
3. Enum values are valid.
4. Numeric fields use numbers (not numeric strings) and are non-negative where
   the contract says so.
5. Cross-file references resolve (`news.entities` values exist in `entities.entities[].id`).
6. Board ranks are contiguous; duplicates are rejected.
7. `generatedAt` is not in the future (allow <= 5 min clock skew); warn when
   data is older than 72 h.
8. `meta.stats` counters match the actual array lengths.

## 9. Schema versioning

- Additive optional fields are backward compatible: bump the patch version in
  this document, keep `schemaVersion: 1`.
- Renaming/removing required fields or changing semantics is breaking: bump
  `schemaVersion`, update validator, pipeline, frontend, and the acceptance
  checklist in the same change.
- `--strict` in the generated project turns warnings into errors; it is the
  release gate, not the development default.
