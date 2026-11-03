/**
 * sources.mjs — data-source registry + collectors.
 * Every source declares: id/name/url/type/enabledLocal/enabledCi/collect(ctx).
 * collect returns { items, note, contributions: { models?, news?, boards?, projects? } };
 * thrown errors are handled centrally by fetch-data.mjs (snapshot fallback + meta.sources status).
 *
 * Environment facts (measured 2026-11-03):
 * - Reachable locally: openrouter.ai, api.github.com (60/h), hf-mirror.com, livebench.ai,
 *   epoch.ai, rank.opencompass.org.cn (POST /gw/opencompass-be/...), artificialanalysis.ai
 *   (data embedded in HTML), several official RSS feeds (openai.com / deepmind.google /
 *   blog.google / qwenlm.github.io).
 * - Blocked locally: huggingface.co, lmarena.ai, datasets-server.huggingface.co -> enabled in CI mode only.
 * - All network requests go through Node fetch (http.mjs); PowerShell/curl use schannel and
 *   do not work on this machine.
 */
import {
  normalizeOpenRouterModels, buildNewsFromModels, buildDerivedRankings,
  normalizeLiveBench, parseAaInitialData, normalizeAaRankings, parseAaLeaderboardModels, normalizeAaLeaderboard,
  normalizeLmarenaRows, normalizeRssNews, normalizeOpenCompassArena,
  normalizeEpochEci, normalizeEpochBenchmark, unzip, normalizeGithubProjects, parseRssItems,
  normalizeDeepseekUpdates, normalizeGithubReleases,
  normalizeHnTopics, extractHnDiscussionSummary, HN_TOPIC_LIMIT,
} from '../normalize.mjs';
import { RESOURCES, PROJECTS } from './curated.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';
const LIVEBENCH_BASE = 'https://livebench.ai';
const LIVEBENCH_FALLBACK_RELEASES = ['20261025', '20261014'];
const AA_URL = 'https://artificialanalysis.ai/';
const OPENCOMPASS_API = 'https://rank.opencompass.org.cn/gw/opencompass-be/api/v1/rank/listArenaRankings';
const EPOCH_ZIP = 'https://epoch.ai/data/benchmark_data.zip';

/** Extract the current release list from the LiveBench frontend bundle (e.g. ["20261014","20261025"]) */
export function extractLivebenchReleases(jsText) {
  const arrays = [...String(jsText || '').matchAll(/\[((?:"\d{8}"\s*,?\s*)+)\]/g)].map((m) => [...m[1].matchAll(/\d{8}/g)].map((x) => x[0]));
  const withDates = arrays.filter((a) => a.length >= 1 && a.every((d) => /^20\d{6}$/.test(d)));
  if (!withDates.length) return [];
  const best = withDates.sort((a, b) => b.length - a.length)[0];
  return [...new Set(best)].sort().reverse();
}

async function collectOpenRouter(ctx) {
  const res = await ctx.get(OPENROUTER_URL, { key: 'openrouter-models', ext: 'json', timeoutMs: 30000, retries: 2 });
  const payload = JSON.parse(res.text);
  const models = normalizeOpenRouterModels(payload);
  if (!models.length) throw new Error('OpenRouter 返回 0 个模型');
  const news = buildNewsFromModels(models, { now: ctx.now });
  const boards = buildDerivedRankings(models, { now: ctx.now });
  const orgs = new Set(models.map((m) => m.org)).size;
  return {
    items: models.length,
    note: `${models.length} 个模型 / ${orgs} 家厂商；派生动态 ${news.length} 条、派生榜 ${boards.length} 个`,
    contributions: { models, news, boards },
  };
}

