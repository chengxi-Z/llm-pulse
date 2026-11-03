#!/usr/bin/env node
/**
 * Code-comment language checker for AI Pulse.
 *
 * Phase 2 engineering requirement (docs/V1.1-CONTRACT.md §4): all code comments
 * and docstrings must be written in English. This script scans comment tokens
 * only: strings, template literals, user-visible copy, JSON data and generated
 * artifacts are ignored on purpose, so translating comments never changes
 * behaviour or content.
 *
 * What is scanned by default:
 *   - scripts/**        .mjs / .js
 *   - tests/**          .mjs / .js
 *   - site/assets/js/** .js            (browser modules, comments only)
 *   - site/assets/css/** .css          (slash-star comments only)
 *   - .github/workflows/** .yml/.yaml  (full-line `#` comments only)
 *   - skills/**         .mjs / .js / .md comments are handled by skill-author;
 *                       JS/CSS files are scanned here as well.
 *
 * What is intentionally ignored:
 *   - string literals, template literal text and regular expressions: they may
 *     legitimately contain Chinese data (titles, board names, test fixtures);
 *   - CSS declarations and every non-comment byte;
 *   - data files (data/**), generated media and third-party fixtures under
 *     scripts/fixtures (HTML/CSV/XML are source samples, not code);
 *   - Chinese locators used inside comments are translated, not allowlisted.
 *
 * Usage:
 *   node scripts/check-comments.mjs              # report (advisory)
 *   node scripts/check-comments.mjs --strict     # exit 1 when any hit (CI)
 *   node scripts/check-comments.mjs --json       # machine-readable report
 *   node scripts/check-comments.mjs --root <dir> # check another checkout
 *   node scripts/check-comments.mjs --self-test  # verify the checker itself
 *
 * Exit codes: 0 = pass/advisory, 1 = hits in strict mode or fatal error,
 *             2 = invalid usage.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAN_RE, buildLineIndex, lexJs, lineOf } from './check-i18n.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_TARGETS = [
  'scripts',
  'tests',
  'site/assets/js',
  'site/assets/css',
  '.github/workflows',
  'skills',
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '_artifact',
  '_tmp',
  'data',
  'fixtures',
  'docs/screenshots',
]);

const JS_EXTENSIONS = new Set(['.mjs', '.js', '.cjs']);
const CSS_EXTENSIONS = new Set(['.css']);
const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extract code comments from a JavaScript module.
 * @param {string} source
 * @returns {Array<{start:number,end:number,text:string}>}
 */
export function extractJsComments(source) {
  return lexJs(source)
    .filter((token) => token.kind === 'comment')
    .map((token) => ({
      start: token.start,
      end: token.end,
      text: source.slice(token.start, token.end),
    }));
}

/**
 * Extract slash-star comments from a stylesheet.
 * @param {string} source
 */
