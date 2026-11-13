# Skills 模块（我的技能 / My Skills）— 说明与内容素材

> 版本：v1.2 ｜ 日期：2026-11-03 ｜ 负责人：skill-author
> 关联契约：[V1.2-CONTRACT.md](V1.2-CONTRACT.md) §3.2 / §3.4 / §4 ｜ 数据结构：[DATA-CONTRACT.md](DATA-CONTRACT.md) §6.1
> 数据：[`data/skills.json`](../data/skills.json) ｜ 页面：[`site/skills.html`](../site/skills.html) ｜ 渲染：[`site/assets/js/skills.js`](../site/assets/js/skills.js)
> 本文同时是站点文案（中/英）与使用引导的**内容素材来源**：site-mvp/i18n-en 可直接取用或改写；数据字段双语约定见 §8。

---

## 1. 模块定位（What & Why）

「我的技能」是一个**真实可用的 Agent Skills 索引**，不是技能市场后端：

- 收录 3 类来源：`mine`（本项目产出）、`official`（模型/平台官方仓库）、`community`（真实公开社区仓库/合集）；
- 每张卡片：名称、作者、一句话描述、分类/标签、来源徽标、stars、许可证、更新时间、源码链接、「使用引导」「分享」；
- 使用引导 modal：一句话价值、适合/不适合、安装命令（可复制）、使用步骤、自检命令、源码链接、分享；
- 提交入口三条路径：GitHub Issue 表单、下载 JSON 模板、Fork & PR（**本站无后端**，审核后由维护者合入 `data/skills.json`）。

与项目的关系：本项目把自己的 `one-sentence-project` 作为 `mine` 条目开源出来，同时索引官方与社区的优秀技能；第三方技能**只索引、不托管**，版权与许可证归原作者。

**站点文案素材（zh/en）**

| 位置 | 中文 | English |
| --- | --- | --- |
| Hero 标题 | 我的技能 | My Skills |
| Hero 一句话 | 收录真实可用、可安装的 Agent Skills：官方的、社区的，还有本项目的一句话交付技能。 | A curated index of real, installable Agent Skills: official, community, and the one-sentence-project skill built for this site. |
| 列表说明 | 按来源与分类筛选；每条都有安装命令与使用引导。 | Filter by source and category; every entry ships with an install command and a usage guide. |
| 提交区标题 | 提交你的技能 | Submit your skill |
| 提交区说明 | 本站无后端：通过 GitHub Issue 或 Pull Request 提交，维护者审核后合入并上线。 | No backend here: submit via GitHub Issue or Pull Request; after review the entry is added to `data/skills.json` and goes live. |

---

## 2. 什么是 Agent Skill（What is an Agent Skill）

Agent Skill 是一个**轻量、开放的扩展格式**：一个文件夹 + 一份 `SKILL.md`，给 Agent 增加专门的知识与工作流。它不要求服务端、不绑定某个模型；Agent 根据 `description` 判断何时加载，正文提供步骤、约束与质量门。

最小结构：

```
my-skill/
├─ SKILL.md            # 必需：YAML frontmatter(name, description) + 正文工作流
├─ references/         # 可选：模板、规范、清单
├─ scripts/            # 可选：可执行脚本（Node/Python 等）
└─ examples/           # 可选：示例提示词与交付物
```

`SKILL.md` 最小示例：

```markdown
---
name: my-skill
description: Use when the user needs ... ; not for ...
---

# My Skill
## When to use / When not to use
## Input contract
## Workflow
## Quality gates
```

与本项目的区别：Prompt 是单轮指令；Agent 是带工具与记忆的执行者；MCP 提供工具/资源连接；**Skill 是给 Agent 的「操作方法包」**，可版本化、可复用、可索引。

---

## 3. 安装与使用（Install）

### 3.1 目录（按你的 Agent 选择其一）

