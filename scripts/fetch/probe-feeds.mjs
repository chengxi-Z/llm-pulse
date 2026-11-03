#!/usr/bin/env node
/** probe-feeds.mjs — reachability probe for candidate official/research blog RSS feeds and vendor news pages (MVP source expansion) */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse-poc/0.1';

const CANDIDATES = [
  { id: 'rss-nvidia', name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', type: 'rss' },
  { id: 'rss-microsoft-ai', name: 'Microsoft AI Blog', url: 'https://blogs.microsoft.com/ai/feed/', type: 'rss' },
  { id: 'rss-aws-ml', name: 'AWS ML Blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', type: 'rss' },
  { id: 'rss-google-research', name: 'Google Research Blog', url: 'https://research.google/blog/rss/', type: 'rss' },
  { id: 'rss-bair', name: 'Berkeley BAIR Blog', url: 'https://bair.berkeley.edu/blog/feed.xml', type: 'rss' },
  { id: 'rss-mit-ai', name: 'MIT News AI', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', type: 'rss' },
  { id: 'rss-marktech', name: 'Stanford HAI', url: 'https://hai.stanford.edu/news/rss.xml', type: 'rss' },
  { id: 'rss-arxiv-cl', name: 'arXiv cs.CL RSS', url: 'https://rss.arxiv.org/rss/cs.CL', type: 'rss' },
  { id: 'rss-hf-blog', name: 'HF Blog（本机被墙）', url: 'https://huggingface.co/blog/feed.xml', type: 'rss' },
  { id: 'deepseek-news', name: 'DeepSeek News 页', url: 'https://api-docs.deepseek.com/news/', type: 'html' },
  { id: 'moonshot-blog', name: 'Moonshot AI Blog', url: 'https://moonshotai.github.io/', type: 'html' },
  { id: 'minimax-news', name: 'MiniMax News', url: 'https://www.minimax.io/news', type: 'html' },
  { id: 'zhipu-news', name: 'Zhipu News', url: 'https://www.zhipuai.cn/', type: 'html' },
  { id: 'mistral-news', name: 'Mistral News', url: 'https://mistral.ai/news', type: 'html' },
  { id: 'anthropic-news', name: 'Anthropic News', url: 'https://www.anthropic.com/news', type: 'html' },
];
function sampleText(html) {
  const items = [...String(html || '').matchAll(/<(?:article|item|entry)\b/gi)].length;
  const dates = [...String(html || '').matchAll(/20\d{2}-\d{2}-\d{2}/g)].map((m) => m[0]);
  const jsons = [...String(html || '').matchAll(/["'](\/api\/[^"']{2,80})["']/g)].map((m) => m[1]);
  return { articleTags: items, latestDates: [...new Set(dates)].slice(0, 3), apiPaths: [...new Set(jsons)].slice(0, 8) };
}
const results = [];
let i = 0;
const workers = Array.from({ length: 6 }, async () => {
  while (i < CANDIDATES.length) {
    const c = CANDIDATES[i++];
    const t0 = Date.now();
    let rec = { id: c.id, name: c.name, url: c.url, type: c.type, status: null, ok: false, elapsedMs: null, bytes: null };
    try {
      const res = await fetch(c.url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(12000) });
      const buf = Buffer.from(await res.arrayBuffer());
      rec = { ...rec, status: res.status, ok: res.ok, elapsedMs: Date.now() - t0, bytes: buf.byteLength, contentType: res.headers.get('content-type') };
      const text = buf.toString('utf8');
      if (res.ok) {
        await writeFile(join(OUT, `feed-${c.id}.${c.type === 'rss' ? 'xml' : 'html'}`), buf);
        const itemCount = (text.match(/<item\b/gi) || []).length;
        const entryCount = (text.match(/<entry\b/gi) || []).length;
        rec.items = itemCount || entryCount || 0;
        rec.firstTitle = (text.match(/<title[^>]*>([\s\S]{1,140}?)<\/title>/i) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || null;
        rec.sample = c.type === 'rss' ? { itemCount: rec.items, firstTitle: rec.firstTitle } : sampleText(text);
        if (itemCount || entryCount) rec.note = `RSS 有效：${rec.items} 条，首条「${rec.firstTitle}」`;
        else rec.note = `HTTP 200 但无 <item>/<entry>（可能是 HTML 页面）`;
      } else rec.note = text.slice(0, 120).replace(/\s+/g, ' ');
    } catch (e) {
      rec = { ...rec, elapsedMs: Date.now() - t0, note: `${e.name}: ${e.message}${e.cause?.code ? ' / ' + e.cause.code : ''}` };
    }
    results.push(rec);
    console.log(`${rec.ok ? 'OK  ' : 'FAIL'} ${String(rec.status ?? '-').padEnd(4)} ${String(rec.elapsedMs ?? '-').padStart(6)}ms ${String(rec.bytes ?? '-').padStart(8)}B ${c.id.padEnd(20)} ${rec.note || ''}`);
  }
});
await Promise.all(workers);
await writeFile(join(OUT, 'report-feeds.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(`\nsummary: ${results.filter((r) => r.ok && r.items).length}/${results.length} 有效 RSS`);
