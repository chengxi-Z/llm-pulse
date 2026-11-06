/**
 * Data-side test 2: self-check the generated artifacts against DATA-CONTRACT v1 §8
 * (independent implementation, does not depend on the Lead's validate.mjs).
 * Run: node --test tests/data-contract.test.mjs
 * Automatically skipped when the data files are missing (useful for environments that
 * only run the normalize tests).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const DATA = new URL('../data/', import.meta.url);
const FILES = ['meta', 'models', 'news', 'rankings', 'resources', 'projects'];
const load = (name) => {
  const p = new URL(`${name}.json`, DATA);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
};
const data = Object.fromEntries(FILES.map((f) => [f, load(f)]));
const missing = FILES.filter((f) => !data[f]);
const isIso = (s) => typeof s === 'string' && Number.isFinite(Date.parse(s));
const isStr = (s) => typeof s === 'string' && s.trim().length > 0;
const hasHtml = (s) => /<\/?[a-z][^>]*>/i.test(String(s || ''));

test('六个数据文件存在且 JSON 可解析（无数据时跳过）', (t) => {
  if (missing.length) return t.skip(`缺少 ${missing.join(',')}（尚未运行 fetch-data）`);
  for (const f of FILES) assert.equal(data[f].schemaVersion, 1, `${f}.schemaVersion`);
  for (const f of FILES) {
    assert.ok(isIso(data[f].generatedAt), `${f}.generatedAt 应为 ISO`);
    assert.ok(isStr(data[f].source), `${f}.source 缺失`);
  }
});

test('meta：mode/site/sources/stats 合规且与产物数量一致', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const m = data.meta;
  assert.ok(['local', 'ci', 'seed'].includes(m.mode), 'mode 枚举');
  assert.ok(isStr(m.site?.name) && isStr(m.site?.brand));
  assert.ok(Array.isArray(m.sources) && m.sources.length > 0);
  for (const s of m.sources) {
    assert.ok(isStr(s.id) && isStr(s.name), 'source id/name');
    assert.ok(['api', 'dataset', 'rss', 'html'].includes(s.type), `source ${s.id} type`);
    assert.ok(['ok', 'degraded', 'blocked'].includes(s.status), `source ${s.id} status`);
    if (s.status === 'ok') assert.ok(isStr(s.lastFetchedAt) && isIso(s.lastFetchedAt), `source ${s.id} lastFetchedAt`);
  }
  assert.equal(m.stats.models, data.models?.models?.length);
  assert.equal(m.stats.news, data.news?.items?.length);
  assert.equal(m.stats.boards, data.rankings?.boards?.length);
  assert.equal(m.stats.resources, data.resources?.items?.length);
  assert.equal(m.stats.projects, data.projects?.items?.length);
  assert.ok(Array.isArray(m.latestHighlights) && m.latestHighlights.length <= 3);
  const ageMin = (Date.now() - Date.parse(m.generatedAt)) / 60000;
  assert.ok(ageMin < 8 * 24 * 60, `数据超过 8 天未更新（${ageMin.toFixed(0)}min）`);
  assert.ok(ageMin > -5, 'generatedAt 不应晚于当前时间 5 分钟以上');
});

test('models：数量 / 唯一 id / 字段 / 枚举 / pricing 结构', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const arr = data.models.models;
  assert.ok(arr.length >= 50, `模型数量 ${arr.length} < 50`);
  assert.equal(data.models.count, arr.length);
  const ids = new Set();
  for (const m of arr) {
    assert.ok(isStr(m.id), 'id');
    assert.ok(!ids.has(m.id), `id 重复: ${m.id}`);
    ids.add(m.id);
    assert.ok(isStr(m.name) && isStr(m.org), `name/org: ${m.id}`);
    if (m.releaseDate !== null) assert.match(m.releaseDate, /^\d{4}-\d{2}-\d{2}$/, `releaseDate: ${m.id}`);
    if (m.contextWindow !== null) assert.ok(Number.isInteger(m.contextWindow) && m.contextWindow > 0, `contextWindow: ${m.id}`);
    if (m.maxOutput !== null) assert.ok(Number.isInteger(m.maxOutput) && m.maxOutput > 0, `maxOutput: ${m.id}`);
    assert.ok(Array.isArray(m.modalities) && m.modalities.length > 0, `modalities: ${m.id}`);
    for (const mod of m.modalities) assert.ok(['text', 'image', 'audio', 'video'].includes(mod), `modality ${mod}: ${m.id}`);
    assert.ok(Array.isArray(m.capabilities), `capabilities: ${m.id}`);
    assert.equal(typeof m.openWeights, 'boolean', `openWeights: ${m.id}`);
    if (m.pricing !== null) {
      assert.ok(typeof m.pricing === 'object');
      assert.ok(m.pricing.input === null || Number.isFinite(m.pricing.input), `pricing.input: ${m.id}`);
      assert.ok(m.pricing.output === null || Number.isFinite(m.pricing.output), `pricing.output: ${m.id}`);
      assert.equal(m.pricing.currency, 'USD');
      assert.equal(m.pricing.unit, 'per_1m_tokens');
      for (const v of [m.pricing.input, m.pricing.output]) if (v !== null) assert.ok(v >= 0, `pricing 非负: ${m.id}`);
    }
    if (m.links) for (const [k, v] of Object.entries(m.links)) {
      if (v !== null && v !== undefined) assert.match(v, /^https?:\/\//, `links.${k}: ${m.id}`);
    }
  }
});

test('news：数量 / 唯一 id / 枚举 / 纯文本 / 引用一致性', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const items = data.news.items;
  assert.ok(items.length >= 5, `news ${items.length} < 5`);
  const modelIds = new Set((data.models?.models || []).map((m) => m.id));
  const ids = new Set();
  for (const n of items) {
    assert.ok(isStr(n.id) && !ids.has(n.id), `news id: ${n.id}`);
    ids.add(n.id);
    assert.ok(isStr(n.title) && isStr(n.summary) && isStr(n.sourceName) && isStr(n.url), `必填字段: ${n.id}`);
    assert.ok(['release', 'benchmark', 'oss', 'pricing', 'research', 'policy'].includes(n.kind), `kind: ${n.id}`);
    assert.ok(isIso(n.publishedAt), `publishedAt: ${n.id}`);
    assert.ok([1, 2, 3].includes(n.importance), `importance: ${n.id}`);
    assert.ok(['zh', 'en'].includes(n.lang), `lang: ${n.id}`);
    assert.ok(Array.isArray(n.tags) && Array.isArray(n.models), `tags/models: ${n.id}`);
    assert.match(n.url, /^https?:\/\//, `url: ${n.id}`);
    assert.ok(!hasHtml(n.title), `title 含 HTML: ${n.id}`);
    assert.ok(!hasHtml(n.summary), `summary 含 HTML: ${n.id}`);
    assert.ok(n.summary.length <= 240, `summary 超长: ${n.id}`);
    for (const mid of n.models) assert.ok(modelIds.has(mid), `news 引用不存在模型 ${mid}: ${n.id}`);
  }
  // Newest first
  const times = items.map((n) => Date.parse(n.publishedAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), 'news 应按 publishedAt 倒序');
});

test('rankings：榜单结构 / 连续 rank / 分数 / 来源 URL', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const boards = data.rankings.boards;
  assert.ok(Array.isArray(boards));
  const ids = new Set();
  for (const b of boards) {
    assert.ok(isStr(b.id) && !ids.has(b.id), `board id: ${b.id}`);
    ids.add(b.id);
    assert.ok(isStr(b.name) && isStr(b.description) && isStr(b.sourceName), `board 字段: ${b.id}`);
    assert.match(b.sourceUrl, /^https?:\/\//, `sourceUrl: ${b.id}`);
    assert.ok(isIso(b.updatedAt), `updatedAt: ${b.id}`);
    assert.ok(isStr(b.metric?.name) && isStr(b.metric?.unit), `metric: ${b.id}`);
    assert.equal(typeof b.metric.higherIsBetter, 'boolean', `higherIsBetter: ${b.id}`);
    assert.ok(Array.isArray(b.entries) && b.entries.length >= 1, `entries: ${b.id}`);
    b.entries.forEach((e, i) => {
      assert.equal(e.rank, i + 1, `rank 连续: ${b.id}[${i}]`);
      assert.ok(isStr(e.model) && isStr(e.org), `entry 字段: ${b.id}[${i}]`);
      assert.ok(typeof e.score === 'number' && Number.isFinite(e.score), `score: ${b.id}[${i}]`);
      assert.ok(e.votes === null || e.votes === undefined || typeof e.votes === 'number', `votes: ${b.id}[${i}]`);
    });
  }
});

test('resources：≥10 条 / 枚举 / 唯一 id / url', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const items = data.resources.items;
  assert.ok(items.length >= 10, `resources ${items.length} < 10`);
  const ids = new Set();
  for (const r of items) {
    assert.ok(isStr(r.id) && !ids.has(r.id), `resource id: ${r.id}`);
    ids.add(r.id);
    for (const k of ['title', 'url', 'author', 'description']) assert.ok(isStr(r[k]), `${k}: ${r.id}`);
    assert.match(r.url, /^https?:\/\//, `url: ${r.id}`);
    assert.ok(['course', 'tutorial', 'paper', 'tool', 'awesome', 'video', 'book'].includes(r.type), `type: ${r.id}`);
    assert.ok(['beginner', 'intermediate', 'advanced'].includes(r.level), `level: ${r.id}`);
    assert.ok(['en', 'zh', 'multi'].includes(r.lang), `lang: ${r.id}`);
    assert.equal(typeof r.free, 'boolean');
    assert.equal(typeof r.featured, 'boolean');
    assert.ok(Array.isArray(r.tags));
  }
});

test('projects：≥6 条 / sourceType / repo 格式 / stars 类型', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const items = data.projects.items;
  assert.ok(items.length >= 6, `projects ${items.length} < 6`);
  const ids = new Set();
  for (const p of items) {
    assert.ok(isStr(p.id) && !ids.has(p.id), `project id: ${p.id}`);
    ids.add(p.id);
    for (const k of ['name', 'owner', 'url', 'summary']) assert.ok(isStr(p[k]), `${k}: ${p.id}`);
    assert.match(p.url, /^https?:\/\//, `url: ${p.id}`);
    assert.ok(['self', 'community'].includes(p.sourceType), `sourceType: ${p.id}`);
    if (p.repo !== null && p.repo !== undefined) assert.match(p.repo, /^[\w.-]+\/[\w.-]+$/, `repo: ${p.id}`);
    assert.ok(Array.isArray(p.tags));
    assert.ok(p.stars === null || p.stars === undefined || typeof p.stars === 'number', `stars: ${p.id}`);
  }
});

// Security (M4): generated data must not ship plain http:// external links (unless explicitly
// recorded in meta.linkWarnings) and every link must use an http(s) scheme.
test('安全：外链方案 http(s) 且无未声明的 http:// 外链（M4）', (t) => {
  if (missing.length) return t.skip('数据缺失');
  const warnings = Array.isArray(data.meta.linkWarnings) ? data.meta.linkWarnings : [];
  const allowed = (u) => warnings.some((w) => typeof w === 'string' && w.endsWith(u));
  const offenders = [];
  const check = (path, url) => {
    if (url === null || url === undefined) return;
    if (typeof url !== 'string') { offenders.push(`${path}: non-string url`); return; }
    if (!/^https?:\/\//i.test(url)) { offenders.push(`${path}: scheme ${url.slice(0, 40)}`); return; }
    if (/^http:\/\//i.test(url) && !allowed(url)) offenders.push(`${path}: ${url}`);
  };
  for (const [i, n] of data.news.items.entries()) { check(`news[${i}].url`, n.url); check(`news[${i}].sourceUrl`, n.sourceUrl); }
  for (const [i, m] of (data.models.models || []).entries()) {
    for (const [k, v] of Object.entries(m.links || {})) check(`models[${i}].links.${k}`, v);
  }
  for (const [i, b] of data.rankings.boards.entries()) check(`rankings[${i}].sourceUrl`, b.sourceUrl);
  for (const [i, r] of data.resources.items.entries()) check(`resources[${i}].url`, r.url);
  for (const [i, p] of data.projects.items.entries()) check(`projects[${i}].url`, p.url);
  for (const [i, topic] of (data.topics?.items || []).entries()) { check(`topics[${i}].url`, topic.url); check(`topics[${i}].hnUrl`, topic.hnUrl); }
  for (const [i, s] of (data.meta.sources || []).entries()) check(`meta.sources[${i}].url`, s.url);
  assert.deepEqual(offenders, []);
});
test('topics：真实热榜 schema / count / 排序 / 纯文本摘要', (t) => {
  const topics = load('topics');
  if (!topics) return t.skip('topics.json 缺失');
  assert.equal(topics.schemaVersion, 1);
  assert.ok(isIso(topics.generatedAt), 'topics.generatedAt');
  assert.ok(isStr(topics.source), 'topics.source');
  assert.ok(Array.isArray(topics.items), 'topics.items 应为数组');
  assert.equal(topics.count, topics.items.length, 'count 与数组长度一致');
  assert.ok(topics.items.length <= 20, `topics ${topics.items.length} > 20`);
  const ids = new Set();
  for (const [i, topic] of topics.items.entries()) {
    const tag = `[topics[${i}] ${topic.id ?? '?'}]`;
    for (const k of ['id', 'title', 'source']) assert.ok(isStr(topic[k]), `${tag} ${k} 缺失`);
    assert.ok(!ids.has(topic.id), `${tag} id 重复`);
    ids.add(topic.id);
    assert.match(topic.id, /^hn-\d+$/, `${tag} id 应为 hn-<objectID>`);
    assert.ok(/^https?:\/\//.test(topic.url || topic.hnUrl || ''), `${tag} url/hnUrl 至少一个为 http(s)`);
    if (topic.url !== null && topic.url !== undefined) assert.match(topic.url, /^https?:\/\//, `${tag} url`);
    assert.ok(isIso(topic.publishedAt), `${tag} publishedAt`);
    assert.ok(Number.isInteger(topic.points) && topic.points >= 0, `${tag} points`);
    assert.ok(Number.isInteger(topic.comments) && topic.comments >= 0, `${tag} comments`);
    assert.ok(topic.points >= 30, `${tag} points 应 ≥30（HN 近 7 天 AI 相关）`);
    if (topic.summary !== null && topic.summary !== undefined) {
      assert.ok(isStr(topic.summary) && topic.summary.length <= 240, `${tag} summary 长度/类型`);
      assert.ok(!hasHtml(topic.summary), `${tag} summary 含 HTML`);
      assert.ok(!/&#?[a-z0-9]+;/i.test(topic.summary), `${tag} summary 含未解码实体`);
    }
    assert.ok(Array.isArray(topic.tags), `${tag} tags 应为数组`);
  }
  // stable ordering: points desc, then id asc
  for (let i = 1; i < topics.items.length; i++) {
    const prev = topics.items[i - 1];
    const cur = topics.items[i];
    assert.ok(prev.points > cur.points || (prev.points === cur.points && prev.id < cur.id), `topics 排序应 points desc / id asc @${i}`);
  }
});
