# One-Sentence Prompts and Expected Deliverables

Five domain adaptations of the same method. Each entry is a copy-paste prompt in
Chinese and English, followed by the deliverables the skill should produce and
the domain mapping that replaces the generic contract layers.

Use a prompt **as the whole user request** to test the skill end to end, or as a
template and edit the domain, sources and pages. Schedule: daily by default;
change to weekly when the source updates slowly.

Reminder: every prompt below is assumed to include "publish it publicly" -
without a publish target the method stops at a local demo.

---

## 1. LLM progress tracker (reference domain)

**中文（可直接复制）**

> 持续关注大模型（LLM）最新进展，设计一个公域、轻量、轻奢主题的网站，展示模型动态 / 评测排行 / 学习资源 / 项目展示，内置 AI 助手，数据自动更新，最后发布到 GitHub Pages。

**English (copy-paste)**

> Continuously track the latest progress in large language models: build a
> public, lightweight, light-luxe themed website showing model releases,
> public leaderboard rankings, learning resources and a project showcase, with a
> built-in BYOK AI assistant and automatic data refresh; publish it on GitHub
> Pages.

**Expected deliverables**

| Deliverable | Detail |
| --- | --- |
| Requirements spec | goals, measurable targets, explicit non-goals, decision log |
| Data contract v1 | entities = models; news = releases/pricing/research; rankings = public leaderboards; resources; projects; metadata with source status |
| POC report | source matrix (OpenRouter-style catalog API, public leaderboards, official RSS), degradation evidence |
| Static site | home, updates, rankings, model library, resources, projects, about; 5 themes, responsive, a11y |
| AI assistant | BYOK streaming + offline catalog Q&A + "weekly brief" |
| Refresh pipeline | Node scripts, snapshots, per-source `ok/degraded/blocked`, daily Actions cron |
| Release | public repo, CI, GitHub Pages, RSS/JSON feed, acceptance report with evidence |

Suggested sources: a model catalog API for first-party facts, official vendor
blogs/RSS for updates, public benchmark datasets for rankings, a GitHub API for
project stars.

---

## 2. Open-source ecosystem radar

**中文（可直接复制）**

> 帮我做一个开源生态雷达：跟踪 Rust async 生态里最活跃的 30 个项目，网页展示 star 趋势、最近发版和标签筛选，支持 RSS 订阅，每天自动更新并发布到 GitHub。

**English (copy-paste)**

> Build an open source ecosystem radar: track the 30 most active projects in the
> Rust async ecosystem, show star trends, recent releases and tag filters on a
> public page with an RSS feed, refresh daily and publish it.

**Expected deliverables**

| Deliverable | Detail |
| --- | --- |
| Contract mapping | entities = repositories; news = releases and notable issues; resources = learning links; projects = the tracked repos themselves |
| Pipeline | GitHub API with token in CI, unauthenticated rate-limit degradation in local mode, star snapshot diffing |
| Site | radar home with trend sparkline, repo table with filters, release timeline, feed |
| Quality gates | rate-limit fallback evidence, no stale stars presented as live, link checks |
| Release | repo + CI + Pages + daily cron, acceptance report |

Watch out for: GitHub API limits (60/h unauthenticated vs ~5000/h with token),
renamed repositories (stable IDs), and star counts that move slowly enough that
daily refresh is enough.

---

## 3. Paper radar

**中文（可直接复制）**

> 做一个多模态推理方向的论文雷达：每天从公开论文 API 抓新论文，按主题分组，展示标题/摘要/作者/代码链接，支持搜索和近 7 天过滤，带周报摘要，发布成公网站点。

**English (copy-paste)**

> Build a paper radar for multimodal reasoning: fetch new papers from a public
> paper API daily, group them by topic, show title / abstract / authors / code
> links with search and a last-7-days filter, generate a weekly digest, and
> publish it as a public site.

**Expected deliverables**

| Deliverable | Detail |
| --- | --- |
| Contract mapping | entities = papers; news = notable papers/digests; rankings = optional venue or citation boards; resources = reading lists |
| Pipeline | public paper API or dataset, daily window, dedupe by stable paper ID, plain-text abstract truncation |
| Site | topic groups, search, date filter, weekly digest block, provenance links |
| AI assistant | offline retrieval over the shipped paper catalog (no key needed), optional BYOK summarizing |
| Quality gates | no invented abstracts, source URL per paper, deterministic ordering |

Watch out for: abstract copyright (store short summaries with attribution, not
full text), duplicate versions of the same paper, and topics that need a human
taxonomy review.

---

## 4. Policy tracker

**中文（可直接复制）**

> 跟踪各国 AI 监管政策的公开更新，做一个可搜索的时间线网站，每条标注发布机构、日期和原文链接，支持中英切换和 RSS，每周自动更新并上线。

**English (copy-paste)**

> Track public AI regulation updates across jurisdictions, build a searchable
> timeline site where each item shows the issuing body, date and official
> source link, with Chinese/English switching and RSS, refreshed weekly and
> published online.

**Expected deliverables**

| Deliverable | Detail |
| --- | --- |
| Contract mapping | entities = jurisdictions/bodies; news = policy updates; resources = explainers; rankings usually empty (do not invent scores) |
| Pipeline | RSS + public HTML adaptation, provenance-heavy normalization, conservative summaries |
| Site | timeline with jurisdiction filters, search, language switch, disclaimer page |
| Quality gates | every item links to an official page; no editorializing beyond source; removal contact |
| Release | repo + CI + weekly cron + Pages, acceptance report |

Watch out for: legal sensitivity, pages that change shape often, and the
temptation to summarize policy content inaccurately. When in doubt, show the
official title and link, and write a neutral note.

---

## 5. Competitor watch

**中文（可直接复制）**

> 监控这五家竞品的公开 changelog 和定价页，做一个每周摘要站点：展示更新对比、价格变化和来源链接，内部先用但可以公开发布，数据自动更新。

**English (copy-paste)**

> Monitor the public changelogs and pricing pages of five competitors, and build
> a weekly digest site showing update comparisons, price changes and source
> links; refresh automatically and publish it (it may start as a lightweight
> public site).

**Expected deliverables**

| Deliverable | Detail |
| --- | --- |
| Contract mapping | entities = competitors/products; news = changelog entries; rankings = optional price comparison (label it as derived); projects = not used |
| Pipeline | public changelog/pricing pages, snapshot diff to detect changes, conservative change notes |
| Site | weekly digest, per-competitor timeline, price table with provenance |
| Quality gates | clearly label derived comparisons; never present competitor claims as facts; check terms of use |
| Release | repo + CI + Pages + weekly cron, acceptance report |

Watch out for: pages with bot protection, prices that differ by region, and
publishing internal analysis publicly. Confirm the user owns the right to
republish the collected material before making the site public.

---

## What every prompt should produce (acceptance reminder)

Regardless of domain, a successful run ends with:

1. a requirements spec with explicit non-goals;
2. a six-file data contract (`schemaVersion: 1`) and a passing validator;
3. a POC report with a source matrix and degradation evidence;
4. a static site with real data, empty/degraded states and responsive layout;
5. tests and CI that run on every push;
6. a scheduled refresh workflow and a public release URL;
7. an acceptance report listing evidence and known limitations.

If any of items 1-7 is missing, the run is not complete - say so instead of
declaring success.
