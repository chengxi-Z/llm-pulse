#!/usr/bin/env node
/** probe-deepseek.mjs — inspect the DeepSeek News/ChangeLog page structure (MVP Chinese-vendor update support) */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1';

for (const url of ['https://api-docs.deepseek.com/updates', 'https://api-docs.deepseek.com/news/news261017']) {
  const name = url.split('/').pop();
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    await writeFile(join(OUT, `deepseek-${name}.html`), text);
    console.log(`\n== ${url} ${res.status} ${text.length}B`);
    // Extract body text
    const body = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const main = (body.match(/<article[\s\S]*?<\/article>/i) || [body])[0];
    const plain = main.replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\n{2,}/g, '\n').trim();
    console.log(plain.slice(0, 1200));
    // Title / date
    const h = [...plain.split('\n')].filter((l) => l.trim().length > 3).slice(0, 20);
    console.log('\nfirst lines:', h);
  } catch (e) {
    console.log(url, 'FAIL', e.message);
  }
}
