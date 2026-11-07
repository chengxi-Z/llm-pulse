/**
 * AI Pulse — AI assistant core pure functions (ESM, no DOM dependencies; usable in both
 * browsers and Node).
 *
 * This module provides:
 *  - buildContext()   site data -> <=6KB system-prompt context summary
 *  - parseSSE()       incremental parser for OpenAI-compatible /chat/completions streams
 *                     (any chunk boundary, including multi-byte UTF-8 splits)
 *  - localAnswer()    offline answers when no key is configured / the request fails
 *                     (keyword search over models/news/rankings/resources/projects + templates)
 *  - buildBrief()     one-click "This Week in AI" Markdown brief
 *  - safeMarkdown()   escape-first Markdown-lite rendering (bold/list/code/links), XSS-safe
 *
 * Constraints: imports nothing and never touches the global document/window; API keys never
 * pass through this module.
 */

export const SCHEMA_VERSION = 1;
export const CONTEXT_MAX_BYTES = 6000;
export const CONFIG_STORAGE_KEY = 'aipulse.assistant.config.v1';
export const DEFAULT_CONFIG = Object.freeze({
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
});

const encoder = new TextEncoder();
const MAX_HISTORY_TURNS = 8;

/* ------------------------------------------------------------------ *
 * Language helpers
 *
 * The core stays a pure module: it never imports the DOM i18n engine.
 * Every content-producing export accepts an optional `{ lang }` option
 * ('zh' default, 'en' for English). The DOM layer passes the current
 * language from i18n.js.
 * ------------------------------------------------------------------ */

const SUPPORTED_LANGS = new Set(['zh', 'en']);

/** Normalize an i18n language code; Chinese is the default. */
export function normalizeLang(lang) {
  return SUPPORTED_LANGS.has(lang) ? lang : 'zh';
}

/** Resolve the language from an options bag (`{ lang: 'en' }`). */
function langOf(opts = {}) {
  return normalizeLang(opts && opts.lang);
}

/** Pick a localized literal. */
function pick(lang, zh, en) {
  return lang === 'en' ? en : zh;
}

/**
 * Bilingual content templates for generated answers, prompts, briefs and
 * share texts. UI chrome strings live in the site dictionaries instead.
 */
