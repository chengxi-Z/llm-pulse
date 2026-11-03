#!/usr/bin/env node
/**
 * fetch-data.mjs — AI Pulse data pipeline entry point: fetch -> normalize -> data/*.json (+ raw snapshots in data/snapshot/).
 *
 * Usage:
 *   node scripts/fetch-data.mjs --mode=local          # locally reachable sources (POC/development)
 *   node scripts/fetch-data.mjs --mode=ci             # full source set on GitHub Actions (incl. official HF/LMArena)
 *   node scripts/fetch-data.mjs --mode=local --from-snapshot   # offline replay (no network, deterministic, for tests)
 *   node scripts/fetch-data.mjs --mode=local --now=2026-11-03T12:00:00.000Z   # fixed clock (reproducibility)
 *   node scripts/fetch-data.mjs --mode=local --only=openrouter,livebench
 *   node scripts/fetch-data.mjs --mode=local --skip=github     # skip specific sources (e.g. save GitHub quota locally)
 *   node scripts/fetch-data.mjs --mode=local --check-links     # extra spot checks of resource/project links (slow)
 *
 * Degradation: a single source failure never aborts the run; when a historical
 * snapshot exists it is used (status=degraded), otherwise status=blocked. The
 * process exits with code 1 only when the core OpenRouter source is unavailable
 * and no snapshot exists.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, CURATED } from './fetch/sources.mjs';
import { createFetchContext } from './fetch/http.mjs';
import { assembleData, buildHighlights, normalizeGithubProjects } from './normalize.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const SNAPSHOT_DIR = join(DATA_DIR, 'snapshot');

// ---------------- CLI ----------------
const rawArgs = process.argv.slice(2);
const args = {};
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) continue;
  args[m[1]] = m[2] === undefined ? true : m[2];
}
const mode = args.mode === 'ci' ? 'ci' : args.mode === 'seed' ? 'seed' : 'local';
const fromSnapshot = Boolean(args['from-snapshot']);
const nowArg = args.now ? new Date(String(args.now)) : new Date();
if (!Number.isFinite(nowArg.getTime())) {
  console.error(`✗ 非法 --now 时间: ${args.now}`);
  process.exit(2);
}
const now = nowArg.toISOString();
const only = args.only ? new Set(String(args.only).split(',').filter(Boolean)) : null;
const skip = args.skip ? new Set(String(args.skip).split(',').filter(Boolean)) : null;
const concurrency = Math.max(1, Math.min(8, Number(args.concurrency) || 4));
const quiet = Boolean(args.quiet);

const log = (msg) => { if (!quiet) console.log(msg); };
const err = (msg) => console.error(msg);

// ---------------- Collection ----------------
const snapshotDir = SNAPSHOT_DIR;
await mkdir(snapshotDir, { recursive: true });
const ctx = createFetchContext({ mode, now, fromSnapshot, snapshotDir, log: (m) => log(`  ${m}`) });

const sourceMeta = new Map();
const contributions = { models: null, news: [], boards: [], projects: null, topics: [] };
const results = [];

async function runSource(source) {
  const enabled = mode === 'ci' ? source.enabledCi : source.enabledLocal;
  if (only && !only.has(source.id)) {
    sourceMeta.set(source.id, { status: 'blocked', items: null, lastFetchedAt: null, note: '本次 --only 未选中，跳过', source });
    return;
  }
  if (skip && skip.has(source.id)) {
    sourceMeta.set(source.id, { status: 'blocked', items: null, lastFetchedAt: null, note: '本次 --skip 跳过（如 GitHub 限流时避免浪费配额）', source });
    return;
  }
  if (!enabled) {
    sourceMeta.set(source.id, { status: 'blocked', items: null, lastFetchedAt: null, note: source.modeNoteLocal || `该源在 ${mode} 模式未启用`, source });
    return;
  }
  const started = Date.now();
  try {
    const out = await source.collect(ctx);
    const record = { ...out, status: 'ok', elapsedMs: Date.now() - started };
    results.push(record);
    sourceMeta.set(source.id, {
      status: 'ok',
      items: out.items ?? null,
      lastFetchedAt: now,
      note: fromSnapshot ? `[快照重放] ${out.note || ''}`.trim() : (out.note || null),
      source,
    });
    return;
  } catch (primaryErr) {
    // Degradation 1: fall back to the last successful snapshot (network mode only)
    if (!fromSnapshot) {
      try {
        const offlineCtx = createFetchContext({ mode, now, fromSnapshot: true, snapshotDir, log: () => {} });
        const out = await source.collect(offlineCtx);
        const record = { ...out, status: 'degraded', elapsedMs: Date.now() - started };
        results.push(record);
        sourceMeta.set(source.id, {
          status: 'degraded',
          items: out.items ?? null,
          lastFetchedAt: now,
          note: `实时抓取失败（${primaryErr.message}）；已回退上次快照`,
          source,
        });
        log(`  ⚠ ${source.id} 实时失败，回退快照：${primaryErr.message}`);
        return;
      } catch { /* fallthrough */ }
    }
    results.push({ status: 'blocked', items: 0, elapsedMs: Date.now() - started });
    sourceMeta.set(source.id, { status: 'blocked', items: null, lastFetchedAt: null, note: primaryErr.message, source });
    log(`  ✗ ${source.id} 不可用：${primaryErr.message}`);
  }
}

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

