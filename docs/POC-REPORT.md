# POC 报告 — 数据跟踪模块：来源验证 + 采集/归一化管道（POC-DATA v1）

> 模块：数据跟踪（信息采集层）｜ 负责人：poc-data ｜ 日期：2026-11-03 ｜ 阶段：Phase P（POC）→ Phase M（MVP）
> 关联规格：`docs/SPEC.md` §2/§3/§7/§9、`docs/DATA-CONTRACT.md` v1.0 ｜ 数据产物：`data/*.json`、`data/snapshot/**`

---

## 0. 结论（给 Lead 的 60 秒版）

1. **管道可行且已跑通**：`node scripts/fetch-data.mjs --mode=local` 首版即可产出 6 个合约文件：
   **451 模型 / 89 动态 / 9 榜单 / 22 资源 / 13 项目**，来源状态灯 **16 ok / 3 blocked（2 个 CI-only + SuperCLUE 主动不接入，均带原因）**；
   `node scripts/validate.mjs` **通过（0 error / 0 warning）**。
2. **拿到的高质量真实榜单（非伪造）**：LiveBench 2.0（32 模型，官方权重本地复算 Overall）、Epoch AI ECI（40）+ SWE-bench Verified（25）+ GPQA Diamond（25）、OpenCompass 中文 Arena（10+10，官方 API）、Artificial Analysis 智能指数（**91 款全量**，`/leaderboards/models` 内嵌数据）、OpenRouter 派生榜（上下文窗口/输出价格，明确标注“派生非质量排名”）。
3. **意外收获（比预期好）**：
   - OpenCompass 有**本机可直连的 POST API**（`/gw/opencompass-be/api/v1/rank/listArenaRankings`，返回 Elo/votes/CI 的真实中文 Arena 榜）；
   - Epoch AI 官方提供 **`benchmark_data.zip`（2.36MB、92 个 CSV）**，本机可下载并纯 Node 解包（ECI/GPQA/SWE-bench 全部落库）；
   - LiveBench 2.0 数据文件 `data/<release>/table.csv` + `categories.json`（含官方 Overall 权重）本机可直连；
   - Artificial Analysis 首页 Next.js flight payload 内嵌 28 款模型的 Intelligence Index，可直接解析；
   - DeepSeek 官方 Change Log（`api-docs.deepseek.com/updates`）本机可达，已做 HTML 适配接入 7 条中文厂商动态。
4. **被墙/不可行的源已确认并降级**（不阻塞）：huggingface.co、lmarena.ai、datasets-server.huggingface.co、HF/blog、Mistral、Anthropic RSS（404）、Meta RSS（404）、SuperCLUE（SPA 无公开 API）。**这些在 `--mode=ci`（GitHub Actions）启用或标记 blocked，管道不会因单源失败中断。**
5. **实测可重复**：`--from-snapshot --now=<固定>` 连续两次运行，6 个 JSON **字节级一致**（确定性排序 + 注入时钟）。
6. **待 Lead 决策/集成**（见 §9.3）：CI workflow 需执行 `fetch:ci → validate`；LMArena CI 路径（datasets-server JSON）因本机被墙**只能在首次 Actions 运行中验证**；本机 github.com 被墙（仅 api.github.com 可达），链接抽检需 CI 侧补验。
7. **线上 CI 已验证（2026-11-03 v1.0.0 发布后回填）**：Lead 发布后 Actions `--mode=ci` 运行成功，**18/19 源 ok**（HF 官方 ✅、LMArena ✅ 100 条榜单已渲染、仅 SuperCLUE blocked 如实标注）；CI 数据 89 动态 / 10 榜单 / 451 模型（本机 local 为 89 动态 / 9 榜单 / 451 模型——差 1 个仅 CI 启用的 LMArena 榜）。§9.3 中「CI 集成」「LMArena CI 路径」两项已验证关闭。

---

## 1. 环境事实与实测方法（2026-11-03，本机）

| 项 | 事实 |
|---|---|
| 联网方式 | **仅 Node.js 内置 fetch 可用**（v24.21.0）。PowerShell `Invoke-WebRequest` / `curl` / `git` 走 schannel 在本沙箱失败（SEC_E_NO_CREDENTIALS），全部网络请求统一走 `scripts/fetch/http.mjs` 的 `httpRequest()` |
| 本机可达 | openrouter.ai、api.github.com（未认证 60/h，实测已触发 403 限流）、hf-mirror.com、livebench.ai、epoch.ai、rank.opencompass.org.cn、artificialanalysis.ai、openai.com、deepmind.google、blog.google、qwenlm.github.io、aws.amazon.com、news.mit.edu、bair.berkeley.edu、api-docs.deepseek.com |
| 本机被墙 | huggingface.co、lmarena.ai、datasets-server.huggingface.co、huggingface.co/blog、mistral.ai、research.google（timeout ~10s）；**github.com 页面也不可达（仅 api.github.com 通）** |
| 时间 | 2026-11-03（UTC+8）；数据 `generatedAt` 取真实抓取时刻 |
| 约束 | 零 npm 依赖（Node 内置 `fetch/fs/zlib` 即可）；ESM；单源失败降级不中断；不伪造分数、不使用凭据 |

**证据命令与落盘位置**（原始响应/耗时/字节均可复查）：