export function extractCssComments(source) {
  const comments = [];
  const re = /\/\*[\s\S]*?\*\//g;
  let match;
  while ((match = re.exec(source))) {
    comments.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return comments;
}

/**
 * Extract full-line `#` comments from a YAML file (inline comments are left
 * alone to avoid touching strings such as URLs or cron expressions).
 * @param {string} source
 * @param {number[]} lineStarts
 */
export function extractYamlComments(source, lineStarts) {
  const lines = source.split('\n');
  const comments = [];
  let offset = 0;
  lines.forEach((line, index) => {
    const start = offset;
    offset += line.length + 1;
    if (/^\s*#/.test(line)) {
      comments.push({ start, end: start + line.length, text: line, line: index + 1 });
    }
  });
  return comments;
}

function collectFiles(root, targets) {
  const files = [];
  for (const target of targets) {
    const base = path.isAbsolute(target) ? target : path.join(root, target);
    for (const file of walk(base)) files.push(file);
  }
  return files.sort();
}

/**
 * Scan one file and return hits (comments containing Han characters).
 * @returns {Array<{file:string,line:number,preview:string,comment:string}>}
 */
export function scanFile(file) {
  const relative = path.relative(DEFAULT_ROOT, file).split(path.sep).join('/');
  const extension = path.extname(file).toLowerCase();
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const lineStarts = buildLineIndex(source);
  let comments = [];
  if (JS_EXTENSIONS.has(extension)) {
    comments = extractJsComments(source);
  } else if (CSS_EXTENSIONS.has(extension)) {
    comments = extractCssComments(source);
  } else if (YAML_EXTENSIONS.has(extension)) {
    comments = extractYamlComments(source, lineStarts);
  } else {
    return [];
  }
  const hits = [];
  for (const comment of comments) {
    if (!HAN_RE.test(comment.text)) continue;
    const line = comment.line ?? lineOf(lineStarts, comment.start);
    const preview = comment.text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    hits.push({ file: relative, line, preview, comment: comment.text });
  }
  return hits;
}

function runCheck(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const targets = options.targets && options.targets.length ? options.targets : DEFAULT_TARGETS;
  const files = collectFiles(root, targets);
  const hits = [];
  const byFile = {};
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const fileHits = scanFile(file).map((hit) => ({ ...hit, file: relative }));
    if (!fileHits.length) continue;
    byFile[relative] = fileHits.length;
    hits.push(...fileHits);
  }
  return {
    ok: hits.length === 0,
    root,
    stats: {
      files: files.length,
      filesWithChineseComments: Object.keys(byFile).length,
      hits: hits.length,
    },
    byFile,
    hits,
  };
}

function formatReport(report, { strict = false } = {}) {
  const lines = [];
  lines.push('AI Pulse · comment language check');
  lines.push(`Root   : ${report.root}`);
  lines.push(`Files  : ${report.stats.files}`);
  if (report.hits.length === 0) {
    lines.push('');
    lines.push('Result: PASS — 0 comments containing Chinese characters');
    return lines.join('\n');
  }
  lines.push('');
  lines.push(`Comments containing Chinese (${report.hits.length} in ${report.stats.filesWithChineseComments} files):`);
  for (const hit of report.hits) {
    lines.push(`  ${hit.file}:${hit.line}  ${hit.preview}`);
  }
  lines.push('');
  lines.push('Rule: comments and docstrings are English only (V1.1-CONTRACT.md §4).');
  lines.push(
    strict
      ? `Result: FAIL — ${report.hits.length} comment(s) still contain Chinese (strict mode)`
      : `Result: ${report.hits.length} comment(s) contain Chinese (advisory run; use --strict in CI)`,
  );
  return lines.join('\n');
}

