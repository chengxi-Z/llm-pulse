#!/usr/bin/env node
/** probe5.mjs — OpenCompass real API + Epoch benchmark_data.zip unpacking */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1';

// ---- OpenCompass POST ----
const ocUrl = 'https://rank.opencompass.org.cn/gw/opencompass-be/api/v1/rank/listArenaRankings';
for (const body of [{ rankingType: 0 }, { rankingType: 1 }]) {
  try {
    const res = await fetch(ocUrl, {
      method: 'POST',
      headers: { 'user-agent': UA, 'content-type': 'application/json', origin: 'https://rank.opencompass.org.cn', referer: 'https://rank.opencompass.org.cn/' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const t = await res.text();
    console.log(`[OC] body=${JSON.stringify(body)} -> ${res.status} ${res.headers.get('content-type')} bytes=${t.length}`);
    console.log('  head:', t.slice(0, 600).replace(/\s+/g, ' '));
    if (res.ok && t.trim().startsWith('{')) await writeFile(join(OUT, `oc-arena-${body.rankingType}.json`), t);
  } catch (e) { console.log('[OC] fail', e.message); }
}

// ---- Epoch zip ----
console.log('\n## Epoch benchmark_data.zip 解包');
const zipBuf = await readFile(join(OUT, 'p4-epoch.ai_data_benchmark_data.zip.zip'));
console.log('zip bytes:', zipBuf.length, 'magic:', zipBuf.subarray(0, 4).toString('hex'));
// EOCD
let eocd = -1;
for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 66000); i--) {
  if (zipBuf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) { console.log('EOCD not found'); process.exit(0); }
const count = zipBuf.readUInt16LE(eocd + 10);
let off = zipBuf.readUInt32LE(eocd + 16);
console.log('entries:', count);
const entries = [];
for (let k = 0; k < count; k++) {
  if (zipBuf.readUInt32LE(off) !== 0x02014b50) { console.log('bad CD sig at', off); break; }
  const method = zipBuf.readUInt16LE(off + 10);
  const compSize = zipBuf.readUInt32LE(off + 20);
  const uncompSize = zipBuf.readUInt32LE(off + 24);
  const nameLen = zipBuf.readUInt16LE(off + 28);
  const extraLen = zipBuf.readUInt16LE(off + 30);
  const commentLen = zipBuf.readUInt16LE(off + 32);
  const localOff = zipBuf.readUInt32LE(off + 42);
  const name = zipBuf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
  off += 46 + nameLen + extraLen + commentLen;
  // local header
  const lNameLen = zipBuf.readUInt16LE(localOff + 26);
  const lExtraLen = zipBuf.readUInt16LE(localOff + 28);
  const dataOff = localOff + 30 + lNameLen + lExtraLen;
  const comp = zipBuf.subarray(dataOff, dataOff + compSize);
  let data;
  try { data = method === 0 ? comp : inflateRawSync(comp); } catch (e) { data = Buffer.from(`[decompress fail ${e.message}]`); }
  entries.push({ name, method, compSize, uncompSize, data });
}
for (const e of entries) console.log(`  ${e.name}  (${e.uncompSize}B)`);
// Persist small CSV/JSON files for analysis
for (const e of entries) {
  if (e.data.length < 4_000_000 && /\.(csv|json|md|txt)$/i.test(e.name)) {
    const safe = e.name.replace(/[^a-z0-9._-]+/gi, '_');
    await writeFile(join(OUT, `epoch-${safe}`), e.data);
  }
}
const csvs = entries.filter((e) => /\.csv$/i.test(e.name));
for (const e of csvs.slice(0, 6)) {
  console.log(`\n--- ${e.name} head:\n` + e.data.toString('utf8', 0, 500).replace(/\s+/g, ' '));
}