```bash
# 阶段 1：35 个候选源可达性矩阵（HTTP/耗时/字节/样例字段/HTML 数据线索）
node scripts/fetch/probe-sources.mjs            # → data/snapshot/probe/report.json + <id>.<ext> + console.log
# 阶段 2-5：SPA/HTML/数据集深挖（LiveBench/OpenCompass/Epoch/AA/候选 RSS）
node scripts/fetch/probe-deep.mjs               # → data/snapshot/probe/deep-*（bundle、parquet、HTML）
node scripts/fetch/probe2.mjs                   # → p2-*（LiveBench 数据文件、Epoch CSV 线索、AA 解析验证）
node scripts/fetch/probe3.mjs                   # → p3-*（LiveBench categories/breakdown、OpenCompass chunk）
node scripts/fetch/probe4.mjs                   # → p4-*（OpenCompass 请求定义、Epoch zip、AA flight 结构）
node scripts/fetch/probe5.mjs                   # → p5/opencompass POST 实测、epoch zip 解包清单
node scripts/fetch/probe-feeds.mjs              # → report-feeds.json（15 个候选 RSS/新闻页）
# 阶段 6：正式管道 / 校验 / 测试 / 链接抽检
node scripts/fetch-data.mjs --mode=local        # → data/*.json + data/snapshot/<源>.*
node scripts/validate.mjs                       # → 0 error
node --test tests/                              # 22 个数据侧测试（本沙箱用 --test-isolation=none，见 §8）
node scripts/fetch/check-links.mjs              # → data/snapshot/link-check.json
```

---

## 2. 来源矩阵（实测）

### 2.1 原始探测：35 个候选（`probe-sources.mjs`，完整表见 `data/snapshot/probe/matrix.md`）

| 源 | 类型 | HTTP | 耗时 ms | 字节 | 结论 / 样例字段 |
|---|---|---|---|---|---|
| openrouter `/api/v1/models` | api | **200** | 1128 | 805,069 | ✅ 451 模型；字段 `id/name/created/context_length/architecture/pricing/top_provider/supported_parameters/hugging_face_id/reasoning` |
| hf-mirror `/api/models` | api | **200** | 658 | 10,928 | ✅ HF 镜像可用（官方被墙的替代）；字段 `id/downloads/likes/tags/lastModified` |
| hf-mirror datasets 搜索 | api | **200** | 706 | 12,745 | ✅ 可查 LMArena 数据集元信息 |
| LMArena leaderboard-dataset（镜像） | dataset | **200** | 334 | 22,653 | ✅ 元信息 `siblings/sha/lastModified`；`text/latest-*.parquet` 623,727B 可下载（PAR1 校验通过） |
| huggingface.co 官方 API | api | **超时** | 10,589 | — | ❌ 本机被墙（`UND_ERR_CONNECT_TIMEOUT`）→ CI-only |
| lmarena.ai leaderboard | html | **超时** | 10,333 | — | ❌ 本机被墙 → CI-only |
| datasets-server.huggingface.co | api | **超时** | 10,329 | — | ❌ 本机被墙 → LMArena 的 CI 路径（JSON rows） |
| livebench.ai 首页/bundle | html | **200** | 356/468 | 889 / 386,105 | ✅ SPA；bundle 暴露数据文件规则 `data/<release>/table.csv`、`categories.json`、`breakdown.json` |
| epoch.ai 基准面板 | html | **200** | 1588 | 135,902 | ✅ Astro 壳；`/benchmarks/use-this-data` 暴露官方 `benchmark_data.zip` |
| epoch.ai `/data/benchmark_data.zip` | dataset | **200** | 5488 | **2,361,629** | ✅ 92 个 CSV：`epoch_capabilities_index/eci_scores.csv`、`swe_bench_verified.csv`、`gpqa_diamond.csv`、`model_metadata.csv` … |
| opencompass 官网/JS | html/js | **200** | 159/223 | 4,590 / 122,680 | ✅ SPA 但 chunk 含真实 API：`POST /gw/opencompass-be/api/v1/rank/listArenaRankings` |
| opencompass Arena API（实测 POST） | api | **200** | 153 | 1,752 | ✅ `rankings[]: model/org/eloRating/votes/rankingChanges/eloCI95`，`lastUpdate=2026-06-12` |
| artificialanalysis.ai 首页 | html | **200** | 686 | 1,524,889 | ✅ Next.js flight 内嵌 `initialData`（28 模型 × `intelligenceIndex/creator/score/...`） |
| artificialanalysis.ai `/leaderboards/models` | html | **200** | ~700 | **1,916,642** | ✅ flight 内嵌 `initialModels`（91 款有 `intelligenceIndex`、`modelCreatorName`、`contextWindowTokens`）→ 全量智能指数榜 |
| AA 公开 API `/api/v2/...` | api | **401** | 387 | 31 | ❌ 需 API key（不接） |
| OpenAI News RSS | rss | **200** | 1000 | 821,495 | ✅ RSS 2.0；`title/link/pubDate/description(content:encoded)` |
| Google DeepMind Blog RSS | rss | **200** | 320 | 69,619 | ✅ RSS 有效 |
| Google AI Blog RSS | rss | **200** | 1550 | 30,644 | ✅ RSS 有效（description 含双重编码 HTML，已在归一化中清洗） |
| Qwen Blog RSS | rss | **200** | 1351 | 39,167 | ⚠️ 可达但**停更**（最新 2025-09-22，超出 120 天窗口） |
| AWS ML Blog RSS | rss | **200** | 1058 | 578,645 | ✅ 新增源，20 条有效 |
| MIT News AI RSS | rss | **200** | 3887 | 532,422 | ✅ 新增源，50 条有效 |
| Berkeley BAIR RSS | rss | **200** | 4390 | 289,139 | ✅ 新增源，10 条有效 |
| Anthropic RSS | rss | 404 | 960 | 82,205 | ❌ 无官方 RSS（`/rss.xml` 404） |
| Meta AI Blog RSS | rss | 404 | 2440 | 163,702 | ❌ 无官方 RSS（重定向到 HTML） |
| NVIDIA Blog RSS | rss | 连接重置 | 379 | — | ❌ 本机 `ECONNRESET`（MVP 可重试/CI 再验） |
| Microsoft AI Blog RSS | rss | 410 | 2137 | 2,546 | ❌ Gone（已下线） |
| Google Research Blog / arXiv RSS / Mistral | rss | 超时 | ~10-12s | — | ❌ 本机不可达 |
| DeepSeek News/ChangeLog | html | **200** | 72ms | 51,222B | ✅ 文档站（Docusaurus）非 RSS，但 Change Log 结构可解析 → 已做 HTML 适配，产出 7 条中文厂商动态（`normalizeDeepseekUpdates`） |
| Moonshot / MiniMax / Zhipu / SuperCLUE | html | 200 | 438-1032ms | 883B-899KB | ⚠️ 可达但**非 RSS/无公开 API**（Next.js/Vue SPA 或重定向页）→ 见 §3 结论 |
| api.github.com `/repos/{repo}` | api | **200** | 388~712 | 6,098~7,019 | ✅ 12/12 仓库刷新成功；`stargazers_count/license.spdx_id/pushed_at/html_url`；未认证 60/h，**实测跑两轮后触发 403 限流** |
| api.github.com `/rate_limit` | api | **200** | 1348 | 424 | ✅ 可用于自限速 |