const TEXT = {
  zh: {
    unknownContext: '未知',
    unknownPrice: '价格未知',
    perMillionTokens: '每 1M tokens',
    untitledModel: '未命名模型',
    unknownOrg: '未知厂商',
    truncatedMarker: '\n…（上下文已截断）',
    contextTitle: '# AI Pulse（照胆云）站点数据摘要',
    contextGenerated: '- 数据生成时间：{at}',
    contextGeneratedUnknown: '未知',
    contextModels: '；模型 {n} 个',
    contextNews: '；动态 {n} 条',
    contextBoards: '；榜单 {n} 个',
    contextResources: '；学习资源 {n} 条',
    contextProjects: '；项目 {n} 个',
    contextSources: '- 数据源状态：{ok}/{total} 正常',
    contextSourcesDegraded: '；降级：{names}',
    contextHighlights: '- 本周速览：{items}',
    contextNoData: '- 站点数据暂不可用（首次加载失败或尚未生成），回答时请说明数据缺失、不要编造具体数字。',
    contextModelsHeading: '## 最近发布 / 收录的模型（含价格，单位 USD/1M tokens）',
    contextModelLine: '- {name}（{org}）：上下文 {ctx}，{price}，{weights}{released}',
    weightsOpen: '开放权重',
    weightsClosed: '闭源',
    releasedSuffix: '，{date} 发布',
    contextNewsHeading: '## 最新动态',
    newsImportant: '重要 ',
    contextBoardsHeading: '## 榜单 Top 3',
    boardFallback: '榜单',
    contextBoardLine: '- {name}：{top}',
    scoreParen: '（{score}）',
    contextResourcesHeading: '## 精选学习资源',
    resourceLine: '- {title}（{type} / {level} / {lang}{free}）',
    resourceFree: ' / 免费',
    contextProjectsHeading: '## 项目展示',
    projectLine: '- {name}：{summary}',
    promptPersona: '你是「{site}」网站内置的 AI 助手，一个专注大模型（LLM）动态、排行、模型库、学习资源与项目展示的中文助理。',
    promptRules: '你的回答必须：1) 优先、且只依据下方【站点数据摘要】作答；2) 数据不足时明确说“站点数据中未收录”，不要编造数字或排名；3) 使用简洁中文 + Markdown（粗体、短列表），通常不超过 300 字；4) 涉及价格时注明单位 USD / 1M tokens；5) 引用条目时保留来源链接。',
    promptBrief: '如果用户问“本周简报 / 周报”，请按「关键数字 / 新模型 / 榜单风向 / 重要动态 / 学习与项目」五段输出。',
    promptContextLabel: '【站点数据摘要】',
    promptNoData: '（无可用数据）',
    promptSiteUrl: '站点地址：{url}',
    promptToday: '当前日期：{date}',
    promptOfflineNote: '离线模式提示：当用户未配置模型密钥时，你的回答由本地规则生成；本提示词仅用于 BYOK 在线模式。',
    errAuthTitle: 'API Key 未通过验证',
    errAuthMessage: '请检查设置中的 API Key 是否正确、是否有该模型权限。密钥仅保存在本机浏览器。',
    errNotFoundTitle: '接口或模型不存在',
    errNotFoundMessage: '请检查 baseURL（通常形如 https://api.deepseek.com/v1）与 model 名称。',
    errRateTitle: '请求过于频繁 / 额度用尽',
    errRateMessage: '稍后重试，或检查账户余额与限流。可先用离线模式继续查询站点数据。',
    errServerTitle: '模型服务暂时不可用',
    errServerMessage: '上游返回服务器错误，请稍后重试；离线模式仍可查询站点数据。',
    errBadRequestTitle: '请求被拒绝',
    errBadRequestMessage: '接口返回 {status}，请检查模型名称与参数。',
    errTimeoutTitle: '请求超时',
    errTimeoutMessage: '网络响应过慢或已被停止，可重试或改用离线模式。',
    errNetworkTitle: '网络请求失败',
    errNetworkMessage: '可能是网络不可达或接口站点未允许跨域（CORS），请检查 baseURL 与网络。',
    errUnknownTitle: '请求失败',
    errUnknownMessage: '未知错误，请稍后重试。',
    noDataTitle: '**离线模式 · 站点数据暂不可用**',
    noDataBody: '未能加载 `data/*.json`（首次打开或本地直接双击 `file://` 时常见）。',
    noDataHint: '你可以：',
    noDataItem1: '- 通过页脚/关于页的数据更新时间判断是否已生成；',
    noDataItem2: '- 配置模型密钥后直接在设置里询问在线模型；',
    noDataItem3: '- 仍可问我「站点有哪些栏目」「如何使用这个助手」。',
    contextAnswerTitle: '**上下文窗口最长的模型（Top {n}）**',
    contextAnswerItem: '{index}. **{name}**（{org}）：{ctx} tokens，{price}',
    contextAnswerEmpty: '站点数据中还没有可用的上下文窗口信息。',
    contextAnswerTip: '提示：上下文越长不代表效果越好，长上下文检索质量仍取决于模型与任务。',
    priceAnswerTitle: '**性价比参考（输入+输出价格合计最低，USD / 1M tokens）**',
    priceAnswerItem: '{index}. **{name}**（{org}）：{price}，上下文 {ctx}',
    priceAnswerEmpty: '站点数据中还没有可比较的价格信息。',
    priceAnswerNote: '说明：价格来自公开 API 目录，仅作成本参考；综合能力请结合榜单页判断。',
    rankingAnswerTitle: '**榜单风向**',
    rankingAnswerBoard: '**{name}**{updated}',
    rankingAnswerUpdated: '（更新于 {date}）',
    rankingAnswerItem: '- {rank}. {model}{score}',
    rankingAnswerScore: ' — {score}',
    rankingAnswerEmpty: '站点数据中还没有收录榜单（排行榜可能处于降级状态）。',
    rankingAnswerNote: '来源与口径以排行页标注为准，不同榜单不可直接横向比较。',
    newsAnswerTitle: '**最新动态（{n} 条）**',
    newsAnswerItem: '- {important}{date} {title}{source}',
    newsAnswerSource: '（[来源]({url})）',
    newsAnswerEmpty: '站点数据中还没有动态条目（数据源可能处于降级状态）。',
    newsAnswerNote: '完整时间线见「动态」页，可按类型/厂商筛选。',
    learnAnswerTitle: '**入门学习路线推荐**',
    learnAnswerItem: '- {title}（{type} · {level} · {lang}{free}）{desc}',
    learnAnswerDesc: '：{text}',
    learnAnswerEmpty: '站点数据中还没有学习资源条目。',
    learnAnswerNote: '建议顺序：先过一遍系统课程 → 用工具实践 → 再读论文与进阶项目（完整列表见「学习资源」页）。',
    projectAnswerTitle: '**项目展示（按 stars 排序）**',
    projectAnswerItem: '- {name}{owner}：{summary}',
    projectAnswerEmpty: '站点数据中还没有项目条目。',
    projectAnswerNote: '更多见「项目」页（自研项目 + 社区精选）。',
    openAnswerTitle: '**开放权重模型（共 {n} 个）**',
    openAnswerItem: '- **{name}**（{org}）{license}：上下文 {ctx}',
    openAnswerEmpty: '站点数据中暂未标记开放权重的模型（或数据源降级）。',
    openAnswerNote: '开放权重 ≠ 商用免费，请以许可证原文为准。',
    aboutAnswerTitle: '**关于本站与数据源**',
    aboutAnswerSite: '- 站点：{name}{brand}',
    aboutAnswerGenerated: '- 数据生成时间：{at}',
    aboutAnswerMode: '- 生成模式：{mode}',
    aboutAnswerSourcesTitle: '**数据源状态**',
    aboutAnswerSourceLine: '- {name}（{type}）：{status}{items}',
    aboutAnswerSourceItems: ' · {n} 条',
    aboutAnswerNoSources: '- 数据源清单见「关于」页。',
    aboutAnswerNote: '本站为纯静态站，数据由 GitHub Actions 定时刷新；AI 助手默认离线运行，配置密钥后才会访问你指定的模型接口。',
    fallbackTitle: '**在站点数据中找到的相关条目**',
    fallbackMissTitle: '**没有在站点数据中直接检索到这个主题**',
    fallbackMissHint: '当前离线模式只能基于站点收录的数据回答。你可以试试：',
    fallbackMissItem1: '- 「现在上下文最长的模型？」',
    fallbackMissItem2: '- 「性价比最高的模型？」',
    fallbackMissItem3: '- 「推荐入门课程」',
    fallbackMissItem4: '- 「本周要点简报」',
    fallbackMissItem5: '- 「最近有什么新动态？」',
    fallbackFooter: '（离线模式 · 基于站点数据本地检索，未调用任何外部接口）',
    fallbackModelHit: '- 模型 **{name}**（{org}）：上下文 {ctx}，{price}{desc}',
    fallbackModelDesc: ' — {text}',
    fallbackNewsHit: '- 动态 {date} **{title}**',
    fallbackResourceHit: '- 资源 {title}（{type} / {level}）',
    fallbackProjectHit: '- 项目 {name}：{summary}',
    emptyQuestion: '请问你想了解模型、排行、动态、学习资源还是项目？（离线模式可直接查询站点数据）',
    modelsOverviewTitle: '**模型库速览**',
    modelsOverviewLine: '站点共收录 {n} 个模型{updated}。',
    modelsOverviewUpdated: '（数据更新于 {date}）',
    briefTitle: '# AI Pulse · 本周 AI 简报',
    briefEmptyHeader: '> {date} · 离线生成',
    briefEmptyBody: '站点数据暂不可用，请待数据生成后重试。',
    briefMeta: '> {date} · 数据更新 {updated} · 离线生成（无需密钥）',
    briefUnknownDate: '未知',
    briefSection1: '## 一、关键数字',
    briefNumbers: '- 收录模型 **{models}** 个 · 动态 **{news}** 条 · 榜单 **{boards}** 个 · 学习资源 **{resources}** 条 · 项目 **{projects}** 个',
    briefSources: '- 数据源 {ok}/{total} 正常',
    briefSourcesDegraded: '，{n} 个降级（以页面标注为准）',
    briefSection2: '## 二、本周新模型',
    briefNewModel: '- **{name}**（{org}）：上下文 {ctx}，{price}，{date}',
    briefNoNewModels: '- 本周无新增模型记录（最近收录见模型库页）。',
    briefSection3: '## 三、榜单风向',
    briefBoardLine: '- **{name}**：{entries}',
    briefNoBoards: '- 榜单数据暂不可用。',
    briefSection4: '## 四、值得一读的动态',
    briefNewsLine: '- **{title}**{summary}{link}',
    briefNewsSummary: '：{text}',
    briefNewsLink: '（[原文]({url})）',
    briefNoNews: '- 暂无动态。',
    briefSection5: '## 五、学习与项目',
    briefLearnLine: '- 学习：{title}（{type} / {level}）',
    briefProjectLine: '- 项目：{title}：{summary}',
    briefNoLearn: '- 暂无学习资源与项目更新。',
    briefFooter: '来源：AI Pulse · 照胆云 <{url}> ｜ 由站点内置助手离线生成，数据以站点实时页面为准。',
    sharePrefix: '【{site}】{title}',
    plainLink: '$1（$2）',
    warnBaseUrlInvalid: '须为有效的 http(s) 地址，已回退默认值',
    warnHttpsOnly: '出于安全考虑仅允许 https 端点（本机 localhost / 127.0.0.1 可用 http），已回退默认值',
  },
  en: {
    unknownContext: 'N/A',
    unknownPrice: 'N/A',
    perMillionTokens: 'per 1M tokens',
    untitledModel: 'Untitled model',
    unknownOrg: 'Unknown provider',
    truncatedMarker: '\n… (context truncated)',
    contextTitle: '# AI Pulse — Site data summary',
    contextGenerated: '- Data generated: {at}',
    contextGeneratedUnknown: 'unknown',
    contextModels: '; {n} models',
    contextNews: '; {n} updates',
    contextBoards: '; {n} leaderboards',
    contextResources: '; {n} learning resources',
    contextProjects: '; {n} projects',
    contextSources: '- Data source status: {ok}/{total} OK',
    contextSourcesDegraded: '; degraded: {names}',
    contextHighlights: '- This week at a glance: {items}',
    contextNoData: '- Site data is unavailable (first load failed or data not generated yet). Tell the user the data is missing and never invent numbers.',
    contextModelsHeading: '## Recent model releases (prices in USD / 1M tokens)',
    contextModelLine: '- {name} ({org}): context {ctx}, {price}, {weights}{released}',
    weightsOpen: 'open weights',
    weightsClosed: 'proprietary',
    releasedSuffix: ', released {date}',
    contextNewsHeading: '## Latest updates',
    newsImportant: 'Important ',
    contextBoardsHeading: '## Leaderboards — top 3',
    boardFallback: 'Leaderboard',
    contextBoardLine: '- {name}: {top}',
    scoreParen: ' ({score})',
    contextResourcesHeading: '## Curated learning resources',
    resourceLine: '- {title} ({type} / {level} / {lang}{free})',
    resourceFree: ' / free',
    contextProjectsHeading: '## Projects',
    projectLine: '- {name}: {summary}',
    promptPersona: 'You are the AI assistant built into the {site} website. You focus on LLM news, leaderboards, the model catalog, learning resources, and projects.',
    promptRules: 'Your answers must: 1) rely first and only on the [Site data summary] below; 2) when data is insufficient, say "the site data does not cover this yet" instead of inventing numbers or ranks; 3) answer in concise English with Markdown (bold text, short lists), usually under 200 words; 4) state prices in USD / 1M tokens; 5) keep source links when citing entries.',
    promptBrief: 'If the user asks for "this week\'s brief" or a weekly summary, answer in five sections: key numbers / new models / leaderboard signals / important updates / learning and projects.',
    promptContextLabel: '[Site data summary]',
    promptNoData: '(no data available)',
    promptSiteUrl: 'Site URL: {url}',
    promptToday: 'Current date: {date}',
    promptOfflineNote: 'Offline-mode note: answers come from local rules when no model key is configured; this prompt is only used for BYOK online mode.',
    errAuthTitle: 'API key verification failed',
    errAuthMessage: 'Check the API key in settings and whether it has access to this model. The key stays in this browser only.',
    errNotFoundTitle: 'Endpoint or model not found',
    errNotFoundMessage: 'Check baseURL (usually like https://api.deepseek.com/v1) and the model name.',
    errRateTitle: 'Too many requests / quota exhausted',
    errRateMessage: 'Retry later, or check your account balance and rate limits. You can keep using offline mode in the meantime.',
    errServerTitle: 'Model service unavailable',
    errServerMessage: 'The upstream returned a server error. Try again later; offline mode can still query site data.',
    errBadRequestTitle: 'Request rejected',
    errBadRequestMessage: 'The endpoint returned {status}. Check the model name and parameters.',
    errTimeoutTitle: 'Request timed out',
    errTimeoutMessage: 'The network was too slow or the request was stopped. Retry or switch to offline mode.',
    errNetworkTitle: 'Network request failed',
    errNetworkMessage: 'The network may be unreachable, or the endpoint may not allow cross-origin (CORS) requests. Check baseURL and your connection.',
    errUnknownTitle: 'Request failed',
    errUnknownMessage: 'Unknown error. Please try again later.',
    noDataTitle: '**Offline mode · Site data unavailable**',
    noDataBody: 'Could not load `data/*.json` (common on first open or when opening the page directly over `file://`).',
    noDataHint: 'You can:',
    noDataItem1: '- Check the data update time in the footer or on the About page;',
    noDataItem2: '- Add a model key in settings and ask the online model;',
    noDataItem3: '- Still ask me "what sections does the site have?" or "how do I use this assistant?".',
    contextAnswerTitle: '**Longest context windows (top {n})**',
    contextAnswerItem: '{index}. **{name}** ({org}): {ctx} tokens, {price}',
    contextAnswerEmpty: 'No context-window data is available on this site yet.',
    contextAnswerTip: 'Note: a longer context does not mean better quality — long-context retrieval still depends on the model and the task.',
    priceAnswerTitle: '**Best value (lowest combined input + output price, USD / 1M tokens)**',
    priceAnswerItem: '{index}. **{name}** ({org}): {price}, context {ctx}',
    priceAnswerEmpty: 'No comparable pricing data is available on this site yet.',
    priceAnswerNote: 'Note: prices come from public API catalogs and are a cost reference only; check the leaderboards for overall capability.',
    rankingAnswerTitle: '**Leaderboard signals**',
    rankingAnswerBoard: '**{name}**{updated}',
    rankingAnswerUpdated: ' (updated {date})',
    rankingAnswerItem: '- {rank}. {model}{score}',
    rankingAnswerScore: ' — {score}',
    rankingAnswerEmpty: 'No leaderboards are cataloged yet (the leaderboard may be degraded).',
    rankingAnswerNote: 'Sources and methodology follow the leaderboards page; different boards are not directly comparable.',
    newsAnswerTitle: '**Latest updates ({n})**',
    newsAnswerItem: '- {important}{date} {title}{source}',
    newsAnswerSource: ' ([source]({url}))',
    newsAnswerEmpty: 'No updates are available yet (a data source may be degraded).',
    newsAnswerNote: 'See the Updates page for the full timeline; filter by type or provider.',
    learnAnswerTitle: '**Beginner learning path**',
    learnAnswerItem: '- {title} ({type} · {level} · {lang}{free}){desc}',
    learnAnswerDesc: ': {text}',
    learnAnswerEmpty: 'No learning resources are cataloged yet.',
    learnAnswerNote: 'Suggested order: a systematic course first, then hands-on tools, then papers and advanced projects (full list on the Learning Resources page).',
    projectAnswerTitle: '**Projects (sorted by stars)**',
    projectAnswerItem: '- {name}{owner}: {summary}',
    projectAnswerEmpty: 'No projects are cataloged yet.',
    projectAnswerNote: 'See the Projects page for more (in-house projects + community picks).',
    openAnswerTitle: '**Open-weight models ({n})**',
    openAnswerItem: '- **{name}** ({org}){license}: context {ctx}',
    openAnswerEmpty: 'No open-weight models are flagged yet (or the data source is degraded).',
    openAnswerNote: 'Open weights do not mean free commercial use; follow the license text.',
    aboutAnswerTitle: '**About this site and its data sources**',
    aboutAnswerSite: '- Site: {name}{brand}',
    aboutAnswerGenerated: '- Data generated: {at}',
    aboutAnswerMode: '- Generation mode: {mode}',
    aboutAnswerSourcesTitle: '**Data source status**',
    aboutAnswerSourceLine: '- {name} ({type}): {status}{items}',
    aboutAnswerSourceItems: ' · {n} entries',
    aboutAnswerNoSources: '- See the About page for the data source list.',
    aboutAnswerNote: 'This is a static site refreshed on a schedule by GitHub Actions. The assistant runs offline by default and only contacts the model endpoint you configure.',
    fallbackTitle: '**Related entries found in the site data**',
    fallbackMissTitle: '**Nothing in the site data matched this topic directly**',
    fallbackMissHint: 'Offline mode can only answer from the data cataloged on this site. You can try:',
    fallbackMissItem1: '- "Which models have the longest context window?"',
    fallbackMissItem2: '- "Which models offer the best value?"',
    fallbackMissItem3: '- "Recommend beginner courses"',
    fallbackMissItem4: '- "This week\'s brief"',
    fallbackMissItem5: '- "What\'s new lately?"',
    fallbackFooter: '(offline mode · local search over site data; no external requests were made)',
    fallbackModelHit: '- Model **{name}** ({org}): context {ctx}, {price}{desc}',
    fallbackModelDesc: ' — {text}',
    fallbackNewsHit: '- Update {date} **{title}**',
    fallbackResourceHit: '- Resource {title} ({type} / {level})',
    fallbackProjectHit: '- Project {name}: {summary}',
    emptyQuestion: 'Ask me about models, leaderboards, updates, learning resources, or projects. (Offline mode can query the site data directly.)',
    modelsOverviewTitle: '**Model catalog overview**',
    modelsOverviewLine: 'The site catalogs {n} models{updated}.',
    modelsOverviewUpdated: ' (updated {date})',
    briefTitle: '# AI Pulse · This Week in AI',
    briefEmptyHeader: '> {date} · generated offline',
    briefEmptyBody: 'Site data is unavailable. Please try again once the data has been generated.',
    briefMeta: '> {date} · data updated {updated} · generated offline (no API key needed)',
    briefUnknownDate: 'unknown',
    briefSection1: '## 1. Key numbers',
    briefNumbers: '- Models **{models}** · updates **{news}** · leaderboards **{boards}** · learning resources **{resources}** · projects **{projects}**',
    briefSources: '- Data sources {ok}/{total} OK',
    briefSourcesDegraded: ', {n} degraded (follow the labels on the page)',
    briefSection2: '## 2. New models this week',
    briefNewModel: '- **{name}** ({org}): context {ctx}, {price}, {date}',
    briefNoNewModels: '- No new models recorded this week (see the Model Catalog for the latest).',
    briefSection3: '## 3. Leaderboard signals',
    briefBoardLine: '- **{name}**: {entries}',
    briefNoBoards: '- Leaderboard data is unavailable.',
    briefSection4: '## 4. Updates worth reading',
    briefNewsLine: '- **{title}**{summary}{link}',
    briefNewsSummary: ': {text}',
    briefNewsLink: ' ([source]({url}))',
    briefNoNews: '- No updates.',
    briefSection5: '## 5. Learning and projects',
    briefLearnLine: '- Learning: {title} ({type} / {level})',
    briefProjectLine: '- Project: {title}: {summary}',
    briefNoLearn: '- No learning resource or project updates.',
    briefFooter: 'Source: AI Pulse <{url}> | Generated offline by the site\'s built-in assistant; refer to the live site for current data.',
    sharePrefix: '{title} · {site}',
    plainLink: '$1 ($2)',
    warnBaseUrlInvalid: 'Must be a valid http(s) address; fell back to the default',
    warnHttpsOnly: 'For security, only https endpoints are allowed (http is accepted for localhost / 127.0.0.1); fell back to the default',
  },
};

