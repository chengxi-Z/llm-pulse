/**
 * AI Hot is a Chinese-only module. These pure rules are shared by the browser
 * runtime, the feed builder and the static site; keep them in lockstep.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  isAiHotEnabled,
  filterAihotNews,
  filterAihotSources,
  topicsForLang,
} from "../site/assets/js/aihot-scope.mjs";

const NEWS = [
  { id: "aihot-a", title: "AIHOT 精选", aihot: { category: "tip" }, titleEn: "AIHOT pick" },
  { id: "hn-1", title: "Regular update", titleEn: "Regular update" },
  { id: "aihot-b", title: "AIHOT 第二条", titleEn: "Second pick", sourceUrl: "https://aihot.news/items/b" },
];

const SOURCES = [
  { id: "aihot", name: "AIHOT 中文 AI 资讯", url: "https://aihot.news/api/v1" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai" },
  { id: "hn", name: "HN", url: "https://news.ycombinator.com" },
];

const TOPICS = {
  items: [{ id: "aihot-x", title: "中文热点", hot: true, rank: 1 }],
  hnItems: [{ id: "hn-1", title: "English HN story", points: 120 }],
};

test("AI Hot is enabled in Chinese only", () => {
  assert.equal(isAiHotEnabled("zh"), true);
  assert.equal(isAiHotEnabled("en"), false);
  assert.equal(isAiHotEnabled(undefined), false);
  assert.equal(isAiHotEnabled("fr"), false);
});

test("English drops every AIHOT Updates entry, Chinese keeps all", () => {
  assert.deepEqual(filterAihotNews(NEWS, "en").map((item) => item.id), ["hn-1"]);
  assert.deepEqual(filterAihotNews(NEWS, "zh").map((item) => item.id), ["aihot-a", "hn-1", "aihot-b"]);
  assert.equal(filterAihotNews(NEWS, "en").some((item) => /aihot/i.test(JSON.stringify(item))), false);
});

test("English drops the AIHOT information source, Chinese keeps it", () => {
  assert.deepEqual(filterAihotSources(SOURCES, "en").map((s) => s.id), ["openrouter", "hn"]);
  assert.equal(filterAihotSources(SOURCES, "zh").length, 3);
});

test("English hot topics fall back to the HN board", () => {
  const en = topicsForLang(TOPICS, "en");
  assert.equal(en.length, 1);
  assert.equal(en[0].id, "hn-1");
  assert.equal(en.some((item) => item.hot), false);
  const zh = topicsForLang(TOPICS, "zh");
  assert.equal(zh.length, 1);
  assert.equal(zh[0].hot, true);
});

test("helpers degrade gracefully on missing / malformed data", () => {
  assert.deepEqual(filterAihotNews(null, "en"), []);
  assert.deepEqual(filterAihotSources(undefined, "en"), []);
  assert.deepEqual(topicsForLang(null, "en"), []);
  assert.deepEqual(topicsForLang({ items: [{ hot: true }] }, "en"), []);
  assert.deepEqual(topicsForLang({}, "zh"), []);
  // Pure: callers never get the source arrays mutated.
  assert.equal(NEWS.length, 3);
  assert.equal(SOURCES.length, 3);
  assert.equal(TOPICS.hnItems.length, 1);
});
