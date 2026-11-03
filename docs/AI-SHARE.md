# AI 助手 + 推送 / 分享（AI-SHARE）

> 模块负责人：ai-share ｜ 适用阶段：POC ✅ → MVP ✅ → Release
> 依赖规格：`docs/SPEC.md` §5（AI 助手）、§6（推送/分享）、§4.2（视觉 token）；`docs/DATA-CONTRACT.md` §7。
> 状态：**纯前端、零外部依赖、无后端、密钥不出浏览器**。所有功能在断网（无模型密钥）时仍可降级使用。

---

## 1. 概览

| 能力 | 实现 | 状态 |
|---|---|---|
| 全站 AI 助手（悬浮按钮 + 抽屉） | `site/assets/js/assistant.js`、`assistant-core.js`、`css/assistant.css` | ✅ 离线问答 / BYOK 流式 / 错误态 / 深链接 |
| 离线检索问答（无密钥） | `assistant-core.localAnswer()`，对 models/news/rankings/resources/projects 本地检索 + 模板回答 | ✅ 10+ 意图 |
| 站点上下文注入 | `assistant-core.buildContext()`，真实数据实测 **3.7KB ≤ 6KB** | ✅ 可预览/复制 |
| 本周 AI 简报 | `assistant-core.buildBrief()`，五段式 Markdown，一键生成 + 复制 Markdown/纯文本 | ✅ |
| 社交分享 | `site/assets/js/share.js`：Web Share API / 复制链接 / X / Telegram / 微博 / 复制文案 | ✅ |
| 品牌分享卡 | Canvas 1200×630，自动明暗主题，下载 PNG / 复制图片 | ✅ |
| RSS 2.0 + JSON Feed 1.1 | `scripts/build-feed.mjs` → `site/feed.xml`、`site/feed.json` | ✅ python `xml.etree` 校验通过 |
| 定时推送 | GitHub Actions 每日部署 + 每周快照；可选飞书/Telegram/Server酱 webhook（默认关闭） | ✅ 已接线 |
| 测试 | `node --test` 36 项单测 + Node DOM e2e 16 项 + 浏览器截图 | ✅ |

**总体架构**

```
data/*.json（数据管道产物）
   │
   ├─► data.js loadAll() ──► assistant.js（抽屉 UI / 状态机）
   │        │                     ├─ buildContext()  ≤6KB ──► system prompt ──► BYOK 端点（SSE 流式）
   │        │                     └─ localAnswer()  离线检索（无 key / 请求失败自动降级）
   │        │
   │        └──────────────────► share.js（data-share 委托 / 分享卡 Canvas，零网络依赖）
   │
   └─► scripts/build-feed.mjs ──► site/feed.xml（RSS 2.0）+ site/feed.json（JSON Feed 1.1）
                                        │
                                        └─► GitHub Pages（Pages workflow 内生成）+ 订阅器/群机器人
```

**文件清单**

| 文件 | 作用 | 原始体积 | gzip |
|---|---|---|---|
| `site/assets/js/assistant-core.js` | 纯函数：buildContext / parseSSE / localAnswer / buildBrief / safeMarkdown | 46.1 KB | 14.6 KB |
| `site/assets/js/assistant.js` | 抽屉 UI、BYOK 设置、流式渲染、错误态、深链接 | 35.6 KB | 10.9 KB |
| `site/assets/js/share.js` | 分享菜单、意图链接、Canvas 分享卡 | 23.1 KB | 7.5 KB |
| `site/assets/css/assistant.css` | 助手样式（复用 theme tokens + 暗色/移动端/a11y） | 16.6 KB | 3.9 KB |
| `site/assets/css/share.css` | 分享菜单 / 分享卡弹窗样式 | 5.6 KB | 1.7 KB |
| `scripts/build-feed.mjs` | Feed 生成器（可 `--base-url/--data-dir/--out-dir/--limit`） | 11.8 KB | 4.0 KB |
| `tests/assistant-core.test.mjs` | 助手核心单测 29 项 | — | — |
| `tests/feed.test.mjs` | Feed 单测 7 项 | — | — |
| `tests/mock-llm-server.mjs` | OpenAI 兼容 SSE mock（端口 4199） | — | — |
| `site/feed.xml` / `site/feed.json` | 已生成的订阅源（80 条动态，含站点 og 头图） | 58 KB / 59 KB | — |

