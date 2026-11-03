# AI Pulse · 照胆云 — 产品与技术规格说明书（SPEC v1.0）

> 状态：已定稿（Lead）｜ 日期：2026-11-03 ｜ 适用阶段：POC → MVP → Release
> 本文是团队唯一事实来源（Single Source of Truth）。执行成员如与本文件冲突，以本文件为准；
> 发现规格问题 → 在交付说明中提出，由 Lead 裁决更新版本号。

---

## 1. 背景与目标

### 1.1 用户诉求（原始）
- 持续关注大模型（LLM）最新进展；
- 设计一个**公域**（可公开访问）、**轻量**（无重框架/无数据库）、**轻奢**（克制、高级感、留白与金属质感）主题网站；
- 持续展示：国内外前沿模型**动态 / 排行 / 学习资源**；
- 内置 **AI 助手**；
- **个人 AI 项目成果**展示（或他人优秀项目）；
- 需要方案：跟踪哪些信息、怎么展示、怎么做推送/分享；
- 流程：**POC 验证 → 最小 MVP → 交付 demo/可验证产物 → 初版上 GitHub**；
- 优先采用 GitHub 社区已有方案/公开 API/现成数据源；
- 团队模式：Lead 负责「标准、目标/约束/分配、验收+报告」，成员负责「执行+交付」，用户人工复核；
- 主流程不得因非致命问题阻塞；阻塞项由 Lead 与用户对接。

### 1.2 产品目标（可度量）
| 目标 | 度量 | 达标线（Release） |
|---|---|---|
| 信息持续 | 数据自动刷新 | GitHub Actions 每日定时刷新 + 手动触发，站点数据时间戳 ≤24h |
| 信息广度 | 覆盖源类型 | ≥4 类（模型目录/厂商动态/评测排行/学习资源）+ 项目展示 |
| 可用性 | 页面可用 | 6 个核心页面 + AI 助手在桌面/移动端可用，无 JS 报错 |
| 质量 | 验收 | 数据合约校验 100% 通过；链接抽检 100% 有效（外部源允许 1 个降级） |
| 可验证 | 线上 | GitHub Pages 公网 URL 200，RSS/JSON Feed 可订阅且校验通过 |
| 可维护 | 贡献 | README 一键本地预览；数据源全部脚本化，新增源 ≤1 个文件改动 |

### 1.3 非目标（明确不做，防止 scope 蔓延）
- 不做用户系统/登录/数据库/后端服务（纯静态 + 浏览器端 AI 助手 BYOK）；
- 不做全量模型评测（只聚合公开榜单并标注来源与更新时间）；
- 不做付费墙、广告、复杂 CMS；
- 不做原生 App/小程序（公域 Web 优先；推送用 RSS + 社交分享 + 可选 webhook）；
- 初版不追求 SEO 极致/多语言切换（中文为主，术语保留英文）。

---

## 2. 关键洞察与已验证的环境事实（Lead 侦察，2026-11-03）

### 2.1 环境
| 项 | 事实 |
|---|---|
| 工作目录 | 仓库根目录（本地开发使用 workspace-write 文件沙箱） |
| Node | 本地 Node.js ≥ 20（便携版或系统安装均可；脚本零第三方依赖） |
| pnpm | 可选（仅开发辅助，非运行时依赖） |
| Python | 可选（Feed/XML 校验、图像处理辅助） |
| 浏览器 | 本地验收使用 Chromium/Edge headless/CDP（多宽度布局审计） |
| 网络关键结论 | Node.js / Python 直连可用；部分受限网络环境下系统 schannel/curl/git TLS 可能不可用，数据抓取脚本统一使用 Node `fetch` |
| 被墙 | 本机网络可能无法直连部分境外站点；管道使用镜像/降级策略，全量抓取在 GitHub Actions 侧执行 |
| 可用 | GitHub API（Actions 内 `GITHUB_TOKEN`）、OpenRouter API、公开榜单站点、RSS；本机可访问源以 `data/meta.json.sources` 实测状态为准 |
| GitHub | 发布通过 GitHub REST API（PAT 或 GITHUB_TOKEN，遵循最小权限）；Actions 权限按 job 最小化 |
| 时间 | 2026-11 项目 v1.x 迭代；线上数据以 Actions 每日刷新为准 |