async function collectLiveBench(ctx) {
  // 1) Discover the latest release from the frontend bundle; fall back to the known list on failure
  let releases = [];
  try {
    const home = await ctx.get(`${LIVEBENCH_BASE}/`, { key: 'livebench-home', ext: 'html', timeoutMs: 15000, retries: 1 });
    const m = home.text.match(/static\/js\/main\.([a-f0-9]+)\.js/i);
    if (m) {
      const bundle = await ctx.get(`${LIVEBENCH_BASE}/static/js/main.${m[1]}.js`, { key: 'livebench-main', ext: 'js', timeoutMs: 20000, retries: 1 });
      releases = extractLivebenchReleases(bundle.text);
    }
  } catch (err) {
    ctx.log(`[livebench] release 发现失败，用 fallback: ${err.message}`);
  }
  if (!releases.length) {
    // The bundle snapshot may still be readable during offline replay
    for (const ext of ['js', 'html']) {
      const snap = await ctx.loadSnapshot('livebench-main', ext);
      if (snap) { releases = extractLivebenchReleases(snap.text); if (releases.length) break; }
    }
  }
  if (!releases.length) releases = LIVEBENCH_FALLBACK_RELEASES;
  const errors = [];
  for (const release of releases.slice(0, 3)) {
    try {
      const table = await ctx.get(`${LIVEBENCH_BASE}/data/${release}/table.csv`, { key: 'livebench-table', ext: 'csv', timeoutMs: 20000, retries: 1 });
      const cats = await ctx.get(`${LIVEBENCH_BASE}/data/${release}/categories.json`, { key: 'livebench-categories', ext: 'json', timeoutMs: 20000, retries: 1 });
      const board = normalizeLiveBench({
        tableCsv: table.text,
        categoriesJson: cats.text,
        tableUpdatedAt: `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}T00:00:00.000Z`,
        sourceUrl: `${LIVEBENCH_BASE}/`,
      });
      if (!board) throw new Error('table 无可解析行');
      return {
        items: board.entries.length,
        note: `release ${release}；${board.entries.length} 个模型，Overall 权重本地复算`,
        contributions: { boards: [board] },
      };
    } catch (err) {
      errors.push(`${release}: ${err.message}`);
    }
  }
  throw new Error(`LiveBench 所有 release 均失败（${errors.join('; ')}）`);
}

async function collectArtificialAnalysis(ctx) {
  // Prefer the full initialModels from /leaderboards/models (~150-300 models); fall back to homepage initialData (28 featured)
  let aaModels = [];
  let used = 'homepage';
  try {
    const lb = await ctx.get('https://artificialanalysis.ai/leaderboards/models', { key: 'aa-leaderboards', ext: 'html', timeoutMs: 30000, retries: 1 });
    aaModels = parseAaLeaderboardModels(lb.text);
    if (aaModels.length) used = 'leaderboards';
  } catch (err) {
    ctx.log(`[artificial-analysis] 全量榜单页失败，回退首页：${err.message}`);
  }
  if (!aaModels.length) {
    const home = await ctx.get(AA_URL, { key: 'artificialanalysis-home', ext: 'html', timeoutMs: 30000, retries: 1 });
    aaModels = parseAaInitialData(home.text);
    used = 'homepage';
  }
  const board = used === 'leaderboards'
    ? normalizeAaLeaderboard(aaModels, { updatedAt: ctx.now, sourceUrl: 'https://artificialanalysis.ai/leaderboards/models' })
    : normalizeAaRankings(aaModels, { updatedAt: ctx.now, sourceUrl: AA_URL });
  if (!board) throw new Error('AA 页面未解析到智能指数数据');
  return {
    items: board.entries.length,
    note: used === 'leaderboards'
      ? `全量榜 /leaderboards/models initialModels 解析 ${board.entries.length} 款模型`
      : `首页 initialData 解析 ${board.entries.length} 款模型（默认精选集，非全量目录）`,
    contributions: { boards: [board] },
  };
}

