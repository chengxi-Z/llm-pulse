/**
 * aihot.mjs — AIHOT (https://aihot.news) public JSON API collector.
 *
 * AIHOT exposes the same editorial dataset through an MCP server and an
 * anonymous read-only REST API. Static sites cannot call MCP at runtime, so the
 * build pipeline uses /api/v1 (no API key required, see /agent for the terms).
 * Raw responses are normalized by pure functions in ../normalize.mjs.
 *
 * Degradation: every endpoint is independent. If the two core feeds (items +
 * hot topics) both fail the source degrades; otherwise partial data is kept.
 */
import { normalizeAihotBundle, aihotToNews, aihotToTopics } from '../normalize.mjs';

export const AIHOT_BASE = 'https://aihot.news/api/v1';

const ENDPOINTS = {
  items: '/items?window=7d&limit=30&mode=selected',
  hot: '/hot-topics',
  daily: '/dailies/latest',
  weekly: '/weeklies/latest',
  monthly: '/monthlies/latest',
  codex: '/codex-resets',
  claude: '/claude-resets',
  antigravity: '/antigravity-resets',
};

async function getJson(ctx, name, path) {
  const res = await ctx.get(AIHOT_BASE + path, {
    key: 'aihot-' + name,
    ext: 'json',
    timeoutMs: 20000,
    retries: 2,
    headers: {
      'user-agent': 'aihot-api/2.0.0 (+https://github.com/chengxi-Z/llm-pulse)',
      accept: 'application/json',
    },
  });
  return JSON.parse(res.text);
}

export async function collectAihot(ctx) {
  const names = Object.keys(ENDPOINTS);
  const settled = await Promise.allSettled(names.map((n) => getJson(ctx, n, ENDPOINTS[n])));
  const raw = {};
  const failed = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') raw[names[i]] = result.value;
    else failed.push(names[i]);
  });
  if (!raw.items && !raw.hot) {
    throw new Error(`AIHOT 核心接口不可用（${failed.join(', ') || 'unknown'}）`);
  }
  const bundle = normalizeAihotBundle(raw, { now: ctx.now });
  return {
    items: bundle.latest.length,
    note: `AIHOT 精选 ${bundle.latest.length} 条 / 热点 ${bundle.hotTopics.length} 条 / 日报·周报·月报 / 额度重置 3 路` +
      (failed.length ? `（缺失：${failed.join(', ')}）` : ''),
    contributions: {
      aihot: bundle,
      news: aihotToNews(bundle, { now: ctx.now }),
      topics: aihotToTopics(bundle, { now: ctx.now }),
    },
  };
}