### 2.2 决策结论
1. **纯静态站 + 预生成 JSON 数据**：HTML/CSS/原生 JS（ES2022，ESM），无构建步骤、无框架、无外部 CDN。理由：轻量、Pages 直接托管、GFW 环境可靠、社区验证成熟；避免 Next.js/Nuxt 构建链在受限环境的脆弱性。
2. **数据管道用 Node ESM 脚本**（`fetch → normalize → validate → feed`），在 **GitHub Actions** 侧跑全量源（CI 网络无墙），本机跑可达子集并保留快照；站点只读 `data/*.json`。
3. **双模式数据源**：`local`（本机可达：OpenRouter、GitHub API、LiveBench、Epoch、OpenCompass、SuperCLUE、hf-mirror）与 `ci`（全量：+ HF 官方、LMArena 数据集、官方 RSS）。元数据 `meta.json.sources[].status` 明示每个源的可用性，前端优雅降级。
4. **AI 助手 = 浏览器端 BYOK**（用户自填 OpenAI 兼容 baseURL/apiKey，localStorage 保存，绝不上传第三方服务器）+ **内置离线问答/检索降级**（对站点数据做本地检索与模板回答）。不引入服务端密钥。
5. **推送 = RSS/Atom + JSON Feed + GitHub Actions 定时刷新 + 社交分享（Web Share/意图链接/Canvas 分享卡）+ 可选 webhook（仓库 Secrets 配置，默认关闭）**。
6. **发布 = GitHub REST API 通过 Lead 本机 GCM token 创建公共仓库 + Git Data API 推送内容 + Pages workflow 部署**；随后 Actions 定时刷新验证线上数据。

---

## 3. 跟踪哪些信息（信息模型）

按「一手能力/价格 → 动态 → 排行 → 热度 → 学习 → 项目」六层组织。

### 3.1 模型目录（一手事实）
- 基础：名称/厂商/发布时间/是否开源权重/许可证/参数量（可见时）
- 能力：上下文窗口、最大输出、模态（文本/视觉/音频/视频）、工具调用/结构化输出/推理模式
- 价格：input/output（USD / 1M tokens）、缓存价（可见时）、免费标记
- 来源：OpenRouter Models API（首选，含 451 模型）、hf-mirror/HF、厂商官方页（补充）

### 3.2 厂商动态 / 发布新闻
- 类型：新模型发布、版本迭代、定价调整、开源权重、API 能力、融资/政策/研究
- 来源：OpenRouter 新增模型（diff 自动生成）、官方博客 RSS（OpenAI/Anthropic/Google/DeepSeek/阿里 Qwen/月之暗面/智谱/MiniMax/字节/Meta）、GitHub Releases（transformers/vLLM/Ollama 等）、HF Trending（镜像）
- 字段：标题、摘要、来源、时间、标签、关联模型、重要度（1-3）

### 3.3 评测排行（聚合公开榜单，附来源）
- 综合/G 通用偏好：LMArena（Elo/Arena Score）
- 智能指数：Artificial Analysis
- 推理/综合基准：LiveBench、Epoch AI Benchmarking Dashboard
- 代码/Agent：SWE-bench、Aider Polyglot、Terminal-Bench（取公开可得者）
- 中文/国内：OpenCompass、SuperCLUE（C-Eval/CMMLU 作补充）
- 成本效率：OpenRouter 价格派生（$ / 1M tokens 与上下文比）
- 规则：只展示公开可引用数据；每条榜单标注 source URL 与 updatedAt；不伪造分数；拿不到就显示降级状态

### 3.4 使用热度
- OpenRouter 模型目录变化/覆盖厂商数；HF 趋势（hf-mirror 排序 trendingScore/downloads）；GitHub 项目 stars 增速

### 3.5 学习资源
- 课程/教程/论文/工具/Awesome 列表；中英双语；难度分级；免费优先；每条含作者/语言/标签/是否推荐

### 3.6 项目成果
- 个人 AI 项目（用户提供或占位模板）与社区精选（GitHub API 拉 stars/更新时间）
- 字段：名称/作者/链接/一句话价值/标签/亮点/来源（self/community）/许可证

