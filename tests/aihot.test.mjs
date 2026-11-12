/**
 * Tests for the AIHOT (https://aihot.news) public API normalizer.
 * The collector runs at build time; these are the pure functions that produce
 * data/aihot.json and feed the Updates / hot-topics / AiHot modules.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAihotBundle,
  aihotToNews,
  aihotToTopics,
  buildAihotHighlights,
  AIHOT_HOT_LIMIT,
  AIHOT_RESET_KEYS,
} from "../scripts/normalize.mjs";

const NOW = "2026-11-12T05:00:00.000Z";

const RAW = {
  items: {
    items: [
      {
        id: "item-1",
        title: "模型 A 发布",
        originalTitle: "Model A is released",
        summary: "摘要一",
        category: "ai-models",
        score: 92,
        selected: true,
        reason: "值得关注",
        source: { name: "厂商博客" },
        links: { aihot: "https://aihot.news/items/item-1", original: "https://example.com/a" },
        publishedAt: "2026-11-12T00:00:00.000Z",
      },
      {
        id: "item-2",
        title: "教程 B",
        originalTitle: "Tutorial B",
        summary: "摘要二",
        category: "tip",
        score: 66,
        source: { name: "社区" },
        links: { aihot: "https://aihot.news/items/item-2", original: "https://example.com/b" },
        publishedAt: "2026-11-11T00:00:00.000Z",
      },
    ],
  },
  hot: {
    items: [
      {
        rank: 1, id: "hot-1", title: "热点甲",
        links: { aihot: "https://aihot.news/items/hot-1", story: "https://aihot.news/story/1", original: "https://example.com/h1" },
        source: { name: "媒体甲" }, sourceCount: 6, signalCount: 53, participantCount: 59,
        sourceNames: ["媒体甲", "媒体乙"], latestAt: "2026-11-12T04:00:00.000Z",
      },
      {
        rank: 2, id: "hot-2", title: "热点乙",
        links: { aihot: "https://aihot.news/items/hot-2" },
        sourceCount: 2, signalCount: 18, latestAt: "2026-11-11T04:00:00.000Z",
      },
    ],
  },
  daily: { report: { date: "2026-11-12", lead: { title: "今日头条", leadParagraph: "导语" }, sections: [{ label: "模型发布", items: [{ id: "d1", title: "日报条目", links: { aihot: "https://aihot.news/items/d1" } }] }] } },
  weekly: { report: { week: "2026-W45", overview: "本周综述内容", sections: [] } },
  monthly: { report: { month: "2026-10", overview: "本月综述", sections: [] } },
  codex: { checkedAt: "2026-11-12T05:30:00.000+08:00", today: "2026-11-12", count: 3, monitor: { status: "healthy", pendingCount: 1 }, events: [{ id: "e1", type: "reset_credit", displayLabel: "重置卡发放", status: "announced", title: "预告", estimate: { label: "北京时间 11月13日" } }] },
  claude: { checkedAt: "2026-11-12T05:30:00.000+08:00", monitor: { status: "healthy" }, events: [] },
  antigravity: { checkedAt: "2026-11-12T05:30:00.000+08:00", monitor: { status: "healthy" }, events: [] },
};

test("normalizeAihotBundle keeps ranked hot topics and editorial picks", () => {
  const bundle = normalizeAihotBundle(RAW, { now: NOW });
  assert.equal(bundle.source, "aihot-v1");
  assert.equal(bundle.hotTopics.length, 2);
  assert.equal(bundle.hotTopics[0].rank, 1);
  assert.equal(bundle.hotTopics[0].storyUrl, "https://aihot.news/story/1");
  assert.equal(bundle.latest.length, 2);
  assert.equal(bundle.latest[0].categoryLabel, "AI 模型");
  assert.equal(bundle.reports.daily.lead.title, "今日头条");
  assert.equal(bundle.reports.weekly.overview, "本周综述内容");
  assert.equal(Object.keys(bundle.resets).length, 3);
  assert.equal(bundle.resets.codex.status, "healthy");
  assert.equal(bundle.stats.hotTopics, 2);
});

test("normalizeAihotBundle degrades gracefully on empty/partial payloads", () => {
  const empty = normalizeAihotBundle({}, { now: NOW });
  assert.deepEqual(empty.hotTopics, []);
  assert.deepEqual(empty.latest, []);
  assert.deepEqual(empty.resets, {});
  const partial = normalizeAihotBundle({ hot: RAW.hot }, { now: NOW });
  assert.equal(partial.hotTopics.length, 2);
  assert.equal(partial.latest.length, 0);
});

test("normalizeAihotBundle caps sizes and strips unsafe URLs", () => {
  const many = {
    hot: { items: Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, id: `h${i}`, title: `热点${i}`, links: { aihot: "https://aihot.news/items/x" }, latestAt: NOW })) },
    items: { items: Array.from({ length: 60 }, (_, i) => ({ id: `i${i}`, title: `条目${i}`, links: { aihot: "javascript:alert(1)", original: "https://example.com/x" }, publishedAt: NOW })) },
  };
  const bundle = normalizeAihotBundle(many, { now: NOW });
  assert.equal(bundle.hotTopics.length, AIHOT_HOT_LIMIT);
  assert.equal(bundle.latest.length, 30);
  assert.equal(bundle.latest[0].aihotUrl, null);
  assert.equal(bundle.latest[0].originalUrl, "https://example.com/x");
});

test("aihotToNews emits valid data/news.json entries", () => {
  const bundle = normalizeAihotBundle(RAW, { now: NOW });
  const news = aihotToNews(bundle, { now: NOW });
  assert.equal(news.length, 2);
  assert.equal(news[0].id, "aihot-item-1");
  assert.equal(news[0].kind, "release");
  assert.equal(news[0].importance, 3);
  assert.equal(news[0].lang, "zh");
  assert.equal(news[1].importance, 1);
  assert.ok(news[0].tags.includes("AIHOT"));
  assert.equal(news[0].sourceUrl, "https://aihot.news/items/item-1");
  assert.equal(news[0].url, "https://example.com/a");
  assert.equal(news[0].aihot.category, "ai-models");
  assert.equal(news[0].titleEn, "Model A is released");
  assert.ok(news[0].summaryEn.includes("AIHOT editorial pick"));
  assert.equal(news[0].sourceNameEn, "厂商博客".replace(/[\u4e00-\u9fff]/g, "") || "AIHOT");
});

test("aihotToTopics stays backward compatible with the topics contract", () => {
  const bundle = normalizeAihotBundle(RAW, { now: NOW });
  const topics = aihotToTopics(bundle, { now: NOW });
  assert.equal(topics.length, 2);
  assert.equal(topics[0].hot, true);
  assert.equal(topics[0].rank, 1);
  assert.equal(topics[0].points, 53);
  assert.equal(topics[0].comments, 6);
  assert.equal(topics[0].source, "AIHOT");
  assert.ok(/^https?:\/\//.test(topics[0].url));
  assert.ok(topics[0].summary.length <= 240);
  assert.equal(topics[0].hnUrl, topics[0].storyUrl);
  assert.ok(AIHOT_RESET_KEYS.includes("codex"));
});

test("buildAihotHighlights produces the three editorial lines", () => {
  const bundle = normalizeAihotBundle(RAW, { now: NOW });
  const lines = buildAihotHighlights(bundle);
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes("热点甲"));
  assert.ok(lines[1].includes("今日头条"));
  assert.ok(lines[2].includes("本周综述"));
});
