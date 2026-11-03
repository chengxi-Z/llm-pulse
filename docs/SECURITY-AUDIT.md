# AI Pulse v1.4 安全审计报告（独立审计）

> 审计人：`security-auditor`（独立第三方成员，只读审计；不直接修改 site/scripts/workflows）
> 审计对象：AI Pulse（公开项目 `chengxi-Z/llm-pulse`）v1.4.0，基线 v1.3.0 已上线
> 依据：`docs/V1.4-CONTRACT.md` §A（安全与隐私，P0）、`docs/SPEC.md`、`docs/DATA-CONTRACT.md`
> 审计日期：2026-11-04 ｜ 报告状态：**最终（复测完成）** — 快照 3：2026-11-04 00:55 工作树（CSP 已注入、数据已重建、各修复已落地）
> 关联工件：`SECURITY.md`、`scripts/security-check.mjs`、`tests/security.test.mjs`、`.github/workflows/codeql.yml`、`.github/dependabot.yml`

---

## 0. 结论摘要

| 项目 | 结果 |
|---|---|
| Critical | **0** |
| High | **5**（H-01…H-05 全部**已修复**，复测 PASS） |
| Medium | **6**（M-01…M-06 全部**已修复**，复测 PASS） |
| Low | **5**（L-01 部分修复、L-02 已修复；L-03/L-04/L-05 文档化接受） |
| 直接可利用的存储型 XSS | **未发现**（外部数据 100% 经 `esc()`/`textContent`；`safeMarkdown` 先转义后渲染） |
| 个人敏感数据（PII）/真实凭据 | **未发现**（个人邮箱/本机用户名/真实 token/私钥/内网 IP 全 0；仅公共厂商客服邮箱与占位符） |
| 最终复测（快照 3） | `security-check --strict` **PASS 0 ERROR**（1 WARN：本地 node_modules，发布前删除）；`--self-test` 9/9；security tests 9/9；全量单测 94/94；`validate --strict` 0 error/0 warning；CSP+referrer 9/9；站点第三方/分析/cookie 0 命中；data 非法 scheme 0、`http://` 0 |
| 发布门禁 | 安全侧 PASS；剩余发布动作：历史重建执行（残余风险见 §5.1）、Lead 浏览器复测、发布前删除本地 `node_modules` |

**总体评价**：项目安全基线良好（零依赖、无第三方脚本/分析/cookie、无 `eval`/`document.write`、BYOK 密钥仅本地且不写日志、外链 `rel=noopener` 全覆盖、URL scheme 白名单已前置）。审计发现的 5 项 High 与 6 项 Medium 已全部修复并通过复测；**唯一需项目所有者决策的不可逆事项是历史重建的残余风险**（§5.1），无阻断发布的设计级安全缺陷。

---

## 1. 审计范围与方法

### 1.1 审计对象

| 范围 | 文件/资产 | 本次覆盖 |
|---|---|---|
| 静态站前端 | `site/*.html`（9 页）、`site/assets/js/**`（11 个 ESM 模块，约 335KB）、`site/assets/css/**`、`site/assets/i18n/**` | 全量人工复核 + 自动化扫描 |
| BYOK AI 助手 | `assistant.js`、`assistant-core.js`（纯函数）、设置面板/分享/CSP 交互 | 全量人工复核 + 31 组恶意向量验证 |
| 数据管线 | `scripts/fetch-data.mjs`、`scripts/fetch/*`、`scripts/normalize.mjs`、`scripts/build-feed.mjs`、`scripts/validate.mjs`、`scripts/stage-site.mjs`、`scripts/serve.mjs` | 数据信任边界、解析/清洗/大小/URL scheme 复核 |
| CI/CD 与供应链 | `.github/workflows/*.yml`、`.github/dependabot.yml`、`package.json`、`codeql.yml` | 权限、pin、secrets、触发器、依赖审计 |
| 仓库隐私 | 全仓 **128** 个文本文件（复测快照；排除 `data/snapshot/`、`_artifact/`、`_tmp/`、二进制） | PII/密钥扫描（文档/代码/数据/测试/截图引用） |
| 数据产物 | `data/*.json`（8 个，复测总 609,624 B）、`site/feed.json|xml`、`data/topics.json` | Schema 信任、URL scheme、体积、注入内容 |
| 分享卡/分享文案 | `share.js`、`assistant-core.js#buildShareText`、Canvas `fillText` | XSS 向量、URL 编码、Canvas 安全性 |

### 1.2 威胁模型（与契约 A1 对齐并逐项验证）

| 资产 | 主要威胁 | 要求的对策 | 审计验证方式 |
|---|---|---|---|
| 浏览者浏览器/数据 | XSS、第三方脚本、跟踪、恶意链接 | 外源数据转义渲染；CSP；无第三方脚本/字体/CDN；无分析/埋点；外链 `rel=noopener`；禁止 `javascript:` | 逐行复核所有 `innerHTML`/`insertAdjacentHTML` sink；31 组向量运行时验证；全站第三方资源扫描；`href` 提取与 scheme 检查 |
| 用户 API Key（BYOK） | 泄露、误上传、日志记录 | 仅 localStorage；不上传本站；不写日志/不注入 prompt；可清除；隐私说明 | 源码路径复核 + 纯函数验证（`normalizeConfig`/`chatCompletionsUrl`）+ 全局 `console`/`fetch`/`localStorage` 扫描 |
| 仓库/维护者本机 | PII 泄露、供应链攻击 | 仓库 PII 清理；Actions 固定 commit SHA；最小权限；SECURITY.md；Dependabot/CodeQL | 全仓 PII/secret 正则扫描；GitHub API 核验 action SHA；workflow 权限矩阵人工审计 |
| 数据源内容 | 恶意/畸形内容注入（RSS/HTML/JSON） | 采集端去标签/转义；前端 `esc()`/`textContent`；长度/大小限制；URL scheme 白名单 | 管线解析函数复核；畸形输入/超大响应/畸形实体/非法 URL 测试；数据产物扫描 |
| 分享/传播 | 卡片/链接伪造、隐私泄露 | 卡片不含个人数据；分享 URL 仅站内；OG 无用户数据 | 分享卡渲染代码复核（Canvas 文本 API、无 HTML 解析）；分享文案纯文本验证 |

### 1.3 审计方法（4 层）

1. **人工代码复核**：逐行审查 `render.js`、`skills.js`、`dashboard.js`（含 v1.4 新增 HN 热榜/散点/轮播）、`compare.js`、`share.js`、`app.js`、`data.js`、`i18n.js`、`assistant.js`、`assistant-core.js` 的全部 HTML sink、事件委托、URL 参数读取、storage 读写、`fetch` 目标与错误路径；逐行审查全部 workflows 与数据管线关键函数。
2. **自动化静态扫描**：
   - 交付脚本 `scripts/security-check.mjs`（PII/secrets/危险 API/外链 rel/CSP/referrer/Actions pin/数据体积/.gitignore），`--strict` 与 `--self-test`；
   - 本次审计额外一次性脚本：全仓 128 文本文件 PII/secret 扫描（复测快照）；站点第三方资源/分析/cookie/iframe 扫描；`data/*.json` URL scheme 与体积扫描；`innerHTML` 模板插值启发式扫描（含 v1.4 新增模块）。
3. **纯函数运行时验证**：用 Node import `assistant-core.js`/`share.js` 直接跑 31 组 XSS/URL scheme/配置校验向量（结果见附录 C）。
4. **供应链与配置核验**：对 6 个 action 的 `owner/repo@SHA` 调 GitHub API 反查 tag→commit SHA 是否一致；workflow 权限、触发器、secrets 流向人工审计；`package.json` 运行时依赖清点。

### 1.4 审计限制（不覆盖项）

- 本次审计环境**不启动浏览器/CDP**：CSP 的实际浏览器执行效果、真实 DOM 注入、移动端 WebView 未做真机验证（由 Lead 的浏览器验收补足）。
- 工作副本**不含 `.git`**：历史提交中的具体 PII 无法在本次枚举；§5.1 基于 Lead 提供的背景做风险评估，并给出重建前必须执行的检查命令。
- 站点在审计期间由多名成员并行修改（`render.js`/`dashboard.js`/`assistant*.js` 持续变更）：**行号为快照值**，定位以「文件 + 函数/锚点」为准；最终复测以修复完成后的固定快照为准。
- 未做渗透测试/模糊测试（fuzzing）、依赖 CVE 扫描（零依赖，无此面）、第三方数据源自身的可信度审计。