/** Translate a content template key with `{placeholder}` interpolation. */
function tr(lang, key, vars = {}) {
  const code = normalizeLang(lang);
  const dict = TEXT[code];
  const template = dict[key] ?? TEXT.zh[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}


const hasCjk = (value) => /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/.test(String(value || ''));
const contentField = (obj, field, lang) => {
  if (!obj) return '';
  if (lang === 'en') {
    const en = obj[`${field}En`];
    return en || (hasCjk(obj[field]) ? '' : obj[field] || '');
  }
  return obj[field] || obj[`${field}En`] || '';
};
const BOARD_NAME_EN = {
  'artificial-analysis-intelligence': 'Artificial Analysis Intelligence Index',
  'context-window': 'Context Window Leaderboard',
  'epoch-eci': 'Epoch AI ECI Capability Index',
  'epoch-gpqa-diamond': 'GPQA Diamond (Epoch)',
  'epoch-swe-bench-verified': 'SWE-bench Verified (Epoch)',
  'livebench-2.0': 'LiveBench 2.0 Overall',
  'lmarena-text': 'LMArena Text Leaderboard',
  'opencompass-arena': 'OpenCompass Chinese Arena',
  'opencompass-arena-mm': 'OpenCompass Multimodal Arena',
  'output-price': 'Output Price Leaderboard (cheapest first)',
};
const boardDisplayName = (board, lang) => {
  if (!board) return '';
  if (lang === 'en') return BOARD_NAME_EN[board.id] || (hasCjk(board.name) ? String(board.id || '') : board.name || String(board.id || ''));
  return board.name || board.id || '';
};
const SOURCE_NAME_EN = {
  openrouter: 'OpenRouter Models API',
  livebench: 'LiveBench 2.0',
  'epoch-ai': 'Epoch AI Benchmarking',
  opencompass: 'OpenCompass',
  'artificial-analysis': 'Artificial Analysis',
  'rss-openai': 'OpenAI News RSS',
  'rss-gdm': 'Google DeepMind Blog RSS',
  'rss-google-ai': 'Google AI Blog RSS',
  'rss-qwen': 'Qwen Blog RSS',
  'rss-aws-ml': 'AWS Machine Learning Blog RSS',
  'rss-mit-ai': 'MIT News AI RSS',
  'rss-bair': 'Berkeley BAIR Blog RSS',
  github: 'GitHub API (project stars)',
  'github-releases': 'GitHub Releases (OSS updates)',
  'hf-mirror': 'Hugging Face Mirror',
  huggingface: 'Hugging Face API',
  lmarena: 'LMArena (HF dataset)',
  superclue: 'SuperCLUE',
  'deepseek-news': 'DeepSeek Change Log',
  'hn-ai': 'Hacker News AI',
};
const sourceDisplayName = (source, lang) => {
  if (!source) return '';
  if (lang === 'en') return SOURCE_NAME_EN[source.id] || (hasCjk(source.name) ? String(source.id || '') : source.name || String(source.id || ''));
  return source.name || source.id || '';
};

/* ------------------------------------------------------------------ *
 * 1. Text / byte helpers
 * ------------------------------------------------------------------ **/

/** UTF-8 byte count (3 bytes per Chinese character, 4 per emoji). */
export function utf8Bytes(text = '') {
  return encoder.encode(String(text)).length;
}

/** Truncate by UTF-8 bytes without splitting code points (never emits replacement characters); appends an ellipsis when over budget. */
export function truncateUtf8(text = '', maxBytes = CONTEXT_MAX_BYTES, suffix = '…') {
  const str = String(text ?? '');
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return '';
  if (utf8Bytes(str) <= maxBytes) return str;
  const suffixBytes = utf8Bytes(suffix);
  // Fall back to pure truncation when the budget is too small (no suffix)
  if (suffixBytes >= maxBytes) {
    let out = '';
    let used = 0;
    for (const ch of str) {
      const b = utf8Bytes(ch);
      if (used + b > maxBytes) break;
      out += ch;
      used += b;
    }
    return out;
  }
  const budget = maxBytes - suffixBytes;
  let out = '';
  let used = 0;
  for (const ch of str) {
    const b = utf8Bytes(ch);
    if (used + b > budget) break;
    out += ch;
    used += b;
  }
  return out + suffix;
}

/** Clip by whole lines to maxBytes (keeping the title and earlier lines first) so the result never exceeds maxBytes. */
export function fitLinesToBytes(text = '', maxBytes = CONTEXT_MAX_BYTES, marker = '\n…（上下文已截断）') {
  const str = String(text ?? '');
  if (utf8Bytes(str) <= maxBytes) return str;
  const markerBytes = utf8Bytes(marker);
  const budget = Math.max(0, maxBytes - markerBytes);
  const lines = str.split('\n');
  let out = '';
  for (const line of lines) {
    const candidate = out ? `${out}\n${line}` : line;
    if (utf8Bytes(candidate) > budget) break;
    out = candidate;
  }
  if (!out) return truncateUtf8(str, maxBytes);
  return out + marker;
}

export function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ *
 * 2. Data access helpers (support both loadAll() "file objects" and plain arrays)
 * ------------------------------------------------------------------ **/

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickMeta(data) {
  const meta = data && data.meta && typeof data.meta === 'object' ? data.meta : null;
  return meta || {};
}

/** models.json -> model array; also supports data.models being an array directly. */
export function getModels(data) {
  const node = data && data.models;
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.models)) return node.models;
  return [];
}
export function getNews(data) {
  const node = data && data.news;
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.items)) return node.items;
  return [];
}
export function getBoards(data) {
  const node = data && data.rankings;
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.boards)) return node.boards;
  return [];
}
export function getResources(data) {
  const node = data && data.resources;
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.items)) return node.items;
  return [];
}
export function getProjects(data) {
  const node = data && data.projects;
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.items)) return node.items;
  return [];
}
function getSources(meta) {
  return asArray(meta && meta.sources);
}

