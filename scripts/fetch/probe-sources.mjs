#!/usr/bin/env node
/**
 * probe-sources.mjs — POC data-source reachability probe.
 * Usage: node scripts/fetch/probe-sources.mjs [--only=id1,id2] [--out=data/snapshot/probe]
 *
 * For every candidate source: Node fetch (with timeout) -> record HTTP status / latency /
 * bytes / content-type / sample snippet -> persist the raw response to
 * data/snapshot/probe/<id>.<ext> and write a summary report to data/snapshot/probe/report.json.
 * For HTML pages, additionally scan for embedded data clues (.csv/.json/api paths).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);
const outDir = args.out ? join(ROOT, args.out) : OUT;
const only = args.only ? new Set(String(args.only).split(',')) : null;

/** Probe list: id / name / category / local expectation / URL / extra headers */
const TARGETS = [
  // ---------- Model catalogs ----------
  { id: 'openrouter-models', name: 'OpenRouter Models API', type: 'api', url: 'https://openrouter.ai/api/v1/models', ext: 'json' },
  { id: 'openrouter-frontend', name: 'OpenRouter 模型页 HTML', type: 'html', url: 'https://openrouter.ai/models?order=newest', ext: 'html' },
  { id: 'hf-mirror-models', name: 'HF 镜像 模型列表', type: 'api', url: 'https://hf-mirror.com/api/models?limit=20&sort=trendingScore&direction=-1', ext: 'json' },
  { id: 'hf-mirror-models-search', name: 'HF 镜像 模型搜索 (deepseek)', type: 'api', url: 'https://hf-mirror.com/api/models?search=deepseek&limit=20&sort=downloads&direction=-1', ext: 'json' },
  { id: 'hf-official-models', name: 'HF 官方 API（预期被墙）', type: 'api', url: 'https://huggingface.co/api/models?limit=5', ext: 'json' },
  // ---------- Leaderboard candidates ----------
  { id: 'hf-mirror-ds-lmarena', name: 'hf-mirror LMArena leaderboard-dataset', type: 'api', url: 'https://hf-mirror.com/api/datasets/lmarena-ai/leaderboard-dataset', ext: 'json' },
  { id: 'hf-mirror-ds-search', name: 'hf-mirror 数据集搜索 leaderboard', type: 'api', url: 'https://hf-mirror.com/api/datasets?search=leaderboard&limit=20&sort=downloads&direction=-1', ext: 'json' },
  { id: 'hf-mirror-ds-tree', name: 'hf-mirror LMArena dataset 文件树', type: 'api', url: 'https://hf-mirror.com/api/datasets/lmarena-ai/leaderboard-dataset/tree/main', ext: 'json' },
  { id: 'livebench-home', name: 'LiveBench 首页', type: 'html', url: 'https://livebench.ai/', ext: 'html' },
  { id: 'livebench-results-dir', name: 'LiveBench results 目录探测', type: 'html', url: 'https://livebench.ai/results/', ext: 'html' },
  { id: 'epoch-dashboard', name: 'Epoch AI 基准面板', type: 'html', url: 'https://epoch.ai/data/ai-benchmarking-dashboard', ext: 'html' },
  { id: 'epoch-home', name: 'Epoch AI 首页', type: 'html', url: 'https://epoch.ai/', ext: 'html' },
  { id: 'artificialanalysis-home', name: 'Artificial Analysis 首页', type: 'html', url: 'https://artificialanalysis.ai/', ext: 'html' },
  { id: 'aa-api-v2-models', name: 'Artificial Analysis 公开 API v2', type: 'api', url: 'https://artificialanalysis.ai/api/v2/data/llms/models', ext: 'json' },
  { id: 'opencompass-rank', name: 'OpenCompass 榜单 SPA', type: 'html', url: 'https://rank.opencompass.org.cn/', ext: 'html' },
  { id: 'opencompass-api', name: 'OpenCompass API 探测', type: 'api', url: 'https://rank.opencompass.org.cn/api/rank/v1/leaderboard', ext: 'json' },
  { id: 'superclue-home', name: 'SuperCLUE 首页', type: 'html', url: 'https://www.superclueai.com/', ext: 'html' },
  { id: 'superclue-api', name: 'SuperCLUE 数据接口探测', type: 'api', url: 'https://www.superclueai.com/api/superclue/rank', ext: 'json' },
  { id: 'lmarena-leaderboard', name: 'LMArena 官网（预期被墙）', type: 'html', url: 'https://lmarena.ai/leaderboard', ext: 'html' },
  { id: 'huggingface-datasets-server', name: 'HF datasets-server（预期被墙）', type: 'api', url: 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=default&split=train&offset=0&length=5', ext: 'json' },
  // ---------- Official update RSS ----------
  { id: 'rss-openai', name: 'OpenAI News RSS', type: 'rss', url: 'https://openai.com/news/rss.xml', ext: 'xml' },
  { id: 'rss-anthropic', name: 'Anthropic News RSS', type: 'rss', url: 'https://www.anthropic.com/rss.xml', ext: 'xml' },
  { id: 'rss-gdm', name: 'Google DeepMind Blog RSS', type: 'rss', url: 'https://deepmind.google/blog/rss.xml', ext: 'xml' },
  { id: 'rss-google-ai', name: 'Google AI Blog RSS', type: 'rss', url: 'https://blog.google/technology/ai/rss/', ext: 'xml' },
  { id: 'rss-deepseek', name: 'DeepSeek API News', type: 'html', url: 'https://api-docs.deepseek.com/news/', ext: 'html' },
  { id: 'rss-qwen', name: 'Qwen Blog RSS', type: 'rss', url: 'https://qwenlm.github.io/blog/index.xml', ext: 'xml' },
  { id: 'rss-moonshot', name: 'Moonshot AI 博客', type: 'html', url: 'https://moonshotai.github.io/', ext: 'html' },
  { id: 'rss-zhipu', name: 'Zhipu AI 官网', type: 'html', url: 'https://www.zhipuai.cn/', ext: 'html' },
  { id: 'rss-minimax', name: 'MiniMax 官网 News', type: 'html', url: 'https://www.minimax.io/news', ext: 'html' },
  { id: 'rss-meta', name: 'Meta AI Blog RSS', type: 'rss', url: 'https://ai.meta.com/blog/rss/', ext: 'xml' },
  { id: 'rss-hf-blog', name: 'HF Blog RSS（预期被墙）', type: 'rss', url: 'https://huggingface.co/blog/feed.xml', ext: 'xml' },
  { id: 'rss-mistral', name: 'Mistral News', type: 'html', url: 'https://mistral.ai/news', ext: 'html' },
  // ---------- GitHub ----------
  { id: 'github-api-repo', name: 'GitHub API 单仓库', type: 'api', url: 'https://api.github.com/repos/open-webui/open-webui', ext: 'json' },
  { id: 'github-api-ratelimit', name: 'GitHub API 限流端点', type: 'api', url: 'https://api.github.com/rate_limit', ext: 'json' },
  { id: 'github-release-transformers', name: 'GitHub Releases transformers', type: 'api', url: 'https://api.github.com/repos/huggingface/transformers/releases?per_page=5', ext: 'json' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1 (+https://github.com/chengxi-Z/llm-pulse)';

function sampleOf(text, ext) {
  if (ext === 'json') {
    try {
      const j = JSON.parse(text);
      const shape = (v) => {
        if (Array.isArray(v)) return { type: 'array', len: v.length, first: v[0] && typeof v[0] === 'object' ? Object.keys(v[0]).slice(0, 24) : v[0] };
        return { type: typeof v, keys: v && typeof v === 'object' ? Object.keys(v).slice(0, 24) : undefined };
      };
      return { jsonShape: shape(j), snippet: JSON.stringify(j).slice(0, 600) };
    } catch { return { parseError: true, snippet: text.slice(0, 400) }; }
  }
  return { snippet: text.slice(0, 500), bytes: Buffer.byteLength(text) };
}

/** Extract possible data clues from HTML */
function hintsOf(text) {
  const uniq = (a) => [...new Set(a)].slice(0, 25);
  const urls = [...text.matchAll(/(?:src|href)="([^"]+?\.(?:csv|json|xlsx|parquet|js))"/gi)].map((m) => m[1]);
  const apiPaths = [...text.matchAll(/["'](\/api\/[^"'\s]{2,120})["']/g)].map((m) => m[1]);
  const dataAttrs = [...text.matchAll(/__NEXT_DATA__|__NUXT__|window\.__[A-Z_]+__/g)].map((m) => m[0]);
  const csvJsonMention = [...text.matchAll(/[^"'\s]{0,80}(?:\.csv|\.parquet|results\/[^"'\s]{2,80})/gi)].map((m) => m[0]);
  return { assetUrls: uniq(urls), apiPaths: uniq(apiPaths), dataAttrs: uniq(dataAttrs), dataMentions: uniq(csvJsonMention.slice(0, 40)) };
}

async function probe(t) {
  const started = Date.now();
  const rec = { id: t.id, name: t.name, type: t.type, url: t.url, status: null, ok: false, elapsedMs: null, bytes: null, contentType: null, note: null };
  try {
    const res = await fetch(t.url, {
      headers: { 'user-agent': UA, accept: '*/*' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    const buf = Buffer.from(await res.arrayBuffer());
    rec.status = res.status;
    rec.ok = res.ok;
    rec.elapsedMs = Date.now() - started;
    rec.bytes = buf.byteLength;
    rec.contentType = res.headers.get('content-type');
    rec.finalUrl = res.url;
    const text = buf.toString('utf8');
    if (res.ok) {
      await writeFile(join(outDir, `${t.id}.${t.ext}`), buf);
      rec.sample = sampleOf(text, t.ext);
      if (t.ext === 'html') rec.hints = hintsOf(text);
      const j = t.ext === 'json' ? text : null;
      if (j) { try { const p = JSON.parse(j); rec.topLevel = Array.isArray(p) ? `array(${p.length})` : Object.keys(p).slice(0, 20); } catch { /* ignore */ } }
    } else {
      rec.note = text.slice(0, 200);
    }
  } catch (err) {
    rec.elapsedMs = Date.now() - started;
    rec.note = `${err.name}: ${err.message}` + (err.cause ? ` | cause: ${err.cause.code || err.cause.message}` : '');
  }
  return rec;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      const r = out[idx];
      console.log(
        `${r.ok ? 'OK  ' : 'FAIL'} ${String(r.status ?? '-').padEnd(4)} ${String(r.elapsedMs ?? '-').padStart(6)}ms ${String(r.bytes ?? '-').padStart(9)}B  ${r.id}${r.note ? '  <- ' + r.note.slice(0, 90) : ''}`
      );
    }
  });
  await Promise.all(workers);
  return out;
}

await mkdir(outDir, { recursive: true });
const targets = only ? TARGETS.filter((t) => only.has(t.id)) : TARGETS;
console.log(`probing ${targets.length} sources -> ${outDir}\n`);
const results = await pool(targets, 8, probe);
const report = { generatedAt: new Date().toISOString(), node: process.version, count: results.length, results };
await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');

const ok = results.filter((r) => r.ok).length;
console.log(`\nsummary: ${ok}/${results.length} ok`);
for (const r of results) {
  if (r.hints && (r.hints.assetUrls.length || r.hints.apiPaths.length || r.hints.dataMentions.length)) {
    console.log(`\n[hints] ${r.id}`);
    console.log(JSON.stringify(r.hints, null, 2).slice(0, 1600));
  }
}
