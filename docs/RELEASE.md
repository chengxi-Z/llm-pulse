# 发布说明（RELEASE NOTES）

## v1.4.0 — 2026-11-04

**安全加固（P0）+ 榜单/对比/斩杀线 2.0/真实热榜/轮播/引导页瘦身**

- 仓库：<https://github.com/chengxi-Z/llm-pulse> ｜ 线上：<https://chengxi-z.github.io/llm-pulse/>
- 验收：[ACCEPTANCE.md](ACCEPTANCE.md) v1.4 章节 ｜ 契约：[V1.4-CONTRACT.md](V1.4-CONTRACT.md) ｜ 安全：[SECURITY.md](../SECURITY.md) · [SECURITY-AUDIT.md](SECURITY-AUDIT.md)

### Security & privacy (最高优先级)

- **独立安全审计**：Critical 0；High 5/5、Medium 6/6 全部修复；PII/密钥扫描 0 真实命中。
- **CSP + referrer** 注入全部 9 页；外部数据 100% 转义；`safeHttpUrl` scheme 白名单；外链 rel 全覆盖。
- **BYOK**：密钥仅 localStorage、无日志；`?ask=` 深链只预填不自发请求；端点 https-only（回环 http 例外）。
- **供应链**：Actions 全部 pin commit SHA、最小权限；CodeQL + Dependabot；CI 执行 `security-check --strict`。
- **隐私**：重建公开提交历史移除早期本机路径/用户名痕迹；残余风险记录在 SECURITY-AUDIT §5.1。

### Features

| 模块 | 内容 |
|---|---|
| 榜单 | 每榜 Top10（可展开全部）+ 1/2/3 名内敛徽章；极简分发 strip（站点 + GitHub + QR ≤12% 高） |
| 模型对比 | 任意勾选 2–6 模型 → 真实评分对比（AA/LMArena/LiveBench/Epoch/OpenCompass + 价格/上下文/模态/许可；未匹配 —） |
| 斩杀线 2.0 | 能力×成本散点（AA 指数 × 输出价 log）+ 能力/成本双 P50 线 + 四象限（高能低价=生存区）+ 样本数/免责 |
| 真实热榜 | Hacker News 近 7 天 AI 讨论 Top10（标题 + 讨论摘要 + points/comments/domain + 外链），非关键词统计 |
| 图表轮播 | 柱状/饼图/斩杀线 3 视图自动 6.5s 轮播，柔和滑动、悬停暂停、移动滑动、reduced-motion 关闭自动 |
| 引导页瘦身 | 9 页 compact hero；index hero 413px；首内容 index 621 / rankings 572 / about 388（≤620） |
| 数据 | 新增 `data/topics.json`（HN 热榜，双模式/快照降级）；http→https 链接升级；fetch 5MB 上限/实体解码防护 |

### Verification

- `node --test` **94/94**；`validate --strict` **0/0**；`check-i18n --strict` **0 error / 819 used**；`check-comments` **0 hit**
- `node scripts/security-check.mjs --strict` **0 error / 0 warning**；self-test 9/9
- 布局审计 56/56 场景 0 问题；CDP 8 页 zh/en 无 console error；linkedom harness 79/79
- CSS：index 118.7KB/23.8 gzip、skills 111.6/22.5、models 112.2/22.6、一般页 105.3/20.7

## v1.3.0 — 2026-11-04

**图表重设计与 UI 对齐返工**：柱状图/环形饼图、**AI 模型斩杀线**、**AI 话题热榜**，以及 7 宽度 × 8 页自动布局审计 0 错位。

- 仓库：<https://github.com/chengxi-Z/llm-pulse> ｜ 线上：<https://chengxi-z.github.io/llm-pulse/>
- 验收：[ACCEPTANCE.md](ACCEPTANCE.md) v1.3 章节 ｜ 契约：[V1.3-CONTRACT.md](V1.3-CONTRACT.md)

### 新增 / 变更

| 模块 | 内容 |
|---|---|
| 柱状图 | 近 12 周发布（12 柱、y 轴顶=最大值/底=0、3 网格、周均虚线、tooltip、入场动画、390 隔一标签） |
| 环形饼图 | 输出价格 5 档 donut（中心 451/444、图例含数量/占比、hover 联动） |
| AI 模型斩杀线 | P50 输出价 $2.00/1M 为界（动态计算）；log 轴 + 444 模型竖条分布 + 生存/斩杀分区 + 232≤(52.3%)/212> + 规则与免责；标签/轴刻度不重叠 |
| AI 话题热榜 | 8 主题近 60 天真实统计（动态 + 模型标签），Top 8 热度条，点击跳 `news.html?tag=` |
| news 深链 | `?tag=` 初始筛选 + 「来自话题热榜」提示条 + 清除 |
| UI 对齐 | 技能卡/项目 Skills footer 对齐（0 错位）、KPI 基线、图表卡等高等头、390 移动端；CSS 拆分为 dashboard.css/skills.css 按页加载 |
| 审计工具 | Lead 自研 CDP 布局审计（7 宽度 × 8 页 = 56 场景）：0 溢出 / 0 错位 / 0 遮挡 |