> 体积预算：JS 合计约 **105 KB 原始 / 33 KB gzip**，CSS 合计 **22 KB / 5.6 KB gzip**，在 SPEC 调整后的预算（JS ≤160KB、CSS ≤80KB）内。

---

## 2. AI 助手

### 2.1 入口与交互

- 全站右下角悬浮按钮 **「✦ AI 助手」**，点击展开右侧抽屉；移动端（≤640px）全屏。
- 快捷键 **`/`**（输入框外）唤起；**Esc** 逐级关闭（上下文预览 → 设置 → 抽屉）；**Tab** 焦点循环；关闭后焦点归还触发元素。
- **深链接**：`?assistant=open` 直接打开抽屉；`?ask=问题` 打开并自动提问，例如
  `https://chengxi-z.github.io/llm-pulse/?ask=本周要点简报`——可分享「带问题的助手链接」。
- 快捷问题：上下文最长模型 / 性价比最高 / 本周要点简报 / 入门课程 / 最新动态 / 开源模型。
- 每条回答提供 **复制 Markdown**；简报额外提供 **复制纯文本**（群聊/公众号）。

![助手抽屉（真实站点，桌面）](screenshots/assistant-drawer.png)

![离线回答：上下文最长的模型](screenshots/assistant-offline.png)

![本周 AI 简报](screenshots/assistant-brief.png)

![暗色模式](screenshots/assistant-drawer-dark.png)

![移动端全屏抽屉（390×844 @2x）](screenshots/assistant-mobile.png)

### 2.2 BYOK 在线模式（自带密钥）

设置入口：抽屉右上角 ⚙。字段：**baseURL / model / apiKey**，保存到 `localStorage['aipulse.assistant.config.v1']`。

| 服务商 | baseURL | model 示例 | 备注 |
|---|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` | 默认值；密钥见 platform.deepseek.com |
| OpenRouter | `https://openrouter.ai/api/v1` | `deepseek/deepseek-chat`、`openai/gpt-4o-mini`（以目录为准） | 一个 key 聚合多家模型；浏览器端需端点允许 CORS |
| 硅基流动 SiliconFlow | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` | 国内访问快 |
| 本地 Ollama | `http://localhost:11434/v1` | `llama3.1` | apiKey 可填任意非空值；需 `OLLAMA_ORIGINS` 允许站点域名跨域 |

示例（DeepSeek）：

```
baseURL: https://api.deepseek.com/v1
model:   deepseek-chat
apiKey:  sk-****************（只保存在你的浏览器）
```

**CORS 说明**：本站无后端代理，浏览器会直接请求你填写的端点。若端点不允许跨域，会显示「网络请求失败（可能是 CORS）」错误态——可换用允许 CORS 的端点，或自建 Cloudflare Worker 代理（见 §8 扩展）。

请求本身是标准 OpenAI 兼容 `POST {baseURL}/chat/completions`（`stream: true`），所以任何兼容实现都可直接接入。

### 2.3 上下文注入（≤6KB）

`buildContext(data)` 把站点数据压缩成 Markdown 摘要注入 system prompt，包含：

1. 数据生成时间与统计（模型/动态/榜单/资源/项目/数据源正常数）；
2. 本周速览（`meta.latestHighlights`）；
3. 最近发布模型 Top 5（名称/厂商/上下文/价格/开源标记）；
4. 最新动态 Top 6（按重要度 + 时间）；
5. 榜单 Top 3（最多 4 个榜）；
6. 精选学习资源 5 条、项目 4 个。

