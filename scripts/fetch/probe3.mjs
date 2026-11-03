#!/usr/bin/env node
/** probe3.mjs — final probes: LiveBench v2 weights/leaderboard, Epoch CSV, OpenCompass/SuperCLUE APIs, AA full array */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
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
    if (res.ok) await writeFile(join(OUT, `p3-${name}.${ext}`), buf);
    return { url, status: res.status, ok: res.ok, ms: Date.now() - t0, bytes: buf.byteLength, text: buf.toString('utf8') };
  } catch (e) {
    return { url, status: null, ok: false, ms: Date.now() - t0, bytes: 0, text: '', err: `${e.name}: ${e.message}` };
  }
}
const log = (r) => console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${String(r.status ?? '-').padEnd(4)} ${String(r.ms).padStart(5)}ms ${String(r.bytes).padStart(8)}B ${r.url}`);
const head = (r, n = 220) => r.text.slice(0, n).replace(/\s+/g, ' ');

console.log('\n## LiveBench 2.0 数据文件');
for (const u of [
  'https://livebench.ai/data/20261025/categories.json',
  'https://livebench.ai/data/20261025/notes.json',
  'https://livebench.ai/data/20261025/breakdown.json',
  'https://livebench.ai/data/20261025/cost.csv',
  'https://livebench.ai/data/20261014/table.csv',
]) { const r = await get(u, u.endsWith('.csv') ? 'csv' : 'json'); log(r); if (r.ok) console.log('   head:', head(r, 500)); }

console.log('\n## Epoch use-this-data 页面数据线索');
{
  const r = await get('https://epoch.ai/benchmarks/use-this-data', 'html');
  log(r);
  if (r.ok) {
    const links = [...r.text.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((u) => /csv|json|xlsx|api|data/i.test(u));
    console.log('   links:', [...new Set(links)].slice(0, 30));
    const csv = [...r.text.matchAll(/[^"'\s]{0,100}\.(?:csv|json|xlsx)/g)].map((m) => m[0]);
    console.log('   data mentions:', [...new Set(csv)].slice(0, 30));
  }
}

console.log('\n## OpenCompass 路由 chunk');
{
  const idx = await readFile(join(OUT, 'deep-https_rank.opencompass.org.cn_assets_index-403e5733.js.js'), 'utf8');
  const chunks = [...idx.matchAll(/["'`]\.?\/?(assets\/[A-Za-z0-9_.-]+\.js)["'`]/g)].map((m) => m[1]);
  console.log('   chunks:', [...new Set(chunks)].slice(0, 40));
  for (const c of [...new Set(chunks)].slice(0, 8)) {
    const r = await get(`https://rank.opencompass.org.cn/${c}`, 'js', 10000);
    if (r.ok && /listModelRankings|listArenaRankings|api\/v1/.test(r.text)) {
      console.log('   >>> API chunk:', c);
      for (const m of r.text.matchAll(/["'`](\/api\/v1\/[^"'`\s]+)["'`]/g)) console.log('      ', m[1]);
    }
  }
}

console.log('\n## SuperCLUE API 线索');
{
  const r = await get('https://www.superclueai.com/assets/BenchmarkListPage-DYHYzsvY.js', 'js');
  log(r);
  if (r.ok) {
    const urls = [...r.text.matchAll(/["'`]([^"'`\s]{4,160})["'`]/g)].map((m) => m[1]).filter((s) => /api|http|\/data|rank/i.test(s));
    console.log('   candidates:', [...new Set(urls)].slice(0, 40));
  }
}

console.log('\n## AA flight 中的全部模型数组');
{
  const html = await readFile(join(OUT, 'artificialanalysis-home.html'), 'utf8');
  const chunks = [...html.matchAll(/<script>self\.__next_f\.push\(\[1,([\s\S]*?)\]\)<\/script>/g)].map((m) => m[1]);
  let flight = '';
  for (const c of chunks) { try { flight += JSON.parse(`[${c}]`)[0]; } catch { /* skip */ } }
  const keys = new Set();
  for (const m of flight.matchAll(/"([a-zA-Z]+)":\[/g)) keys.add(m[1]);
  console.log('   array fields:', [...keys].filter((k) => /model|data|initial|leader|rows|entries|chart/i.test(k)));
  console.log('   intelligenceIndex occurrences in flight:', (flight.match(/intelligenceIndex/g) || []).length);
  console.log('   total distinct model names sample:', [...flight.matchAll(/"name":"([^"]{2,40})"/g)].map((m) => m[1]).slice(0, 12));
}