### 3.7 来源可达性矩阵（初始，POC 阶段验证并更新）
| 来源 | 类型 | 本机(node) | CI(Actions) | 备注 |
|---|---|---|---|---|
| OpenRouter `/api/v1/models` | 模型/价格 | ✅ 200 | ✅ | 首选一手源 |
| api.github.com | 项目/仓库 | ✅ 200（60/h） | ✅ 5000/h | 发布用 token 有 repo 权限 |
| hf-mirror.com API | 模型/数据集镜像 | ✅ 200 | ➖ | HF 被墙时的本地替代 |
| huggingface.co | 模型/数据集 | ❌ 超时 | ✅ | CI 全量 |
| lmarena.ai | 排行 | ❌ 超时 | ✅ | 或用 HF `lmarena-ai/leaderboard-dataset`（CI/hf-mirror 验证） |
| livebench.ai | 排行 | ✅ 200（需挖数据文件） | ✅ | 待 POC |
| artificialanalysis.ai | 排行 | 待 POC | ✅ | Next.js 数据可能内嵌 HTML |
| epoch.ai | 排行 | ✅ 200 | ✅ | 待 POC 找 CSV/JSON |
| rank.opencompass.org.cn | 中文排行 | ✅ 200（SPA） | ✅ | 待 POC 找 API |
| superclueai.com | 中文排行 | ✅ 200（SPA） | ✅ | 待 POC 找 API |
| 官方博客 RSS | 动态 | 待 POC | ✅ | 部分域名可能被墙 |
| npm registry (npmmirror) | 开发依赖 | ✅ | ✅ | 本机装包走 npmmirror |

---

## 4. 怎么展示信息 / 成果（信息架构与视觉）

### 4.1 页面结构
```
/ (首页)          Hero + 本周速览（模型数/更新数/数据源状态）+ 本周新模型 + 榜单 Top + 最新动态 + 学习/项目入口 + 订阅
/news.html        动态时间线：筛选（类型/厂商/标签）+ 搜索 + 分享按钮 + 来源外链
/rankings.html    多榜单切换（LMArena/智能指数/推理/代码/中文/性价比）+ 指标说明 + 更新时间 + 来源
/models.html      模型库：搜索/筛选（厂商、模态、开源、价格区间、上下文）+ 排序 + 价格/上下文可视化
/resources.html   学习资源：按类型/难度/语言筛选，精选置顶
/projects.html    项目展示：自研项目区 + 社区精选区（stars/更新时间/标签）
/about.html       方法与数据源、更新机制、免责声明、订阅方式、GitHub 链接
```
AI 助手：全站右下角悬浮入口 → 抽屉式对话（上下文字段注入站点数据摘要；设置面板填 baseURL/model/apiKey）。

### 4.2 视觉规范（轻奢）
- 关键词：**纸感米白 + 墨色 + 香槟金 + 墨绿点缀**；衬线标题、无衬线正文；细金线；大留白；低阴影；克制动效。
- Design Tokens（CSS 变量，`site/assets/css/theme.css`）：
  - Light: `--bg:#F6F1E9; --surface:#FFFDF9; --ink:#14100C; --muted:#6B6257; --gold:#B08A4F; --gold-soft:#D9C39A; --line:#E4D9C6; --accent:#12312A`
  - Dark（`prefers-color-scheme` + 手动切换）: `--bg:#0E0D0B; --surface:#171411; --ink:#F2ECE2; --muted:#A79B8A; --gold:#C9A227; --line:#2A251E; --accent:#5E8B74`
  - 字体：标题 serif 栈 `"Cormorant Garamond","Noto Serif SC","Songti SC",Georgia,serif`；正文 `"Inter","PingFang SC","Microsoft YaHei",system-ui,sans-serif`（全部系统字体，无外链）
  - 排版：显示字号 clamp(2.4rem,5vw,4.2rem)；小标签 uppercase + letter-spacing .14em + 金色；行高 1.75（正文）
  - 布局：max-width 1180px；4pt 间距标度；圆角 2/8/14；卡片 1px line + 米白面 + hover 上浮 2px/金线
  - 动效：IntersectionObserver 淡入上移 300ms，`prefers-reduced-motion` 关闭
