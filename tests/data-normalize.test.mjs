/**
 * Data-side test 1: normalize.mjs pure functions (fixtures + fixed now value, no network, no side effects).
 * Run: node --test tests/data-normalize.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  slugify, clampText, shortHash, pricePerMillion, fmtMoney, fmtTokens, plainText, decodeEntities,
  upgradeExternalUrl, hostnameOf, HTTPS_KNOWN_HOSTS,
  parseCsv, csvToObjects, toIsoDateTime, toIsoDateOnly,
  normalizeOpenRouterModels, buildNewsFromModels,
  parseRssItems, normalizeRssNews, classifyKind,
  normalizeLiveBench, prettifyModelName,
  parseAaInitialData, normalizeAaRankings, parseAaLeaderboardModels, normalizeAaLeaderboard,
  normalizeLmarenaRows, normalizeOpenCompassArena, normalizeEpochEci,
  normalizeGithubProjects, buildDerivedRankings, assembleData, dedupeNews, normalizeDeepseekUpdates,
  normalizeGithubReleases, normalizeHnTopics, extractHnDiscussionSummary, isAiRelatedTopic, HN_TOPIC_LIMIT,
} from '../scripts/normalize.mjs';

const NOW = '2026-11-03T12:00:00.000Z';
const fx = (name) => readFileSync(new URL(`../scripts/fixtures/${name}`, import.meta.url), 'utf8');
const fxJson = (name) => JSON.parse(fx(name));
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---------------------------------------------------------------------------
test('通用工具：slug / clamp / hash / 价格 / token 格式', () => {
  assert.equal(slugify('Z.ai: GLM-5.3 FlashX Legal'), 'z-ai-glm-5-3-flashx-legal');
  assert.equal(slugify('openai/gpt-6.1'), 'openai-gpt-6-1');
  assert.equal(clampText('a'.repeat(300), 240).length, 240);
  assert.ok(clampText('a'.repeat(300), 240).endsWith('…'));
  assert.equal(shortHash('abc'), shortHash('abc'));
  assert.notEqual(shortHash('abc'), shortHash('abd'));
  assert.equal(pricePerMillion('0.00000037'), 0.37);
  assert.equal(pricePerMillion('0.000001'), 1);
  assert.equal(pricePerMillion('bad'), null);
  assert.equal(pricePerMillion(undefined), null);
  assert.equal(fmtMoney(0), '免费');
  assert.equal(fmtMoney(1), '$1');
  assert.equal(fmtMoney(0.37), '$0.37');
  assert.equal(fmtTokens(1048576), '1M');
  assert.equal(fmtTokens(131072), '131K');
  assert.equal(toIsoDateOnly(1792992000), '2026-10-26');
  assert.ok(ISO_RE.test(toIsoDateTime('Tue, 23 Sep 2025 04:00:00 +0800')));
});

test('plainText：去标签 + 解实体 + 防双重编码 HTML 泄漏', () => {
  assert.equal(plainText('<b>Hello</b>   world'), 'Hello world');
  assert.equal(plainText('&lt;img src="https://x/y.png"&gt;Here are updates'), 'Here are updates');
  assert.equal(plainText('A &amp; B'), 'A & B');
  const raw = '<p>Hi</p>&lt;img src="x"&gt;<b>там</b>  ';
  const cleaned = plainText(raw, 240);
  assert.ok(!cleaned.includes('<') && !cleaned.includes('&lt;'), `未清洗干净: ${cleaned}`);
  assert.ok(cleaned.length <= 240);
});

test('CSV 解析：引号、逗号、CRLF', () => {
  const rows = parseCsv('a,b\n"x,1","hi ""q"""\r\n2,3\n');
  assert.deepEqual(rows[0], ['a', 'b']);
  assert.deepEqual(rows[1], ['x,1', 'hi "q"']);
  assert.deepEqual(rows[2], ['2', '3']);
  const objs = csvToObjects('model,score\nm1,1.5\nm2,n/a\n');
  assert.equal(objs.length, 2);
  assert.equal(objs[0].score, '1.5');
});

// ---------------------------------------------------------------------------
test('OpenRouter 模型归一化：字段/排序/价格换算/能力推断', () => {
  const models = normalizeOpenRouterModels(fxJson('openrouter-sample.json'));
  assert.equal(models.length, 3);
  const ids = models.map((m) => m.id);
  assert.deepEqual(ids, [...ids].sort(), 'models 必须按 id 升序');
  assert.equal(new Set(ids).size, ids.length, 'id 不能重复');

  const gpt = models.find((m) => m.id === 'openai/gpt-6.1-terra-pro');
  assert.equal(gpt.org, 'OpenAI');
  assert.equal(gpt.releaseDate, '2026-10-26');
  assert.equal(gpt.contextWindow, 1050000);
  assert.equal(gpt.maxOutput, 131072);
  assert.deepEqual(gpt.modalities, ['text', 'image'], 'file 模态应被忽略');
  assert.ok(gpt.capabilities.includes('tool-calling'));
  assert.ok(gpt.capabilities.includes('reasoning'));
  assert.ok(gpt.capabilities.includes('structured-output'));
  assert.equal(gpt.openWeights, false);
  assert.deepEqual(gpt.pricing, { input: 1, output: 5, currency: 'USD', unit: 'per_1m_tokens' });
  assert.ok(gpt.links.api.startsWith('https://openrouter.ai/'));
  assert.ok(!gpt.description || gpt.description.length <= 120);

  const glm = models.find((m) => m.id === 'z-ai/glm-5.3-flashx');
  assert.equal(glm.openWeights, true, '有 hugging_face_id 视为开放权重');
  assert.ok(glm.links.hf.startsWith('https://huggingface.co/'));
  assert.deepEqual(glm.modalities, ['text', 'image', 'video']);

  const llama = models.find((m) => m.id === 'meta-llama/llama-5-8b');
  assert.deepEqual(llama.pricing, { input: 0, output: 0, currency: 'USD', unit: 'per_1m_tokens' });
});

test('OpenRouter 模型 → 发布动态：稳定 id、纯文本摘要、确定输出', () => {
  const models = normalizeOpenRouterModels(fxJson('openrouter-sample.json'));
  const news = buildNewsFromModels(models, { now: NOW, days: 10_000, maxItems: 30 });
  assert.ok(news.length >= 3);
  for (const n of news) {
    assert.match(n.id, /^release-[a-z0-9-]+$/);
    assert.ok(ISO_RE.test(n.publishedAt));
    assert.ok(n.title.length > 0 && n.summary.length <= 240);
    assert.ok(!n.summary.includes('<'));
    assert.ok(n.models.length === 1 && models.some((m) => m.id === n.models[0]));
    assert.ok([1, 2, 3].includes(n.importance));
    assert.equal(n.lang, 'zh');
    assert.equal(n.kind, 'release');
  }
  const again = buildNewsFromModels(models, { now: NOW, days: 10_000, maxItems: 30 });
  assert.deepEqual(news, again, '给定同一输入与 now，输出必须完全一致');
});

// ---------------------------------------------------------------------------
test('M3 decodeEntities: out-of-range / surrogate numeric entities never throw', () => {
  assert.equal(decodeEntities('&#x27;'), "'");
  assert.equal(decodeEntities('&#x1F600;'), '\u{1F600}');
  assert.equal(decodeEntities('&amp;'), '&');
  assert.equal(decodeEntities('&unknown;'), '&unknown;');
  // > 0x10FFFF -> preserved as-is
  assert.equal(decodeEntities('&#1114112;'), '&#1114112;');
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;');
  // surrogate range -> preserved
  assert.equal(decodeEntities('&#xD800;'), '&#xD800;');
  assert.equal(decodeEntities('&#55296;'), '&#55296;');
  // zero / negative-ish -> preserved
  assert.equal(decodeEntities('&#0;'), '&#0;');
  // hostile huge values must not throw
  assert.doesNotThrow(() => decodeEntities('&#9999999999999999999;'));
  assert.equal(decodeEntities('&#9999999999999999999;'), '&#9999999999999999999;');
});

test('M4 external URL hygiene: safe http->https upgrade only, unknown kept', () => {
  // Same-host HTTPS feed is evidence -> upgrade
  assert.equal(
    upgradeExternalUrl('http://bair.berkeley.edu/blog/post-1', { pageUrl: 'https://bair.berkeley.edu/blog/feed.xml' }),
    'https://bair.berkeley.edu/blog/post-1'
  );
  // Allowlisted hosts -> upgrade even without page context
  assert.ok(HTTPS_KNOWN_HOSTS.has('bair.berkeley.edu'));
  assert.equal(upgradeExternalUrl('http://bair.berkeley.edu/blog/post-1'), 'https://bair.berkeley.edu/blog/post-1');
  // Unknown hosts stay http:// (caller records a warning)
  assert.equal(upgradeExternalUrl('http://http-only.example/a'), 'http://http-only.example/a');
  // Already https / non-http / empty stay untouched
  assert.equal(upgradeExternalUrl('https://ok.example/a'), 'https://ok.example/a');
  assert.equal(upgradeExternalUrl('javascript:alert(1)'), 'javascript:alert(1)');
  assert.equal(upgradeExternalUrl(null), null);
  assert.equal(hostnameOf('https://BAIR.berkeley.edu/x'), 'bair.berkeley.edu');
  assert.equal(hostnameOf('javascript:alert(1)'), null);
  // RSS: item http link on the same host as an https feed is upgraded at normalize time
  const xml = '<rss><channel><item><title>BAIR post</title><link>http://bair.berkeley.edu/blog/post-2</link>'
    + '<pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate><description>some text</description></item></channel></rss>';
  const news = normalizeRssNews(xml, { sourceName: 'Berkeley BAIR', sourceKey: 'rss-bair', feedUrl: 'https://bair.berkeley.edu/blog/feed.xml', now: NOW });
  assert.equal(news.length, 1);
  assert.equal(news[0].url, 'https://bair.berkeley.edu/blog/post-2');
});

test('M4 assembleData: http links upgraded or surfaced in meta.linkWarnings', () => {
  const mk = (id, url) => ({
    schemaVersion: 0,
    news: [{ id, title: 't', summary: 's', kind: 'release', sourceName: 'Src', sourceUrl: 'https://bair.berkeley.edu/blog/feed.xml', url, publishedAt: NOW, tags: [], models: [], importance: 1, lang: 'en' }],
    models: [], boards: [], resources: [], projects: [], topics: [],
  });
  const sources = [{ id: 'x', name: 'X', url: 'https://example.com', type: 'api', status: 'ok', lastFetchedAt: NOW, items: 1, note: null }];
  const safe = assembleData({ mode: 'local', now: NOW, sources, collections: mk('a', 'http://bair.berkeley.edu/blog/safe'), highlights: [] });
  assert.equal(safe.files.news.items[0].url, 'https://bair.berkeley.edu/blog/safe');
  assert.equal(safe.files.meta.linkWarnings, undefined);
  assert.deepEqual(safe.linkWarnings, []);
  const unknown = assembleData({ mode: 'local', now: NOW, sources, collections: mk('b', 'http://http-only.example/x'), highlights: [] });
  assert.equal(unknown.files.news.items[0].url, 'http://http-only.example/x');
  assert.ok(unknown.files.meta.linkWarnings.some((w) => w.includes('http-only.example')));
  assert.ok(unknown.linkWarnings.some((w) => w.includes('http-only.example')));
});

test('RSS：解析/时间过滤/HTML 清洗/粗分类', () => {
  const items = parseRssItems(fx('rss-sample.xml'));
  assert.equal(items.length, 3);
  const news = normalizeRssNews(fx('rss-sample.xml'), { sourceName: 'OpenAI Blog', sourceKey: 'rss-openai', feedUrl: 'https://openai.com/news/rss.xml', now: NOW });
  // The 2025-12-28 item falls outside the 120-day window and is filtered out
  assert.equal(news.length, 2);
  for (const n of news) {
    assert.ok(!/[<>]/.test(n.title + n.summary), 'title/summary 不能含 HTML');
    assert.ok(ISO_RE.test(n.publishedAt));
    assert.ok(['zh', 'en'].includes(n.lang));
    assert.ok(n.url.startsWith('http'));
    assert.ok(n.summary.length <= 240);
  }
  assert.equal(news.find((n) => /GPT-6.1/.test(n.title)).kind, 'release');
  assert.equal(news.find((n) => /research paper/i.test(n.title)).kind, 'research');
  assert.equal(classifyKind('Preparing our next security sprint'), 'policy');
  assert.equal(classifyKind('Introducing Gemini 4 Argon'), 'release');
  assert.equal(classifyKind('A new benchmark for agents'), 'benchmark');
  assert.equal(classifyKind('Open weights release for Llama 5'), 'oss');
});

// ---------------------------------------------------------------------------
test('LiveBench 2.0：官方权重复算 Overall、缺赛道的行不参与排名', () => {
  const board = normalizeLiveBench({
    tableCsv: fx('livebench-sample.csv'),
    categoriesJson: fx('livebench-categories.json'),
    tableUpdatedAt: '2026-10-25T00:00:00.000Z',
  });
  assert.ok(board);
  assert.equal(board.id, 'livebench-2.0');
  assert.equal(board.entries.length, 3, 'glm 缺 research 分数应被排除');
  board.entries.forEach((e, i) => {
    assert.equal(e.rank, i + 1);
    assert.ok(Number.isFinite(e.score));
    assert.ok(e.org.length > 0);
  });
  assert.equal(board.entries[0].model, 'GPT-6.1 Terra');
  assert.equal(board.entries[0].org, 'OpenAI');
  // Hand-calculated: (88.4*2 + 95.2 + 98.1*1.5 + 91.0 + 84.2 + 85.5 + 90.1*1.5) / 9
  const expected = (88.4 * 2 + 95.2 + 98.1 * 1.5 + 91 + 84.2 + 85.5 + 90.1 * 1.5) / 9;
  assert.ok(Math.abs(board.entries[0].score - expected) < 0.01, `Overall 计算错误: ${board.entries[0].score} vs ${expected}`);
  assert.equal(prettifyModelName('glm-5.3-flashx'), 'GLM-5.3 FlashX');
  assert.equal(prettifyModelName('claude-fable-5.1'), 'Claude Fable 5.1');
});

// ---------------------------------------------------------------------------
test('Artificial Analysis：内嵌 flight 数据解析 + 智能指数榜', () => {
  const raw = parseAaInitialData(fx('aa-sample.html'));
  assert.equal(raw.length, 3);
  const board = normalizeAaRankings(raw, { updatedAt: NOW });
  assert.equal(board.entries.length, 3);
  assert.equal(board.entries[0].model, 'Gemini 4 Carbon');
  assert.equal(board.entries[0].org, 'Google');
  assert.ok(board.metric.higherIsBetter);
  assert.ok(board.entries.every((e, i) => e.rank === i + 1));

  // Full leaderboard initialModels (models without intelligenceIndex should be filtered out)
  const full = parseAaLeaderboardModels(fx('aa-leaderboards-sample.html'));
  assert.equal(full.length, 3);
  const fullBoard = normalizeAaLeaderboard(full, { updatedAt: NOW });
  const dated = normalizeAaLeaderboard([{ name: 'Dated Model', intelligenceIndex: 50, releaseDate: '2026-10-28' }], { updatedAt: NOW });
  assert.equal(dated.entries[0].releaseDate, '2026-10-28');
  assert.equal(fullBoard.entries.length, 2);
  assert.equal(fullBoard.entries[0].model, 'Claude Opus 5.5');
  assert.equal(fullBoard.entries[0].org, 'Anthropic');
  assert.match(fullBoard.description, /全量/);
});

test('LMArena：datasets-server rows → 榜单（CI 路径）', () => {
  const board = normalizeLmarenaRows(fxJson('lmarena-rows-sample.json'), { updatedAt: NOW });
  assert.ok(board);
  assert.equal(board.id, 'lmarena-text');
  assert.equal(board.entries.length, 3);
  assert.equal(board.entries[0].model, 'GPT-6.1 Terra Pro');
  assert.equal(board.entries[0].votes, 31200);
  assert.ok(board.entries.every((e, i) => e.rank === i + 1 && Number.isFinite(e.score)));
});

test('OpenCompass Arena：官方 API 响应 → 榜单', () => {
  const board = normalizeOpenCompassArena(fxJson('opencompass-sample.json'));
  assert.ok(board);
  assert.equal(board.entries.length, 3);
  assert.equal(board.entries[0].model, 'MiMo-V2.5-Pro');
  assert.equal(board.updatedAt, '2026-06-12T00:00:00.000Z');
  assert.ok(board.entries.every((e, i) => e.rank === i + 1));
});

test('Epoch ECI：官方 CSV → 榜单', () => {
  const board = normalizeEpochEci(fx('epoch-eci-sample.csv'));
  assert.ok(board);
  assert.equal(board.entries.length, 3);
  assert.equal(board.entries[0].model, 'GPT-6 Astra');
  assert.equal(board.entries[0].org, 'OpenAI');
  assert.ok(Math.abs(board.entries[2].score - 168.11) < 1e-9);
});

test('GitHub Releases → 开源工具动态（draft/过旧窗口过滤）', () => {
  const items = normalizeGithubReleases(fxJson('github-releases-sample.json'), { now: NOW });
  assert.equal(items.length, 2, 'draft 与 90 天外条目应被过滤');
  const keys = items.map((n) => n.id).join(',');
  assert.match(keys, /v5-2-0/);
  assert.match(keys, /v0-9-0/);
  for (const n of items) {
    assert.equal(n.kind, 'oss');
    assert.ok(ISO_RE.test(n.publishedAt));
    assert.ok(n.summary.length <= 240 && !/<[a-z]/i.test(n.summary), 'summary 应为纯文本');
    assert.match(n.url, /^https:\/\/github\.com\//);
    assert.ok(n.id.startsWith('github-release-'));
    assert.ok([1, 2, 3].includes(n.importance));
  }
  assert.equal(items[0].publishedAt.slice(0, 10), '2026-11-01', '按发布时间倒序');
});

test('DeepSeek Change Log HTML → 中文厂商动态', () => {
  const items = normalizeDeepseekUpdates(fx('deepseek-updates-sample.html'), { now: NOW });
  assert.ok(items.length >= 4, `解析条目 ${items.length} 条`);
  const ids = new Set();
  for (const n of items) {
    assert.ok(!ids.has(n.id), `id 重复: ${n.id}`);
    ids.add(n.id);
    assert.ok(ISO_RE.test(n.publishedAt), `publishedAt: ${n.id}`);
    assert.ok(n.title.startsWith('DeepSeek 官方更新'), `标题应以 DeepSeek 开头: ${n.title}`);
    assert.ok(n.summary.length <= 240 && !/<\/?[a-z]/i.test(n.summary), 'summary 应为纯文本且 ≤240');
    assert.equal(n.kind, 'release');
    assert.equal(n.lang, 'zh');
    assert.ok([1, 2, 3].includes(n.importance));
    assert.equal(n.sourceName, 'DeepSeek');
    assert.match(n.url, /^https:\/\/api-docs\.deepseek\.com\/updates/);
  }
  // Newest first
  const times = items.map((n) => Date.parse(n.publishedAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

// ---------------------------------------------------------------------------
test('GitHub 项目刷新：stars/license/更新时间 + 缺失回退 + 排序', () => {
  const curated = [
    { id: 'b', name: 'B', owner: 'o', repo: 'o/b', summary: 's', tags: [], sourceType: 'community', highlight: null, why: null, license: null, stars: 1, url: 'https://github.com/o/b' },
    { id: 'a', name: 'A', owner: 'o', repo: 'o/a', summary: 's', tags: [], sourceType: 'community', highlight: null, why: null, license: 'MIT', stars: null, url: 'https://github.com/o/a' },
  ];
  const items = normalizeGithubProjects(curated, {
    'o/b': { full_name: 'o/b', html_url: 'https://github.com/o/b', stargazers_count: 999, pushed_at: '2026-11-02T00:00:00Z', license: { spdx_id: 'Apache-2.0' } },
  }, { now: NOW });
  assert.equal(items[0].id, 'b');
  assert.equal(items[0].stars, 999);
  assert.equal(items[0].license, 'Apache-2.0');
  assert.equal(items[0].updatedAt, '2026-11-02T00:00:00.000Z');
  assert.equal(items[1].stars, null, '无 repo 数据时 stars 为 null');
  assert.equal(items[1].license, 'MIT', 'license 回退人工清单值');
});

test('派生榜：上下文窗口降序 / 输出价格升序 / 标注非质量排名', () => {
  const models = normalizeOpenRouterModels(fxJson('openrouter-sample.json'));
  const boards = buildDerivedRankings(models, { now: NOW, topN: 10 });
  assert.equal(boards.length, 2);
  const ctx = boards.find((b) => b.id === 'context-window');
  const price = boards.find((b) => b.id === 'output-price');
  assert.equal(ctx.entries[0].score, 1050000);
  assert.ok(ctx.entries.every((e, i) => e.rank === i + 1));
  assert.equal(ctx.metric.higherIsBetter, true);
  assert.equal(price.metric.higherIsBetter, false);
  assert.ok(price.entries[0].score <= price.entries[1].score);
  assert.ok(ctx.description.includes('非质量排名'));
});

// ---------------------------------------------------------------------------
test('总装 assembleData：合约字段、统计一致、快照重放确定', () => {
  const models = normalizeOpenRouterModels(fxJson('openrouter-sample.json'));
  const news = buildNewsFromModels(models, { now: NOW, days: 10_000 });
  const boards = buildDerivedRankings(models, { now: NOW });
  const sources = [
    { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/models', type: 'api', status: 'ok', lastFetchedAt: NOW, items: models.length, note: null },
    { id: 'lmarena', name: 'LMArena', url: 'https://lmarena.ai/leaderboard', type: 'dataset', status: 'blocked', lastFetchedAt: null, items: null, note: 'CI only' },
  ];
  const { files, stats } = assembleData({
    mode: 'local',
    now: NOW,
    sources,
    collections: {
      models, news, boards,
      resources: [{ id: 'r1', title: 'T', type: 'course', level: 'beginner', lang: 'en', url: 'https://example.com', author: 'A', description: 'd', tags: [], free: true, featured: false }],
      projects: [{ id: 'p1', name: 'P', owner: 'o', url: 'https://github.com/o/p', repo: 'o/p', summary: 's', tags: [], highlight: null, sourceType: 'community', license: 'MIT', stars: 1, updatedAt: NOW, why: null }],
      topics: [
        { id: 'hn-1', title: 'AI topic', url: 'https://example.com/a', hnUrl: 'https://news.ycombinator.com/item?id=1', domain: 'example.com', points: 100, comments: 5, publishedAt: NOW, summary: 'discussion', source: 'Hacker News', tags: ['AI'] },
        { id: 'hn-2', title: 'AI topic 2', url: null, hnUrl: 'https://news.ycombinator.com/item?id=2', domain: null, points: 50, comments: 1, publishedAt: NOW, summary: 'discussion 2', source: 'Hacker News', tags: ['AI'] },
      ],
    },
    highlights: ['h1'],
  });
  for (const [name, file] of Object.entries(files)) {
    assert.equal(file.schemaVersion, 1, `${name}.schemaVersion`);
    assert.ok(ISO_RE.test(file.generatedAt), `${name}.generatedAt`);
    assert.ok(typeof file.source === 'string' && file.source.length > 0, `${name}.source`);
  }
  assert.equal(files.meta.source, 'fetch-pipeline:local');
  assert.equal(files.meta.stats.models, models.length);
  assert.equal(files.meta.stats.news, news.length);
  assert.equal(files.meta.stats.boards, boards.length);
  assert.equal(files.meta.stats.topics, 2);
  assert.equal(files.meta.stats.sourcesOk, 1);
  assert.equal(files.meta.sources.length, 2);
  assert.equal(files.models.count, models.length);
  assert.equal(files.topics.count, 2);
  assert.equal(files.topics.items[0].id, 'hn-1', 'topics sorted by points desc');
  assert.equal(files.topics.items[1].id, 'hn-2');
  // Two independent assemblies (same input) -> byte-identical JSON
  const again = assembleData({ mode: 'local', now: NOW, sources, collections: { models, news, boards, resources: files.resources.items, projects: files.projects.items, topics: files.topics.items }, highlights: ['h1'] });
  assert.equal(JSON.stringify(again.files), JSON.stringify(files));
});

test('Hacker News AI hot topics: AI filter / points sort / url fallback / summary', () => {
  const payload = fxJson('hn-sample.json');
  const summaries = { 'hn-50305693': { summary: 'I wanted to use this post as a source & write about debuggable infrastructure.' } };
  const topics = normalizeHnTopics(payload, { now: NOW, summaries });
  // AI-related + points >= 30: 680 / 543 / 341 / 120 (bike repair is non-AI, 12-point link is below threshold)
  assert.equal(topics.length, 4);
  assert.deepEqual(topics.map((t) => t.points), [680, 543, 341, 120]);
  const top = topics[0];
  assert.equal(top.id, 'hn-50305693');
  assert.equal(top.url, 'https://newsletter.signoz.io/p/ai-isnt-replacing-sres-its-deskilling');
  assert.equal(top.hnUrl, 'https://news.ycombinator.com/item?id=50305693');
  assert.equal(top.domain, 'newsletter.signoz.io');
  assert.equal(top.comments, 501);
  assert.equal(top.source, 'Hacker News');
  assert.ok(ISO_RE.test(top.publishedAt));
  assert.ok(top.summary.length <= 160 && !/[<>]/.test(top.summary));
  assert.equal(top.summary, summaries['hn-50305693'].summary);
  assert.ok(top.tags.includes('AI'));
  // Missing source URL -> url null, front-end falls back to hnUrl (contract allows)
  const noUrl = topics.find((t) => t.id === 'hn-50388888');
  assert.equal(noUrl.url, null);
  assert.equal(noUrl.domain, null);
  assert.ok(noUrl.summary.includes('Hacker News'));
  // Deterministic output + limit
  assert.deepEqual(normalizeHnTopics(payload, { now: NOW, summaries }), topics);
  assert.equal(normalizeHnTopics(payload, { now: NOW, summaries, limit: 2 }).length, 2);
  assert.equal(normalizeHnTopics(payload, { now: NOW, summaries, limit: 2 })[0].id, 'hn-50305693');
  // isAiRelatedTopic sanity
  assert.equal(isAiRelatedTopic({ title: 'How to fix a bicycle derailleur', url: 'https://example.com/bike' }), false);
  assert.equal(isAiRelatedTopic({ title: 'A tiny GPU inference trick', url: null }), true);
  assert.ok(HN_TOPIC_LIMIT >= 8);
});

test('HN discussion summary extraction: first substantive comment + HTML cleaning', () => {
  const item = fxJson('hn-item-sample.json');
  const extracted = extractHnDiscussionSummary(item);
  assert.ok(extracted);
  assert.equal(extracted.commentId, 50305750, 'first top-level comment with substantive text wins');
  assert.ok(!/[<>]/.test(extracted.summary), 'summary must be plain text');
  assert.ok(!/alert|script/i.test(extracted.summary), 'script content must be stripped');
  assert.ok(extracted.summary.includes('&'), 'HTML entities must be decoded');
  assert.ok(extracted.summary.length <= 160);
  // Nested fallback when no top-level comment has text
  const nested = { children: [{ text: null, children: [{ id: 9, text: 'A nested reply that is long enough to be used as the discussion summary.' }] }] };
  assert.equal(extractHnDiscussionSummary(nested).commentId, 9);
  // No text at all -> null
  assert.equal(extractHnDiscussionSummary({ children: [] }), null);
  // Prefer numeric points when present among first five comments
  const scored = {
    children: [
      { id: 1, text: 'First comment with plenty of text to qualify as substantive.', points: 1 },
      { id: 2, text: 'Second comment also long enough to become the winning candidate.', points: 99 },
    ],
  };
  assert.equal(extractHnDiscussionSummary(scored).commentId, 2);
});

test('dedupeNews：去重 + 按时间倒序 + 纯文本兜底', () => {
  const items = [
    { id: 'a', title: '<b>old</b>', summary: '&lt;img src="x"&gt;x', publishedAt: '2026-10-01T00:00:00.000Z' },
    { id: 'b', title: 'new', summary: 'y', publishedAt: '2026-11-01T00:00:00.000Z' },
    { id: 'a', title: 'dup', summary: 'dup', publishedAt: '2026-10-01T00:00:00.000Z' },
  ];
  const out = dedupeNews(items);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'b');
  assert.ok(!/[<>]/.test(out[1].title + out[1].summary));
});
