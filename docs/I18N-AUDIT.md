# AI Pulse 英文化审查报告（v1.7）

> 审计日期：2026-11-07 · 范围：9 个主页面 + 404 · 视口：1440×900 / 390×844
> 目标：英文版（`?lang=en` 或语言切换）不出现中文 UI 文案、不混入未翻译的中文内容；找不到英文对应时不得编造。

## 1. 结论

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 英文版可见中文文本节点 | 220 | **0** |
| 英文版中文属性（placeholder/aria/title/alt） | 63 | **0** |
| 页面 `<title>` / meta description / OG / Twitter 中文 | 存在 | **0** |
| 404 页可见中文 | 有 | **0** |
| 助手面板、模型对比弹窗可见中文 | 有 | **0** |
| 分享卡 Canvas 中文文案 | 有 | **0** |
| 英文版横向/布局回归 | — | 无 |

审计方法：Playwright 真实渲染（所有页面 × 2 视口），遍历可见文本节点与 `placeholder/aria-label/title/alt`；单独检查 metadata、404、助手面板、模型对比弹窗、分享卡 Canvas `fillText`，并做截图人工复核。

## 2. 问题分类与根因

### P1 — 全局 UI 残留

| 位置 | 问题 | 根因 |
|---|---|---|
| 品牌区 | 每页 `照胆云` | 静态 `.brand-cn` 未随语言隐藏 |
| 语言切换 | `中 / EN` | 语言代码静态写死 |
| 排名页分享条 | `AI Pulse · 照胆云` | 静态字符串、未走 i18n |
| 首页数据源 tooltip、关于页数据源表 | 中文源名称/备注 | 数据管线中的 `meta.sources.name/note` 为中文，渲染无英文映射 |
| 数据源细节 | 抓取日志式中文备注 | 原始操作日志未提供英文版本 |

### P2 — 数据内容未双语化

| 内容 | 数量 | 根因 |
|---|---|---|
| OpenRouter 生成动态（标题/摘要/标签） | 30 | 管线模板只有中文 |
| GitHub Releases 生成动态 | 9 | 标题模板中文（摘要本身英文） |
| DeepSeek Change Log 动态 | 7 | 标题/摘要前缀中文 |
| 学习资源描述/标题/作者 | 22 | curated 数据只有中文描述 |
| 项目摘要/亮点/价值 | 13 | curated 数据只有中文 |
| 中文标签 | 13 类 | 标签由中文模板生成，UI 无字典 |

### P3 — 既有设计假设

`render.js` 文件头此前声明“模型名、来源名、新闻标题保持原始语言”，因此英文版直接回退到中文数据；没有“英文 companion 字段”机制。这是本次要替换的核心假设。

## 3. 解决方案（已落地）

### 3.1 UI 层：所有文案走 i18n

- `en.json` 中所有值 **零 CJK**（新增 CI 测试）；
- 英文版隐藏 `.brand-cn`，只保留 `AI PULSE` 品牌字标；
- 语言切换在英文版显示 `ZH / EN`，中文版保留 `中 / EN`；
- 排名分享条、数据源名称/备注改为按语言渲染；
- `data.lang.*` 等语言标签在英文版输出 `Chinese / English / Multilingual`；
- 404、助手面板、模型对比弹窗复用同一套 i18n。

### 3.2 数据层：双语 companion 字段

| 数据 | 新增字段 | 来源 |
|---|---|---|
| 生成动态（OpenRouter/GitHub/DeepSeek） | `titleEn`, `summaryEn` | `scripts/normalize.mjs` 模板直接生成英文 |
| 学习资源 | `titleEn`, `descriptionEn`, `authorEn` | `scripts/fetch/curated.mjs` 手工英文，经 `normalizeResources` 保留 |
| 项目 | `nameEn`, `summaryEn`, `highlightEn`, `whyEn` | `scripts/fetch/curated.mjs`，经 `normalizeGithubProjects` 保留 |
| AA 榜单条目 | `releaseDate` | AA 首页 featured `initialData` 合并，供分享卡“上线时间”列使用 |

原则：

- **不机器翻译、不编造**；英文内容由同一数据管线的英文模板或人工 curated 英文生成；
- 专有名词（模型名、来源名、资源标题）保留原文/官方英文名；
- 中文数据始终保留，英文版按 `*En` 字段优先，缺失时回退原文（当前测试保证关键内容无缺失）。

### 3.3 英文版内容策略

- 英文版优先渲染 `*En`；
- 原始来源语言为英文的 RSS 动态直接使用原文；
- 中文源生成动态使用同模板英文版；
- 数据源抓取日志式备注在英文版替换为简洁英文说明，不显示中文操作日志；
- 分享卡/榜单标题/指标名使用 `board.<id>.*` 英文词典。

### 3.4 防回归

新增 `tests/i18n-content.test.mjs`：

1. `en.json` 不得含 CJK；
2. 每条中文新闻必须有 `titleEn`/`summaryEn`；
3. 所有 curated 资源必须有 `descriptionEn`、项目必须有 `summaryEn`；
4. 所有生成的英文 `titleEn`/`summaryEn` 不得含中文。

Playwright 英文化审计脚本保留在 `_tmp/i18n_audit.py`（本地工具，不发布），用于发布前复跑。

## 4. 验证记录

| 检查 | 结果 |
|---|---|
| 9 页 × 1440 / 390 可见中文 | 0 |
| 9 页中文属性 | 0 |
| metadata（title/description/OG/Twitter）中文 | 0 |
| 404 页中文 | 0 |
| 助手面板中文 | 0 |
| 模型对比弹窗中文 | 0 |
| 分享卡 Canvas 中文 | 0 |
| 页面横向溢出 / JS 错误 | 0 |
| `node --test` | 107 通过 |
| `validate --strict` | 0 警告 |
| `check-comments --strict` | 0 中文注释 |
| `check-i18n --strict` | 0 错误 |
| `security-check --strict` | 0 错误 |

## 5. 剩余限制（不阻塞英文版）

1. **首屏静态 HTML 的 `<title>`/meta 初始值是中文**，JS 初始化后立即替换为英文；对执行 JS 的搜索引擎无影响，但纯静态抓取或极慢网络下会先看到中文。后续可做 per-locale 静态头或 `hreflang`。
2. **中文源原始内容默认保留**；若未来接入纯中文 RSS，仍需要人工/管线补 `titleEn`（测试会拦截缺失的生成类内容）。
3. **英文版品牌只保留 AI PULSE**；如需“照胆云”海外品牌名，需要品牌决策。
4. **分享卡行内日期固定 `YYYY.MM.DD`**，为列宽与 tab 对齐统一；如需英文月份格式可另开。
5. **助手 AI 回答内容**取决于模型与数据；UI 已英文化，但回答中若引用中文源数据则保留原文（符合“不编造”原则）。

## 6. 变更文件

- 数据管线：`scripts/normalize.mjs`、`scripts/fetch/curated.mjs`、`scripts/fetch/sources.mjs`
- 渲染与 i18n：`site/assets/js/render.js`、`deepseek.js`、`share.js`、`share-board.js`、`app.js`
- 词典：`site/assets/i18n/en.json`、`zh.json`
- 样式：`site/assets/css/components.css`
- 数据：`data/news.json`、`data/resources.json`、`data/projects.json`、`data/rankings.json`
- 测试：`tests/i18n-content.test.mjs`、`tests/data-normalize.test.mjs`、`tests/share.test.mjs`