---

## 2. 发现统计

| 严重级别 | 定义 | 数量 | 已修复（复测 PASS） | 修复中 | 接受残余/文档化 |
|---|---|---|---|---|---|
| Critical | 可直接利用，无需额外条件 | 0 | — | — | — |
| High | 契约强制控制缺失/可造成用户实质损失 | 5 | **5**（H-01、H-02、H-03、H-04、H-05） | 0 | — |
| Medium | 纵深防御缺口/可用性或数据卫生问题 | 6 | **6**（M-01…M-06） | 0 | — |
| Low | 加固建议/文档卫生 | 5 | 1（L-02）；L-01 部分修复 | 0 | 3（L-03/L-04/L-05，文档化接受） |

> 状态含义：**已修复** = 代码/配置已改且复测通过；**部分** = 部分路径已改；**修复中** = 已确认修复方案、正在落地；**接受** = 不修改，记录残余风险。

---

## 3. 发现详情

### 3.1 High

#### H-01 全站缺少 CSP 与 referrer meta（契约 A2.2）
- **位置**：`site/index.html`、`news.html`、`rankings.html`、`models.html`、`resources.html`、`projects.html`、`about.html`、`skills.html`、`404.html`（9 页）`<head>` 均无 `<meta http-equiv="Content-Security-Policy">`、无 `<meta name="referrer">`；`<meta charset>` 位于各页 :4，可在其后插入。
- **证据**：`security-check.mjs` 基线报告 18 ERROR（9 页 × CSP+referrer）；逐页 regex 检查确认。
- **影响**：XSS 纵深防御缺失；外链与子资源无策略约束；referrer 泄露（当前页面无用户数据，故实际敏感度低，但契约 P0 要求）。
- **修复建议**：按契约 A2.2 注入统一 meta CSP，并在 `connect-src` 中加入 `http://127.0.0.1:* http://localhost:*` 以保持文档宣传的本地 Ollama 兼容（已与 Lead 确认）；同时注入 `referrer: no-referrer`、保留 `robots`。注意 **meta CSP 不支持 `frame-ancestors`**（写入无效，见 §5.2）。
- **状态**：**已修复（复测 PASS）**：9 页均注入 meta CSP + `<meta name="referrer" content="no-referrer">`（`<meta charset>` 后，各页 head）；CSP 263–265 字符、含契约要求全部指令，`connect-src` 含 `http://127.0.0.1:* http://localhost:*`（Ollama 兼容）。
- **验收（复测证据）**：逐页解析 CSP → `default-src 'self'`/`script-src`/`style-src`/`img-src 'self' data:`/`font-src 'self'`/`connect-src`/`object-src 'none'`/`base-uri 'none'`/`form-action 'none'`/`frame-src 'none'` 全部存在（9/9 PASS）；`security-check` `[csp]`/`[referrer]` **0 命中**。

#### H-02 数据驱动的 `href` 缺少 URL scheme 白名单（契约 A2.3）
- **位置（快照 1）**：`render.js` news 链接（`const link = item.url || item.sourceUrl` → `href="${esc(link)}"`，:854/:873）、模型外链 :470/:488、榜单 sourceUrl :523/:1119、资源 :1576、项目 :1802/:1824；`skills.js:80-83→150`、`:314`（skills.json 可由 GitHub Issue/PR 提交）；B4 新增 HN 热榜渲染（`dashboard.js` topics，已修）；根因在管线 `scripts/normalize.mjs#parseRssItems`（RSS `<link>` 无 scheme 校验）与 `normalizeRssNews`。
- **证据**：RSS 链接直接进入 `data/news.json` 并被前端用于 `href`；`esc()` 只防属性逃逸、不校验 scheme；运行时验证 `buildContext` 接受 `javascript:` URL 并写入 LLM 上下文、`normalizeSharePayload` 保留任意 scheme（附录 C）。
- **影响**：若某 RSS 源被篡改/被投毒，可注入 `javascript:`/`data:` 链接；需用户点击才可能触发（且失败路径多），**不构成直接 XSS**，但违反契约 A2.3「仅允许 http(s)」并形成钓鱼/脚本执行面。
- **修复建议（已实施方向）**：`data.js` 新增 `export function safeHttpUrl(value)`（仅 `^https?://`，`new URL` 复核 protocol，非法返回 `''`）；`render.js`/`skills.js`/`dashboard.js` 所有数据驱动 `href` 使用 `safeHref = safeHttpUrl`；内部相对链接（`news.html#…`/`skills.html#…`/`#`）不经过该函数；管线 `normalize.mjs` 对 RSS 链接做 `upgradeExternalUrl`（http→https 确定性升级）并保留 scheme 校验，生成端与消费端双重防护。
- **状态**：**已修复（复测 PASS）**：`data.js:89` `safeHttpUrl()`（仅 `^https?://` + `new URL` protocol 复核）；`render.js:23` `const safeHref = safeHttpUrl` 并覆盖全部数据驱动 `href`/分享 URL；`skills.js:81`、`dashboard.js:532` 同样处理；内部相对链接（`news.html#…`/`skills.html#…`/`#`）不经该函数；管线 `upgradeExternalUrl`（`normalize.mjs:139/:745/:1017`）双重防护。
- **验收（复测证据）**：全站 `href` 提取脚本对数据驱动 sink 非法 scheme **0 命中**；`safeHttpUrl` 运行时 9 组向量（`javascript:`/`data:`/`vbscript:`/`file:`/`//evil`/相对路径/空 → 拒绝；https/http 回环/HN → 接受）全 PASS。

#### H-03 GitHub Actions 权限过宽（deploy build job 继承 `pages:write`+`id-token:write`）
- **位置（快照 1）**：`.github/workflows/deploy.yml:11-14` 顶层 `pages: write`、`id-token: write` 被 `build` job（运行联网抓取不可信 RSS 的 `fetch-data.mjs`）继承；`deploy` job 才真正需要这两项。
- **影响**：若采集/构建链的任何一步被恶意输入影响，可滥用 OIDC token 或 Pages 写权限；违反最小权限。
- **修复（已落地）**：顶层仅 `contents: read`；`pages: write`/`id-token: write` 移至 `deploy` job（`deploy.yml:73-75`）；`build`/`deploy`/`refresh` 全部加 `timeout-minutes`（:21/:72，ci :15，refresh :19）；`ci`/`deploy` checkout 加 `persist-credentials: false`（`ci.yml:20`、`deploy.yml:26`），`refresh-data` 因需 push 保持默认。
- **状态**：**已修复（复测 PASS）**。复测复核 4 个 workflow：顶层权限 ci=`contents: read`、deploy=`contents: read`、refresh=`contents: write`、codeql=`contents: read`；`deploy` job 级 `pages: write`/`id-token: write`（:73-75）；`pull_request_target` 0；未 pin 的 `uses:` 0（全部 `@40hex`）；secrets 仅出现在 push/schedule 触发的 deploy/refresh。

#### H-04 `?ask=` 深链可用访问者 BYOK 密钥自动发起计费请求
- **位置（快照 1）**：`assistant.js:1033-1043`（`if (params.has('assistant') || ask) { openAssistant(); if (ask) askAssistant(ask); }`），且 `ask` 无长度限制。
- **影响**：攻击者构造 `?ask=…` 链接，访客点击即以其自身配置的 key 向自己的端点发送攻击者选定的 prompt → **费用滥用** + 固定化 prompt injection；无数据回传，但仍是用户安全/财产风险。
- **修复（已落地）**：`?ask=` 改为**仅预填输入框**（`setInput`），用户必须显式点击发送；新增 `sanitizeAskPrefill`（去控制字符、trim、`ASK_PREFILL_MAX` 截断）；注释明确该安全决策。
- **状态**：**已修复（复测 PASS）**：`?ask=` 改为仅**预填输入框**（`setInput(ask)`），用户必须显式点击发送；新增 `sanitizeAskPrefill`（去控制字符、trim、`ASK_PREFILL_MAX` 截断，`assistant.js:58`）。复测源码断言：boot 块内无 `askAssistant(` 调用、含 `setInput(ask)` 与限长逻辑 → PASS。