- 响应式断点：360 / 768 / 1024 / 1440；移动端导航折叠；助手抽屉全屏。
- 无障碍：对比度 ≥4.5:1（正文）、语义化标签、`aria-*`、键盘可达、focus-visible 金线、跳过导航链接。
- 性能预算：CSS ≤80KB、JS ≤160KB（原始未压缩；gzip 后约 ≤50KB，不含 data JSON）、无外链字体/图片/CDN、首屏无布局抖动。POC 实测值记入验收报告（v1.0 修订：原 40/100KB 对含 3 个功能模块的站点过紧，调整为轻量级合理值）。

### 4.3 内容呈现原则
- 中文优先，术语中英对照（如「上下文窗口 Context Window」）；
- 每个数据块显示「更新时间 + 来源」；
- 数据缺失/源不可达 → 显示空态文案与降级说明，绝不显示假数据；
- 排行数据必须可追溯来源；项目卡片突出「一句话价值 + 亮点」。

---

## 5. AI 助手设计

- 入口：全站悬浮按钮 + 抽屉（`#assistant-root`），快捷键 `/` 唤起（输入框外时）。
- 模式：
  1. **BYOK 在线**：设置 baseURL（默认 `https://api.deepseek.com/v1` 或 OpenRouter）、apiKey、model；OpenAI 兼容 `/chat/completions`，流式 SSE 渲染，Markdown-lite 渲染（粗体/列表/代码/链接），停止/清空/复制。
  2. **离线降级**：无 key 或请求失败 → 基于站点数据的本地检索问答（模型/排行/资源/项目关键词），预置快捷问题（"现在上下文最长的模型？""性价比最高的模型？""推荐入门课程""本周要点简报"）。
- 上下文注入：把 `meta/models/news/rankings/resources/projects` 的摘要（Top N + 统计）拼入 system prompt，控制 ≤6KB；`assistant-core.mjs` 负责可测试的纯函数（buildContext / parseSSE / localAnswer）。
- 安全：密钥只存 localStorage，绝不上传；设置面板明确提示；发送前可查看注入上下文；不采集用户数据。
- 验收：mock OpenAI-compatible SSE 服务端到端通过；无 key 时离线回答可用；错误态（401/网络/超时）友好。

---

## 6. 推送 / 分享设计

1. **RSS 2.0 + Atom + JSON Feed**：`site/feed.xml`、`site/feed.json`，由数据生成，头图与摘要；about 页提供订阅说明。
2. **自动刷新推送**：`.github/workflows/deploy.yml` 每日 cron + workflow_dispatch：抓数据 → 校验 → 生成 feed → 部署 Pages。数据变化即站点更新（无需人工）。
3. **可选 webhook 广播**：workflow 支持 `FEISHU_WEBHOOK` / `TELEGRAM_BOT_TOKEN+CHAT_ID` / Server酱（Secrets 配置才启用；默认跳过），实现"有新模型→推送到群/频道"。
4. **社交分享**：每张动态卡/排行卡分享按钮 → Web Share API（移动端）→ 回退到 X / Telegram / 微博 意图链接 + 复制链接 + 复制分享文案。
5. **品牌分享卡**：Canvas 客户端生成 1200×630 卡片（标题/关键数字/品牌/日期）→ 下载 PNG + 复制文案。
6. **AI 简报分享**：助手一键生成"本周 AI 简报"（结构化要点），复制成 Markdown/纯文本用于公众号/群分享。
7. **OpenGraph/Twitter Card**：全站 + 各页 meta；og 图用 Python Pillow 预生成 PNG（不依赖外链）。

---

## 7. 技术架构

```
数据源(公开API/RSS/数据集/镜像)
   │  scripts/fetch-data.mjs（mode=local|ci，源注册表 + 超时/重试 + 原始快照 data/snapshot/）
   ▼
data/*.json（合约 v1：meta/models/news/rankings/resources/projects）
   │  scripts/validate.mjs（合约校验，失败即 CI 红）
   ├─ scripts/build-feed.mjs → site/feed.xml / site/feed.json
   ▼
site/（纯静态：HTML + CSS + 原生 ESM JS；fetch 本地 JSON 渲染；AI 助手 BYOK；分享卡 Canvas）
   ▼
GitHub Actions（cron 每日 + push）→ GitHub Pages（https://<user>.github.io/llm-pulse/）
```
- 目录约定见 README；`schemaVersion: 1`；所有生成文件带 `generatedAt`。
- 本地预览：`node scripts/serve.mjs`（零依赖静态服务器，默认 127.0.0.1:4173）；`file://` 打开时优雅提示。
- 测试：`node --test tests/`（数据合约、normalize、feed、assistant-core 纯函数）+ 浏览器冒烟（headless Edge `--dump-dom` 断言关键节点/无报错）。

