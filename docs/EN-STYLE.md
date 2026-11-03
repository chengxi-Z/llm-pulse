# English Style Guide — AI Pulse · 照胆云

> Scope: all English UI copy (`site/assets/i18n/en.json`), `README.en.md`, `CONTRIBUTING.md`,
> JSDoc/comments, commit messages, and assistant/share content templates.
> Owner: `i18n-en`. Last updated: v1.1.0.
>
> Chinese is the source of truth for UI copy (`zh.json`). English must say the same thing in
> idiomatic, native-sounding American English — never a word-for-word rendering of the Chinese.

---

## 1. Dictionary contract

| Item | Rule |
|---|---|
| Files | `site/assets/i18n/zh.json` (source of truth) and `site/assets/i18n/en.json` |
| Shape | One flat JSON object; **no nested objects**. Keys are dot-separated namespaces. |
| Key parity | `zh.json` and `en.json` must contain **exactly the same key set** — no missing, no extra keys. |
| Values | Non-empty strings. No HTML (the engine sets `textContent`), no `data-i18n-html`. |
| Fallback | Missing English value falls back to Chinese, then to the key. English mode must never rely on this fallback for shipped UI. |
| Interpolation | `{name}` placeholders only. The placeholder set of a key must be identical in both languages. |
| Board names | Leaderboard display names are mapped with `board.<board-id>.name` / `board.<board-id>.desc`; unknown board ids fall back to the source data (Chinese is acceptable there, it is data). |
| Page metadata | `page.<page>.title` / `page.<page>.desc` for `<title>`, `meta[description]`, Open Graph and Twitter cards. |
| Validation | `node scripts/check-i18n.mjs --strict` must pass. It also reports unused keys. |

### 1.1 Namespaces

`nav.*` `ui.*` `theme.<id>.label` `page.<page>.title|desc` `meta.*` `home.*` `news.*`
`rankings.*` `models.*` `compare.*` `resources.*` `projects.*` `about.*` `notFound.*` `footer.*`
`subscribe.*` `source.*` `empty.*` `error.*` `data.*` `board.<board-id>.name|desc`
`dashboard.*` (`.kpi` `.releases` `.pricePie` `.scatter` `.topics` `.carousel`) `assistant.*` `share.*`

Legacy/coined aliases still present in the dictionaries but not used by markup (e.g.
`models.compare.*`, `dashboard.killLine2.rule`) are cleaned up at release freeze; never add new
keys in a deprecated namespace — use the current family listed above.

Keys are `lowerCamelCase` per segment; ids (`<board-id>`, theme ids, page ids) stay kebab-case
or lowercase exactly as used by the data layer. Never rename a key in only one language.

### 1.2 Adding or changing a string

1. Add the key to **both** dictionaries in the same change (zh first, then en).
2. Use `{placeholder}` names that already exist when possible: `{count}` `{name}` `{date}`
   `{time}` `{year}` `{model}` `{board}` `{status}` `{total}` `{used}` `{size}` `{query}`.
3. Run `node scripts/check-i18n.mjs --strict`.
4. Vocabulary: if the string introduces a new AI/technical term, add it to §3 of this file.
5. Never translate data payloads (model names, news titles, resource/project descriptions,
   source names) in the dictionaries — they stay as published; only UI labels are translated.

---

## 2. Voice and tone

- **Editorial, restrained, precise.** The site is a quiet intelligence digest, not a growth
  landing page. Short declarative sentences. No hype words (*revolutionary*, *game-changing*,
  *cutting-edge*), no exclamation marks, no emoji.
- **Informative confidence.** State what the data shows and where it comes from. Prefer
  "Public sources, updated daily" over "Always fresh!".
- **Second person sparingly.** Address the reader as "you" in instructions and empty states
  ("Try a different filter"), but keep descriptions impersonal.
- **Site voice = "we"** only where the Chinese uses 我们 (about page, methodology).
- **No Chinese sentence structures carried over.** Avoid stacked "of/for/with" phrases and
  "the … of the …" chains; rewrite as a native English sentence. See §8 for anti-patterns.
- **No marketing superlatives** that the data cannot back up. Rankings are "aggregated", not
  "the definitive ranking of AI".

### 2.1 Sentence case