### 验证（可复现）

```bash
node --test                          # 72 tests
node scripts/validate.mjs --strict   # data contract
node scripts/check-i18n.mjs --strict # 783 used keys
node scripts/check-comments.mjs --strict
```

> 布局审计（需本机 Edge + CDP）：`node _tmp/layout-audit.mjs`（Lead 侧工具，报告见 `docs/screenshots/audit/audit-report.json`，56/56 场景 0 issues）。

### 发布记录

- Commit：`5da6f80`（203 files）
- CI：success — <https://github.com/chengxi-Z/llm-pulse/actions/runs/41671875013>
- Deploy to GitHub Pages：success — <https://github.com/chengxi-Z/llm-pulse/actions/runs/41671874884>
- 线上验证（Lead）：首页含 `dash-killline` / `dash-price-pie` / `dash-hot-topics` / `dashboard.css`；`dashboard.css`（12.3KB）、`skills.css`、`dashboard.js`（27.2KB）、`zh.json`（796 keys）、`data/skills.json`、`feed.xml` 全部 200；news/skills 页 200。
- 截图：`v13-*.jpg`（9 张）、`docs/screenshots/audit/audit-report.json`。

---

## v1.2.0 — 2026-11-03

**分发 · 技能 · 可视化版本**：分享可溯源、可上传共享的「我的技能」库、首页概览仪表盘。

- 仓库：<https://github.com/chengxi-Z/llm-pulse>
- 线上：<https://chengxi-z.github.io/llm-pulse/>
- 验收：[ACCEPTANCE.md](ACCEPTANCE.md) v1.2 章节 ｜ 契约：[V1.2-CONTRACT.md](V1.2-CONTRACT.md) ｜ 分发：[DISTRIBUTION.md](DISTRIBUTION.md) ｜ 技能：[SKILLS.md](SKILLS.md)

### 新增

| 模块 | 内容 |
|---|---|
| 分发 | 分享卡 v2（logo + 站点/GitHub 地址 + 二维码，news/board/skill/site 四类）；榜单「分享本榜」专属卡；菜单 11 项（复制站点/GitHub/RSS/本榜链接等）；页脚/订阅/about 地址入口；18.6KB 分发 playbook |
| 我的技能 | 新页面 `skills.html`（nav 第 8 项）：11 条真实 Agent Skills（1 自研 + 5 官方 + 5 社区）；来源/分类筛选 + 搜索；使用引导 modal（安装/触发/自检/文件结构/复制）；技能分享卡；提交三路径（GitHub Issue Form / JSON 模板 / PR） |
| 项目 Skills | projects 页「值得关注的 Skills / Agent Playbooks」区块（6 条官方/社区技能） |
| 首页仪表盘 | 6 KPI（count-up，真实计算）、近 12 周发布趋势 SVG、厂商 Top 8、输出价格分层；纯 SVG/CSS/JS、5 主题、reduced-motion、tooltip |
| 数据 | `data/skills.json`（schema v1，11 条，stars/updatedAt 来自 GitHub API）；`scripts/validate.mjs` 支持 skills 校验 |
| i18n | 新增 192 keys（总计 763，zh/en 对齐）；新增页面/组件全量中英 |
| 文档 | V1.2-CONTRACT、DISTRIBUTION、SKILLS、DATA-CONTRACT §6.1、UI-SPEC v1.2、README/README.en/CONTRIBUTING 更新 |

### 验证（可复现）

```bash
node --test                            # 72 tests
node scripts/validate.mjs --strict     # data contract (incl. skills)
node scripts/check-i18n.mjs --strict   # 763 keys
node scripts/check-comments.mjs --strict
node skills/one-sentence-project/scripts/check-project.mjs --self
```

### 发布记录

- Commit：`4c4fed0`（190 files）
- CI：success — <https://github.com/chengxi-Z/llm-pulse/actions/runs/41664434169>
- Deploy to GitHub Pages：success — <https://github.com/chengxi-Z/llm-pulse/actions/runs/41664434335>
- 线上验证（Lead）：`/skills.html` 200、`/data/skills.json` 200（11 条：1 mine + 5 official + 5 community）、首页含 `#overview-dashboard`、二维码/feed/404 均 200；`data/meta.json` 为 `mode=ci`（18/19 源，10 榜）。
- 截图：`v12-*.jpg`、`share-card-v2-*.png`、`share-menu-v12.png`。

---

## v1.1.1 — 2026-11-03

**Skill 独立安装自检修复**：`check-project.mjs` 在仓库外安装（如 `~/.dsh/skills/`）时跳过仓库级 README 检查，不再误报；仓库内仍 16/16、独立安装 12 passed/0 failed/4 skipped。

---

## v1.1.0 — 2026-11-03

**主题与双语版本**：多主题 UI、中英双语、工程英文化，并开源「一句话交付项目」Skill。

