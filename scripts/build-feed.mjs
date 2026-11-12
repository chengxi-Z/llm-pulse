#!/usr/bin/env node
/**
 * AI Pulse — RSS / JSON Feed builder.
 *
 * Reads data/{meta,news}.json and writes:
 *   site/feed.xml   RSS 2.0 (valid, stable ordering, XML-escaped)
 *   site/feed.json  JSON Feed 1.1
 *
 * Usage:
 *   node scripts/build-feed.mjs
 *   node scripts/build-feed.mjs --base-url https://example.com/llm-pulse/ --limit 30
 *   SITE_BASE_URL=https://example.com/llm-pulse/ node scripts/build-feed.mjs
 *   node scripts/build-feed.mjs --data-dir data --out-dir site
 *
 * Conventions: the base URL defaults to https://chengxi-z.github.io/llm-pulse/;
 * every link is absolute; ordering is stable (publishedAt desc, same day by id asc).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { filterAihotNews } from '../site/assets/js/aihot-scope.mjs';

export const DEFAULT_BASE_URL = 'https://chengxi-z.github.io/llm-pulse/';
export const SITE_TITLE = 'AI Pulse · Z Cloud';
export const SITE_DESCRIPTION =
  'Tracking frontier LLMs: model catalog, vendor updates, public leaderboards, learning resources and AI projects. Refreshed by GitHub Actions; RSS / JSON Feed.';

const TAG_EN = {
  '官方博客': 'Official blog',
  '模型发布': 'Model release',
  '开源': 'Open source',
  '研究': 'Research',
  '政策/安全': 'Policy & safety',
  '定价': 'Pricing',
  '评测': 'Evaluation',
  '长上下文': 'Long context',
  '多模态': 'Multimodal',
  '推理': 'Reasoning',
  '开源权重': 'Open weights',
  '免费': 'Free',
  '官方公告': 'Official update',
  '微调': 'Fine-tuning',
  '中文': 'Chinese',
  '深度学习': 'Deep learning',
  '机器学习': 'Machine learning',
  '生成式AI': 'Generative AI',
  '应用开发': 'App development',
  '入门': 'Beginner',
  '论文': 'Papers',
  '实战营': 'Bootcamp',
};
const hasCjk = (value) => /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/.test(String(value || ''));

/* ------------------------------ Utilities ------------------------------ */