Use sentence case for almost everything: navigation labels, headings, buttons, table headers,
options, tooltips. Exceptions: proper nouns and product names (`AI Pulse`, `GitHub Actions`,
`JSON Feed`, `OpenAI`), acronyms (`LLM`, `API`, `RSS`, `CSS`, `ESM`, `BYOK`, `USD`, `MIT
License`), and theme display names (see §3.3). Do not title-case menu items.

---

## 3. Terminology (authoritative glossary)

Use these renderings consistently. When a Chinese term is not listed, prefer the most common
industry spelling (US English) and add it to this table in the same change.

### 3.1 Models and evaluation

| Chinese | English (use this) | Notes / do not use |
|---|---|---|
| 大模型 / 模型 | LLM, model | "LLM" when the context is language models; "model" generically. Never "large model". |
| 模型库 | model catalog, model library | Page name: **Model Catalog**. In prose "model catalog". |
| 厂商 / 机构 | provider, organization | "vendor" only for pricing/API context; "lab" for research labs (e.g. "AI lab"). |
| 上下文 / 上下文窗口 | context / context window | "context length" only when referring to the number; prefer "context window". |
| 开源权重 | open weights | Adjective: "open-weight models". **Never** equate with open source: 开源权重 ≠ 开源. |
| 闭源 | proprietary, closed-weight | Use "proprietary" for models; "closed-weight" when contrasting weights. |
| 开源（软件/项目） | open source / open-source | Hyphenate as modifier ("open-source project"). |
| 推理（能力） | reasoning | "inference" only for model serving/compute, never for the capability. |
| 推理（服务） | inference | e.g. "inference cost". |
| 模态 | modality | "text / image / audio / video / file" modalities. |
| 多模态 | multimodal | One word, no hyphen. |
| 工具调用 | tool calling, function calling | Prefer "tool calling"; "function calling" when that is the API name. |
| 结构化输出 | structured output | |
| 长上下文 | long context | Modifier: "long-context model". |
| 流式（输出） | streaming | |
| 榜单 / 排行 | leaderboard, ranking, board | Page name: **Leaderboards**. Individual board: "leaderboard". "Ranking" for a position/table. |
| 指标 | metric | "Score" only when the source metric is literally called score. |
| 基准 / 评测 | benchmark / evaluation | "Benchmark" for datasets/tests; "evaluation" for the activity or vendor re-runs. |
| 分数 / 得分 | score | |
| 胜率 | win rate | |
| 准确性 / 正确率 | accuracy | |
| 排名 | rank | Column header: "Rank". |
| 票数 | votes | |
| 变化 | change | Column header: "Change". |
| 越高越好 / 越低越好 | higher is better / lower is better | |
| 口径 | methodology, definition | "scoring methodology"; avoid "caliber". |
| 评测机构 | evaluation lab, benchmark author | |
| 智能指数 | intelligence index | Keep the source product name (e.g. "AA Intelligence Index"). |
| 能力指数 | capability index | |
| 令牌 / Token | token | Lowercase; price unit: "per 1M tokens". |
| 价格 / 定价 | pricing, price | "input/output pricing". |
| 输入 / 输出价格 | input / output price | |
| 每百万 tokens | per 1M tokens | Matches the site unit `USD / 1M tokens`. Capital `M`, never "million tokens" in labels. |
| 免费 / 付费 | free / paid | |
| 上下文长度 | context length | Only for the numeric value. |

### 3.2 Product and engineering