| Agent / 环境 | 推荐目录 | 说明 |
| --- | --- | --- |
| WorkBuddy（本项目） | `.workbuddy/skills/<skill-name>/` | **项目级技能**，打开本工作区即自动加载；仓库内已放置 `one-sentence-project` 副本 |
| DeepSeek Harness / DSH | `~/.dsh/skills/<skill-name>/` | 目录名建议与 frontmatter `name` 一致 |
| Claude Code 等 | `~/.claude/skills/<skill-name>/` | 个人级技能；项目级可用 `.claude/skills/` |
| 通用 Agent skills 目录 | `~/.agents/skills/` 或产品文档指定目录 | 保持 `SKILL.md` 在技能目录根部 |
| 仅阅读/引用 | 任意位置 | 指向 `SKILL.md` 让 Agent 按流程执行 |

本项目采用「双份共存」约定：`skills/` 是对外发布的技能包（`data/skills.json` 索引与文档均指向它），`.workbuddy/skills/` 是 WorkBuddy 项目级加载副本；改动技能内容时两处需同步，勿删除发布包。

### 3.2 命令（Windows PowerShell / macOS-Linux）

```powershell
# Windows：从本仓库安装 one-sentence-project
New-Item -ItemType Directory -Force "$env:USERPROFILE\.dsh\skills" | Out-Null
Copy-Item -Recurse -Force skills/one-sentence-project "$env:USERPROFILE\.dsh\skills\one-sentence-project"
```

```bash
# macOS / Linux：从本仓库安装 one-sentence-project
mkdir -p ~/.dsh/skills
cp -r skills/one-sentence-project ~/.dsh/skills/one-sentence-project

# 安装社区/官方合集里的单个技能（示例：Anthropic skills 的 docx）
git clone --depth 1 https://github.com/anthropics/skills.git /tmp/anthropic-skills
cp -r /tmp/anthropic-skills/skills/docx ~/.dsh/skills/docx
```

### 3.3 验证与触发

1. 确认 `<skills-dir>/<skill-name>/SKILL.md` 存在；
2. 重新加载 Agent（或重启会话），让它重新扫描技能目录；
3. 用自然语言描述任务即可触发，无需点名：

| 场景 | 触发示例（zh） | 触发示例（en） |
| --- | --- | --- |
| 一句话交付项目 | 「持续追踪某个领域的最新进展，做成一个能自动更新的公网站点并发布」 | "Track a field's public updates and ship an auto-refreshing public site." |
| 文档技能 | 「把这份资料整理成带目录的 Word 文档」 | "Turn these notes into a Word document with a table of contents." |
| 营销技能 | 「给这个落地页做一次转化率优化建议」 | "Audit this landing page and propose CRO improvements." |

### 3.4 更新与卸载

- 更新：重新克隆/复制覆盖同名目录，保留 `SKILL.md`；先看上游 CHANGELOG 或 diff。
- 卸载：删除 `<skills-dir>/<skill-name>/` 后重载 Agent。
- 本项目技能自检：`node skills/one-sentence-project/scripts/check-project.mjs --self`。

---

## 4. 提交与审核（Submit & Review）

### 4.1 三条提交路径

1. **GitHub Issue 表单**（推荐）：打开 `https://github.com/chengxi-Z/llm-pulse/issues/new?template=skill-submission.yml`，填写字段；维护者审核后合入。
2. **下载 JSON 模板**：在 `skills.html` 提交区填写名称/作者/分类/一句话/链接/许可证，客户端生成 `skill.json`，作为 PR 的数据文件参考。
3. **Fork & PR**：Fork 仓库 → 按 `data/skills.json` schema 添加条目 → 提交 PR → 等待审核。

Issue 表单字段与数据字段映射见 `.github/ISSUE_TEMPLATE/skill-submission.yml`；完整 schema 见 `docs/DATA-CONTRACT.md` §6.1。

### 4.2 审核标准（必须全过）

| # | 标准 | 检查方式 |
| --- | --- | --- |
| 1 | 真实可用：有可访问的源码/文档链接，且确实是 Agent Skill 或技能合集 | 打开链接 / GitHub API 存在性检查 |
| 2 | 许可证明确（MIT / Apache-2.0 等）；无许可证的仓库只做索引并标注 | 读仓库 LICENSE；`license` 字段如实填写 |
| 3 | 无恶意内容：不含窃取密钥、外传数据、破坏性脚本 | 人工阅读 `SKILL.md` 与 scripts；可疑即拒 |
| 4 | 含使用引导：适合 / 不适合 / 安装命令 / 使用步骤 | 对照字段检查 |
| 5 | 双语字段齐全（en 为主 + `Zh` 后缀；缺失可回退） | schema 校验 |
| 6 | 链接可用、`stars` 数字或 null、`updatedAt` 为 ISO 时间 | `node scripts/validate.mjs` |
| 7 | 不与已有条目重复；分类/标签合理 | 人工检查 |