async function collectOpenCompass(ctx) {
  const boards = [];
  const specs = [
    { rankingType: 0, key: 'opencompass-arena-text', id: 'opencompass-arena', name: 'OpenCompass 中文 Arena 榜', description: '司南 OpenCompass Arena 中文盲测对战 Elo 排名（文本模型，官方 API）' },
    { rankingType: 1, key: 'opencompass-arena-mm', id: 'opencompass-arena-mm', name: 'OpenCompass 多模态 Arena 榜', description: '司南 OpenCompass Arena 盲测对战 Elo 排名（多模态赛道，官方 API）' },
  ];
  for (const spec of specs) {
    try {
      const res = await ctx.get(OPENCOMPASS_API, {
        key: spec.key, ext: 'json', timeoutMs: 20000, retries: 1, method: 'POST', json: { rankingType: spec.rankingType },
        headers: { origin: 'https://rank.opencompass.org.cn', referer: 'https://rank.opencompass.org.cn/' },
      });
      const board = normalizeOpenCompassArena(JSON.parse(res.text), {
        id: spec.id, name: spec.name, description: spec.description,
        sourceUrl: 'https://rank.opencompass.org.cn/arena',
      });
      if (board) boards.push(board);
    } catch (err) {
      ctx.log(`[opencompass] rankingType=${spec.rankingType} 失败: ${err.message}`);
    }
  }
  if (!boards.length) throw new Error('OpenCompass API 未返回可用榜单');
  return {
    items: boards.reduce((n, b) => n + b.entries.length, 0),
    note: `官方 API POST /gw/opencompass-be：${boards.map((b) => `${b.id} ${b.entries.length} 条`).join('，')}`,
    contributions: { boards },
  };
}

const EPOCH_BOARDS = [
  { file: 'swe_bench_verified.csv', id: 'epoch-swe-bench-verified', name: 'SWE-bench Verified（Epoch 收录）', description: 'Epoch AI 复评的 SWE-bench Verified 通过率（0-1），衡量真实代码修复能力', metricName: 'pass rate' },
  { file: 'gpqa_diamond.csv', id: 'epoch-gpqa-diamond', name: 'GPQA Diamond（Epoch 收录）', description: 'Epoch AI 复评的 GPQA Diamond 正确率（0-1），研究生级科学问答', metricName: 'accuracy' },
];

async function collectEpoch(ctx) {
  // Official benchmark_data.zip (2.3MB, 92 CSVs); prefer extracted CSV snapshots in offline mode
  const extracted = {};
  let eciCsv = null;
  if (ctx.fromSnapshot) {
    eciCsv = (await ctx.loadSnapshot('epoch-eci-scores', 'csv'))?.text ?? null;
    for (const b of EPOCH_BOARDS) {
      const s = await ctx.loadSnapshot(`epoch-${b.file.replace(/\.csv$/, '')}`, 'csv');
      if (s) extracted[b.file] = s.text;
    }
    if (!eciCsv && !Object.keys(extracted).length) {
      const zipSnap = await ctx.loadSnapshot('epoch-benchmark-data', 'zip');
      if (zipSnap) unzip(zipSnap.buffer).forEach((e) => { if (e.name.endsWith('.csv')) extracted[e.name] = e.data.toString('utf8'); });
    }
  } else {
    const zipRes = await ctx.get(EPOCH_ZIP, { key: 'epoch-benchmark-data', ext: 'zip', timeoutMs: 60000, retries: 1 });
    const entries = unzip(zipRes.buffer);
    for (const e of entries) if (e.name.endsWith('.csv')) extracted[e.name] = e.data.toString('utf8');
    eciCsv = extracted['epoch_capabilities_index/eci_scores.csv'] || null;
    if (eciCsv) await ctx.saveSnapshot('epoch-eci-scores', 'csv', eciCsv);
    for (const b of EPOCH_BOARDS) {
      if (extracted[b.file]) await ctx.saveSnapshot(`epoch-${b.file.replace(/\.csv$/, '')}`, 'csv', extracted[b.file]);
    }
  }
  const boards = [];
  if (eciCsv || extracted['epoch_capabilities_index/eci_scores.csv']) {
    const board = normalizeEpochEci(eciCsv || extracted['epoch_capabilities_index/eci_scores.csv'], {});
    if (board) boards.push(board);
  }
  for (const b of EPOCH_BOARDS) {
    const csv = extracted[b.file];
    if (!csv) continue;
    const board = normalizeEpochBenchmark(csv, { id: b.id, name: b.name, description: b.description, metricName: b.metricName, updatedAt: ctx.now });
    if (board) boards.push(board);
  }
  if (!boards.length) throw new Error('Epoch benchmark_data.zip 中未找到可用 CSV');
  return {
    items: boards.reduce((n, b) => n + b.entries.length, 0),
    note: `benchmark_data.zip 解析：${boards.map((b) => b.id).join('、')}`,
    contributions: { boards },
  };
}