---

## 8. 团队分工（Agent Teams）

| 角色 | 成员 | 负责模块（执行+交付） | 写作用域（workspace 相对） |
|---|---|---|---|
| Lead | lead | 标准/目标/约束/分配；契约与骨架；集成；验收+报告；GitHub 发布 | `docs/SPEC.md`、`docs/DATA-CONTRACT.md`、`docs/ACCEPTANCE.md`、`README.md`、`LICENSE`、`package.json`、`.github/**`、`scripts/validate.mjs`、`scripts/serve.mjs`、`data/`（种子与最终整合） |
| 成员 A | poc-data | POC：数据源验证矩阵 + 采集/归一化/校验管道 + 报告 | `scripts/fetch/**`、`scripts/normalize.mjs`、`scripts/fixtures/**`、`docs/POC-REPORT.md`、`data/**`（生成产物） |
| 成员 B | site-mvp | 站点 MVP：6 页 + 轻奢主题 + 渲染/筛选/搜索/响应式/无障碍 | `site/*.html`、`site/assets/css/{theme,base,components}.css`、`site/assets/js/{app,data,render}.js`、`site/assets/img/**` |
| 成员 C | ai-share | AI 助手（BYOK+离线）+ 推送/分享（feed、分享卡、简报、webhook 文档） | `site/assets/js/{assistant,share,assistant-core}.js`、`site/assets/css/{assistant,share}.css`、`scripts/build-feed.mjs`、`docs/AI-SHARE.md` |
| 复核 | 用户 | 最终人工复核 | — |

> 规则：写作用域尽量不重叠；跨域修改先在共享任务里登记并通知 Lead；`data/**` 以 poc-data 的产物为准，Lead 仅做最后整合。

### 8.1 共享任务板（team_task）
1. `T1 POC 数据管道与源验证`（owner: poc-data；依赖：SPEC/合约已发布）
2. `T2 站点 MVP 与轻奢主题`（owner: site-mvp；依赖：合约 + 种子数据）
3. `T3 AI 助手与推送/分享`（owner: ai-share；依赖：合约 + 种子数据）
4. `T4 集成、验收与 GitHub 发布`（owner: lead；依赖 T1/T2/T3）
5. `T5 最终报告与人工复核包`（owner: lead；依赖 T4）

---

## 9. 阶段与交付物

### Phase P（POC，先验证）
**验证问题**：公开数据源能否稳定拿到并归一化？纯静态站能否在无构建工具下快速渲染出轻奢感？AI 助手 BYOK + 离线降级是否可行？分享卡/Feed 是否可生成？
- 交付：
  - `docs/POC-REPORT.md`：来源矩阵（HTTP 状态/耗时/字节数/样例）、可行源与降级策略、管道结构、已知风险
  - `scripts/fetch-data.mjs --mode=local` 可运行，产出 `data/*.json` + 原始快照（本地可达源）
  - 原型页：首页 + 动态页骨架渲染真实数据；助手抽屉静态原型；分享卡原型
  - 证据：headless Edge 截图/DOM 断言记录
- 时限：首轮 ≤ 40 分钟出报告；不追求完整
- Gate：数据 JSON 通过契约校验；原型页 0 console error；报告含实测证据

### Phase M（MVP）
- 6 页全部完成，真实数据 + 空态降级；筛选/搜索/响应式/暗色模式/a11y
- AI 助手 BYOK 流式 + 离线降级 + 错误态；分享卡 + Feed 生成
- CI 全量源（HF/LMArena 在 Actions 侧验证）
- `node --test` 全绿；`scripts/validate.mjs` 通过；README（中文）+ 截图
- Gate：MVP 验收清单全过（见 ACCEPTANCE.md）