/* ------------------------------ Formatting ------------------------------ */

export function shortDate(iso) {
  if (!iso) return '';
  const s = String(iso);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

export function fmtContextWindow(tokens, lang = 'zh') {
  const code = normalizeLang(lang);
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return tr(code, 'unknownContext');
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

export function fmtPrice(pricing, lang = 'zh') {
  const code = normalizeLang(lang);
  if (!pricing || typeof pricing !== 'object') return tr(code, 'unknownPrice');
  const norm = (v) => (Number.isFinite(v) && v >= 0 ? Number(v) : null);
  const input = norm(Number(pricing.input));
  const output = norm(Number(pricing.output));
  if (input === null && output === null) return tr(code, 'unknownPrice');
  const fmt = (v) => (v === null ? '-' : `$${Number(v.toFixed(4))}`);
  return `${fmt(input)}/${fmt(output)} ${tr(code, 'perMillionTokens')}`;
}

/** Total price per model (input + output; unknown/negative values are not comparable) used for value-for-money ranking. */
export function priceScore(model) {
  const p = model && model.pricing;
  if (!p) return Number.POSITIVE_INFINITY;
  const norm = (v) => (Number.isFinite(v) && v >= 0 ? Number(v) : null);
  const i = norm(Number(p.input));
  const o = norm(Number(p.output));
  if (i === null && o === null) return Number.POSITIVE_INFINITY;
  const sum = (i ?? 0) + (o ?? 0);
  return sum;
}

/** Display name: strip a duplicate "Org: " prefix (OpenRouter catalog style). */
export function modelDisplayName(model, lang = 'zh') {
  const name = String((model && (model.name || model.id)) || tr(normalizeLang(lang), 'untitledModel'));
  const org = String((model && model.org) || '').trim();
  if (org && name.toLowerCase().startsWith(`${org.toLowerCase()}: `)) return name.slice(org.length + 2);
  if (org && name.toLowerCase().startsWith(`${org.toLowerCase()}/`)) return name.slice(org.length + 1);
  return name;
}

/**
 * Exclude routing/aggregator pseudo-models (e.g. Auto Router, Pareto Code Router, openrouter/auto).
 * These entries are not real models and their context/pricing data is not comparable, so offline
 * answers and briefs must exclude them.
 */
export function isRoutingPseudoModel(model) {
  if (!model) return false;
  const id = String(model.id || '').toLowerCase();
  const name = String(model.name || '').toLowerCase();
  return (
    /(^|[/:_-])auto([/:_-]|$)/.test(id) ||
    /router/.test(id) ||
    /router/.test(name) ||
    /auto router/.test(name) ||
    /自动路由/.test(name) ||
    /^openrouter\/auto/.test(id)
  );
}

/** Real model list (routing pseudo-models excluded). */
export function realModelsOf(models) {
  return asArray(models).filter((model) => model && !isRoutingPseudoModel(model));
}

function modelName(model, lang = 'zh') {
  return modelDisplayName(model, lang);
}
function modelOrg(model, lang = 'zh') {
  return String(
    (model && model.org) || (model && model.sourceIds && model.sourceIds[0]) || tr(normalizeLang(lang), 'unknownOrg'),
  );
}
function linkOrText(label, url) {
  if (!url || !/^https?:\/\//i.test(String(url))) return label;
  return `[${label}](${url})`;
}

function sortByDateDesc(items, key = 'publishedAt') {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a && a[key]) || 0;
    const tb = Date.parse(b && b[key]) || 0;
    if (tb !== ta) return tb - ta;
    return String((b && b.id) || '').localeCompare(String((a && a.id) || ''));
  });
}

/* ------------------------------------------------------------------ *
 * 3. buildContext: site data -> <=6KB summary
 * ------------------------------------------------------------------ **/

/**
 * Build the site-data summary injected into the system prompt.
 * @param {object} data loadAll() result or {meta,models,news,rankings,resources,projects}
 * @param {{maxBytes?:number, topModels?:number, topNews?:number, topResources?:number, topProjects?:number, lang?:'zh'|'en'}} opts
 * @returns {string} Markdown text of at most opts.maxBytes (default 6000 bytes)
 */