/** Escape for XML 1.0 and strip illegal control characters. */
export function escapeXml(value = '') {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizeBaseUrl(input = DEFAULT_BASE_URL) {
  let value = String(input || DEFAULT_BASE_URL).trim();
  if (!/^https?:\/\/[^\s]+$/i.test(value)) value = DEFAULT_BASE_URL;
  if (!value.endsWith('/')) value += '/';
  return value;
}

/** Absolute URL (relative inputs resolve against baseUrl); falls back to baseUrl if parsing fails. */
export function absoluteUrl(href, baseUrl = DEFAULT_BASE_URL) {
  const base = normalizeBaseUrl(baseUrl);
  if (!href) return base;
  try {
    return new URL(String(href), base).href;
  } catch {
    return base;
  }
}

function isoOrNull(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function rfc822(iso) {
  const parsed = isoOrNull(iso);
  return parsed ? new Date(parsed).toUTCString() : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOf(value, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

/* --------------------------- Normalized entries --------------------------- */

/**
 * Normalize data/news.json into stably ordered feed items.
 * @param {object} data {meta, news}
 * @param {{baseUrl?:string, limit?:number}} [opts]
 */
export function buildFeedItems(data, opts = {}) {
  // Feeds are English-only outputs, so AIHOT (a Chinese-only module) never enters them.
  const rawNews = data && data.news && Array.isArray(data.news.items) ? data.news.items : asArray(data && data.news);
  const news = filterAihotNews(rawNews, 'en');
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : 100;

  const normalized = news
    .filter((item) => item && (item.title || item.summary))
    .map((item) => {
      const id = textOf(item.id) || `news-${textOf(item.title).slice(0, 40)}`;
      const publishedAt = isoOrNull(item.publishedAt) || isoOrNull(data?.meta?.generatedAt) || null;
      const url = absoluteUrl(item.url || item.sourceUrl || `news.html#${encodeURIComponent(id)}`, baseUrl);
      const summary = textOf(item.summaryEn || item.summary || '', '').slice(0, 240);
      const sourceName = textOf(item.sourceNameEn || item.sourceName, '');
      return {
        id,
        title: textOf(item.titleEn || item.title, 'Untitled'),
        summary,
        url,
        publishedAt,
        sourceName,
        sourceUrl: item.sourceUrl ? absoluteUrl(item.sourceUrl, baseUrl) : null,
        tags: asArray(item.tags).map((tag) => TAG_EN[textOf(tag)] || textOf(tag)).filter((tag) => tag && !hasCjk(tag)),
        kind: textOf(item.kind, ''),
        lang: 'en',
        importance: Number(item.importance) || 1,
      };
    })
  .filter((item) => !hasCjk(item.title) && !hasCjk(item.summary))
  .sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      if (tb !== ta) return tb - ta;
      return a.id.localeCompare(b.id); // Stable tiebreak
    })
    .slice(0, limit);

  return normalized;
}

function itemDescription(item) {
  const parts = [];
  if (item.summary) parts.push(item.summary);
  if (item.sourceName) parts.push(`Source: ${item.sourceName}`);
  return parts.join(' — ').slice(0, 500);
}

/* ------------------------------ RSS 2.0 ------------------------------ */

/**
 * Build the RSS 2.0 XML document.
 * @param {object} data {meta, news}
 * @param {{baseUrl?:string, limit?:number, now?:Date, imageUrl?:string}} [opts]
 */
export function buildRss(data, opts = {}) {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const items = buildFeedItems(data, opts);
  const meta = (data && data.meta) || {};
  const lastBuild = rfc822(meta.generatedAt) || new Date(opts.now instanceof Date ? opts.now : Date.now()).toUTCString();
  const feedUrl = absoluteUrl('feed.xml', baseUrl);
  const homeUrl = baseUrl;
  const lines = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
  lines.push('  <channel>');
  lines.push(`    <title>${escapeXml(SITE_TITLE)}</title>`);
  lines.push(`    <link>${escapeXml(homeUrl)}</link>`);
  lines.push(`    <description>${escapeXml(SITE_DESCRIPTION)}</description>`);
  lines.push('    <language>en-us</language>');
  lines.push(`    <lastBuildDate>${escapeXml(lastBuild)}</lastBuildDate>`);
  lines.push(`    <pubDate>${escapeXml(lastBuild)}</pubDate>`);
  lines.push('    <generator>AI Pulse build-feed.mjs</generator>');
  lines.push(`    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`);
  if (opts.imageUrl) {
    lines.push('    <image>');
    lines.push(`      <url>${escapeXml(absoluteUrl(opts.imageUrl, baseUrl))}</url>`);
    lines.push(`      <title>${escapeXml(SITE_TITLE)}</title>`);
    lines.push(`      <link>${escapeXml(homeUrl)}</link>`);
    lines.push('    </image>');
  }
  if (!items.length) {
    lines.push('    <!-- No updates yet: the data pipeline has not produced news yet. -->');
  }
  for (const item of items) {
    lines.push('    <item>');
    lines.push(`      <title>${escapeXml(item.title)}</title>`);
    lines.push(`      <link>${escapeXml(item.url)}</link>`);
    lines.push(`      <guid isPermaLink="false">${escapeXml(item.id)}</guid>`);
    if (item.publishedAt) lines.push(`      <pubDate>${escapeXml(rfc822(item.publishedAt))}</pubDate>`);
    const description = itemDescription(item);
    if (description) lines.push(`      <description>${escapeXml(description)}</description>`);
    for (const tag of item.tags.slice(0, 6)) lines.push(`      <category>${escapeXml(tag)}</category>`);
    if (item.sourceUrl) {
      lines.push(`      <source url="${escapeXml(item.sourceUrl)}">${escapeXml(item.sourceName || 'Source')}</source>`);
    }
    lines.push('    </item>');
  }
  lines.push('  </channel>');
  lines.push('</rss>');
  lines.push('');
  return lines.join('\n');
}

/* ----------------------------- JSON Feed 1.1 ----------------------------- */

/**
 * Build the JSON Feed 1.1 object.
 * @param {object} data {meta, news}
 * @param {{baseUrl?:string, limit?:number, now?:Date, iconUrl?:string}} [opts]
 */
export function buildJsonFeed(data, opts = {}) {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const items = buildFeedItems(data, opts);
  const meta = (data && data.meta) || {};
  const site = (meta && meta.site) || {};
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE_TITLE,
    home_page_url: baseUrl,
    feed_url: absoluteUrl('feed.json', baseUrl),
    description: SITE_DESCRIPTION,
    language: 'en-US',
    authors: [{ name: SITE_TITLE, url: baseUrl }],
    items: items.map((item) => {
      const entry = {
        id: item.id,
        url: item.url,
        title: item.title,
        content_text: itemDescription(item) || item.title,
        date_published: item.publishedAt || undefined,
        tags: item.tags,
        language: 'en',
      };
      if (item.summary) entry.summary = item.summary;
      if (item.sourceName) entry.authors = [{ name: item.sourceName, url: item.sourceUrl || baseUrl }];
      return entry;
    }),
  };
  if (opts.iconUrl) feed.icon = absoluteUrl(opts.iconUrl, baseUrl);
  return feed;
}

/* ------------------------------ Writing files ------------------------------ */

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Generate and write feed.xml / feed.json.
 * @param {{dataDir?:string, outDir?:string, baseUrl?:string, limit?:number, imageUrl?:string, iconUrl?:string, now?:Date}} opts
 */
export async function writeFeeds(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const dataDir = path.resolve(cwd, opts.dataDir || 'data');
  const outDir = path.resolve(cwd, opts.outDir || 'site');
  const baseUrl = normalizeBaseUrl(opts.baseUrl || process.env.SITE_BASE_URL || DEFAULT_BASE_URL);
  const meta = await readJson(path.join(dataDir, 'meta.json'), null);
  const news = await readJson(path.join(dataDir, 'news.json'), null);
  const data = { meta, news };

  // Hero image: when site/assets/img/og-cover.png exists, write the RSS <image> and JSON Feed icon automatically
  const ogPath = path.join(outDir, 'assets', 'img', 'og-cover.png');
  const hasOgImage = await fs
    .stat(ogPath)
    .then((stat) => stat.isFile())
    .catch(() => false);
  const imageUrl = opts.imageUrl ?? (hasOgImage ? 'assets/img/og-cover.png' : undefined);
  const iconUrl = opts.iconUrl ?? (hasOgImage ? 'assets/img/og-cover.png' : undefined);

  const rss = buildRss(data, { baseUrl, limit: opts.limit, now: opts.now, imageUrl });
  const jsonFeed = buildJsonFeed(data, { baseUrl, limit: opts.limit, now: opts.now, iconUrl });

  await fs.mkdir(outDir, { recursive: true });
  const xmlPath = path.join(outDir, 'feed.xml');
  const jsonPath = path.join(outDir, 'feed.json');
  await fs.writeFile(xmlPath, rss, 'utf8');
  await fs.writeFile(jsonPath, `${JSON.stringify(jsonFeed, null, 2)}\n`, 'utf8');

  return {
    baseUrl,
    xmlPath,
    jsonPath,
    items: jsonFeed.items.length,
    bytes: { xml: Buffer.byteLength(rss, 'utf8'), json: Buffer.byteLength(JSON.stringify(jsonFeed), 'utf8') },
    generatedAt: meta?.generatedAt || null,
  };
}

/* ------------------------------- CLI ------------------------------- */

function parseArgs(argv = []) {
  const args = { dataDir: 'data', outDir: 'site', baseUrl: process.env.SITE_BASE_URL || DEFAULT_BASE_URL, limit: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      return argv[i];
    };
    if (arg === '--base-url' || arg === '--baseUrl') args.baseUrl = next();
    else if (arg === '--data-dir' || arg === '--dataDir') args.dataDir = next();
    else if (arg === '--out-dir' || arg === '--outDir') args.outDir = next();
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('用法: node scripts/build-feed.mjs [--base-url URL] [--data-dir data] [--out-dir site] [--limit N]');
    return;
  }
  const result = await writeFeeds(args);
  console.log(`[build-feed] base=${result.baseUrl}`);
  console.log(`[build-feed] items=${result.items} dataGeneratedAt=${result.generatedAt || '未知'}`);
  console.log(`[build-feed] → ${path.relative(process.cwd(), result.xmlPath)} (${(result.bytes.xml / 1024).toFixed(1)} KB)`);
  console.log(`[build-feed] → ${path.relative(process.cwd(), result.jsonPath)} (${(result.bytes.json / 1024).toFixed(1)} KB)`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error('[build-feed] 失败:', error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}