**不接受**：恶意或混淆代码、侵权/无授权内容、纯广告或空壳仓库、无法访问的链接、要求上传密钥才能「试用」的技能、伪造 stars/许可证。

### 4.3 维护者合入流程

1. 审核 Issue/PR（按 §4.2）；
2. 更新 `data/skills.json`（`count` 与数组一致；`source` 保持 `curated+github`）；
3. `node scripts/validate.mjs` → 0 error；
4. 本地 `node scripts/serve.mjs` 打开 `skills.html` 抽验卡片/引导/深链；
5. 合入后由部署 workflow 上线；在 Issue 中回复处理结果。

---

## 5. 许可证与安全（License & Security）

- **只索引、不托管**：第三方技能内容与代码在各自仓库，本站只存元数据与链接；转载/再分发前必须遵守上游许可证。
- **无许可证 ≠ 可随意复制**：本索引中 `anthropics/skills`、`openai/skills`、`vercel-labs/agent-skills` 等仓库未声明许可证，条目 `license` 为 `null`，只做索引与链接，不复制其内容。
- **安装前审查**：打开 `SKILL.md` 与 `scripts/` 阅读；不运行来源不明或要求联网上传的脚本；优先官方/高信誉来源。
- **权限最小化**：技能目录只授予必要权限；不要在技能文件里硬编码密钥或 token。
- **密钥安全**：本站 AI 助手为 BYOK，密钥只存浏览器 `localStorage`，不上传；提交技能时**绝不要**附带 API key、cookie、内部地址。
- **举报**：发现恶意/侵权条目，通过 Issue 模板（在描述中注明 "report"）或仓库 Issues 联系维护者，核实后下架。
- **免责声明**：技能由第三方作者维护，本站不对其行为与结果负责；请自行评估风险。

---

## 6. 分享（Share）

- 每条技能有「分享」按钮：生成 `kind=skill` 品牌分享卡（技能名 + 一句话 + 安装目标 + 站点/GitHub 地址），并支持复制文案。
- 深链：`https://chengxi-z.github.io/llm-pulse/skills.html#<id>`（例：`#superpowers`），可直接发给同事/群。
- 分享文案模板：

```text
中文：
【Agent Skill 推荐】<技能名> — <一句话价值>
安装：<install.command>
站点：https://chengxi-z.github.io/llm-pulse/skills.html#<id>

English:
[Agent Skill] <name> — <one-line value>
Install: <install.command>
Site: https://chengxi-z.github.io/llm-pulse/skills.html#<id>
```

- 分发渠道与节奏（GitHub topics / Release、RSS、X、即刻、知乎、V2EX、HN、Reddit、微信群/飞书）见 [DISTRIBUTION.md](DISTRIBUTION.md)（ai-share 维护）。

---

## 7. 当前条目（11 条，2026-11-03 核实）

