# AI Pulse · 照胆云

**中文** ｜ [English](README.en.md)

> 公域 · 轻量 · 轻奢的大模型观察站：**模型动态 / 评测排行 / 模型库 / 学习资源 / 项目展示 / 我的技能**，首页可视化仪表盘、5 套主题、中英双语，内置可 BYOK 的 AI 助手，每日自动更新。

[![CI](https://github.com/chengxi-Z/llm-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/chengxi-Z/llm-pulse/actions/workflows/ci.yml)
[![Deploy](https://github.com/chengxi-Z/llm-pulse/actions/workflows/deploy.yml/badge.svg)](https://github.com/chengxi-Z/llm-pulse/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-B08A4F.svg)](LICENSE)
[![Pages](https://img.shields.io/badge/GitHub%20Pages-online-12312A.svg)](https://chengxi-z.github.io/llm-pulse/)

**在线体验**：[https://chengxi-z.github.io/llm-pulse/](https://chengxi-z.github.io/llm-pulse/)　**数据每日自动刷新**（GitHub Actions）。

> **v1.4.0 已发布**（2026-11-04）：**安全与隐私加固（P0）** + 榜单 Top10/Top3 徽章、任意 N 模型对比（真实评分）、**斩杀线 2.0（能力×成本四象限）**、真实 Hacker News AI 热榜（含讨论摘要）、图表自动轮播、内容优先的紧凑引导页 ｜ [安全政策](SECURITY.md) · [安全审计报告](docs/SECURITY-AUDIT.md) ｜ [验收报告](docs/ACCEPTANCE.md) ｜ [发布说明](docs/RELEASE.md) ｜ [v1.4 契约](docs/V1.4-CONTRACT.md) ｜ [规格](docs/SPEC.md) · [数据合约](docs/DATA-CONTRACT.md) · [UI 规范](docs/UI-SPEC.md) · [分发 playbook](docs/DISTRIBUTION.md) · [技能指南](docs/SKILLS.md) · [POC 报告](docs/POC-REPORT.md)

---

## 这是什么

大模型领域信息密度高、变化快：新模型、新价格、新榜单、新工具几乎每天出现，但信息散落在各家官网、Twitter/X、榜单站和论文里。**AI Pulse** 把这些公开信息聚合为一页可读的「智能纪事」：

- **动态（Dispatch）**：模型发布、版本迭代、定价与评测变化，按时间线阅读，逐条标注来源；
- **排行（Rankings）**：LMArena / Artificial Analysis / LiveBench / Epoch AI / OpenCompass 等多榜聚合，每榜 **Top10 + 1/2/3 名内敛徽章**、可展开全部，标注口径/来源/更新时间，附极简分发信息条（站点 + GitHub + 二维码）；
- **模型库（Models）**：451+ 模型的上下文、模态、价格、开源信息，可搜索筛选排序；支持**任意勾选 2–6 个模型对比**——真实榜单评分（AA / LMArena / LiveBench / Epoch / OpenCompass）+ 价格/上下文/模态/许可，未匹配评选显示「—」并注明匹配规则；
- **学习资源（Learn）**：中英双语课程、教程、论文、Awesome 列表，按难度与类型筛选；
- **项目（Build）**：个人 AI 项目 + 社区精选开源项目（实时 GitHub stars）；
- **我的技能（My Skills）**：Agent Skills / Playbooks 库——我的技能 + 官方/社区精选，提供使用引导（安装命令/触发示例/自检）、分享卡与 GitHub 提交入口（Issue 表单 / JSON 模板 / PR）；
- **概览仪表盘（Overview）**：6 KPI 数字墙（count-up）+ **自动轮播图表**（每 6.5s 柔和切换，悬停暂停、移动可滑）：近 12 周发布柱状图、输出价格分层环形饼图、**AI 模型斩杀线 2.0**（能力×成本散点：AA 智能指数 × 输出价格 log 轴，能力/成本双 P50 斩杀线与四象限，左上为「高能低价」生存区，标注样本数与免责）；另配独立 **AI 热搜话题** 卡片——**真实 Hacker News 近 7 天 AI 讨论 Top10**（标题 + 讨论摘要 + points/comments + 来源域 + 外链）。
- **AI 助手**：内置对话助手，支持 DeepSeek / OpenRouter / 任意 OpenAI 兼容 endpoint（BYOK，密钥**只存在浏览器 localStorage、不上传本站、不写日志**；仅接受 https 端点，本机 Ollama 等回环地址可用 http）；无 key 时自动降级为离线检索问答；
- **分发（Distribution）**：分享卡内置 logo + 站点/GitHub 地址 + 二维码，榜单可一键生成专属分享图；RSS / JSON Feed、社交文案模板与渠道 playbook。

## 截图

| 首页 · 桌面 | 动态 · 桌面 |
| --- | --- |
| ![首页](docs/screenshots/site-home-desktop.jpg) | ![动态](docs/screenshots/site-news-desktop.jpg) |

| 排行 · 桌面 | 模型库 · 桌面 |
| --- | --- |
| ![排行](docs/screenshots/site-rankings-desktop.jpg) | ![模型库](docs/screenshots/site-models-desktop.jpg) |

| 学习资源 · 桌面 | 项目 · 桌面 |
| --- | --- |
| ![学习资源](docs/screenshots/site-resources-desktop.jpg) | ![项目](docs/screenshots/site-projects-desktop.jpg) |

| 首页 · 移动端 | 暗色模式 |
| --- | --- |
| ![移动端](docs/screenshots/site-home-mobile.jpg) | ![暗色](docs/screenshots/site-home-dark.jpg) |

| AI 助手（英文离线模式） | 英文品牌分享卡（Canvas 生成） |
| --- | --- |
| ![AI Assistant](docs/screenshots/lang-en-assistant.jpg) | ![Share card EN](docs/screenshots/lang-en-share-card.jpg) |

**v1.1 主题与双语**

| 纸墨雅金（默认） | 深夜鎏金 |
| --- | --- |
| ![ivory](docs/screenshots/theme-ivory-home.jpg) | ![noir](docs/screenshots/theme-noir-home.jpg) |

| 青瓷墨绿 | 暮云玫瑰 |
| --- | --- |
| ![jade](docs/screenshots/theme-jade-home.jpg) | ![rose](docs/screenshots/theme-rose-home.jpg) |

| 极简石墨 | 主题选择器 / 回顶按钮 |
| --- | --- |
| ![graphite](docs/screenshots/theme-graphite-home.jpg) | ![theme picker](docs/screenshots/theme-picker-open.jpg) |

| 英文界面 · 首页 | 英文界面 · 排行 |
| --- | --- |
| ![EN home](docs/screenshots/lang-en-home.jpg) | ![EN rankings](docs/screenshots/lang-en-rankings.jpg) |

**v1.2 仪表盘 · 技能库 · 分发**

| 概览仪表盘（KPI + 柱状图 + 饼图） | 我的技能（11 条真实技能） |
| --- | --- |
| ![dashboard](docs/screenshots/v13-dashboard-charts.jpg) | ![skills](docs/screenshots/v13-skills.jpg) |

**v1.3 斩杀线 · 话题热榜 · 对齐修复**

| AI 模型斩杀线 + AI 话题热榜 | 英文界面（kill line / hot topics） |
| --- | --- |
| ![kill line & hot topics](docs/screenshots/v13-dashboard-kill-hot.jpg) | ![EN dashboard](docs/screenshots/v13-dashboard-en.jpg) |

**v1.4 安全加固 · 榜单/对比/斩杀线2.0/真实热榜/轮播**

| 首页 · 自动轮播图表 | 斩杀线 2.0（能力×成本四象限） |
| --- | --- |
| ![v1.4 home](docs/screenshots/v14-dashboard-home.jpg) | ![v1.4 scatter](docs/screenshots/v14-dashboard-scatter.jpg) |

| 真实 HN AI 热搜话题 | 榜单 Top10 + Top3 徽章 |
| --- | --- |
| ![v1.4 topics](docs/screenshots/v14-dashboard-topics.jpg) | ![v1.4 rankings](docs/screenshots/v14-rankings-top10.jpg) |

| 任意 N 模型对比（真实评分） | 英文界面 |
| --- | --- |
| ![v1.4 compare](docs/screenshots/v14-models-compare.jpg) | ![v1.4 EN](docs/screenshots/v14-dashboard-en.jpg) |

| 使用引导（安装/触发/自检） | 榜单专属分享卡（含地址+二维码） |
| --- | --- |
| ![skill guide](docs/screenshots/v12-skill-modal.jpg) | ![share card v2](docs/screenshots/share-card-v2-board-preview.png) |

> 更多截图（各页移动端、英文助手/分享、回顶滚动状态等）见 [`docs/screenshots/`](docs/screenshots/)。

## 特性

- **纯静态、零构建**：HTML + CSS + 原生 ESM JS，无框架、无 CDN、无外链字体，GitHub Pages 直接托管；
- **数据驱动**：Node 脚本从公开 API / 公开榜单 / RSS 抓取并归一化为版本化 JSON（`schemaVersion: 1`），前端只读；
- **每日自动更新**：GitHub Actions 定时抓取 → 校验 → 生成 Feed → 部署；数据源失败的自动降级并在页面标注；
- **轻奢视觉**：纸感米白 / 墨色 / 香槟金 / 墨绿点缀，衬线标题 + 大留白 + 细线；**5 套主题**（纸墨雅金 / 深夜鎏金 / 青瓷墨绿 / 暮云玫瑰 / 极简石墨）+ 跟随系统，回顶按钮、美化滚动条，响应式，无障碍友好；
- **中英双语**：中文默认，一键切换全英文 UI（含 AI 助手 / 分享 / 空态 / 404），`?lang=en` 深链，词典校验保证 zh/en 100% 对齐；
- **AI 助手 BYOK**：OpenAI 兼容流式对话 + 站点数据上下文注入 + 离线降级 + 一键「本周简报」；
- **可分享**：Web Share / 复制 / 社交意图链接 / Canvas 品牌分享卡（1200×630，含 logo + 站点地址 + GitHub + 二维码，榜单可专属生成）；
- **可视化**：首页数据杂志风仪表盘——6 KPI（count-up）、12 周发布柱状图、输出价格环形饼图、**AI 模型斩杀线**（P50 输出价格为界，log 轴展示 444 个模型的价格分布）、**AI 话题热榜**（8 主题真实统计，点击跳动态页 `?tag=` 筛选）；纯 SVG/CSS/JS 无图表库，reduced-motion 降级；
- **对齐与响应式**：自动化布局审计覆盖 7 个宽度（1440/1280/1024/834/768/390/360）× 全部页面，0 横向溢出 / 0 同行错位 / 0 浮动遮挡；
- **技能库**：`data/skills.json` 维护、使用引导、分享与提交（Issue/PR，无后端）；
- **可校验**：数据合约校验器（含 skills）+ Node 单测 + 数据源状态灯 + 构建产物 staging 校验；
- **一句话交付 Skill**：[`skills/one-sentence-project/`](skills/one-sentence-project/SKILL.md) —— 把本项目的方法论沉淀为可复用 Agent Skill（见下文）。

## 快速开始

要求：Node.js **≥ 20**（零依赖，无需 `npm install`）。

```bash
git clone https://github.com/chengxi-Z/llm-pulse.git
cd llm-pulse

# 本地预览（静态服务器，自动把仓库根 data/ 映射到 /data/）
node scripts/serve.mjs
# → http://127.0.0.1:4173/
```

其它常用命令：

```bash
node scripts/fetch-data.mjs --mode=local   # 本机可达数据源抓取并生成 data/*.json
node scripts/build-feed.mjs                # 生成 site/feed.xml + site/feed.json
node scripts/validate.mjs                  # 数据合约校验（--strict 发布前模式）
node --test                               # 单元测试（自动发现 tests/）
node scripts/stage-site.mjs                # 组装 Pages 发布产物到 _artifact/
```

## 数据从哪来（跟踪什么）

| 类别 | 内容 | 来源 | 本机 | CI(Actions) |
| --- | --- | --- | --- | --- |
| 模型目录/价格 | 名称、厂商、上下文、模态、输入/输出价格、发布时间 | OpenRouter Models API | ✅ | ✅ |
| 榜单 | 综合智能指数、推理、代码、中文、成本效率 | Artificial Analysis、LiveBench 2.0、Epoch AI（ECI/GPQA/SWE-bench）、OpenCompass Arena、LMArena（HF 数据集） | 部分✅ | 全量✅ |
| 动态 | 新模型、版本、定价、安全、研究 | OpenRouter 新增 diff + OpenAI/Google/DeepSeek/Qwen 等官方 RSS | 部分✅ | 全量✅ |
| 项目 | 社区精选开源项目 stars/更新时间 | GitHub API | ✅ | ✅ |
| 技能 | Agent Skills / Playbooks（我的 + 官方/社区精选） | 人工精选 + GitHub API stars/更新时间 | ✅ | ✅ |
| 学习资源 | 课程/教程/论文/工具 | 人工精选（持续更新） | ✅ | ✅ |
| 热度 | Hugging Face 趋势 | hf-mirror（本机）/ Hugging Face（CI） | ✅(镜像) | ✅ |

> 本机（中国大陆网络）Hugging Face、LMArena 等直连不可达，管道自动降级并记录到 `data/meta.json.sources`；GitHub Actions 侧网络无限制，可抓全量。所有数据均来自公开可引用页面，保留来源链接与更新时间；不存储全文、不绕过访问限制。

## 架构

```
公开数据源（API / RSS / 公开榜单 / HF 数据集）
        │  scripts/fetch-data.mjs --mode=local|ci
        ▼
data/{meta,models,news,rankings,resources,projects,skills}.json   ← 版本化数据合约 v1
        │  scripts/validate.mjs（失败即红）
        ├─ scripts/build-feed.mjs → site/feed.xml / site/feed.json
        ▼
site/（纯静态：8 页 + 原生 ESM + 仪表盘 + BYOK AI 助手 + 分享卡）
        ▼
GitHub Actions（每日 cron + push）→ GitHub Pages
```

## 目录结构

```
llm-pulse/
├─ data/                  # 生成的数据（schemaVersion: 1，提交快照便于本地开发）
│  ├─ skills.json         # 技能库（我的 + 官方/社区，11 条真实条目）
│  └─ snapshot/           # 原始抓取快照（调试/测试 fixture）
├─ site/                  # 纯静态站点（发布根）
│  ├─ index.html news.html rankings.html models.html resources.html projects.html skills.html about.html
│  ├─ assets/css/         # theme(设计token,5主题) base components assistant share
│  ├─ assets/js/          # data/render/app/i18n/dashboard/skills + assistant(核心/UI) + share
│  ├─ assets/i18n/        # zh.json / en.json 词典（763 keys）
│  ├─ assets/img/         # logo/favicon/og-cover/qr-site/qr-repo
│  └─ feed.xml feed.json  # 由脚本生成
├─ scripts/               # Node 数据管道 / 校验 / 预览 / staging / i18n 检查
├─ skills/                # 可复用 Agent Skill（one-sentence-project：一句话交付项目）
├─ tests/                 # node:test 单测
├─ docs/                  # SPEC、数据合约、POC 报告、验收报告、截图
└─ .github/workflows/     # ci.yml / deploy.yml / refresh-data.yml
```

## AI 助手（BYOK）

点击右下角「AI 助手」→ 设置：

| 服务 | baseURL | 模型示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenRouter | `https://openrouter.ai/api/v1` | `deepseek/deepseek-chat` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |
| 本地 Ollama | `http://127.0.0.1:11434/v1` | `qwen2.5:7b` |

- 密钥只保存在浏览器 `localStorage`，**不会上传到任何服务器**（本站无后端）；
- 请求从浏览器直连你填写的 endpoint；如跨域失败，可改用支持 CORS 的服务或自建代理；
- 无 key / 请求失败时自动切换**离线模式**：基于站点数据做检索问答与「本周简报」，不产生任何网络请求；
- 上下文仅注入站点公开数据的摘要（≤6KB），可随时清除。

## 订阅 / 分享 / 推送

- **RSS**：`https://chengxi-z.github.io/llm-pulse/feed.xml` ｜ **JSON Feed**：`.../feed.json`
- **分享卡 v2**：新闻/榜单/技能/站点四类卡片，**内置 logo + 站点地址 + GitHub 地址 + 二维码**（1200×630，明暗/中英自适应，Canvas 本机生成不上传）；榜单页每榜「分享本榜」可生成专属卡片。
- **分享菜单**：系统分享 / 复制链接 / 复制本榜链接 / 复制文案 / 生成分享卡 / 复制站点地址 / 复制 GitHub 地址 / 打开 GitHub / 复制 RSS / X / Telegram / 微博；复制文案必含站点 URL 与 GitHub 地址。
- **分发 playbook**：[`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md)（卡片解剖、社交文案模板、渠道与节奏、SEO/OG、二维码/UTM、可信话术、每周 checklist）。
- **可选 webhook 广播**（仓库 Secrets 配置后生效，默认关闭）：`FEISHU_WEBHOOK`、`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`、`SERVERCHAN_KEY`。
- **自动更新**：`.github/workflows/deploy.yml` 每日 09:17（北京时间）抓取 → 校验 → 部署；`refresh-data.yml` 每周回写数据快照。

## 我的技能（My Skills）

- **是什么**：Agent Skills / Playbooks 库。[`skills.html`](site/skills.html) 收录 11 条真实技能（1 条自研 + 5 条官方 + 5 条社区，stars/更新时间来自 GitHub API），每条提供一句话价值、适用/不适用、安装命令、使用步骤、自检命令与源码链接。
- **怎么用**：在线「使用引导」复制安装命令 → 安装到本机 Agent skills 目录（`~/.dsh/skills/`、`~/.claude/skills/` 或你的 Agent 目录）→ 对话中触发。详见 [`docs/SKILLS.md`](docs/SKILLS.md)。
- **怎么提交（共享）**：本站无后端，三条路径——① [GitHub Issue 表单](.github/ISSUE_TEMPLATE/skill-submission.yml) ② 下载 JSON 模板后 PR ③ Fork & PR 修改 `data/skills.json`；维护者审核（真实可用、许可证、无恶意内容）后合入上线。
- **分享**：每条技能可生成品牌分享卡（技能名 + 一句话 + 安装目标 + 站点/GitHub 地址 + 二维码）。

## AI 模型斩杀线（Kill line）

首页仪表盘的「AI 模型斩杀线」按**输出价格中位数（P50）**划分：当前 `$2.00 / 1M tokens` 为界，444 个已标价模型中 **232 个在生存区（≤斩杀线，52.3%）**、**212 个在斩杀区（>斩杀线）**；log 价格轴逐模型展示分布，并注明「规则可调整、仅按输出价格划分，不构成质量/能力/推荐评价」。

配套 **AI 话题热榜**：对近 60 天站内动态（标题/摘要/标签）与模型能力/模态做关键词统计（Agent / 推理 / 多模态 / 开源权重 / 长上下文 / 价格战 / 安全 / 微调），点击话题跳转 `news.html?tag=...` 筛选对应动态；口径在页面上明示，非全网热度。

## 安全与隐私（v1.4，P0）

- **纯静态、无后端**：无账号、无分析/埋点、无 cookie、无第三方脚本/字体/CDN/iframe；浏览器不会向本站发送任何用户数据（本站没有服务器）。
- **XSS 防护**：所有外部数据（RSS / 榜单 / 技能提交 / Hacker News）渲染前统一 `esc()`/`textContent` 转义；数据外链仅允许 `http(s):`（`safeHttpUrl` 白名单）；页面注入 **CSP**（`default-src 'self'`、`object-src 'none'`、`base-uri 'none'`、`form-action 'none'`）与 `referrer: no-referrer`。
- **BYOK 密钥安全**：密钥仅保存在浏览器 `localStorage`，可随时清除；不打印日志、不注入 prompt 上下文；仅允许 https 端点（`http://127.0.0.1`/`localhost` 例外，兼容本机 Ollama）；`?ask=` 深链只预填、不自动发送，避免被诱导消耗你的额度。
- **供应链**：运行时零第三方依赖；GitHub Actions 全部固定 commit SHA、最小权限、禁止 `pull_request_target`；启用 **CodeQL** 与 **Dependabot**；CI 运行 `security-check.mjs --strict`（PII/密钥/危险 API/外链/CSP/Actions pin/data 体积）。
- **隐私处置**：v1.4 重建了公开提交历史，移除早期文档中的本机路径/用户名痕迹；详细威胁模型、发现与残余风险见 [SECURITY.md](SECURITY.md) 与 [安全审计报告](docs/SECURITY-AUDIT.md)（Critical 0，High/Medium 全部修复）。

## 分发（Distribution）

分享卡/榜单图都会带上 **站点地址 + GitHub 仓库 + 二维码**，让看到图的人能直接找到项目；完整方法（卡片解剖、社交文案、渠道清单、每周节奏、SEO/OG 检查、UTM、可信话术）见 [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md)。

## 部署到你自己的 GitHub Pages

1. Fork 本仓库；
2. Settings → Pages → Source 选择 **GitHub Actions**；
3. 在 Actions 里运行一次 `Deploy to GitHub Pages`（或 push 到 `main`）；
4. 访问 `https://<your-name>.github.io/llm-pulse/`。

仓库无任何第三方 npm 运行时依赖，Actions 只需 Node 20。

## 开发与测试

```bash
node --test                          # 单测：数据归一化 / 助手核心 / Feed
node scripts/validate.mjs            # 数据合约校验
node scripts/validate.mjs --strict   # 发布前：站点/Feed 完整性
node scripts/check-i18n.mjs --strict  # 中英词典 100% 对齐校验
node scripts/check-comments.mjs       # 代码注释英文检查
node skills/one-sentence-project/scripts/check-project.mjs --self  # Skill 自检
```

数据合约、设计规范、验收标准见 [`docs/SPEC.md`](docs/SPEC.md)、[`docs/DATA-CONTRACT.md`](docs/DATA-CONTRACT.md)、[`docs/V1.2-CONTRACT.md`](docs/V1.2-CONTRACT.md)、[`docs/UI-SPEC.md`](docs/UI-SPEC.md)。分发与技能： [`DISTRIBUTION.md`](docs/DISTRIBUTION.md)、[`SKILLS.md`](docs/SKILLS.md)。贡献指南见 [`CONTRIBUTING.md`](CONTRIBUTING.md)（English）。

## Skill：一句话交付项目

> **一句话需求 → 可上线项目**。本项目的完整方法论（标准/目标/契约 → POC 门禁 → MVP → GitHub Pages 发布 → 证据化验收）已沉淀为可复用 Agent Skill，开源在 [`skills/one-sentence-project/`](skills/one-sentence-project/SKILL.md)，并附可执行的脚手架与校验器。

**价值**

- 把「持续追踪某领域公开信息并发布公网站点」的一句话，变成**可实际运行的项目骨架**，而不是一份设计文档；
- 可执行护栏：`scaffold.mjs` 一条命令生成 26 文件骨架（需求/合约/验收模板、数据占位、CI/Pages workflow、5 主题 token、预览与校验脚本），`check-project.mjs --self / --skeleton` 可自检并接入 CI；
- 沉淀真实踩坑经验：**数据合约先行、POC 门禁、双模式数据源 + 快照降级（应对受限网络）、纯静态优先、BYOK 助手 + 离线降级、Actions 定时刷新 + Pages、证据化验收（CDP/截图/单测/合约校验）**；
- 可迁移到任意「持续追踪公开信息」领域：大模型、开源生态、论文、政策、竞品、发布动态。

**边界（如实说明）**

- 不是通用 Web 框架：**无后端 / 账号 / 数据库 / SSR / 支付**；不是实时系统，新鲜度取决于定时刷新（按日级）；
- 依赖 Node.js 20+、GitHub 仓库与**公开且合规**的数据源；不绕过访问控制、不抓取付费全文；
- AI 助手为 BYOK，需要用户自备 key 且 endpoint 允许浏览器 CORS；离线模式能力有限；
- 审美与内容仍需人工复核；多智能体分工是**可选增强**，单 Agent 也可循同一流程；
- 脚手架只是起点：真实质量门（数据真实性、视觉、验收）必须由真实工作通过，Skill 不替代判断。

```bash
# 自检 Skill 包
node skills/one-sentence-project/scripts/check-project.mjs --self

# 一句话生成项目骨架
node skills/one-sentence-project/scripts/scaffold.mjs my-tracker \
  --name my-tracker --domain "open-source ecosystem tracking"
node skills/one-sentence-project/scripts/check-project.mjs --skeleton my-tracker
```

一句话示例：「帮我做一个持续追踪大模型发布/榜单、带 AI 助手、每日自动更新并发布到 GitHub Pages 的公域轻奢网站」。
完整触发说明、输入契约、7 阶段流程与 12 条质量门见 [`SKILL.md`](skills/one-sentence-project/SKILL.md)，更多领域示例见 [`examples/prompts.md`](skills/one-sentence-project/examples/prompts.md)。

## Roadmap

- [ ] 更多国内模型榜单接入（SuperCLUE / C-Eval，本机网络受限，走 CI）
- [ ] 模型价格/上下文历史曲线（基于每日快照 diff，仪表盘展示真实趋势）
- [ ] AI 助手支持多轮上下文持久化与「对比模型」快捷指令
- [ ] 每周自动生成「AI 周报」Issue + 分发素材（GitHub Actions）
- [ ] 英文模式数据侧翻译（新闻摘要/资源/项目描述的 `*En` 字段）
- [ ] 技能库支持“我的技能”本地导入（JSON 上传预览后走 PR）与更多官方/社区源
- [ ] PWA / 离线缓存

## 数据来源与免责声明

- 数据来自各公开 API、公开榜单与官方博客，版权归原站点所有；本项目仅做聚合展示并附来源链接，可联系移除；
- 排行榜分数为第三方口径，**不代表本项目评价**；榜单可能滞后，请以来源页为准；
- AI 助手回答由你配置的模型生成，可能存在错误，不构成任何专业建议；
- 学习资源与项目为人工精选，欢迎 PR 补充（见 `CONTRIBUTING` 待补）。

## 致谢

感谢 OpenRouter、Artificial Analysis、LiveBench、Epoch AI、OpenCompass、LMArena、Hugging Face、GitHub 等开放数据；感谢开源社区。本项目设计受高端杂志排版与线性美学启发。

## License

[MIT](LICENSE) © 2026 chengxi-Z
