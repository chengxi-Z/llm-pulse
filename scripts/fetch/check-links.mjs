#!/usr/bin/env node
/**
 * check-links.mjs — spot-check outbound resource/project links (POC evidence + an optional MVP CI step).
 *
 * Local network limits: github.com / huggingface.co / lmarena.ai cannot be reached
 * directly (blocked); only api.github.com and hf-mirror.com are reachable, so the
 * checker performs alternate verification and distinguishes the outcomes:
 *   ok               direct 2xx
 *   ok-alternate     original domain unreachable locally, but an alternate endpoint (GitHub API / hf-mirror) confirms it exists
 *   bot-protected    HTTP 403 from known bot protection (e.g. cookbook.openai.com); valid in a browser
 *   network-blocked  unreachable locally (blocked/timeout); needs CI or manual browser review
 *   http-error       HTTP 4xx/5xx, likely a dead link that needs maintenance
 *   unverified       could not verify (e.g. GitHub rate limit)
 *
 * Usage: node scripts/fetch/check-links.mjs [--out=data/snapshot/link-check.json]
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RESOURCES, PROJECTS } from './curated.mjs';
import { httpRequest } from './http.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-linkcheck/0.1';

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/.*)?$/i;
const HF_URL_RE = /^https?:\/\/huggingface\.co\/(.*)$/i;
const BOT_PROTECTED_HOSTS = new Set(['cookbook.openai.com']);
// Domains known to be blocked locally: direct requests always time out (10s each); skip them and use alternate verification
const KNOWN_LOCAL_BLOCKED = new Set(['github.com', 'www.github.com', 'huggingface.co', 'www.huggingface.co', 'lmarena.ai']);

async function probe(url, { timeoutMs = 12000 } = {}) {
  const started = Date.now();
  try {
    const res = await httpRequest(url, { timeoutMs, retries: 0, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' } });
    return { status: res.status, elapsedMs: Date.now() - started, note: null };
  } catch (e) {
    return { status: e.status ?? null, elapsedMs: Date.now() - started, note: e.message };
  }
}

async function checkOne(target) {
  const result = { ...target, status: null, elapsedMs: 0, verdict: 'network-blocked', note: null, via: null };
  const host = (() => { try { return new URL(target.url).host; } catch { return ''; } })();
  let direct;
  if (KNOWN_LOCAL_BLOCKED.has(host)) {
    direct = { status: null, elapsedMs: 0, note: '本机已知被墙（跳过直连，走替代验证）' };
  } else {
    direct = await probe(target.url);
  }
  result.status = direct.status;
  result.elapsedMs = direct.elapsedMs;
  if (direct.status !== null && direct.status >= 200 && direct.status < 400) {
    result.verdict = 'ok';
    return result;
  }

  // Alternate verification 1: github.com -> api.github.com/repos/{owner}/{repo} (only the API is reachable locally)
  const gh = target.url.match(GITHUB_REPO_RE);
  if (gh) {
    const api = `https://api.github.com/repos/${gh[1]}/${gh[2]}`;
    const alt = await probe(api);
    result.via = 'api.github.com';
    if (alt.status === 200) { result.verdict = 'ok-alternate'; result.status = 200; return result; }
    if (alt.status === 403 || alt.status === 429) { result.verdict = 'unverified'; result.note = `GitHub API 限流（${alt.status}），原始链接需 CI/浏览器复核`; result.status = alt.status; return result; }
    if (alt.status === 404) { result.verdict = 'http-error'; result.status = 404; result.note = 'GitHub API 返回 404：仓库不存在或已改名'; return result; }
  }

  // Alternate verification 2: huggingface.co -> hf-mirror.com with the same path
  const hf = target.url.match(HF_URL_RE);
  if (hf) {
    const alt = await probe(`https://hf-mirror.com/${hf[1]}`);
    result.via = 'hf-mirror.com';
    if (alt.status !== null && alt.status < 400) { result.verdict = 'ok-alternate'; result.status = alt.status; return result; }
    if (alt.status === 404) { result.verdict = 'http-error'; result.status = 404; result.note = 'hf-mirror 同路径 404'; return result; }
  }

  if (direct.status !== null) {
    if (direct.status === 403 && BOT_PROTECTED_HOSTS.has(host)) { result.verdict = 'bot-protected'; result.note = '403 bot 防护（浏览器侧应正常）'; return result; }
    if (direct.status === 404 || direct.status === 410) { result.verdict = 'http-error'; result.note = `HTTP ${direct.status}`; return result; }
    if (direct.status >= 400) { result.verdict = 'http-error'; result.note = `HTTP ${direct.status}`; return result; }
  }
  if (/CERT|SSL|TLS|LEAF|self.signed|UNABLE_TO_VERIFY/i.test(direct.note || '')) {
    result.verdict = 'network-blocked';
    result.note = `本机 TLS/CA 限制：${direct.note}`;
    return result;
  }
  result.note = direct.note || '本机网络不可达';
  return result;
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  }));
}

export async function checkLinks({ outFile = join(ROOT, 'data', 'snapshot', 'link-check.json'), log = console.log } = {}) {
  const targets = [
    ...RESOURCES.map((r) => ({ kind: 'resource', id: r.id, url: r.url })),
    ...PROJECTS.filter((p) => p.url).map((p) => ({ kind: 'project', id: p.id, url: p.url })),
  ];
  const results = [];
  await pool(targets, 4, async (t) => {
    const rec = await checkOne(t);
    results.push(rec);
    log(`  ${rec.verdict.padEnd(15)} ${String(rec.status ?? '-').padEnd(4)} ${String(rec.elapsedMs).padStart(6)}ms ${t.kind}/${t.id}`);
  });
  results.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : 1));
  const tally = results.reduce((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] || 0) + 1 }), {});
  const report = { generatedAt: new Date().toISOString(), total: results.length, tally, results };
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
  log(`\n链接抽检：${results.length} 条 → ${Object.entries(tally).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  log(`  结果写入 ${outFile}`);
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await checkLinks();
}