### 2.2 当前管道注册源（`scripts/fetch/sources.mjs`，19 个；local 启用 16 个）

| id | 名称 | 类型 | local | ci | 实际用途 |
|---|---|---|---|---|---|
| `openrouter` | OpenRouter Models API | api | ✅ | ✅ | models（451）+ 新模型动态 + 2 个派生榜 |
| `livebench` | LiveBench 2.0 | dataset | ✅ | ✅ | 榜单（32，官方权重本地复算 Overall） |
| `epoch-ai` | Epoch AI Benchmarking | dataset | ✅ | ✅ | 榜单 3 个（ECI 40 / SWE 25 / GPQA 25） |
| `opencompass` | OpenCompass 司南 | api | ✅ | ✅ | 榜单 2 个（中文 Arena 文本/多模态） |
| `artificial-analysis` | Artificial Analysis | html | ✅ | ✅ | 榜单 1 个（智能指数 91 款全量） |
| `rss-openai` / `rss-gdm` / `rss-google-ai` / `rss-qwen` / `rss-aws-ml` / `rss-mit-ai` / `rss-bair` | 7 家官方/研究博客 RSS | rss | ✅ | ✅ | news（各 8 条，近 120 天；Qwen 停更 0 条） |
| `deepseek-news` | DeepSeek 官方 Change Log | html | ✅ | ✅ | news（7 条，HTML 适配，中文厂商动态） |
| `hn-ai` | Hacker News AI 热榜 | api | ✅ | ✅ | `data/topics.json`（近 7 天 AI 故事 Top 10 + 首条评论摘要，v1.4 B4） |
| `github` | GitHub API | api | ✅ | ✅ | projects 13 个的 stars/license/updatedAt 刷新 |
| `github-releases` | GitHub Releases | api | ✅ | ✅ | news（transformers / vLLM / Ollama 最新 3 个 release，kind=oss） |
| `hf-mirror` | Hugging Face 镜像 | api | ✅ | ✅ | POC 验证镜像可达（MVP：开源权重/趋势补全） |
| `huggingface` | HF 官方 API | api | ➖ | ✅ | CI 网络下验证/补全（MVP 使用） |
| `lmarena` | LMArena（HF 数据集） | dataset | ➖ | ✅ | CI 经 datasets-server JSON rows 取 Top100 文本榜 |
| `superclue` | SuperCLUE | html | ➖ | ➖ | **不接入**：Vue SPA，bundle 仅暴露微信文章链接，无公开数据 API |

---

## 3. 可行 / 不可行结论

**可行（POC 已接入并产出真实数据）**
1. **OpenRouter 模型目录**：一手价格/上下文/模态/能力事实，451 模型；`created` 可用于新模型动态。
2. **LiveBench 2.0**：官方 CSV 数据文件；`categories.json._overall_weights` 提供官方 Overall 权重，站点本地复算（透明可追溯）。
3. **Epoch AI**：官方 `benchmark_data.zip` 是「一个源换 3 个高质量榜单」的高性价比数据源；ECI 自带置信区间。
4. **OpenCompass Arena**：中文盲测 Elo 榜（官方 API），补齐中文侧视角；POC 只用 Arena 文本/多模态两种 rankingType，`listModelRankings` 等还有扩展空间。
5. **Artificial Analysis**：`/leaderboards/models` 页 flight 内嵌 `initialModels`，解析出 **91 款**模型的智能指数（无 key 可用的唯一路径），另保留首页 28 款精选作为回退。
6. **7 家官方/研究博客 RSS**：OpenAI / Google DeepMind / Google AI / Qwen（停更）/ AWS ML / MIT News AI / Berkeley BAIR；统一清洗、粗分类、120 天窗口。
7. **DeepSeek 官方 Change Log（HTML 适配）**：本机可达的官方公告页（Docusaurus），按 `Date: YYYY-MM-DD` 分段解析出 7 条中文厂商动态（V4.1-Flash-1017、V4-Pro、V4-Flash 等）。
8. **GitHub API**：项目 stars 刷新（CI 用 token 5000/h）+ GitHub Releases（transformers/vLLM/Ollama）作为开源工具动态。
9. **Hacker News AI 热榜（v1.4 B4）**：HN Algolia 公开 API（无 key，本机直连 ~0.7s）；近 7 天 AI 相关故事（points>30）按 points Top10，逐条取 story item tree 首条高赞评论清洗为 ≤160 字纯文本摘要，另保存 `data/snapshot/hn-ai-{search,items}.json` 供离线重放与降级（详见 §11）。

**不可行 / 需降级（已按规则处理，不阻塞）**
| 源 | 原因 | 处理 |
|---|---|---|
| huggingface.co 官方 API / HF Blog | 本机被墙 | `--mode=ci` 启用；local 标 `blocked`（含原因），hf-mirror 兜底验证 |
| lmarena.ai / datasets-server | 本机被墙 | CI 走 HF `lmarena-ai/leaderboard-dataset` `text/latest` JSON rows（Top100）；local 标 `blocked` |
| LMArena parquet（hf-mirror 已下载） | 本机 Python 无 pyarrow/fastparquet，Node 无 parquet 解析依赖 | POC 不引第三方依赖；CI 用 datasets-server JSON（纯 Node）。parquet 作为备用证据留档 |
| SuperCLUE | Vue SPA + 微信文章，无公开数据 API | 不接入；meta 标 `blocked` + 原因（不伪造/不爬非公开） |
| DeepSeek News | 文档站 HTML，非 RSS | MVP 做 HTML 结构化适配 |
| Anthropic / Meta / Microsoft / NVIDIA RSS | 404 / 410 / ECONNRESET | 记录在报告；MVP 再逐一处理（Anthropic 可考虑 HTML 列表） |
| github.com 页面 | 本机被墙（仅 api.github.com 通） | 项目链接有效性用 GitHub API 间接验证（见 §8.3）；CI 侧补验 |

