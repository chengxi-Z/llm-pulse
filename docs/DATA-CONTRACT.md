# 数据合约（DATA-CONTRACT v1.0）

> 所有数据文件由 `scripts/fetch-data.mjs` 生成、`scripts/validate.mjs` 校验；前端只读。
> 修改合约 = 破坏兼容 → 必须 Lead 同意并升 `schemaVersion`。
> 时间统一 ISO 8601 UTC（`YYYY-MM-DDTHH:mm:ss.sssZ`）；价格单位 **USD / 1M tokens**；展示层负责本地化。

## 0. 通用约定
- 文件位置：`data/{meta,models,news,rankings,resources,projects}.json`
- 顶层必填：`schemaVersion`(number=1)、`generatedAt`(ISO)、`source`(string，生成模式或来源标识)
- 列表页数据均含 `updatedAt` 或可派生自 `generatedAt`；前端必须处理空数组与缺失字段。
- ID 规则：稳定 slug（小写、连字符/斜杠）或来源侧稳定 ID；不随抓取变化。
- 文本字段支持纯文本（不渲染 HTML）；`summary` ≤ 240 字。
- 可空字段用 `null` 或缺省；不要用空字符串占位。

---

## 1. `data/meta.json` — 站点元信息 / 数据源状态
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T12:00:00.000Z",
  "mode": "local",                       // "local" | "ci" | "seed"
  "site": { "name": "AI Pulse", "brand": "照胆云", "version": "1.0.0" },
  "stats": {
    "models": 451, "news": 24, "boards": 4, "resources": 18, "projects": 8,
    "orgs": 60, "sourcesOk": 9, "sourcesDegraded": 2
  },
  "sources": [
    {
      "id": "openrouter",
      "name": "OpenRouter Models API",
      "url": "https://openrouter.ai/api/v1/models",
      "type": "api",                     // api | dataset | rss | html
      "status": "ok",                    // ok | degraded | blocked
      "lastFetchedAt": "2026-11-03T12:00:00.000Z",
      "items": 451,
      "note": null
    }
  ],
  "latestHighlights": [                  // 首页速览用（可选，≤3 条）
    "OpenRouter 新增 12 个模型，GPT-6.1 Terra 上线",
    "LMArena 榜单更新：Top3 发生变化"
  ]
}
```
前端用途：首页数字卡、数据源状态灯、更新时间、关于页数据源列表。

---

## 2. `data/models.json` — 模型目录
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T12:00:00.000Z",
  "source": "openrouter+hf-mirror",
  "count": 451,
  "models": [
    {
      "id": "openai/gpt-6.1-terra-pro",        // 来源稳定 slug
      "name": "GPT-6.1 Terra Pro",
      "org": "OpenAI",
      "releaseDate": "2026-10-26",             // 可空
      "contextWindow": 1050000,                // tokens，可空
      "maxOutput": null,
      "modalities": ["text", "image"],         // text | image | audio | video | file
      "capabilities": ["tool-calling", "reasoning", "structured-output"], // 可空数组
      "openWeights": false,
      "license": null,                          // 如 "Apache-2.0"，可空
      "pricing": { "input": 1.0, "output": 5.0, "currency": "USD", "unit": "per_1m_tokens" },
      "links": { "official": null, "api": "https://openrouter.ai/openai/gpt-6.1-terra-pro", "hf": null },
      "description": "OpenAI 旗舰推理模型，1.05M 上下文", // ≤120 字，可空
      "sourceIds": ["openrouter"],
      "benchmarks": null                        // 可选 { "mmlu": 92.1, "swe": 71.0 }
    }
  ]
}
```
前端用途：模型库搜索/筛选/排序；新闻关联；助手上下文；首页"本周新模型"（按 releaseDate 倒序）。

---

## 3. `data/news.json` — 动态
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T12:00:00.000Z",
  "source": "openrouter-diff+official-rss",
  "items": [
    {
      "id": "release-openai-gpt-6-1-terra-pro",   // kind + 稳定键
      "title": "OpenAI 发布 GPT-6.1 Terra Pro：1.05M 上下文，$1/$5 每百万 tokens",
      "summary": "OpenAI 旗舰线更新，Terra 系列同时提供批量变体，价格约为 Pro 的一半。",
      "kind": "release",                          // release | benchmark | oss | pricing | research | policy
      "sourceName": "OpenRouter",
      "sourceUrl": "https://openrouter.ai/api/v1/models",
      "url": "https://openrouter.ai/openai/gpt-6.1-terra-pro",  // 可空→回退 sourceUrl
      "publishedAt": "2026-10-26T00:00:00.000Z",
      "tags": ["OpenAI", "推理", "长上下文"],
      "models": ["openai/gpt-6.1-terra-pro"],
      "importance": 3,                            // 1..3
      "lang": "zh"                                // zh | en
    }
  ]
}
```
前端用途：动态时间线、首页最新列表、Feed 生成、助手上下文、分享卡。

---

## 4. `data/rankings.json` — 排行榜
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T12:00:00.000Z",
  "source": "lmarena+artificialanalysis+livebench+opencompass",
  "boards": [
    {
      "id": "lmarena-text",
      "name": "LMArena 文本总榜",
      "description": "人类盲测偏好的 Elo 排名，衡量通用对话体验",
      "sourceName": "LMArena",
      "sourceUrl": "https://lmarena.ai/leaderboard",
      "updatedAt": "2026-11-01T00:00:00.000Z",
      "metric": { "name": "Arena Score", "unit": "elo", "higherIsBetter": true },
      "entries": [
        { "rank": 1, "model": "GPT-6.1 Terra Pro", "org": "OpenAI", "score": 1482, "scoreDisplay": "1482", "votes": 31200, "delta": null }
      ]
    }
  ]
}
```
规则：`rank` 连续从 1 开始（前端按数组顺序显示）；`scoreDisplay` 可为格式化字符串；`votes`/`delta` 可空；抓不到就整榜缺省并在 meta.sources 标 degraded。
前端用途：排行页 tab 切换、首页 Top 卡片、分享卡、助手上下文。