export function buildContext(data, opts = {}) {
  const lang = langOf(opts);
  const maxBytes = Number.isFinite(opts.maxBytes) ? opts.maxBytes : CONTEXT_MAX_BYTES;
  const topModels = opts.topModels ?? 5;
  const topNews = opts.topNews ?? 6;
  const topResources = opts.topResources ?? 5;
  const topProjects = opts.topProjects ?? 4;

  const meta = pickMeta(data);
  const models = getModels(data);
  const news = getNews(data);
  const boards = getBoards(data);
  const resources = getResources(data);
  const projects = getProjects(data);
  const sources = getSources(meta);
  const stats = (meta && typeof meta.stats === 'object' && meta.stats) || {};
  const hasAny = models.length || news.length || boards.length || resources.length || projects.length;

  const lines = [];
  lines.push(tr(lang, 'contextTitle'));
  const generatedAt = meta.generatedAt || (data && data.generatedAt) || '';
  let metaLine = tr(lang, 'contextGenerated', {
    at: generatedAt || tr(lang, 'contextGeneratedUnknown'),
  });
  if (stats.models || models.length) metaLine += tr(lang, 'contextModels', { n: stats.models ?? models.length });
  if (news.length) metaLine += tr(lang, 'contextNews', { n: stats.news ?? news.length });
  if (boards.length) metaLine += tr(lang, 'contextBoards', { n: stats.boards ?? boards.length });
  if (resources.length) metaLine += tr(lang, 'contextResources', { n: stats.resources ?? resources.length });
  if (projects.length) metaLine += tr(lang, 'contextProjects', { n: stats.projects ?? projects.length });
  lines.push(metaLine);
  if (sources.length) {
    const ok = sources.filter((s) => s && s.status === 'ok').length;
    const degraded = sources.filter((s) => s && s.status && s.status !== 'ok');
    lines.push(
      tr(lang, 'contextSources', { ok, total: sources.length }) +
        (degraded.length
          ? tr(lang, 'contextSourcesDegraded', {
              names: degraded.map((s) => sourceDisplayName(s, lang)).filter(Boolean).join(lang === 'en' ? ', ' : '、'),
            })
          : ''),
    );
  }
  const highlights = asArray(lang === 'en' ? meta.latestHighlightsEn : meta.latestHighlights).filter(Boolean).slice(0, 3);
  if (highlights.length) lines.push(tr(lang, 'contextHighlights', { items: highlights.join('；') }));

  if (!hasAny) {
    lines.push(tr(lang, 'contextNoData'));
    return fitLinesToBytes(lines.join('\n'), maxBytes, tr(lang, 'truncatedMarker'));
  }

  // ---- Models: most recent releases TOP N ----
  if (models.length) {
    const latest = [...realModelsOf(models)]
      .filter((m) => m && (m.releaseDate || m.name || m.id))
      .sort((a, b) => {
        const ta = Date.parse(a.releaseDate) || 0;
        const tb = Date.parse(b.releaseDate) || 0;
        if (tb !== ta) return tb - ta;
        return modelName(a).localeCompare(modelName(b));
      })
      .slice(0, topModels);
    lines.push('', tr(lang, 'contextModelsHeading'));
    for (const m of latest) {
      lines.push(
        tr(lang, 'contextModelLine', {
          name: modelName(m, lang),
          org: modelOrg(m, lang),
          ctx: fmtContextWindow(m.contextWindow, lang),
          price: fmtPrice(m.pricing, lang),
          weights: m.openWeights ? tr(lang, 'weightsOpen') : tr(lang, 'weightsClosed'),
          released: m.releaseDate ? tr(lang, 'releasedSuffix', { date: shortDate(m.releaseDate) }) : '',
        }),
      );
    }
  }

  // ---- Updates ----
  if (news.length) {
    const items = asArray(news)
      .filter((n) => n && (n.title || n.summary))
      .sort((a, b) => {
        const ia = Number(a.importance) || 0;
        const ib = Number(b.importance) || 0;
        if (ib !== ia) return ib - ia;
        return (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0);
      })
      .slice(0, topNews);
    lines.push('', tr(lang, 'contextNewsHeading'));
    for (const n of items) {
      const date = shortDate(n.publishedAt);
      const label = `${n.importance === 3 ? tr(lang, 'newsImportant') : ''}${date ? date + ' · ' : ''}${contentField(n, 'title', lang)}`;
      lines.push(`- [${label}](${n.url || n.sourceUrl || ''})`.replace(/\]\(\)$/, ']'));
    }
  }

  // ---- Leaderboards ----
  if (boards.length) {
    lines.push('', tr(lang, 'contextBoardsHeading'));
    for (const board of boards.filter(Boolean).slice(0, 4)) {
      const entries = asArray(board.entries).slice(0, 3);
      if (!entries.length) continue;
      const top = entries
        .map(
          (e) =>
            `${e.rank || '-'}. ${e.model || ''}${
              e.scoreDisplay != null ? tr(lang, 'scoreParen', { score: e.scoreDisplay }) : ''
            }`,
        )
        .join(' / ');
      lines.push(tr(lang, 'contextBoardLine', { name: boardDisplayName(board, lang) || tr(lang, 'boardFallback'), top }));
    }
  }

  // ---- Learning resources ----
  if (resources.length) {
    const picks = [...resources]
      .filter(Boolean)
      .sort((a, b) => (Number(!!b.featured) - Number(!!a.featured)) || (Number(!!a.free) - Number(!!b.free)))
      .slice(0, topResources);
    lines.push('', tr(lang, 'contextResourcesHeading'));
    for (const r of picks) {
      lines.push(
        tr(lang, 'resourceLine', {
          title: linkOrText(contentField(r, 'title', lang) || r.id || '', r.url),
          type: r.type || 'resource',
          level: r.level || '-',
          lang: r.lang || '-',
          free: r.free ? tr(lang, 'resourceFree') : '',
        }),
      );
    }
  }

  // ---- Projects ----
  if (projects.length) {
    const picks = [...projects]
      .filter(Boolean)
      .sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0))
      .slice(0, topProjects);
    lines.push('', tr(lang, 'contextProjectsHeading'));
    for (const p of picks) {
      lines.push(
        tr(lang, 'projectLine', {
          name: linkOrText(contentField(p, 'name', lang) || p.id || '', p.url),
          summary: String(contentField(p, 'summary', lang) || contentField(p, 'highlight', lang) || '').slice(0, 80),
        }),
      );
    }
  }

  return fitLinesToBytes(lines.join('\n'), maxBytes, tr(lang, 'truncatedMarker'));
}

/** Build the system prompt; the site summary is the "fact context". */
export function buildSystemPrompt(context = '', opts = {}) {
  const lang = langOf(opts);
  const site = opts.siteName || pick(lang, 'AI Pulse · 照胆云', 'AI Pulse · Z Cloud');
  const siteUrl = opts.siteUrl || 'https://chengxi-z.github.io/llm-pulse/';
  return [
    tr(lang, 'promptPersona', { site }),
    tr(lang, 'promptRules'),
    tr(lang, 'promptBrief'),
    '',
    tr(lang, 'promptContextLabel'),
    context || tr(lang, 'promptNoData'),
    '',
    tr(lang, 'promptSiteUrl', { url: siteUrl }),
    tr(lang, 'promptToday', { date: opts.today || new Date().toISOString().slice(0, 10) }),
    tr(lang, 'promptOfflineNote'),
  ].join('\n');
}

/** Assemble OpenAI-compatible messages: system + recent history + current question. */
export function composeMessages(question, context, history = [], opts = {}) {
  const messages = [{ role: 'system', content: buildSystemPrompt(context, opts) }];
  const turns = asArray(history)
    .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-MAX_HISTORY_TURNS * 2);
  for (const turn of turns) messages.push({ role: turn.role, content: turn.content });
  messages.push({ role: 'user', content: String(question ?? '').trim() });
  return messages;
}

/* ------------------------------------------------------------------ *
 * 4. OpenAI-compatible streaming parser (SSE)
 * ------------------------------------------------------------------ **/

/** Extract incremental text from a single SSE data JSON; supports delta / message / plain text. */
export function extractDelta(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (payload.error) return '';
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (choice) {
    const delta = choice.delta || choice.message || {};
    if (typeof delta.content === 'string') return delta.content;
    if (Array.isArray(delta.content)) {
      // Some compatible endpoints send array chunks (newer OpenAI format)
      return delta.content.map((part) => (part && (part.text || part.content)) || '').join('');
    }
    if (typeof choice.text === 'string') return choice.text;
  }
  if (typeof payload.text === 'string') return payload.text;
  return '';
}

/** Parse one data line; returns {ok:false} on failure instead of throwing. */
export function parseSSEData(dataText) {
  const raw = String(dataText ?? '').trim();
  if (!raw) return { ok: false, done: false, json: null };
  if (raw === '[DONE]') return { ok: true, done: true, json: null };
  try {
    return { ok: true, done: false, json: JSON.parse(raw) };
  } catch {
    return { ok: false, done: false, json: null, raw };
  }
}

/**
 * Create an incremental SSE parser.
 * push(chunk) accepts string / Uint8Array / ArrayBuffer; a streaming TextDecoder is used
 * internally, so arbitrary byte boundaries (including split Chinese / emoji characters)
 * decode correctly.
 * @returns {{push:(chunk:any)=>{deltas:string[], events:object[], done:boolean, errors:Array}, end:()=>{deltas:string[],events:object[],done:boolean}, reset:()=>void}}
 */
export function createSSEParser() {
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  let buffer = '';
  let headerField = '';
  let dataLines = [];
  let sawEvent = false;
  let done = false;
  let events = [];
  let deltas = [];
  let errors = [];

  function resetAccumulators() {
    events = [];
    deltas = [];
    errors = [];
  }

  function dispatch() {
    if (!sawEvent) {
      dataLines = [];
      headerField = '';
      return;
    }
    const data = dataLines.join('\n');
    sawEvent = false;
    dataLines = [];
    headerField = '';
    const parsed = parseSSEData(data);
    if (parsed.done) {
      done = true;
      return;
    }
    if (!parsed.ok) {
      if (data) errors.push(data.slice(0, 200));
      return;
    }
    if (parsed.json) {
      events.push(parsed.json);
      const text = extractDelta(parsed.json);
      if (text) deltas.push(text);
      if (parsed.json.error) {
        errors.push(
          String(parsed.json.error.message || parsed.json.error.code || 'SSE error').slice(0, 200)
        );
      }
    }
  }

  function feedLines() {
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line === '') {
        // Event boundary (blank line)
        dispatch();
        continue;
      }
      if (line.startsWith(':')) continue; // SSE comment / heartbeat
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') {
        sawEvent = true;
        dataLines.push(value);
      } else if (field === 'event') {
        sawEvent = true;
      } else if (field === 'id' || field === 'retry') {
        // Ignore
      }
    }
  }

  function push(chunk) {
    resetAccumulators();
    if (done) return { deltas: [], events: [], done: true, errors: [] };
    if (typeof chunk === 'string') {
      buffer += chunk;
    } else if (chunk instanceof Uint8Array) {
      buffer += decoder ? decoder.decode(chunk, { stream: true }) : new TextDecoder('utf-8').decode(chunk);
    } else if (chunk instanceof ArrayBuffer) {
      buffer += decoder
        ? decoder.decode(new Uint8Array(chunk), { stream: true })
        : new TextDecoder('utf-8').decode(new Uint8Array(chunk));
    } else if (chunk != null) {
      buffer += String(chunk);
    }
    feedLines();
    return { deltas: [...deltas], events: [...events], done, errors: [...errors] };
  }

  function end() {
    resetAccumulators();
    if (decoder) buffer += decoder.decode(); // Flush an unfinished multi-byte sequence
    // The last line may not end with a newline
    if (buffer.length) {
      if (buffer.endsWith('\r')) buffer = buffer.slice(0, -1);
      const lines = buffer.split('\n');
      buffer = '';
      for (const raw of lines) {
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        if (!line) continue;
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'data') {
          sawEvent = true;
          dataLines.push(value);
        } else if (field === 'event') sawEvent = true;
      }
    }
    // Emit the final event when the stream ends without a trailing blank line
    dispatch();
    return { deltas: [...deltas], events: [...events], done, errors: [...errors] };
  }

  return {
    push,
    end,
    reset() {
      buffer = '';
      dataLines = [];
      headerField = '';
      sawEvent = false;
      done = false;
      resetAccumulators();
    },
    get done() {
      return done;
    },
  };
}