const RSS_FEEDS = [
  { id: 'rss-openai', name: 'OpenAI News RSS', url: 'https://openai.com/news/rss.xml', sourceName: 'OpenAI Blog' },
  { id: 'rss-gdm', name: 'Google DeepMind Blog RSS', url: 'https://deepmind.google/blog/rss.xml', sourceName: 'Google DeepMind' },
  { id: 'rss-google-ai', name: 'Google AI Blog RSS', url: 'https://blog.google/technology/ai/rss/', sourceName: 'Google AI Blog' },
  { id: 'rss-qwen', name: 'Qwen Blog RSS', url: 'https://qwenlm.github.io/blog/index.xml', sourceName: 'Qwen Blog' },
  { id: 'rss-aws-ml', name: 'AWS Machine Learning Blog RSS', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', sourceName: 'AWS ML Blog' },
  { id: 'rss-mit-ai', name: 'MIT News AI RSS', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', sourceName: 'MIT News AI' },
  { id: 'rss-bair', name: 'Berkeley BAIR Blog RSS', url: 'https://bair.berkeley.edu/blog/feed.xml', sourceName: 'Berkeley BAIR' },
];

function rssSource(feed) {
  return {
    id: feed.id,
    name: feed.name,
    url: feed.url,
    type: 'rss',
    enabledLocal: true,
    enabledCi: true,
    async collect(ctx) {
      const res = await ctx.get(feed.url, { key: feed.id, ext: 'xml', timeoutMs: 20000, retries: 1 });
      const all = parseRssItems(res.text, { maxItems: 20 });
      const items = normalizeRssNews(res.text, { sourceName: feed.sourceName, sourceKey: feed.id, feedUrl: feed.url, now: ctx.now });
      if (!items.length) {
        const newest = all.map((i) => i.publishedAt).filter(Boolean).sort().pop();
        return {
          items: 0,
          note: `feed 可达（${all.length} 条）但最新条目 ${newest ? newest.slice(0, 10) : '未知'} 超出 120 天新鲜度窗口，未并入动态`,
          contributions: {},
        };
      }
      return { items: items.length, note: `${items.length} 条（近 120 天）`, contributions: { news: items } };
    },
  };
}

async function collectGithub(ctx) {
  const repos = PROJECTS.filter((p) => p.repo && p.sourceType === 'community').map((p) => p.repo);
  const headers = { accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const byRepo = {};
  const failed = [];
  if (ctx.fromSnapshot) {
    const snap = await ctx.get('https://api.github.com', { key: 'github-repos', ext: 'json', save: false }).catch(() => null);
    if (!snap) throw new Error('无 GitHub stars 快照可回退');
    const data = JSON.parse(snap.text);
    Object.assign(byRepo, data?.repos || {});
  } else {
    const limit = ctx.log; // noop marker
    for (const repo of repos) {
      try {
        const res = await ctx.get(`https://api.github.com/repos/${repo}`, { key: null, ext: 'json', timeoutMs: 15000, retries: 0, headers, save: false });
        const j = JSON.parse(res.text);
        byRepo[repo] = {
          full_name: j.full_name, html_url: j.html_url, stargazers_count: j.stargazers_count,
          pushed_at: j.pushed_at, license: j.license ? { spdx_id: j.license.spdx_id } : null,
        };
      } catch (err) {
        failed.push(`${repo}: ${err.message}`);
        limit(`[github] ${repo} 失败: ${err.message}`);
      }
    }
    // Only overwrite the snapshot once at least one repo is available, so rate limits cannot replace a good snapshot with an empty object
    if (Object.keys(byRepo).length) {
      await ctx.saveSnapshot('github-repos', 'json', { fetchedAt: new Date(ctx.now).toISOString(), repos: byRepo });
    }
  }
  const items = normalizeGithubProjects(PROJECTS, byRepo, { now: ctx.now });
  if (!Object.keys(byRepo).length && !ctx.fromSnapshot) throw new Error(`GitHub 全部仓库刷新失败（${failed.slice(0, 2).join('; ')}）`);
  return {
    items: items.length,
    note: `${Object.keys(byRepo).length}/${repos.length} 个仓库 stars 已刷新${failed.length ? `，失败 ${failed.length} 个` : ''}${token ? '（带 token）' : '（未认证 60/h）'}`,
    contributions: { projects: items },
  };
}

async function collectGithubReleases(ctx) {
  const repos = ['huggingface/transformers', 'vllm-project/vllm', 'ollama/ollama'];
  const headers = { accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const byRepo = {};
  const failed = [];
  if (ctx.fromSnapshot) {
    const snap = await ctx.get('https://api.github.com', { key: 'github-releases', ext: 'json', save: false }).catch(() => null);
    if (!snap) throw new Error('无 GitHub Releases 快照可回退');
    Object.assign(byRepo, JSON.parse(snap.text).releases || {});
  } else {
    for (const repo of repos) {
      try {
        const res = await ctx.get(`https://api.github.com/repos/${repo}/releases?per_page=3`, { key: null, ext: 'json', timeoutMs: 15000, retries: 0, headers, save: false });
        const j = JSON.parse(res.text);
        if (Array.isArray(j)) {
          byRepo[repo] = j.map((r) => ({ tag_name: r.tag_name, name: r.name, published_at: r.published_at, html_url: r.html_url, body: r.body, draft: r.draft }));
        }
      } catch { failed.push(repo); }
    }
    if (Object.keys(byRepo).length) {
      await ctx.saveSnapshot('github-releases', 'json', { fetchedAt: new Date(ctx.now).toISOString(), releases: byRepo });
    }
  }
  const items = normalizeGithubReleases(byRepo, { now: ctx.now });
  if (!Object.keys(byRepo).length && !ctx.fromSnapshot) throw new Error(`GitHub Releases 全部失败（${failed.join('; ')}）`);
  return {
    items: items.length,
    note: `${Object.keys(byRepo).length}/${repos.length} 个仓库 Releases${failed.length ? `，失败 ${failed.length}` : ''}（transformers/vLLM/Ollama）`,
    contributions: { news: items },
  };
}

async function collectHfMirror(ctx) {
  const res = await ctx.get('https://hf-mirror.com/api/models?limit=20&sort=trendingScore&direction=-1', { key: 'hf-mirror-models', ext: 'json', timeoutMs: 20000, retries: 1 });
  const arr = JSON.parse(res.text);
  if (!Array.isArray(arr)) throw new Error('hf-mirror 响应非数组');
  return { items: arr.length, note: `trending ${arr.length} 条；POC 仅验证镜像可达（HF 官方被墙），MVP 用于开源权重/趋势补全`, contributions: {} };
}

async function collectHuggingFaceOfficial(ctx) {
  const res = await ctx.get('https://huggingface.co/api/models?limit=20&sort=trendingScore&direction=-1', { key: 'huggingface-models', ext: 'json', timeoutMs: 20000, retries: 1 });
  const arr = JSON.parse(res.text);
  if (!Array.isArray(arr)) throw new Error('HF 官方响应非数组');
  return { items: arr.length, note: `HF 官方 trending ${arr.length} 条（CI 网络）；MVP 用于开源权重/趋势补全`, contributions: {} };
}

async function collectLmarena(ctx) {
  const rowsRes = await ctx.get(
    'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=text&split=latest&offset=0&length=100',
    { key: 'lmarena-rows', ext: 'json', timeoutMs: 30000, retries: 1 }
  );
  const payload = JSON.parse(rowsRes.text);
  let updatedAt = ctx.now;
  try {
    const meta = await ctx.get('https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset', { key: 'lmarena-dataset-meta', ext: 'json', timeoutMs: 20000, retries: 0 });
    const lastModified = JSON.parse(meta.text).lastModified;
    if (lastModified) updatedAt = lastModified;
  } catch { /* Dataset metadata failures must not block the leaderboard */ }
  const board = normalizeLmarenaRows(payload, { updatedAt, maxEntries: 100 });
  if (!board) throw new Error('LMArena rows 未解析出榜单');
  return {
    items: board.entries.length,
    note: `HF datasets-server text/latest rows Top${board.entries.length}（dataset lastModified ${String(updatedAt).slice(0, 10)}）`,
    contributions: { boards: [board] },
  };
}

async function collectDeepseek(ctx) {
  const res = await ctx.get('https://api-docs.deepseek.com/updates', { key: 'deepseek-updates', ext: 'html', timeoutMs: 15000, retries: 1 });
  const items = normalizeDeepseekUpdates(res.text, { now: ctx.now });
  if (!items.length) throw new Error('DeepSeek Change Log 未解析到条目');
  return {
    items: items.length,
    note: `官方 Change Log HTML 适配：${items.length} 条（近 240 天）`,
    contributions: { news: items },
  };
}

// ---------------------------------------------------------------------------
// Hacker News AI hot topics (v1.4 B4): Algolia search + first-comment summaries
// Public API, no key. Search items within the last 7 days, then fetch up to 10
// story item trees to extract a plain-text discussion summary per topic.
// ---------------------------------------------------------------------------
const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search';
const HN_ITEM_URL = 'https://hn.algolia.com/api/v1/items/';
const HN_WINDOW_DAYS = 7;

async function collectHnAi(ctx) {
  const since = Math.floor(Date.parse(ctx.now) / 1000) - HN_WINDOW_DAYS * 86400;
  const searchUrl = `${HN_SEARCH_URL}?query=AI&tags=story&numericFilters=created_at_i%3E${since},points%3E30&hitsPerPage=30`;
  const res = await ctx.get(searchUrl, { key: 'hn-ai-search', ext: 'json', timeoutMs: 25000, retries: 2 });
  const payload = JSON.parse(res.text);
  if (!Array.isArray(payload.hits)) throw new Error('HN Algolia search response has no hits array');

  // First pass without summaries: decide which stories make the Top 10.
  const selected = normalizeHnTopics(payload, { now: ctx.now, limit: HN_TOPIC_LIMIT });
  if (!selected.length) throw new Error('HN AI stories: nothing AI-related in the last 7 days');

  const summaries = {};
  if (ctx.fromSnapshot) {
    // Offline replay: discussion summaries come from the aggregate snapshot written online.
    const snap = await ctx.get('https://hn.algolia.com/api/v1/items', { key: 'hn-ai-items', ext: 'json', save: false }).catch(() => null);
    if (snap) Object.assign(summaries, JSON.parse(snap.text).summaries || {});
  } else {
    const fetched = {};
    const ids = selected.map((t) => String(t.id).replace(/^hn-/, ''));
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (cursor < ids.length) {
        const objectID = ids[cursor++];
        try {
          const itemRes = await ctx.get(`${HN_ITEM_URL}${objectID}`, { key: null, ext: 'json', timeoutMs: 15000, retries: 1, save: false });
          const extracted = extractHnDiscussionSummary(JSON.parse(itemRes.text));
          // Store only the sanitized summary + comment id (no usernames/PII in the committed snapshot).
          if (extracted) fetched[`hn-${objectID}`] = { summary: extracted.summary, commentId: extracted.commentId };
        } catch (err) {
          ctx.log(`[hn-ai] comment fetch failed for ${objectID}: ${err.message}`);
        }
      }
    });
    await Promise.all(workers);
    if (Object.keys(fetched).length) {
      await ctx.saveSnapshot('hn-ai-items', 'json', { fetchedAt: new Date(ctx.now).toISOString(), summaries: fetched });
    }
    Object.assign(summaries, fetched);
  }

  const items = normalizeHnTopics(payload, { now: ctx.now, limit: HN_TOPIC_LIMIT, summaries });
  if (!items.length) throw new Error('HN AI topics empty after normalization');
  return {
    items: items.length,
    note: `HN last ${HN_WINDOW_DAYS}d AI stories: ${payload.hits.length} hits -> Top ${items.length} topics; ${Object.keys(summaries).length} with discussion summary`,
    contributions: { topics: items },
  };
}

/** Source registry (order defines meta.sources order; CI-only sources are marked blocked in local mode) */
export const SOURCES = [
  {
    id: 'openrouter', name: 'OpenRouter Models API', url: OPENROUTER_URL, type: 'api',
    enabledLocal: true, enabledCi: true, collect: collectOpenRouter,
  },
  {
    id: 'livebench', name: 'LiveBench 2.0', url: `${LIVEBENCH_BASE}/`, type: 'dataset',
    enabledLocal: true, enabledCi: true, collect: collectLiveBench,
    modeNoteLocal: null,
  },
  {
    id: 'epoch-ai', name: 'Epoch AI Benchmarking', url: 'https://epoch.ai/data/ai-benchmarking-dashboard', type: 'dataset',
    enabledLocal: true, enabledCi: true, collect: collectEpoch,
  },
  {
    id: 'opencompass', name: 'OpenCompass 司南', url: 'https://rank.opencompass.org.cn/', type: 'api',
    enabledLocal: true, enabledCi: true, collect: collectOpenCompass,
  },
  {
    id: 'artificial-analysis', name: 'Artificial Analysis', url: AA_URL, type: 'html',
    enabledLocal: true, enabledCi: true, collect: collectArtificialAnalysis,
  },
  ...RSS_FEEDS.map(rssSource),
  {
    id: 'github', name: 'GitHub API（项目 stars）', url: 'https://api.github.com', type: 'api',
    enabledLocal: true, enabledCi: true, collect: collectGithub,
  },
  {
    id: 'github-releases', name: 'GitHub Releases（开源工具动态）', url: 'https://api.github.com/repos/huggingface/transformers/releases', type: 'api',
    enabledLocal: true, enabledCi: true, collect: collectGithubReleases,
  },
  {
    id: 'hf-mirror', name: 'Hugging Face 镜像', url: 'https://hf-mirror.com/api/models', type: 'api',
    enabledLocal: true, enabledCi: true, collect: collectHfMirror,
  },
  {
    id: 'huggingface', name: 'Hugging Face 官方 API', url: 'https://huggingface.co/api', type: 'api',
    enabledLocal: false, enabledCi: true, collect: collectHuggingFaceOfficial,
    modeNoteLocal: '仅 CI（GitHub Actions）启用：本机 huggingface.co 被墙（fetch 超时）',
  },
  {
    id: 'lmarena', name: 'LMArena（HF 数据集）', url: 'https://lmarena.ai/leaderboard', type: 'dataset',
    enabledLocal: false, enabledCi: true, collect: collectLmarena,
    modeNoteLocal: '仅 CI 启用：lmarena.ai 与 datasets-server 本机被墙；CI 侧经 hf-mirror/HF 数据集获取',
  },
  {
    id: 'superclue', name: 'SuperCLUE', url: 'https://www.superclueai.com/', type: 'html',
    enabledLocal: false, enabledCi: false, collect: async () => { throw new Error('SuperCLUE 为 SPA，数据未在 bundle 暴露公开 API（仅微信文章链接），POC 未接入'); },
    modeNoteLocal: '无公开数据 API（Vue SPA + 微信文章），POC 不接入；如需可后续人工维护',
  },
  {
    id: 'deepseek-news', name: 'DeepSeek 官方 Change Log', url: 'https://api-docs.deepseek.com/updates', type: 'html',
    enabledLocal: true, enabledCi: true, collect: collectDeepseek,
  },
  {
    id: 'hn-ai', name: 'Hacker News AI 热榜', url: HN_SEARCH_URL, type: 'api',
    enabledLocal: true, enabledCi: true, collect: collectHnAi,
  },
];

/** Non-network contribution: curated resources (source status is always ok, items = count) */
export const CURATED = {
  resources: RESOURCES,
  projects: PROJECTS,
};

export { normalizeGithubProjects };