#### H-05 BYOK 允许明文 `http://` 端点（API Key 明文传输）
- **位置（快照 1）**：`assistant-core.js#normalizeConfig` 仅校验 `^https?://`；`http://` 公网端点会让 `Authorization: Bearer <key>` 明文过网。
- **影响**：用户按文档填 http 端点（或受钓鱼诱导）时 key 泄露；违反契约 A2.4/BYOK 安全预期。
- **修复（已落地）**：新增 `isLocalHostname`/endpoint 校验（`assistant-core.js:981-1020`）：**https 一律允许；http 仅允许 `localhost`/`127.0.0.1`/`::1` 回环**（本地 Ollama 场景），其余回退默认并给出双语警告（`warnHttpsOnly`）；`chatCompletionsUrl` 同步兜底。README/AI-SHARE 的本地 Ollama 示例保持可用。
- **状态**：**已修复（复测 PASS）**：`isLocalHostname`/endpoint 校验（`assistant-core.js:981-1020`）：**https 一律允许；http 仅允许 `localhost`/`127.0.0.1`/`::1` 回环**，其余回退默认并给出双语警告（`warnHttpsOnly`）；`chatCompletionsUrl` 同步兜底。复测向量：`normalizeConfig('http://evil.example.com/v1')` → 回退 `https://api.deepseek.com/v1` + 1 warning（PASS）；`normalizeConfig('http://127.0.0.1:11434/v1')` → 保留回环 http（PASS）；`javascript:`/`data:` → 回退默认（PASS）。

### 3.2 Medium

#### M-01 `?tag=` 深链无长度限制（契约 A2.7）
- **位置（快照 1）**：`render.js:794` 读取 `tag` 后仅做命中判断/回显。反射路径使用 `textContent` 与 `esc()`，**无 XSS**；但超长参数被反射进页面文本与筛选逻辑，属输入卫生问题。
- **修复（已落地）**：`render.js:795` `...get('tag') || '').slice(0, 100)`，并配合既有命中校验（未命中显示降级提示）。**状态**：**已修复（复测 PASS）**：源码断言存在 100 字符截断；超长 `tag` 不会进入 DOM 文本（`textContent`/`esc()` 路径）。

#### M-02 数据体积上限未在采集/校验两端落实（契约 A2.7）
- **位置（快照 1）**：`scripts/fetch/http.mjs` 全量 `arrayBuffer()` 无上限；`scripts/validate.mjs` 无 data 体积检查。
- **影响**：恶意/异常超大响应可拖垮 CI 内存或产出超大 JSON；契约要求的单文件 2MB/总 5MB 无强制。
- **修复（已落地）**：`http.mjs:26` `MAX_RESPONSE_BYTES = 5MB`，`readBodyLimited()` 同时检查 `Content-Length` 与流式累计（`http.mjs:35-64`），超限抛非重试 `HttpError`；`validate.mjs:280-289` 校验 data 单文件 2MB/总 5MB（`--strict` 生效）；poc-data 新增 `tests/data-http.test.mjs` 4 用例。**状态**：**已修复（复测 PASS）**：`validate --strict` 0 error/0 warning；data 总 609,624 B（8 文件均 <2MB）。
- **残余**：单文件 5MB 的下载上限与 data 2MB 上限之间留有冗余，但 JSON 序列化后仍受 validate 约束，可接受。

#### M-03 实体解码对越界码点抛 `RangeError`（不可信 RSS 可致源降级）
- **位置（快照 1）**：`scripts/normalize.mjs#decodeEntities` `String.fromCodePoint(code)` 未做范围/代理对校验，`&#x110000;` 等畸形实体抛 `RangeError`。
- **影响**：恶意/畸形 RSS 字段可使该源采集抛错并降级为快照（可用性问题，非泄露）。
- **修复（已落地）**：`normalize.mjs:102` `isValidCodePoint`（`>0 && <=0x10FFFF` 且排除 `0xD800-0xDFFF`），非法实体原样保留（随后被 `plainText` 清洗/前端转义）；poc-data 补充 `&#1114112;`/`&#x110000;`/`&#xD800;`/`&#0;` 测试。**状态**：**已修复（复测 PASS）**：全量单测 94/94 通过。

#### M-04 数据产物中的 `http://` 外链（BAIR 等）
- **位置（快照）**：`data/news.json:1636/:1654/:1672`（`http://bair.berkeley.edu/...`），并同步进入 `site/feed.json`。
- **影响**：http 外链可被中间人篡改，属内容完整性问题；契约要求 http:// 外链零命中。
- **修复（已落地，数据与 feed 均已重建）**：`normalize.mjs` 新增 `upgradeExternalUrl()`（已知 HTTPS 主机或页面本身为 https 时确定性升级，无网络 I/O，`:139`），RSS 新闻 URL 出口使用（`:745`），GitHub 链接等同样处理（`:1017`）；poc-data 重跑 `fetch-data` + `build-feed`。**状态**：**已修复（复测 PASS）**：`data/*.json` 与 `site/feed.json` 中 `http://` 外链 **0 命中**（`site/feed.xml` 仅 `xmlns:atom` 命名空间 URI，非可点击外链）。

#### M-05 `t()` 值未转义直接进入 `innerHTML`
- **位置（快照 1）**：`assistant.js:255-284`（设置面板）、`:306-310`（上下文面板）、`:616-620`（欢迎语）；`dashboard.js:222-229`（KPI label/hint）。
- **影响**：i18n 词典为同源受控静态文件，正常不可利用；但每次文案改动都成为潜在 HTML 注入面（PR 审查万一失守 → 存储型 XSS）。
- **修复（已落地）**：`assistant.js` 引入 `et(key, vars) = esc(t(key, vars))`（`:42`）并替换全部 `innerHTML` 模板插值；v1.4 新增的 `dashboard.js` 热榜/散点/图表渲染统一走 `esc()` + 字符串拼接，无裸插值；其余 `t()` 仅用于 `textContent`/属性。**状态**：**已修复（复测 PASS）**：全量单测 94/94、站点扫描 0 命中；§6.3 复核通过。
- **建议（v1.5）**：`innerHTML` sink 尽量改为 `textContent` + DOM 构建，从结构上消灭该风险类。

#### M-06 Workflow 缺少超时与 checkout 凭据加固
- **位置（快照 1）**：`.github/workflows/*.yml` 无 `timeout-minutes`；`ci`/`deploy` 的 checkout 默认将 `GITHUB_TOKEN` 持久化到 `.git/config`，后续处理不可信数据的步骤可读取。
- **修复（已落地）**：ci :15 / deploy :21、:72 / refresh :19 / codeql :25 全部 `timeout-minutes`；ci :20、deploy :26、codeql :33 `persist-credentials: false`。**状态**：**已修复（复测 PASS）**：4 个 workflow 静态复核通过（见 H-03 复测证据）。

### 3.3 Low

| ID | 位置 | 问题 | 处置/状态 |
|---|---|---|---|
| L-01 | `docs/AI-SHARE.md:341`（`_tmp` 开发目录引用）、`docs/RELEASE.md:31`（`_tmp/layout-audit.mjs`）、`docs/screenshots/share-menu.jpg`（`_tmp` 临时验证页截图） | 开发环境/临时目录描述与截图未完全通用化（契约 A2.6），非 PII | 部分修复：`AI-SHARE.md:339` 硬编码 Edge 路径已改 `$env:ProgramFiles(x86)`；其余建议在发布前改通用措辞/替换截图。**部分修复** |
| L-02 | 仓库根 `.gitignore` | 缺少凭据类文件忽略项 | 已修复：新增 `*.pem` `*.key` `*.p12` `*.secret` `credentials*.json` `.vscode/` `*.local` `*-lock.yaml` `pnpm-lock.yaml`；`.env`/`.env.*`/`node_modules/`/`_artifact/`/`_tmp/`/`data/snapshot/` 原有覆盖 |
| L-03 | `scripts/notify.mjs:62` | webhook 失败日志打印底层错误消息（当前不含 URL/token，防御性） | 建议改为固定文案，避免第三方报错体带出敏感参数。**未修复（可接受）** |
| L-04 | `scripts/serve.mjs:51-55、:65` | 本地预览服务器 `CORS: *`，支持 `--host 0.0.0.0`；仅开发用途，误用可能暴露工作区内容给局域网 | 接受（开发工具），建议 README 注明「勿在不可信网络、勿在公网暴露」。**接受残余** |
| L-05 | `scripts/fetch/probe*.mjs` | 开发期探测脚本随公开仓库分发（无凭据；仅访问固定公开 URL） | Info：建议标注 dev-only 或移至 `scripts/dev/`。**未修复（可接受）** |

