#!/usr/bin/env node
/**
 * Security guard for the AI Pulse public repository.
 *
 * Static checks against the working tree (no network, zero dependencies):
 *   - PII: local machine paths / usernames / personal emails
 *   - Secrets: common token/credential patterns + credential files
 *   - Dangerous APIs: eval/new Function/document.write; innerHTML interpolation heuristic
 *   - External links: target="_blank" without rel="noopener", plain http:// links
 *   - Security meta: CSP + referrer on every site/*.html
 *   - GitHub Actions: every `uses:` pinned to a 40-char commit SHA; no pull_request_target
 *   - Repo hygiene: data size limits, .gitignore coverage, stray node_modules / lockfiles
 *
 * Side-effect free on import (tests import the helper functions).
 *
 * Usage:
 *   node scripts/security-check.mjs              # report; exit 1 on errors
 *   node scripts/security-check.mjs --self-test  # detector assertions
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE = join(ROOT, "site");
const DATA = join(ROOT, "data");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const IS_MAIN = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

const SKIP_DIRS = new Set(["node_modules", ".git", "_artifact", "_tmp", "snapshot", "audit"]);
const TEXT_EXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".txt", ".xml", ".svg", ".cjs"]);
const SCAN_EXCLUDE = new Set(["scripts/security-check.mjs", "tests/security.test.mjs"]);
const SCAN_EXCLUDE_PREFIX = ["scripts/fixtures/"];

const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

/* ------------------------------- detectors ------------------------------- */
const PII_PATTERNS = [
  { id: "pii-windows-userpath", re: /[A-Za-z]:\\Users\\(?!Public\b|Default\b|Shared\b|<|\$|%|\.\.\.)[^\\\s"'`]+/g, level: "error" },
  { id: "pii-unix-userpath", re: /\/Users\/(?!<|\$|\.\.\.)[A-Za-z0-9._-]+/g, level: "error" },
  { id: "pii-local-workspace", re: /\bD:\\dsh\b|\bdsh-primary-runtime\b/g, level: "error" },
  { id: "pii-personal-email", re: /[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com|noreply\.github\.com|example\.com|example\.org|example\.net)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, level: "warn" },
];

const SECRET_PATTERNS = [
  ["github-pat", /ghp_[A-Za-z0-9]{20,}/],
  ["github-fine-pat", /github_pat_[A-Za-z0-9_]{20,}/],
  ["openai-style-key", /sk-[A-Za-z0-9]{20,}/],
  ["aws-key", /AKIA[0-9A-Z]{16}/],
  ["private-key", /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["generic-password", /(password|passwd|secret)\s*[:=]\s*["'][^"']{8,}["']/i],
];

const DANGEROUS = [
  ["eval", /\beval\s*\(/],
  ["new Function", /new\s+Function\s*\(/],
  ["document.write", /document\.write\s*\(/],
  ["innerHTML-heuristic", /innerHTML\s*=\s*[^;]*\$\{[^;]*/],
];
const SAFE_INTERP = /esc\(|escAttr\(|\bet\(|\bt\(|intlNumber\(|formatDate\(|localizedDate\(|safeMarkdown\(|innerHTML\s*=\s*""/;

export function detectPii(text) {
  return PII_PATTERNS.some((p) => {
    p.re.lastIndex = 0;
    const hit = p.re.test(text);
    p.re.lastIndex = 0;
    return hit;
  });
}

export function isPinnedUses(line) {
  const m = line.match(/uses:\s*([^\s#]+)/);
  if (!m) return true;
  if (/^\.\//.test(m[1]) || /^docker:/.test(m[1])) return true;
  const at = m[1].lastIndexOf("@");
  return at >= 0 && /^[0-9a-f]{40}$/.test(m[1].slice(at + 1));
}

export function hasCsp(html) {
  return /http-equiv=["']Content-Security-Policy["']/i.test(html);
}

/* ------------------------------- scanner -------------------------------- */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

export function runCheck() {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  const allFiles = walk(ROOT);
  const textFiles = allFiles.filter((f) => TEXT_EXT.has(extname(f).toLowerCase()));
  const scannable = textFiles.filter(
    (f) => !SCAN_EXCLUDE.has(rel(f)) && !SCAN_EXCLUDE_PREFIX.some((prefix) => rel(f).startsWith(prefix))
  );

  // 1) PII
  for (const file of scannable) {
    const text = readFileSync(file, "utf8");
    for (const p of PII_PATTERNS) {
      p.re.lastIndex = 0;
      const matches = text.match(p.re);
      p.re.lastIndex = 0;
      if (!matches) continue;
      const unique = [...new Set(matches)].slice(0, 5);
      (p.level === "error" ? err : warn)(`[${p.id}] ${rel(file)}: ${unique.join(" | ")}`);
    }
  }

  // 2) Secrets
  for (const file of scannable) {
    const text = readFileSync(file, "utf8");
    for (const [id, re] of SECRET_PATTERNS) if (re.test(text)) err(`[secret:${id}] ${rel(file)}`);
  }
  for (const name of [".credentials", ".env", ".env.local", "id_rsa", "id_ed25519"]) {
    if (existsSync(join(ROOT, name))) err(`[secret-file] ${name} exists in repo root`);
  }

  // 3) Dangerous APIs
  const codeFiles = scannable.filter((f) => [".js", ".mjs", ".html"].includes(extname(f)));
  for (const file of codeFiles) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [id, re] of DANGEROUS) {
        if (!re.test(line)) continue;
        if (id === "innerHTML-heuristic" && SAFE_INTERP.test(line)) continue;
        const where = `${rel(file)}:${i + 1}`;
        if (id === "innerHTML-heuristic") warn(`[warn:${id}] ${where}: ${line.trim().slice(0, 120)}`);
        else err(`[danger:${id}] ${where}: ${line.trim().slice(0, 120)}`);
      }
    });
  }

  // 4) HTML links + security meta
  const htmlFiles = existsSync(SITE) ? readdirSync(SITE).filter((f) => f.endsWith(".html")).map((f) => join(SITE, f)) : [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    const name = rel(file);
    for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
      if (!/target\s*=\s*["']_blank["']/i.test(tag)) continue;
      if (!/rel\s*=\s*["'][^"']*noopener/i.test(tag)) err(`[link:rel] ${name}: target=_blank without rel=noopener`);
    }
    const httpLinks = html.match(/href\s*=\s*["']http:\/\/(?!127\.0\.0\.1|localhost)[^"']+/gi) || [];
    if (httpLinks.length) warn(`[link:http] ${name}: ${httpLinks.length} insecure external http link(s)`);
    if (!hasCsp(html)) err(`[csp] ${name}: missing CSP meta`);
    if (!/name=["']referrer["']/i.test(html)) err(`[referrer] ${name}: missing referrer meta`);
  }

  // 5) GitHub Actions
  if (existsSync(WORKFLOWS)) {
    for (const file of readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))) {
      const p = join(WORKFLOWS, file);
      const text = readFileSync(p, "utf8");
      const name = rel(p);
      if (/pull_request_target\s*:/.test(text)) err(`[actions:unsafe-trigger] ${name}: pull_request_target is forbidden`);
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*uses:/.test(line) && !isPinnedUses(line)) err(`[actions:unpinned] ${name}: ${line.trim()}`);
      }
      if (!/permissions\s*:/.test(text)) warn(`[actions:permissions] ${name}: no explicit permissions block`);
    }
  }

  // 6) Repo hygiene / data size
  if (existsSync(join(ROOT, "node_modules"))) warn("[repo] node_modules present in repo root (should be temp/local only)");
  for (const lock of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    if (existsSync(join(ROOT, lock))) warn(`[repo] ${lock} present although the project has zero runtime deps`);
  }
  if (existsSync(DATA)) {
    let total = 0;
    for (const f of readdirSync(DATA).filter((x) => x.endsWith(".json"))) {
      const size = statSync(join(DATA, f)).size;
      total += size;
      if (size > 2 * 1024 * 1024) err(`[data:size] data/${f} exceeds 2MB`);
    }
    if (total > 5 * 1024 * 1024) err(`[data:size] data/*.json total exceeds 5MB`);
  }
  const gitignore = existsSync(join(ROOT, ".gitignore")) ? readFileSync(join(ROOT, ".gitignore"), "utf8") : "";
  for (const must of [".env", "node_modules", "_tmp", "_artifact"]) {
    if (!gitignore.includes(must)) warn(`[gitignore] missing entry: ${must}`);
  }

  return { errors, warnings, textFiles: textFiles.length, htmlFiles: htmlFiles.length };
}

/* -------------------------------- self-test ------------------------------ */
export function selfTest() {
  const cases = [
    ["pii-path", detectPii("C:\\Users\\alice\\secret"), true],
    ["pii-placeholder", detectPii("C:\\Users\\<name>\\project"), false],
    ["pinned", isPinnedUses("uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4"), true],
    ["unpinned", isPinnedUses("uses: actions/checkout@v4"), false],
    ["local-use", isPinnedUses("uses: ./.github/actions/foo"), true],
    ["csp", hasCsp('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">'), true],
    ["no-csp", hasCsp("<html><head></head></html>"), false],
    ["secret", SECRET_PATTERNS.some(([, re]) => re.test("token ghp_abcdefghijklmnopqrstuvwxyz0123456789")), true],
    ["danger", DANGEROUS.slice(0, 3).some(([, re]) => re.test("eval('x')")), true],
  ];
  const rows = cases.map(([name, actual, expected]) => ({ name, ok: actual === expected }));
  for (const row of rows) console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.name}`);
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\nSelf-test: ${failed === 0 ? "PASS" : "FAIL"} (${rows.length} assertions)`);
  return failed === 0;
}

/* ---------------------------------- main --------------------------------- */
if (IS_MAIN) {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
  }
  const { errors, warnings, textFiles, htmlFiles } = runCheck();
  console.log("\nAI Pulse security check");
  console.log("─".repeat(56));
  console.log(`Text files scanned : ${textFiles}`);
  console.log(`HTML pages         : ${htmlFiles}`);
  if (warnings.length) {
    console.log(`\nWARN ${warnings.length}`);
    warnings.slice(0, 40).forEach((w) => console.log("  - " + w));
    if (warnings.length > 40) console.log(`  ... and ${warnings.length - 40} more`);
  }
  if (errors.length) {
    console.log(`\nERROR ${errors.length}`);
    errors.slice(0, 60).forEach((e) => console.log("  - " + e));
    if (errors.length > 60) console.log(`  ... and ${errors.length - 60} more`);
    console.log(`\nResult: FAIL (${errors.length} errors, ${warnings.length} warnings)`);
    process.exit(1);
  }
  console.log(`\nResult: PASS (0 errors, ${warnings.length} warnings)`);
}