**数据口径原则（贯穿管道）**
- **绝不伪造分数**：所有 `rankings.entries` 均来自官方 API/CSV/数据集；派生榜（上下文窗口、输出价格）在 `description` 明确写“由 OpenRouter 目录派生，非质量排名”。
- 拿不到 → 整榜缺省 + `meta.sources.status=blocked/degraded` + `note` 说明，而不是填假数据。
- 每条新闻/榜单均带 `sourceName` + 可点击 `sourceUrl/url`；模型带 `sourceIds`。
- 时间统一 ISO 8601 UTC；价格 USD/1M tokens；`news.summary`/`models.description` 纯文本（去标签、解实体、限长 240/120）。

---

## 4. 管道结构

```
             ┌────────────────────────── scripts/fetch-data.mjs（CLI: --mode=local|ci） ──────────────────────────┐
             │                                                                                                        │
数据源        │  SOURCES（scripts/fetch/sources.mjs，18 个注册源）                                                  │
公开 API ────┼──> collect(ctx) ──> ctx.get(url) ──> scripts/fetch/http.mjs                                     │
官方 CSV ────┤                        │   超时/重试/429 退避 + 原始快照 data/snapshot/<id>.<ext>                 │
数据集/镜像 ─┤                        │   失败 → 快照回退（degraded）→ 无快照（blocked），不中断整体             │
官方 RSS ────┘                        ▼                                                                        │
                          scripts/normalize.mjs（纯函数、可单测、无 IO）                                          │
                 normalizeOpenRouterModels / buildNewsFromModels / buildDerivedRankings                          │
                 normalizeLiveBench / normalizeEpochEci / normalizeEpochBenchmark                              │
                 normalizeOpenCompassArena / parseAaInitialData+normalizeAaRankings / normalizeLmarenaRows      │
                 parseRssItems+normalizeRssNews（HTML 清洗/粗分类/来源加权）/ normalizeGithubProjects            │
                                        │                                                                        │
                                        ▼                                                                        │
                 assembleData()：去重 → 确定性排序 → 统计 → meta.sources 状态灯 + latestHighlights              │
                                        │                                                                        │
                                        ▼                                                                        │
             data/{meta,models,news,rankings,resources,projects}.json  +  data/snapshot/**（原始快照/证据）      │
             └────────────────────────────────────────────────────────────────────────────────────────────────────┘
                 │ 后续（其它成员/Lead）：scripts/validate.mjs 校验 → scripts/build-feed.mjs → site/ → GitHub Pages
```

**文件职责**
| 文件 | 职责 |
|---|---|
| `scripts/fetch-data.mjs` | CLI 编排：参数（`--mode/--from-snapshot/--now/--only/--check-links`）、并发采集、降级回退、合并写出、状态表 |
| `scripts/fetch/sources.mjs` | 源注册表（id/name/url/type/enabledLocal/enabledCi/collect）+ 各源采集器（含 LiveBench release 动态发现、Epoch zip 解包、GitHub 批量刷星） |
| `scripts/fetch/http.mjs` | 统一 HTTP（Node fetch）+ 超时/重试/退避 + `SnapshotStore`（快照读写/离线重放） |
| `scripts/normalize.mjs` | 纯函数归一化（模型/动态/榜单/RSS/GitHub/派生榜/总装），`--from-snapshot` 重放与单测的核心 |
| `scripts/fetch/curated.mjs` | 人工整理的 22 条学习资源 + 13 个项目（真实链接，stars 有最近值兜底） |
| `scripts/fetch/check-links.mjs` | 外链抽检（直接探测 + GitHub API / hf-mirror 替代验证 + 判定分类） |
| `data/snapshot/**` | 原始快照（可离线回退/取证）+ `probe/**` POC 探测证据 |
| `tests/data-normalize.test.mjs` / `tests/data-contract.test.mjs` | 纯函数单测 + 数据合约自检（22 个测试） |

**双模式设计**
- `--mode=local`：本机可达源（14 个启用），POC/本地开发用；
- `--mode=ci`：GitHub Actions 全量（额外启用 HF 官方、LMArena），CI 网络无墙；
- 任一模式单源失败均不影响整体；`meta.sources[]` 逐源记录 `ok|degraded|blocked` + `note` + `lastFetchedAt` + `items`。

---

## 5. 真实产出统计（本机 local 模式实跑）

| 文件 | 数量 | 说明 |
|---|---|---|
| `data/models.json` | **451** 模型 / 62 厂商 | 444 个有价格、451 个有上下文、170 个开放权重（含 HF id）；上下文最大 2,000,000；releaseDate 覆盖 2023-05-28 → 2026-11-02 |
| `data/news.json` | **89** 条 | 30 条 OpenRouter 新模型（近 45 天，按 created 倒序）+ 43 条 6 家 RSS（近 120 天）+ 7 条 DeepSeek 官方 Change Log + 9 条 GitHub Releases（transformers/vLLM/Ollama）；kind 分布 release 67 / oss 10 / pricing 4 / research 3 / policy 3 / benchmark 2；来源 9 家；lang zh 37 / en 52 |
| `data/rankings.json` | **9 个榜单 / 253 条 entry** | 见下表 |
| `data/resources.json` | **22** 条 | course 7 / tutorial 8 / book 2 / awesome 2 / paper 2 / tool 1；en 15 / zh 6 / multi 1；全部真实长期有效链接 |
| `data/projects.json` | **13** 个 | 1 个 self（本仓库）+ 12 个社区精选；stars 60,444 ~ 185,768（GitHub API 刷新） |
| `data/topics.json` | **10** 条 | v1.4 真实热榜：Hacker News 近 7 天 AI 相关故事按 points Top10 + 首条高赞评论纯文本摘要（≤160 字） |
| `data/meta.json` | stats + 19 源状态 + 3 条 highlights | `sourcesOk=16`（local；另 2 个 CI-only + 1 个主动不接入标 blocked） |