---

## 5. `data/resources.json` — 学习资源
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T12:00:00.000Z",
  "source": "curated",
  "items": [
    {
      "id": "huggingface-llm-course",
      "title": "Hugging Face LLM Course",
      "type": "course",                  // course | tutorial | paper | tool | awesome | video | book
      "level": "beginner",               // beginner | intermediate | advanced
      "lang": "en",                      // en | zh | multi
      "url": "https://huggingface.co/learn/llm-course",
      "author": "Hugging Face",
      "description": "从 Transformer 到微调与部署的系统课程，含 Notebook 实战。",
      "tags": ["LLM", "fine-tuning", "Transformers"],
      "free": true,
      "featured": true,
      "addedAt": "2026-11-03T00:00:00.000Z"
    }
  ]
}
```
前端用途：资源页筛选（类型/难度/语言/免费）、精选置顶、助手推荐。

---

## 6. `data/projects.json` — 项目展示
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T12:00:00.000Z",
  "source": "curated+github",
  "items": [
    {
      "id": "open-webui",
      "name": "Open WebUI",
      "owner": "open-webui",
      "url": "https://github.com/open-webui/open-webui",
      "repo": "open-webui/open-webui",   // 可空
      "summary": "自托管、功能丰富的 LLM Web 交互界面，支持 Ollama 与 OpenAI 兼容 API。",
      "tags": ["chat-ui", "self-hosted", "ollama"],
      "highlight": "社区最活跃的自托管 LLM 前端之一",
      "sourceType": "community",          // self | community
      "license": "MIT",
      "stars": 112000,                    // 可空
      "updatedAt": "2026-11-02T00:00:00.000Z",
      "why": "适合作为 AI 助手的参考实现"
    }
  ]
}
```
前端用途：项目页分区（自研/社区）、标签过滤、stars 排序；助手上下文。

---

## 6.1 `data/skills.json` — 技能库（v1.2 新增）

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-03T00:00:00.000Z",
  "source": "curated+github",
  "count": 8,
  "items": [
    {
      "id": "one-sentence-project",
      "name": "One-Sentence Project",              // 英文名（必填）
      "nameZh": "一句话交付项目",                     // 中文名（可选）
      "description": "…",                            // 英文一句话（必填）
      "descriptionZh": "…",                          // 中文一句话（可选）
      "category": "methodology",                     // methodology | data | writing | design | dev | research | other
      "author": "chengxi-Z",
      "repo": "chengxi-Z/llm-pulse",                 // 可空，owner/name
      "url": "https://…",                            // SKILL 文档/目录链接（必填）
      "license": "MIT",                              // 可空
      "stars": null,                                 // 可空，数字
      "updatedAt": "2026-11-03T00:00:00.000Z",
      "sourceType": "mine",                          // mine | official | community
      "tags": ["methodology", "agent-skill"],
      "featured": true,
      "lang": "en",                                  // en | zh | multi
      "whenToUse": "…", "whenToUseZh": "…",
      "whenNotToUse": "…", "whenNotToUseZh": "…",
      "install": { "target": "~/.dsh/skills/one-sentence-project", "command": "…" },
      "usageSteps": ["…"], "usageStepsZh": ["…"],
      "skillPath": "skills/one-sentence-project/SKILL.md"
    }
  ]
}
```
规则：双语字段以英文为主、`Zh` 后缀为中文；前端按语言取、缺失回退另一语言；UI chrome 走 i18n 词典，数据不机翻。校验：`count` 与数组一致；`id` 唯一；`sourceType`/`category`/`lang` 枚举合法；`url` 为 http(s)；`stars` 数字或 null；`repo` 为 `owner/name`；`install.target` 非空；`usageSteps` 数组（可为空数组）。

---

## 6.2 `data/topics.json` — 真实热榜话题（v1.4 新增）

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-04T00:00:00.000Z",
  "source": "hn-ai",
  "count": 10,
  "items": [
    {
      "id": "hn-<objectID>",              // 来源稳定 id
      "title": "AI isn't replacing SREs, it's deskilling them",
      "url": "https://newsletter.signoz.io/...",   // 原文链接（可空→回退 HN 讨论链接）
      "hnUrl": "https://news.ycombinator.com/item?id=...",
      "domain": "newsletter.signoz.io",
      "points": 680,
      "comments": 501,
      "publishedAt": "2026-11-03T12:00:00.000Z",
      "summary": "讨论摘要：首条高赞评论清洗后的纯文本，≤160 字符；拿不到则用标题/来源说明。",
      "source": "Hacker News",
      "tags": ["AI", "SRE"]              // 可空
    }
  ]
}
```
规则：仅公开数据；`summary` 必须纯文本（去标签/实体/空白）；`url`/`hnUrl` 仅 http(s)；`points/comments` 非负整数；`publishedAt` ISO；排序按 points 降序；`count` 与数组一致。采集失败时保留最近快照并标 degraded，前端空态降级。前端渲染必须转义并 `rel="noopener noreferrer"`。

