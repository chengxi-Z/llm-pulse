/**
 * English-edition content audit:
 * UI dictionary must be CJK-free; generated/curated Chinese content must carry English companions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CURATED } from "../scripts/fetch/sources.mjs";
import { normalizeResources, normalizeGithubProjects } from "../scripts/normalize.mjs";

const ROOT = new URL("../", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, ROOT), "utf8"));
const CJK = /[\u3400-\u9fff]/;

test("en.json contains no CJK text", () => {
  const en = readJson("site/assets/i18n/en.json");
  const bad = Object.entries(en).filter(([, value]) => typeof value === "string" && CJK.test(value));
  assert.deepEqual(bad, [], `CJK values in en.json: ${bad.map(([key]) => key).join(", ")}`);
});

test("every Chinese news item has an English title and summary", () => {
  const news = readJson("data/news.json").items;
  const chinese = news.filter((item) => CJK.test(String(item.title || "")));
  const missing = chinese.filter((item) => !item.titleEn || !item.summaryEn);
  assert.deepEqual(missing.map((item) => item.id), []);
});

test("curated resources and projects carry English companions", () => {
  const resources = readJson("data/resources.json").items;
  const projects = readJson("data/projects.json").items;
  assert.deepEqual(resources.filter((item) => !item.descriptionEn).map((item) => item.id), []);
  assert.deepEqual(projects.filter((item) => !item.summaryEn).map((item) => item.id), []);
});

test("generated English news fields contain no Chinese characters", () => {
  const news = readJson("data/news.json").items;
  const bad = news.filter((item) => [item.titleEn, item.summaryEn].some((value) => typeof value === "string" && CJK.test(value)));
  assert.deepEqual(bad.map((item) => item.id), []);
});


test("pipeline preserves curated English fields", () => {
  const resources = normalizeResources(CURATED.resources, { now: new Date("2026-11-07T00:00:00Z") });
  const projects = normalizeGithubProjects(CURATED.projects, {}, { now: new Date("2026-11-07T00:00:00Z") });
  assert.deepEqual(resources.filter((item) => !item.descriptionEn).map((item) => item.id), []);
  assert.deepEqual(projects.filter((item) => !item.summaryEn).map((item) => item.id), []);
});