- 仓库：<https://github.com/chengxi-Z/llm-pulse>
- 线上：<https://chengxi-z.github.io/llm-pulse/>（中文默认，可切全英文）
- 验收：[ACCEPTANCE.md](ACCEPTANCE.md) v1.1 章节 ｜ 契约：[V1.1-CONTRACT.md](V1.1-CONTRACT.md) ｜ UI：[UI-SPEC.md](UI-SPEC.md) ｜ 英文规范：[EN-STYLE.md](EN-STYLE.md)

### 新增

| 模块 | 内容 |
|---|---|
| 多主题 | 5 套主题（纸墨雅金/深夜鎏金/青瓷墨绿/暮云玫瑰/极简石墨）+ 跟随系统；`?theme=` 深链 + 持久化；回顶按钮；滚动条美化；按钮 4 态去纯黑 |
| 中英双语 | 中文默认 / 全英文切换；577 keys 100% 对齐；`?lang=en` 深链；日期数字 Intl；助手/分享/分享卡全英文；`check-i18n --strict` 纳入 CI |
| 工程英文化 | 英文 `CONTRIBUTING.md` / `README.en.md`；326 条代码注释英文化，`check-comments --strict` 纳入 CI |
| Skill | [`skills/one-sentence-project/`](../skills/one-sentence-project/SKILL.md)：一句话需求→可上线项目；可执行 scaffold/check；CI 自检 |
| CI | 新增 i18n 词典检查、英文注释检查、Skill 自检与 scaffold 冒烟 |

### 验证（可复现）

```bash
node --test                          # 76 tests
node scripts/validate.mjs --strict   # data contract
node scripts/check-i18n.mjs --strict # i18n
node scripts/check-comments.mjs --strict
node skills/one-sentence-project/scripts/check-project.mjs --self
```

### 发布记录

- Commit：`a8a09ed`（151 files）
- CI：success — <https://github.com/chengxi-Z/llm-pulse/actions/runs/41643646853>
- Deploy to GitHub Pages：success — <https://github.com/chengxi-Z/llm-pulse/actions/runs/41643646831>
- 线上验证（Lead，headless）：站点为 v1.1 产物（theme-picker / lang-toggle / 回顶、`assets/js/i18n.js`、zh/en 词典、feed 89 items 均 200）；`?lang=en` 英文导航/标题正常；`?theme=jade` 生效；console errors 0；`data/meta.json` 为 `mode=ci`（18/19 数据源，10 榜单）。
- 截图：`docs/screenshots/live-home-en.jpg`、`live-home-jade.jpg`。

---

## v1.0.0 — 2026-11-03

**首个公开版本**：公域、轻量、轻奢的大模型观察站。

- 仓库：<https://github.com/chengxi-Z/llm-pulse>
- 线上：<https://chengxi-z.github.io/llm-pulse/>
- License：MIT
- 数据快照：`mode=ci` 运行时 18/19 数据源可用（Hugging Face 官方、LMArena 在 GitHub Actions 侧打通）
- 验收：POC / MVP / Release 三阶段全部通过，详见 [ACCEPTANCE.md](ACCEPTANCE.md)

### 包含内容

| 模块 | 内容 |
|---|---|
| 站点 | 7 页 + 404：首页、动态、排行（9-10 榜）、模型库（451 模型）、学习资源（22）、项目（12 社区 + 1 自研）、关于 |
| 数据管道 | Node ESM：fetch → normalize → validate → feed；本地/CI 双模式；19 个数据源；单源失败降级 |
| AI 助手 | BYOK（OpenAI 兼容 / DeepSeek / OpenRouter / 硅基流动 / Ollama）+ 流式 + 离线检索降级 + 本周简报 + 深链接 |
| 推送/分享 | RSS 2.0 + JSON Feed 1.1、Canvas 品牌分享卡、Web Share/社交意图、可选飞书/Telegram/ServerChan webhook |
| 自动化 | GitHub Actions：每日 09:17 刷新+部署、每周快照回写、push CI（60 单测 + 合约校验） |
| 文档 | README、SPEC、DATA-CONTRACT、POC-REPORT、AI-SHARE、ACCEPTANCE、RELEASE |

### 验证方式（可复现）

```bash
git clone https://github.com/chengxi-Z/llm-pulse && cd llm-pulse
node scripts/serve.mjs                 # 本地 http://127.0.0.1:4173/
node --test                            # 60 个单测
node scripts/validate.mjs --strict     # 数据合约 + 站点完整性
```

### 已知限制

见 [ACCEPTANCE.md](ACCEPTANCE.md) §4。核心限制：BYOK 需要 endpoint 支持 CORS；SuperCLUE 源在 CI 仍不可达；Feed 仅覆盖动态；无后端/账号。

### Roadmap

- [ ] 价格变动历史曲线（基于每日快照 diff）
- [ ] 每周自动生成「AI 周报」GitHub Issue
- [ ] 英文版 i18n、PWA 离线缓存
- [ ] 助手多轮持久化（可选本地存储）
- [ ] 更多国内榜单（C-Eval、智源 FlagEval 等）
