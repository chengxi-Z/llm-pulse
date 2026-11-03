#!/usr/bin/env node
/**
 * Project scaffold for the one-sentence-project skill.
 *
 * Generates a zero-dependency, static-first project skeleton from the skill's
 * reference templates: documentation, a valid empty data contract (schema v1),
 * a local preview server, a contract validator, source-probe pipeline stub,
 * static Pages staging, unit tests and GitHub Actions workflows.
 *
 * Usage:
 *   node skills/one-sentence-project/scripts/scaffold.mjs <targetDir> \
 *     --name <repo> --domain "<domain>" [--display-name <name>] [--owner <owner>] [--force]
 *
 * Exit codes: 0 success, 1 write/render failure, 2 usage error.
 *
 * The script is idempotent: it only rewrites the files it owns. Without
 * --force it refuses to touch a non-empty directory.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, "..");
const REFERENCES_DIR = join(SKILL_DIR, "references");
const SKILL_NAME = "one-sentence-project";
const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g;

const USAGE = [
  "Usage:",
  "  node skills/one-sentence-project/scripts/scaffold.mjs <targetDir> --name <repo> --domain \"<domain>\" [options]",
  "",
  "Required:",
  "  <targetDir>          Directory to generate (relative paths resolve from the current working directory)",
  "  --name <repo>        Repository slug, lowercase kebab-case (example: llm-pulse)",
  "  --domain <text>      What the site tracks and for whom, one sentence",
  "",
  "Options:",
  "  --display-name <s>   Human-readable project name (default: derived from --name)",
  "  --owner <s>          GitHub user or organization (default: your-github-name)",
  "  --force              Overwrite scaffold files in a non-empty target directory",
  "  --help               Show this help text",
  "",
  "Exit codes: 0 success, 1 write/render failure, 2 usage error.",
].join("\n");

function fail(message, code) {
  console.error("[" + SKILL_NAME + "] " + message);
  process.exit(typeof code === "number" ? code : 2);
}

function parseArgs(argv) {
  const args = {
    targetDir: null,
    name: null,
    domain: null,
    displayName: null,
    owner: null,
    force: false,
    help: false,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg.indexOf("--") === 0) {
      const body = arg.slice(2);
      const equals = body.indexOf("=");
      const key = equals >= 0 ? body.slice(0, equals) : body;
      const known = ["name", "domain", "display-name", "owner"];
      if (known.indexOf(key) === -1) fail("unknown option --" + key + "\n\n" + USAGE, 2);
      let value = equals >= 0 ? body.slice(equals + 1) : null;
      if (value === null) {
        value = argv[i + 1];
        if (value === undefined || value.indexOf("--") === 0) {
          fail("option --" + key + " requires a value\n\n" + USAGE, 2);
        }
        i += 1;
      }
      if (key === "name") args.name = value;
      else if (key === "domain") args.domain = value;
      else if (key === "display-name") args.displayName = value;
      else args.owner = value;
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length > 1) fail("expected exactly one target directory\n\n" + USAGE, 2);
  args.targetDir = positionals.length === 1 ? positionals[0] : null;
  return args;
}

function validateArgs(args) {
  if (!args.help) {
    if (!args.targetDir) fail("missing <targetDir>\n\n" + USAGE, 2);
    if (!args.name) fail("missing required option --name\n\n" + USAGE, 2);
    if (!args.domain) fail("missing required option --domain\n\n" + USAGE, 2);
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(args.name)) {
      fail("--name must be a lowercase repository slug (letters, digits, dot, dash, underscore)", 2);
    }
    if (!args.domain.trim()) fail("--domain must not be empty", 2);
    if (args.domain.length > 280) fail("--domain is too long (max 280 characters)", 2);
    if (args.owner && !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(args.owner)) {
      fail("--owner must be a GitHub user or organization name", 2);
    }
    if (args.displayName && !args.displayName.trim()) fail("--display-name must not be empty", 2);
  }
}

function deriveDisplayName(slug) {
  return slug
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildVars(args) {
  const now = new Date();
  const generatedAt = now.toISOString();
  const owner = args.owner || "your-github-name";
  return {
    PROJECT_NAME: (args.displayName || deriveDisplayName(args.name)).trim(),
    PROJECT_SLUG: args.name,
    DOMAIN: args.domain.trim(),
    DATE: generatedAt.slice(0, 10),
    GENERATED_AT: generatedAt,
    OWNER: owner,
    BASE_URL: "https://" + owner + ".github.io/" + args.name + "/",
  };
}

function resolveTarget(targetDir) {
  const target = resolve(process.cwd(), targetDir);
  if (basename(target) === "") fail("refusing to scaffold a filesystem root: " + target, 2);
  if (target === SKILL_DIR || target.indexOf(SKILL_DIR + sep) === 0) {
    fail("refusing to scaffold inside the skill package itself: " + target, 2);
  }
  return target;
}

function prepareTarget(target, force) {
  if (!existsSync(target)) return;
  const entries = readdirSync(target);
  if (entries.length > 0 && !force) {
    fail(
      "target directory is not empty: " + target + "\n" +
        "Re-run with --force to overwrite the scaffold files (unrelated files are kept).",
      2
    );
  }
}

function render(text, label, vars) {
  const rendered = text.replace(PLACEHOLDER, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      fail("unknown placeholder " + match + " in " + label, 1);
    }
    return vars[key];
  });
  const leftover = rendered.match(PLACEHOLDER);
  if (leftover) fail("unresolved placeholder " + leftover[0] + " in " + label, 1);
  return rendered;
}

function readReference(name) {
  const file = join(REFERENCES_DIR, name);
  if (!existsSync(file)) fail("missing reference template: references/" + name, 1);
  return readFileSync(file, "utf8");
}

function renderReferenceDoc(name, vars) {
  const raw = readReference(name).replace(/^<!--[\s\S]*?-->\s*/, "");
  return render(raw, "references/" + name, vars);
}