**榜单明细（全部真实来源，updatedAt 来自数据源或抓取时刻）**

| board id | 名称 | 来源 | entries | updatedAt | Top1 |
|---|---|---|---|---|---|
| `livebench-2.0` | LiveBench 2.0 综合榜 | LiveBench（官方 CSV，权重复算） | 32 | 2026-10-25 | Claude Fable 5.1 — 85.7 |
| `epoch-eci` | Epoch AI ECI 能力指数榜 | Epoch AI（官方 zip） | 40 | 2026-10-26 | GPT-6 Astra — 169.1 |
| `epoch-swe-bench-verified` | SWE-bench Verified（Epoch 收录） | Epoch AI | 25 | 抓取时刻 | Claude Opus 4.7 — 83.5 |
| `epoch-gpqa-diamond` | GPQA Diamond（Epoch 收录） | Epoch AI | 25 | 抓取时刻 | Gemini-4 Argon — 96.4 |
| `opencompass-arena` | OpenCompass 中文 Arena 榜 | OpenCompass 官方 API | 10 | 2026-06-12 | MiMo-V2.5-Pro — 1062 |
| `opencompass-arena-mm` | OpenCompass 多模态 Arena 榜 | OpenCompass 官方 API | 10 | 2026-06-12 | Doubao-Seed-1.6-Vision-250815 — 1226 |
| `artificial-analysis-intelligence` | Artificial Analysis 智能指数榜 | AA `/leaderboards/models` 内嵌数据 | 91 | 抓取时刻 | Gemini 4 Carbon (High) — 59.4 |
| `context-window` | 上下文窗口榜（派生，非质量排名） | OpenRouter 目录派生 | 10 | 抓取时刻 | Auto Router — 2M tokens |
| `output-price` | 输出价格榜（低价优先，派生） | OpenRouter 目录派生 | 10 | 抓取时刻 | Mistral Nemo — $0.03/1M |

---

## 6. 降级策略与实测案例

**状态定义（写入 `meta.sources[].status`）**
| status | 含义 | 触发 |
|---|---|---|
| `ok` | 成功获取并归一化 | 实时抓取成功；或离线快照重放 |
| `degraded` | 实时抓取失败，已回退上次快照，数据仍可用 | 网络波动/限流，但 `data/snapshot/<id>.*` 存在 |
| `blocked` | 本模式不启用，或抓取失败且无快照 | CI-only 源（local 模式）、被墙且无快照、无公开 API 的源 |

**管道级策略**
1. **单源隔离**：并发采集，单源异常只影响该源贡献；已知核心源 OpenRouter 完全失败且无快照时才退出码 1（绝不写空数据假成功）。
2. **快照回退**：每次成功抓取都把原始响应写入 `data/snapshot/`；实时失败自动回退快照并标 `degraded`。
3. **限流退避**：`http.mjs` 对 429/5xx/网络错误做 1-2 次指数退避重试；GitHub 未认证 60/h 实测触发 403 后优雅降级（本次 POC 已复现）。
4. **不伪造**：拿不到的榜单整榜缺省（`boards` 中不出现），在 meta 状态灯与 note 说明；绝不填 0/占位分数。
5. **内容清洗兜底**：任何来源的 `title/summary` 在归一化与总装两处做「去标签 ↔ 解实体」多轮清洗（修复 Google AI Blog 双重编码 HTML 泄漏）。
6. **新鲜度窗口**：官方 RSS 只并入最近 120 天（Qwen 停更 → 0 条并注明）；模型动态取近 45 天 created。

**实测降级案例（本机真实发生）**
- GitHub API：POC 期间跑多轮后 60/h 用尽 → 12 个仓库全部 403 → 管道自动回退最近快照/人工清单 stars，`github` 标 `degraded`，其余 5 个文件正常产出；等待配额恢复后重跑自动恢复 `ok`（CI 用 `GITHUB_TOKEN` 5000/h 无此问题）。该案例同时验证了「快照不被失败结果覆盖」的修复。
- Qwen Blog RSS：HTTP 200 但最新条目 2025-09-22 → 0 条并入，`status=ok` + note 注明“超出 120 天新鲜度窗口”。
- HF/LMArena：本机超时 → `blocked` + note “仅 CI 启用”，前端按空态/降级展示。

---

## 7. 可重复性、测试与链接抽检

### 7.1 确定性（同快照重复运行结果一致）
```bash
node scripts/fetch-data.mjs --mode=local --from-snapshot --now=2026-11-03T12:00:00.000Z
# 连续两次运行后对比 7 个 data/*.json（含 v1.4 topics.json）：字节级完全一致
# （确定性排序：models 按 id、news 按 publishedAt desc+id、boards 按 id、topics 按 points desc+id、
#   resources featured+title、projects stars desc+id；所有时间由 --now 注入，不读系统时钟）
```
> 说明：常规联网运行时 `generatedAt` 为真实抓取时刻；确定性验证请用 `--from-snapshot` + 固定 `--now`。