/** Parse a complete SSE text at once (for tests / non-streaming replay). */
export function parseSSE(text) {
  const parser = createSSEParser();
  const first = parser.push(String(text ?? ''));
  const last = parser.end();
  return {
    deltas: [...first.deltas, ...last.deltas],
    events: [...first.events, ...last.events],
    done: first.done || last.done,
    errors: [...first.errors, ...last.errors],
    text: [...first.deltas, ...last.deltas].join(''),
  };
}

/* ------------------------------------------------------------------ *
 * 5. Config / request / error classification
 * ------------------------------------------------------------------ **/

/** Hostnames where a plain-http endpoint is acceptable (local model servers). */
function isLocalHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/**
 * Validate a BYOK endpoint URL. HTTPS is always required; plain HTTP is only
 * accepted for loopback hosts so API keys never travel over an unencrypted
 * network connection.
 * @returns {{ ok: boolean, insecure: boolean }}
 */
export function checkEndpointUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: false, insecure: false };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, insecure: false };
  }
  if (parsed.protocol === 'https:') return { ok: true, insecure: false };
  if (parsed.protocol === 'http:') {
    return { ok: isLocalHostname(parsed.hostname), insecure: !isLocalHostname(parsed.hostname) };
  }
  return { ok: false, insecure: false };
}

/** Normalize BYOK config; invalid/insecure values fall back to defaults and report localized warnings. */
export function normalizeConfig(raw = {}, opts = {}) {
  const lang = langOf(opts);
  const warnings = [];
  const input = raw && typeof raw === 'object' ? raw : {};
  let baseUrl = String(input.baseUrl ?? DEFAULT_CONFIG.baseUrl).trim();
  const endpoint = checkEndpointUrl(baseUrl);
  if (!endpoint.ok) {
    warnings.push(tr(lang, endpoint.insecure ? 'warnHttpsOnly' : 'warnBaseUrlInvalid'));
    baseUrl = DEFAULT_CONFIG.baseUrl;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');
  const model = String(input.model ?? DEFAULT_CONFIG.model).trim() || DEFAULT_CONFIG.model;
  const apiKey = String(input.apiKey ?? '').trim();
  return { config: { baseUrl, model, apiKey }, warnings };
}

/** Build the full /chat/completions URL (accepts a /v1 base or a complete endpoint from the form). */
export function chatCompletionsUrl(baseUrl = DEFAULT_CONFIG.baseUrl) {
  let url = String(baseUrl ?? '').trim().replace(/\/+$/, '');
  // Defense in depth: never build a request URL for a rejected endpoint.
  if (!checkEndpointUrl(url).ok) url = DEFAULT_CONFIG.baseUrl;
  if (/\/chat\/completions$/i.test(url)) return url;
  return `${url}/chat/completions`;
}

export function buildChatPayload({ model, messages, stream = true, temperature, maxTokens } = {}) {
  const payload = {
    model: String(model || DEFAULT_CONFIG.model),
    messages: asArray(messages),
    stream: !!stream,
  };
  if (Number.isFinite(temperature)) payload.temperature = temperature;
  if (Number.isFinite(maxTokens)) payload.max_tokens = maxTokens;
  return payload;
}

/** Classify HTTP status / exceptions into friendly messages (bilingual, Chinese by default). */
export function classifyError(input = {}, opts = {}) {
  const lang = langOf(opts);
  const status = Number(input.status) || 0;
  const name = String(input.name || '');
  const raw = String(input.message || '');
  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      title: tr(lang, 'errAuthTitle'),
      message: tr(lang, 'errAuthMessage'),
      offlineAvailable: true,
    };
  }
  if (status === 404) {
    return {
      kind: 'notfound',
      title: tr(lang, 'errNotFoundTitle'),
      message: tr(lang, 'errNotFoundMessage'),
      offlineAvailable: true,
    };
  }
  if (status === 429) {
    return {
      kind: 'rate',
      title: tr(lang, 'errRateTitle'),
      message: tr(lang, 'errRateMessage'),
      offlineAvailable: true,
    };
  }
  if (status >= 500) {
    return {
      kind: 'server',
      title: tr(lang, 'errServerTitle'),
      message: tr(lang, 'errServerMessage'),
      offlineAvailable: true,
    };
  }
  if (status >= 400) {
    return {
      kind: 'bad-request',
      title: tr(lang, 'errBadRequestTitle'),
      message: tr(lang, 'errBadRequestMessage', { status }),
      offlineAvailable: true,
    };
  }
  if (name === 'AbortError' || name === 'TimeoutError') {
    return {
      kind: 'timeout',
      title: tr(lang, 'errTimeoutTitle'),
      message: tr(lang, 'errTimeoutMessage'),
      offlineAvailable: true,
    };
  }
  if (/load failed|failed to fetch|networkerror|network error/i.test(raw) || name === 'TypeError') {
    return {
      kind: 'network',
      title: tr(lang, 'errNetworkTitle'),
      message: tr(lang, 'errNetworkMessage'),
      offlineAvailable: true,
    };
  }
  return {
    kind: 'unknown',
    title: tr(lang, 'errUnknownTitle'),
    message: raw.slice(0, 160) || tr(lang, 'errUnknownMessage'),
    offlineAvailable: true,
  };
}

/* ------------------------------------------------------------------ *
 * 6. Offline answers: local keyword search + template answers
 * ------------------------------------------------------------------ **/

const INTENTS = [
  { id: 'brief', re: /简报|周报|本周|一周|摘要|要点|brief|weekly|summary/i },
  { id: 'context', re: /上下文|窗口|context|长文本|长上下文/i },
  { id: 'price', re: /性价比|便宜|价格|多少钱|费用|成本|price|cost|cheap|经济/i },
  { id: 'ranking', re: /排行|排名|榜单|榜|最强|最好|第一|top|leaderboard|arena|elo/i },
  { id: 'news', re: /动态|新闻|最新|发布|更新|news|release|最近/i },
  { id: 'learn', re: /学习|课程|教程|入门|资源|书|论文|视频|learn|course|tutorial|resource/i },
  { id: 'project', re: /项目|github|开源项目|repo|project/i },
  { id: 'open', re: /开源|开放权重|open.?weight|许可证|license|apache|mit/i },
  { id: 'models', re: /模型|models|有哪些模型|收录/i },
  { id: 'about', re: /数据源|来源|更新频率|多久更新|可信|可靠|关于|who|about|source/i },
];

export function detectIntent(question = '') {
  const q = String(question ?? '');
  for (const intent of INTENTS) if (intent.re.test(q)) return intent.id;
  return 'fallback';
}

function noDataAnswer(lang = 'zh') {
  return [
    tr(lang, 'noDataTitle'),
    '',
    tr(lang, 'noDataBody'),
    '',
    tr(lang, 'noDataHint'),
    tr(lang, 'noDataItem1'),
    tr(lang, 'noDataItem2'),
    tr(lang, 'noDataItem3'),
  ].join('\n');
}