function extractCssBlock(markdown, label) {
  const match = markdown.match(/```css\r?\n([\s\S]*?)```/);
  if (!match) fail("no fenced css block found in " + label, 1);
  return match[1].replace(/\s+$/, "") + "\n";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------------- */
/* Generated files                                                           */
/* ------------------------------------------------------------------------- */

function buildReadme(vars) {
  return render(
    [
      "# {{PROJECT_NAME}}",
      "",
      "> {{DOMAIN}}",
      "",
      "**Status: scaffold (phase P not started).** This project was generated by the",
      "`one-sentence-project` skill. Read `AGENTS.md` first: it contains the phase plan,",
      "quality gates and definition of done.",
      "",
      "## Quick start",
      "",
      "Requirements: Node.js >= 20, no npm dependencies.",
      "",
      "    node scripts/serve.mjs      # preview at http://127.0.0.1:4173/",
      "    node scripts/validate.mjs   # validate the data contract",
      "    node --test                 # run unit tests (auto-discovery)",
      "    node scripts/stage-site.mjs # build the static release folder in _artifact/",
      "",
      "## What is here",
      "",
      "| Path | Purpose |",
      "| --- | --- |",
      "| `data/*.json` | contract v1 data, generated by the data pipeline |",
      "| `config/sources.json` | public source registry (add sources here) |",
      "| `scripts/fetch-data.mjs` | reachability and raw-snapshot stage of the pipeline |",
      "| `scripts/validate.mjs` | contract validator (CI gate) |",
      "| `scripts/serve.mjs` | zero-dependency local preview server |",
      "| `scripts/stage-site.mjs` | copies `site/` and `data/` into `_artifact/` for Pages |",
      "| `site/` | static frontend (HTML + CSS + native ESM JS) |",
      "| `docs/` | spec, data contract, sources, design tokens, acceptance checklist |",
      "| `tests/` | `node:test` unit tests |",
      "| `.github/workflows/` | CI and GitHub Pages deployment |",
      "",
      "## Next steps",
      "",
      "1. Fill `docs/SPEC.md` (domain, tracking target, pages, non-goals).",
      "2. Run the POC gate: list candidates in `docs/DATA-SOURCES.md`, probe them, keep evidence.",
      "3. Implement one normalizer per source that writes the six contract files.",
      "4. Build the MVP pages, then follow `docs/ACCEPTANCE.md` through the release gate.",
      "5. Publish: repository `{{OWNER}}/{{PROJECT_SLUG}}` and GitHub Pages {{BASE_URL}}.",
      "",
      "## Data policy",
      "",
      "Real, traceable, degradable data only. A missing section is acceptable; a",
      "fabricated number is not. Every item keeps its public source URL and the site",
      "shows a per-source status (ok / degraded / blocked).",
      "",
      "## Skeleton notes",
      "",
      "- `data/*.json` currently contain zero items with `schemaVersion: 1`; replace them",
      "  with generated data during the POC phase.",
      "- `_artifact/`, `_tmp/` and `data/snapshot/` are git-ignored.",
      "- Generated at {{GENERATED_AT}} by the one-sentence-project skill scaffold.",
      "",
    ].join("\n"),
    "README.md template",
    vars
  );
}

function buildAgents(vars) {
  return render(
    [
      "# AGENTS.md - working agreement for {{PROJECT_NAME}}",
      "",
      "> Domain: {{DOMAIN}}",
      "",
      "This file is for any AI agent or contributor working on this repository. Read it",
      "before editing. One agent can follow it alone; a team can split the phases across",
      "members as long as write scopes stay disjoint.",
      "",
      "## Ground rules",
      "",
      "1. Real data only: every item is traceable to a public source URL. Missing data is",
      "   shown as empty or degraded, never invented.",
      "2. Static-first: no backend, no database, no account system, no build step. The",
      "   browser reads pre-generated JSON from `data/`.",
      "3. Zero runtime dependencies: Node >= 20 built-ins only (fetch, fs, http).",
      "4. English for code, comments, commit messages and repository docs.",
      "5. Every phase ends with evidence: a command output, a URL, a file or a screenshot.",
      "6. Never commit secrets. Assistant API keys stay in the user's browser (BYOK).",
      "7. Conventional Commits in English (example: `feat(data): add source registry`).",
      "",
      "## Phase plan and exit criteria",
      "",
      "| Phase | Work | Deliverables | Exit criteria |",
      "| --- | --- | --- | --- |",
      "| Intake | decode the one-sentence request | `docs/SPEC.md` sections 1-3 | four input-contract elements filled; at most 3 clarifying questions asked |",
      "| Contract | data contract + acceptance criteria | `docs/DATA-CONTRACT.md`, `docs/ACCEPTANCE.md` | schema v1 valid; non-goals explicit |",
      "| Split | tasks and write scopes (team optional) | task list | write scopes disjoint; dependencies ordered |",
      "| POC | source probe + one pipeline run + prototype page | `docs/POC-REPORT.md`, real `data/*.json`, first page | 2+ sources ok; validate passes; degradation verified |",
      "| MVP | all pages + assistant (optional) + feed/share + quality gates | `site/`, `tests/` | acceptance checklist 2.x fully checked |",
      "| Release | CI + Pages + schedule | `.github/workflows/`, live URL | live URL 200, no console errors, data fresh |",
      "| Report | acceptance report | final `docs/ACCEPTANCE.md` | evidence per gate; limitations listed |",
      "",
      "## Commands",
      "",
      "    node scripts/serve.mjs             # local preview on http://127.0.0.1:4173/",
      "    node scripts/fetch-data.mjs        # probe sources and save raw snapshots",
      "    node scripts/validate.mjs          # contract check (add --strict for release)",
      "    node --test                        # unit tests (auto-discovery)",
      "    node scripts/stage-site.mjs        # build _artifact/ for a static host",
      "",
      "## Definition of done",
      "",
      "- [ ] `node scripts/validate.mjs` reports 0 errors.",
      "- [ ] `node --test` is green.",
      "- [ ] Every data-driven section has an empty state and a failure state.",
      "- [ ] No console errors on any page; no horizontal overflow at 360 px.",
      "- [ ] README lets a new contributor preview locally in three commands.",
      "- [ ] `docs/ACCEPTANCE.md` is filled with evidence for the current phase.",
      "",
      "## Where to look first",
      "",
      "- `docs/SPEC.md` - what we build and what we do not build.",
      "- `docs/DATA-CONTRACT.md` - the data boundary.",
      "- `docs/DATA-SOURCES.md` - source matrix, dual mode, degradation rules.",
      "- `docs/ACCEPTANCE.md` - the only release gate.",
      "",
      "Generated at {{GENERATED_AT}} by the one-sentence-project skill scaffold.",
      "",
    ].join("\n"),
    "AGENTS.md template",
    vars
  );
}

function buildPackageJson(vars) {
  const pkg = {
    name: vars.PROJECT_SLUG,
    version: "0.1.0",
    private: true,
    type: "module",
    description: vars.DOMAIN,
    engines: { node: ">=20" },
    scripts: {
      serve: "node scripts/serve.mjs",
      fetch: "node scripts/fetch-data.mjs",
      validate: "node scripts/validate.mjs",
      stage: "node scripts/stage-site.mjs",
      test: "node --test",
      check: "node scripts/validate.mjs && node --test",
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function buildGitignore() {
  return [
    "node_modules/",
    "_artifact/",
    "_tmp/",
    "data/snapshot/",
    ".DS_Store",
    "Thumbs.db",
    "*.log",
    ".env",
    ".env.*",
    "",
  ].join("\n");
}

function buildDataFiles(vars) {
  const envelope = (extra) => {
    const doc = { schemaVersion: 1, generatedAt: vars.GENERATED_AT, source: "seed" };
    return JSON.stringify(Object.assign(doc, extra), null, 2) + "\n";
  };
  const meta = {
    schemaVersion: 1,
    generatedAt: vars.GENERATED_AT,
    source: "seed",
    mode: "seed",
    site: { name: vars.PROJECT_NAME, brand: vars.PROJECT_NAME, version: "0.1.0" },
    stats: {
      entities: 0,
      news: 0,
      boards: 0,
      resources: 0,
      projects: 0,
      orgs: 0,
      sourcesOk: 0,
      sourcesDegraded: 0,
    },
    sources: [],
    latestHighlights: [],
  };
  return {
    "data/meta.json": JSON.stringify(meta, null, 2) + "\n",
    "data/entities.json": envelope({ count: 0, entities: [] }),
    "data/news.json": envelope({ items: [] }),
    "data/rankings.json": envelope({ boards: [] }),
    "data/resources.json": envelope({ items: [] }),
    "data/projects.json": envelope({ items: [] }),
  };
}

function buildConfigSources(vars) {
  const config = { schemaVersion: 1, sources: [] };
  return JSON.stringify(config, null, 2) + "\n";
}

function buildPocReport(vars) {
  return render(
    [
      "# POC Report - {{PROJECT_NAME}}",
      "",
      "> Phase P ｜ Domain: {{DOMAIN}} ｜ Date: {{DATE}}",
      "> Fill this report while running the POC gate. Keep failed attempts: they are",
      "> evidence that the final source choice is deliberate.",
      "",
      "## 0. Summary (write this last)",
      "",
      "- Feasible? ",
      "- Primary data path: ",
      "- Main risk: ",
      "",
      "## 1. Questions the POC must answer",
      "",
      "1. Can we obtain real, public, normalized data for every planned section?",
      "2. Which sources work from a developer machine, and which need CI?",
      "3. Can the static site render the contract data without a backend?",
      "4. Does the optional AI assistant work with BYOK and an offline fallback?",
      "",
      "## 2. Environment facts",
      "",
      "| Item | Value |",
      "| --- | --- |",
      "| Node version | |",
      "| Network restrictions | |",
      "| Browser available for checks | |",
      "",
      "## 3. Source matrix",
      "",
      "See `docs/DATA-SOURCES.md`. Record: id, type, HTTP status, latency, bytes,",
      "sample fields, local/ci availability, fallback.",
      "",
      "## 4. What worked / what did not",
      "",
      "| Source | Result | Decision |",
      "| --- | --- | --- |",
      "| | | |",
      "",
      "## 5. Pipeline result",
      "",
      "- Command: `node scripts/fetch-data.mjs`",
      "- Output: ",
      "- Contract validation: `node scripts/validate.mjs` -> ",
      "",
      "## 6. Degradation evidence",
      "",
      "Force one source to fail and record what happened to the run and to the site",
      "state (degraded / blocked / snapshot fallback).",
      "",
      "## 7. Prototype evidence",
      "",
      "- Page: ",
      "- Console errors: ",
      "- Screenshot: ",
      "",
      "## 8. Gate decision",
      "",
      "- [ ] POC gate passed (see `docs/ACCEPTANCE.md` section 1).",
      "- [ ] Or: descoped with a recorded reason and a revised plan.",
      "",
      "## 9. Next steps for the MVP",
      "",
      "1. ",
      "2. ",
      "3. ",
      "",
    ].join("\n"),
    "POC report template",
    vars
  );
}

function buildSiteIndex(vars) {
  const title = escapeHtml(vars.PROJECT_NAME);
  const description = escapeHtml(vars.DOMAIN);
  return render(
    [
      "<!doctype html>",
      "<html lang=\"en\" data-theme=\"ivory\">",
      "<head>",
      "  <meta charset=\"utf-8\">",
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "  <title>{{PROJECT_NAME}}</title>",
      "  <meta name=\"description\" content=\"" + description + "\">",
      "  <link rel=\"stylesheet\" href=\"assets/css/theme.css\">",
      "  <script>",
      "    // Apply the saved theme before first paint to avoid a flash of the wrong theme.",
      "    try {",
      "      var saved = localStorage.getItem(\"{{PROJECT_SLUG}}.theme\");",
      "      var allowed = [\"ivory\", \"noir\", \"jade\", \"rose\", \"graphite\"];",
      "      if (saved === \"auto\") {",
      "        saved = window.matchMedia(\"(prefers-color-scheme: dark)\").matches ? \"noir\" : \"ivory\";",
      "      }",
      "      if (saved && allowed.indexOf(saved) !== -1) {",
      "        document.documentElement.dataset.theme = saved;",
      "      }",
      "    } catch (error) {",
      "      // Storage can be unavailable (private mode); the default theme still renders.",
      "    }",
      "  </script>",
      "</head>",
      "<body data-page=\"index\">",
      "  <header class=\"site-header\">",
      "    <span class=\"brand\">" + title + "</span>",
      "    <span class=\"muted\">scaffold</span>",
      "  </header>",
      "  <main>",
      "    <p class=\"eyebrow\">Project scaffold</p>",
      "    <h1>" + title + "</h1>",
      "    <p class=\"muted\">" + description + "</p>",
      "    <section class=\"stat-grid\" aria-label=\"Data summary\">",
      "      <article class=\"card\">",
      "        <p class=\"eyebrow\">Entities</p>",
      "        <p class=\"stat-value\" id=\"stat-entities\">0</p>",
      "      </article>",
      "      <article class=\"card\">",
      "        <p class=\"eyebrow\">Updates</p>",
      "        <p class=\"stat-value\" id=\"stat-news\">0</p>",
      "      </article>",
      "      <article class=\"card\">",
      "        <p class=\"eyebrow\">Boards</p>",
      "        <p class=\"stat-value\" id=\"stat-boards\">0</p>",
      "      </article>",
      "      <article class=\"card\">",
      "        <p class=\"eyebrow\">Data updated</p>",
      "        <p class=\"stat-value\" id=\"stat-updated\">loading</p>",
      "      </article>",
      "    </section>",
      "    <section id=\"latest\" aria-live=\"polite\">",
      "      <h2>Latest updates</h2>",
      "      <div class=\"empty-state\" id=\"latest-empty\">",
      "        No data yet. Run the data pipeline to populate this section.",
      "      </div>",
      "    </section>",
      "  </main>",
      "  <script type=\"module\">",
      "    // Minimal data binding for the skeleton. The MVP replaces this with a shared loader.",
      "    const show = (id, value) => {",
      "      const element = document.getElementById(id);",
      "      if (element) element.textContent = value;",
      "    };",
      "    fetch(\"./data/meta.json\")",
      "      .then((response) => {",
      "        if (!response.ok) throw new Error(\"HTTP \" + response.status);",
      "        return response.json();",
      "      })",
      "      .then((meta) => {",
      "        show(\"stat-entities\", String(meta.stats.entities));",
      "        show(\"stat-news\", String(meta.stats.news));",
      "        show(\"stat-boards\", String(meta.stats.boards));",
      "        show(\"stat-updated\", new Date(meta.generatedAt).toLocaleString());",
      "      })",
      "      .catch(() => {",
      "        show(\"stat-updated\", \"data unavailable\");",
      "      });",
      "  </script>",
      "</body>",
      "</html>",
      "",
    ].join("\n"),
    "site/index.html template",
    vars
  );
}

function buildServeScript(vars) {
  return render(
    [
      "#!/usr/bin/env node",
      "/**",
      " * Zero-dependency static preview server for {{PROJECT_NAME}}.",
      " *",
      " * Serves `site/` as the web root and maps the repository `data/` folder to",
      " * `/data/`, matching the published artifact produced by scripts/stage-site.mjs.",
      " *",
      " * Usage:",
      " *   node scripts/serve.mjs",
      " *   node scripts/serve.mjs --port 8080 --host 0.0.0.0",
      " */",
      "import { createServer } from \"node:http\";",
      "import { readFile, stat } from \"node:fs/promises\";",
      "import { extname, join, normalize, resolve, sep } from \"node:path\";",
      "import { fileURLToPath } from \"node:url\";",
      "",
      "const ROOT = resolve(fileURLToPath(new URL(\"..\", import.meta.url)));",
      "const SITE = join(ROOT, \"site\");",
      "const DATA = join(ROOT, \"data\");",
      "",
      "const argv = process.argv.slice(2);",
      "function flag(name, fallback) {",
      "  const index = argv.indexOf(\"--\" + name);",
      "  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;",
      "}",
      "const PORT = Number(flag(\"port\", process.env.PORT || 4173));",
      "const HOST = flag(\"host\", process.env.HOST || \"127.0.0.1\");",
      "",
      "const MIME = {",
      "  \".html\": \"text/html; charset=utf-8\",",
      "  \".css\": \"text/css; charset=utf-8\",",
      "  \".js\": \"text/javascript; charset=utf-8\",",
      "  \".mjs\": \"text/javascript; charset=utf-8\",",
      "  \".json\": \"application/json; charset=utf-8\",",
      "  \".xml\": \"application/xml; charset=utf-8\",",
      "  \".txt\": \"text/plain; charset=utf-8\",",
      "  \".svg\": \"image/svg+xml\",",
      "  \".png\": \"image/png\",",
      "  \".jpg\": \"image/jpeg\",",
      "  \".webp\": \"image/webp\",",
      "  \".ico\": \"image/x-icon\",",
      "  \".woff2\": \"font/woff2\",",
      "};",
      "",
      "// Block path traversal: the resolved file must stay inside the base directory.",
      "function safeResolve(base, relativePath) {",
      "  const full = resolve(base, \".\" + normalize(\"/\" + relativePath));",
      "  if (full !== base && full.indexOf(base + sep) !== 0) return null;",
      "  return full;",
      "}",
      "",
      "async function serveFile(response, filePath, method) {",
      "  try {",
      "    const info = await stat(filePath);",
      "    if (!info.isFile()) return false;",
      "    const body = method === \"HEAD\" ? null : await readFile(filePath);",
      "    response.writeHead(200, {",
      "      \"content-type\": MIME[extname(filePath).toLowerCase()] || \"application/octet-stream\",",
      "      \"cache-control\": \"no-cache\",",
      "      \"access-control-allow-origin\": \"*\",",
      "      \"content-length\": info.size,",
      "    });",
      "    response.end(body);",
      "    return true;",
      "  } catch (error) {",
      "    return false;",
      "  }",
      "}",
      "",
      "const server = createServer(async (request, response) => {",
      "  const url = new URL(request.url || \"/\", \"http://\" + (request.headers.host || HOST));",
      "  const pathname = decodeURIComponent(url.pathname);",
      "  try {",
      "    if (pathname.indexOf(\"/data/\") === 0) {",
      "      const dataFile = safeResolve(DATA, pathname.slice(\"/data/\".length));",
      "      if (dataFile && (await serveFile(response, dataFile, request.method))) return;",
      "    }",
      "    const relative = pathname === \"/\" ? \"index.html\" : pathname.replace(/^\\/+/, \"\");",
      "    const candidates = [];",
      "    const siteFile = safeResolve(SITE, relative);",
      "    if (siteFile) {",
      "      candidates.push(siteFile);",
      "      if (!extname(relative)) candidates.push(siteFile + \".html\", join(siteFile, \"index.html\"));",
      "    }",
      "    for (const candidate of candidates) {",
      "      if (await serveFile(response, candidate, request.method)) return;",
      "    }",
      "    response.writeHead(404, { \"content-type\": \"text/plain; charset=utf-8\" });",
      "    response.end(\"404 Not Found\");",
      "  } catch (error) {",
      "    response.writeHead(500, { \"content-type\": \"text/plain; charset=utf-8\" });",
      "    response.end(\"500 Internal Server Error\");",
      "    console.error(\"[serve] \" + pathname + \" - \" + error.message);",
      "  }",
      "});",
      "",
      "server.listen(PORT, HOST, () => {",
      "  console.log(\"\");",
      "  console.log(\"  {{PROJECT_NAME}} - local preview\");",
      "  console.log(\"  http://\" + (HOST === \"0.0.0.0\" ? \"localhost\" : HOST) + \":\" + PORT + \"/\");",
      "  console.log(\"  site: \" + SITE);",
      "  console.log(\"  data: \" + DATA);",
      "  console.log(\"\");",
      "});",
      "server.on(\"error\", (error) => {",
      "  console.error(error.code === \"EADDRINUSE\" ? \"port \" + PORT + \" is already in use\" : error.message);",
      "  process.exit(1);",
      "});",
      "",
    ].join("\n"),
    "scripts/serve.mjs template",
    vars
  );
}

function buildValidateScript(vars) {
  return render(
    [
      "#!/usr/bin/env node",
      "/**",
      " * Data contract validator for {{PROJECT_NAME}} (DATA-CONTRACT v1).",
      " *",
      " * Usage:",
      " *   node scripts/validate.mjs            # warnings are allowed (development)",
      " *   node scripts/validate.mjs --strict   # warnings fail too (release gate)",
      " *",
      " * Exit codes: 0 pass, 1 contract errors (or warnings in strict mode).",
      " */",
      "import { existsSync, readFileSync } from \"node:fs\";",
      "import { dirname, join, resolve } from \"node:path\";",
      "import { fileURLToPath } from \"node:url\";",
      "",
      "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), \"..\");",
      "const DATA = join(ROOT, \"data\");",
      "const STRICT = process.argv.indexOf(\"--strict\") !== -1;",
      "",
      "const FILES = [\"meta\", \"entities\", \"news\", \"rankings\", \"resources\", \"projects\"];",
      "const errors = [];",
      "const warnings = [];",
      "const fail = (message) => errors.push(message);",
      "const warn = (message) => warnings.push(message);",
      "const isIso = (value) => typeof value === \"string\" && Number.isFinite(Date.parse(value));",
      "const isText = (value) => typeof value === \"string\" && value.trim().length > 0;",
      "const isUrl = (value) =>",
      "  typeof value === \"string\" && (value.indexOf(\"http://\") === 0 || value.indexOf(\"https://\") === 0);",
      "const isList = (value) => Array.isArray(value);",
      "const oneOf = (value, allowed) => allowed.indexOf(value) !== -1;",
      "",
      "const data = {};",
      "for (const name of FILES) {",
      "  const file = join(DATA, name + \".json\");",
      "  if (!existsSync(file)) {",
      "    fail(\"[\" + name + \".json] file is missing\");",
      "    continue;",
      "  }",
      "  try {",
      "    data[name] = JSON.parse(readFileSync(file, \"utf8\"));",
      "  } catch (error) {",
      "    fail(\"[\" + name + \".json] invalid JSON: \" + error.message);",
      "  }",
      "}",
      "",
      "// Shared envelope.",
      "for (const name of FILES) {",
      "  const doc = data[name];",
      "  if (!doc) continue;",
      "  if (doc.schemaVersion !== 1) fail(\"[\" + name + \"] schemaVersion must be 1\");",
      "  if (!isIso(doc.generatedAt)) fail(\"[\" + name + \"] generatedAt must be ISO 8601\");",
      "  if (!isText(doc.source)) fail(\"[\" + name + \"] source must be a non-empty string\");",
      "}",
      "",
      "// meta.",
      "const meta = data.meta;",
      "if (meta) {",
      "  if (!oneOf(meta.mode, [\"local\", \"ci\", \"seed\"])) fail(\"[meta] mode must be local, ci or seed\");",
      "  if (!meta.site || !isText(meta.site.name)) fail(\"[meta] site.name is missing\");",
      "  if (!meta.stats || typeof meta.stats !== \"object\") fail(\"[meta] stats object is missing\");",
      "  if (!isList(meta.sources)) fail(\"[meta] sources must be an array\");",
      "  else {",
      "    meta.sources.forEach((source, index) => {",
      "      const tag = \"[meta.sources[\" + index + \"]]\";",
      "      if (!isText(source.id) || !isText(source.name)) fail(tag + \" id/name is missing\");",
      "      if (!oneOf(source.type, [\"api\", \"dataset\", \"rss\", \"html\"])) fail(tag + \" type is invalid\");",
      "      if (!oneOf(source.status, [\"ok\", \"degraded\", \"blocked\"])) fail(tag + \" status is invalid\");",
      "      if (!isUrl(source.url)) fail(tag + \" url must be a public URL\");",
      "    });",
      "  }",
      "  if (isIso(meta.generatedAt)) {",
      "    const age = Date.now() - Date.parse(meta.generatedAt);",
      "    if (age > 72 * 3600 * 1000) warn(\"[meta] data has not been refreshed for more than 72 hours\");",
      "    if (age < -5 * 60 * 1000) fail(\"[meta] generatedAt is in the future\");",
      "  }",
      "}",
      "",
      "// entities.",
      "const entityIds = new Set();",
      "const entities = data.entities;",
      "if (entities) {",
      "  if (!isList(entities.entities)) fail(\"[entities] entities must be an array\");",
      "  else {",
      "    if (entities.count !== entities.entities.length) fail(\"[entities] count does not match entities.length\");",
      "    entities.entities.forEach((item, index) => {",
      "      const tag = \"[entities[\" + index + \"]]\";",
      "      if (!isText(item.id)) fail(tag + \" id is missing\");",
      "      else if (entityIds.has(item.id)) fail(tag + \" duplicate id: \" + item.id);",
      "      else entityIds.add(item.id);",
      "      if (!isText(item.name)) fail(tag + \" name is missing\");",
      "      if (item.org !== undefined && item.org !== null && !isText(item.org)) fail(tag + \" org must be a string\");",
      "      if (item.links && typeof item.links === \"object\") {",
      "        for (const key of Object.keys(item.links)) {",
      "          const link = item.links[key];",
      "          if (link !== null && link !== undefined && !isUrl(link)) fail(tag + \" links.\" + key + \" must be a URL\");",
      "        }",
      "      }",
      "    });",
      "    if (entities.entities.length === 0) warn(\"[entities] no entities yet (skeleton seed data)\");",
      "  }",
      "}",
      "",
      "// news.",
      "const newsKinds = [\"release\", \"benchmark\", \"oss\", \"pricing\", \"research\", \"policy\"];",
      "const news = data.news;",
      "if (news) {",
      "  if (!isList(news.items)) fail(\"[news] items must be an array\");",
      "  else {",
      "    const ids = new Set();",
      "    news.items.forEach((item, index) => {",
      "      const tag = \"[news[\" + index + \"]]\";",
      "      for (const key of [\"title\", \"summary\", \"sourceName\", \"url\"]) {",
      "        if (!isText(item[key])) fail(tag + \" \" + key + \" is missing\");",
      "      }",
      "      if (!isText(item.id)) fail(tag + \" id is missing\");",
      "      else if (ids.has(item.id)) fail(tag + \" duplicate id: \" + item.id);",
      "      else ids.add(item.id);",
      "      if (!oneOf(item.kind, newsKinds)) fail(tag + \" kind is invalid: \" + item.kind);",
      "      if (!isIso(item.publishedAt)) fail(tag + \" publishedAt must be ISO 8601\");",
      "      if (!oneOf(item.importance, [1, 2, 3])) fail(tag + \" importance must be 1, 2 or 3\");",
      "      if (!isList(item.tags)) fail(tag + \" tags must be an array\");",
      "      if (!isList(item.entities)) fail(tag + \" entities must be an array\");",
      "      else {",
      "        for (const id of item.entities) {",
      "          if (entityIds.size > 0 && !entityIds.has(id)) warn(tag + \" references unknown entity: \" + id);",
      "        }",
      "      }",
      "      if (!isUrl(item.url)) fail(tag + \" url must be a public URL\");",
      "    });",
      "    if (news.items.length === 0) warn(\"[news] no updates yet (skeleton seed data)\");",
      "  }",
      "}",
      "",
      "// rankings.",
      "const rankings = data.rankings;",
      "if (rankings) {",
      "  if (!isList(rankings.boards)) fail(\"[rankings] boards must be an array\");",
      "  else {",
      "    const boardIds = new Set();",
      "    rankings.boards.forEach((board, index) => {",
      "      const tag = \"[rankings[\" + index + \"]]\";",
      "      for (const key of [\"id\", \"name\", \"sourceName\"]) {",
      "        if (!isText(board[key])) fail(tag + \" \" + key + \" is missing\");",
      "      }",
      "      if (boardIds.has(board.id)) fail(tag + \" duplicate id: \" + board.id);",
      "      else boardIds.add(board.id);",
      "      if (!isUrl(board.sourceUrl)) fail(tag + \" sourceUrl must be a public URL\");",
      "      if (!isIso(board.updatedAt)) fail(tag + \" updatedAt must be ISO 8601\");",
      "      if (!board.metric || !isText(board.metric.name) || !isText(board.metric.unit)) fail(tag + \" metric is invalid\");",
      "      if (!isList(board.entries) || board.entries.length === 0) fail(tag + \" entries must be a non-empty array\");",
      "      else {",
      "        board.entries.forEach((entry, entryIndex) => {",
      "          const entryTag = tag + \".entries[\" + entryIndex + \"]\";",
      "          if (entry.rank !== entryIndex + 1) fail(entryTag + \" rank must be contiguous from 1\");",
      "          if (!isText(entry.model) || !isText(entry.org)) fail(entryTag + \" model/org is missing\");",
      "          if (typeof entry.score !== \"number\" || !Number.isFinite(entry.score)) fail(entryTag + \" score must be a number\");",
      "        });",
      "      }",
      "    });",
      "    if (rankings.boards.length === 0) warn(\"[rankings] no boards yet (skeleton seed data)\");",
      "  }",
      "}",
      "",
      "// resources.",
      "const resourceTypes = [\"course\", \"tutorial\", \"paper\", \"tool\", \"awesome\", \"video\", \"book\"];",
      "const resources = data.resources;",
      "if (resources) {",
      "  if (!isList(resources.items)) fail(\"[resources] items must be an array\");",
      "  else {",
      "    const ids = new Set();",
      "    resources.items.forEach((item, index) => {",
      "      const tag = \"[resources[\" + index + \"]]\";",
      "      for (const key of [\"id\", \"title\", \"url\", \"author\", \"description\"]) {",
      "        if (!isText(item[key])) fail(tag + \" \" + key + \" is missing\");",
      "      }",
      "      if (ids.has(item.id)) fail(tag + \" duplicate id: \" + item.id);",
      "      else ids.add(item.id);",
      "      if (!oneOf(item.type, resourceTypes)) fail(tag + \" type is invalid: \" + item.type);",
      "      if (!oneOf(item.level, [\"beginner\", \"intermediate\", \"advanced\"])) fail(tag + \" level is invalid\");",
      "      if (typeof item.free !== \"boolean\") fail(tag + \" free must be a boolean\");",
      "      if (!isUrl(item.url)) fail(tag + \" url must be a public URL\");",
      "    });",
      "    if (resources.items.length === 0) warn(\"[resources] no curated resources yet (skeleton seed data)\");",
      "  }",
      "}",
      "",
      "// projects.",
      "const projects = data.projects;",
      "if (projects) {",
      "  if (!isList(projects.items)) fail(\"[projects] items must be an array\");",
      "  else {",
      "    const ids = new Set();",
      "    projects.items.forEach((item, index) => {",
      "      const tag = \"[projects[\" + index + \"]]\";",
      "      for (const key of [\"id\", \"name\", \"owner\", \"url\", \"summary\"]) {",
      "        if (!isText(item[key])) fail(tag + \" \" + key + \" is missing\");",
      "      }",
      "      if (ids.has(item.id)) fail(tag + \" duplicate id: \" + item.id);",
      "      else ids.add(item.id);",
      "      if (!oneOf(item.sourceType, [\"self\", \"community\"])) fail(tag + \" sourceType is invalid\");",
      "      if (!isUrl(item.url)) fail(tag + \" url must be a public URL\");",
      "      if (item.repo !== null && item.repo !== undefined && !isText(item.repo)) fail(tag + \" repo must be owner/name or null\");",
      "    });",
      "    if (projects.items.length === 0) warn(\"[projects] no projects yet (skeleton seed data)\");",
      "  }",
      "}",
      "",
      "// Cross-file statistics.",
      "if (meta && meta.stats) {",
      "  const expected = {",
      "    entities: entities && isList(entities.entities) ? entities.entities.length : null,",
      "    news: news && isList(news.items) ? news.items.length : null,",
      "    boards: rankings && isList(rankings.boards) ? rankings.boards.length : null,",
      "    resources: resources && isList(resources.items) ? resources.items.length : null,",
      "    projects: projects && isList(projects.items) ? projects.items.length : null,",
      "  };",
      "  for (const key of Object.keys(expected)) {",
      "    if (expected[key] !== null && meta.stats[key] !== expected[key]) {",
      "      fail(\"[meta.stats.\" + key + \"] expected \" + expected[key] + \", got \" + meta.stats[key]);",
      "    }",
      "  }",
      "}",
      "",
      "// Report.",
      "const line = \"-\".repeat(64);",
      "console.log(\"\");",
      "console.log(line);",
      "console.log(\" {{PROJECT_NAME}} - data contract check (DATA-CONTRACT v1)\");",
      "console.log(line);",
      "if (warnings.length > 0) {",
      "  console.log(\"Warnings: \" + warnings.length);",
      "  for (const warning of warnings) console.log(\"  - \" + warning);",
      "}",
      "if (errors.length > 0) {",
      "  console.log(\"Errors: \" + errors.length);",
      "  for (const error of errors) console.log(\"  - \" + error);",
      "  console.log(\"Contract check failed.\");",
      "  process.exit(1);",
      "}",
      "if (STRICT && warnings.length > 0) {",
      "  console.log(\"Strict mode: warnings are release blockers.\");",
      "  process.exit(1);",
      "}",
      "console.log(\"OK: \" + FILES.length + \" data files checked, \" + warnings.length + \" warning(s).\");",
      "if (STRICT) console.log(\"Strict mode: no blockers.\");",
      "",
    ].join("\n"),
    "scripts/validate.mjs template",
    vars
  );
}

function buildFetchScript(vars) {
  return render(
    [
      "#!/usr/bin/env node",
      "/**",
      " * Source-probe stage of the data pipeline for {{PROJECT_NAME}}.",
      " *",
      " * This scaffold intentionally stops at reachability and raw snapshots. Mapping a",
      " * snapshot into the six contract files is normalizer work for the POC phase: add",
      " * one small normalize<Source>() function per source and write data/*.json.",
      " *",
      " * Usage:",
      " *   node scripts/fetch-data.mjs",
      " *   node scripts/fetch-data.mjs --timeout 10000",
      " *",
      " * Exit codes: 0 at least one source usable (or no sources registered),",
      " *             1 every registered source failed, 2 configuration error.",
      " */",
      "import { existsSync, mkdirSync, readFileSync, writeFileSync } from \"node:fs\";",
      "import { dirname, join, resolve } from \"node:path\";",
      "import { fileURLToPath } from \"node:url\";",
      "",
      "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), \"..\");",
      "const CONFIG = join(ROOT, \"config\", \"sources.json\");",
      "const DATA = join(ROOT, \"data\");",
      "const SNAPSHOT = join(DATA, \"snapshot\");",
      "",
      "const argv = process.argv.slice(2);",
      "const timeoutIndex = argv.indexOf(\"--timeout\");",
      "const TIMEOUT_MS = timeoutIndex >= 0 && argv[timeoutIndex + 1] ? Number(argv[timeoutIndex + 1]) : 15000;",
      "const USER_AGENT = \"{{PROJECT_SLUG}}-data-pipeline/0.1 (+{{BASE_URL}})\";",
      "",
      "async function fetchSource(source) {",
      "  const result = { source, status: \"blocked\", note: \"not fetched\", bytes: 0 };",
      "  if (!source.enabled) {",
      "    result.note = \"disabled in config/sources.json\";",
      "    return result;",
      "  }",
      "  const controller = new AbortController();",
      "  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);",
      "  try {",
      "    const response = await fetch(source.url, {",
      "      headers: { \"user-agent\": USER_AGENT },",
      "      signal: controller.signal,",
      "    });",
      "    if (!response.ok) {",
      "      result.note = \"HTTP \" + response.status;",
      "      return result;",
      "    }",
      "    const body = await response.text();",
      "    mkdirSync(SNAPSHOT, { recursive: true });",
      "    const extension = source.file || \"raw.txt\";",
      "    writeFileSync(join(SNAPSHOT, source.id + \".\" + extension), body, \"utf8\");",
      "    result.status = \"ok\";",
      "    result.bytes = body.length;",
      "    result.note = \"saved data/snapshot/\" + source.id + \".\" + extension;",
      "  } catch (error) {",
      "    result.note =",
      "      error && error.name === \"AbortError\"",
      "        ? \"timeout after \" + TIMEOUT_MS + \"ms\"",
      "        : String(error && error.message ? error.message : error);",
      "  } finally {",
      "    clearTimeout(timer);",
      "  }",
      "  return result;",
      "}",
      "",
      "function writeMeta(results) {",
      "  const metaPath = join(DATA, \"meta.json\");",
      "  const meta = JSON.parse(readFileSync(metaPath, \"utf8\"));",
      "  const now = new Date().toISOString();",
      "  meta.generatedAt = now;",
      "  meta.mode = \"local\";",
      "  meta.sources = results.map((result) => ({",
      "    id: result.source.id,",
      "    name: result.source.name,",
      "    url: result.source.url,",
      "    type: result.source.type,",
      "    status: result.status,",
      "    lastFetchedAt: now,",
      "    items: null,",
      "    note: result.note,",
      "  }));",
      "  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + \"\\n\", \"utf8\");",
      "}",
      "",
      "async function main() {",
      "  if (!existsSync(CONFIG)) {",
      "    console.error(\"[fetch-data] missing config/sources.json\");",
      "    process.exit(2);",
      "  }",
      "  const config = JSON.parse(readFileSync(CONFIG, \"utf8\"));",
      "  const sources = Array.isArray(config.sources) ? config.sources : [];",
      "  if (sources.length === 0) {",
      "    console.log(\"[fetch-data] no sources registered yet.\");",
      "    console.log(\"[fetch-data] next: add public sources to config/sources.json, then implement normalizers that write data/*.json.\");",
      "    process.exit(0);",
      "  }",
      "  const results = [];",
      "  for (const source of sources) {",
      "    const result = await fetchSource(source);",
      "    results.push(result);",
      "    console.log(\"  \" + result.status + \"  \" + source.id + \"  \" + result.note);",
      "  }",
      "  writeMeta(results);",
      "  const usable = results.filter((result) => result.status === \"ok\").length;",
      "  console.log(\"[fetch-data] \" + usable + \"/\" + results.length + \" source(s) reachable; meta.sources updated.\");",
      "  console.log(\"[fetch-data] next: normalize the snapshots into data/{entities,news,rankings,resources,projects}.json.\");",
      "  process.exit(usable === 0 ? 1 : 0);",
      "}",
      "",
      "main().catch((error) => {",
      "  console.error(\"[fetch-data] fatal: \" + (error && error.message ? error.message : String(error)));",
      "  process.exit(2);",
      "});",
      "",
    ].join("\n"),
    "scripts/fetch-data.mjs template",
    vars
  );
}

function buildStageScript(vars) {
  return render(
    [
      "#!/usr/bin/env node",
      "/**",
      " * Build the static release artifact for {{PROJECT_NAME}}.",
      " *",
      " * Copies site/ to the artifact root and data/ to /data/, producing the same",
      " * layout that GitHub Pages serves and scripts/serve.mjs emulates locally.",
      " *",
      " * Usage: node scripts/stage-site.mjs",
      " */",
      "import { cpSync, existsSync, mkdirSync, rmSync } from \"node:fs\";",
      "import { basename, dirname, join, resolve, sep } from \"node:path\";",
      "import { fileURLToPath } from \"node:url\";",
      "",
      "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), \"..\");",
      "const SITE = join(ROOT, \"site\");",
      "const DATA = join(ROOT, \"data\");",
      "const ARTIFACT = join(ROOT, \"_artifact\");",
      "",
      "if (!existsSync(SITE)) {",
      "  console.error(\"[stage] site/ is missing\");",
      "  process.exit(1);",
      "}",
      "if (!existsSync(DATA)) {",
      "  console.error(\"[stage] data/ is missing\");",
      "  process.exit(1);",
      "}",
      "",
      "const resolved = resolve(ARTIFACT);",
      "if (basename(resolved) !== \"_artifact\" || resolved.indexOf(ROOT + sep) !== 0) {",
      "  console.error(\"[stage] refusing to clean unexpected artifact path: \" + resolved);",
      "  process.exit(1);",
      "}",
      "",
      "rmSync(ARTIFACT, { recursive: true, force: true });",
      "mkdirSync(ARTIFACT, { recursive: true });",
      "cpSync(SITE, ARTIFACT, { recursive: true });",
      "cpSync(DATA, join(ARTIFACT, \"data\"), { recursive: true });",
      "rmSync(join(ARTIFACT, \"data\", \"snapshot\"), { recursive: true, force: true });",
      "console.log(\"[stage] artifact ready: \" + ARTIFACT);",
      "console.log(\"[stage] deploy this folder to any static host (GitHub Pages uses it as the artifact).\");",
      "",
    ].join("\n"),
    "scripts/stage-site.mjs template",
    vars
  );
}

function buildTestFile(vars) {
  return render(
    [
      "/**",
      " * Contract smoke tests for {{PROJECT_NAME}}.",
      " *",
      " * Run: node --test (auto-discovery)",
      " */",
      "import { test } from \"node:test\";",
      "import assert from \"node:assert/strict\";",
      "import { readFileSync } from \"node:fs\";",
      "import { dirname, join, resolve } from \"node:path\";",
      "import { fileURLToPath } from \"node:url\";",
      "",
      "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), \"..\");",
      "const DATA = join(ROOT, \"data\");",
      "const FILES = [\"meta\", \"entities\", \"news\", \"rankings\", \"resources\", \"projects\"];",
      "",
      "function load(name) {",
      "  return JSON.parse(readFileSync(join(DATA, name + \".json\"), \"utf8\"));",
      "}",
      "",
      "for (const name of FILES) {",
      "  test(name + \".json has a schema v1 envelope\", () => {",
      "    const doc = load(name);",
      "    assert.equal(doc.schemaVersion, 1);",
      "    assert.ok(Number.isFinite(Date.parse(doc.generatedAt)));",
      "    assert.ok(typeof doc.source === \"string\" && doc.source.length > 0);",
      "  });",
      "}",
      "",
      "test(\"meta stats match the data arrays\", () => {",
      "  const meta = load(\"meta\");",
      "  assert.equal(meta.stats.entities, load(\"entities\").entities.length);",
      "  assert.equal(meta.stats.news, load(\"news\").items.length);",
      "  assert.equal(meta.stats.boards, load(\"rankings\").boards.length);",
      "  assert.equal(meta.stats.resources, load(\"resources\").items.length);",
      "  assert.equal(meta.stats.projects, load(\"projects\").items.length);",
      "});",
      "",
      "test(\"every registered source has a status and a public URL\", () => {",
      "  const meta = load(\"meta\");",
      "  for (const source of meta.sources) {",
      "    assert.ok([\"ok\", \"degraded\", \"blocked\"].includes(source.status));",
      "    assert.match(source.url, /^https?:\\/\\//);",
      "  }",
      "});",
      "",
    ].join("\n"),
    "tests/data-contract.test.mjs template",
    vars
  );
}

function buildCiWorkflow(vars) {
  return render(
    [
      "name: CI",
      "",
      "on:",
      "  push:",
      "    branches: [main]",
      "  pull_request:",
      "  workflow_dispatch:",
      "",
      "permissions:",
      "  contents: read",
      "",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Checkout",
      "        uses: actions/checkout@v4",
      "",
      "      - name: Setup Node",
      "        uses: actions/setup-node@v4",
      "        with:",
      "          node-version: \"20\"",
      "",
      "      - name: Validate data contract",
      "        run: node scripts/validate.mjs",
      "",
      "      - name: Run unit tests",
      "        run: node --test",
      "",
    ].join("\n"),
    ".github/workflows/ci.yml template",
    vars
  );
}

function buildDeployWorkflow(vars) {
  return render(
    [
      "name: Deploy to GitHub Pages",
      "",
      "on:",
      "  push:",
      "    branches: [main]",
      "  schedule:",
      "    # Daily data refresh (UTC). Adjust to the timezone that matters to you.",
      "    - cron: \"17 1 * * *\"",
      "  workflow_dispatch:",
      "",
      "permissions:",
      "  contents: read",
      "  pages: write",
      "  id-token: write",
      "",
      "concurrency:",
      "  group: pages",
      "  cancel-in-progress: false",
      "",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Checkout",
      "        uses: actions/checkout@v4",
      "",
      "      - name: Setup Node",
      "        uses: actions/setup-node@v4",
      "        with:",
      "          node-version: \"20\"",
      "",
      "      - name: Refresh data (tolerant; a failed source must not block deploy)",
      "        continue-on-error: true",
      "        run: node scripts/fetch-data.mjs",
      "",
      "      - name: Validate data contract",
      "        run: node scripts/validate.mjs",
      "",
      "      - name: Stage Pages artifact",
      "        run: node scripts/stage-site.mjs",
      "",
      "      - name: Configure Pages",
      "        uses: actions/configure-pages@v5",
      "",
      "      - name: Upload Pages artifact",
      "        uses: actions/upload-pages-artifact@v3",
      "        with:",
      "          path: _artifact",
      "",
      "  deploy:",
      "    needs: build",
      "    runs-on: ubuntu-latest",
      "    environment:",
      "      name: github-pages",
      "      url: ${{ steps.deployment.outputs.page_url }}",
      "    steps:",
      "      - name: Deploy to GitHub Pages",
      "        id: deployment",
      "        uses: actions/deploy-pages@v4",
      "",
    ].join("\n"),
    ".github/workflows/deploy.yml template",
    vars
  );
}

/* ------------------------------------------------------------------------- */
/* File assembly and writing                                                 */
/* ------------------------------------------------------------------------- */

function buildFiles(vars) {
  const files = [];
  const add = (path, content) => files.push({ path, content });

  add("README.md", buildReadme(vars));
  add("AGENTS.md", buildAgents(vars));
  add("package.json", buildPackageJson(vars));
  add(".gitignore", buildGitignore());

  add("docs/SPEC.md", renderReferenceDoc("requirements-template.md", vars));
  add("docs/DATA-CONTRACT.md", renderReferenceDoc("data-contract-template.md", vars));
  add("docs/DATA-SOURCES.md", renderReferenceDoc("data-source-strategy.md", vars));
  add("docs/DESIGN-TOKENS.md", renderReferenceDoc("design-tokens.md", vars));
  add("docs/ACCEPTANCE.md", renderReferenceDoc("acceptance-checklist.md", vars));
  add("docs/POC-REPORT.md", buildPocReport(vars));

  const dataFiles = buildDataFiles(vars);
  for (const path of Object.keys(dataFiles)) add(path, dataFiles[path]);
  add("config/sources.json", buildConfigSources(vars));

  add("site/index.html", buildSiteIndex(vars));
  const renderedDesign = render(readReference("design-tokens.md"), "references/design-tokens.md", vars);
  add("site/assets/css/theme.css", extractCssBlock(renderedDesign, "references/design-tokens.md"));

  add("scripts/serve.mjs", buildServeScript(vars));
  add("scripts/validate.mjs", buildValidateScript(vars));
  add("scripts/fetch-data.mjs", buildFetchScript(vars));
  add("scripts/stage-site.mjs", buildStageScript(vars));

  add("tests/data-contract.test.mjs", buildTestFile(vars));

  add(".github/workflows/ci.yml", buildCiWorkflow(vars));
  add(".github/workflows/deploy.yml", buildDeployWorkflow(vars));

  return files;
}

function writeFiles(target, files, force) {
  const written = [];
  const overwritten = [];
  try {
    for (const file of files) {
      const absolute = join(target, file.path);
      const existed = existsSync(absolute);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, file.content, "utf8");
      written.push(file.path);
      if (existed) overwritten.push(file.path);
    }
    for (const dir of ["data/snapshot", "docs/screenshots"]) {
      mkdirSync(join(target, dir), { recursive: true });
    }
  } catch (error) {
    fail("failed while writing the skeleton: " + (error && error.message ? error.message : error), 1);
  }
  return { written, overwritten };
}

function printSummary(target, result, vars, force) {
  console.log("[" + SKILL_NAME + "] skeleton generated");
  console.log("  target : " + target);
  console.log("  name   : " + vars.PROJECT_SLUG + " (" + vars.PROJECT_NAME + ")");
  console.log("  domain : " + vars.DOMAIN);
  console.log("  files  : " + result.written.length + " written, " + result.overwritten.length + " overwritten" + (force ? " (--force)" : ""));
  console.log("");
  console.log("  next:");
  console.log("    cd " + target);
  console.log("    node scripts/validate.mjs");
  console.log("    node --test");
  console.log("    node scripts/serve.mjs");
  console.log("");
  console.log("  then follow the gates in docs/ACCEPTANCE.md (POC -> MVP -> Release).");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  validateArgs(args);
  const vars = buildVars(args);
  const target = resolveTarget(args.targetDir);
  prepareTarget(target, args.force);
  const files = buildFiles(vars);
  const result = writeFiles(target, files, args.force);
  printSummary(target, result, vars, args.force);
  process.exit(0);
}

main();
