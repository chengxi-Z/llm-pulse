#!/usr/bin/env node
/** probe-deep.mjs — POC phase 2: dig into SPA/HTML-embedded data endpoints */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1';

async function get(url, ext = 'txt', timeout = 20000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeout) });
    const buf = Buffer.from(await res.arrayBuffer());
    const name = url.replace(/[^a-z0-9._-]+/gi, '_').slice(-90);
    if (res.ok) await writeFile(join(OUT, `deep-${name}.${ext}`), buf);
    return { url, status: res.status, ok: res.ok, ms: Date.now() - t0, bytes: buf.byteLength, text: buf.toString('utf8') };
  } catch (e) {
    return { url, status: null, ok: false, ms: Date.now() - t0, bytes: 0, text: '', err: String(e) };
  }
}

const log = (r) => console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${String(r.status ?? '-').padEnd(4)} ${String(r.ms).padStart(6)}ms ${String(r.bytes).padStart(9)}B ${r.url}${r.err ? ' <- ' + r.err : ''}`);

// 1. HF mirror: file listing of the LMArena dataset text directory
const treeText = await get('https://hf-mirror.com/api/datasets/lmarena-ai/leaderboard-dataset/tree/main/text', 'json');
log(treeText);
if (treeText.ok) {
  const files = JSON.parse(treeText.text);
  console.log('text/ files:', files.map((f) => `${f.path} (${f.size}B)`).join(', '));
  const latest = files.filter((f) => /latest/.test(f.path) && /\.parquet$/.test(f.path)).pop() || files.filter((f) => /\.parquet$/.test(f.path)).pop();
  if (latest) {
    const url = `https://hf-mirror.com/datasets/lmarena-ai/leaderboard-dataset/resolve/main/${latest.path}`;
    const head = await get(url, 'parquet', 30000);
    log(head);
    if (head.ok) {
      console.log(`parquet bytes=${head.bytes}, magic=${head.text.slice(0, 4)}`);
      await writeFile(join(OUT, 'lmarena-latest.parquet'), Buffer.from(head.buffer || head.text, 'utf8'));
    }
  }
}

// 2. LiveBench data files
const lbMain = await get('https://livebench.ai/static/js/main.1e1ce12d.js', 'js');
log(lbMain);
if (lbMain.ok) {
  const urls = [...lbMain.text.matchAll(/["'`]([^"'`\s]{3,160}\.(?:csv|json))["'`]/g)].map((m) => m[1]);
  const results = [...lbMain.text.matchAll(/[^"'`\s]{0,60}results?\/[^"'`\s]{0,80}/g)].map((m) => m[0]);
  console.log('livebench json/csv in bundle:', [...new Set(urls)].slice(0, 30));
  console.log('livebench results mentions:', [...new Set(results)].slice(0, 20));
}
const lbCsvProbe = await get('https://livebench.ai/results/table_2026_10_31.csv', 'csv', 12000);
log(lbCsvProbe);

// 3. OpenCompass SPA JS
const ocJs = await get('https://rank.opencompass.org.cn/assets/index-403e5733.js', 'js');
log(ocJs);
if (ocJs.ok) {
  const apis = [...ocJs.text.matchAll(/["'`](\/[a-zA-Z0-9_\/-]{3,100})["'`]/g)].map((m) => m[1]).filter((s) => /api|data|rank|score|leaderboard/i.test(s));
  console.log('opencompass candidate paths:', [...new Set(apis)].slice(0, 40));
}

// 4. SuperCLUE SPA JS
const scJs = await get('https://www.superclueai.com/assets/index-Cn-ZzohL.js', 'js');
log(scJs);
if (scJs.ok) {
  const apis = [...scJs.text.matchAll(/["'`]([^"'`\s]{4,140})["'`]/g)].map((m) => m[1]).filter((s) => /api|\.json|data|rank|score|list/i.test(s));
  console.log('superclue candidate paths:', [...new Set(apis)].slice(0, 40));
}

// 5. Epoch dashboard embedded data clues
const epoch = await get('https://epoch.ai/data/ai-benchmarking-dashboard', 'html');
log(epoch);
if (epoch.ok) {
  for (const re of [/([^"'\s]{0,80}\.csv)/g, /([^"'\s]{0,80}\.json)/g, /(benchmark[^"'\s]{0,80})/gi, /(data\/[^"'\s]{2,100})/g]) {
    console.log('epoch:', re.source, [...new Set([...epoch.text.matchAll(re)].map((m) => m[1]))].slice(0, 20));
  }
}

// 6. Artificial Analysis embedded data (RSC payload)
const aa = await get('https://artificialanalysis.ai/', 'html');
log(aa);
if (aa.ok) {
  for (const key of ['intelligenceIndex', 'Intelligence Index', 'evaluations', 'median_output_tokens']) {
    const i = aa.text.indexOf(key);
    console.log(`aa "${key}" found=${i >= 0}`);
    if (i >= 0) console.log(aa.text.slice(Math.max(0, i - 300), i + 400).replace(/\s+/g, ' ').slice(0, 600));
  }
}

// 7. LiveBench homepage HTML + manifest
const lbHome = await get('https://livebench.ai/', 'html', 12000);
log(lbHome);
const lbMan = await get('https://livebench.ai/manifest.json', 'json', 12000);
log(lbMan);

// 8. Sample RSS structures for OpenAI / DeepSeek / Qwen
for (const id of ['rss-openai', 'rss-deepseek', 'rss-qwen', 'rss-gdm', 'rss-google-ai']) {
  try {
    const { readFile } = await import('node:fs/promises');
    const t = await readFile(join(OUT, `${id}.xml`), 'utf8').catch(() => null);
    if (t) console.log(`\n[${id}] len=${t.length} head=`, t.slice(0, 320).replace(/\s+/g, ' '));
  } catch { /* ignore */ }
}
