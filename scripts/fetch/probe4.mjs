#!/usr/bin/env node
/** probe4.mjs — OpenCompass request parameters / Epoch benchmark_data.zip / AA full model array */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1';
async function get(url, ext = 'json', timeout = 20000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(timeout) });
    const buf = Buffer.from(await res.arrayBuffer());
    const name = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 110);
    if (res.ok) await writeFile(join(OUT, `p4-${name}.${ext}`), buf);
    return { url, status: res.status, ok: res.ok, ms: Date.now() - t0, bytes: buf.byteLength, text: buf.toString('utf8'), headers: Object.fromEntries(res.headers) };
  } catch (e) { return { url, status: null, ok: false, ms: Date.now() - t0, bytes: 0, text: '', err: `${e.name}: ${e.message}` }; }
}
const log = (r) => console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${String(r.status ?? '-').padEnd(4)} ${String(r.ms).padStart(5)}ms ${String(r.bytes).padStart(8)}B ${r.url}${r.err ? ' <- ' + r.err : ''}`);

console.log('\n## OpenCompass home chunk 请求定义');
const oc = await get('https://rank.opencompass.org.cn/assets/home-51e852d4.js', 'js');
log(oc);
if (oc.ok) {
  for (const pat of ['listModelRankings', 'listArenaRankings']) {
    const i = oc.text.indexOf(pat);
    if (i >= 0) console.log(`\n[${pat}]`, oc.text.slice(Math.max(0, i - 700), i + 700).replace(/\s+/g, ' '));
  }
}
// Try both POST and GET
for (const [u, opt] of [
  ['https://rank.opencompass.org.cn/api/v1/rank/listModelRankings?page=1&pageSize=10&lang=cn', {}],
  ['https://rank.opencompass.org.cn/api/v1/rank/listModelRankings', { method: 'POST', body: JSON.stringify({ page: 1, pageSize: 10 }), headers: { 'content-type': 'application/json', origin: 'https://rank.opencompass.org.cn' } }],
]) {
  try {
    const res = await fetch(u, { ...opt, headers: { 'user-agent': UA, accept: 'application/json', ...(opt.headers || {}) }, signal: AbortSignal.timeout(15000) });
    const t = (await res.text()).slice(0, 400);
    console.log(`\n[OC ${opt.method || 'GET'}] ${res.status} ${res.headers.get('content-type')} ::`, t.replace(/\s+/g, ' '));
  } catch (e) { console.log('[OC]', e.message); }
}

console.log('\n## Epoch benchmark_data.zip');
const zipUrl = 'https://epoch.ai/data/benchmark_data.zip';
const headRes = await fetch(zipUrl, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) }).catch((e) => ({ ok: false, status: e.message, headers: new Map() }));
console.log('HEAD', headRes.status, headRes.headers?.get?.('content-length'), headRes.headers?.get?.('content-type'));
const zip = await get(zipUrl, 'zip', 60000);
log(zip);
if (zip.ok) console.log('zip magic:', zip.text.slice(0, 4), 'bytes:', zip.bytes);

console.log('\n## AA flight 数组结构');
{
  const html = await readFile(join(OUT, 'artificialanalysis-home.html'), 'utf8');
  const chunks = [...html.matchAll(/<script>self\.__next_f\.push\(\[1,([\s\S]*?)\]\)<\/script>/g)].map((m) => m[1]);
  let flight = '';
  for (const c of chunks) { try { flight += JSON.parse(`[${c}]`)[0]; } catch { /* skip */ } }
  for (const key of ['"benchmarkRows":', '"models":', '"data":']) {
    const i = flight.indexOf(key);
    console.log(`\n${key} idx=${i}`, i >= 0 ? flight.slice(i, i + 400).replace(/\\"/g, '"') : '');
  }
  // Count model objects with intelligenceIndex by name + scores
  const objs = [...flight.matchAll(/\{"id":"[0-9a-f-]{36}","slug":"[^"]+","name":"([^"]+)"[^{}]*?"intelligenceIndex":([0-9.]+)/g)];
  console.log('\nmodel objects w/ intelligenceIndex:', objs.length, objs.slice(0, 6).map((m) => `${m[1]}=${m[2]}`));
}