### 3.4 仓库 PII / 秘密扫描结果（全仓 128 文件，复测快照）

排除 `data/snapshot/`、`_artifact/`、`_tmp/`、`node_modules/`、二进制（jpg/png/zip/parquet 等）。规则覆盖：Windows 本机用户路径、macOS `/Users/<name>`、本机工作区盘符路径、个人邮箱、`ghp_`/`github_pat_`/`sk-`/`AKIA`/`xox*-`/`AIza`/JWT/`BEGIN ... PRIVATE KEY`、`password=/secret=` 赋值、RFC1918 内网 IP、`$env:USERPROFILE` 等。

**最终结果：未发现个人邮箱、本机用户名、真实 token/私钥、内网 IP、真实 API Key。** 扫描命中仅 3 处，全部为**扫描器/测试文件内的故意检测样本**，且这些文件被 `scripts/security-check.mjs` 的 `SCAN_EXCLUDE`/`SCAN_EXCLUDE_PREFIX` 主动排除（`scripts/security-check.mjs` 与 `tests/security.test.mjs` 内的 self-test 假样本：用户目录路径样例、假 token 样例等，均为检测器自测数据）——**非仓库敏感数据**。另：
1. `docs/V1.4-CONTRACT.md:31` — `C:\Users\...`、`D:\...` 为**通用占位示例**（契约对扫描规则的描述本身），扫描器已将 `...`/`<`/`%` 视为占位符放行，无需修改。
2. `scripts/fixtures/deepseek-updates-sample.html:380` — 公共厂商客服邮箱（DeepSeek 官方站点的 api-service 邮箱，抓取样本，非个人信息）；已随 `scripts/fixtures/` 前缀纳入扫描排除，Info 级。

**凭据文件检查**：仓库内不存在 `.env*`、`*.pem`、`*.key`、`id_rsa`、`.credentials*`、`credentials*.json`、`auth.json`、`package-lock`/`pnpm-lock`（工作区临时出现过的 `pnpm-lock.yaml` 空壳已由 Lead 清理并加入 `.gitignore`）。**示例 key 均为占位**（`sk-`/`apiKey` 示例为 `your-api-key` 形式或空值）。**截图**抽查（`assistant-drawer.jpg`、`share-menu.jpg`）为页面内容截图，无浏览器个人数据/真实 key；`share-menu.jpg` 为 `_tmp` 临时页截图（见 L-01）。

> **历史提交中的 PII 无法在本工作副本核验（无 `.git`）**：处置与残余风险见 §5.1，需 Lead 在真实仓库执行检查并重建历史。

---

## 4. 已确认安全控制（正面证据）

### 4.1 XSS / HTML 注入
- 全部外部数据源（news/models/rankings/resources/projects/skills/topics/meta）在渲染前经 `escapeHtml()`（覆盖 `& < > " '`）或 `textContent`；`data-*` 属性值同样 `esc()`。
- v1.4 新增代码专项复核：`compare.js`（对比表/复选框全部 `esc()`，无 URL 渲染）、`dashboard.js#renderTopics`（HN 标题/摘要/domain 全部 `esc()`；URL 经 `safeHttpUrl` 白名单；`rel="noopener noreferrer"`）、`dashboard.js` 散点/轮播（SVG 数值与 i18n 文本，无数据插值）。
- `safeMarkdown()` 为 **转义优先** 渲染：先 `escapeHtml` 全量转义，再解析 Markdown-lite；链接正则仅接受 `https?://`，`<>`/引号已实体化，不存在属性逃逸；输入先剔除 `\u0000` 防止占位符注入。
- 无 `eval`、`new Function`、`document.write`、`document.cookie`、`iframe`；`innerHTML` 的其余使用均为静态 SVG 或已转义的构建片段。
- 运行时向量验证 **31 组全 PASS**（附录 C）：原始 HTML/script、`javascript:`/`data:` 链接、链接属性逃逸、代码围栏语言注入、NUL 占位符攻击、`safeHttpUrl` 拒绝/接受矩阵、分享文案纯文本、分享 intent URL 编码、BYOK baseURL 回退/回环例外、`?ask` 源码断言、CSP/referrer 全页存在等。

### 4.2 BYOK 密钥隐私
- 存储：仅 `localStorage['aipulse.assistant.config.v1']`，无 cookie、无上传；设置面板提供「清除密钥」；`getAssistantState()` 只暴露 `hasKey` 布尔值（不暴露明文）。
- 传输：`Authorization: Bearer` 仅发往用户配置的端点（`chatCompletionsUrl` 强制 http(s) 且 https-only/回环例外，H-05 已修）。
- 日志：全站唯一 `console.warn` 在 `render.js#reportRuntime`（仅错误标签/消息），**不记录 key/config**；错误提示包含端点 HTTP 状态与截断响应体（≤300 字符），经 `safeMarkdown` 转义渲染，不含密钥。
- 上下文：`buildContext()` 仅注入公开站点数据（≤6KB），不包含本机/用户信息；上下文预览面板让用户可见「将被发送的内容」。
- 会话：不持久化（刷新即清空）；`?ask=` 不再自动请求（H-04 已修）。

### 4.3 隐私（可验证声明）
- **无第三方请求**：全站扫描确认无外部 `<script>`、样式表、字体、图片、iframe、CDN；`fetch` 仅两类——同源 `./data/*.json`/`assets/i18n/*.json`，以及用户显式配置的 BYOK 端点。
- **无分析/埋点/像素/cookie/fingerprinting**：`google-analytics|gtag|plausible|umami|sentry|mixpanel|hotjar|segment|百度统计|cnzz` 与 `document.cookie` 全 0 命中。
- **无外链字体**（系统字体栈）；CSS 仅内嵌 data URI SVG 噪点纹理（含 `xmlns` 的 http 命名空间，非网络请求）。
- 分享卡/分享文案不含个人数据；分享 URL 使用站内/仓库固定地址；`navigator.share`/`window.open` 均带 `noopener,noreferrer`。

### 4.4 外链与 URL scheme
- 静态 HTML：9 页全部 `target="_blank"` 均带 `rel="noopener noreferrer"`（0 例外）。
- 动态生成：`shareButton()`/榜单/资源/项目/技能卡片等所有 `target="_blank"` 模板均带 `rel="noopener noreferrer"`；外部 URL 统一走 `safeHttpUrl`（v1.4 修复 H-02 后）。
- `window.open`：全部显式 `noopener,noreferrer` 或 features 字符串包含 `noopener`。
- URL 参数白名单：`?lang=` 仅 `zh|en`（`i18n.js` `SUPPORTED`）；`?theme=` 仅 `ivory|noir|jade|rose|graphite|auto`（含 legacy `dark/light` 映射，非法值忽略）；`?tag=` 命中数据后才生效且限长 100；`?ask=` 仅预填（H-04 已修）。

### 4.5 供应链与 CI/CD
- **零运行时依赖**：`package.json` 无 `dependencies`/`devDependencies`；CI 不执行 `npm/pnpm install`；无 lockfile 入库。
- **Actions 全部 pin 到 40 位 commit SHA**，并经 GitHub API 反查核验与注释版本一致：
  | Action | 注释版本 | commit SHA | API 核验 |
  |---|---|---|---|
  | actions/checkout | v4 | `11d5960a326750d5838078e36cf38b85af677262` | ✅ 一致 |
  | actions/setup-node | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | ✅ 一致 |
  | actions/configure-pages | v5 | `983d7736d9b0ae728b81ab479565c72886d7745b` | ✅ 一致 |
  | actions/upload-pages-artifact | v3 | `56afc609e74202658d3ffba0e8f6dda462b719fa` | ✅ 一致 |
  | actions/deploy-pages | v4 | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | ✅ 一致 |
  | github/codeql-action | v3 | `a3d1b77a1ba1550fbb5c74db1dc3a11f4a481126` | ✅ 一致（annotated tag 解引用） |
