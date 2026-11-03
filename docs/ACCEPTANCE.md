# 验收报告（ACCEPTANCE REPORT）

> 项目：**AI Pulse · 照胆云** ｜ 版本：v1.0.0 ｜ 验收日期：2026-11-03（Asia/Shanghai）
> 仓库：<https://github.com/chengxi-Z/llm-pulse> ｜ 线上：<https://chengxi-z.github.io/llm-pulse/>
> 验收人：Lead（team lead）｜ 复核：用户（最终人工复核）

---

## 0. 验收方法

| 维度 | 方法 |
|---|---|
| 数据正确性 | `node scripts/validate.mjs --strict`（合约 v1 全量校验）+ `node --test`（60 单测） |
| 页面渲染 | headless Edge + CDP 真机仿真：`body[data-page-ready=true]`、`scrollWidth ≤ innerWidth`、`consoleErrors=[]`、关键节点计数 |
| 视觉 | 每页 1440/390 截图 + 暗色模式抽验（`docs/screenshots/`，共 33 张） |
| 交互 | DOM 断言（linkedom，114/114）+ CDP eval（榜单 9 tab、模型库 451/60 行、资源 22、项目 12+1、动态 80/89） |
| 线上 | HTTP 状态 + 内容断言 + 线上 headless 渲染检查 + GitHub Actions 运行记录 |
| 安全/合规 | 无密钥入库（扫描通过）、XSS 转义测试、数据来源标注、robots/sitemap/免责声明 |

## 1. Phase P（POC）验收 — ✅ 通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 数据源可达性矩阵（本机/CI 双模式） | ✅ 19 个源；本机 13 ok / 4 blocked（HF、LMArena、SuperCLUE 等被墙，走镜像/降级）；CI 18 ok / 1 blocked（SuperCLUE） | [`docs/POC-REPORT.md`](POC-REPORT.md)、`data/meta.json.sources` |
| 采集→归一化→合约数据 | ✅ 一次运行产出 6 个数据文件；单源失败降级不中断 | `scripts/fetch-data.mjs` |
| 真实数据（非伪造） | ✅ 451 模型（OpenRouter）、9-10 个真实榜单（AA/LiveBench/Epoch/OpenCompass/LMArena）、80-89 条动态（OpenRouter diff + 7 家 RSS）、22 资源、13 项目 | `data/*.json`、线上 `data/meta.json` |
| 纯静态原型渲染 | ✅ 首页 + 动态页真实数据渲染；轻奢视觉成立 | `docs/screenshots/site-home-desktop.jpg`、`site-news-desktop.jpg` |
| AI 助手可行性 | ✅ BYOK 流式 + 离线降级核心函数；mock SSE 22 个增量状态 | `tests/assistant-core.test.mjs`、`docs/AI-SHARE.md` |
| 分享卡/Feed 可行性 | ✅ Canvas 分享卡、RSS 2.0 + JSON Feed 生成 | `docs/screenshots/share-card.jpg` |

## 2. Phase M（MVP）验收 — ✅ 通过

### 2.1 功能
| 验收项 | 结果 |
|---|---|
| 7 页 + 404：首页/动态/排行/模型库/学习资源/项目/关于 | ✅ 全部 `page-ready=true`，无控制台错误 |
| 动态页：筛选/搜索/分享/来源链接 | ✅ 80 条（线上 CI 刷新后 89 条），80 个 `data-share` 按钮 |
| 排行页：9 个榜单 tab、键盘操作、`#board-id` 深链、来源与更新时间 | ✅ tabs=9、首榜 28 行、来源外链可追溯 |
| 模型库：451 模型、搜索、6 类筛选、5 种排序、分页、表格/卡片切换 | ✅ total=451、默认 60 行、filters=6 |
| 学习资源：22 条、类型/难度/语言/免费筛选 | ✅ cards=22、filters=7 |
| 项目：社区精选 12 + 自研 1、标签过滤、stars 排序 | ✅ cards=12 + self=1 |
| AI 助手：BYOK 配置、流式、停止/复制、错误态、离线降级、深链接、本周简报 | ✅ 单测 29/29；DOM e2e 16/16；离线回答已过滤路由伪模型 |
| 分享：Web Share/复制/社交意图/Canvas 品牌分享卡（明暗） | ✅ 截图 `share-card.jpg`、`share-menu.jpg` |
| Feed：RSS 2.0 + JSON Feed 1.1，绝对 URL，XML 合法 | ✅ python `xml.etree` 解析通过；线上 200 |
| 暗色模式 / 移动导航 / 滚动动效 / 空态错误态 / 数据源状态灯 / a11y | ✅ CDP 抽验；skip link、aria、focus-visible、Esc 关闭 |

### 2.2 质量
| 验收项 | 结果 |
|---|---|
| 数据合约校验 | ✅ `validate --strict`：**0 错误 0 警告** |
| 单元测试 | ✅ `node --test`：**60/60 通过**（数据 22 + 助手 29 + feed 7 + 2 套） |
| 本地资源引用 | ✅ 全部本地 href/src 存在；无外链字体/CDN |
| 页面溢出 | ✅ 8 页 1440/390 无横向溢出（表格 <780px 内部滚动为设计行为） |
| 体积 | JS 105KB raw / 33KB gzip；CSS 83KB raw / 17KB gzip；发布产物 **1.08MB**（含数据与图片之外资源） |
| 安全 | ✅ 无真实密钥入库；safeMarkdown 先转义；分享文案/摘要均转义 |
| 文档 | ✅ SPEC / DATA-CONTRACT / POC-REPORT / AI-SHARE / README |