function keywordsOf(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/[\s，。！？、,.!?;；:："'“”‘’()（）\[\]【】]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !/^(什么|怎么|如何|哪个|哪些|推荐|一下|现在|目前|请问|可以|这个)$/.test(w));
}

function matchesAny(text, words) {
  const lower = String(text || '').toLowerCase();
  return words.some((w) => lower.includes(w));
}

function answerContext(models, lang = 'zh') {
  const valid = realModelsOf(models).filter(
    (m) => Number.isFinite(Number(m && m.contextWindow)) && Number(m.contextWindow) > 0,
  );
  if (!valid.length) return tr(lang, 'contextAnswerEmpty');
  const top = [...valid].sort((a, b) => Number(b.contextWindow) - Number(a.contextWindow)).slice(0, 3);
  return [
    tr(lang, 'contextAnswerTitle', { n: top.length }),
    '',
    ...top.map((m, i) =>
      tr(lang, 'contextAnswerItem', {
        index: i + 1,
        name: modelName(m, lang),
        org: modelOrg(m, lang),
        ctx: fmtContextWindow(m.contextWindow, lang),
        price: fmtPrice(m.pricing, lang),
      }),
    ),
    '',
    tr(lang, 'contextAnswerTip'),
  ].join('\n');
}

function answerPrice(models, lang = 'zh') {
  const valid = realModelsOf(models)
    .filter((m) => m && Number.isFinite(priceScore(m)) && priceScore(m) > 0)
    .sort((a, b) => priceScore(a) - priceScore(b));
  if (!valid.length) return tr(lang, 'priceAnswerEmpty');
  const picks = valid.slice(0, 3);
  return [
    tr(lang, 'priceAnswerTitle'),
    '',
    ...picks.map((m, i) =>
      tr(lang, 'priceAnswerItem', {
        index: i + 1,
        name: modelName(m, lang),
        org: modelOrg(m, lang),
        price: fmtPrice(m.pricing, lang),
        ctx: fmtContextWindow(m.contextWindow, lang),
      }),
    ),
    '',
    tr(lang, 'priceAnswerNote'),
  ].join('\n');
}

function answerRanking(boards, lang = 'zh') {
  if (!boards.length) return tr(lang, 'rankingAnswerEmpty');
  const lines = [tr(lang, 'rankingAnswerTitle'), ''];
  for (const board of boards.slice(0, 5)) {
    const entries = asArray(board.entries).slice(0, 3);
    if (!entries.length) continue;
    lines.push(
      tr(lang, 'rankingAnswerBoard', {
        name: boardDisplayName(board, lang),
        updated: board.updatedAt ? tr(lang, 'rankingAnswerUpdated', { date: shortDate(board.updatedAt) }) : '',
      }),
    );
    for (const e of entries) {
      lines.push(
        tr(lang, 'rankingAnswerItem', {
          rank: e.rank || '-',
          model: e.model || '',
          score: e.scoreDisplay != null ? tr(lang, 'rankingAnswerScore', { score: e.scoreDisplay }) : '',
        }),
      );
    }
    lines.push('');
  }
  lines.push(tr(lang, 'rankingAnswerNote'));
  return lines.join('\n');
}

function answerNews(news, limit = 5, lang = 'zh') {
  if (!news.length) return tr(lang, 'newsAnswerEmpty');
  const items = sortByDateDesc(news).slice(0, limit);
  return [
    tr(lang, 'newsAnswerTitle', { n: items.length }),
    '',
    ...items.map((n) =>
      tr(lang, 'newsAnswerItem', {
        important: n.importance === 3 ? `**${tr(lang, 'newsImportant').trim()}** ` : '',
        date: shortDate(n.publishedAt),
        title: contentField(n, 'title', lang),
        source: n.url ? tr(lang, 'newsAnswerSource', { url: n.url }) : '',
      }),
    ),
    '',
    tr(lang, 'newsAnswerNote'),
  ].join('\n');
}

function answerLearn(resources, lang = 'zh') {
  if (!resources.length) return tr(lang, 'learnAnswerEmpty');
  const beginner = resources.filter((r) => r && String(r.level) === 'beginner');
  const pool = (beginner.length ? beginner : resources).slice(0, 4);
  return [
    tr(lang, 'learnAnswerTitle'),
    '',
    ...pool.map((r) =>
      tr(lang, 'learnAnswerItem', {
        title: linkOrText(`${contentField(r, 'title', lang) || r.id}`, r.url),
        type: r.type || 'resource',
        level: r.level || '-',
        lang: r.lang || '-',
        free: r.free ? tr(lang, 'resourceFree') : '',
        desc: contentField(r, 'description', lang) ? tr(lang, 'learnAnswerDesc', { text: String(contentField(r, 'description', lang)).slice(0, 60) }) : '',
      }),
    ),
    '',
    tr(lang, 'learnAnswerNote'),
  ].join('\n');
}

function answerProjects(projects, lang = 'zh') {
  if (!projects.length) return tr(lang, 'projectAnswerEmpty');
  const picks = [...projects].sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0)).slice(0, 4);
  return [
    tr(lang, 'projectAnswerTitle'),
    '',
    ...picks.map((p) =>
      tr(lang, 'projectAnswerItem', {
        name: linkOrText(contentField(p, 'name', lang) || p.id, p.url),
        owner: p.owner ? pick(lang, `（@${p.owner}）`, ` (@${p.owner})`) : '',
        summary: String(contentField(p, 'summary', lang) || contentField(p, 'highlight', lang) || '').slice(0, 70),
      }),
    ),
    '',
    tr(lang, 'projectAnswerNote'),
  ].join('\n');
}

function answerOpen(models, lang = 'zh') {
  const open = realModelsOf(models).filter((m) => m && m.openWeights);
  if (!open.length) return tr(lang, 'openAnswerEmpty');
  const picks = open.slice(0, 5);
  return [
    tr(lang, 'openAnswerTitle', { n: open.length }),
    '',
    ...picks.map((m) =>
      tr(lang, 'openAnswerItem', {
        name: modelName(m, lang),
        org: modelOrg(m, lang),
        license: m.license ? ` · ${m.license}` : '',
        ctx: fmtContextWindow(m.contextWindow, lang),
      }),
    ),
    '',
    tr(lang, 'openAnswerNote'),
  ].join('\n');
}

function answerAbout(meta, data, lang = 'zh') {
  const sources = getSources(meta);
  const lines = [tr(lang, 'aboutAnswerTitle'), ''];
  if (meta.site) {
    lines.push(
      tr(lang, 'aboutAnswerSite', {
        name: lang === 'en' ? 'AI Pulse · Z Cloud' : meta.site.name || 'AI Pulse',
        brand: lang === 'en' ? '' : meta.site.brand ? ` · ${meta.site.brand}` : '',
      }),
    );
  }
  if (meta.generatedAt) lines.push(tr(lang, 'aboutAnswerGenerated', { at: meta.generatedAt }));
  if (meta.mode) lines.push(tr(lang, 'aboutAnswerMode', { mode: meta.mode }));
  if (sources.length) {
    lines.push('', tr(lang, 'aboutAnswerSourcesTitle'));
    for (const s of sources.slice(0, 10)) {
      lines.push(
        tr(lang, 'aboutAnswerSourceLine', {
          name: sourceDisplayName(s, lang),
          type: s.type || '-',
          status: s.status || tr(lang, 'unknownContext'),
          items: s.items != null ? tr(lang, 'aboutAnswerSourceItems', { n: s.items }) : '',
        }),
      );
    }
  } else {
    lines.push(tr(lang, 'aboutAnswerNoSources'));
  }
  lines.push('', tr(lang, 'aboutAnswerNote'));
  return lines.join('\n').slice(0, 2000);
}

function answerFallback(question, data, lang = 'zh') {
  const models = getModels(data);
  const news = getNews(data);
  const resources = getResources(data);
  const projects = getProjects(data);
  const words = keywordsOf(question);
  const hits = [];

  for (const m of realModelsOf(models)) {
    const text = `${m.name || ''} ${m.id || ''} ${m.org || ''} ${m.description || ''}`;
    if (matchesAny(text, words)) {
      hits.push(
        tr(lang, 'fallbackModelHit', {
          name: modelName(m, lang),
          org: modelOrg(m, lang),
          ctx: fmtContextWindow(m.contextWindow, lang),
          price: fmtPrice(m.pricing, lang),
          desc: m.description ? tr(lang, 'fallbackModelDesc', { text: String(m.description).slice(0, 60) }) : '',
        }),
      );
    }
    if (hits.length >= 3) break;
  }
  for (const n of news) {
    const text = `${n.title || ''} ${n.summary || ''} ${asArray(n.tags).join(' ')}`;
    if (matchesAny(text, words)) {
      hits.push(tr(lang, 'fallbackNewsHit', { date: shortDate(n.publishedAt), title: contentField(n, 'title', lang) }));
    }
    if (hits.length >= 6) break;
  }
  for (const r of resources) {
    const text = `${r.title || ''} ${r.description || ''} ${asArray(r.tags).join(' ')}`;
    if (matchesAny(text, words)) {
      hits.push(
        tr(lang, 'fallbackResourceHit', {
          title: linkOrText(contentField(r, 'title', lang), r.url),
          type: r.type || '-',
          level: r.level || '-',
        }),
      );
    }
    if (hits.length >= 8) break;
  }
  for (const p of projects) {
    const text = `${p.name || ''} ${p.summary || ''} ${asArray(p.tags).join(' ')}`;
    if (matchesAny(text, words)) {
      hits.push(
        tr(lang, 'fallbackProjectHit', {
          name: linkOrText(contentField(p, 'name', lang), p.url),
          summary: String(contentField(p, 'summary', lang) || '').slice(0, 60),
        }),
      );
    }
    if (hits.length >= 10) break;
  }

  const body = hits.length
    ? [tr(lang, 'fallbackTitle'), '', ...hits.slice(0, 6)]
    : [
        tr(lang, 'fallbackMissTitle'),
        '',
        tr(lang, 'fallbackMissHint'),
        tr(lang, 'fallbackMissItem1'),
        tr(lang, 'fallbackMissItem2'),
        tr(lang, 'fallbackMissItem3'),
        tr(lang, 'fallbackMissItem4'),
        tr(lang, 'fallbackMissItem5'),
      ];
  return [...body, '', tr(lang, 'fallbackFooter')].join('\n');
}

/**
 * Offline answers: keyword search over site data plus template answers, returned as Markdown.
 * Called by the UI when no key is configured or the request fails, so the assistant always works.
 * @param {string} question
 * @param {object} data loadAll() result or null
 * @param {{now?:Date, lang?:'zh'|'en'}} [opts]
 * @returns {string}
 */
export function localAnswer(question, data, opts = {}) {
  const lang = langOf(opts);
  const q = String(question ?? '').trim();
  if (!q) return tr(lang, 'emptyQuestion');
  const meta = pickMeta(data);
  const models = getModels(data);
  const news = getNews(data);
  const boards = getBoards(data);
  const resources = getResources(data);
  const projects = getProjects(data);
  const hasAny = models.length || news.length || boards.length || resources.length || projects.length;
  if (!hasAny) return noDataAnswer(lang);

  const intent = detectIntent(q);
  switch (intent) {
    case 'brief':
      return buildBrief(data, opts);
    case 'context':
      return answerContext(models, lang);
    case 'price':
      return answerPrice(models, lang);
    case 'ranking':
      return answerRanking(boards, lang);
    case 'news':
      return answerNews(news, 5, lang);
    case 'learn':
      return answerLearn(resources, lang);
    case 'project':
      return /开源|open.?source|open.?weight/i.test(q) ? answerOpen(models, lang) : answerProjects(projects, lang);
    case 'open':
      return answerOpen(models, lang);
    case 'models':
      return [
        tr(lang, 'modelsOverviewTitle'),
        '',
        tr(lang, 'modelsOverviewLine', {
          n: models.length,
          updated: meta.generatedAt
            ? tr(lang, 'modelsOverviewUpdated', { date: shortDate(meta.generatedAt) })
            : '',
        }),
        '',
        ...answerContext(models, lang).split('\n').slice(2),
      ].join('\n');
    case 'about':
      return answerAbout(meta, data, lang);
    default:
      return answerFallback(q, data, lang);
  }
}