- 硬上限 **6000 字节**（`fitLinesToBytes` 按整行裁剪，不切断 UTF-8 码点）；真实数据实测 **3728 字节**。
- 抽屉底部「查看注入上下文」可预览全文与实时字节数，并可复制——发送前用户可自查注入了什么。
- 路由/自动聚合伪模型（Auto Router、Pareto Code Router 等）在上下文、离线问答、简报中统一过滤，避免「2M 上下文的路由器」污染结论。

### 2.4 流式输出

- `fetch` + `ReadableStream` + `createSSEParser()` 增量解析：内部流式 `TextDecoder`，**任意字节分块**（含中文/emoji 被拆到两个 chunk）都能正确还原。
- 每收到增量即更新气泡（Markdown-lite 实时渲染），有「▍」光标；**停止**按钮 `AbortController` 中断；超时上限 **90s**。
- 支持带 `reasoning` 字段的兼容端点（只渲染 `content`，忽略思考片段）。

### 2.5 离线模式（无密钥 / 失败降级）

无 apiKey 时完全离线：不发任何网络请求，只用本地数据回答，模式徽标显示「离线模式」。

| 意图 | 示例问法 | 回答内容 |
|---|---|---|
| 上下文 | 「现在上下文最长的模型？」 | 上下文窗口 Top 3（过滤路由伪模型） |
| 性价比 | 「性价比最高的模型？」 | 输入+输出价格合计最低 Top 3 |
| 排行 | 「排行榜第一是谁？」 | 各榜 Top 3 + 更新时间 |
| 动态 | 「最近有什么新动态？」 | 最新 5 条（重要度标记 + 来源链接） |
| 学习 | 「推荐入门课程」 | 入门难度优先的 4 条资源 + 学习路线 |
| 项目 | 「有哪些项目？」 | stars 排序 Top 4 |
| 开源 | 「有哪些开源模型？」 | 开放权重模型列表 + 许可证提示 |
| 模型库 | 「收录了多少模型？」 | 总数 + 上下文 Top 3 |
| 数据源 | 「数据源可靠吗？」 | meta 数据源状态、更新模式 |
| 简报 | 「本周要点简报」 | 五段式简报（见 §2.6） |
| 兜底 | 任意关键词（如「Terra 有什么特点」） | 跨模型/动态/资源/项目全文关键词检索 |

**离线能力边界**（回答中会明确「离线模式 · 基于站点数据本地检索」）：

- 只能回答站点 `data/*.json` **已收录**的信息；不联网、不编造。
- 不做复杂推理/计算/翻译/代码生成，这些需配置 BYOK 在线模型。
- 数据文件加载失败（如直接 `file://` 打开）时给出降级说明，不白屏。
- 多轮上下文只用于在线模式；离线模式每次独立检索。

### 2.6 本周 AI 简报

- 来源：抽屉「简报」按钮 / 快捷问题 / `localAnswer('本周要点简报')`。
- 五段式：**一、关键数字 → 二、本周新模型 → 三、榜单风向 → 四、值得一读的动态 → 五、学习与项目**，附站点来源链接与生成日期。
- 实测 **2955 字节**（真实数据），可一键复制 Markdown 或纯文本用于群分享/公众号。
- 在线模式下也可让模型按系统提示的五段式结构润色生成。

### 2.7 错误态

`classifyError()` 把失败归类为：`401/403` 密钥无效、`404` 接口/模型不存在、`429` 限流/额度、`5xx` 上游异常、`timeout` 超时、`network/CORS` 网络失败、`bad-request` 参数错误。错误气泡包含友好中文说明 + 技术信息，并给出三个动作：**重试在线请求 / 改用离线回答 / 检查设置**。401 后点「改用离线回答」立即降级继续使用。

### 2.8 隐私与安全