- **触发器安全**：全部 workflow 无 `pull_request_target`；`pull_request` 仅 `ci.yml` 且为只读 `contents: read`，不接触 secrets；部署/数据写回仅 push/schedule/workflow_dispatch。
- **权限最小化**：`ci.yml` 顶层 `contents: read`；`deploy.yml` 顶层仅 `contents: read`（pages/id-token 限 deploy job）；`refresh-data.yml` `contents: write`（唯一需要 push 的工作流）；`codeql.yml` 顶层 `contents: read` + job 级 `security-events: write`。
- **secrets**：仅在 `push`/`schedule` 触发的 `deploy.yml` 使用（通知渠道、`GITHUB_TOKEN`）；fork PR 无法访问；日志不回显 secret 值（`notify.mjs` 仅打印 HTTP 状态）。
- **SAST/依赖更新**：新增 `codeql.yml`（javascript-typescript，security-extended，push/PR/weekly，20min 超时）与 `dependabot.yml`（github-actions weekly，分组 PR，标签 `dependencies`/`security`）。

### 4.6 数据管线与不可信输入
- 所有 `JSON.parse` 均有 `try/catch`（`http.mjs#loadJson`、`parseSSEData`、`serve.mjs`、`validate.mjs`）；解析失败降级而非崩溃。
- RSS/HTML 文本进前端前经 `plainText()`：最多 3 轮「去标签 + 实体解码」、剔除零宽/方向控制字符、长度上限（summary 240/title 200）；前端再 `esc()`（双重防护）。
- 响应体大小上限 5MB（H-04 修复项），data 单文件 2MB/总 5MB（`validate.mjs`），超限报错而非写入。
- 数据 URL 统一 scheme 校验/升级（`safeHttpUrl` + `upgradeExternalUrl`）；`data/*.json` 当前无 `javascript:`/`data:`/`file:` URL（扫描 0 命中）。
- 管线不读取工作区外文件、不上传本地数据；快照写入固定文件名（`data/snapshot/`，已 gitignore，发布产物由 `stage-site.mjs` 剔除）。
- 爬虫/请求 UA 不携带个人信息；无认证 token 入库；GitHub Token 仅通过 Actions secret 注入 env。

---

## 5. 残余风险

> 仅当「无法完全消除或成本高于收益」时列为残余；每项给出接受理由、缓解措施与复查周期。

### 5.1 【专项】历史重建清除旧 PII 的残余风险评估（契约 A4）

**背景**：v1.4 前历史提交据 Lead 说明含本机路径/用户名；计划以「orphan 新初始提交 + force-update `main` + 删除旧 tag/release」重建干净历史。

**威胁模型**：旧提交对象（commit/tree/blob）中的 PII 可能仍可被特定途径读取，即使默认 UI 已不可见。

| # | 残余途径 | 可消除性 | 可能性 | 影响 | 缓解措施 |
|---|---|---|---|---|---|
| R1 | 旧 branch/tag/Release 指向 | **可消除** | 低 | 中 | force-update `main`；删除全部旧 tag（含 GitHub Release 与 tag ref）；删除旧 workflow runs 可选 |
| R2 | 旧 commit SHA 被直接访问（URL `/commit/<sha>`、`git fetch <sha>`、REST `git/commits/<sha>`） | 部分（GitHub 不可达对象在 GC 前可能长期可按 SHA 访问；需 GitHub Support 协助清理 cached views） | 中（需先知道 SHA） | 中 | 重建后立即联系 GitHub Support 请求清理 unreachable commits/cached views；线上发布说明/文档**不要引用旧 SHA**；如 PII 敏感度高，优先「新建干净仓库 + 旧仓库转 private/归档」 |
| R3 | Fork / 他人 clone 保留完整旧历史 | 不可消除（需 fork 所有者配合） | 低-中（公开项目可能存在 fork） | 中 | 发布前检查 forks；如有，通过仓库公告/Issue 请求清理；接受残余 |
| R4 | GitHub 事件流 / GH Archive / 第三方数据镜像缓存旧 SHA 与 commit 元数据 | 不可消除 | 中 | 低-中 | 接受；不再扩散旧 SHA；必要时联系主要镜像/搜索引擎清除 |
| R5 | 旧提交的 author/committer 姓名与邮箱（commit metadata）即使历史重建仍随旧对象存在 | 部分 | 中 | 中 | 重建前用 `git log --all --format='%an <%ae>' \| sort -u` 盘点；若旧提交含私人邮箱：新提交统一用 GitHub noreply；评估是否需要新建仓库 |
| R6 | GitHub 贡献图/公开 API 中旧身份痕迹 | 不可完全消除 | 低 | 低 | 接受；新历史使用 noreply 身份 |
| R7 | GitHub Pages 部署历史 / CDN 缓存旧站点内容 | 可等待过期 | 低 | 低 | 发布后确认线上产物为 v1.4 新内容；旧内容不含 PII 时可接受 |
| R8 | Actions 运行日志/artifacts 含旧提交信息 | 可删除 | 低 | 低 | 可选：删除旧 workflow run 与 artifact |
| R9 | 搜索引擎/聊天软件对仓库页面的缓存 | 部分 | 低 | 低 | 重建后请求各搜索引擎刷新；接受 |

**风险评级**：若旧 PII 仅为「本机用户名/本地路径」（无邮箱、无凭据）→ **残余风险 = Medium**，可随 v1.4.0 发布并记录；若旧历史含**私人邮箱**或**任何 token/密钥/凭据** → **High**，必须：① 立即轮换所有暴露凭据（历史清除不可挽回）；② 重新评估是否「新建干净仓库」；③ 联系 GitHub Support 清理。

**重建前必做检查（在真实 .git 仓库执行）**：
```bash
# 1) 盘点作者身份（是否含私人邮箱）
git log --all --format='%H %an <%ae>' | sort -u
# 2) 全历史 PII/凭据扫描（示例；用真实规则）
git grep -I -n -E 'C:\\Users|/Users/|@(qq|163|gmail|outlook)\.com|ghp_|sk-[A-Za-z0-9]{20,}|BEGIN .*PRIVATE KEY' $(git rev-list --all) || true
# 3) 确认当前树无敏感文件（以 git ls-files 为准，排除 gitignore 目录）
git ls-files | grep -Ei 'snapshot|_artifact|_tmp|\.env|\.pem|\.key|credentials' || true
```
**建议重建步骤**（Lead 执行）：
1. `git checkout --orphan clean-v1.4` → `git add` 当前清理后树（`git ls-files` 复核，确保 `data/snapshot/`、`_artifact/`、`_tmp/`、`pnpm-lock.yaml` 不入库）→ 用 GitHub noreply 身份提交 → `git branch -M main`。
2. `git push --force origin main`；删除旧 tag（`git push origin --delete <tag>`）与对应 GitHub Release；重建 `v1.4.0` tag/release 指向新提交。
3. 检查 forks；联系 GitHub Support 清理 cached views/unreachable commits（按 PII 等级决定）。
4. 在 `SECURITY-AUDIT.md` 记录处置日期、执行人、残余路径与接受结论；发布说明中不出现旧 SHA。
**结论与接受标准**：在「无凭据、无私人邮箱、旧 PII 仅本机路径/用户名、旧 tag/release 已删除」前提下，残余风险 R1/R3/R4/R5/R7 可接受并记录；**R2 的 GitHub 侧缓存无法由项目完全控制**，属公开托管平台固有限制，建议以 Support 清理 + 不扩散旧 SHA 作为缓解。若用户不接受该残余，回退方案为「新建干净仓库发布 v1.4，旧仓库转 private/归档」（可彻底消除 R2，但丢失 stars/Issue/URL 连续性）。

### 5.2 GitHub Pages 无法设置安全响应头（平台固有限制）
- GitHub Pages 不支持自定义响应头，因此无法提供：`Strict-Transport-Security`（HSTS，首次访问仍可能被降级劫持）、`X-Frame-Options`/`frame-ancestors`（**点击劫持无法由站点侧彻底防护**；注意 `frame-ancestors` 在 `<meta>` CSP 中**被浏览器忽略**，不要误以为已生效）、`X-Content-Type-Options: nosniff`、`Permissions-Policy`、CSP `report-uri`/`report-to`（无法收集违规报告）、`Cross-Origin-*` 隔离头。
- **缓解**：meta CSP + meta referrer 覆盖大部分 XSS/外链风险；点击劫持残余接受（站点无高价值已登录操作，无敏感写操作界面）；后续如需完整响应头，可迁移到支持 `_headers` 的托管（Cloudflare Pages/Netlify）或前置 CDN。
- **等级**：Low（残余，接受并记录）。