---

## 6.3 `data/usage.json` — Token 处理量（v1.5 新增）

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-07T00:00:00.000Z",
  "source": "openrouter-rankings",
  "sourceLabel": "OpenRouter token volume",
  "granularity": "week",
  "weeks": [
    { "weekStart": "2026-08-17", "tokens": 93377577206324 }
  ],
  "monthlyTokens": 705983934282100,
  "monthlyDays": 28,
  "note": "OpenRouter public rankings chart: weekly tokens processed across its API."
}
```

规则：`weeks` 按 `weekStart` 升序、最多 12 周；`tokens` 为该周 OpenRouter 全站处理 token 数（prompt+completion 等所有 series 求和）；`monthlyTokens` = 最近 4 个整周之和，`monthlyDays` 对应天数。数据来自 OpenRouter 公开 API（`/api/frontend/v1/rankings/model-rankings-chart`），**公开粒度是周，不是日**；首页 KPI 使用 `monthlyTokens`，悬停趋势图使用 `weeks`。

---

## 7. 前端契约（DOM / 文件挂钩）
- 所有页面共享 `<header>` 导航；导航项：首页/动态/排行/模型库/学习资源/项目/关于；右下角 `#assistant-root` 由 `assistant.js` 挂载。
- 每页 `<body data-page="index|news|rankings|models|resources|projects|about">`。
- 所有页面 `<head>` 引入顺序固定：
  1. `assets/css/theme.css` → 2. `assets/css/base.css` → 3. `assets/css/components.css` → 4. `assets/css/assistant.css` → 5. `assets/css/share.css`
  6. 页尾：`assets/js/data.js`（fetch + cache + 工具函数，ESM）→ 页面脚本（`app.js` / 各页内联 ESM 或 `render.js`）→ `assets/js/share.js` → `assets/js/assistant.js`（均为 ESM，`type="module"`）
- 约定全局挂载点/属性：
  - `#stat-models`, `#stat-news`, `#stat-updated`, `#sources-status`（首页统计）
  - `#news-list`, `#news-filters`, `#news-search`；`#rankings-tabs`, `#rankings-board`；`#models-table`, `#models-filters`, `#models-search`；`#resources-grid`, `#resource-filters`；`#projects-grid`
  - 分享：元素加 `data-share` 属性（含 `data-share-title/url/desc`），由 `share.js` 事件委托；分享卡根节点 `#share-card-canvas`（离线 canvas）
  - 助手：`#assistant-root`（assistant.js 创建按钮/抽屉/设置）、`#assistant-launch`
- `data.js` 导出：`loadAll()` → `{meta, models, news, rankings, resources, projects}`；`fmtNumber`、`relativeTime`、`escapeHtml`、`debounce`；**数据路径固定为 `./data/*.json`（站点根相对）**。本地 `scripts/serve.mjs` 将仓库根 `data/` 映射到 `/data/`；发布时 `scripts/stage-site.mjs` 把 `data/` 复制进站点产物根。因此仓库中不存在 `site/data/`，不要在该路径写文件。
- 空/错态：数据不存在或 fetch 失败时，列表容器显示统一空态组件（`.empty-state`），文案「数据加载中/暂不可用」；页面不得白屏。
- 日期展示用本地时区、`YYYY.MM.DD` 风格；数字加千分位；价格 `$x.xx / 1M`。

---

## 8. 校验规则（`scripts/validate.mjs` 必须检查）
1. 六个文件存在、JSON 可解析、`schemaVersion===1`、`generatedAt` 可解析。
2. 必填字段非空（按本合约）；数组元素必填字段完整。
3. 枚举值合法（kind/type/level/lang/sourceType/status/modalities）。
4. 数字字段类型正确、非负；pricing 可空但存在时结构完整。
5. 引用一致性：news.models ⊆ models.id；rankings entries 数量 ≥1（若榜单存在）；projects.repo 存在时为 `owner/name` 格式。
6. 数量保护：models ≥ 50（CI/local 真实数据时；seed 模式放宽）、resources ≥ 10、news ≥ 5。
7. 生成时间不晚于当前时间 +5 分钟；警告：数据超过 8 天未更新（`refresh-data` 周度刷新 + 1 天缓冲）。
8. 跨文件统计与 `meta.stats` 一致（模型数等）。