/* ------------------------------------------------------------------ *
 * 7. Weekly brief
 * ------------------------------------------------------------------ **/

/**
 * Generate the "This Week in AI" Markdown brief (works offline, one-click share).
 * @param {object} data
 * @param {{now?:Date, siteUrl?:string, maxNews?:number, lang?:'zh'|'en'}} [opts]
 */
export function buildBrief(data, opts = {}) {
  const lang = langOf(opts);
  const now = opts.now instanceof Date && !Number.isNaN(opts.now.getTime()) ? opts.now : new Date();
  const siteUrl = opts.siteUrl || 'https://chengxi-z.github.io/llm-pulse/';
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const meta = pickMeta(data);
  const models = getModels(data);
  const news = getNews(data);
  const boards = getBoards(data);
  const resources = getResources(data);
  const projects = getProjects(data);
  if (!models.length && !news.length && !boards.length && !resources.length && !projects.length) {
    return [
      tr(lang, 'briefTitle'),
      '',
      tr(lang, 'briefEmptyHeader', { date: today }),
      '',
      tr(lang, 'briefEmptyBody'),
    ].join('\n');
  }

  const stats = meta.stats || {};
  const lines = [];
  lines.push(tr(lang, 'briefTitle'));
  lines.push('');
  lines.push(
    tr(lang, 'briefMeta', {
      date: today,
      updated: meta.generatedAt ? shortDate(meta.generatedAt) : tr(lang, 'briefUnknownDate'),
    }),
  );
  lines.push('');

  lines.push(tr(lang, 'briefSection1'));
  lines.push(
    tr(lang, 'briefNumbers', {
      models: stats.models ?? models.length,
      news: stats.news ?? news.length,
      boards: stats.boards ?? boards.length,
      resources: stats.resources ?? resources.length,
      projects: stats.projects ?? projects.length,
    }),
  );
  const sources = getSources(meta);
  if (sources.length) {
    const ok = sources.filter((s) => s && s.status === 'ok').length;
    lines.push(
      tr(lang, 'briefSources', { ok, total: sources.length }) +
        (ok < sources.length
          ? tr(lang, 'briefSourcesDegraded', { n: sources.length - ok })
          : ''),
    );
  }
  lines.push('');

  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const newModels = realModelsOf(models)
    .filter((m) => m && m.releaseDate && (Date.parse(m.releaseDate) || 0) >= weekAgo)
    .sort((a, b) => (Date.parse(b.releaseDate) || 0) - (Date.parse(a.releaseDate) || 0))
    .slice(0, 5);
  lines.push(tr(lang, 'briefSection2'));
  if (newModels.length) {
    for (const m of newModels) {
      lines.push(
        tr(lang, 'briefNewModel', {
          name: modelName(m, lang),
          org: modelOrg(m, lang),
          ctx: fmtContextWindow(m.contextWindow, lang),
          price: fmtPrice(m.pricing, lang),
          date: shortDate(m.releaseDate),
        }),
      );
    }
  } else {
    lines.push(tr(lang, 'briefNoNewModels'));
  }
  lines.push('');

  lines.push(tr(lang, 'briefSection3'));
  const boardLines = [];
  for (const board of boards.slice(0, 4)) {
    const entries = asArray(board.entries).slice(0, 3);
    if (!entries.length) continue;
    boardLines.push(
      tr(lang, 'briefBoardLine', {
        name: boardDisplayName(board, lang),
        entries: entries.map((e) => `${e.rank || '-'}. ${e.model || ''}`).join(' / '),
      }),
    );
  }
  lines.push(...(boardLines.length ? boardLines : [tr(lang, 'briefNoBoards')]));
  lines.push('');

  lines.push(tr(lang, 'briefSection4'));
  const topNews = sortByDateDesc(news)
    .sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0))
    .slice(0, Number(opts.maxNews) || 5);
  if (topNews.length) {
    for (const n of topNews) {
      lines.push(
        tr(lang, 'briefNewsLine', {
          title: contentField(n, 'title', lang),
          summary: n.summary ? tr(lang, 'briefNewsSummary', { text: String(n.summary).slice(0, 100) }) : '',
          link: n.url ? tr(lang, 'briefNewsLink', { url: n.url }) : '',
        }),
      );
    }
  } else {
    lines.push(tr(lang, 'briefNoNews'));
  }
  lines.push('');

  lines.push(tr(lang, 'briefSection5'));
  const learn = resources.filter((r) => r && r.featured).slice(0, 2);
  const learnPool = learn.length ? learn : resources.slice(0, 2);
  for (const r of learnPool) {
    lines.push(
      tr(lang, 'briefLearnLine', {
        title: linkOrText(contentField(r, 'title', lang), r.url),
        type: r.type || '-',
        level: r.level || '-',
      }),
    );
  }
  const proj = [...projects].sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0)).slice(0, 2);
  for (const p of proj) {
    // Project summaries are source data (often Chinese); keep the English brief clean.
    const summary = lang === 'en' ? (contentField(p, 'summary', lang) ? String(contentField(p, 'summary', lang)).slice(0, 60) : '') : String(p.summary || '').slice(0, 60);
    lines.push(tr(lang, 'briefProjectLine', { title: linkOrText(contentField(p, 'name', lang), p.url), summary }));
  }
  if (!learnPool.length && !proj.length) lines.push(tr(lang, 'briefNoLearn'));
  lines.push('');
  lines.push('---');
  lines.push(tr(lang, 'briefFooter', { url: siteUrl }));
  return lines.join('\n');
}

/** Markdown -> plain text (used when copying to WeChat/group chats). */
export function markdownToPlain(markdown = '', opts = {}) {
  const lang = langOf(opts);
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, tr(lang, 'plainLink'))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------------ *
 * 8. safeMarkdown: escape-first Markdown-lite rendering
 * ------------------------------------------------------------------ **/

const PH = '\u0000';

function renderInline(escapedText = '') {
  const codes = [];
  let text = String(escapedText).replace(/`([^`\n]+)`/g, (_m, code) => {
    codes.push(code);
    return `${PH}${codes.length - 1}${PH}`;
  });

  // Links may only use http(s); quotes in href are already handled by escapeHtml
  text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  // Restore inline code (inner content stays in its escaped, safe form)
  text = text.replace(new RegExp(`${PH}(\\d+)${PH}`, 'g'), (_m, i) => `<code>${codes[Number(i)] ?? ''}</code>`);
  return text;
}

function renderBlocks(escapedText = '') {
  const lines = String(escapedText).split('\n');
  const html = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  let inCode = false;
  let codeBuf = [];
  let codeLang = '';

  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${para.map((line) => renderInline(line)).join('<br>')}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw;
    // Fenced code blocks
    if (/^\s*```/.test(line)) {
      if (!inCode) {
        flushPara();
        closeList();
        inCode = true;
        codeBuf = [];
        codeLang = line.replace(/^\s*```/, '').trim();
      } else {
        html.push(`<pre class="md-pre"><code${codeLang ? ` class="lang-${escapeHtml(codeLang)}"` : ''}>${codeBuf.join('\n')}</code></pre>`);
        inCode = false;
        codeBuf = [];
        codeLang = '';
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeList();
      const level = Math.min(4, heading[1].length + 1); // # -> h2 (h1 is too large inside chat bubbles)
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara();
      closeList();
      html.push('<hr>');
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara();
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (list !== 'ul') {
        closeList();
        html.push('<ul>');
        list = 'ul';
      }
      html.push(`<li>${renderInline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (list !== 'ol') {
        closeList();
        html.push('<ol>');
        list = 'ol';
      }
      html.push(`<li>${renderInline(ol[1])}</li>`);
      continue;
    }
    closeList();
    para.push(line);
  }
  if (inCode) {
    html.push(`<pre class="md-pre"><code>${codeBuf.join('\n')}</code></pre>`);
  }
  flushPara();
  closeList();
  return html.join('');
}

/**
 * Markdown-lite -> safe HTML (escape first, then render; links may only use http(s)).
 * Supports: bold, inline code, fenced code, headings, lists, quotes, dividers, links, line breaks.
 */
export function safeMarkdown(input = '') {
  const raw = String(input ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  return renderBlocks(escapeHtml(raw));
}

/* ------------------------------------------------------------------ *
 * 9. Share text
 * ------------------------------------------------------------------ **/

/** Build share text (plain text, <=120-character summary; bilingual). */
export function buildShareText({ title = '', desc = '', url = '', stats = '', siteName = '' } = {}, opts = {}) {
  const lang = langOf(opts);
  const site = siteName || pick(lang, 'AI Pulse · 照胆云', 'AI Pulse');
  const parts = [tr(lang, 'sharePrefix', { site, title: String(title || '').trim() })];
  const cleanDesc = String(desc || '').replace(/\s+/g, ' ').trim();
  if (cleanDesc) parts.push(cleanDesc.slice(0, 120));
  if (stats) parts.push(String(stats).trim());
  if (url) parts.push(url);
  return parts.filter(Boolean).join('\n');
}