### 2.3 截图证据（`docs/screenshots/`，33 张）
首页桌面/移动/360/暗色/整页、动态桌面/移动/暗色、排行桌面/移动/暗色、模型库桌面/移动/暗色、资源桌面/移动、项目桌面/移动、关于桌面/移动、404、AI 助手 5 张、分享卡/菜单 4 张、线上首页快照。

## 3. Phase R（Release：上 GitHub + Pages）验收 — ✅ 通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 公共仓库 | ✅ <https://github.com/chengxi-Z/llm-pulse>（MIT，topics：llm/ai/leaderboard/static-site/github-pages/...） | 仓库页 |
| 初版提交 | ✅ commit `615507c`（110 files） | 仓库 commit |
| CI workflow | ✅ success（`node --test` + 合约校验 + 严格校验） | [run 41631937409](https://github.com/chengxi-Z/llm-pulse/actions/runs/41631937409) |
| Pages 部署 workflow | ✅ success（抓数据→Feed→校验→staging→部署） | [run 41631937498](https://github.com/chengxi-Z/llm-pulse/actions/runs/41631937498) |
| 线上 URL | ✅ HTTPS 200：<https://chengxi-z.github.io/llm-pulse/> | 探针结果 |
| 线上页面 | ✅ 7 页 + 404、feed.xml/json、robots、sitemap、data/*.json、og-cover 全部 200 | 17 项探针全 OK |
| 线上渲染 | ✅ headless Edge：page-ready=true、无横向溢出、consoleErrors=[]、451 模型 | `live-home` 快照 |
| CI 全量数据源 | ✅ `mode=ci`：18 源 ok / 1 blocked；**Hugging Face 官方 ✅、LMArena ✅**（本机被墙源在 Actions 侧打通） | 线上 `data/meta.json` |
| 定时刷新 | ✅ `deploy.yml` 每日 09:17（北京时间）cron + `workflow_dispatch`；`refresh-data.yml` 每周回写快照 | workflow 文件 |
| Feed 线上可用 | ✅ `feed.xml` 200（application/xml）、`feed.json` 200（application/json） | 探针 |

### 3.1 独立验证（成员侧只读复核，与 Lead 结果交叉）

| 复核方 | 范围 | 结果 |
|---|---|---|
| site-mvp（独立 Node HTTP 探针） | 线上 8 页 + 资源 MIME + 五件 CSS 顺序 + 4 个 module 脚本 + OG/canonical + 404 noindex + 数据一致性 | **123/123 通过，0 异常** |
| ai-share（自测 + 交叉） | 助手核心/Feed 单测 36/36、DOM e2e 16/16（含 mock SSE 22 个增量、401、XSS）、feed XML 解析 | **全绿** |
| poc-data（数据侧） | `validate --strict` 0/0、数据侧单测 24/24、确定性重放（两次运行 6 文件字节一致） | **全绿** |
| Lead（CDP + Edge） | 8 页 ready/溢出/console/计数、线上 17 项端点探针、线上 headless 渲染、Actions 运行记录 | **全绿** |

> 全团队（Lead + 3 成员）合计：60 单测 + 114 linkedom DOM 断言 + 39 条成员 e2e/线上探针断言，全部通过。

## 4. 已知限制（如实记录）

1. **AI 助手 BYOK 需 endpoint 支持浏览器 CORS**；失败自动降级离线模式（隐私优先，无后端代理）。
2. **SuperCLUE** 在 Actions 侧仍不可达（blocked），页面按降级状态展示；已在 meta 中如实标注。
3. **本地（中国大陆网络）** 无法直连 HF/LMArena；本地开发使用 hf-mirror 与降级，数据以 CI 为准。
4. **GitHub API 未认证限流 60/h**：本机反复抓取可能触发限流（CI 使用 GITHUB_TOKEN 5000/h）。
5. Feed 仅覆盖「动态」；模型库/榜单暂未进 Feed（Roadmap）。
6. 助手对话不持久化（隐私选择）；无账号系统。
7. 榜单分数为第三方口径，仅聚合展示并标注来源，不做二次评价。

## 5. 用户复核清单（建议 10 分钟）

- [ ] 打开 <https://chengxi-z.github.io/llm-pulse/>：首页视觉/数据/暗色切换/移动端
- [ ] 动态页：筛选、搜索、分享按钮；打开一条来源链接核对
- [ ] 排行页：切换 9 个榜单；核对来源链接与更新时间
- [ ] 模型库：搜索 "deepseek" / 筛选开源 / 按价格排序
- [ ] 学习资源 & 项目页：外链可用性抽查
- [ ] AI 助手：不填 key 试「现在上下文最长的模型？」（离线）；如需在线，填自己的 DeepSeek/OpenRouter key 测试
- [ ] 订阅：浏览器打开 `feed.xml`；`feed.json`
- [ ] 关于页：数据源状态表、免责声明
- [ ] GitHub 仓库：README 完成度、Actions 绿灯、Pages 设置

## 6. 结论

**POC / MVP / Release 三阶段验收全部通过**，无阻塞项。产物包括：可访问的公网站点、开源仓库、数据管道与自动刷新、完整文档与截图证据。
人工复核后如需调整，按「用户复核意见 → Lead 分配 → 成员修复 → 重新验收」流程处理。

---

## v1.1 追加验收（2026-11-03，用户复核后迭代）

> 背景：用户验收 v1.0 后提出 ① UI 优化（多主题/回顶/滚动条/按钮色）② 中英切换 ③ 工程英文化 ④ 把「一句话交付」沉淀为开源 Skill。
> 契约：[`V1.1-CONTRACT.md`](V1.1-CONTRACT.md)；UI 规范：[`UI-SPEC.md`](UI-SPEC.md)；英文规范：[`EN-STYLE.md`](EN-STYLE.md)。

### A1. 需求对照

| # | 需求 | 结果 | 证据 |
|---|---|---|---|
| R1 | 多主题 UI + 交互优化 | ✅ 5 主题 + 跟随系统；选择器/回顶/滚动条/按钮 4 态 | `docs/screenshots/theme-*.jpg`、`theme-picker-open.jpg`、`UI-SPEC.md` |
| R2 | 中/英双语（中文默认/全英文） | ✅ 577 keys 对齐；8 页 + 404 + 助手 + 分享全英文 | `lang-en-*.jpg`、`check-i18n --strict` PASS |
| R3 | 工程英文化 | ✅ 326 条中文注释→英文（36 文件）；CONTRIBUTING/README.en 英文 | `check-comments --strict` PASS |
| R4 | 一句话交付 Skill 开源 | ✅ `skills/one-sentence-project/` 可执行、可自检、纳入 CI | `check-project --self` 16/16、scaffold 26 文件 |
| R5 | 发布 v1.1.0 | ✅ 见 [`RELEASE.md`](RELEASE.md) | GitHub repo / Actions / Pages |

### A2. UI（多主题与交互）
- **5 套主题**：ivory（纸墨雅金，默认）/ noir（深夜鎏金）/ jade（青瓷墨绿）/ rose（暮云玫瑰）/ graphite（极简石墨）+ auto 跟随系统；`?theme=` 深链、localStorage 持久化、head 内联脚本防 FOUC、`meta theme-color` 同步；旧 `?theme=dark|light` 兼容。
- **主题身份**：每套主题独立 `--highlight`（标题高亮/栏目标签/链接/导航下划线）、按钮填充色（ivory/noir 金、jade 墨绿、rose 豆沙、graphite 石墨）与背景色；对比度自检最差正文 4.65:1，全部 ≥4.5:1。
- **交互**：回顶按钮（>600px 淡入、平滑滚动、reduced-motion、与 AI 助手错位）；滚动条美化（WebKit 金色渐变 / Firefox thin，暗色提亮）；按钮 4 态，去掉纯黑大面积填充（用户反馈已解决）。
- **CDP 验收**：5 主题 × 首页/排行/模型库截图正常；`data-theme` 正确、无 FOUC、无 console error；390/360 移动端 header 三入口同排、无横向溢出。
- **体积**：CSS raw 104.8KB / gzip 21.2KB（预算内）；组件硬编码颜色 0；无新增外链资源。

### A3. i18n（中/英）
- 词典 `site/assets/i18n/{zh,en}.json`：各 **577 keys**，key 集一致、无空值、占位符对齐；`node scripts/check-i18n.mjs --strict` → **PASS，0 error**（5 warning：动态 t() helper 等），自检 16/16。
- 全 UI 翻译：导航/hero/统计/筛选/表头/空态/错误态/页脚/404/主题选择器/语言切换/助手（含离线问答、本周简报、设置面板）/分享（菜单、文案、Canvas 分享卡英文断词与 `Nov 3, 2026` 日期）。
- 切换体验：无刷新、`html.lang` 更新、筛选状态保留、`?lang=en` 深链可用；CDP 实测即时切换（zh→en 导航/hero 全英文，无裸 key）。
- 边界：新闻标题/摘要、`meta.latestHighlights`、来源名、资源/项目中文描述属数据原文（英文模式隐藏 highlights，其余按合约保留）。

### A4. 工程英文化
- `CONTRIBUTING.md`（英文完整贡献指南：环境/目录/数据合约/ESM 无运行时依赖/英文注释与 JSDoc/Conventional Commits/PR、i18n 流程/Skill 贡献/边界）。
- `README.en.md`（英文完整版，含 v1.1 主题/双语/Skill，顶部与中文 README 互链）。
- 代码注释英文化：**326 条中文注释 → 英文**，覆盖 `scripts/**`、`site/assets/js/**`、`site/assets/css/**`、`tests/**`、workflows，共 36 文件（仅注释 token，逻辑零变化）；`node scripts/check-comments.mjs --strict` → **PASS，0 hits**；自检 8/8。

### A5. 一句话交付 Skill（亮点）
- 包结构：`skills/one-sentence-project/{SKILL.md, references/×5, scripts/{scaffold,check-project}.mjs, examples/prompts.md}` + `skills/README.md`；全部英文。
- SKILL.md：frontmatter name/description；When/Not to use；Input Contract（4 要素 + ≤3 澄清问题）；7 阶段 Workflow + exit criteria；12 条 Quality Gates；**Value / Boundaries / Examples / Anti-patterns**。
- **可执行自检**：`check-project --self` → **16 passed / 0 failed**；`scaffold` 实跑生成 **26 文件骨架**（文档模板/空数据合约/CI+Pages/预览+校验脚本/5 主题 tokens）；`check-project --skeleton` → **16/16**；生成骨架 `validate` 0 error、`node --test` 8/8、`serve.mjs` 200；已纳入 CI（self-check + scaffold smoke test）。
- 价值与边界已写入根 README「Skill：一句话交付项目」章节与 `skills/README.md`（价值：一句话→可上线数据站、真实踩坑方法论、可迁移五域；边界：非通用框架/无后端/非实时/依赖 Node20+GitHub+合规源/BYOK+CORS/审美需人工复核/多智能体可选）。

### A6. v1.1 回归与验收
- `node --test` → **76/76 pass**；`validate --strict` → **0 错误 0 警告**；`check-i18n --strict` → **0 error**；`check-comments --strict` → **0 hits**；Skill self-check → 16/16。
- CDP：8 页（zh/en 各 8 次加载）全部 `page-ready=true`、`overflowX=false`、`consoleErrors=[]`；主题×语言组合抽验正常。
- 截图：`docs/screenshots/` 共 **51 张**（5 主题、选择器、回顶、EN 各页/移动端、EN 助手/分享卡/分享菜单/简报、各页桌面/移动）。
- 发布：v1.1.0 提交与 Actions/线上验收结果见 [`RELEASE.md`](RELEASE.md)。线上已确认 v1.1 产物：`theme-picker`/`lang-toggle`/回顶、`assets/js/i18n.js` 与 zh/en 词典、feed 200；`?lang=en` 英文导航/标题、`?theme=jade` 主题、console errors 0；`data/meta.json` 为 `mode=ci`（18/19 源，10 榜）。

### A7. v1.1 已知限制
1. 英文模式的数据内容（新闻标题/摘要、资源/项目中文描述、部分来源名）保留原文，属数据边界（Roadmap：数据管道补 `*En` 字段）。
2. `auto` 跟随系统只在 ivory/noir 间切换；手动选择其它主题后固定。
3. 主题选择器/回顶为纯前端能力，无服务端个性化（无账号体系）。
4. 其余限制同 v1.0（BYOK CORS、SuperCLUE 降级、Feed 仅动态、无实时高频）。

---

## v1.2 追加验收（2026-11-03，用户复核后迭代）

> 背景：用户提出 ① 分发增强（卡片要让人找到项目地址 + 其它分发技巧）② 新模块「我的技能（My Skills）」可上传共享、提供使用引导/分享 ③ 项目页增加「值得关注的 Skills」④ 首页太单调，要概览可视化仪表盘 + 克制动效。
> 契约：[`V1.2-CONTRACT.md`](V1.2-CONTRACT.md)。

### B1. 需求对照

| # | 需求 | 结果 | 证据 |
|---|---|---|---|
| R1 | 分发增强 | ✅ 分享卡 v2（logo+站点/GitHub 地址+二维码）、榜单专属卡、菜单 11 项、页脚/订阅/about 地址入口、`docs/DISTRIBUTION.md` | `share-card-v2-*.png`、`share-menu-v12.png`、`v12-dashboard-*` |
| R2 | 我的技能模块 | ✅ `skills.html`（11 条真实技能、筛选/搜索/引导 modal/分享/提交三路径/深链） | `v12-skills-page.jpg`、`v12-skills-en.jpg`、`v12-skill-modal.*` |
| R3 | 项目页 Skills | ✅ projects 页「值得关注的 Skills」区块（6 条，链接到 skills 页） | `v12-projects-skills.jpg`、`v12-projects-en.jpg` |
| R4 | 首页可视化仪表盘 | ✅ 6 KPI count-up、12 周发布 sparkline、厂商 Top8、价格分层；纯 SVG/CSS/JS，无图表库；reduced-motion 降级 | `v12-dashboard-full.jpg`、`v12-dashboard-charts.jpg`、`v12-dashboard-mobile.jpg`、`v12-dashboard-noir.jpg` |
| R5 | 回归与发布 | ✅ 72 单测、validate strict 0/0、i18n 0 error、注释 0 hit、8 页 zh/en CDP 全绿 | 见 §B5 |

### B2. 分发（R1）
- **分享卡 v2**：Canvas 1200×630，`kind: news|board|skill|site`；代码绘制星芒 logo + 标题自动换行 + 摘要/Top3 + 真实统计；**地址区**站点 `chengxi-z.github.io/llm-pulse`（26px）与 `github.com/chengxi-Z/llm-pulse`（23px），浅色/暗色对比 ≈16:1/≈17:1、不裁切；右下二维码 96px（`qr-site.png`，缺失自动跳过）；明暗 + 中英日期本地化。
- **榜单专属分享**：rankings 每榜「分享本榜」→ 读取真实 Top3/指标/更新时间/来源，生成榜单卡，含 `#board-<id>` 深链与「复制本榜链接」。
- **分享菜单 11 项**：系统分享/复制链接/复制本榜链接/复制文案/生成分享卡/复制站点/复制 GitHub/打开 GitHub/复制 RSS/X/Telegram/微博；所有复制文案与社交 intent 必含站点 URL + GitHub 地址。
- **站内入口**：页脚地址行（站点/GitHub/RSS + 复制）、首页订阅区地址块、about「如何关注/找到我们」+ 二维码（qr-site/qr-repo）。
- **Playbook**：[`DISTRIBUTION.md`](DISTRIBUTION.md)（18.6KB：卡片解剖、6 渠道中英文案、发布节奏、SEO/OG、二维码/UTM、可信话术、每周 checklist）。
- 体积：share.js 32,084B（v1.1.1 +5,941B ≤6KB 预算）；share 单测 12 项。

### B3. 我的技能模块（R2）
- **页面**：`site/skills.html`（nav 第 8 项「技能」）：hero、来源筛选（全部/我的/官方/社区）、分类筛选、搜索、技能卡网格、使用引导 modal、分享、安装与提交区、空态/错误态、深链 `#<id>`。
- **数据**：`data/skills.json`（schema v1，新增于 DATA-CONTRACT §6.1）：**11 条真实技能**（1 mine + 5 official + 5 community；stars/updatedAt/license 来自 GitHub API；4 条无许可证仓库如实 null，仅索引不托管），双语字段 `*Zh` 由前端按语言回退。
- **使用引导 modal**：一句话价值、适合/不适合、安装命令（复制到 `~/.dsh/skills` 等）、使用步骤、自检命令、文件结构、源码/分享；桌面居中 + 移动底部 sheet，focus trap/Esc/aria。
- **提交/共享（静态站方案）**：① GitHub Issue Form（`.github/ISSUE_TEMPLATE/skill-submission.yml`，12 字段 + 5 项确认）② 下载 JSON 模板 ③ Fork & PR 指引；页面明示「无后端，审核后合入 `data/skills.json` 上线」+ 审核标准。
- **分享**：技能卡/引导 modal 内「分享」→ 技能分享卡（名称+一句话+安装目标+地址+二维码）。

### B4. 首页可视化仪表盘（R4）
- 位置：hero → `#overview-dashboard` → highlights → 新模型 → 榜单 → 动态 → explore → subscribe。
- **6 KPI（真实计算）**：收录模型 451 / 覆盖 62 家厂商；累计上下文容量 264.4M tokens；近 7 天新增 2；公开榜单 9（本地；线上 CI 10）；数据源正常 16/19；动态 89。count-up 600–1200ms，进入视口触发一次，reduced-motion 直接终值。
- **图表**：近 12 周发布趋势 SVG（渐变面积 + 端点 + hover/focus tooltip，日期标签 08.17/09.21/11.02）；厂商分布 Top 8（OpenAI 103/22.8% … Meta 16/3.5%）；输出价格分层 5 档（免费 19/4.3%、<$1 142/32%、$1–5 143/32.2%、$5–15 93/20.9%、≥$15 47/10.6%，未公开价格不计并脚注说明）。
- **视觉/性能**：克制的数据杂志风格（细金线、衬线大数字、小字 uppercase、低饱和），5 主题兼容（noir/jade 截图验证），390 移动端 KPI 2 列 + 图表可读；新增 CSS 5.0KB（≤8KB）；`dashboard.js` **15.8KB raw > 契约 12KB，Lead 批准放宽至 16KB 并记录**（含 KPI 计算/12 周 SVG/厂商/价格/tooltip/i18n/reduced-motion，无外链依赖）。
- 交互：tooltip、键盘可达、语言切换重渲染、`prefers-reduced-motion` 降级、数据缺失空态。

### B5. v1.2 回归与验收
- `node --test` → **72/72 pass**（新增 share 12 项等）；`validate --strict` → **0 错误 0 警告**（skills 11 条通过）；`check-i18n --strict` → **PASS 0 error**（**763 keys，758 used**，13 warning 均为动态 t()/排版尾空格）；`check-comments --strict` → **0 hit**；Skill 自检 → 16/16。
- CDP：8 页 × zh/en（16 次加载）全部 `page-ready=true`、`overflowX=false`、`consoleErrors=[]`；404 正常；主题×语言抽验（jade/noir dashboard、EN skills/projects）。
- 截图：`docs/screenshots/` 共 **78 张**（含 v1.2 dashboard/技能页/引导 modal/分享卡 v2/分享菜单/EN 页/移动端）。
- 体积：CSS raw **119.73KB**（≤120，余量 0.28KB）/ gzip **23.49KB**（≤25）；新增 CSS 14.4KB（dashboard 5.0KB ≤8KB）；无新增外链资源。
- 发布：v1.2.0 提交、Actions、线上验收记录见 [`RELEASE.md`](RELEASE.md)。

### B6. v1.2 已知限制
1. 技能「上传」为静态站方案（GitHub Issue/PR 审核后合入），无运行时上传后端；审核需人工。
2. 榜单卡片使用页面即时数据；离线/无数据时分享降级为纯标题卡（不阻断）。
3. 仪表盘趋势基于当前模型 `releaseDate` 聚合，非历史快照；价格分层按输出价/1M tokens。
4. 移动端浮动按钮（AI 助手/回顶）会覆盖卡片右下角少量文字（价格分层百分比），可滚动查看；后续可加安全区留白。
5. 其余同 v1.0/v1.1（数据原文英文边界、BYOK CORS、SuperCLUE 降级、Feed 仅动态）。

---

## v1.4 验收：安全审查（P0） + 榜单/对比/斩杀线2.0/真实热榜/轮播/引导页瘦身（2026-11-04）

> 用户要求：① 榜单 Top10、1/2/3 名标记、分发信息极简；② 任意 N 模型对比（真实评分）；③ 斩杀线体现「评分高/能力强/费用低」；AI 热榜改为真实热搜话题 + 讨论摘要；④ 各模块引导页瘦身、内容优先，图表动态轮播（柔和）；⑤ **安全审查第一优先级：保护本机数据隐私与用户使用安全**。
> 契约：[`V1.4-CONTRACT.md`](V1.4-CONTRACT.md) ｜ 安全审计：[`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) ｜ 安全政策：[`../SECURITY.md`](../SECURITY.md)。

### S. 安全与隐私（P0）

| 项 | 结果 | 证据 |
|---|---|---|
| 独立安全审计 | ✅ Critical 0；High 5/5、Medium 6/6 全部修复并复测；Low 5（2 修、3 文档化接受） | `SECURITY-AUDIT.md`（含文件+行号/状态/owner/复测表） |
| XSS / 注入 | ✅ 外部数据（RSS/榜单/技能提交/HN）渲染 100% 经 `esc()`/`textContent`；`safeHttpUrl` 白名单；`safeMarkdown` 先转义后渲染；16 组 XSS 向量通过 | `tests/security.test.mjs` 9/9；审计 §3 |
| CSP / referrer | ✅ 9/9 页注入 CSP + `referrer: no-referrer`；`object-src/base-uri/form-action 'none'`；`connect-src` 兼容本机 Ollama 回环 | `security-check` 0 error；审计 §4 |
| BYOK 隐私 | ✅ 密钥仅 localStorage、不写日志、不注入上下文；`?ask=` 只预填不自动请求（+500 字符上限）；端点 https-only（回环 http 例外） | H-04/H-05 复测 PASS；`assistant-core.js checkEndpointUrl` |
| 供应链 / CI | ✅ Actions 全部 pin commit SHA；权限最小化（deploy 顶层 contents:read）；无 `pull_request_target`；CodeQL + Dependabot 启用；`security-check --strict` 纳入 CI | `.github/workflows/*`；审计附录 D |
| 仓库隐私 | ✅ 当前文件 PII/密钥 0 命中（128 文件扫描）；**v1.4 重建公开提交历史**，移除早期本机路径/用户名；旧 SHA 缓存残余风险记录；示例 key 全部占位 | 审计 §5.1；重建脚本执行记录 |
| 站点安全扫描 | ✅ 第三方脚本/字体/图片/iframe/analytics/cookie 0；`target=_blank` 缺 rel 0；http 外链 0 | `security-check` 0/0；审计 §6.3 |
| 数据安全 | ✅ 8 个 JSON 外链非法 scheme 0、`http://` 0；单文件 ≤2MB、总 609,624B ≤5MB；fetch 5MB 上限、实体解码越界防护 | M-02/M-03/M-04 复测 PASS |

### B. 功能与体验

| # | 需求 | 结果 | 证据 |
|---|---|---|---|
| B1 | 榜单 Top10 + 1/2/3 名标记 + 极简分发 | ✅ 每榜默认 Top10（可展开全部）；Top3 内敛徽章（金/香槟/石墨，aria 名次）；榜单底部 `.rank-dist` 极简 strip（站点 + GitHub + 56px QR） | `v14-rankings-top10.jpg` |
| B2 | 任意 N 模型对比（真实评分） | ✅ 勾选 2–6 个模型 → 浮动对比栏 → 对比视图：AA 智能指数 / LMArena / LiveBench / Epoch ECI / OpenCompass（名称归一化匹配，未匹配显示「—」并注明规则）+ 价格/上下文/模态/权重/许可/发布时间；键盘可达、移动横滚、清空/移除 | `v14-models-compare.jpg`；linkedom harness 79/79 |
| B3 | 斩杀线 2.0（评分高/能力强/费用低） | ✅ 能力×成本散点：x=输出价格 log，y=AA 智能指数；能力 P50 水平虚线 + 成本 P50 垂直虚线；四象限（左上=高能低价生存区）；样本数/规则/免责；tooltip/键盘/降级空态 | `v14-dashboard-scatter.jpg` |
| B4 | AI 热榜 = 真实话题 + 讨论摘要 | ✅ Hacker News 近 7 天 AI 讨论 Top10（真实 points/comments/domain/时间 + 首条评论清洗摘要 ≤160 字，外链 rel）；口径「非全网热搜」；`data/topics.json` 双模式/快照降级；news `?tag=` 保留 | `v14-dashboard-topics.jpg`；`data/meta.json.sources hn-ai` |
| B5 | 引导页瘦身（内容优先） | ✅ 9 页 compact hero；index hero 413px（≤560）；首内容 @1440：index **621** / rankings **572** / about **388** / resources 514 / projects 569 / skills 513（≤620） | 7 宽度审计 |
| B6 | 图表动态轮播 | ✅ 3 视图（柱状/饼图/斩杀线）自动轮播 6.5s、520ms 柔和滑动、dots/箭头、hover/focus 暂停、手动后暂停 12s、移动滑动、reduced-motion 关闭自动、无 JS 首图可见、面板定高 | `v14-dashboard-home.jpg`；linkedom 79/79；CDP 实测 transform/dot 变化 |
| B7 | 分享卡极简分发 strip | ✅ 四类卡片统一：1px 金线 + logo + 站点 URL 15px + GitHub 短地址 12.5px + 58px QR；高 72px=卡片 11.43%；榜单卡 Top3 徽章；对比度/无裁切达标 | `share-card-v2-board-preview.png`、`share-card-v2-skill-preview.png`；share 测试 14/14 |

### C. 回归与发布

| 检查 | 结果 |
|---|---|
| 单测 | **94/94 pass**（含 9 条安全测试） |
| 安全门禁 | `security-check --strict` **0 error / 0 warning**；self-test 9/9 |
| 数据合约 | `validate --strict` **0/0**（含新增 topics + data 体积/时间） |
| i18n | `check-i18n --strict` **0 error / 819 used / 829 keys**（zh/en 一致，EN 残留 0） |
| 英文注释 | `check-comments --strict` **0 hit**（64 files） |
| 布局审计 | 7 宽度 × 8 页 = **56/56 场景 0 问题**（新增首屏内容/hero/轮播/热榜指标） |
| 浏览器 | 8 页 zh/en CDP 无 console error、CSP 无违规；5 主题可读 |
| 体积 | index CSS 118.7KB/23.8 gzip、skills 111.6/22.5、models 112.2/22.6、一般页 105.3/20.7（≤120/≤26）；dashboard.js 34.5KB（≤34KB 记录）、compare.js 12.1KB、data-match.js 7.9KB |
| 发布 | v1.4.0：历史重建 + Actions 绿 + 线上验收 + tag/release（记录见 RELEASE.md） |

### D. v1.4 已知限制
1. 斩杀线样本为「有 AA 评分且能匹配到价格」的模型（本地 52 / CI 契约约 83），页面动态显示样本数；未匹配模型不绘制，不编造评分。
2. 模型对比评分按名称归一化匹配，未匹配显示「—」；榜单口径与更新频率以来源为准。
3. AI 热榜来自 Hacker News 公开 API，非全网/中文热搜；摘要为首条讨论清洗节选，可能不完整；采集失败保留快照并降级。
4. GitHub Pages 无法设置 HTTP 响应头，CSP 以 meta 形式提供（`frame-ancestors` 不生效，点击劫持为记录残余风险）；历史重建后旧 commit SHA 可能被 GitHub 缓存，残余风险与处置见 SECURITY-AUDIT §5.1。
5. 移动端首屏（390×844）仍以品牌 hero 优先，KPI 卡在折叠线下（审计未列为阻塞）。

---

## v1.3 追加验收（2026-11-04，用户复核后迭代）

> 背景：用户要求 ① 12 周发布改柱状图、价格分层改环形饼图、新增 **AI 模型斩杀线** 与 **AI 话题热榜** ② 全局 UI 对齐返工（明确要求不再返工）。
> 契约：[`V1.3-CONTRACT.md`](V1.3-CONTRACT.md)。

### C1. 需求对照

| # | 需求 | 结果 | 证据 |
|---|---|---|---|
| R1 | 图表重设计 | ✅ 柱状图（12 周 + 均值线 + 3 网格 + tooltip + 入场）、环形饼图（5 档 + 图例 + 中心统计 451/444 + hover） | `v13-dashboard-charts.jpg`、`v13-dashboard-charts-mobile.jpg` |
| R2 | AI 模型斩杀线 | ✅ P50 输出价 $2.00/1M 动态计算；log 轴 `$0.01/$1/$10/$100`；444 个已标价模型 3px 竖条（生存/斩杀双色）；`232 ≤（52.3%）/ 212 >`；口径/免责声明；金色虚线 + 上方 caption | `v13-dashboard-kill-hot.jpg` |
| R3 | AI 话题热榜 | ✅ 8 主题近 60 天真实统计：Agent 32 动态·392 模型、推理 25·338、多模态 30·310、开源权重 34·204、长上下文 32·20、价格战 8·21、微调 2·16、安全 …；热度条归一化；点击跳 `news.html?tag=` 并生效（banner + 清除） | `v13-dashboard-kill-hot.jpg`、`v13-news-tag.jpg` |
| R4 | UI 对齐返工 | ✅ **自动布局审计 56 场景（7 宽度 × 8 页）0 问题**：0 溢出、0 同行卡片高度差、0 footer/按钮行错位、0 KPI 基线差、0 图表容器偏差、0 浮动遮挡 | `docs/screenshots/audit/audit-report.json`（0 issues） |
| R5 | 发布 | ✅ v1.3.0（记录见 RELEASE.md） | GitHub / Actions / Pages |

### C2. 图表细节
- **柱状图**：12 柱（周一起算），y 轴顶=最大值 25 / 底=0（方向已修正），3 条网格 + 周均虚线「9.1 个」；max 柱顶常显数值、其余 hover/focus tooltip（`09.21 周 · N 个`）；入场 stagger 35ms × 12 + 700ms；390 下 x 轴隔一显示。
- **环形饼图**：5 档（免费 19/4.3%、<$1 142/32%、$1–5 143/32.2%、$5–15 93/20.9%、≥$15 47/10.6%）；中心「451 模型 / 已标价 444」；图例列对齐；hover 扇区与图例联动；未标价排除说明。
- **AI 模型斩杀线**：中位数 P50 动态计算（当前 $2.00/1M）；log 轴；生存区 tint（highlight 6%）/斩杀区 tint（gold 5%）+ 1px 基线 + 金色虚线 + caption pill「斩杀线 $2.00/1M」；444 根竖条等高 75px/3px 宽；模型 tooltip；规则/免责声明（不构成质量评价）。
- **AI 话题热榜**：8 主题关键词规则（`HOT_TOPICS` 常量，近 60 天动态 + 模型能力/模态）；Top 8 列表：名次 + 话题 + 热度条 + 「N 条动态 · M 个模型」+ 跳转箭头；口径文案在卡片底部。
- **news `?tag=`**：初始筛选命中标签（如「推理」→ 25/89 条），banner「来自话题热榜：推理」+「清除话题筛选」；无匹配回退全部。
- **动效**：柱 700ms+stagger、热榜 800+40×7、饼 780ms、斩杀线 800ms、KPI count-up 900ms → 均 ≤1.2s；`prefers-reduced-motion` 全部关闭；无弹跳。

### C3. UI 对齐审计（R4，重点）
Lead 自研 CDP 布局审计脚本（Lead 侧 CDP 布局审计（工具不入库），CDP + 7 宽度 × 8 页 = 56 场景）检查项：横向溢出、同行卡片高度差、footer/按钮行对齐、KPI 等高与 number/label/note 基线、图表 svg 与容器内宽、浮动按钮遮挡（AI 助手/回顶）。
- **最终结果：56/56 场景 0 问题**（audit-report.json issues: []）。
- 修复项：技能卡/项目 Skills 卡 footer 错位（原 22–47px → 0，`.skill-card-footer{margin-top:auto}` + tags 2 行 + desc clamp + grid stretch）；KPI note 基线（原 6.3px → 0，单行省略+固定底）；柱状图 y 轴方向；斩杀线 tick 重叠与 caption 压条；热榜「去看」竖排（nowrap + 箭头）；390 柱状 x 轴隔一显示。
- CSS 拆分：`dashboard.css`（仅 index）/ `skills.css`（仅 skills）；每页预算：index **119.4KB raw / gzip 24.2**、skills **113.9 / 23.0**、其他页 **107.4 / 21.1**（均 ≤120KB raw）。
- JS 体积记录：`dashboard.js` **27.2KB**（v1.2 15.8KB，+11.4KB：柱状/饼/斩杀线/热榜/8 主题规则/交互，无外链依赖）→ Lead 批准放宽至 **28KB** 并记录。

### C4. v1.3 回归与验收
- `node --test` → **72/72 pass**；`validate --strict` → **0/0**；`check-i18n --strict` → **PASS 0 error（783 used keys）**；`check-comments --strict` → **0 hit**；Skill 自检 16/16；DOM harness（site-mvp）96/96。
- CDP：8 页 × zh/en 全绿、无 console error；v1.3 仪表盘 1440/1024/390 × 5 主题可读；news `?tag=` 正常；EN dashboard 全英文（"The AI model kill line" / "AI hot topics"）。
- 截图：`docs/screenshots/` 新增 v13-*.jpg 9 张 + audit-report.json。
- 发布：v1.3.0 提交/Actions/线上验收记录见 [`RELEASE.md`](RELEASE.md)。

### C5. v1.3 已知限制
1. 「斩杀线」= 输出价格中位数（可配置规则），**非质量/能力评价**；页面已明确标注。
2. 热榜为站内 60 天关键词统计，不代表全网热度；关键词规则为常量，后续可数据化。
3. 仪表盘趋势基于当前模型发布时间聚合，非历史快照。
4. 移动端浮动按钮仍会覆盖部分图表右下角（审计阈值 4px 内未报；可点按/滚动查看）。

---

### 证据索引
- 规格：[SPEC.md](SPEC.md) ｜ 数据合约：[DATA-CONTRACT.md](DATA-CONTRACT.md) ｜ POC：[POC-REPORT.md](POC-REPORT.md) ｜ AI/分享：[AI-SHARE.md](AI-SHARE.md) ｜ 发布说明：[RELEASE.md](RELEASE.md)
- 截图：`docs/screenshots/`（33 张）
- 工作流：`.github/workflows/{ci,deploy,refresh-data}.yml`