### Phase R（Release / 上 GitHub）
- Lead 创建公共仓库 `chengxi-Z/llm-pulse`（public，MIT），推送初版（含 CI/deploy workflow）
- GitHub Pages 部署成功；workflow_dispatch 触发一次数据刷新验证线上
- 线上验收：URL 200、页面内容正确、feed 可用、无 console 报错（headless Edge 打开线上 URL）
- Gate：线上验收清单全过 + 报告

### Phase F（报告）
- `docs/ACCEPTANCE.md` 完成验收结论；`docs/RELEASE.md` 含线上链接/架构/使用说明
- 给用户的「复核包」：链接、截图、验收清单、已知限制、后续路线（Roadmap）

---

## 10. 验收标准（Release 总表）

**功能**
- [ ] 首页：本周速览数字、本周新模型、榜单 Top、最新动态、学习/项目入口、数据源状态
- [ ] 动态页：≥10 条真实数据、类型/标签筛选、搜索、分享可用
- [ ] 排行页：≥1 个真实榜单（线上 CI 数据 ≥3 个）、来源/更新时间标注、口径说明
- [ ] 模型库：搜索 + ≥3 个筛选维度 + 价格/上下文排序
- [ ] 学习资源：≥15 条真实资源，类型/难度筛选
- [ ] 项目：≥6 个真实项目（社区精选）+ 个人项目位
- [ ] AI 助手：BYOK 流式对话（mock/真实端点）可用；无 key 离线问答可用；密钥仅本地
- [ ] 分享：动态卡分享/复制/分享卡 PNG 生成可用；Feed 可访问且格式合法
- [ ] 自动刷新：workflow 定时/手动触发成功，线上数据更新时间刷新

**质量**
- [ ] `node --test` 通过；`scripts/validate.mjs` 通过；数据时间戳新鲜（≤24h 线上）
- [ ] 桌面 1440 + 移动 390 截图无溢出/错位；暗色模式可用
- [ ] headless Edge 控制台无 error（各页）
- [ ] README 可让新人 3 步本地跑起来；数据源与免责声明完整

**发布**
- [ ] 公共仓库 + MIT + 合理 commit 历史 + Actions 绿
- [ ] Pages 线上 URL 200 + HTTPS；RSS/JSON Feed 可访问
- [ ] 报告含：验收结论、证据、限制、Roadmap、给用户的复核清单

---

## 11. 风险与缓解
| 风险 | 影响 | 缓解 |
|---|---|---|
| 数据源失效/改版/限流 | 数据陈旧 | 源注册表 + 状态降级 + 快照回退；优先 API/数据集，爬虫仅兜底 |
| GFW/本机网络受限 | 本地无法全量验证 | node 直连可用源 + hf-mirror；全量在 Actions 验证；CI 结果用 API 回读 |
| 爬虫合规 | 法务风险 | 仅公开数据、标注来源链接、遵守 robots/ToS、不存全文、可申请移除 |
| 无服务端密钥 | AI 助手门槛 | BYOK + 离线降级 + 设置向导；文档说明替代（Cloudflare Worker 代理可选） |
| 视觉不达"轻奢" | 交付质量 | Design Tokens 先行 + 参考 Awwwards/线性风；截图复核迭代 |
| Pages 需公共仓库 | 发布受限 | 默认 public（公域要求一致）；如用户要求私有，则改用 Cloudflare Pages/本地 demo 并说明 |
| 用户未确认品牌/项目内容 | 返工 | 默认品牌「AI Pulse · 照胆云」、repo `llm-pulse`；个人项目以可配置数据文件承载，不泄露隐私 |

---

## 12. 决策日志（变更需 Lead 确认）
- v1.0（2026-11-03）：纯静态 + Node 管道 + Actions/Pages；BYOK 助手；RSS+社交分享推送；仓库默认 `chengxi-Z/llm-pulse`（public，MIT）；品牌「AI Pulse · 照胆云」。
- v1.1（2026-11-03，用户复核后）：新增 5 套主题 + 回顶/滚动条/按钮色优化；中/英双语（中文默认）；工程英文化（英文注释/CONTRIBUTING/README.en）；开源「一句话交付项目」Skill（skills/one-sentence-project，见 `docs/V1.1-CONTRACT.md`）。本文件 v1.0 条款在 v1.1 范围内以 `docs/V1.1-CONTRACT.md` 为准。