| Chinese | English | Notes |
|---|---|---|
| 纯静态 | static | "a static site"; "no backend". |
| 无追踪 / 无第三方追踪 | no tracking / no third-party tracking | |
| 无需登录 | no account required, no sign-in | |
| 数据源 | data source, source | Table header: "Source". |
| 采集 / 抓取 | fetch, collect | "data pipeline"; "crawler" only for HTML scraping sources. |
| 归一化 | normalize, normalization | |
| 数据合约 | data contract | |
| 降级 / 不可达 | degraded / unavailable | Source status labels: **Degraded**, **Unavailable**. Also "blocked" is acceptable for network-blocked sources in dev docs only, not in UI. |
| 空态 | empty state | |
| 更新时间 / 更新于 | updated / last updated | "Updated Jul 12, 2026". |
| 生成时间 | generated | "generated at …". |
| 示例数据 | sample data | |
| 数据模式 | data mode | |
| 订阅 | subscribe | "RSS / Atom", "JSON Feed" keep product spelling. |
| 推送 | notifications, feed updates | Avoid "push" unless referring to browser push (not implemented). |
| 分享 | share | |
| 分享卡 | share card | |
| 复制链接 | copy link | Past tense toast: "Link copied". |
| 主题 | theme | |
| 跟随系统 | System | Theme option label; "Follow system" only in documentation. |
| 语言切换 | language switcher | |
| 回顶按钮 / 回到顶部 | Back to top | aria-label and title both "Back to top". |
| 无障碍 | accessibility | |
| 快捷键 | keyboard shortcut | |
| 密钥 / API Key | API key | "API key" in prose; input label `apiKey` stays camelCase. |
| 离线模式 | offline mode | |
| 在线模式 | online mode | |
| 简报 / 周报 | brief, weekly brief | Template title: "This Week in AI — AI Pulse Brief". |
| 站点数据摘要 | site data summary | |
| 上下文（助手注入） | injected context | |
| 远程端点 | endpoint | "OpenAI-compatible endpoint". |
| 依赖 | dependency | "zero dependencies". |
| 仓库 | repository, repo | |
| 许可证 | license | "MIT License" with capital L as a product name; "license" lowercase generically. |
| 免责声明 | disclaimer | |
| 学习资源 | learning resources, resources | Page name: **Learning Resources**. |
| 项目 | project | Page name: **Projects**. |
| 自研项目 | in-house projects | Do not say "self-developed". |
| 社区精选 | community picks | |
| 课程 / 教程 / 论文 / 书籍 / 工具 | course / tutorial / paper / book / tool | |
| 入门 / 进阶 / 高级 | beginner / intermediate / advanced | Not "entry/advanced level". |
| 英文 / 中文 / 多语 | English / Chinese / Multilingual | |
| 重要动态 | important updates, highlights | Importance label: "Important". |
| 发布（品类） | release | News kind: **Release**. |
| 评测（品类） | evaluation | News kind: **Evaluation**. |
| 价格（品类） | pricing | News kind: **Pricing**. |
| 研究 / 政策（品类） | research / policy | News kinds: **Research**, **Policy**. |
| 动态 | updates, news | Page name: **Updates**. In prose: "updates" or "news". "Dispatch" only for the editorial section title. |
| 本期要目 | In this issue | |
| 每日纪要 | Daily dispatch | Editorial section label. |
| 观察 / 观察志 | journal, observations | "The LLM Journal" for 大模型观察志. |
| 智能纪事 | chronicle, record | Brand tagline; use "a chronicle of intelligence". |
| 新近收录 / 本周新模型 | new arrivals / new this week | |
| 收录 | included, cataloged | "models cataloged". |
| 探索 | explore | Footer column. |
| 关于 | about | |
| 首页 | home | |

### 3.3 Theme names (fixed display names)

| Theme id | Chinese | English (fixed) |
|---|---|---|
| `ivory` | 纸墨雅金 | Ivory & Gold |
| `noir` | 深夜鎏金 | Midnight Noir |
| `jade` | 青瓷墨绿 | Celadon Jade |
| `rose` | 暮云玫瑰 | Dusk Rose |
| `graphite` | 极简石墨 | Graphite |
| `auto` | 跟随系统 | System |

Theme names are design names: keep the capitalization above and do not translate them freely.

### 3.4 Data-source and brand names

Keep published brand spellings unchanged: `OpenRouter`, `LMArena`, `Artificial Analysis`,
`LiveBench`, `Epoch AI`, `OpenCompass`, `Hugging Face`, `GitHub`, `OpenAI`, `Anthropic`,
`Google DeepMind`, `DeepSeek`, `Qwen`, `Moonshot AI`, `Z.ai`, `MiniMax`, `SiliconFlow` (硅基流动
in Chinese UI; in English UI use "SiliconFlow"). Chinese brands may remain Chinese only where
they are data values; in UI copy prefer the English brand name.

---

### 3.5 Dashboard, skills and distribution terms (v1.2)