### 7.2 测试（自包含、不联网）
```bash
node --test tests/                                  # 常规环境（Node ≥20）：数据侧 35 个 + 其它成员测试共 94 个
# 本沙箱受限：test runner 子进程 spawn 被拦截（EPERM），用同进程模式绕过：
node --test-isolation=none --test tests/data-normalize.test.mjs tests/data-contract.test.mjs
# → 数据侧 tests 35 / pass 35 / fail 0（含 v1.4 topics + M2/M3/M4 安全回归）
# 全团队同进程模式：tests 94 / pass 90 / fail 4 —— 4 个失败均来自 tests/security.test.mjs 的
# site 函数（safeMarkdown/buildShareText/matchModelScores，site-mvp/ai-share v1.4 修复中），非数据模块。
```
覆盖：CSV/RSS/HTML 清洗、OpenRouter 归一化（价格换算/模态/能力/开放权重）、新模型动态、LiveBench 官方权重复算、AA flight 解析、LMArena rows、OpenCompass API、Epoch ECI、DeepSeek Change Log 解析、GitHub stars 刷新与回退、派生榜、总装统计一致性、新闻去重/纯文本兜底、6 个合约文件全字段校验 + v1.4 topics 热榜（AI 过滤/points 排序/url 回退/讨论摘要 HTML 清洗）。

### 7.3 链接抽检（`--check-links` / `scripts/fetch/check-links.mjs`）
本机限制下直接可达的域名有限（github.com、huggingface.co 被墙），检查器按「直接探测 → GitHub API / hf-mirror 替代验证 → 分类」输出 `data/snapshot/link-check.json`：

| verdict | 条数 | 说明 |
|---|---|---|
| `ok` | 9 | 直接 2xx（d2l.ai、promptingguide.ai、jalammar.github.io、lilianweng.github.io、modelcontextprotocol.io、arxiv.org 等） |
| `ok-alternate` | 2 | huggingface.co 被墙，经 **hf-mirror.com 同路径**验证存在 |
| `bot-protected` | 1 | cookbook.openai.com 403 bot 防护（浏览器侧有效） |
| `network-blocked` | 1 | web.stanford.edu 本机 TLS/CA 校验失败（`UNABLE_TO_VERIFY_LEAF_SIGNATURE`，非链接失效） |
| `unverified` | 22 | 全部为 github.com 链接：本机 github.com HTML 被墙 + 检查时 **GitHub API 恰好 60/h 限流（403）**，无法完成替代验证 → 需 CI/限流恢复后复核 |

**结论**：可直接验证的域名上 100% 有效；GitHub/Stanford 条目属“本机环境限制”而非链接失效（GitHub 仓库存在性已在 stars 刷新时经 api.github.com 验证 12/12，CI 侧带 token 可全量复核）。POC 已修正所有可直接验证域名上的 404。

---

## 8. MVP 计划（POC 之后继续）

### 8.1 已在本轮 POC 尾巴完成（POC→MVP 过渡）
- ✅ RSS 扩到 **7 家**（OpenAI/GDM/Google AI/Qwen/AWS ML/MIT News AI/BAIR），全部走统一清洗+粗分类+来源加权 importance；
- ✅ **DeepSeek 官方 Change Log HTML 适配**（新增 7 条中文厂商动态，`normalizeDeepseekUpdates`）+ **GitHub Releases 开源工具动态**（transformers/vLLM/Ollama，kind=oss）；
- ✅ news HTML 泄漏修复（Google AI Blog 双重编码 `<img>` → 纯文本），title/summary 纯文本保证；
- ✅ kind 粗分类（release/policy/benchmark/oss/pricing/research），importance 按来源权重调整；
- ✅ GitHub 限流优雅降级 + 快照不被空结果覆盖 + `--skip=github` 本地省配额；
- ✅ 数据可重复性（`--from-snapshot` 字节级一致）+ 数据侧 24 个测试（全团队 60/60 通过）；
- ✅ 外链抽检工具（含被墙域名替代验证，已知被墙域名跳过直连提速）。

### 8.2 MVP 待办（按优先级）
1. **CI 全量验证**（最高优）：Lead 在 `.github/workflows/*` 加入步骤
   ```yaml
   - run: node scripts/fetch-data.mjs --mode=ci
     env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
   - run: node scripts/validate.mjs --strict
   ```
   首次运行需验证 CI-only 源：HF 官方 `/api/models`、LMArena `datasets-server /rows`（schema 可能与 fixture 有差异，`normalizeLmarenaRows` 已做字段名模糊匹配与失败降级）。
2. **LMArena 全量化**：LMArena 已用 datasets-server Top100（CI 验证）；AA 已从首页 28 款升级为 `/leaderboards/models` 全量（当前 91 款）。两者均随官方页面更新自动跟进，若页面结构变化会降级回退并标 degraded。
3. **DeepSeek / Moonshot / MiniMax / Zhipu 新闻适配**：HTML/Next.js RSC 解析（本机可达），补齐中文厂商动态；Anthropic 无 RSS → HTML 列表适配或放弃。
4. **数据质量增强**：news 真 diff（用上次快照对比“新增收录”标记）、模型 openWeights/license 用 HF 镜像补全、`meta.stats.orgs` 口径统一、榜单 delta（名次变化）用历史快照计算。
5. **限流与稳定性**：GitHub releases（transformers/vllm/ollama）作为 oss 动态源（CI token 下可行）；多源并发上限/退避参数化。
6. **README 素材**：数据源清单/降级说明/免责声明（见 §10，Lead 可直接整合）。

