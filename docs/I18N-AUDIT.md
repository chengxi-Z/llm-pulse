# AI Pulse 英文默认版审查报告（v2.0）

> 审计日期：2026-11-07 · 范围：全站 9 页 + 404 · 默认英文 / `?lang=en` / 移动端
> 目标（来自验收要求）：
> 1. 全站**默认英文**，英文是独立版本，不是“先中文再翻译”；
> 2. 英文模式**没有任何中文和中文标点**；
> 3. 包括**出站信息**（分享卡、分享文案、社交 meta、RSS/JSON Feed、助手请求、OG 图片）；
> 4. Logo 英文名 **Z Cloud**；
> 5. 所有信息采集源必须是**英文资源网站**。

## 1. 核心结论

| 检查项 | 修复前 | 修复后 |
|---|---|---|
| 默认首屏是否英文 | 否：静态 HTML 为中文，JS 加载后替换为英文 → **闪中文** | **是：静态 HTML / title / meta 全英文，默认即英文** |
| 英文模式可见中文 | 有 | **0** |
| 英文模式中文标点（CJK/全角） | 有 | **0** |
| 英文模式中文属性（placeholder/aria/title/alt） | 63 | **0** |
| 英文模式 head/meta 中文 | 有（含 `og:site_name` 中文品牌） | **0** |
| 静态 HTML 源码中文/全角标点 | 有（正文回退、注释、装饰字符） | **0** |
| 分享卡 Canvas / 分享文案中文 | 有 | **0** |
| 助手请求（context/system/brief/answers）中文 | 有（原始中文数据进入上下文） | **0** |
| RSS / JSON Feed 中文 | 有 | **0** |
| OG 分享图中文 | 有（中文标题/照胆云） | **0（全英文图）** |
| 非英文采集源 | OpenCompass、SuperCLUE、6 个中文学习资源站 | **已移除 / 替换，所有源为英文网站** |
| 英文默认页请求 `zh.json` | 是（中英词典都预加载） | **否，仅在切换到 ZH 时加载** |

## 2. 闪中文的根因与修复

**根因**：9 个 HTML 文件的静态正文是中文，靠 `i18n.js` 在页面加载后替换成英文；每次切换模块都会重新加载中文 HTML，所以先闪中文再变英文。同时 `DEFAULT_LANG` 是 `zh`，英文不是独立版本。

**修复**：

1. 把 9 个页面 + 404 的静态 HTML 正文、title、description、OG/Twitter meta 全部预生成为英文（现在 HTML 源码本身即英文）；
2. `DEFAULT_LANG = 'en'`，`html lang="en"`，默认不加载中文词典；
3. 英文静态页在 JS 初始化前后**都是英文**，不存在“中文→英文”的替换过程；只有用户主动切换 ZH 才加载中文词典并替换；
4. 中文模式仍保留：`?lang=zh` 或点击 ZH。

## 3. Logo / 品牌

- 默认英文 Logo：**AI PULSE / Z CLOUD**；
- 分享卡、助手、RSS 标题、OG 图片、页脚、`og:site_name` 均使用 **AI Pulse · Z Cloud**；
- 中文模式仍显示“照胆云”（通过 `ui.brandSub` 词典切换）。

## 4. 信息采集英文化

**已移除的非英文源**：OpenCompass、SuperCLUE。

**当前 19 个采集源**全部为英文网站：OpenRouter、LiveBench、Epoch AI、Artificial Analysis、OpenAI / Google DeepMind / Google AI / Qwen / AWS ML / MIT News / Berkeley BAIR RSS、GitHub、Hugging Face（含镜像）、LMArena、DeepSeek Change Log、Hacker News。

**学习资源**：删除 6 个中文站（Datawhale、D2L 中文版、李宏毅课程、LLM Cookbook、LLM Universe、书生实战营），替换为 6 个英文站（D2L 英文版、Stanford CS224N、DeepLearning.AI、Full Stack Deep Learning、Hugging Face Smol Course、Stanford CS324）。当前 22 个资源全部为英文站（`prompting-guide` 为英文多语站）。

## 5. 出站信息英文化

| 出站面 | 处理 |
|---|---|
| 分享卡 Canvas | 英文标题/榜单名/指标/日期；品牌 `· Z Cloud`；无中文、无中文标点 |
| 分享文案 / Twitter intent | 英文标题、描述、站点名；无中文 |
| 社交 meta | 静态即英文；`og:site_name` = AI Pulse · Z Cloud；动态切换语言时同步 |
| RSS / JSON Feed | 英文标题/摘要/来源/标签/频道/语言 `en-us`/`en-US`；过滤中文条目 |
| 助手 outbound | `buildContext` / `buildSystemPrompt` / `buildBrief` / `localAnswer` 全部优先英文 companion 字段；原始中文数据不进入请求 |
| OG 分享图 | 重新生成全英文 1200×630 图：AI PULSE / Z CLOUD + 英文标题 + 英文说明 |
| 页面源码/注释/装饰字符 | HTML 注释翻译；中文装饰字符改为 L/B/M；源码无 CJK/全角标点 |

## 6. 验证记录（发布前本地）

