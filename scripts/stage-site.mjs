#!/usr/bin/env node
/**
 * Assemble the GitHub Pages artifact into _artifact/:
 *   _artifact/       <- contents of site/ (index.html, assets/, feed.xml, ...)
 *   _artifact/data/  <- contents of repository data/ (the frontend reads ./data/*.json)
 *
 * Usage: node scripts/stage-site.mjs
 */
import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE = join(ROOT, "site");
const DATA = join(ROOT, "data");
const OUT = join(ROOT, "_artifact");

if (!existsSync(join(SITE, "index.html"))) {
  console.error("✗ site/index.html 不存在，无法组装发布产物");
  process.exit(1);
}
if (!existsSync(DATA)) {
  console.error("✗ data/ 不存在，无法组装发布产物");
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(SITE, OUT, { recursive: true });
await cp(DATA, join(OUT, "data"), { recursive: true });
// Raw fetch snapshots are for local debugging/testing only and never ship in the release artifact
await rm(join(OUT, "data", "snapshot"), { recursive: true, force: true });

// Guard: site/ must not contain a data/ copy (it would conflict with the mapping)
const stagedSiteData = join(SITE, "data");
if (existsSync(stagedSiteData)) {
  console.warn("⚠ site/data 存在，请移除（数据统一由 stage 脚本从仓库根 data/ 复制）");
}

const pages = (await readdir(OUT)).filter((f) => f.endsWith(".html"));
const feeds = ["feed.xml", "feed.json"].filter((f) => existsSync(join(OUT, f)));

// ---- SEO: robots.txt + sitemap.xml (generated in the artifact, source files are not committed) ----
const SITE_BASE_URL = (process.env.SITE_BASE_URL || "https://chengxi-z.github.io/llm-pulse/").replace(/\/?$/, "/");
const { writeFile } = await import("node:fs/promises");
const today = new Date().toISOString().slice(0, 10);
const pageList = pages.filter((p) => p !== "404.html");
const urls = pageList
  .map((p) => {
    const loc = p === "index.html" ? SITE_BASE_URL : `${SITE_BASE_URL}${p}`;
    return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${p === "index.html" ? "1.0" : "0.8"}</priority></url>`;
  })
  .join("\n");
await writeFile(
  join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  "utf8"
);
await writeFile(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_BASE_URL}sitemap.xml\n`, "utf8");

console.log(`✓ _artifact 已生成`);
console.log(`  pages: ${pages.join(", ")}`);
console.log(`  feeds: ${feeds.length ? feeds.join(", ") : "（缺失：请先运行 node scripts/build-feed.mjs）"}`);
console.log(`  data:  ${(await readdir(join(OUT, "data"))).join(", ")}`);
console.log(`  seo:   robots.txt, sitemap.xml (${pageList.length} urls, base=${SITE_BASE_URL})`);
