#!/usr/bin/env node
/** probe2.mjs — dig into LiveBench / OpenCompass / Epoch / SuperCLUE / AA data endpoints */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1';

async function get(url, ext = 'json', timeout = 15000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(timeout) });
    const buf = Buffer.from(await res.arrayBuffer());
    const name = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 110);
    if (res.ok) await writeFile(join(OUT, `p2-${name}.${ext}`), buf);
    return { url, status: res.status, ok: res.ok, ms: Date.now() - t0, bytes: buf.byteLength, text: buf.toString('utf8') };
  } catch (e) {
    return { url, status: null, ok: false, ms: Date.now() - t0, bytes: 0, text: '', err: `${e.name}: ${e.message}` };
  }
}
const log = (r) => console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${String(r.status ?? '-').padEnd(4)} ${String(r.ms).padStart(5)}ms ${String(r.bytes).padStart(8)}B ${r.url}${r.err ? ' <- ' + r.err : ''}`);
const head = (r, n = 200) => r.text.slice(0, n).replace(/\s+/g, ' ');

// ---------- LiveBench candidate data files ----------
console.log('\n## LiveBench');
const lbCandidates = [
  'https://livebench.ai/v1/table_2026_10_25.csv',
  'https://livebench.ai/v1/categories_2026_10_25.json',
  'https://livebench.ai/v1/cost_2026_10_25.csv',
  'https://livebench.ai/v1/table_2026_06_25.csv',
  'https://livebench.ai/v1/categories_2026_06_25.json',
  'https://livebench.ai/v2/table_2026_10_25.csv',
  'https://livebench.ai/data/2026-10-25/table.csv',
  'https://livebench.ai/data/20261025/table.csv',
  'https://livebench.ai/results/table_2026_10_25.csv',
];
for (const u of lbCandidates) { const r = await get(u, u.endsWith('.csv') ? 'csv' : 'json'); log(r); if (r.ok) console.log('   head:', head(r, 240)); }

// ---------- OpenCompass API guesses ----------
console.log('\n## OpenCompass');
const ocCandidates = [
  'https://rank.opencompass.org.cn/api/v1/rank/listArenaRankings',
  'https://rank.opencompass.org.cn/rank/listModelRankings',
  'https://rank.opencompass.org.cn/rank/listModelRankings?page=1&pageSize=20',
  'https://rank.opencompass.org.cn/api/v1/rank/listNewModelsV2',
  'https://rank.opencompass.org.cn/listRankTableAvailableMonths',
  'https://rank.opencompass.org.cn/api/v1/rank/listModelRankings',
];
for (const u of ocCandidates) { const r = await get(u); log(r); console.log('   head:', head(r, 300)); }

// ---------- Epoch chart component -> data URL ----------
console.log('\n## Epoch');
const epochChart = await get('https://epoch.ai/_astro/BenchmarkDashboardChart.DdaQOGDt.js', 'js');
log(epochChart);
if (epochChart.ok) {
  const paths = [...epochChart.text.matchAll(/["'`](\/[^"'`\s]{2,140}|\.\/[^"'`\s]{2,140})["'`]/g)].map((m) => m[1]);
  console.log('epoch chart js paths:', [...new Set(paths.filter((p) => /data|json|csv|api|benchmark/i.test(p)))].slice(0, 40));
}
for (const u of ['https://epoch.ai/data/ai-benchmarking-dashboard/benchmark-data.json', 'https://epoch.ai/api/data/ai-benchmarking-dashboard', 'https://epoch.ai/benchmarks/use-this-data']) {
  const r = await get(u, 'html'); log(r);
}

// ---------- SuperCLUE lazy-loaded chunks ----------
console.log('\n## SuperCLUE');
for (const u of ['https://www.superclueai.com/assets/BenchmarkListPage-DYHYzsvY.js', 'https://www.superclueai.com/api/chores/']) {
  const r = await get(u, u.endsWith('.js') ? 'js' : 'json'); log(r); console.log('   head:', head(r, 400));
}

// ---------- AA initialData extraction checks ----------
console.log('\n## Artificial Analysis 内嵌数据');
{
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(join(OUT, 'artificialanalysis-home.html'), 'utf8');
  const chunks = [...html.matchAll(/<script>self\.__next_f\.push\(\[1,([\s\S]*?)\]\)<\/script>/g)].map((m) => m[1]);
  let flight = '';
  for (const c of chunks) { try { flight += JSON.parse(`[${c}]`)[0]; } catch { /* skip */ } }
  console.log('flight chars:', flight.length);
  const idx = flight.indexOf('"initialData":');
  console.log('initialData idx:', idx);
  // Balanced-bracket scan of a JSON array
  const start = flight.indexOf('[', idx);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < flight.length; i++) {
    const ch = flight[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  console.log('model array span:', start, end, 'chars:', end - start);
  if (end > 0) {
    const raw = flight.slice(start, end);
    try {
      const arr = JSON.parse(raw);
      console.log('AA models parsed:', arr.length, '| first:', JSON.stringify(arr[0]).slice(0, 300));
      const withIdx = arr.filter((m) => typeof m.intelligenceIndex === 'number');
      console.log('with intelligenceIndex:', withIdx.length, '| top:', withIdx.sort((a, b) => b.intelligenceIndex - a.intelligenceIndex).slice(0, 3).map((m) => `${m.name}=${m.intelligenceIndex}`));
      await writeFile(join(OUT, 'aa-initialdata.json'), JSON.stringify(arr, null, 2));
    } catch (e) { console.log('parse fail', e.message); }
  }
}