function writeFixture(base) {
  fs.rmSync(base, { recursive: true, force: true });
  fs.mkdirSync(path.join(base, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(base, 'site', 'assets', 'css'), { recursive: true });
  fs.mkdirSync(path.join(base, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(
    path.join(base, 'scripts', 'demo.mjs'),
    [
      '/** Demo module — 中文注释会被发现。 */',
      'const STRING = "字符串里的中文不算注释";',
      "const TEMPLATE = `模板里的中文 ${STRING} 也不算注释`;",
      '// English-only comment is fine.',
      'export const value = STRING + TEMPLATE;',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(base, 'site', 'assets', 'css', 'demo.css'),
    ['/* 中文样式注释 */', '.a { color: red; }', '/* English comment. */', ''].join('\n'),
  );
  fs.writeFileSync(
    path.join(base, '.github', 'workflows', 'ci.yml'),
    ['name: CI', '# 中文工作流注释', 'on: push', ''].join('\n'),
  );
}

function runSelfTest() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'aipulse-comments-'));
  const results = [];
  const expect = (condition, label) => {
    results.push({ ok: Boolean(condition), label });
    if (!condition) console.error(`  FAIL: ${label}`);
  };
  try {
    writeFixture(base);
    const report = runCheck({ root: base, targets: ['scripts', 'site/assets/css', '.github/workflows'] });
    expect(report.stats.files === 3, 'finds the fixture files');
    expect(report.stats.hits === 3, `detects 3 Chinese comments (got ${report.stats.hits})`);
    expect(
      report.hits.some((hit) => hit.file === 'scripts/demo.mjs'),
      'detects Chinese in JS doc comments',
    );
    expect(
      !report.hits.some((hit) => hit.preview.includes('字符串里的中文')),
      'ignores Chinese inside string literals',
    );
    expect(
      !report.hits.some((hit) => hit.preview.includes('模板里的中文')),
      'ignores Chinese inside template literals',
    );
    expect(
      report.hits.some((hit) => hit.file === 'site/assets/css/demo.css'),
      'detects Chinese in CSS comments',
    );
    expect(
      report.hits.some((hit) => hit.file === '.github/workflows/ci.yml'),
      'detects Chinese in YAML comments',
    );

    // Fix everything and expect a clean run.
    fs.writeFileSync(
      path.join(base, 'scripts', 'demo.mjs'),
      ['/** Demo module — comments must be English. */', 'export const value = 1;', ''].join('\n'),
    );
    fs.writeFileSync(path.join(base, 'site', 'assets', 'css', 'demo.css'), '/* Styling comment. */\n');
    fs.writeFileSync(path.join(base, '.github', 'workflows', 'ci.yml'), 'name: CI\non: push\n');
    const clean = runCheck({ root: base, targets: ['scripts', 'site/assets/css', '.github/workflows'] });
    expect(clean.stats.hits === 0, 'clean fixture reports 0 hits');
  } catch (error) {
    results.push({ ok: false, label: `self-test crashed: ${error.message}` });
    console.error(error);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
  const failed = results.filter((item) => !item.ok);
  for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`);
  console.log('');
  console.log(
    failed.length === 0
      ? `Self-test: PASS (${results.length} assertions)`
      : `Self-test: FAIL (${failed.length}/${results.length} assertions failed)`,
  );
  return failed.length === 0 ? 0 : 1;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, strict: false, json: false, selfTest: false, help: false, targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--strict':
        options.strict = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--root': {
        i += 1;
        if (i >= argv.length) throw new Error('--root requires a directory argument');
        options.root = path.resolve(argv[i]);
        break;
      }
      case '--target': {
        i += 1;
        if (i >= argv.length) throw new Error('--target requires a path argument');
        options.targets.push(argv[i]);
        break;
      }
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/check-comments.mjs [options]',
      '',
      'Scans comment tokens only (.mjs/.js, .css block comments, YAML full-line #)',
      'for Chinese characters. Strings, templates and data are ignored by design.',
      '',
      'Options:',
      '  --strict        Exit with code 1 when any Chinese comment remains (CI).',
      '  --json          Print a machine-readable JSON report.',
      '  --root <dir>    Project root to check (default: repository root).',
      '  --target <dir>  Limit the scan to a directory (repeatable).',
      '  --self-test     Run built-in fixtures to verify the checker itself.',
      '  -h, --help      Show this help.',
      '',
      'Exit codes: 0 = pass/advisory, 1 = hits in strict mode or fatal error,',
      '            2 = invalid usage.',
    ].join('\n'),
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`check-comments: ${error.message}`);
    console.error('Run with --help for usage.');
    process.exit(2);
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }
  if (options.selfTest) {
    process.exit(runSelfTest());
    return;
  }
  const report = runCheck(options);
  if (options.json) {
    console.log(JSON.stringify({ ok: report.ok, strict: options.strict, stats: report.stats, byFile: report.byFile, hits: report.hits }, null, 2));
  } else {
    console.log(formatReport(report, { strict: options.strict }));
  }
  if (options.strict && !report.ok) process.exit(1);
}

const ENTRY = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (ENTRY === fileURLToPath(import.meta.url)) main();