### 8.3 需 Lead 决策 / 集成的事项
| # | 事项 | 建议 |
|---|---|---|
| 1 | ~~CI workflow 增加 `fetch:ci` + `validate` 步骤~~ | ✅ **已集成并线上验证**（Actions success，18/19 源 ok） |
| 2 | ~~LMArena CI 路径无法本机验证~~ | ✅ **已线上验证**：LMArena 文本榜 100 条正常产出并渲染 |
| 3 | news kind 合约枚举无“产品/客户案例” | 当前粗分类映射到 `release`；若需精确区分，需 DATA-CONTRACT v1.1（Lead 裁决） |
| 4 | 榜单 id 集合扩展（9 个，含新增 livebench-2.0/epoch-*/opencompass-* 等） | 前端 tab 必须动态渲染 `rankings.boards`（勿硬编码 id）；`context-window`/`output-price` 保留原 id 兼容 |
| 5 | GitHub stars 刷新频率 | 每次 CI 运行 12 次 API，CI token 5000/h 充裕；本地开发建议 `--only=openrouter` 或加 `--no-github` 以避免限流（MVP 可加参数） |
| 6 | 个人项目 `chengxi-Z/llm-pulse` 尚未创建 | 仓库发布后 GitHub API 自动生效（当前 stars=null，前端需容错） |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解（已落地/计划） |
|---|---|---|
| 数据源改版（LiveBench bundle/AA flight 结构变化） | 榜单缺失 | 归一化失败即整源降级（不伪造）；POC 已验证结构并留快照；MVP 加 schema 变更告警（meta.note 带解析计数） |
| GFW/网络波动（本机被墙 5 个源） | 本地不能全量验证 | local/ci 双模式；CI 全量；hf-mirror 镜像；所有失败均降级不中断 |
| GitHub API 限流（60/h） | 项目 stars 停更 | 快照回退 + 优雅降级；CI 用 token 5000/h；MVP 加 `--no-github`/回退参数 |
| LMArena parquet 需第三方解析 | 本机无法直接读数据集 | CI 用 datasets-server JSON（纯 Node）；parquet 仅留证据，不引入 npm 依赖 |
| 源站 ToS/合规 | 法务风险 | 只聚合公开数据、标来源链接、不存全文；robots 允许的公开 API/CSV 优先；可申请移除说明写入 about 页 |
| 榜单口径差异（AA 精选集/派生榜） | 用户误解 | board.description 明确口径与“非质量排名”；前端展示 metric 说明 |
| RSS 内容质量/陈旧 | 动态噪音 | 120 天窗口、来源权重、去重、纯文本清洗、每源 8 条上限 |

---

## 10. 附录

### 10.1 README 可用素材（数据源与降级说明，Lead 可直接整合）

> **数据来源**：模型目录/价格来自 OpenRouter 公开 API；动态来自 OpenRouter 新模型 + OpenAI、Google DeepMind、Google AI、Qwen、AWS ML、MIT News AI、Berkeley BAIR 官方 RSS + DeepSeek 官方 Change Log；排行来自 LiveBench 2.0、Epoch AI、OpenCompass、Artificial Analysis 公开数据；真实话题热榜来自 Hacker News（Algolia）公开 API；学习资源与项目为人工整理并用 GitHub API 刷新 star 数。
> **更新机制**：GitHub Actions 每日定时（cron）+ 手动触发运行 `node scripts/fetch-data.mjs --mode=ci`，校验通过后部署 Pages；本机开发用 `--mode=local`。
> **降级说明**：站点对每个数据源展示状态（ok/degraded/blocked）。若某源不可达，页面显示空态与“数据源暂不可用”，绝不显示虚构数据；排行榜每个榜单标注来源与更新时间；上下文窗口榜/输出价格榜为 OpenRouter 目录派生指标，非模型质量排名。
> **口径**：价格 USD / 1M tokens；时间 UTC；分数均为来源官方口径（LiveBench Overall 为官方权重复算）。

### 10.2 常用命令

```bash
node scripts/fetch-data.mjs --mode=local                 # 本机可达源
node scripts/fetch-data.mjs --mode=local --only=openrouter,livebench   # 只跑部分源（GitHub 限流时用）
node scripts/fetch-data.mjs --mode=local --skip=github   # 跳过指定源（本地省 GitHub 配额）
node scripts/fetch-data.mjs --mode=ci                    # CI 全量（HF 官方 + LMArena）
node scripts/fetch-data.mjs --mode=local --from-snapshot --now=2026-11-03T12:00:00.000Z  # 离线确定性重放
node scripts/fetch-data.mjs --mode=local --check-links   # 附带外链抽检
node scripts/validate.mjs                                # 合约校验
node --test tests/                                       # 数据/助手等全部测试
node scripts/fetch/check-links.mjs                       # 仅外链抽检
```

### 10.3 证据与快照清单（`data/snapshot/`）
- `openrouter-models.json`（805KB 原始响应）、`livebench-table.csv`/`livebench-categories.json`、`epoch-benchmark-data.zip` + 抽取 CSV（eci/swe/gpqa）、`opencompass-arena-{text,mm}.json`、`artificialanalysis-home.html`、`rss-*.xml`、`github-repos.json`、`hf-mirror-models.json`；
- `hn-ai-search.json`（HN Algolia 近 7 天搜索原始响应）、`hn-ai-items.json`（Top10 故事的讨论摘要聚合快照，离线重放用）；
- `link-check.json`（外链抽检）、`_validate.log`、`_fetch-local.log`、`_checklinks.log`、`_validate-strict.log`、`_fetch-hn.log`；
- `probe/`：`report.json` + `matrix.md` + 35 个原始响应样本 + `probe*.log` + `report-feeds.json` + `poc parquet` 证据 + `hn-search.json`/`hn-item-<id>.json`。

---

## 11. v1.4 追加：真实 AI 话题热榜（Hacker News，§B4）

**目标**：仪表盘「AI 话题热榜」从关键词统计升级为**真实热搜话题 + 讨论摘要**（用户要求，v1.4 契约 §B4）。

**数据源**：Hacker News Algolia 公开 API（无需 key、公开数据、ToS 友好）
- 搜索：`GET https://hn.algolia.com/api/v1/search?query=AI&tags=story&numericFilters=created_at_i>{now-7d},points>30&hitsPerPage=30`
- 讨论：`GET https://hn.algolia.com/api/v1/items/{objectID}` → story item tree。
- 本机实测：搜索 HTTP 200 ~745ms / 30 hits；item tree ~1.7s / 70 top-level comments（2026-11-03 证据存 `data/snapshot/probe/`）。