- **密钥只在 localStorage**（`aipulse.assistant.config.v1`），仅随 `Authorization: Bearer` 头发往用户填写的 baseURL；不经过本站服务器，不上报任何遥测。
- 对话内容**不持久化**：刷新即清空；不写 cookie、不写后端。
- 设置面板与文档明确提示「公共电脑/浏览器扩展可能读取 localStorage」，并提供「清除密钥」。
- **XSS 防护**：`safeMarkdown()` 先整体 HTML 转义，再渲染粗体/列表/代码/链接；链接仅允许 `http(s)://`，阻止 `javascript:`/`data:`；模型输出、离线回答、数据标题均走该渲染或 `textContent`。单测覆盖恶意 `<img onerror>`、`<script>`、恶意 href。
- 注入上下文预览用 `textContent`，不解析 HTML。

### 2.9 无障碍与视觉

- `role="dialog"` + `aria-modal` + `aria-labelledby`；对话区 `role="log"` + `aria-live="polite"`。
- 键盘全可达（`/` 唤起、Esc 关闭、Tab 循环、Enter 发送 / Shift+Enter 换行）；`:focus-visible` 金色描边。
- 复用 SPEC §4.2 design tokens：纸感米白/墨色/香槟金/墨绿，衬线标题、细金线、低阴影；`prefers-color-scheme` 自动明暗；`prefers-reduced-motion` 关闭动效；移动端全屏。

---

## 3. 推送 / 订阅

### 3.1 Feed 生成

```bash
# 默认 base URL：https://chengxi-z.github.io/llm-pulse/
node scripts/build-feed.mjs

# 自定义站点地址（fork / 预览域名）
node scripts/build-feed.mjs --base-url https://example.com/llm-pulse/
SITE_BASE_URL=https://example.com/llm-pulse/ node scripts/build-feed.mjs

# 其它参数
node scripts/build-feed.mjs --data-dir data --out-dir site --limit 30
```

产物：

- `site/feed.xml` — **RSS 2.0**（`atom:link self`、`lastBuildDate`、每项 `guid isPermaLink="false"`、`pubDate` RFC 822、`category`、`source`；存在 `site/assets/img/og-cover.png` 时自动写入 `<image>` 头图）。
- `site/feed.json` — **JSON Feed 1.1**（`version`、`home_page_url`、`feed_url`、`authors`、`icon`（复用 og 头图）、`items[].id/url/title/content_text/date_published/tags`）。
- 排序稳定：`publishedAt` 倒序，同时间按 `id` 升序；默认最多 100 条（`--limit` 可调）。
- XML 严格转义（`& < > " '` + 剔除 XML 1.0 非法控制字符）；所有链接转绝对地址；缺失 `url` 时依次回退 `sourceUrl` → 站内锚点。
- 数据为空/缺失时输出合法空频道并在注释说明，不会产出坏 XML。

### 3.2 校验（POC Gate 证据）

```bash
python 临时开发目录（不入库）/validate-feed.py site/feed.xml site/feed.json   # 本机临时脚本，未提交
# 输出（真实数据）：
# RSS  : site/feed.xml (59686 B), items=80, channel=AI Pulse · 照胆云
# JSON : site/feed.json (73838 B), items=80, version=https://jsonfeed.org/version/1.1
# lastBuildDate: Tue, 03 Nov 2026 11:00:00 GMT
# OK: RSS 2.0 合法（xml.etree 解析通过）+ JSON Feed 1.1 字段/URL/日期校验通过，两文件条目一致。
```

校验内容：`xml.etree.ElementTree` 真实解析、必填 channel/item 字段、`pubDate/lastBuildDate` 可解析、绝对 URL、guid 唯一、RSS 与 JSON Feed 条目 id 与顺序一致。另有 `tests/feed.test.mjs` 7 项单测固化上述行为（含转义注入、稳定排序、空数据）。

### 3.3 自动刷新与部署（GitHub Actions）