| # | id | 名称 | 来源 | 作者 | GitHub stars | 许可证 | 代表性 SKILL.md |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `one-sentence-project` | One-Sentence Project | mine | chengxi-Z | — | MIT | `skills/one-sentence-project/SKILL.md` |
| 2 | `anthropic-skills` | Anthropic Agent Skills | official | Anthropic | 187,008 | 未声明 | `skills/skill-creator/SKILL.md` |
| 3 | `openai-skills` | OpenAI Skills Catalog | official | OpenAI | 28,489 | 未声明 | `skills/.curated/chatgpt-apps/SKILL.md` |
| 4 | `vercel-agent-skills` | Vercel Agent Skills | official | Vercel Labs | 33,468 | 未声明 | `skills/react-best-practices/SKILL.md` |
| 5 | `github-awesome-copilot` | GitHub Awesome Copilot | official | GitHub | 40,754 | MIT | `skills/acquire-codebase-knowledge/SKILL.md` |
| 6 | `microsoft-skills` | Microsoft Skills | official | Microsoft | 3,171 | MIT | `.github/plugins/azure-advisor/skills/azure-advisor/SKILL.md` |
| 7 | `superpowers` | Superpowers | community | obra | 311,646 | MIT | `skills/brainstorming/SKILL.md` |
| 8 | `marketingskills` | Marketing Skills | community | Corey Haines | 58,240 | MIT | `skills/ai-seo/SKILL.md` |
| 9 | `voltagent-awesome-agent-skills` | Awesome Agent Skills (VoltAgent) | community | VoltAgent | 36,799 | MIT | `README.md` |
| 10 | `heilcheng-awesome-agent-skills` | Awesome Agent Skills (heilcheng) | community | heilcheng | 6,340 | MIT | `README.md` |
| 11 | `wshobson-agents` | Agentic Plugin Marketplace | community | wshobson | 42,146 | MIT | `plugins/agent-teams/skills/team-composition-patterns/SKILL.md` |

**核实方法（2026-11-03，本机 Node fetch）**

- 每个 `repo` 通过 GitHub API `GET /repos/{owner}/{repo}` 核实存在，取 `stargazers_count` / `pushed_at` / `license.spdx_id`（`stars`、`updatedAt`、`license` 均来自该响应，未手工编造）；
- 每个代表性 `skillPath` 通过 GitHub API `GET /repos/{owner}/{repo}/contents/{path}` 核实存在（11/11 返回 200）；
- 本机网络限制：`github.com` 页面直连超时（与 v1.0 POC 记录一致），`api.github.com` 可用；链接可访问性以 API 200 为准，CI/线上网络不受此限；
- 刷新方式：`node scripts/check-links`（v1.2 可扩展）或按上表重新跑 GitHub API；`updatedAt` 取仓库最近 push 时间，`stars` 为快照值。

---

## 8. 数据字段与维护（Data）

字段定义以 [DATA-CONTRACT.md](DATA-CONTRACT.md) §6.1 为准，常用规则：

- 双语：`name` / `description` / `whenToUse` / `whenNotToUse` / `usageSteps` 为英文主字段，同名加 `Zh` 后缀为中文；前端按语言取，缺失回退另一语言。
- `count` 必须等于 `items.length`；`id` 唯一、kebab-case；`url` 必须 http(s)；`repo` 为 `owner/name`；`stars` 数字或 `null`；`updatedAt` ISO 8601。
- `install.target` 为安装目标目录，`install.command` 为一行的可复制命令；`usageSteps` 为 3 条以内的步骤数组。
- `sourceType`：`mine` | `official` | `community`；`category`：`methodology` | `data` | `writing` | `design` | `dev` | `research` | `other`；`lang`：`en` | `zh` | `multi`。
- 修改后必须：`node scripts/validate.mjs`（0 error），并抽验 `skills.html` 卡片/筛选/引导 modal/分享（CDP）。

---

## 9. 相关文件索引

| 文件 | 作用 |
| --- | --- |
| [`data/skills.json`](../data/skills.json) | 技能数据（11 条，schemaVersion 1） |
| [`site/skills.html`](../site/skills.html) | 技能页 markup（hero/筛选/卡片/引导 modal/提交/订阅） |
| [`site/assets/js/skills.js`](../site/assets/js/skills.js) | 渲染、筛选、搜索、引导 modal、JSON 模板下载、分享 |
| [`scripts/validate.mjs`](../scripts/validate.mjs) | skills 数据契约校验（§6.1） |
| [`.github/ISSUE_TEMPLATE/skill-submission.yml`](../.github/ISSUE_TEMPLATE/skill-submission.yml) | 技能提交 Issue Form |
| [`.github/ISSUE_TEMPLATE/config.yml`](../.github/ISSUE_TEMPLATE/config.yml) | Issue 模板入口链接 |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) § Skills | 贡献指南（由 i18n-en/Lead 合并） |
| [`docs/DISTRIBUTION.md`](DISTRIBUTION.md) | 分发 playbook（ai-share） |