log(`\nAI Pulse 数据管道  mode=${mode}${fromSnapshot ? '（离线快照重放）' : ''}  now=${now}`);
log(`  ${SOURCES.length} 个注册源，启用 ${SOURCES.filter((s) => (mode === 'ci' ? s.enabledCi : s.enabledLocal)).length} 个\n`);
await pool(SOURCES, concurrency, runSource);

// ---------------- Merge contributions ----------------
for (const r of results) {
  if (!r.contributions) continue;
  if (r.contributions.models) contributions.models = r.contributions.models;
  if (Array.isArray(r.contributions.news)) contributions.news.push(...r.contributions.news);
  if (Array.isArray(r.contributions.boards)) contributions.boards.push(...r.contributions.boards);
  if (Array.isArray(r.contributions.projects)) contributions.projects = r.contributions.projects;
  if (Array.isArray(r.contributions.topics)) contributions.topics.push(...r.contributions.topics);
}
// Hot topics: keep the last known good topics.json when the HN source is unavailable.
// Reusing previous real data is an explicit fallback; nothing is synthesized.
if (!contributions.topics.length) {
  try {
    const prev = JSON.parse(await readFile(join(DATA_DIR, 'topics.json'), 'utf8'));
    if (Array.isArray(prev.items) && prev.items.length) {
      contributions.topics = prev.items;
      log(`  ⚠ hn-ai 无新数据，沿用上次 data/topics.json（${prev.items.length} 条真实话题）`);
    }
  } catch { /* first run without topics.json: emit an empty list (front-end shows empty state) */ }
}
if (!contributions.models || contributions.models.length === 0) {
  err('\n✗ 核心源 OpenRouter 无模型数据且无快照可回退，管道中止（不写空数据）。');
  err('  排查：node scripts/fetch/probe-sources.mjs --only=openrouter-models，或先在有网环境跑一次 --mode=local。');
  process.exit(1);
}
if (!contributions.projects) {
  // GitHub unavailable: keep the curated list plus the last real star counts as fallback (meta.sources will mark blocked/degraded)
  contributions.projects = normalizeGithubProjects(CURATED.projects, {}, { now });
}
contributions.resources = CURATED.resources;

const highlights = buildHighlights({
  models: contributions.models,
  boards: contributions.boards,
  news: contributions.news,
  resources: contributions.resources,
  projects: contributions.projects,
  now,
});

// ---------------- Assemble + write ----------------
const sources = SOURCES.map((s) => {
  const m = sourceMeta.get(s.id) || { status: 'blocked', items: null, lastFetchedAt: null, note: '未执行' };
  return { id: s.id, name: s.name, url: s.url, type: s.type, status: m.status, lastFetchedAt: m.lastFetchedAt, items: m.items, note: m.note };
});
const { files, stats, linkWarnings } = assembleData({ mode, now, sources, collections: contributions, highlights });

await mkdir(DATA_DIR, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  await writeFile(join(DATA_DIR, `${name}.json`), JSON.stringify(content, null, 2) + '\n');
}
log(`\n✓ 已写出 data/{${Object.keys(files).join(',')}}.json`);
log(`  stats: models=${stats.models} news=${stats.news} boards=${stats.boards} resources=${stats.resources} projects=${stats.projects} topics=${stats.topics} orgs=${stats.orgs} sourcesOk=${stats.sourcesOk}/${sources.length}`);
if (linkWarnings?.length) {
  log(`  ⚠ ${linkWarnings.length} 个 http:// 外链无法确认目标支持 https，已保留并记录到 meta.linkWarnings`);
  for (const w of linkWarnings.slice(0, 5)) log(`    - ${w}`);
}

// ---------------- Source status table ----------------
if (!quiet) {
  const line = '─'.repeat(96);
  console.log(`\n${line}`);
  console.log(` ${'source'.padEnd(19)} ${'status'.padEnd(9)} ${'items'.padStart(6)}  note`);
  console.log(line);
  for (const s of sources) {
    const note = String(s.note || '').replace(/\s+/g, ' ').slice(0, 78);
    console.log(` ${s.id.padEnd(19)} ${s.status.padEnd(9)} ${String(s.items ?? '-').padStart(6)}  ${note}`);
  }
  console.log(line);
  const ok = sources.filter((s) => s.status === 'ok').length;
  const degraded = sources.filter((s) => s.status === 'degraded').length;
  const blocked = sources.filter((s) => s.status === 'blocked').length;
  console.log(` 状态：ok=${ok} degraded=${degraded} blocked=${blocked}  mode=${mode}`);
}

// ---------------- Optional: link spot checks ----------------
if (args['check-links']) {
  const { checkLinks } = await import('./fetch/check-links.mjs');
  log('\n链接抽检（资源/项目外链，含 GitHub API / hf-mirror 替代验证）：');
  await checkLinks({ log });
}