| Chinese | English (use this) | Notes / do not use |
|---|---|---|
| 概览 / 仪表盘 | Overview / dashboard | Page section label: "Overview"; aria-label "Overview dashboard". |
| KPI / 数字墙 | KPI / data wall | Keep "KPI" (widely understood); never "data wall" in UI copy itself. |
| 收录模型 | Models cataloged | KPI label. |
| 累计上下文容量 | Total context capacity | "context capacity" is our unit for sum(contextWindow). |
| 近 7 天新增模型 | New in the last 7 days | Hint: "Last {n} days". |
| 公开榜单 | Public leaderboards | |
| 数据源正常 | Sources healthy | Hint: "Refreshed daily". |
| 动态条目 | Update entries | |
| 覆盖 N 家厂商 | Across {n} providers | "provider", not "vendor" or "organization" in dashboard hints. |
| 趋势 / 折线图 | trend / sparkline | "12-week release trend". |
| 厂商分布 | Provider distribution | Title: "Providers — top 8". |
| 价格分层 | Price tiers | "Output price tiers"; tiers: Free / <$1 / $1–5 / $5–15 / ≥$15. |
| 未公开价格的模型 | models without published pricing | Footnote, sentence case. |
| 技能 | skill | Lowercase in prose; "My Skills" for the page title. |
| Agent Skills / Playbooks | Agent Skills / playbooks | Keep the English terms; skill = a reusable agent capability. |
| 使用引导 | usage guide | Modal title: "{name} · Usage guide". |
| 安装 / 安装目录 | install / install target | Not "install directory". |
| 触发示例 | trigger example | |
| 自检命令 | self-check command | |
| 文件结构 | file structure | |
| 来源徽标 | source badge | Badges: Mine / Official / Community (capitalized in UI). |
| 我的 / 官方 / 社区 | Mine / Official / Community | |
| 提交你的技能 | Submit your skill | "Submit a skill" in prose. |
| 审核标准 | review criteria | |
| 路径一 / 二 / 三 | Option 1 / 2 / 3 | |
| 分享本榜 | Share this board | | 
| 复制站点地址 | Copy site address | |
| 二维码 / 扫码访问 | QR code / Scan to visit | |
| 地址区 | address block | |
| 溯源 | traceable sourcing, attribution | "for traceable forwarding" in card hints. |
| 分发 / 传播 | distribution | Playbook: "distribution playbook". |

Additional rules for data-like UI values:

- Dashboard numbers come from `Intl.NumberFormat`; KPI values show no units in the big number —
  units live in the label or hint ("451" + "Models cataloged"; "1.6B tokens" for capacity).
- Provider names are data: keep source spelling (OpenAI, Z.ai, Qwen, ...).
- Price-tier labels are fixed tokens (`Free`, `<$1`, `$1–5`, `$5–15`, `≥$15`) and must match
  exactly in both languages (zh: 免费 / <$1 / $1–5 / $5–15 / ≥$15).
- Skill names/descriptions are data (English primary + `*Zh` fields); only UI chrome lives in the
  dictionaries. Never translate skill names or author handles.
- "12-week" and "top 8" are lowercase in running copy; use an en dash for number ranges in prose.

### 3.6 Chart, kill-line and hot-topic terms (v1.3)

| Chinese | English (use this) | Notes / do not use |
|---|---|---|
| 柱状图 / 12 周发布 | bar chart / 12-week releases | "12-week release bar chart". |
| 周均 N 个 | N per week on average | Mean-line label; keep `{n}` as a placeholder. |
| 环形饼图 | donut chart | One word "donut"; never "doughnut" in UI. |
| 图例 | legend | |
| 已标价 / 未标价 | priced / unpriced | "models without public pricing are excluded". |
| 斩杀线 | kill line | **Fixed term**; lowercase "kill line" in running copy, "The AI model kill line" as a title. |
| 生存区 / 斩杀区 | survival zone / kill zone | |
| 中位数 / P50 | median / P50 | "median (P50) output price"; include P50 at least once. |
| 对数刻度 | log scale | "log-scale price axis". |
| 输出价格 | output price | Unit: "USD / 1M output tokens". |
| 免责声明（非质量评价） | disclaimer (not a quality judgment) | Canonical: "The kill line is a price-distribution statistic only; not a quality, capability or recommendation judgement." Use one spelling of "judgement/judgment" consistently within a release. |
| 话题热榜 | hot topics / topic ranking | Title: "AI hot topics"; accessible label "AI hot-topics ranking". |
| 热度条 | heat bar | |
| 统计窗口 / 口径 | window / methodology | "Window: last 60 days". |
| 非全网热度 | not global web heat | Avoid implying real-world trend data. |
| 去看 | View | Link label; aria: `View updates for "{topic}"`. |
| 话题筛选 / 清除话题筛选 | topic filter / clear topic filter | |
| 来自话题热榜 | From the topic ranking | Banner label with `{tag}`. |

Additional v1.3 rules:

