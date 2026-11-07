import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_BASE_URL,
  absoluteUrl,
  buildFeedItems,
  buildJsonFeed,
  buildRss,
  escapeXml,
  normalizeBaseUrl,
  writeFeeds,
} from '../scripts/build-feed.mjs';

const META = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  site: { name: 'AI Pulse', brand: '照胆云' },
};

const NEWS = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  items: [
    {
      id: 'release-gpt-terra',
      title: 'OpenAI releases GPT-6.1 Terra Pro: 1.05M context',
      summary: 'Flagship update; pricing $1/$5.',
      kind: 'release',
      sourceName: 'OpenRouter',
      sourceUrl: 'https://openrouter.ai/api/v1/models',
      url: 'https://openrouter.ai/openai/gpt-6.1-terra-pro',
      publishedAt: '2026-10-26T00:00:00.000Z',
      tags: ['OpenAI', 'Reasoning'],
      importance: 3,
    },
    {
      id: 'pricing-deepseek-flash',
      title: 'DeepSeek V4.1 Flash price cut & open source',
      summary: 'Input price down < 50%.',
      kind: 'pricing',
      sourceName: 'Official Blog',
      sourceUrl: 'https://api-docs.deepseek.com/news',
      url: null,
      publishedAt: '2026-11-01T00:00:00.000Z',
      tags: ['DeepSeek', 'Pricing'],
      importance: 2,
    },
    {
      id: 'same-day-a',
      title: 'Same-day item A',
      summary: null,
      kind: 'research',
      sourceName: 'arXiv',
      sourceUrl: 'https://arxiv.org/abs/1',
      url: 'https://arxiv.org/abs/1',
      publishedAt: '2026-11-01T00:00:00.000Z',
      tags: [],
      importance: 1,
    },
    {
      id: 'same-day-b',
      title: 'Same-day item B <script>alert(1)</script>',
      summary: 'Escaping test',
      kind: 'research',
      sourceName: 'arXiv',
      sourceUrl: 'https://arxiv.org/abs/2',
      url: 'https://arxiv.org/abs/2',
      publishedAt: '2026-11-01T00:00:00.000Z',
      tags: ['<x>'],
      importance: 1,
    },
  ],
};

const DATA = { meta: META, news: NEWS };

test('normalizeBaseUrl 规范化并回退非法值', () => {
  assert.equal(normalizeBaseUrl('https://chengxi-z.github.io/llm-pulse'), 'https://chengxi-z.github.io/llm-pulse/');
  assert.equal(normalizeBaseUrl(''), DEFAULT_BASE_URL);
  assert.equal(normalizeBaseUrl('ftp://bad'), DEFAULT_BASE_URL);
  assert.equal(absoluteUrl('news.html', 'https://example.com/llm-pulse/'), 'https://example.com/llm-pulse/news.html');
  assert.equal(absoluteUrl('https://x.com/a', 'https://example.com/'), 'https://x.com/a');
});

test('escapeXml 转义五个字符并剔除非法控制符', () => {
  assert.equal(escapeXml('a & b < c > d " e \' f'), 'a &amp; b &lt; c &gt; d &quot; e &apos; f');
  assert.equal(escapeXml('x\u0001y'), 'xy');
});

test('buildFeedItems：publishedAt 倒序、同日按 id 稳定排序、limit 生效', () => {
  const items = buildFeedItems(DATA);
  assert.equal(items.length, 4);
  assert.equal(items[0].id, 'pricing-deepseek-flash'); // 11-01
  // Three items on the same day: id ascending (pricing < same-day-a < same-day-b), then the 10-26 release
  assert.deepEqual(items.map((item) => item.id), [
    'pricing-deepseek-flash',
    'same-day-a',
    'same-day-b',
    'release-gpt-terra',
  ]);
  const limited = buildFeedItems(DATA, { limit: 2 });
  assert.equal(limited.length, 2);
  assert.equal(limited[0].id, 'pricing-deepseek-flash');
  // Entries without url fall back to sourceUrl (preferred)
  assert.equal(items[0].url, 'https://api-docs.deepseek.com/news');
});

test('buildRss 生成合法结构且关键字段齐全', () => {
  const rss = buildRss(DATA, { baseUrl: 'https://example.com/llm-pulse/', imageUrl: 'assets/img/og-cover.png' });
  assert.ok(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(rss.includes('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'));
  assert.ok(rss.includes('<title>AI Pulse · Z Cloud</title>'));
  assert.ok(rss.includes('<link>https://example.com/llm-pulse/</link>'));
  assert.ok(rss.includes('<atom:link href="https://example.com/llm-pulse/feed.xml" rel="self" type="application/rss+xml"/>'));
  assert.ok(rss.includes('<lastBuildDate>'));
  assert.ok(rss.includes('<image>'));
  assert.ok((rss.match(/<item>/g) || []).length === 4);
  assert.ok(rss.includes('<guid isPermaLink="false">release-gpt-terra</guid>'));
  assert.ok(rss.includes('<pubDate>'));
  assert.ok(rss.includes('<category>OpenAI</category>'));
  // Special characters are escaped; no raw & or <script> may appear
  const body = rss.replace(/<\?xml[^>]*\?>/, '');
  assert.ok(!body.includes('<script>'));
  assert.ok(body.includes('&amp;'));
  assert.ok(body.includes('&lt;script&gt;'));
  assert.ok(body.includes('&lt;x&gt;'));
  // No bare & (except entities)
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(body));
});