**处理规则**（`normalizeHnTopics` / `extractHnDiscussionSummary`，均在 `scripts/normalize.mjs`）
1. 服务端已按 7 天窗口 + points>30 预筛；本地再做 **AI 相关性过滤**（标题/URL 关键词白名单，排除 HN 上的非 AI 热门）与 `points≥30` 兜底；
2. 按 `points` 降序、`id` 升序稳定排序，取 **Top 10**；
3. 讨论摘要：优先取**首条有实质文本的顶层评论**（HN 排序即热度序；若评论带数字 points 则取前 5 条中最高分），HTML 去标签/解实体/压缩空白 → **≤160 字纯文本**；拿不到则回退「Hacker News 讨论：标题（N points，M 条评论）」，绝不伪造评论内容；
4. 字段：`id=hn-<objectID>`、`title`、`url`（原文，可空→前端回退 `hnUrl`）、`hnUrl`、`domain`、`points`、`comments`、`publishedAt`(ISO)、`summary`、`source="Hacker News"`、`tags`（AI + 厂商/技术/政策等提示标签）。

**降级与可重复**
- 原始搜索响应存 `data/snapshot/hn-ai-search.json`、摘要聚合存 `data/snapshot/hn-ai-items.json`；实时失败自动回退快照并标 `degraded`；若连快照都没有（首次运行），保留仓库中上一次的 `data/topics.json`，否则输出空数组 + meta `blocked`（前端空态），**不伪造**；
- `--from-snapshot --now=<固定>` 两次运行 7 个 data 文件字节级一致（含 topics）。

**实测产出（2026-11-04 local 实跑）**：`hn-ai` status=**ok**，`30 hits → Top 10 topics`，10/10 带真实讨论摘要（points 680→266 / comments 501→174；来源域 newsletter.signoz.io、brangus.io、nolanlawson.com、businessinsider.com、bbc.co.uk 等）；`node scripts/validate.mjs --strict` → **0 error / 0 warning**（topics 10 条 ✓）；数据侧测试 **35/35** 通过（全团队 90/94，4 个失败为 site 侧待修 security 用例，见 §12）。

**安全注意（配合 §A）**：HN 标题/评论属不可信外部数据 → 归一化端已强制去标签/解实体/限长，前端必须 `textContent`/`esc()` 渲染并给外链 `rel="noopener noreferrer"`。

---

## 12. v1.4 安全修复（P0 插队，security-auditor 发现 M2/M3/M4）

> 来源：`docs/V1.4-CONTRACT.md` §A（安全第一优先级）；审计发现随数据管线交付修复并附回归测试。

| # | 修复 | 实现（文件） | 回归测试 |
|---|---|---|---|
| **M2** | fetch 无响应体大小上限（内存耗尽/DoS） | `scripts/fetch/http.mjs`：新增 `MAX_RESPONSE_BYTES = 5MB`；`contentLengthExceeds()` 纯函数预检 `content-length`；`readBodyLimited()` 用 `res.body.getReader()` 流式累计，超限即取消流并抛**非重试** `HttpError`；`httpRequest/ctx.get` 支持 `maxBytes` 透传。超限被采集器捕获 → 走快照回退/`degraded`，**不崩溃、不写假数据** | `tests/data-http.test.mjs`（4 个，loopback server）：声明超限提前拒绝、流式超限拒绝、正常大小通过、纯函数边界 |
| **M3** | `String.fromCodePoint` 对越界数字实体抛 RangeError（恶意 RSS 可致崩溃） | `scripts/normalize.mjs::decodeEntities()`：转换前校验 `Number.isInteger(code) && 0 < code ≤ 0x10FFFF` **且非 surrogate（0xD800–0xDFFF）**；非法实体原样保留（不抛异常）。同函数被 `plainText()` 用于全部来源 title/summary 清洗 | `tests/data-normalize.test.mjs`：`&#1114112;`/`&#x110000;`/`&#xD800;`/`&#55296;`/`&#0;`/超大数值均不抛且原样保留；合法实体正常解码 |
| **M4** | `data/news.json` 有 3 条 BAIR `http://` 外链 | `scripts/normalize.mjs`：新增 `upgradeExternalUrl()`（纯函数、无网络 IO）——仅当「与 HTTPS feed 同 host（同源证据）」或「host 在 `HTTPS_KNOWN_HOSTS` 白名单」时 http→https；无法确认则保留并在 `assembleData()` 汇总为 `meta.linkWarnings`（不盲改）。RSS 归一化时先用 feedUrl 同源升级；`assembleData()` 对 models/news/rankings/resources/projects/topics 全部 URL 字段做最终卫生处理 | `tests/data-normalize.test.mjs`：同源/白名单升级、未知 host 保留、RSS 同源升级、assembled `meta.linkWarnings`；`tests/data-contract.test.mjs`：全量数据外链 scheme 审计（未声明的 `http://` = 失败） |

**修复后实测（2026-11-04 local）**
- `data/*.json` 全量外链审计：**`http://` 外链 = 0**（models/news/rankings/resources/projects/topics/meta.sources 全部字段），`meta.linkWarnings` 为空；
- 重建 feed 内存验证（`buildRss/buildJsonFeed`，不写 site 文件）：feed.json **0** 条 http 链接；feed.xml 唯一 `http://` 是 RSS 命名空间 `xmlns:atom="http://www.w3.org/2005/Atom"`（标准命名空间 URI，非可点击外链），全部新闻/站点链接均为 https；
- `node scripts/validate.mjs --strict` → **0 error / 0 warning**；数据侧测试 **35/35** 通过（含新增 M2/M3/M4 用例）；`check-comments --strict` → 0 中文注释（新增代码注释全英文）；
- `node scripts/security-check.mjs --strict`：数据/管线无命中；当前 18 个 error 全部为 site 页 CSP/referrer meta 缺失（Lead 按 §A2 统一添加中，非本模块）。
- HN 快照隐私收敛：`data/snapshot/hn-ai-items.json` 仅存清洗后摘要 + commentId（**不含评论者用户名/PII**）；探测证据 `probe/hn-item-shape-*.json` 仅保留计数。