| workflow | 触发 | 行为 |
|---|---|---|
| `deploy.yml` | push main / 每日 `17 1 * * *`（北京时间 09:17）/ 手动 | 抓数据（容忍失败回退快照）→ **build-feed** → validate `--strict` → stage → Pages 部署 → 可选 webhook |
| `refresh-data.yml` | 每周一 `23 2 * * 1`（北京时间 10:23）/ 手动 | 全量抓数据 → **build-feed** → validate → 提交 `data/`+`site/feed.*` 快照 |
| `ci.yml` | push / PR | validate → `node --test` → build-feed → validate `--strict` |

`SITE_BASE_URL` 在 workflow 中按 `github.repository_owner`/仓库名自动注入，fork 后无需改代码。

### 3.4 订阅方式

- RSS 阅读器（Feedly/Inoreader/NetNewsWire 等）订阅 `https://chengxi-z.github.io/llm-pulse/feed.xml`。
- 支持 JSON Feed 的客户端/脚本订阅 `.../feed.json`。
- 站点「关于」页提供订阅说明（Lead/site-mvp 负责文案位置）。

### 3.5 可选 webhook 广播（默认关闭）

由 `scripts/notify.mjs` 实现，仅当 GitHub Secrets 配置了对应变量才发送；失败不影响部署（`continue-on-error: true`）。默认不发送。

| 渠道 | Secrets | 说明 |
|---|---|---|
| 飞书群机器人 | `FEISHU_WEBHOOK` | webhook 完整地址（含 `/open-apis/bot/v2/hook/`），发送 interactive 卡片 |
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | BotFather 建 bot；chat_id 可用 `getUpdates` 获取 |
| Server 酱 | `SERVERCHAN_KEY` | `sctapi.ftqq.com/<SendKey>.send` |

配置示例（GitHub CLI）：

```bash
gh secret set FEISHU_WEBHOOK --body "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx"
gh secret set TELEGRAM_BOT_TOKEN --body "123456:ABC-DEF..."
gh secret set TELEGRAM_CHAT_ID --body "-1001234567890"
gh secret set SERVERCHAN_KEY --body "SCTxxxxxxxx"
```

发送内容示例：站点更新标题、模型/动态/榜单统计、最新 3 条动态标题、站点链接。未配置任何渠道时输出「未配置推送渠道，跳过（可选）」。

---

## 4. 分享

### 4.1 页面接入（事件委托）

任意元素加 `data-share` 即可，`share.js` 委托处理，无需逐页写 JS：

```html
<button type="button" data-share
        data-share-title="OpenAI 发布 GPT-6.1 Terra Pro：1.05M 上下文，$1/$5"
        data-share-desc="旗舰线更新，Terra 系列同时提供批量变体。"
        data-share-url="https://chengxi-z.github.io/llm-pulse/news.html"
        data-share-stats="451 个模型 · 80 条动态"
        data-share-type="news">
  分享这条动态
</button>
```

- 未提供 `data-share-url` 时用当前页面 URL；`data-share-type` 用于分享卡右下角标签（news/ranking/model/resource/project/page）。
- `data-share-card-open` 可直接打开分享卡；`data-share-card`（配合 `data-share`）为分享卡专用按钮。
- 分享卡根 canvas 约定 `#share-card-canvas`（`share.js` 惰性创建，符合 DATA-CONTRACT §7）。

### 4.2 分享菜单

点击 `[data-share]`：
1. 移动端（`pointer: coarse` 且支持 Web Share API）→ 直接调起系统分享；
2. 否则弹出菜单：**系统分享（若支持）/ 复制链接 / 复制分享文案 / 生成品牌分享卡 / X / Telegram / 微博**。

意图链接模板（新窗口打开，`noopener,noreferrer`）：

- X：`https://twitter.com/intent/tweet?text={title}&url={url}`
- Telegram：`https://t.me/share/url?url={url}&text={title}`
- 微博：`https://service.weibo.com/share/share.php?url={url}&title={title}`