test('buildRss 对空数据/缺失文件仍输出合法空频道', () => {
  const rss = buildRss({ meta: null, news: null }, { now: new Date('2026-11-03T12:00:00Z') });
  assert.ok(rss.includes('<channel>'));
  assert.ok(!rss.includes('<item>'));
  assert.ok(rss.includes('<!-- No updates yet'));
  const noNews = buildRss({ meta: META }, {});
  assert.ok(noNews.includes(`<lastBuildDate>${new Date('2026-11-03T12:00:00Z').toUTCString()}</lastBuildDate>`));
});

test('buildJsonFeed 输出 JSON Feed 1.1 合规字段', () => {
  const feed = buildJsonFeed(DATA, { baseUrl: 'https://example.com/llm-pulse/' });
  assert.equal(feed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(feed.home_page_url, 'https://example.com/llm-pulse/');
  assert.equal(feed.feed_url, 'https://example.com/llm-pulse/feed.json');
  assert.equal(feed.language, 'en-US');
  assert.equal(feed.items.length, 4);
  const first = feed.items[0];
  assert.equal(first.id, 'pricing-deepseek-flash');
  assert.equal(first.url, 'https://api-docs.deepseek.com/news'); // Fall back to sourceUrl when url is missing
  assert.ok(first.date_published);
  assert.ok(!Number.isNaN(Date.parse(first.date_published)));
  assert.ok(first.content_text.includes('Source: Official Blog'));
  assert.ok(Array.isArray(first.tags));
  assert.equal(feed.items.filter((item) => item.authors).length, 4);
  // Entries without any url fall back to a site-baseUrl anchor
  const fallbackFeed = buildJsonFeed(
    { meta: META, news: { items: [{ id: 'only-id', title: 'Unlinked entry', titleEn: 'Unlinked entry', publishedAt: '2026-11-02T00:00:00.000Z' }] } },
    { baseUrl: 'https://example.com/llm-pulse/' }
  );
  assert.equal(fallbackFeed.items[0].url, 'https://example.com/llm-pulse/news.html#only-id');
});

test('writeFeeds 写出 feed.xml / feed.json 到临时目录', async () => {
  const outDir = path.resolve(import.meta.dirname, '..', '_tmp', 'feed-test-out');
  const dataDir = path.resolve(import.meta.dirname, '..', '_tmp', 'feed-test-data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'meta.json'), JSON.stringify(META), 'utf8');
  await fs.writeFile(path.join(dataDir, 'news.json'), JSON.stringify(NEWS), 'utf8');
  const result = await writeFeeds({
    cwd: path.resolve(import.meta.dirname, '..'),
    dataDir,
    outDir,
    baseUrl: 'https://example.com/llm-pulse/',
  });
  assert.equal(result.items, 4);
  assert.equal(result.baseUrl, 'https://example.com/llm-pulse/');
  const xml = await fs.readFile(path.join(outDir, 'feed.xml'), 'utf8');
  const json = JSON.parse(await fs.readFile(path.join(outDir, 'feed.json'), 'utf8'));
  assert.ok(xml.includes('<rss version="2.0"'));
  assert.equal(json.version, 'https://jsonfeed.org/version/1.1');
  assert.ok(result.bytes.xml > 500);

  // When og-cover exists, write the RSS <image> and JSON Feed icon automatically
  await fs.mkdir(path.join(outDir, 'assets', 'img'), { recursive: true });
  await fs.writeFile(path.join(outDir, 'assets', 'img', 'og-cover.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFeeds({
    cwd: path.resolve(import.meta.dirname, '..'),
    dataDir,
    outDir,
    baseUrl: 'https://example.com/llm-pulse/',
  });
  const xmlWithImage = await fs.readFile(path.join(outDir, 'feed.xml'), 'utf8');
  const jsonWithImage = JSON.parse(await fs.readFile(path.join(outDir, 'feed.json'), 'utf8'));
  assert.ok(xmlWithImage.includes('<image>'));
  assert.ok(xmlWithImage.includes('<url>https://example.com/llm-pulse/assets/img/og-cover.png</url>'));
  assert.equal(jsonWithImage.icon, 'https://example.com/llm-pulse/assets/img/og-cover.png');

  // Clean up test artifacts
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.rm(dataDir, { recursive: true, force: true });
});