- Kill-line copy must always state the rule (median P50 output price) and that it is **not** a
  quality, capability or recommendation judgment; never shorten this to a bare ranking claim.
- Percentages in charts use one decimal place at most (`52.3%`); counts use `Intl.NumberFormat`.
- Bar/donut/heat-bar labels are sentence fragments without trailing periods; footnotes are full
  sentences.
- Chart tooltips use the form `Week of MM.DD · N new models` and `{model} · output {price}/1M`.
- "AI model kill line" is a coined metaphor: keep it in English copy (no translation such as
  "cut-off line", "death line" or "threshold line").

### 3.7 Comparison, kill line 2.0, HN topics and carousel (v1.4)

| Chinese | English (use this) | Notes / do not use |
|---|---|---|
| 模型对比 / 对比栏 | model comparison / comparison bar | Never "versus table" or "diff"; the view is a "comparison table". |
| 已选 N / 最多 M | N / M selected | Keep the slash form; max is 6. |
| 归一化匹配 | normalized-name matching | "matched by normalized model name"; "normalised" is British — use "normalized" file-wide. |
| 未匹配 | not matched | Display value: `—` (em dash), never "N/A" or "0". |
| 能力评分 | capability score | "score" alone is fine in the table. |
| 输入价 / 输出价 | input price / output price | Unit: `$/1M`. |
| AA 智能指数 | AA Intelligence Index | Fixed metric name; keep "AA" (Artificial Analysis) as sourced. |
| 斩杀线 2.0 | kill line 2.0 | Same coined metaphor; never "death line". |
| 能力斩杀线 | ability kill line | Contract UI copy uses "ability kill line" (not "capability"). |
| 成本斩杀线 | cost kill line | |
| 四象限 | quadrants | "capability × cost quadrants". |
| 生存区 | survival zone | v1.4 copy: "Survival · high ability, low cost". |
| 高成本区 / 低能力区 | high-cost zone / low-ability zone | Lowercase in running copy. |
| 斩杀区 | kill zone | v1.4 copy: "Kill zone · high cost, low ability". |
| 样本：N 个已匹配模型 | Sample: N matched models | Keep "matched" — not "sampled". |
| 热搜话题 | hot topics | Real Hacker News discussions, not global search trends. |
| Hacker News / HN | Hacker News, HN | First mention: "Hacker News (HN)"; use "HN" only inside compact labels. |
| points / comments | points / comments | Lowercase units: `680 points · 501 comments`. **zh UI**: `680 热度 · 501 条评论` — never mix the English word "points" into Chinese copy. |
| 讨论摘要 | discussion summary | "a 1–2 line discussion summary". |
| 按 points 排序 | sorted by points | Not "sorted by heat". zh UI: 按热度排序. |
| 非全网热搜 | not a global search trend | Required methodology disclaimer. |
| 轮播 | carousel | "chart carousel"; "autoplay" one word. |
| 上一张 / 下一张 | Previous / Next | |
| 暂停自动轮播 / 继续自动轮播 | Pause autoplay / Resume autoplay | |
| 第 N 张 | Slide N of M | |
| 悬停暂停 | hover pauses | |
| 首屏内容可见 | content above the fold | Hero-slimming audit term; not "first screen visibility". |
| CSP / 内容安全策略 | CSP (Content-Security-Policy) | Expand on first use in security docs. |
| 密钥 | API key | "BYOK" for the bring-your-own-key model; never "token" for a user key. |

Additional v1.4 rules:

- Comparison copy must always state the matching rule (normalized model names) and that unmatched
  values show `—` and are never fabricated; do not hide the rule in a tooltip only.
- Kill-line 2.0 copy must name both axes (output price log-scale / AA Intelligence Index) and keep
  the disclaimer: it is not a quality, capability or recommendation judgment.
