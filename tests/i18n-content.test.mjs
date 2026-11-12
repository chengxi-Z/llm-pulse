/**
 * English-edition content audit:
 * UI dictionary must be CJK-free; generated/curated Chinese content must carry English companions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CURATED, SOURCES } from "../scripts/fetch/sources.mjs";
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


test("English default: static HTML is free of CJK and fullwidth punctuation", () => {
  const files = ["index.html", "news.html", "rankings.html", "models.html", "resources.html", "projects.html", "skills.html", "about.html", "deepseek.html", "aihot.html", "404.html"];
  const bad = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
  for (const file of files) {
    const html = readFileSync(new URL(`site/${file}`, ROOT), "utf8");
    assert.equal(bad.test(html), false, `${file} contains CJK/fullwidth characters`);
    assert.match(html, /<html[^>]+lang="en"/, `${file} should declare English as the default document language`);
  }
});

test("information sources are English-language sites only", () => {
  const ids = SOURCES.map((source) => source.id);
  assert.equal(ids.includes("opencompass"), false);
  assert.equal(ids.includes("superclue"), false);
  const bannedHosts = ["opencompass.org.cn", "superclueai.com", "zh.d2l.ai", "datawhalechina"];
  for (const source of SOURCES) {
    assert.equal(bannedHosts.some((host) => String(source.url).includes(host)), false, `${source.id} uses a non-English source host`);
  }
  for (const resource of CURATED.resources) {
    assert.notEqual(resource.lang, "zh", `${resource.id} points at a Chinese-language resource`);
    assert.equal(bannedHosts.some((host) => String(resource.url).includes(host)), false, `${resource.id} uses a non-English resource host`);
  }
});


test("outbound feeds are English-only", () => {
  const bad = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
  for (const file of ["feed.xml", "feed.json"]) {
    const content = readFileSync(new URL(`site/${file}`, ROOT), "utf8");
    assert.equal(bad.test(content), false, `${file} contains CJK/fullwidth characters`);
  }
});