分享文案格式：`【AI Pulse · 照胆云】标题 / 摘要 / 关键数字 / 链接`。

### 4.3 品牌分享卡（Canvas 1200×630）

- 纯客户端 Canvas 生成，**不含任何外链图片**（避免 canvas taint），无网络请求。
- 自动读取 `prefers-color-scheme`：浅色（米白+墨+金）/ 深色（墨黑+金）两套配色；也可用固定主题绘制。
- 内容：品牌星标 + `AI PULSE`、站点名与日期、标题（衬线大字，最多 3 行）、摘要（最多 3 行）、关键数字（站点统计，可选）、域名、类型标签；右侧金线圆环装饰。
- 操作：**下载 PNG**（文件名 `ai-pulse-<slug>-YYYYMMDD-HHmm.png`）、**复制图片**（支持 `ClipboardItem` 时）、**复制文案**、**关闭**；Esc 关闭。
- 分享卡预览弹窗 `role="dialog"`，按钮键盘可达。

![品牌分享卡 · 浅色（真实 Canvas 代码生成）](screenshots/assistant-share-card-light.png)

![品牌分享卡 · 暗色](screenshots/assistant-share-card-dark.png)

![站内分享卡预览弹窗](screenshots/share-card.png)

![分享菜单](screenshots/share-menu.png)

---

## 5. 测试与验证

### 5.1 单元测试（CI Gate）

```bash
node --test                     # CI/本地常规（Node ≥20）
# 本会话沙箱禁止子进程 spawn，使用单进程模式：
node --test --test-isolation=none tests/assistant-core.test.mjs tests/feed.test.mjs
# → tests 36 / pass 36 / fail 0
```

覆盖：UTF-8 字节裁剪、上下文 ≤6KB、SSE 任意分块/多字节边界/CRLF/非法 JSON、safeMarkdown XSS、离线问答各意图、路由伪模型过滤、简报结构、配置规范化、错误分类、Feed 排序/转义/JSON Feed 合规/写出。

### 5.2 mock OpenAI SSE 服务

```bash
node tests/mock-llm-server.mjs          # http://127.0.0.1:4199/v1/chat/completions
```

特性：零依赖、CORS、按 3~7 字节切片写出（故意拆开中文/emoji 验证前端流式解码）、`Bearer invalid` → 401、`model=mock-error` → 500、`model=mock-slow` → 3s 延迟。

### 5.3 Node DOM 端到端（本机验证脚本，本地临时目录（不入库） 不提交）

```bash
node 临时开发目录（不入库）/dom-e2e.mjs
# → [dom-e2e] 16 passed, 0 failed
```

用 linkedom 提供 DOM、真实 mock SSE 起服务、@napi-rs/canvas 执行真实分享卡绘制，断言：助手挂载/离线模式/打开抽屉/离线回答（上下文·性价比·课程·动态）/简报/上下文预览 3728B≤6000/Esc/设置保存 localStorage/流式增量（观察到 22 个渲染状态）/401 错误态/离线兜底/XSS/复制/分享卡明暗两版 PNG 生成。

### 5.4 浏览器验证（headless Edge，截图）

深链接参数便于无交互截图：

```powershell
$edge = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
& $node scripts/serve.mjs     # 4173 真实站点
& $node 临时开发目录（不入库）/ai-share/serve.mjs  # 4180 分享卡截图页（_tmp 临时，不提交）
& $edge --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=6000 `
  --screenshot="docs/screenshots/assistant-offline.jpg" `
  "http://127.0.0.1:4173/?assistant=open&ask=%E7%8E%B0%E5%9C%A8%E4%B8%8A%E4%B8%8B%E6%96%87%E6%9C%80%E9%95%BF%E7%9A%84%E6%A8%A1%E5%9E%8B%EF%BC%9F"
```

截图清单见 `docs/screenshots/`：`assistant-drawer.jpg`、`assistant-offline.jpg`、`assistant-brief.jpg`、`assistant-drawer-dark.jpg`、`assistant-mobile.jpg`、`assistant-stream.jpg`、`share-card.jpg`、`share-card-dark.jpg`、`share-menu.jpg`。