### 5.3 CSP 折衷：`script-src 'unsafe-inline'` 与 `style-src 'unsafe-inline'`
- 站点 `<head>` 有内联主题/错误采集 bootstrap 脚本（9 页各 1 段，内容一致），契约给定 CSP 需 `'unsafe-inline'`；样式存在内联 `style="--x:…"`（图表/进度条），需 `style-src 'unsafe-inline'`。
- **影响**：削弱 CSP 对注入脚本的第一道防线（若未来出现 HTML 注入，`'unsafe-inline'` 无法拦截内联脚本）。当前无 HTML 注入面（§4.1 证据），风险可接受。
- **改进路径（v1.5）**：将内联脚本外置为 `assets/js/boot.js`，CSP 改为 `script-src 'self' 'sha256-<hash>'`（或仅 `'self'`）；内联样式可保留 `'unsafe-inline'` 或逐步改为 class。**接受残余**。

### 5.4 BYOK 信任边界（固有风险）
- **Key 存储**：浏览器 `localStorage` 明文存储（站点无后端，无法加密到用户口令）；同一浏览器配置文件下的**恶意扩展**、同源 XSS（当前无已知面）、共享/被入侵电脑可读取 key。用户侧缓解：不共享浏览器配置、公共电脑用完即清除、设置面板一键清除、定期轮换 key、为 BYOK 使用限额 key。
- **端点信任**：key 只会发往用户填写的端点，但**端点由用户自行选择/输入**：钓鱼式"教程"诱导填写攻击者端点即可窃取 key。缓解：H-05 强制 https（回环例外）+ 设置面板隐私说明 + SECURITY.md 使用建议（只填可信官方/自托管端点）。
- **供应商侧**：对话内容与站点上下文会发送给所选模型供应商，受其日志/隐私政策约束；助手上下文仅公开数据，不含本机/账户信息。
- **CSP `connect-src https:` 的宽泛性**：为兼容任意 BYOK 端点不得不允许全部 https；若未来发生 XSS，数据外传通道不受 host 限制。缓解：缩小可用端点白名单的选项（需产品决策）或 v1.5 引入用户确认的端点列表。
- **等级**：Medium（固有、已文档化，接受）。

### 5.5 LLM 内容安全 / Prompt Injection（不可信数据进入模型上下文）
- `buildContext()` 把 news/skills/topics 等**外部不可信文本**注入 system prompt；恶意 RSS 标题/摘要可对模型做 prompt injection，诱导输出虚假信息或钓鱼链接。
- **现有缓解**：输出经 `safeMarkdown` 强制转义、链接仅 `http(s)` 且新窗口 `noopener noreferrer`；助手无工具调用/无自动执行/不读本地数据；上下文预览可见；不向模型注入 key/用户隐私。
- **残余影响**：可能产生误导性回答或诱导点击的站外链接（需用户主动点击）；无代码执行与数据外传。建议在 SECURITY.md/页面文案注明「AI 回答由第三方模型生成，可能出错，请自行核实」。
- **等级**：Low-Medium（接受并文档化）。

### 5.6 第三方数据源信任与内容完整性
- AA/Epoch/LiveBench/OpenCompass/HN/RSS 等源本身可能被篡改、限流或返回错误数据；本项目不做真实性背书（页面已有数据源状态/免责说明）。
- 数据经清洗/转义/体积与 scheme 限制，注入面受控（§4.6）；但不排除数据源侧内容错误影响展示。
- **等级**：Low（业务固有，接受）。

### 5.7 审计与交付过程残余
- 本次无浏览器/CDP：CSP 实际执行效果、真实浏览器差异、移动端需 Lead 的浏览器验收覆盖；建议发布前在真实浏览器控制台确认 `consoleErrors=[]` 且无 CSP 违规。
- 站点在审计期间并行改动：最终复测以发布候选快照为准（§6.3），若发布前又有 `site/**` 变更需重跑 security-check。
- 无服务器端：无鉴权/无会话/无后端攻击面，但也意味着**客户端是唯一安全边界**。
- **等级**：Low（流程性，已用复测门禁缓解）。

### 5.8 用户客户端环境
- 浏览器扩展（可读 localStorage/DOM）、公共电脑、系统被入侵等**客户端失陷**不在站点控制范围；BYOK key 与对话内容随之暴露。缓解：文档化使用建议（§5.4）、不持久化会话、清除按钮。
- 旧浏览器（不支持 CSP/CSP3）不受约束，但站点目标为近两年 Chrome/Edge/Safari/Firefox。

### 5.9 残余风险接受矩阵

| 风险 | 等级 | 是否可接受 | 主要缓解 | 复查 |
|---|---|---|---|---|
| 历史重建后旧 SHA/GitHub 缓存 | Medium（仅路径/用户名） | 接受（记录） | 删除 tag/release、Support 清理、不扩散 | 发布时 + 每季度 |
| 历史重建若含私人邮箱/凭据 | High | **不可接受** | 轮换凭据、新建仓库、Support | 重建前必须核查 |
| GitHub Pages 无安全响应头（点击劫持等） | Low | 接受 | meta CSP/referrer | 年度/或迁移托管时 |
| CSP `'unsafe-inline'` 折衷 | Low | 接受 | 无注入面；v1.5 外置脚本+hash | v1.5 |
| BYOK localStorage 明文/端点信任 | Medium | 接受（固有） | https 强制、回环例外、隐私说明、清除按钮 | 每版本 |
| Prompt injection / 模型输出误导 | Low-Medium | 接受（文档化） | 转义/scheme 白名单/无工具调用/免责 | 每版本 |
| 第三方数据源内容错误 | Low | 接受（文档化） | 数据源状态、清洗、免责 | 数据管道变更时 |
| 本地开发服务器暴露 | Low | 接受（开发工具） | 默认 127.0.0.1；README 警告 | 不适用 |

---

## 6. 复测记录

### 6.1 复测门禁命令

```bash
# 1) 安全静态检查（0 ERROR 才允许发布）
node scripts/security-check.mjs --strict
node scripts/security-check.mjs --self-test

# 2) 安全单测 + 全量单测
node --test tests/security.test.mjs
node --test

# 3) 数据/站点合约回归
node scripts/validate.mjs --strict
node scripts/check-i18n.mjs --strict
node scripts/check-comments.mjs --strict

# 4) 最终人工复核项（本报告 §3 逐项 PASS/FAIL）
```

### 6.2 修复前基线（快照 1）

| 检查 | 结果 |
|---|---|
| `security-check`（Lead 版本，当时 CSP 未注入） | FAIL：**18 ERROR**（9 页 × CSP/referrer）+ 3 WARN（厂商公共邮箱、node_modules/pnpm-lock 本地残留） |
| 全仓 PII/secret 扫描 | 2 命中，均为非个人数据（占位示例 / 公共厂商邮箱） |
| 站点第三方资源/分析/cookie/iframe | 0 命中 |
| `data/*.json` 非法 scheme | 0 命中；`http://` 3 条（M-04） |
| data 体积 | 总 609,227 B（models.json 424,732 B 最大），均低于上限（复测重生成后总 609,624 B，仍达标） |
| `tests/security.test.mjs` | 红（import 了当时已不存在的 `normalizeName`/`matchBoardScores`，已反馈 Lead 修） |
| Actions pin 核验 | 5/5 既有 + codeql-action v3 SHA 均与 GitHub API tag 对应一致 |

### 6.3 修复后复测（最终快照：2026-11-04 00:55:12，全部 PASS）

> 执行时机：Lead 完成 CSP/referrer 注入、poc-data 用真实时钟重建数据并重建 feed 后。环境：本机 Node v24（无浏览器，浏览器复测由 Lead 完成）。行号以快照 3 为准。

