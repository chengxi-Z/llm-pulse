#!/usr/bin/env node
/**
 * Data contract validator (DATA-CONTRACT v1.0).
 *
 * Usage:
 *   node scripts/validate.mjs            # strict data validation + site structure warnings
 *   node scripts/validate.mjs --strict   # before release: missing site/feed files are errors too
 *
 * Exit codes: 0 = pass (warnings allowed), 1 = errors present.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA = join(ROOT, "data");
const SITE = join(ROOT, "site");
const STRICT = process.argv.includes("--strict");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const files = ["meta", "models", "news", "rankings", "resources", "projects", "skills", "topics", "usage"];
const data = {};

function readJson(name) {
  const p = join(DATA, `${name}.json`);
  if (!existsSync(p)) {
    err(`[${name}.json] 文件缺失`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    err(`[${name}.json] JSON 解析失败: ${e.message}`);
    return null;
  }
}

const isIso = (s) => typeof s === "string" && Number.isFinite(Date.parse(s));
const isStr = (s, min = 1) => typeof s === "string" && s.trim().length >= min;
const isNumOrNull = (n) => n === null || (typeof n === "number" && Number.isFinite(n));
const isPosIntOrNull = (n) => n === null || (Number.isInteger(n) && n > 0);
const oneOf = (v, set) => set.includes(v);

for (const f of files) data[f] = readJson(f);

// ---------- Generic ----------
for (const f of files) {
  const d = data[f];
  if (!d) continue;
  if (d.schemaVersion !== 1) err(`[${f}.json] schemaVersion 应为 1，实际 ${JSON.stringify(d.schemaVersion)}`);
  if (!isIso(d.generatedAt)) err(`[${f}.json] generatedAt 非法: ${d.generatedAt}`);
  if (!isStr(d.source)) err(`[${f}.json] source 缺失`);
}

// ---------- meta ----------
const meta = data.meta;
if (meta) {
  if (!["local", "ci", "seed"].includes(meta.mode)) err(`[meta] mode 非法: ${meta.mode}`);
  if (!meta.site || !isStr(meta.site.name) || !isStr(meta.site.brand)) err(`[meta] site.name/site.brand 缺失`);
  if (!meta.stats || typeof meta.stats !== "object") err(`[meta] stats 缺失`);
  if (!Array.isArray(meta.sources)) err(`[meta] sources 应为数组`);
  else {
    meta.sources.forEach((s, i) => {
      if (!isStr(s.id) || !isStr(s.name)) err(`[meta.sources[${i}]] id/name 缺失`);
      if (!["ok", "degraded", "blocked"].includes(s.status)) err(`[meta.sources[${i}]] status 非法: ${s.status}`);
      if (!["api", "dataset", "rss", "html"].includes(s.type)) err(`[meta.sources[${i}]] type 非法: ${s.type}`);
    });
  }
  if (isIso(meta.generatedAt)) {
    const age = Date.now() - Date.parse(meta.generatedAt);
    if (age > 8 * 24 * 3600 * 1000) warn(`[meta] 数据已 ${(age / 3600e3).toFixed(1)}h 未更新（>8 天，周度刷新 + 1 天缓冲）`);
    if (age < -5 * 60 * 1000) err(`[meta] generatedAt 晚于当前时间超过 5 分钟`);
  }
}

// ---------- models ----------
const models = data.models;
const modelIds = new Set();
if (models) {
  if (!Array.isArray(models.models) || models.models.length === 0) err(`[models] models 应为非空数组`);
  if (models.count !== (models.models || []).length) err(`[models] count=${models.count} 与数组长度 ${(models.models || []).length} 不一致`);
  const minModels = 50;
  if ((models.models || []).length < minModels) warn(`[models] 模型数量 ${(models.models || []).length} < ${minModels}`);
  for (const [i, m] of (models.models || []).entries()) {
    const tag = `[models[${i}] ${m.id ?? "?"}]`;
    if (!isStr(m.id)) err(`${tag} id 缺失`);
    else if (modelIds.has(m.id)) err(`${tag} id 重复`);
    else modelIds.add(m.id);
    if (!isStr(m.name)) err(`${tag} name 缺失`);
    if (!isStr(m.org)) err(`${tag} org 缺失`);
    if (m.releaseDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate || "")) err(`${tag} releaseDate 格式应为 YYYY-MM-DD: ${m.releaseDate}`);
    if (!isPosIntOrNull(m.contextWindow)) err(`${tag} contextWindow 非法: ${m.contextWindow}`);
    if (!isPosIntOrNull(m.maxOutput)) err(`${tag} maxOutput 非法: ${m.maxOutput}`);
    if (!Array.isArray(m.modalities) || m.modalities.length === 0) err(`${tag} modalities 应为非空数组`);
    else for (const mod of m.modalities) if (!oneOf(mod, ["text", "image", "audio", "video", "file"])) err(`${tag} modality 非法: ${mod}`);
    if (!Array.isArray(m.capabilities)) err(`${tag} capabilities 应为数组`);
    if (typeof m.openWeights !== "boolean") err(`${tag} openWeights 应为布尔`);
    if (m.pricing !== null) {
      if (typeof m.pricing !== "object") err(`${tag} pricing 结构非法`);
      else {
        if (!isNumOrNull(m.pricing.input) || !isNumOrNull(m.pricing.output)) err(`${tag} pricing.input/output 应为数字或 null`);
        if (m.pricing.currency !== "USD") err(`${tag} pricing.currency 应为 USD`);
        if (m.pricing.unit !== "per_1m_tokens") err(`${tag} pricing.unit 应为 per_1m_tokens`);
      }
    }
    if (m.links !== null && typeof m.links === "object") {
      for (const k of ["official", "api", "hf"]) if (m.links[k] !== undefined && m.links[k] !== null && !/^https?:\/\//.test(m.links[k])) err(`${tag} links.${k} 非法`);
    }
  }
}

// ---------- news ----------
const news = data.news;
const KINDS = ["release", "benchmark", "oss", "pricing", "research", "policy"];
if (news) {
  if (!Array.isArray(news.items) || news.items.length === 0) err(`[news] items 应为非空数组`);
  else if (news.items.length < 5) warn(`[news] 条目 ${news.items.length} < 5`);
  const ids = new Set();
  for (const [i, n] of news.items.entries()) {
    const tag = `[news[${i}] ${n.id ?? "?"}]`;
    if (!isStr(n.id)) err(`${tag} id 缺失`);
    else if (ids.has(n.id)) err(`${tag} id 重复`);
    else ids.add(n.id);
    for (const k of ["title", "summary", "sourceName", "url"]) if (!isStr(n[k])) err(`${tag} ${k} 缺失`);
    if (!oneOf(n.kind, KINDS)) err(`${tag} kind 非法: ${n.kind}`);
    if (!isIso(n.publishedAt)) err(`${tag} publishedAt 非法: ${n.publishedAt}`);
    if (!oneOf(n.importance, [1, 2, 3])) err(`${tag} importance 应为 1..3`);
    if (!oneOf(n.lang, ["zh", "en"])) err(`${tag} lang 非法: ${n.lang}`);
    if (!Array.isArray(n.tags)) err(`${tag} tags 应为数组`);
    if (!Array.isArray(n.models)) err(`${tag} models 应为数组`);
    else for (const mid of n.models) if (modelIds.size && !modelIds.has(mid)) warn(`${tag} 引用模型不存在: ${mid}`);
    if (n.url && !/^https?:\/\//.test(n.url)) err(`${tag} url 非法`);
    if (isIso(n.publishedAt) && Date.parse(n.publishedAt) > Date.now() + 86400e3) warn(`${tag} publishedAt 超过当前时间`);
  }
}

// ---------- rankings ----------
const rankings = data.rankings;
if (rankings) {
  if (!Array.isArray(rankings.boards)) err(`[rankings] boards 应为数组`);
  else {
    const ids = new Set();
    for (const [i, b] of rankings.boards.entries()) {
      const tag = `[rankings[${i}] ${b.id ?? "?"}]`;
      for (const k of ["id", "name", "sourceName"]) if (!isStr(b[k])) err(`${tag} ${k} 缺失`);
      if (!isStr(b.sourceUrl) || !/^https?:\/\//.test(b.sourceUrl)) err(`${tag} sourceUrl 非法`);
      if (!isIso(b.updatedAt)) err(`${tag} updatedAt 非法`);
      if (!b.metric || !isStr(b.metric.name) || !isStr(b.metric.unit)) err(`${tag} metric 结构非法`);
      else if (typeof b.metric.higherIsBetter !== "boolean") err(`${tag} metric.higherIsBetter 应为布尔`);
      if (ids.has(b.id)) err(`${tag} id 重复`); else ids.add(b.id);
      if (!Array.isArray(b.entries) || b.entries.length === 0) {
        err(`${tag} entries 应为非空数组（如数据源不可用请从 boards 中移除该榜）`);
        continue;
      }
      b.entries.forEach((e, j) => {
        const etag = `${tag}.entries[${j}]`;
        if (typeof e.rank !== "number" || e.rank !== j + 1) err(`${etag} rank 应为连续序号 ${j + 1}，实际 ${e.rank}`);
        for (const k of ["model", "org"]) if (!isStr(e[k])) err(`${etag} ${k} 缺失`);
        if (typeof e.score !== "number" || !Number.isFinite(e.score)) err(`${etag} score 应为有限数字`);
        if (e.votes !== null && e.votes !== undefined && typeof e.votes !== "number") err(`${etag} votes 应为数字或 null`);
      });
    }
  }
}

// ---------- resources ----------
const resources = data.resources;
const RES_TYPES = ["course", "tutorial", "paper", "tool", "awesome", "video", "book"];
if (resources) {
  if (!Array.isArray(resources.items)) err(`[resources] items 应为数组`);
  else {
    if (resources.items.length < 10) warn(`[resources] 资源 ${resources.items.length} < 10`);
    const ids = new Set();
    resources.items.forEach((r, i) => {
      const tag = `[resources[${i}] ${r.id ?? "?"}]`;
      for (const k of ["id", "title", "url", "author", "description"]) if (!isStr(r[k])) err(`${tag} ${k} 缺失`);
      if (!oneOf(r.type, RES_TYPES)) err(`${tag} type 非法: ${r.type}`);
      if (!oneOf(r.level, ["beginner", "intermediate", "advanced"])) err(`${tag} level 非法: ${r.level}`);
      if (!oneOf(r.lang, ["en", "zh", "multi"])) err(`${tag} lang 非法: ${r.lang}`);
      if (typeof r.free !== "boolean") err(`${tag} free 应为布尔`);
      if (typeof r.featured !== "boolean") err(`${tag} featured 应为布尔`);
      if (!/^https?:\/\//.test(r.url || "")) err(`${tag} url 非法`);
      if (!Array.isArray(r.tags)) err(`${tag} tags 应为数组`);
      if (ids.has(r.id)) err(`${tag} id 重复`); else ids.add(r.id);
    });
  }
}

// ---------- projects ----------
const projects = data.projects;
if (projects) {
  if (!Array.isArray(projects.items)) err(`[projects] items 应为数组`);
  else {
    if (projects.items.length < 6) warn(`[projects] 项目 ${projects.items.length} < 6`);
    const ids = new Set();
    projects.items.forEach((p, i) => {
      const tag = `[projects[${i}] ${p.id ?? "?"}]`;
      for (const k of ["id", "name", "owner", "url", "summary"]) if (!isStr(p[k])) err(`${tag} ${k} 缺失`);
      if (!["self", "community"].includes(p.sourceType)) err(`${tag} sourceType 非法: ${p.sourceType}`);
      if (!/^https?:\/\//.test(p.url || "")) err(`${tag} url 非法`);
      if (p.repo !== null && p.repo !== undefined && !/^[\w.-]+\/[\w.-]+$/.test(p.repo)) err(`${tag} repo 应为 owner/name`);
      if (!Array.isArray(p.tags)) err(`${tag} tags 应为数组`);
      if (ids.has(p.id)) err(`${tag} id 重复`); else ids.add(p.id);
      if (p.stars !== null && p.stars !== undefined && typeof p.stars !== "number") err(`${tag} stars 应为数字或 null`);
    });
  }
}

// ---------- skills (v1.2) ----------
const skills = data.skills;
const SKILL_CATEGORIES = ["methodology", "data", "writing", "design", "dev", "research", "other"];
if (skills) {
  if (!Array.isArray(skills.items)) err(`[skills] items 应为数组`);
  else {
    if (skills.count !== skills.items.length) err(`[skills] count=${skills.count} 与数组长度 ${skills.items.length} 不一致`);
    if (skills.items.length < 1) warn(`[skills] 技能条目为空`);
    const ids = new Set();
    skills.items.forEach((s, i) => {
      const tag = `[skills[${i}] ${s.id ?? "?"}]`;
      for (const k of ["id", "name", "description", "author", "url"]) if (!isStr(s[k])) err(`${tag} ${k} 缺失`);
      if (!oneOf(s.category, SKILL_CATEGORIES)) err(`${tag} category 非法: ${s.category}`);
      if (!oneOf(s.sourceType, ["mine", "official", "community"])) err(`${tag} sourceType 非法: ${s.sourceType}`);
      if (!oneOf(s.lang, ["en", "zh", "multi"])) err(`${tag} lang 非法: ${s.lang}`);
      if (!/^https?:\/\//.test(s.url || "")) err(`${tag} url 非法`);
      if (s.repo !== null && s.repo !== undefined && !/^[\w.-]+\/[\w.-]+$/.test(s.repo)) err(`${tag} repo 应为 owner/name`);
      if (s.stars !== null && s.stars !== undefined && typeof s.stars !== "number") err(`${tag} stars 应为数字或 null`);
      if (!isIso(s.updatedAt)) err(`${tag} updatedAt 非法: ${s.updatedAt}`);
      if (!s.install || !isStr(s.install.target)) err(`${tag} install.target 缺失`);
      if (!Array.isArray(s.usageSteps) && !Array.isArray(s.usageStepsZh)) err(`${tag} usageSteps 应为数组`);
      if (!Array.isArray(s.tags)) err(`${tag} tags 应为数组`);
      if (typeof s.featured !== "boolean") err(`${tag} featured 应为布尔`);
      if (ids.has(s.id)) err(`${tag} id 重复`); else ids.add(s.id);
    });
  }
}

// ---------- usage (OpenRouter token volume) ----------
const usage = data.usage;
if (usage) {
  if (!Array.isArray(usage.weeks)) err(`[usage] weeks 应为数组`);
  else {
    if (usage.granularity !== "week") warn(`[usage] granularity=${usage.granularity}（预期 week）`);
    if (!(Number(usage.monthlyTokens) >= 0)) err(`[usage] monthlyTokens 非法`);
    const weeks = usage.weeks;
    weeks.forEach((w, i) => {
      if (!w || typeof w.weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(w.weekStart)) err(`[usage[${i}]] weekStart 非法`);
      if (!(Number(w.tokens) >= 0)) err(`[usage[${i}]] tokens 非法`);
      if (w.complete !== undefined && typeof w.complete !== "boolean") err(`[usage[${i}]] complete 应为布尔值`);
    });
    for (let i = 1; i < weeks.length; i += 1) {
      if (weeks[i].weekStart <= weeks[i - 1].weekStart) err(`[usage] weeks 未按时间升序`);
    }
    // Only the newest week may be in progress; a partial week in the middle
    // would silently distort the trend line.
    const partialIdx = weeks.findIndex((w) => w.complete === false);
    if (partialIdx >= 0 && partialIdx !== weeks.length - 1) warn(`[usage] 未完成周不在末尾（index=${partialIdx}），趋势口径可能失真`);
    if (partialIdx >= 0 && Number(usage.monthlyDays) !== weeks.filter((w) => w.complete !== false).slice(-4).length * 7) {
      warn(`[usage] monthlyDays 与完整周数不一致`);
    }
  }
}

// ---------- topics (v1.4 hot topics) ----------
const topics = data.topics;
if (topics) {
  if (!Array.isArray(topics.items)) err(`[topics] items 应为数组`);
  else {
    if (topics.count !== undefined && topics.count !== topics.items.length) err(`[topics] count=${topics.count} 与数组长度 ${topics.items.length} 不一致`);
    if (topics.items.length > 20) warn(`[topics] 条目 ${topics.items.length} > 20`);
    const ids = new Set();
    topics.items.forEach((t, i) => {
      const tag = `[topics[${i}] ${t.id ?? "?"}]`;
      for (const k of ["id", "title", "source"]) if (!isStr(t[k])) err(`${tag} ${k} 缺失`);
      if (!/^https?:\/\//.test(t.url || t.hnUrl || "")) err(`${tag} url/hnUrl 至少一个为 http(s)`);
      if (!isIso(t.publishedAt)) err(`${tag} publishedAt 非法: ${t.publishedAt}`);
      if (!Number.isInteger(t.points) || t.points < 0) err(`${tag} points 应为非负整数`);
      if (!Number.isInteger(t.comments) || t.comments < 0) err(`${tag} comments 应为非负整数`);
      if (t.summary !== undefined && t.summary !== null && (!isStr(t.summary) || t.summary.length > 240)) err(`${tag} summary 应为 ≤240 字符串`);
      if (ids.has(t.id)) err(`${tag} id 重复`); else ids.add(t.id);
    });
  }
}

// ---------- stats consistency ----------
if (meta && meta.stats) {
  const expect = {
    models: models?.models?.length ?? null,
    news: news?.items?.length ?? null,
    boards: rankings?.boards?.length ?? null,
    resources: resources?.items?.length ?? null,
    projects: projects?.items?.length ?? null,
  };
  for (const [k, v] of Object.entries(expect)) {
    if (v !== null && meta.stats[k] !== v) err(`[meta.stats.${k}] 期望 ${v}，实际 ${meta.stats[k]}`);
  }
  if (meta.stats.orgs !== undefined && models?.models) {
    const orgs = new Set(models.models.map((m) => m.org)).size;
    if (meta.stats.orgs !== orgs) warn(`[meta.stats.orgs] 期望 ${orgs}，实际 ${meta.stats.orgs}`);
  }
}

// ---------- Data size limits (security hardening) ----------
if (existsSync(DATA)) {
  const jsons = readdirSync(DATA).filter((f) => f.endsWith(".json") && f !== "meta.json");
  let total = 0;
  for (const f of jsons) {
    const size = statSync(join(DATA, f)).size;
    total += size;
    if (size > 2 * 1024 * 1024) err(`[data:size] data/${f} 超过 2MB（${(size / 1024).toFixed(0)}KB）`);
  }
  if (total > 5 * 1024 * 1024) err(`[data:size] data/*.json 总计超过 5MB（${(total / 1024 / 1024).toFixed(2)}MB）`);
}

// ---------- Site structure (strict before release) ----------
const PAGES = ["index", "news", "rankings", "models", "resources", "projects", "skills", "about"];
for (const p of PAGES) {
  if (!existsSync(join(SITE, `${p}.html`))) {
    (STRICT ? err : warn)(`[site] ${p}.html 缺失`);
  }
}
for (const f of ["feed.xml", "feed.json"]) {
  if (!existsSync(join(SITE, f))) (STRICT ? err : warn)(`[site] ${f} 缺失（发布前需运行 build-feed.mjs）`);
}
if (existsSync(join(SITE, "feed.xml"))) {
  const xml = readFileSync(join(SITE, "feed.xml"), "utf8");
  if (!xml.includes("<rss") || !xml.includes("</rss>")) err(`[site/feed.xml] 不是合法 RSS`);
  if (xml.includes("undefined")) warn(`[site/feed.xml] 含 undefined 字样，请检查`);
}

// Local asset reference check (relative href/src must exist)
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
if (existsSync(SITE)) {
  for (const file of walk(SITE).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    const rel = file.slice(SITE.length + 1);
    for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|data:|javascript:|\/\/)/.test(target)) continue;
      if (target.startsWith("/")) continue; // Site-root absolute paths, isomorphic with the published structure
      const path = resolve(dirname(file), target.split("?")[0]);
      if (!existsSync(path)) warn(`[site/${rel}] 引用不存在的本地资源: ${target}`);
    }
  }
}
if (existsSync(join(SITE, "assets/js/data.js"))) {
  const src = readFileSync(join(SITE, "assets/js/data.js"), "utf8");
  if (!src.includes("./data/")) warn(`[site/assets/js/data.js] 未使用 ./data/ 路径（应为站点根相对，勿用 ../data/）`);
}

// ---------- Output ----------
const line = "─".repeat(64);
console.log(`\n${line}\n AI Pulse 数据合约校验（DATA-CONTRACT v1）\n${line}`);
for (const f of files) {
  const d = data[f];
  const count = d ? (d.models?.length ?? d.items?.length ?? d.boards?.length ?? "") : "缺失";
  console.log(`  ${f.padEnd(10)} ${d ? "✓" : "✗"}  ${d ? `${count} 条` : ""}`);
}
console.log(line);
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条`);
  warnings.forEach((w) => console.log("  - " + w));
}
if (errors.length) {
  console.log(`\n✗ 错误 ${errors.length} 条`);
  errors.forEach((e) => console.log("  - " + e));
  console.log(`\n校验失败（${errors.length} 错误 / ${warnings.length} 警告）\n`);
  process.exit(1);
}
console.log(`\n✓ 校验通过（${warnings.length} 警告${STRICT ? "，strict 模式" : ""}）\n`);