- 默认 URL（无 `?lang`）9 页 + 404：Playwright 实测可见中文 **0**、中文属性 **0**、中文 head **0**、横向溢出 **0**、JS 错误 **0**；
- 默认英文页网络请求中 **无 `zh.json`**；
- 移动端 390×844 页面与桌面一致（此前全站 UI 审计已覆盖）；
- 数据加载失败容错状态同样为英文（fallback banner/空状态无中文和中文标点）；
- 静态 HTML 源码扫描（10 个文件）CJK/全角标点 **0**；
- `feed.xml` / `feed.json` CJK/全角标点 **0**；
- 分享卡 `fillText`、分享文案、助手 context/system/brief/localAnswer：CJK/全角标点 **0**；
- 英文词典 `en.json` 无 CJK/全角标点；
- 测试：**111 通过**；`validate --strict`、`check-comments --strict`、`check-i18n --strict`、`security-check --strict` 全部通过。

## 6.1 发布后线上复检（2026-11-07）

- 线上 10 个页面（9 页 + 404）× 1440×900 / 390×844：默认英文，可见中文 **0**、中文属性 **0**、中文 head **0**、横向溢出 **0**、JS 错误 **0**、`zh.json` 请求 **0**；
- 线上静态 HTML 源码（10 个页面）：CJK/全角标点 **0**，`html lang="en"`，`og:site_name = AI Pulse · Z Cloud`；
- 线上 `feed.xml` / `feed.json`：CJK/全角标点 **0**；
- 线上分享卡 Canvas / 分享文案：CJK/全角标点 **0**，品牌 `AI Pulse · Z Cloud`；
- 线上 22 个学习资源：全部 `lang != zh`，无中文站域名；19 个采集源全部英文站；
- 线上榜单：OpenCompass 已移除；当前为 Artificial Analysis / Context Window / Epoch ECI / GPQA / SWE-bench / LiveBench / LMArena / Output Price。

## 6.2 最终 UI 审查（发布门禁）

- Playwright 真实渲染 9 个页面 × 1440×900 / 390×844：**横向溢出 0、控制台错误 0、容器左右边缘一致**；首页双卡底部差 **0.3px**。
- 修正发布前发现的三处版面问题：
  1. 英文 hero lede 过长导致省略号截断 → 改为完整两行英文文案；
  2. 右上「本周速览」数据源摘要换行被裁切 → 摘要收敛为 source 数 + OK + degraded，完整落在卡片内；
  3. 排名页 Source 行残留 OpenCompass（数据源已移除）→ 改为 Artificial Analysis + OpenRouter + Epoch AI + LiveBench。
- Impeccable 最终检测：共 39 条，其中 **36 条为既存品牌层**（cream palette 18、Inter 字体 18），**3 条为设计性 advisory**（DeepSeek 长单列、排行 filter-bar 贴边 2 条）；**tiny-text、低对比、行宽、文本溢出、kicker、横向溢出均为 0**。
- 头部导航保持单行：所有 nav 链接 `white-space:nowrap`；中桌面（961–1100px）缩小字号/间距，961–1000px 进一步收紧；已在 1902 / 1440 / 1280 / 1100 / 1025 / 1000 / 970 / 961px 实测无换行、无右侧裁切；≤960px 使用汉堡菜单。
- 结论：达到发布门禁，可作为 **v2.0.0（English-first）** 发布。

## 7. 剩余限制（明确说明）

1. **中文版本仍保留**：用户切到 ZH 时才加载 `zh.json` 和中文数据；默认英文页不会请求中文词典。
2. **数据 JSON 仍包含双语字段**（供 ZH 模式使用）；英文页面渲染只使用英文字段，不显示中文，但数据文件内保留中文 companion 是双语架构的一部分。
3. **共享 JS 内含中文模板/中文词典键**（供 ZH 模式使用）；英文页面不执行中文分支。若要求“网络层字节级纯英文”，下一步需要把 ZH 词典与中文模板拆成按语言懒加载的独立 chunk；页面层与出站内容已达标。
4. 中文模式加载时会先出现英文静态首屏再切中文（英语优先的取舍）；英文模式无此问题。
5. Feed 为全站英文单语言；中文模式下目前不提供中文 Feed。

## 8. 变更文件

- HTML：`site/*.html`（默认英文静态化、Logo Z Cloud、英文 meta、注释/装饰字符英文化）
- 品牌/元数据：`site/assets/i18n/{en,zh}.json`、`site/assets/js/i18n.js`、`app.js`
- 渲染：`render.js`、`deepseek.js`、`assistant-core.js`、`assistant.js`、`share.js`、`share-board.js`、`data-match.js`
- 数据管线：`scripts/normalize.mjs`、`scripts/fetch/sources.mjs`、`scripts/fetch/curated.mjs`、`scripts/build-feed.mjs`
- 采集源：移除 OpenCompass / SuperCLUE；替换中文学习资源为英文站
- 出站资源：`site/assets/img/og-cover.png`（全英文重制）、`logo.svg` aria
- 数据：`data/news.json`、`resources.json`、`projects.json`、`rankings.json`、`meta.json`、`feed.*`
- 测试：`tests/i18n-content.test.mjs`（默认英文静态页、采集源英文性、出站 Feed）、`tests/feed.test.mjs`、`tests/data-normalize.test.mjs`、`tests/share.test.mjs`