> 注：本开发会话的沙箱禁止 Chromium 创建命名管道（`mojo platform_channel` Access denied），浏览器截图由 Lead 在不受限环境完成，属集成验收证据。

---

## 6. 性能与兼容

- 无构建、无框架、无外部字体/图床/CDN；ESM + 原生 `fetch`/`ReadableStream`/`AbortController`/`TextDecoder`。
- 数据按需加载：优先复用页面 `data.js` 的 `loadAll()` 缓存；助手打开时才加载；任一 JSON 失败自动降级。
- 期望浏览器：Chrome/Edge/Safari/Firefox 近两年版本（ES2022）。旧浏览器无 `ReadableStream` 时自动回退整体文本解析。
- 无控制台报错（集成后由 Lead 用 headless Edge 各页复核）。

---

## 7. 已知限制

1. **BYOK 跨域**：浏览器直连端点，需端点允许 CORS；否则走错误态并可用离线模式（或自建 Worker 代理）。
2. **离线问答是检索式**，不做推理；模型目录未收录的内容无法回答。
3. **Feed 仅覆盖动态**（`news`），模型/排行/资源变化通过对应页面浏览；如需扩展可在 `buildFeedItems` 增加来源（保持稳定 id）。
4. 分享卡字体依赖系统字体（不内嵌字体），不同系统观感略有差异。
5. 助手对话不持久化（刷新清空），这是有意的隐私选择。
6. RSS/JSON Feed 中的时间以数据生成时间为准，非页面实时时间。

---

## 8. 扩展指引

- **接入新模型服务商**：无需改代码，用户设置面板填 baseURL/model/apiKey 即可（OpenAI 兼容）。
- **换站点域名 / fork**：设置 `SITE_BASE_URL` 或 `--base-url` 重新生成 feed；`notify.mjs` 同样读取 `SITE_BASE_URL`。
- **新增分享按钮**：任意页面元素加 `data-share*` 属性即可（§4.1）。
- **自定义分享卡配色**：`share.js` 中 `cardPalette(dark)`；尺寸 `CARD_W/CARD_H`。
- **可选服务端代理**（解决 CORS/隐藏 key）：Cloudflare Worker 转发 `/chat/completions`，用户 baseURL 填 Worker 地址即可；本站仍保持纯静态。
- **新增离线意图**：`assistant-core.js` 的 `INTENTS` 加正则 + `localAnswer` 加分支 + 单测。

---

## 9. 给 README 的素材（可整段搬运）

> **AI 助手（BYOK + 离线）**
> 站点右下角内置 AI 助手：默认**离线模式**，直接检索站内模型/榜单/动态/学习资源/项目，无需登录与密钥；在设置中填入任意 OpenAI 兼容端点（DeepSeek、OpenRouter、硅基流动、本地 Ollama…）即可流式对话。密钥只保存在你浏览器的 localStorage，不经过本站服务器。支持「本周 AI 简报」一键生成与复制。
>
> **订阅与分享**
> 订阅 [RSS](https://chengxi-z.github.io/llm-pulse/feed.xml) 或 [JSON Feed](https://chengxi-z.github.io/llm-pulse/feed.json)；每条动态/排行可分享到 X、Telegram、微博，或一键生成 1200×630 品牌分享卡（明暗自适应，PNG 下载）。
>
> **本地预览**：`node scripts/serve.mjs` → http://127.0.0.1:4173/ （`?assistant=open` 可直接打开助手）。

---

## 10. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-03 | 初版：助手（BYOK 流式 + 离线问答 + 简报）、分享（菜单 + Canvas 分享卡）、Feed（RSS 2.0 + JSON Feed 1.1 + python 校验）、测试与文档；按 Lead 反馈过滤路由伪模型、修复 composer 提示重叠 |