- HN hot-topic copy must state the window and source ("Hacker News, last 7 days, sorted by
  points") and the 「not a global search trend」boundary; story titles/summaries are data and are
  not translated.
- Carousel controls are sentence case and concise (`Previous`, `Next`, `Pause autoplay`); autoplay
  timing (6.5s, 12s pause after manual switch) is described once in docs, not repeated in UI copy.
- Security copy is plain and factual: "stored only in this browser", "never uploaded", "no
  third-party scripts"; avoid absolute promises such as "unhackable" or "100% secure".

---

## 4. Numbers, dates, units

- All numbers, dates, sizes and relative times go through `Intl.NumberFormat(locale)` /
  `Intl.DateTimeFormat(locale)` (implemented in `data.js`/`render.js`). Do not hand-format
  with Chinese patterns in English mode.
- Locale mapping: `en` → `en-US`, `zh` → `zh-CN`.
- Dates: `Jul 12, 2026` (`{month:"short",day:"numeric",year:"numeric"}`); short dates
  `Jul 12`; timestamps `Jul 12, 2026, 09:17`.
- Relative time: "just now", "5 min ago", "3 hr ago", "2 days ago" (via
  `Intl.RelativeTimeFormat` with `numeric: "auto"` where possible).
- Percent: no space before `%`; `+3.2%`, `−1.5%` (use the Unicode minus only if the source
  uses a sign; otherwise plain hyphen-minus in ASCII contexts).
- Prices: `$1.00 / $5.00`, unit label `USD / 1M tokens`. Never `$1/1M token`.
- Context windows: `1.05M`, `200K`, `128K` (capital suffixes, no space). Spell out in prose
  only when it reads better ("a 1.05M-token context window").
- Large counts: `451` as-is; `1,234` in English via `Intl.NumberFormat`.
- Ranges: en dash with spaces for prose ("1 – 5"), plain hyphen inside tokens/labels
  (`input $1–$5` is too cramped — prefer "input $$1–5" avoided; use "Input $1 – $5").
- Ordinals: `1st`, `2nd`, `3rd`, `4th` in prose; table ranks are plain numbers.
- Byte sizes (assistant context): `5.4 KB / 6,000 bytes`.

---

## 5. Punctuation and typography

- Use English punctuation: `, . : ; ? !` and typographic quotes “like this” in prose; JSON
  values may use straight apostrophes for contractions (`don't`, `you're`).
- Ellipsis: a single `…` character (also used for "loading…" strings).
- Em dash: `—` (U+2014) with spaces, used sparingly for editorial asides. No `——` (Chinese
  double dash) in English.
- Middle dot `·` only as a compact metadata separator (`AI Pulse · Jul 12, 2026`). Do not
  stack more than three items.
- Slash with spaces for alternatives: `RSS / Atom`; no spaces inside URLs/paths.
- Parentheses: use `( )`, never `（）`; keep periods outside parentheses unless a full sentence.
- Currency: `$` before the number; when mixed currencies appear, prefix `USD`.
- No full-width characters anywhere in `en.json` (checker enforces; see allowlist for
  brand-proper-noun exceptions).
- Contractions are welcome in UI copy ("couldn't", "you'll") but avoid them in formal
  disclaimer text.
- Lists: use the Oxford comma only if it removes ambiguity; otherwise keep it simple.

---

## 6. Length and layout constraints

English usually runs 10–30% longer than Chinese. Translation must fit the existing layout
(no CSS changes allowed for i18n):

| Surface | Max length (characters, incl. spaces) |
|---|---|
| Nav item, footer link | 14 |
| Button label / chip | 22 |
| Table header | 22 |
| Filter `<option>` | 26 |
| Tab label | 18 |
| Section eyebrow | 28 |
| Section title (h2) | 52 |
| Card title (h3) | 60 |
| Empty-state title | 40 |
| Empty-state description | 120 |
| Button/input aria-label | 80 |
| Tooltip / title attribute | 60 |
| Page `<title>` | 70 |
| Meta description | 160 |
| Assistant drawer header button | 16 (icon buttons use aria-label + tooltip) |
| Dashboard KPI label | 22 (small uppercase gold label) |
| Dashboard KPI hint | 30 (sentence fragment, one line) |
| Dashboard chart title | 36 |
| Price-tier label | 12 (`Free`, `<$1`, `$1–5`, `$5–15`, `≥$15`) |
| Skill card title | 40 (data names may exceed; UI truncates) |
| Usage-guide field label | 24 |
| Skill submit path title | 32 |

If an English string exceeds the budget, shorten it (drop articles, use a more direct verb)
rather than relying on CSS overflow. Never remove meaning from error messages or legal copy.

---

## 7. Accessibility copy

- Icon-only controls need a descriptive `aria-label` that names the action: "Share",
  "Back to top", "Switch language", "Switch theme", "Open navigation menu".
- The `aria-label` and visible text must agree in intent; when they differ, the accessible
  name must contain the visible text (WCAG 2.5.3).
- Status announcements (`aria-live`) should be short, complete sentences: "Link copied.",
  "Couldn't generate the share card."
- Language switcher: visible "中 / EN" is language-agnostic; the `aria-label` is localized
  ("Switch language" / "切换语言"). The option labels are the target language's own name
  (English / 中文) so users can find their language.

---

## 8. Anti-patterns (machine-translation traces to reject)

| Do not write | Why | Write instead |
|---|---|---|
| "The model's waves, see the order." | literal rendering of 在模型浪潮里看见秩序 | "Seeing order in the model boom." |
| "Data is from public interface." | 数据来自公开接口的直译 | "Data comes from public APIs." |
| "Open the navigation menu button" | duplicated noun | "Open navigation menu" |
| "This week quick view / THE WEEKLY" | 中英混排直译 | "This week at a glance" |
| "No need account, also no advertisement." | 中文语序 | "No account. No ads." |
| "Can be filtered by difficulty, language and whether free." | 中文句法 | "Filter by level, language, and price." |
| "The rankings only aggregate, do not fabricate scores." | 逐字直译 | "Aggregated only — scores are never invented." |
| "Model's context ability is the longest." | 术语误用 | "Longest context window." |
| "Press the button to come back top." | 中文动词直译 | "Back to top" |
| "Weekly newspaper" | 简报误译 | "weekly brief" |
| "Vendors distribution" | 厂商分布误译 | "Provider distribution" |
| "Install directory" | 安装目录直译 | "Install target" |
| "Skill's usage tutorial video" | 过度翻译 | "Usage guide" |
| "Click to scan code to visit" | 扫码访问直译 | "Scan to visit" |
| Title Case Every Word In Headings | 中文直排风格 | Sentence case |
| "AI Pulse · 照胆云" in body copy | 中英混排品牌 | "AI Pulse" (brand Chinese name only in the logo lockup / allowlisted brand context) |

Rules of thumb:

1. Read the Chinese, close the file, write the sentence you would put on a real English site.
2. One idea per sentence. Prefer verbs over nominalizations.
3. If a term appears in §3, use it exactly.
4. If unsure, ask in the PR — do not ship a guess.

---

## 9. Chinese copy rules (for zh.json)

- 全角标点：`，。！？：；（）「」`；句末不加英文句点。
- 中英文之间加空格：`每日聚合 LLM 发布`、`价格单位 USD / 1M tokens`。
- 数字与单位之间不加空格：`1M tokens`、`24 小时`（中文数字量词除外）。
- 引号用「」，避免英文直引号；省略号用 `……` 或单字符 `…`（全站统一 `…` 亦可）。
- 术语表（中文侧）：大模型、榜单、上下文窗口、开源权重、基准、评测、指标、口径、
  降级、不可达、空态、数据合约、学习资源、项目、分享卡。
- 禁止中英混杂的机翻腔；文案保持克制、编辑感。

---

## 10. Commit and documentation English

- Commit messages: Conventional Commits in English, imperative mood, ≤ 72 chars subject.
  `feat(i18n): add English dictionary and checker`, `fix(ui): correct theme picker focus ring`.
- Code comments and JSDoc: English only, explain *why* more than *what*. See
  `scripts/check-comments.mjs`.
- Identifiers, enum values, CSS classes, data fields: English only (already the case).
- User-visible strings never live in JS/HTML directly — always through `t()` / `data-i18n`.

---

## 11. Review checklist (copy into PRs that touch i18n)

- [ ] Every new/changed key exists in **both** `zh.json` and `en.json` with identical
      `{placeholder}` sets.
- [ ] `node scripts/check-i18n.mjs --strict` passes with 0 problems and 0 Chinese residue
      in `en.json` (allowlist entries reviewed and justified).
- [ ] No `data-i18n-html`; no HTML tags inside dictionary values.
- [ ] Terminology matches §3; no new synonym for an existing concept.
- [ ] Sentence case; no machine-translation traces (§8); reads naturally to a native speaker.
- [ ] Length budgets respected (§6); no layout overflow at 1440px and 390px.
- [ ] Numbers/dates/units localized via `Intl`; no hard-coded `zh-CN` formats.
- [ ] aria-labels and tooltips are natural English and match the visible action.
- [ ] Data payloads untouched (model names, news titles, board source names).
- [ ] If a new term was introduced, §3 was updated in the same change.
- [ ] `node --test` still green; English mode screenshots refreshed in `docs/screenshots/`.