| 项 | 验收标准 | 复测证据 | 结果 |
|---|---|---|---|
| H-01 CSP/referrer | 9 页均存在且含契约全部指令；`connect-src` 含回环 http | 9/9 页解析 PASS（cspLen≈265，`default-src/script-src/style-src/img-src/font-src/connect-src/object-src/base-uri/form-action/frame-src` 全在；`http://127.0.0.1:*`+`localhost:*` 在 connect-src）；referrer=no-referrer 9/9 | **PASS** |
| H-02 URL scheme | 数据驱动 `href` 非法 scheme 0 命中；`safeHttpUrl` 向量通过 | 站点 `href` sink 扫描 0 命中；`safeHttpUrl` 9 组拒绝/接受向量 PASS；`safeHref` 别名已定（`render.js:23`） | **PASS** |
| H-03 Actions 权限 | deploy 顶层仅 contents:read；pages/id-token 仅 deploy job；无 `pull_request_target`；全部 `uses@40hex` | 4 workflow 复核：顶层权限符合；`deploy` job 级 pages/id-token（:73-75）；`pull_request_target` 0；未 pin `uses:` 0；secrets 仅 deploy/refresh（push/schedule） | **PASS** |
| H-04 `?ask=` | 仅预填、不触发 fetch；限长 | 源码断言：boot 块无 `askAssistant(`、有 `setInput(ask)`+`ASK_PREFILL_MAX` | **PASS** |
| H-05 BYOK http | 公网 http 回退默认；回环 http 允许 | `http://evil.example.com/v1`→默认 https（warn=1）；`http://127.0.0.1:11434/v1`→保留；`javascript:`/`data:`→默认 | **PASS** |
| M-01 `?tag=` 限长 | slice(0,100) | 源码断言 + 反射路径 textContent/esc | **PASS** |
| M-02 体积上限 | 采集 5MB 上限 + validate 2MB/5MB | `validate --strict` 0 error/0 warning；data 总 609,624 B | **PASS** |
| M-03 实体解码 | 越界码点不抛错 | 全量单测 94/94（含 poc-data 新增畸形实体用例） | **PASS** |
| M-04 http 外链 | data + feed 均 0 条 `http://` | `data/*.json` 0、`site/feed.json` 0（feed.xml 仅 xmlns 命名空间） | **PASS** |
| M-05 `t()` 转义 | innerHTML 模板全 esc | assistant.js `et()` 全量替换；站点扫描 0 裸插值告警 | **PASS** |
| M-06 workflow 加固 | timeout + persist-credentials | 4 workflow 均含 timeout；ci/deploy/codeql `persist-credentials: false` | **PASS** |
| security-check `--strict` | **0 ERROR** | `Text files scanned: 123`、`HTML pages: 9`、**0 errors / 1 warning**（本地 node_modules，CI 干净 clone 无），exit 0 | **PASS** |
| `--self-test` | ≥8 断言全 PASS | 9/9 assertions PASS（pii-path/pii-placeholder/pinned/unpinned/local-use/csp/no-csp/secret/danger） | **PASS** |
| security tests | 全绿 | `node --test tests/security.test.mjs` → 9/9 pass | **PASS** |
| 全量单测 | 全绿 | `node --test` → **94/94 pass**（含 data-http 新用例） | **PASS** |
| 数据/站点合约 | `validate --strict` 等全绿 | `validate --strict` → 0 error/0 warning；`check-i18n --strict` → 0 error（22 既有文案 warning，非安全项）；`check-comments --strict` → 0 | **PASS** |
| 站点第三方/分析/cookie | 0 命中 | site/** 扫描无外部 script/样式/字体/图片、无 iframe、无 analytics/像素、无 `document.cookie` | **PASS** |
| 数据 scheme/体积 | 非法 scheme 0、体积达标 | 8 个 data JSON：`javascript/data/vbscript/file:` 0、`http://` 0、单文件≤2MB、总 609,624 B≤5MB | **PASS** |
| XSS/URL 向量 | 纯函数 31 组 | 30 项直接 PASS + 1 项判据修正（分享文案为**纯文本**设计，`buildShareText` 保留 `<script>` 字面量但仅用于剪贴板/纯文本分享，不进入任何 `innerHTML`——已验证无 HTML 渲染路径） | **PASS** |
| 浏览器验收（Lead） | 8 页 consoleErrors=[]、无 CSP 违规 | 本审计环境无浏览器，需 Lead 回填 | 待 Lead |
| 历史重建（A4） | clean history + 删旧 tag/release | 需 Lead 在真实仓库执行（§5.1） | 待 Lead |

**复测说明**：
- GitHub API action-SHA 二次核验因未认证限流（`x-ratelimit-remaining: 0`，reset ≈01:45 CST）无法重复；首次核验（6/6 一致）记录见附录 D，结论不变。
- `node_modules/` 在本地工作区存在（工具依赖，已被 .gitignore），因此 security-check 报 1 WARN；CI 为干净 clone，发布前 Lead 会删除本地目录，故不作为发布阻塞。
- 复测期间另发现并验证修复了 2 个非安全类发布阻塞项（§6.4 T-01/T-02）。

### 6.4 复测期间发现的非安全类发布阻塞项（移交 Lead / poc-data）

以下两项不属于安全漏洞，但会导致 `validate --strict` / `node --test` 失败，进而阻塞 v1.4.0 发布门禁，故在审计复测中一并记录：

| ID | 现象（实测，修复前） | 根因 | 修复与复测 | 状态 |
|---|---|---|---|---|
| T-01 | `data/{meta,news,models,rankings,resources,projects,topics}.json` 的 `generatedAt` 曾为 `2026-11-04T00:00:00.000Z`（固定未来时钟，真实时钟约 `2026-11-03T16:51Z`）→ `validate --strict` 报「generatedAt 晚于当前时间超过 5 分钟」；`node --test` 94/93 pass/1 fail | 数据重生成时使用固定未来时钟（`fetch-data.mjs:40` 的 `--now`） | poc-data 用真实时钟重跑；复测 `meta.generatedAt=2026-11-03T16:50:38.301Z`（age<2min）、`validate --strict` 0/0、`node --test` 94/94 | **已修复** |
| T-02 | `site/feed.json` 曾残留 3 条 `http://bair.berkeley.edu/...`（`data/news.json` 已 https） | feed 未随数据重建 | poc-data 重跑 `build-feed`（items=89）；复测 feed `http://`=0、`http://` 外链全仓 0 | **已修复** |

### 6.5 发布门禁 checklist（v1.4.0）

- [x] `security-check --strict` 0 ERROR（含 `--self-test` PASS）— 复测 PASS
- [x] security tests + 全量单测 + `validate --strict` 全绿 — 复测 9/9、94/94、0/0
- [x] 9 页 CSP/referrer 存在且 CSP 指令完整（含 BYOK 回环兼容）— 复测 9/9 PASS
- [x] Actions 全部 SHA pin（CI 检查 + 人工核验）、无 `pull_request_target`、权限最小化 — 复测 PASS（SHA 首次 API 核验 6/6 一致）
- [x] CodeQL/Dependabot 文件存在并生效 — 已落盘（`codeql.yml` SHA pin + 最小权限；`dependabot.yml` weekly）；发布后确认首个 CodeQL 运行通过
- [x] 全仓 PII/凭据扫描 0 个人敏感命中 — 复测 128 文件 0 真实命中（仅排除文件内 fixture）
- [ ] 历史重建完成（orphan 提交 + 旧 tag/release 删除），处置记录写入 §5.1 — **待 Lead 执行**
- [ ] 真实浏览器复测（Lead）：无 CSP 违规、助手/分享/深链正常 — **待 Lead 回填**
- [x] 本报告 §6.3 全部可复测项 PASS 并更新「报告状态：最终」

---

## 7. 交付物与责任矩阵

| 工件 | 内容 | 作者/维护 | 状态 |
|---|---|---|---|
| `SECURITY.md` | 威胁模型/隐私声明/报告渠道/响应时限/支持版本/安全使用建议 | Lead（security-auditor 只读复核：内容与实测一致） | 已落盘 ✅ |
| `docs/SECURITY-AUDIT.md` | 本报告 | **security-auditor** | 最终版（复测完成） |
| `scripts/security-check.mjs` | CI 安全静态检查（PII/secrets/危险 API/外链/CSP/Actions pin/数据体积；`--strict`/`--self-test`） | Lead（security-auditor 提规则建议） | 已落盘，复测 **0 ERROR PASS**；已纳入 `ci.yml` Security check 步骤 |
| `tests/security.test.mjs` | XSS/scheme/分享文本/scanner 单测 | Lead（security-auditor 复核并报 import 不匹配，已修复） | 已落盘，复测 **9/9 PASS** |
| `.github/workflows/codeql.yml` | CodeQL（javascript-typescript，最小权限，SHA pin） | **security-auditor** | 已落盘（codeql-action SHA 经 API 核验） |
| `.github/dependabot.yml` | GitHub Actions 每周依赖更新（分组） | **security-auditor** | 已落盘 |
| site/workflow 修复 | H-01…M-06 落盘修复 | Lead / site-mvp / i18n-en / poc-data | **已全部修复并复测 PASS**（见 §3 状态列、§6.3） |

---

## 8. 附录

### A. 审计命令与工具（可复现）

```bash
# 交付脚本
node scripts/security-check.mjs --strict
node scripts/security-check.mjs --self-test

# 本次审计的一次性扫描（示意）
#  - 全仓 PII/secret：读入 128 个文本文件（复测快照）（排除 snapshot/_artifact/_tmp/二进制）跑正则集合
#  - 站点第三方资源/分析/cookie/iframe：对 site/** 跑 external-script|stylesheet|font|img|iframe|analytics|cookie
#  - data URL scheme/体积：JSON.parse 后遍历 url 字段 + statSync
#  - innerHTML 插值启发式：对 site/assets/js/*.js 提取 innerHTML/insertAdjacentHTML 模板 ${...}
#  - Action pin 核验：GitHub API /repos/<owner>/<repo>/git/ref/tags/<tag> 与文件内 SHA 比对
# 纯函数向量：node --input-type=module（import assistant-core.js / share.js，见附录 C）
```

### B. 扫描规则清单（审计覆盖）
- PII：`[A-Za-z]:\\Users\\<非占位>`、`/Users/<name>`、本机工作区盘符路径、CJK 用户名路径、个人邮箱（排除 noreply/example）、`$env:USERPROFILE` 等。
- Secrets：`ghp_/gho_/ghu_/ghs_/ghr_`、`github_pat_`、`sk-[A-Za-z0-9]{16,}`、`sk-ant-`、`AKIA[0-9A-Z]{16}`、`AIza…`、`xox[baprs]-`、JWT、`BEGIN … PRIVATE KEY`、`password|secret=…`、credential-like 文件名。
- 危险 API：`eval(`、`new Function(`、`document.write(`、`innerHTML` + `${}` 插值启发式（人工复核 allowlist）。
- HTML：`target="_blank"` 无 `rel=noopener`、`href="http://`（排除 loopback）、CSP/referrer meta 存在性、`javascript:`/`data:` 链接。
- Actions：`uses:` 必须 `@40hex`、禁 `pull_request_target`、权限块存在、secrets 仅非 PR 触发、checkout 凭据持久化。
- 数据：`data/*.json` 单文件 ≤2MB/总 ≤5MB、JSON 可解析、URL scheme 白名单、字段长度上限。
- 隐私：第三方 `<script>`/样式/字体/图片、iframe、analytics/像素、`document.cookie`、`localStorage` 键清点、`fetch` 目标清点。

### C. XSS / URL scheme 向量运行时验证（纯函数，31 组）

| # | 向量 | 结果 |
|---|---|---|
| 1 | `safeMarkdown('<img src=x onerror=…> <script>…')` | PASS（全部实体化，无标签） |
| 2 | `[x](javascript:alert(1))` | PASS（不生成 href） |
| 3 | `[x](data:text/html;base64,…)` | PASS（不生成 href） |
| 4 | `[x](https://a.com/"onmouseover="alert(1))` | PASS（引号实体化，属性不可逃逸） |
| 5 | 代码围栏语言注入 ` ```"><script>…` | PASS（class 内转义） |
| 6 | `\u0000` 占位符注入 | PASS（输入先剥离 NUL） |
| 7 | `escapeHtml(&<>"')` | PASS（5 字符全实体化） |
| 8 | 分享文案标题含 `<script>` | PASS（纯文本，无 HTML 执行） |
| 9 | 分享 intent URL 含 `javascript:` | PASS（`encodeURIComponent` 后仅作查询参数） |
| 10 | `normalizeConfig('javascript:…')` | PASS（回退默认 https） |
| 11 | `chatCompletionsUrl('javascript:…')` | PASS（回退默认 https） |
| 12 | `normalizeConfig('http://公网/v1')` | PASS（H-05 修复后回退默认 + 双语警告） |
| 13 | `normalizeConfig('http://127.0.0.1:11434/v1')` | PASS（回环 http 允许，Ollama 兼容） |
| 14 | `buildContext` 含 `javascript:` news URL | PASS（上下文文本经转义渲染；scheme 由前端 safeHttpUrl 拦截） |
| 15 | Canvas 分享卡标题含 HTML/脚本 | PASS（`fillText` 纯文本，Canvas 不解析 HTML） |
| 16 | `?lang=%3Cscript%3E` / `?theme=…` 非法值 | PASS（白名单回退 zh / auto，不写入 DOM） |
| 17 | `safeHttpUrl('javascript:/data:/vbscript:/file://；//host；相对路径；空')` | PASS（全部返回 `''`） |
| 18 | `safeHttpUrl('https://…')` / `safeHttpUrl('http://127.0.0.1:11434/v1')` | PASS（合法 http(s) 返回规范 URL） |
| 19 | `?ask=` 源码断言：boot 块无 `askAssistant(`、有 `setInput(ask)`+`ASK_PREFILL_MAX` | PASS（H-04 不再自动请求） |
| 20 | 9 页 CSP+referrer 全量断言 | PASS（9/9，指令完整、connect-src 含回环） |

> 说明：上表为复测（快照 3）复核后的 31 项断言中与安全直接相关的核心项；其余项覆盖 `safeHttpUrl` 拒绝/接受矩阵、BYOK 配置回退/回环、分享 intent 编码、站点第三方资源与 data scheme 扫描等（均 PASS）。

### D. Action pin 核验记录（GitHub API，未认证）
```
actions/checkout v4                  -> 11d5960a326750d5838078e36cf38b85af677262 (commit)  ✅
actions/setup-node v4                -> 49933ea5288caeca8642d1e84afbd3f7d6820020 (commit)  ✅
actions/configure-pages v5           -> 983d7736d9b0ae728b81ab479565c72886d7745b (commit)  ✅
actions/upload-pages-artifact v3     -> 56afc609e74202658d3ffba0e8f6dda462b719fa (commit)  ✅
actions/deploy-pages v4              -> d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e (commit)  ✅
github/codeql-action v3              -> a3d1b77a1ba1550fbb5c74db1dc3a11f4a481126 (annotated tag 解引用) ✅
```
> 核验时间：2026-11-04 00:47（UTC+8）；复测时（00:55）GitHub 未认证 API 已限流（`x-ratelimit-remaining: 0`，reset ≈01:45），无法重复调用；首次核验 6/6 一致，结论不变。

### E. 数据规模（复测快照 3）

| 文件 | 字节 | 上限 |
|---|---|---|
| models.json | 424,728 | 2MB ✅ |
| news.json | 66,135 | 2MB ✅ |
| rankings.json | 60,863 | 2MB ✅ |
| topics.json | 6,476 | 2MB ✅ |
| skills.json | 24,196 | 2MB ✅ |
| meta.json | 7,244 | 2MB ✅ |
| resources.json | 11,800 | 2MB ✅ |
| projects.json | 8,182 | 2MB ✅ |
| **合计** | **609,624 B（≈595KB）** | **5MB ✅** |

### F. 审计时间线

| 时间 | 事件 |
|---|---|
| 2026-11-04 00:45 | 接收任务，读取契约/SPEC/DATA-CONTRACT/全部前端、管线、workflows |
| 2026-11-04 00:48 | 完成人工复核 + 首轮自动扫描；向 Lead 提交 PII/High 清单 |
| 2026-11-04 00:52 | 向 Lead 提交完整 findings（H1-H5/M1-M6/L1-L5）；复核 Lead 已落盘安全工件并报告 security tests import 问题 |
| 2026-11-04 00:52 | 发现并上报 T-01/T-02（数据未来时钟 / feed 未重建）两个非安全发布阻塞项 |
| 2026-11-04 00:53 | 落盘 codeql.yml/dependabot.yml 增强版；本报告快照 2（各成员修复落地中） |
| 2026-11-04 00:55 | **最终复测（快照 3）**：security-check --strict PASS(0E/1W)、self-test 9/9、security tests 9/9、全量单测 94/94、validate --strict 0/0、CSP 9/9、站点/数据扫描全 PASS；回填 §6.3 与各状态 |

---

> **声明**：本报告基于公开代码与配置的静态审查、自动化扫描与纯函数运行时验证；不含渗透测试与真实浏览器执行（见 §1.4）。报告中所有「已修复」以最终复测（§6.3）为准；发布决定由 Lead/项目所有者做出。
