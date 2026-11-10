/* =============================================================================
   AI Pulse — render.js
   Shared renderers for home / news / rankings / models / resources / projects /
   about pages. All UI copy goes through the i18n `t()` helper; data values such
   as model names, source names and news titles stay in their original language.
   New v1.1 code uses English comments only.
   ============================================================================= */

import {
  fmtPrice,
  fmtContext,
  escapeHtml as esc,
  safeHttpUrl,
  plainText,
  safeId,
  displayModelName,
  debounce,
} from './data.js';
import { t, getLang } from './i18n.js';
import { createCompare } from './compare.js';
import { findGapModels, matchesModelNames, modelKey } from './ranking-gaps.js';

/* External-data links must pass the http(s) allowlist; internal links stay as-is. */
const safeHref = safeHttpUrl;

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
const SOURCE_NOTE_EN = {
  openrouter: 'Models API · generated news and derived leaderboards',
  livebench: 'Release parsed; overall score recomputed locally',
  'epoch-ai': 'ECI, SWE-bench Verified and GPQA Diamond from benchmark_data.zip',
  opencompass: 'Official API · text and multimodal arena boards',
  'artificial-analysis': 'Full leaderboard parsed from initial models',
  'rss-openai': 'Recent 120-day items',
  'rss-gdm': 'Recent 120-day items',
  'rss-google-ai': 'Recent 120-day items',
  'rss-qwen': 'Feed reachable; latest items outside the freshness window',
  'rss-aws-ml': 'Recent 120-day items',
  'rss-mit-ai': 'Recent 120-day items',
  'rss-bair': 'Recent 120-day items',
  github: 'Live fetch failed; using the last snapshot',
  'github-releases': 'Live fetch failed; using the last snapshot',
  'hf-mirror': 'Mirror reachability and trending models',
  huggingface: 'CI only; blocked locally',
  lmarena: 'CI only; dataset fetched via mirror',
  superclue: 'No public data API; not ingested',
  'deepseek-news': 'Official changelog parsed',
  'hn-ai': 'Top AI stories from the last 7 days',
};
const sourceNameText = (source) =>
  getLang() === 'en'
    ? SOURCE_NAME_EN[source.id] || (/[\u3400-\u9fff]/.test(String(source.name || '')) ? source.id : source.name || source.id)
    : source.name || source.id;
const sourceNoteText = (source) => (getLang() === 'en' ? SOURCE_NOTE_EN[source.id] || '' : source.note || '');
const TAG_EN = {
  '官方博客': 'Official blog',
  '模型发布': 'Model release',
  '开源': 'Open source',
  '研究': 'Research',
  '政策/安全': 'Policy & safety',
  '定价': 'Pricing',
  '评测': 'Evaluation',
  '长上下文': 'Long context',
  '多模态': 'Multimodal',
  '推理': 'Reasoning',
  '开源权重': 'Open weights',
  '免费': 'Free',
  '官方公告': 'Official update',
  '微调': 'Fine-tuning',
  '开源模型': 'Open models',
  '中文': 'Chinese',
  '深度学习': 'Deep learning',
  '机器学习': 'Machine learning',
  '生成式AI': 'Generative AI',
  '应用开发': 'App development',
  '深度长文': 'Long-form',
  '入门': 'Beginner',
  '论文': 'Papers',
  '实战营': 'Bootcamp',
};
const tagLabel = (tag) => (getLang() === 'en' ? TAG_EN[tag] || tag : tag);
const localizedItemField = (item, field) => {
  if (!item) return '';
  const en = item[`${field}En`];
  return getLang() === 'en' && en ? en : item[field] || '';
};


/* ---------- Locale-aware number / date formatting ---------- */

const locale = () => (getLang() === 'en' ? 'en-US' : 'zh-CN');

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function intlNumber(value) {
  const num = Number(value);
  if (value == null || !Number.isFinite(num)) return '—';
  return new Intl.NumberFormat(locale()).format(num);
}

export function intlDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  const formatted = new Intl.DateTimeFormat(locale(), { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return getLang() === 'en' ? formatted : formatted.replace(/\//g, '.');
}

export function intlDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  const time = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${intlDate(date)} ${time}`;
}

export function intlShortDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  const formatted = new Intl.DateTimeFormat(locale(), { month: '2-digit', day: '2-digit' }).format(date);
  return getLang() === 'en' ? formatted : formatted.replace(/\//g, '.');
}

export function intlMonth(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(date);
}

/* ---------- Data enum label keys (literals must stay static for the i18n checker) ---------- */

const KIND_KEYS = {
  release: 'data.kind.release',
  benchmark: 'data.kind.benchmark',
  oss: 'data.kind.oss',
  pricing: 'data.kind.pricing',
  research: 'data.kind.research',
  policy: 'data.kind.policy',
};

const TYPE_KEYS = {
  course: 'data.type.course',
  tutorial: 'data.type.tutorial',
  book: 'data.type.book',
  video: 'data.type.video',
  paper: 'data.type.paper',
  tool: 'data.type.tool',
  awesome: 'data.type.awesome',
};

const LEVEL_KEYS = {
  beginner: 'data.level.beginner',
  intermediate: 'data.level.intermediate',
  advanced: 'data.level.advanced',
};

const LANG_KEYS = {
  zh: 'data.lang.zh',
  en: 'data.lang.en',
  multi: 'data.lang.multi',
};

const MODALITY_KEYS = {
  text: 'data.modality.text',
  image: 'data.modality.image',
  audio: 'data.modality.audio',
  video: 'data.modality.video',
  file: 'data.modality.file',
};

const CAPABILITY_KEYS = {
  reasoning: 'data.capability.reasoning',
  'tool-calling': 'data.capability.toolCalling',
  'structured-output': 'data.capability.structuredOutput',
  'function-calling': 'data.capability.functionCalling',
};

const STATUS_KEYS = {
  ok: 'data.status.ok',
  degraded: 'data.status.degraded',
  blocked: 'data.status.blocked',
};

const KIND_DEFAULT_KEY = 'data.kind.default';
const UNKNOWN_KEY = 'ui.unknown';

function labelOf(map, value, fallback = '') {
  const key = value ? map[value] : null;
  if (!key) return fallback || (value == null ? '' : String(value));
  const translated = t(key);
  return translated === key ? fallback || String(value) : translated;
}

const kindLabelOf = (item) => labelOf(KIND_KEYS, item && item.kind, t(KIND_DEFAULT_KEY));
const typeLabelOf = (value) => labelOf(TYPE_KEYS, value);
const levelLabelOf = (value) => labelOf(LEVEL_KEYS, value);
const langLabelOf = (value) => labelOf(LANG_KEYS, value);
const modalityLabelOf = (value) => labelOf(MODALITY_KEYS, value);
const capabilityLabelOf = (value) => labelOf(CAPABILITY_KEYS, value);
const statusLabelOf = (value) => labelOf(STATUS_KEYS, value, t(UNKNOWN_KEY));

const SOURCE_TYPE_KEYS = {
  api: 'source.type.api',
  dataset: 'source.type.dataset',
  rss: 'source.type.rss',
  html: 'source.type.html',
};

const sourceTypeLabelOf = (value) => labelOf(SOURCE_TYPE_KEYS, value, value || '—');

const kindOf = (item) => kindLabelOf(item);

const SKILL_CATEGORY_KEYS = {
  methodology: 'data.skillCategory.methodology',
  data: 'data.skillCategory.data',
  writing: 'data.skillCategory.writing',
  design: 'data.skillCategory.design',
  dev: 'data.skillCategory.dev',
  research: 'data.skillCategory.research',
  other: 'data.skillCategory.other',
};

const SKILL_SOURCE_KEYS = {
  mine: 'data.skillSource.mine',
  official: 'data.skillSource.official',
  community: 'data.skillSource.community',
};

function skillText(item, field) {
  if (!item) return '';
  const primary = getLang() === 'en' ? item[field] : item[`${field}Zh`];
  const fallback = getLang() === 'en' ? item[`${field}Zh`] : item[field];
  return primary || fallback || '';
}

function projectSkillCardHtml(item) {
  const name = skillText(item, 'name') || item.id;
  const desc = skillText(item, 'description');
  const sourceType = item.sourceType || 'community';
  const categoryKey = SKILL_CATEGORY_KEYS[item.category];
  const sourceKey = SKILL_SOURCE_KEYS[sourceType];
  const link = `skills.html#${item.id}`;
  const stars = item.stars == null ? '' : `<span class="skill-stars">★ ${esc(intlNumber(item.stars))}</span>`;
  return `<article class="skill-card">
    <div class="skill-card-top">
      <span class="skill-badge skill-badge--${esc(sourceType)}">${esc(sourceKey ? t(sourceKey) : sourceType)}</span>
      <span class="skill-category">${esc(categoryKey ? t(categoryKey) : item.category || '')}</span>
      ${stars}
    </div>
    <h3 class="skill-name"><a href="${esc(link)}">${esc(name)}</a></h3>
    <p class="skill-desc">${esc(desc)}</p>
    <div class="skill-card-footer">
      <div class="skill-actions">
        <a class="link-arrow" href="${esc(link)}">${esc(t('projects.skills.viewGuide'))}</a>
        ${safeHref(item.url) ? `<a class="link-arrow" href="${esc(safeHref(item.url))}" target="_blank" rel="noopener noreferrer">${esc(t('projects.skills.sourceCode'))}</a>` : ''}
      </div>
    </div>
  </article>`;
}

function kindClass(item) {
  const kind = item && item.kind ? item.kind : '';
  return kind ? ` kind-tag--${esc(kind)}` : '';
}

/* ---------- Leaderboard display names (translations keyed by board id) ---------- */

const BOARD_NAME_KEYS = {
  'artificial-analysis-intelligence': 'board.artificial-analysis-intelligence.name',
  'context-window': 'board.context-window.name',
  'epoch-eci': 'board.epoch-eci.name',
  'epoch-gpqa-diamond': 'board.epoch-gpqa-diamond.name',
  'epoch-swe-bench-verified': 'board.epoch-swe-bench-verified.name',
  'livebench-2.0': 'board.livebench-2.0.name',
  'lmarena-text': 'board.lmarena-text.name',
  'opencompass-arena': 'board.opencompass-arena.name',
  'opencompass-arena-mm': 'board.opencompass-arena-mm.name',
  'output-price': 'board.output-price.name',
};

const BOARD_DESC_KEYS = {
  'artificial-analysis-intelligence': 'board.artificial-analysis-intelligence.desc',
  'context-window': 'board.context-window.desc',
  'epoch-eci': 'board.epoch-eci.desc',
  'epoch-gpqa-diamond': 'board.epoch-gpqa-diamond.desc',
  'epoch-swe-bench-verified': 'board.epoch-swe-bench-verified.desc',
  'livebench-2.0': 'board.livebench-2.0.desc',
  'lmarena-text': 'board.lmarena-text.desc',
  'opencompass-arena': 'board.opencompass-arena.desc',
  'opencompass-arena-mm': 'board.opencompass-arena-mm.desc',
  'output-price': 'board.output-price.desc',
};

const BOARD_METRIC_KEYS = {
  'artificial-analysis-intelligence': 'board.artificial-analysis-intelligence.metric',
  'context-window': 'board.context-window.metric',
  'epoch-eci': 'board.epoch-eci.metric',
  'epoch-gpqa-diamond': 'board.epoch-gpqa-diamond.metric',
  'epoch-swe-bench-verified': 'board.epoch-swe-bench-verified.metric',
  'livebench-2.0': 'board.livebench-2.0.metric',
  'lmarena-text': 'board.lmarena-text.metric',
  'opencompass-arena': 'board.opencompass-arena.metric',
  'opencompass-arena-mm': 'board.opencompass-arena-mm.metric',
  'output-price': 'board.output-price.metric',
};

function translatedOr(value, key) {
  if (!key) return value || '';
  const translated = t(key);
  return translated === key ? value || '' : translated;
}

const boardName = (board) => translatedOr(board && board.name, board && BOARD_NAME_KEYS[board.id]);
const boardDescription = (board) => translatedOr(board && board.description, board && BOARD_DESC_KEYS[board.id]);
const boardMetricName = (board) =>
  translatedOr(board && board.metric && board.metric.name, board && BOARD_METRIC_KEYS[board.id]);

/* ---------- Page refresh registry (re-render dynamic content on language switch) ---------- */

const pageRefreshers = new Map();

export function refreshPage(page) {
  const refresher = pageRefreshers.get(page);
  if (typeof refresher === 'function') refresher();
}

/* ---------- Base utilities ---------- */

const $ = (selector, root = document) => root.querySelector(selector);

const SHARE_ICON =
  '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H3.8A1.8 1.8 0 0 0 2 4.8v7.4A1.8 1.8 0 0 0 3.8 14h7.4a1.8 1.8 0 0 0 1.8-1.8V10"/><path d="M9.5 1.5H14v4.5"/><path d="M13.8 2.2 7.5 8.5"/></svg>';

export function shareButton({ title = '', url = '', desc = '' } = {}) {
  const shareTitle = title || t('ui.share.contentFallback');
  const attrs = [
    'type="button"',
    'class="share-btn"',
    'data-share',
    `data-share-title="${esc(title)}"`,
    `data-share-url="${esc(url)}"`,
    `data-share-desc="${esc(desc)}"`,
    `aria-label="${esc(t('ui.share.aria', { title: shareTitle }))}"`,
    `title="${esc(t('ui.share.title'))}"`,
  ].join(' ');
  return `<button ${attrs}>${SHARE_ICON}</button>`;
}

export function emptyHtml({ title = '', desc = '', error = false, reset = false } = {}) {
  const className = error ? 'empty-state empty-state--error' : 'empty-state';
  const resetButton = reset
    ? `<button type="button" class="filter-empty-reset" data-reset-filters>${esc(t('ui.clearFilters'))}</button>`
    : '';
  return `<div class="${className}" role="status">
  <p class="empty-title">${esc(title)}</p>
  ${desc ? `<p class="empty-desc">${esc(desc)}</p>` : ''}
  ${resetButton}
</div>`;
}

function reportRuntime(label, error) {
  const bucket = window.__siteErrors && window.__siteErrors.runtime;
  if (bucket) bucket.push(`${label}: ${error && error.message ? error.message : error}`);
  if (window.console && console.warn) console.warn('[site]', label, error);
}

function renderInto(selector, render) {
  const el = $(selector);
  if (!el) return null;
  try {
    const html = render(el);
    if (html != null) el.innerHTML = html;
    return el;
  } catch (error) {
    el.innerHTML = emptyHtml({ title: t('ui.renderError.title'), desc: t('ui.dataError.desc'), error: true });
    reportRuntime(selector, error);
    return el;
  }
}

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value;
}

function localDateKey(value) {
  return intlDate(value);
}

/* ---------- Home page ---------- */

export function initHome(data) {
  renderDataBanner(data);
  renderStats(data);
  renderHighlights(data);
  renderNewModels(data);
  const refreshRankings = renderHomeRankings(data);
  renderLatestNews(data);
  renderExploreCounts(data);

  pageRefreshers.set('index', () => {
    renderStats(data);
    renderHighlights(data);
    renderNewModels(data);
    if (typeof refreshRankings === 'function') refreshRankings();
    renderLatestNews(data);
    renderExploreCounts(data);
  });
}


function renderStats(data) {
  const meta = data.meta || {};
  const stats = meta.stats || {};
  const models = (data.models && data.models.models) || [];
  const news = (data.news && data.news.items) || [];

  setText('#stat-models', intlNumber(stats.models == null ? models.length : stats.models));
  setText('#stat-news', intlNumber(stats.news == null ? news.length : stats.news));
  const updatedEl = $('#stat-updated');
  if (updatedEl) {
    const full = intlDateTime(meta.generatedAt);
    const time = full.split(' ')[1] || '';
    const mainDate = getLang() === 'en' ? intlDate(meta.generatedAt) : intlShortDate(meta.generatedAt);
    updatedEl.innerHTML = `${esc(mainDate)}<small>${esc(time)}</small>`;
    updatedEl.title = t('ui.updatedAtTitle', { time: full });
  }

  renderInto('#sources-status', () => {
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    if (!sources.length) return `<p class="source-summary">${t('home.sources.unavailable')}</p>`;
    const counts = sources.reduce(
      (acc, source) => {
        acc[source.status] = (acc[source.status] || 0) + 1;
        return acc;
      },
      { ok: 0, degraded: 0, blocked: 0 }
    );
    const dots = sources
      .map((source) => {
        const label = t('home.sources.dotTitle', {
          name: sourceNameText(source),
          status: statusLabelOf(source.status),
        });
        return `<span class="source-dot source-dot--${esc(source.status || 'blocked')}" role="listitem" title="${esc(
          label
        )}"><span class="u-visually-hidden">${esc(label)}</span></span>`;
      })
      .join('');
    const parts = [t('home.sources.count', { n: intlNumber(sources.length) })];
    if (counts.ok) parts.push(t('home.sources.ok', { n: intlNumber(counts.ok) }));
    if (counts.degraded) parts.push(t('home.sources.degraded', { n: intlNumber(counts.degraded) }));
      return `<div class="source-dots" role="list" aria-label="${t('home.sources.aria', { n: intlNumber(sources.length) })}">${dots}</div>
      <p class="source-summary">${esc(parts.join(' · '))}</p>`;
  });

  const note = $('#data-mode-note');
  if (note) {
    const mode = meta._fallback ? t('home.weekly.modeFallback') : t('home.weekly.mode', { mode: String(meta.mode || 'seed').toUpperCase() });
    note.textContent = t('home.weekly.noteLine', { mode, time: intlDateTime(meta.generatedAt) });
  }
}

export function renderDataBanner(data) {
  if (!data || !data.meta || !data.meta._fallback) return;
  const main = $('main');
  if (!main || $('.data-banner', main)) return;
  const failed = Array.isArray(data.meta._failed) ? data.meta._failed.join('、') : '';
  main.insertAdjacentHTML(
    'afterbegin',
    `<div class="container"><div class="data-banner" role="note"><strong>${esc(t('ui.fallback.title'))}</strong><span>${esc(
      t('ui.fallback.body', { files: failed ? (getLang() === 'en' ? ` (${failed.join(', ')}.json)` : `（${failed}.json）`) : '' })
    )}</span></div></div>`
  );
}

function renderHighlights(data) {
  const section = $('#highlights');
  const list = $('#highlights-list');
  if (!list) return;
  const meta = data.meta || {};
  // Highlight sentences are generated by the data pipeline in Chinese. In
  // English mode we only show them when a translated list exists; otherwise the
  // strip is hidden instead of machine-translating data content.
  const highlights =
    getLang() === 'en'
      ? Array.isArray(meta.latestHighlightsEn)
        ? meta.latestHighlightsEn
        : []
      : Array.isArray(meta.latestHighlights)
        ? meta.latestHighlights
        : [];
  if (!highlights.length) {
    if (section) section.hidden = true;
    list.innerHTML = '';
    return;
  }
  if (section) section.hidden = false;
  list.innerHTML = highlights.slice(0, 3).map((text) => `<li class="highlight-item">${esc(text)}</li>`).join('');
}

function renderNewModels(data) {
  renderInto('#new-models-grid', () => {
    const all = Array.isArray(data.models && data.models.models) ? data.models.models.slice() : [];
    if (!all.length) {
      return emptyHtml({ title: t('home.newModels.empty.title'), desc: t('home.newModels.empty.desc') });
    }
    all.sort((a, b) => {
      const ta = Date.parse(a.releaseDate || '') || 0;
      const tb = Date.parse(b.releaseDate || '') || 0;
      if (tb !== ta) return tb - ta;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    const models = all.slice(0, 4);
    return models.map((model) => modelCardHtml(model)).join('');
  });
  setText('#new-models-note', t('home.newModels.sortNote'));
}

function modelCardHtml(model, { externalLink = false, compareCheckbox = '' } = {}) {
  const pricing = fmtPrice(model.pricing);
  const tags = [];

  (Array.isArray(model.capabilities) ? model.capabilities : []).slice(0, 2).forEach((capability) => {
    const label = capabilityLabelOf(capability);
    if (label) tags.push(`<span class="tag">${esc(label)}</span>`);
  });
  if (!tags.length && Array.isArray(model.modalities)) {
    
    model.modalities.slice(0, 2).forEach((modality) => {
      tags.push(`<span class="tag">${esc(modalityLabelOf(modality))}</span>`);
    });
  }
  if (model.openWeights) tags.push(`<span class="tag tag--gold">${esc(t('data.open.open'))}</span>`);

  const name = displayModelName(model);
  const desc = plainText(model.description || '', 96);
  const shareUrl = safeHref(model.links && (model.links.api || model.links.official));

  return `<article class="model-card">
  <div class="model-card-top">
    <span class="model-org">${esc(model.org || t('ui.unknownOrg'))}</span>
    <span class="model-date">${esc(intlShortDate(model.releaseDate))}</span>
    ${compareCheckbox}
  </div>
  <h3 class="model-name">${esc(name)}</h3>
  ${desc ? `<p class="model-desc">${esc(desc)}</p>` : ''}
  <dl class="model-specs">
    <div class="spec"><dt class="spec-label">${esc(t('models.card.context'))}</dt><dd class="spec-value">${esc(fmtContext(model.contextWindow))}</dd></div>
    <div class="spec"><dt class="spec-label">${esc(t('models.card.price'))}</dt><dd class="spec-value">${esc(pricing || t('ui.notPublished'))}</dd></div>
  </dl>
  ${tags.length ? `<div class="model-tags">${tags.join('')}</div>` : ''}
  <div class="model-foot">
    ${
      externalLink && shareUrl
        ? `<a class="link-arrow" href="${esc(shareUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('ui.sourceLink'))}</a>`
        : `<a class="link-arrow" href="models.html">${esc(t('nav.models'))}</a>`
    }
    ${shareButton({ title: `${model.org || ''} ${name}`.trim(), url: shareUrl, desc: desc || name })}
  </div>
</article>`;
}


/* ---------- Ranking release dates ---------- */

let rankingReleaseIndex = new Map();

/** Build a release-date lookup from the model catalog (vendor-prefix aware). */
function buildRankingReleaseIndex(modelsData) {
  const index = new Map();
  const list = Array.isArray(modelsData && modelsData.models) ? modelsData.models : [];
  for (const model of list) {
    if (!model || !model.releaseDate) continue;
    const raw = String(model.name || '');
    const keys = [modelKey(raw)];
    if (raw.includes(':')) keys.push(modelKey(raw.split(':').slice(1).join(':')));
    for (const key of keys) {
      if (key && !index.has(key)) index.set(key, model.releaseDate);
    }
  }
  return index;
}

/** Official release date for a leaderboard entry, never guessed. */
function rankingReleaseDate(entry) {
  if (!entry) return '';
  if (entry.releaseDate) return String(entry.releaseDate);
  const tokens = modelKey(entry.model || '').split(' ').filter(Boolean);
  const candidates = [tokens.join(' ')];
  // Trim a trailing YYYY MM DD date suffix (e.g. "GPT-5.4 Pro 2026.03.05").
  if (tokens.length >= 4 && /^\d{4}$/.test(tokens[tokens.length - 3]) && /^\d{2}$/.test(tokens[tokens.length - 2]) && /^\d{2}$/.test(tokens[tokens.length - 1])) {
    candidates.push(tokens.slice(0, -3).join(' '));
  }
  for (const key of candidates) {
    const date = rankingReleaseIndex.get(key);
    if (date) return date;
  }
  return '';
}

/** Format a date as [YYYY.MM.DD] for the org line. */
function rankingReleaseTag(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `[${match[1]}.${match[2]}.${match[3]}]` : '';
}

function rankingOrgHtml(entry) {
  const tag = rankingReleaseTag(rankingReleaseDate(entry));
  return `<span class="rank-org">${esc((entry && entry.org) || '')}${tag ? ` <span class="rank-release">${esc(tag)}</span>` : ''}</span>`;
}

function rankPanelHtml(board) {
  const entries = (Array.isArray(board.entries) ? board.entries : []).slice(0, 5);
  const metricName = boardMetricName(board) || t('ui.metricFallback');
  const higher = !board.metric || board.metric.higherIsBetter !== false;
  const rows = entries
    .map(
      (entry) => `<tr>
      <td class="rank-no">${esc(String(entry.rank).padStart(2, '0'))}</td>
      <td><span class="rank-model">${esc(entry.model)}</span>${rankingOrgHtml(entry)}</td>
      <td class="rank-score">${esc(entry.scoreDisplay || intlNumber(entry.score))}${
        entry.delta ? `<span class="rank-delta">${entry.delta > 0 ? '↑' : '↓'} ${esc(Math.abs(entry.delta))}</span>` : ''
      }</td>
    </tr>`
    )
    .join('');

  return `<div class="rank-panel">
  <table class="rank-table">
    <caption class="u-visually-hidden">${esc(boardName(board))} ${t('rankings.topN', { n: intlNumber(entries.length) })}</caption>
    <thead><tr><th scope="col">${esc(t('rankings.thRank'))}</th><th scope="col">${esc(t('rankings.thModel'))}</th><th scope="col">${esc(metricName)}</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3">${esc(t('rankings.empty.board'))}</td></tr>`}</tbody>
  </table>
  <div class="board-meta">
    <p class="board-desc">${esc(boardDescription(board))} · ${esc(t('rankings.metricNote', { metric: metricName, direction: higher ? t('rankings.higher') : t('rankings.lower') }))}</p>
    <span>${esc(t('ui.updatedOn', { date: intlDate(board.updatedAt) }))}</span>
    ${
      safeHref(board.sourceUrl)
        ? `<a class="source-link" href="${esc(safeHref(board.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(t('ui.source'))} · ${esc(
            board.sourceName || t('ui.publicBoard')
          )} ↗</a>`
        : `<span>${esc(t('ui.source'))} · ${esc(board.sourceName || t('ui.publicBoard'))}</span>`
    }
    ${shareButton({
      title: t('rankings.shareTitle', { name: boardName(board) }),
      url: safeHref(board.sourceUrl),
      desc: boardDescription(board) || t('rankings.shareDesc', { name: boardName(board) }),
    })}
  </div>
</div>`;
}

function renderHomeRankings(data) {
  rankingReleaseIndex = buildRankingReleaseIndex(data.models);
  const tabsEl = $('#home-rankings-tabs');
  const panelEl = $('#home-rankings-board');
  if (!tabsEl || !panelEl) return;
  const allBoards = Array.isArray(data.rankings && data.rankings.boards) ? data.rankings.boards : [];
  const boards = allBoards.slice(0, 4);
  if (!boards.length) {
    tabsEl.innerHTML = '';
    panelEl.innerHTML = emptyHtml({ title: t('home.rankings.empty.title'), desc: t('home.rankings.empty.desc') });
    return;
  }
  let active = 0;
  const renderTabs = () => {
    tabsEl.innerHTML = boards
      .map(
        (board, index) =>
          `<button type="button" class="board-tab" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" tabindex="${
            index === 0 ? '0' : '-1'
          }" data-board-index="${index}" aria-controls="home-rankings-board">${esc(boardName(board))}</button>`
      )
      .join('');
  };
  panelEl.setAttribute('role', 'tabpanel');
  panelEl.setAttribute('aria-live', 'polite');

  const updateTabs = () => {
    tabsEl.querySelectorAll('[data-board-index]').forEach((button) => {
      const isActive = Number(button.dataset.boardIndex) === active;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  };
  const drawPanel = () => {
    panelEl.innerHTML = rankPanelHtml(boards[active]);
  };
  const selectBoard = (index, focus = false) => {
    if (Number.isNaN(index) || index === active || !boards[index]) return;
    active = index;
    updateTabs();
    drawPanel();
    if (focus) {
      const focusTarget = $(`[data-board-index="${index}"]`, tabsEl);
      if (focusTarget) focusTarget.focus();
    }
  };

  tabsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-board-index]');
    if (button) selectBoard(Number(button.dataset.boardIndex), true);
  });
  tabsEl.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    selectBoard((active + delta + boards.length) % boards.length, true);
  });
  updateTabs();
  drawPanel();
  return () => {
    renderTabs();
    drawPanel();
  };
}

function newsRowHtml(item) {
  const title = plainText(item.title || t('ui.untitledNews'), 160);
  const anchor = `news.html#news-${safeId(item.id)}`;
  return `<li>
  <div class="news-row">
    <span class="news-date">${esc(intlShortDate(item.publishedAt))}</span>
    <div class="news-main">
      <span class="news-kind">${esc(kindOf(item))}</span>
      <a class="news-title" href="${esc(anchor)}">${esc(title)}</a>
      <span class="news-source">${esc(t('ui.source'))} · ${esc(item.sourceName || t('ui.publicSource'))}${item.importance >= 3 ? ' · ' + esc(t('ui.important')) : ''}</span>
    </div>
    ${shareButton({
      title,
      url: safeHref(item.url) || safeHref(item.sourceUrl),
      desc: plainText(item.summary || title, 140),
    })}
  </div>
</li>`;
}

function renderLatestNews(data) {
  renderInto('#latest-news', () => {
    const items = Array.isArray(data.news && data.news.items) ? data.news.items.slice() : [];
    if (!items.length) {
      return emptyHtml({ title: t('home.news.empty.title'), desc: t('home.news.empty.desc') });
    }
    items.sort((a, b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0));
    return items.slice(0, 5).map((item) => newsRowHtml(item)).join('');
  });
  const count = (data.news && data.news.items && data.news.items.length) || 0;
  setText('#latest-news-count', t('home.news.count', { n: intlNumber(count) }));
}

function renderExploreCounts(data) {
  const resourceCount = (data.resources && data.resources.items && data.resources.items.length) || 0;
  const projectCount = (data.projects && data.projects.items && data.projects.items.length) || 0;
  setText('#explore-resource-count', t('home.explore.resourceCount', { n: intlNumber(resourceCount) }));
  setText('#explore-project-count', t('home.explore.projectCount', { n: intlNumber(projectCount) }));
}

/* ---------- Updates page ---------- */

export function initNews(data) {
  renderDataBanner(data);
  const items = Array.isArray(data.news && data.news.items) ? data.news.items.slice() : [];
  const meta = data.meta || {};
  const listEl = $('#news-list');
  const filtersEl = $('#news-filters');
  const searchEl = $('#news-search');
  const tagEl = $('#news-tag-select');
  const importantEl = $('#news-important');
  const kindChips = $('#news-kind-chips');
  const resultEl = $('#news-result-count');
  const topicBannerEl = $('#news-topic-banner');
  const topicBannerTextEl = $('#news-topic-banner-text');
  if (!listEl) return;

  const state = { kind: 'all', tag: '', q: '', important: false, topic: '' };
  let topicNotice = null;

  const topicHaystack = (item) =>
    [item.title, item.summary, item.sourceName, ...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.models) ? item.models : [])]
      .join(' ')
      .toLowerCase();

  const showTopicBanner = () => {
    if (!topicBannerEl || !topicBannerTextEl) return;
    if (!topicNotice) {
      topicBannerEl.hidden = true;
      topicBannerTextEl.textContent = '';
      return;
    }
    topicBannerEl.hidden = false;
    topicBannerTextEl.textContent = topicNotice.matched
      ? t('news.topicFilter.banner', { tag: topicNotice.tag })
      : t('news.topicFilter.fallback');
  };

  const clearTopic = () => {
    state.topic = '';
    topicNotice = null;
    showTopicBanner();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tag');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      /* History API may be unavailable. */
    }
    render();
  };

  setText('#news-total', intlNumber(items.length));
  setText('#news-updated', intlDateTime(meta.generatedAt));
  setText('#news-source', (data.news && data.news.source) || t('ui.publicSource'));

  const kindCounts = items.reduce((acc, item) => {
    const key = item.kind || 'release';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const renderKindChips = () => {
    if (!kindChips) return;
    const kinds = Object.keys(kindCounts).filter((kind) => kindLabelOf({ kind }));
    kindChips.innerHTML = [
      `<button type="button" class="chip" data-kind="all" aria-pressed="${
        state.kind === 'all' ? 'true' : 'false'
      }">${esc(t('ui.all'))}</button>`,
      ...kinds.map(
        (kind) =>
          `<button type="button" class="chip" data-kind="${esc(kind)}" aria-pressed="${
            state.kind === kind ? 'true' : 'false'
          }">${kindLabelOf({ kind })}<span class="chip-count">${kindCounts[kind]}</span></button>`
      ),
    ].join('');
  };
  renderKindChips();

  if (kindChips) {
    kindChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-kind]');
      if (!chip) return;
      state.kind = chip.dataset.kind;
      kindChips.querySelectorAll('[data-kind]').forEach((el) => {
        el.setAttribute('aria-pressed', el === chip ? 'true' : 'false');
      });
      render();
    });
  }

  const tagCounts = new Map();
  items.forEach((item) => {
    (Array.isArray(item.tags) ? item.tags : []).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const renderTagOptions = () => {
    if (!tagEl) return;
    tagEl.innerHTML = [
      `<option value="">${esc(t('news.tagFilter.all'))}</option>`,
      ...tags.map(([tag, count]) => `<option value="${esc(tag)}">${esc(tagLabel(tag))} (${count})</option>`),
    ].join('');
    try {
      tagEl.value = state.tag;
    } catch (error) {
      /* Some DOM shims expose a read-only select value; browsers are fine. */
    }
  };
  renderTagOptions();

  if (tagEl) {
    tagEl.addEventListener('change', () => {
      state.tag = tagEl.value;
      render();
    });
  }

  if (searchEl) {
    searchEl.addEventListener(
      'input',
      debounce(() => {
        state.q = searchEl.value.trim();
        render();
      }, 180)
    );
  }

  if (importantEl) {
    importantEl.addEventListener('change', () => {
      state.important = importantEl.checked;
      render();
    });
  }

  if (filtersEl) {
    filtersEl.addEventListener('reset', () => {
      window.setTimeout(resetFilters, 0);
    });
  }

  listEl.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset-filters]')) resetFilters();
  });

  if (topicBannerEl) {
    topicBannerEl.addEventListener('click', (event) => {
      if (event.target.closest('[data-clear-topic]')) clearTopic();
    });
  }

  const rawTopic = (new URLSearchParams(window.location.search).get('tag') || '').slice(0, 100);
  const initialTopic =
    rawTopic.length <= 40 && /^[\p{L}\p{N}\s·_.-]+$/u.test(rawTopic) ? rawTopic.trim() : '';
  if (initialTopic) {
    const matched = items.some((item) => topicHaystack(item).includes(initialTopic.toLowerCase()));
    state.topic = matched ? initialTopic : '';
    topicNotice = { tag: initialTopic, matched };
    showTopicBanner();
  }

  function resetFilters() {
    state.kind = 'all';
    state.tag = '';
    state.q = '';
    state.important = false;
    state.topic = '';
    topicNotice = null;
    showTopicBanner();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tag');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      /* History API may be unavailable. */
    }
    if (searchEl) searchEl.value = '';
    if (tagEl) tagEl.value = '';
    if (importantEl) importantEl.checked = false;
    if (kindChips) {
      kindChips.querySelectorAll('[data-kind]').forEach((el) => {
        el.setAttribute('aria-pressed', el.dataset.kind === 'all' ? 'true' : 'false');
      });
    }
    render();
  }

  function filtered() {
    const query = state.q.toLowerCase();
    return items
      .filter((item) => {
        if (state.kind !== 'all' && (item.kind || 'release') !== state.kind) return false;
        if (state.tag && !(Array.isArray(item.tags) && item.tags.includes(state.tag))) return false;
        if (state.topic && !topicHaystack(item).includes(state.topic.toLowerCase())) return false;
        if (state.important && !(item.importance >= 3)) return false;
        if (!query) return true;
        const haystack = [
          item.title,
          item.summary,
          item.sourceName,
          ...(Array.isArray(item.tags) ? item.tags : []),
          ...(Array.isArray(item.models) ? item.models : []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0));
  }

  function dispatchHtml(item) {
    const title = plainText(localizedItemField(item, 'title') || t('ui.untitledNews'), 180);
    const summary = plainText(localizedItemField(item, 'summary') || '', 220);
    const link = safeHref(item.url) || safeHref(item.sourceUrl) || '#';
    const tags = (Array.isArray(item.tags) ? item.tags : [])
      .slice(0, 4)
      .map((tag) => `<li class="tag">${esc(tagLabel(tag))}</li>`)
      .join('');
    return `<li class="timeline-item" data-importance="${Number(item.importance) || 1}">
    <div class="timeline-date">
      <span class="day">${esc(String(new Date(item.publishedAt).getDate()).padStart(2, '0'))}</span>
      <span class="month">${esc(intlMonth(item.publishedAt))}</span>
      <span class="u-visually-hidden">${esc(intlDate(item.publishedAt))}</span>
    </div>
    <article class="dispatch-card" id="news-${esc(safeId(item.id))}">
      <div class="dispatch-head">
        <span class="kind-tag${kindClass(item)}">${esc(kindOf(item))}</span>
        <span class="imp-marks" data-level="${Number(item.importance) || 1}" role="img" aria-label="${esc(t('news.importanceAria', { level: Number(item.importance) || 1 }))}${
          Number(item.importance) || 1
        } / 3"><i></i><i></i><i></i></span>
        ${shareButton({ title, url: safeHref(item.url) || safeHref(item.sourceUrl), desc: plainText(item.summary || title, 140) })}
      </div>
      <h2 class="dispatch-title"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></h2>
      ${
        summary
          ? `<p class="dispatch-summary">${esc(summary)}</p>`
          : ''
      }
      <div class="dispatch-foot">
        ${
          safeHref(item.sourceUrl)
            ? `<a class="source-link" href="${esc(safeHref(item.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(t('ui.source'))} · ${esc(
                item.sourceName || t('ui.publicSource')
              )} ↗</a>`
            : `<span>${esc(t('ui.source'))} · ${esc(item.sourceName || t('ui.publicSource'))}</span>`
        }
        <span>${esc(intlDate(item.publishedAt))}</span>
        ${tags ? `<ul class="dispatch-tags">${tags}</ul>` : ''}
      </div>
    </article>
  </li>`;
  }

  function render() {
    try {
      const result = filtered();
      if (resultEl) resultEl.textContent = t('news.resultCount', { shown: intlNumber(result.length), total: intlNumber(items.length) });
      if (!result.length) {
        listEl.innerHTML = emptyHtml({
          title: state.topic ? t('news.topicFilter.noResults', { tag: state.topic }) : t('news.empty.title'),
          desc: state.topic ? t('news.topicFilter.emptyDesc') : t('news.empty.desc'),
          reset: true,
        });
        return;
      }
      listEl.innerHTML = result.map((item) => dispatchHtml(item)).join('');
    } catch (error) {
      listEl.innerHTML = emptyHtml({ title: t('news.error.title'), desc: t('ui.dataError.desc'), error: true });
      reportRuntime('#news-list', error);
    }
  }

  pageRefreshers.set('news', () => {
    setText('#news-total', intlNumber(items.length));
    setText('#news-updated', intlDateTime(meta.generatedAt));
    setText('#news-source', (data.news && data.news.source) || t('ui.publicSource'));
    renderKindChips();
    renderTagOptions();
    showTopicBanner();
    render();
  });
  render();
}

/* ---------- Rankings page ---------- */

export function initRankings(data) {
  renderDataBanner(data);
  rankingReleaseIndex = buildRankingReleaseIndex(data.models);
  const boards = Array.isArray(data.rankings && data.rankings.boards) ? data.rankings.boards : [];
  const meta = data.meta || {};
  setText('#rankings-total', intlNumber(boards.length));
  setText('#rankings-updated', intlDateTime(meta.generatedAt));
  setText('#rankings-source', (data.rankings && data.rankings.source) || t('ui.publicSource'));

  const tabsEl = $('#rankings-tabs');
  const panelEl = $('#rankings-board');
  if (!tabsEl || !panelEl) return;

  panelEl.setAttribute('role', 'tabpanel');
  panelEl.setAttribute('aria-live', 'polite');

  if (!boards.length) {
    tabsEl.innerHTML = '';
    panelEl.innerHTML = emptyHtml({
      title: t('rankings.empty.title'),
      desc: t('rankings.empty.desc'),
      error: true,
    });
    return;
  }

  let active = 0;
  const expandedBoards = new Set();
  const rawHash = String(location.hash || '').replace(/^#/, '').replace(/^board-/, '');
  const hashIndex = boards.findIndex((board) => board.id === rawHash);
  if (hashIndex >= 0) active = hashIndex;

  const renderTabs = () => {
    tabsEl.innerHTML = boards
      .map(
        (board, index) =>
          `<button type="button" class="board-tab" role="tab" aria-selected="${index === active ? 'true' : 'false'}" tabindex="${
            index === active ? '0' : '-1'
          }" data-board-index="${index}" aria-controls="rankings-board">${esc(boardName(board))}</button>`
      )
      .join('');
  };

  const updateTabs = () => {
    tabsEl.querySelectorAll('[data-board-index]').forEach((button) => {
      const isActive = Number(button.dataset.boardIndex) === active;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  };

  const drawPanel = () => {
    const board = boards[active];
    panelEl.setAttribute('aria-labelledby', `ranking-tab-${active}`);
    panelEl.innerHTML = rankingsBoardHtml(board, active, expandedBoards.has(board.id), boards);
  };

  const selectBoard = (index, focus = false) => {
    if (Number.isNaN(index) || index === active || !boards[index]) return;
    active = index;
    updateTabs();
    drawPanel();
    const board = boards[active];
    try {
      if (location.protocol !== 'file:' && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#board-${board.id}`);
      }
    } catch (error) {
      /* ignore */
    }
    if (focus) {
      const focusTarget = $(`[data-board-index="${index}"]`, tabsEl);
      if (focusTarget) focusTarget.focus();
    }
  };

  const jumpToReferenceModel = (modelName, referenceId) => {
    const refIndex = boards.findIndex((board) => board.id === referenceId);
    if (refIndex < 0) return;
    const referenceBoard = boards[refIndex];
    const referenceEntries = Array.isArray(referenceBoard.entries) ? referenceBoard.entries : [];
    const targetRank = referenceEntries.findIndex((entry) => matchesModelNames(entry.model, modelName)) + 1;
    /* The target may sit below the default Top10 fold; expand before drawing. */
    if (targetRank > 10) expandedBoards.add(referenceBoard.id);
    selectBoard(refIndex, false);
    window.requestAnimationFrame(() => {
      const rows = Array.from(panelEl.querySelectorAll('[data-model-key]'));
      const target =
        rows.find((row) => matchesModelNames(row.dataset.modelKey || '', modelName)) ||
        (targetRank > 0 ? rows[targetRank - 1] : null);
      if (!target) return;
      target.classList.add('is-gap-target');
      target.setAttribute('tabindex', '-1');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
      window.setTimeout(() => {
        target.classList.remove('is-gap-target');
        target.removeAttribute('tabindex');
      }, 2600);
    });
  };

  tabsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-board-index]');
    if (button) selectBoard(Number(button.dataset.boardIndex), true);
  });
  panelEl.addEventListener('click', (event) => {
    const gapButton = event.target.closest('[data-gap-model]');
    if (gapButton) {
      jumpToReferenceModel(gapButton.dataset.gapModel, gapButton.dataset.gapReference);
      return;
    }
    const button = event.target.closest('[data-rank-expand]');
    if (!button) return;
    const board = boards[active];
    if (expandedBoards.has(board.id)) expandedBoards.delete(board.id);
    else expandedBoards.add(board.id);
    drawPanel();
    const nextButton = panelEl.querySelector('[data-rank-expand]');
    if (nextButton && nextButton.focus) nextButton.focus();
  });
  tabsEl.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = active;
    if (event.key === 'ArrowRight') next = (active + 1) % boards.length;
    if (event.key === 'ArrowLeft') next = (active - 1 + boards.length) % boards.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = boards.length - 1;
    selectBoard(next, true);
  });

  renderTabs();
  drawPanel();
  pageRefreshers.set('rankings', () => {
    setText('#rankings-total', intlNumber(boards.length));
    setText('#rankings-updated', intlDateTime(meta.generatedAt));
    setText('#rankings-source', (data.rankings && data.rankings.source) || t('ui.publicSource'));
    renderTabs();
    drawPanel();
  });
}

function boardShareButton(board, entries, metricName) {
  const top3 = (entries || [])
    .slice(0, 3)
    .map((entry) => `${entry.rank}. ${entry.model} ${entry.scoreDisplay || intlNumber(entry.score)}`)
    .join(' · ');
  const title = boardName(board) || board.name || '';
  const url = `https://chengxi-z.github.io/llm-pulse/rankings.html#board-${board.id}`;
  const desc = `Top3: ${top3} · ${metricName} · ${t('ui.updatedOn', { date: intlDate(board.updatedAt) })} · ${board.sourceName || t('ui.publicBoard')}`;
  const stats = `${t('rankings.metricChip', { metric: metricName })} · ${board.sourceName || t('ui.publicBoard')}`;
  const attrs = [
    'type="button"',
    'class="share-btn"',
    'data-share',
    'data-share-kind="board"',
    'data-share-type="board"',
    `data-share-board="${esc(board.id)}"`,
    `data-share-title="${esc(title)}"`,
    `data-share-desc="${esc(desc)}"`,
    `data-share-url="${esc(url)}"`,
    `data-share-stats="${esc(stats)}"`,
    `aria-label="${esc(t('share.shareBoard'))}"`,
    `title="${esc(t('share.shareBoard'))}"`,
  ].join(' ');
  return `<button ${attrs}>${SHARE_ICON}</button>`;
}

function rankingsBoardHtml(board, index, expanded = false, boards = []) {
  const entries = Array.isArray(board.entries) ? board.entries : [];
  const visibleEntries = expanded ? entries : entries.slice(0, 10);
  const gaps = findGapModels(board, boards);
  const metric = board.metric || {};
  const metricName = boardMetricName(board) || t('ui.metricFallback');
  const higher = metric.higherIsBetter !== false;
  const hasVotes = entries.some((entry) => entry.votes != null);
  const hasDelta = entries.some((entry) => entry.delta != null);
  const rows = visibleEntries
    .map((entry) => {
      const rank = Number(entry.rank) || 1;
      const top3 = rank <= 3;
      return `<tr class="rank-row${top3 ? ' rank-row--top3' : ''}" data-model-key="${esc(modelKey(entry.model || ''))}">
      <td class="rank-no${top3 ? ` rank-no--${rank}` : ''}">${
        top3
          ? `<span class="rank-badge rank-badge--${rank} rank-medal" aria-label="${esc(
              t('rankings.rankPos', { n: intlNumber(rank) })
            )}">${esc(String(rank))}</span>`
          : esc(String(rank).padStart(2, '0'))
      }</td>
      <td>
        <span class="rank-model">${esc(entry.model || '—')}</span>
        ${rankingOrgHtml(entry)}
      </td>
      <td class="rank-score">${esc(entry.scoreDisplay || intlNumber(entry.score))}</td>
      ${hasVotes ? `<td class="rank-extra">${entry.votes == null ? '—' : esc(intlNumber(entry.votes))}</td>` : ''}
      ${
        hasDelta
          ? `<td class="rank-extra">${
              entry.delta == null ? '—' : `<span class="${
                entry.delta >= 0 ? 'delta-up' : 'delta-down'
              }">${entry.delta >= 0 ? '↑' : '↓'} ${esc(Math.abs(entry.delta))}</span>`
            }</td>`
          : ''
      }
    </tr>`;
    })
    .join('');

  return `<div class="rank-panel rank-panel--full">
    <header class="rank-panel-head">
      <div>
        <p class="eyebrow"><span class="eyebrow-idx">${String(index + 1).padStart(2, '0')}</span> ${esc(
          board.sourceName || t('ui.publicBoard')
        )} <span class="eyebrow-en">/ ${esc(metricName)}</span></p>
        <h2 class="rank-panel-title" id="ranking-tab-${index}">${esc(boardName(board))}</h2>
        <p class="rank-panel-desc">${esc(boardDescription(board) || t('rankings.noDescription'))}</p>
      </div>
      <div class="rank-panel-meta">
        <span class="metric-chip">${esc(t('rankings.metricChip', { metric: metricName }))}${
          metric.unit ? ` · ${esc(metric.unit)}` : ''
        } ${higher ? '↑ ' + esc(t('rankings.higher')) : '↓ ' + esc(t('rankings.lower'))}</span>
        <span>${esc(t('ui.updatedOn', { date: intlDate(board.updatedAt) }))}</span>
        ${
          safeHref(board.sourceUrl)
            ? `<a class="source-link" href="${esc(safeHref(board.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(t('ui.source'))} · ${esc(
                board.sourceName || t('ui.publicBoard')
              )} ↗</a>`
            : ''
        }
        ${boardShareButton(board, entries, metricName)}
      </div>
    </header>
    <div class="table-scroll">
      <table class="rank-table rank-table--full">
        <caption class="u-visually-hidden">${esc(boardName(board))} · ${esc(t('rankings.entryCount', { n: intlNumber(entries.length) }))}</caption>
        <thead>
          <tr>
            <th scope="col">${esc(t('rankings.thRank'))}</th>
            <th scope="col">${esc(t('rankings.thModel'))}</th>
            <th scope="col">${esc(metricName)}</th>
            ${hasVotes ? `<th scope="col">${esc(t('rankings.thVotes'))}</th>` : ''}
            ${hasDelta ? `<th scope="col">${esc(t('rankings.thDelta'))}</th>` : ''}
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3">${esc(t('rankings.empty.entries'))}</td></tr>`}</tbody>
      </table>
    </div>
    ${
      entries.length > 10
        ? `<div class="rank-expand">
      <span class="rank-expand-note">${esc(t('rankings.top10Note'))}</span>
      <button type="button" class="btn btn--ghost btn--sm" data-rank-expand aria-expanded="${
        expanded ? 'true' : 'false'
      }">${esc(
        expanded ? t('rankings.collapseTop') : t('rankings.expandAll', { n: intlNumber(entries.length) })
      )}</button>
    </div>`
        : ''
    }
    ${
      gaps.length
        ? `<div class="rank-gaps" role="region" aria-label="${esc(t('rankings.gaps.aria'))}">
      <div class="rank-gaps-head">
        <h3 class="rank-gaps-title">${esc(t('rankings.gaps.title'))}</h3>
        <p class="rank-gaps-desc">${esc(t('rankings.gaps.desc'))}</p>
      </div>
      <ul class="rank-gaps-list">
        ${gaps
          .map(
            (gap) => `<li><button type="button" class="rank-gap-item" data-gap-model="${esc(
              gap.model
            )}" data-gap-reference="${esc(gap.referenceId)}">
          <span class="rank-gap-rank">${esc(gap.rank == null ? '—' : String(gap.rank).padStart(2, '0'))}</span>
          <span class="rank-gap-main"><span class="rank-gap-name">${esc(gap.model)}</span><span class="rank-gap-org">${esc(
            gap.org
          )}</span></span>
          <span class="rank-gap-score">${esc(
            t('rankings.gaps.refScore', {
              score: gap.scoreDisplay || intlNumber(gap.score),
              rank: gap.rank == null ? '—' : intlNumber(gap.rank),
            })
          )}</span>
          <span class="rank-gap-go">${esc(t('rankings.gaps.go'))} →</span>
        </button></li>`
          )
          .join('')}
      </ul>
      <p class="rank-gaps-note">${esc(t('rankings.gaps.note'))}</p>
    </div>`
        : ''
    }
    <div class="rank-dist" role="group" aria-label="${esc(t('rankings.distAria'))}">
      <img class="rank-dist-qr" src="assets/img/qr-site.png" alt="" width="56" height="56" loading="lazy">
      <span class="rank-dist-title">${esc(t('ui.siteNameShare'))}</span>
      <a class="rank-dist-site" href="https://chengxi-z.github.io/llm-pulse/" target="_blank" rel="noopener noreferrer">chengxi-z.github.io/llm-pulse</a>
      <a class="rank-dist-repo" href="https://github.com/chengxi-Z/llm-pulse" target="_blank" rel="noopener noreferrer">github.com/chengxi-Z/llm-pulse</a>
    </div>
    <div class="board-meta">
      <span>${esc(t('rankings.entryCount', { n: intlNumber(entries.length) }))}</span>
      <span>${esc(t('rankings.sourceLine', { source: board.sourceName || t('ui.publicSource'), updated: intlDateTime(board.updatedAt) }))}</span>
      <span class="board-meta-note">${esc(t('rankings.metaNote'))}</span>
    </div>
  </div>`;
}

/* ---------- Model catalog ---------- */

const MODELS_PAGE_SIZE = 60;

export function initModels(data) {
  renderDataBanner(data);
  const all = Array.isArray(data.models && data.models.models) ? data.models.models.slice() : [];
  const meta = data.meta || {};
  const orgs = [...new Set(all.map((model) => model.org).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  setText('#models-total', intlNumber(all.length));
  setText('#models-orgs', intlNumber(orgs.length));
  setText('#models-updated', intlDateTime(meta.generatedAt));
  setText('#models-source', (data.models && data.models.source) || t('ui.publicSource'));

  const searchEl = $('#models-search');
  const orgEl = $('#models-org');
  const modalityEl = $('#models-modality');
  const openEl = $('#models-open');
  const priceEl = $('#models-price');
  const contextEl = $('#models-context');
  const sortEl = $('#models-sort');
  const viewButtons = [...document.querySelectorAll('[data-models-view]')];
  const container = $('#models-table');
  const resultEl = $('#models-result-count');
  const moreEl = $('#models-more');
  if (!container) return;

  const state = {
    q: '',
    org: '',
    modality: '',
    open: '',
    price: '',
    context: '',
    sort: 'release',
    view: window.innerWidth < 768 ? 'cards' : 'table',
    limit: MODELS_PAGE_SIZE,
  };
  const compare = createCompare({ models: all, rankings: data.rankings });

  const renderOrgOptions = () => {
    if (!orgEl) return;
    orgEl.innerHTML = [
      `<option value="">${esc(t('models.orgFilter.all'))}</option>`,
      ...orgs.map((org) => `<option value="${esc(org)}">${esc(org)}</option>`),
    ].join('');
  };
  renderOrgOptions();
  if (orgEl) {
    orgEl.addEventListener('change', () => {
      state.org = orgEl.value;
      state.limit = MODELS_PAGE_SIZE;
      render();
    });
  }
  const bindSelect = (el, key) => {
    if (!el) return;
    el.addEventListener('change', () => {
      state[key] = el.value;
      state.limit = MODELS_PAGE_SIZE;
      render();
    });
  };
  bindSelect(modalityEl, 'modality');
  bindSelect(openEl, 'open');
  bindSelect(priceEl, 'price');
  bindSelect(contextEl, 'context');
  bindSelect(sortEl, 'sort');
  if (searchEl) {
    searchEl.addEventListener(
      'input',
      debounce(() => {
        state.q = searchEl.value.trim().toLowerCase();
        state.limit = MODELS_PAGE_SIZE;
        render();
      }, 180)
    );
  }
  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.modelsView === 'cards' ? 'cards' : 'table';
      syncViewButtons();
      render();
    });
  });

  function syncViewButtons() {
    viewButtons.forEach((button) => {
      const active = button.dataset.modelsView === state.view;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function match(model) {
    if (state.org && model.org !== state.org) return false;
    if (state.modality && !(Array.isArray(model.modalities) && model.modalities.includes(state.modality))) return false;
    if (state.open === 'open' && !model.openWeights) return false;
    if (state.open === 'closed' && model.openWeights) return false;
    const input = model.pricing && Number(model.pricing.input);
    if (state.price === 'free' && !(Number.isFinite(input) && input === 0)) return false;
    if (state.price === 'low' && !(Number.isFinite(input) && input > 0 && input <= 1)) return false;
    if (state.price === 'mid' && !(Number.isFinite(input) && input > 1 && input <= 5)) return false;
    if (state.price === 'high' && !(Number.isFinite(input) && input > 5)) return false;
    const context = Number(model.contextWindow);
    if (state.context === '128k' && !(context >= 128000)) return false;
    if (state.context === '500k' && !(context >= 500000)) return false;
    if (state.context === '1m' && !(context >= 1000000)) return false;
    if (!state.q) return true;
    return [model.name, model.org, model.id, model.description]
      .join(' ')
      .toLowerCase()
      .includes(state.q);
  }

  function sorted(list) {
    const copy = list.slice();
    const price = (model) => (model.pricing && Number(model.pricing.input)) || Number.POSITIVE_INFINITY;
    switch (state.sort) {
      case 'price-asc':
        return copy.sort((a, b) => price(a) - price(b));
      case 'price-desc':
        return copy.sort((a, b) => price(b) - price(a));
      case 'context':
        return copy.sort((a, b) => (Number(b.contextWindow) || 0) - (Number(a.contextWindow) || 0));
      case 'name':
        return copy.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      default:
        return copy.sort((a, b) => (Date.parse(b.releaseDate || '') || 0) - (Date.parse(a.releaseDate || '') || 0));
    }
  }

  function tableHtml(list) {
    const rows = list
      .map((model) => {
        const link = safeHref(model.links && (model.links.api || model.links.official));
        const name = displayModelName(model);
        const priceText = fmtPrice(model.pricing) || t('ui.notPublished');
        const modalities = (Array.isArray(model.modalities) ? model.modalities : [])
          .map((modality) => modalityLabelOf(modality))
          .join(' / ');
        return `<tr>
          <td class="cell-compare">${compare.checkboxHtml(model, 'table')}</td>
          <td class="cell-model">
            ${
              link
                ? `<a class="cell-name" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>`
                : `<span class="cell-name">${esc(name)}</span>`
            }
            <span class="cell-org">${esc(model.org || '—')}</span>
          </td>
          <td class="num-cell">${esc(fmtContext(model.contextWindow))}</td>
          <td class="modality-cell">${esc(modalities || '—')}</td>
          <td>${model.openWeights ? `<span class="tag tag--gold">${esc(t('data.open.open'))}</span>` : `<span class="u-muted">${esc(t('data.open.closed'))}</span>`}</td>
          <td class="price-cell">${esc(priceText)}</td>
          <td class="date-cell">${esc(intlDate(model.releaseDate))}</td>
          <td class="cell-action">${shareButton({
            title: `${model.org || ''} ${name}`.trim(),
            url: link,
            desc: plainText(model.description || '', 120) || name,
          })}</td>
        </tr>`;
      })
      .join('');
    return `<div class="table-scroll"><table class="model-table">
      <caption class="u-visually-hidden">${esc(t('models.caption', { n: intlNumber(list.length) }))}</caption>
      <thead><tr>
        <th class="compare-col" scope="col"><span class="u-visually-hidden">${esc(t('compare.title'))}</span></th>
        <th scope="col">${esc(t('models.thModel'))}</th><th scope="col">${esc(t('models.thContext'))}</th><th scope="col">${esc(t('models.thModality'))}</th>
        <th scope="col">${esc(t('models.thOpen'))}</th><th scope="col">${esc(t('models.thPrice'))}</th><th scope="col">${esc(t('models.thRelease'))}</th><th scope="col"><span class="u-visually-hidden">${esc(t('models.thShare'))}</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function cardsHtml(list) {
    return `<div class="models-grid">${list
      .map((model) => modelCardHtml(model, { externalLink: true, compareCheckbox: compare.checkboxHtml(model, 'card') }))
      .join('')}</div>`;
  }

  function render() {
    try {
      const filtered = sorted(all.filter(match));
      if (resultEl) resultEl.textContent = t('models.resultCount', { shown: intlNumber(Math.min(filtered.length, state.limit)), total: intlNumber(filtered.length) });
      if (!filtered.length) {
        container.innerHTML = emptyHtml({
          title: t('models.empty.title'),
          desc: t('models.empty.desc'),
          reset: true,
        });
        if (moreEl) moreEl.innerHTML = '';
        return;
      }
      const pageItems = filtered.slice(0, state.limit);
      container.innerHTML = state.view === 'cards' ? cardsHtml(pageItems) : tableHtml(pageItems);
      compare.sync();
      syncViewButtons();
      if (moreEl) {
        const remaining = filtered.length - pageItems.length;
        moreEl.innerHTML =
          remaining > 0
            ? `<button type="button" class="btn btn--ghost" data-models-more>${esc(t('models.showMore', { n: intlNumber(remaining) }))}</button>`
            : '';
      }
    } catch (error) {
      container.innerHTML = emptyHtml({ title: t('models.error.title'), desc: t('ui.dataError.desc'), error: true });
      reportRuntime('#models-table', error);
    }
  }

  container.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset-filters]')) {
      state.q = '';
      state.org = '';
      state.modality = '';
      state.open = '';
      state.price = '';
      state.context = '';
      state.sort = 'release';
      state.limit = MODELS_PAGE_SIZE;
      if (searchEl) searchEl.value = '';
      [orgEl, modalityEl, openEl, priceEl, contextEl, sortEl].forEach((el) => {
        if (el) el.value = '';
      });
      if (sortEl) sortEl.value = 'release';
      render();
    }
  });

  if (moreEl) {
    moreEl.addEventListener('click', (event) => {
      if (!event.target.closest('[data-models-more]')) return;
      state.limit += MODELS_PAGE_SIZE;
      render();
    });
  }

  pageRefreshers.set('models', () => {
    setText('#models-total', intlNumber(all.length));
    setText('#models-orgs', intlNumber(orgs.length));
    setText('#models-updated', intlDateTime(meta.generatedAt));
    setText('#models-source', (data.models && data.models.source) || t('ui.publicSource'));
    renderOrgOptions();
    render();
    compare.refresh();
  });

  syncViewButtons();
  render();
}

export function initResources(data) {
  renderDataBanner(data);
  const all = Array.isArray(data.resources && data.resources.items) ? data.resources.items.slice() : [];
  const meta = data.meta || {};
  setText('#resource-total', intlNumber(all.length));
  setText('#resources-updated', intlDateTime(meta.generatedAt));
  setText('#resources-source', (data.resources && data.resources.source) || t('ui.curated'));
  setText('#resource-featured-total', intlNumber(all.filter((item) => item.featured).length));

  const grid = $('#resources-grid');
  const kindChips = $('#resource-kind-chips');
  const levelEl = $('#resource-level');
  const langEl = $('#resource-lang');
  const freeEl = $('#resource-free');
  const freeOnlyEl = $('#resource-free-only');
  const searchEl = $('#resource-search');
  const resultEl = $('#resources-result-count');
  if (!grid) return;

  const typeOrder = ['course', 'tutorial', 'book', 'video', 'paper', 'tool', 'awesome'];
  const types = [...new Set(all.map((item) => item.type))].filter((type) => typeLabelOf(type));
  types.sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));
  const typeCounts = all.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  const renderTypeChips = () => {
    if (!kindChips) return;
    kindChips.innerHTML = [
      `<button type="button" class="chip" data-resource-type="all" aria-pressed="true">${esc(t('ui.all'))}</button>`,
      ...types.map(
        (type) =>
          `<button type="button" class="chip" data-resource-type="${esc(type)}" aria-pressed="false">${esc(
            typeLabelOf(type)
          )}<span class="chip-count">${typeCounts[type]}</span></button>`
      ),
    ].join('');
  };
  renderTypeChips();

  const state = { type: 'all', level: '', lang: '', free: false, q: '' };

  const renderLevelOptions = () => {
    if (!levelEl) return;
    levelEl.innerHTML = [
      `<option value="">${esc(t('resources.levelFilter.all'))}</option>`,
      ...['beginner', 'intermediate', 'advanced'].map((level) => `<option value="${level}">${levelLabelOf(level)}</option>`),
    ].join('');
  };
  const renderLangOptions = () => {
    if (!langEl) return;
    langEl.innerHTML = [
      `<option value="">${esc(t('resources.languageFilter.all'))}</option>`,
      ...['zh', 'en', 'multi'].map((lang) => `<option value="${lang}">${langLabelOf(lang)}</option>`),
    ].join('');
  };
  renderLevelOptions();
  renderLangOptions();

  if (levelEl) {
    levelEl.addEventListener('change', () => {
      state.level = levelEl.value;
      render();
    });
  }
  if (langEl) {
    langEl.addEventListener('change', () => {
      state.lang = langEl.value;
      render();
    });
  }
  if (freeEl) {
    freeEl.addEventListener('change', () => {
      state.free = freeEl.checked;
      render();
    });
  }
  if (freeOnlyEl) {
    freeOnlyEl.addEventListener('change', () => {
      state.free = freeOnlyEl.checked;
      if (freeEl) freeEl.checked = freeOnlyEl.checked;
      render();
    });
  }
  if (searchEl) {
    searchEl.addEventListener(
      'input',
      debounce(() => {
        state.q = searchEl.value.trim().toLowerCase();
        render();
      }, 180)
    );
  }

  if (kindChips) {
    kindChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-resource-type]');
      if (!chip) return;
      state.type = chip.dataset.resourceType;
      kindChips.querySelectorAll('[data-resource-type]').forEach((el) => {
        el.setAttribute('aria-pressed', el === chip ? 'true' : 'false');
      });
      render();
    });
  }

  grid.addEventListener('click', (event) => {
    if (!event.target.closest('[data-reset-filters]')) return;
    state.type = 'all';
    state.level = '';
    state.lang = '';
    state.free = false;
    state.q = '';
    if (searchEl) searchEl.value = '';
    if (levelEl) levelEl.value = '';
    if (langEl) langEl.value = '';
    if (freeEl) freeEl.checked = false;
    if (freeOnlyEl) freeOnlyEl.checked = false;
    if (kindChips) {
      kindChips.querySelectorAll('[data-resource-type]').forEach((el) => {
        el.setAttribute('aria-pressed', el.dataset.resourceType === 'all' ? 'true' : 'false');
      });
    }
    render();
  });

  function filtered() {
    return all
      .filter((item) => {
        if (state.type !== 'all' && item.type !== state.type) return false;
        if (state.level && item.level !== state.level) return false;
        if (state.lang && item.lang !== state.lang) return false;
        if (state.free && !item.free) return false;
        if (!state.q) return true;
        return [item.title, item.author, item.authorEn, item.description, item.descriptionEn, ...(Array.isArray(item.tags) ? item.tags : [])]
          .join(' ')
          .toLowerCase()
          .includes(state.q);
      })
      .sort((a, b) => {
        if (Boolean(b.featured) !== Boolean(a.featured)) return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        return (Date.parse(b.addedAt || '') || 0) - (Date.parse(a.addedAt || '') || 0);
      });
  }

  function cardHtml(item) {
    const featured = Boolean(item.featured);
    const tags = (Array.isArray(item.tags) ? item.tags : [])
      .slice(0, 4)
      .map((tag) => `<li class="tag">${esc(tagLabel(tag))}</li>`)
      .join('');
    return `<article class="resource-card${featured ? ' resource-card--featured' : ''}">
      ${featured ? `<span class="resource-featured-mark">${esc(t('ui.featured'))}</span>` : ''}
      <p class="resource-type">${esc(typeLabelOf(item.type) || t('ui.resourceFallback'))} · ${esc(
        levelLabelOf(item.level)
      )}</p>
      <h2 class="resource-title"><a href="${esc(safeHref(item.url) || '#')}" target="_blank" rel="noopener noreferrer">${esc(
        plainText((getLang() === 'en' && item.titleEn) || item.title || t('ui.untitledResource'), 120)
      )} ↗</a></h2>
      <p class="resource-author">${esc((getLang() === 'en' && item.authorEn) || item.author || '')}${(item.author || item.authorEn) && item.lang ? ' · ' : ''}${esc(
        langLabelOf(item.lang)
      )}${item.free ? ' · ' + esc(t('ui.free')) : ''}</p>
      <p class="resource-desc">${esc(plainText(localizedItemField(item, 'description') || '', 150))}</p>
      ${tags ? `<ul class="resource-tags">${tags}</ul>` : ''}
      <div class="resource-foot">
        <span>${esc(levelLabelOf(item.level) || '—')} · ${esc(langLabelOf(item.lang) || '—')} · ${
          item.free ? t('ui.free') : t('ui.paid')
        }</span>
        ${shareButton({
          title: (getLang() === 'en' && item.titleEn) || item.title || t('nav.resources'),
          url: safeHref(item.url),
          desc: plainText(localizedItemField(item, 'description') || '', 120),
        })}
      </div>
    </article>`;
  }

  function render() {
    try {
      const result = filtered();
      if (resultEl) resultEl.textContent = t('resources.resultCount', { shown: intlNumber(result.length), total: intlNumber(all.length) });
      if (!result.length) {
        grid.innerHTML = emptyHtml({
          title: t('resources.empty.title'),
          desc: t('resources.empty.desc'),
          reset: true,
        });
        return;
      }
      grid.innerHTML = result.map((item) => cardHtml(item)).join('');
    } catch (error) {
      grid.innerHTML = emptyHtml({ title: t('resources.error.title'), desc: t('ui.dataError.desc'), error: true });
      reportRuntime('#resources-grid', error);
    }
  }

  pageRefreshers.set('resources', () => {
    setText('#resource-total', intlNumber(all.length));
    setText('#resource-featured-total', intlNumber(all.filter((item) => item.featured).length));
    setText('#resources-updated', intlDateTime(meta.generatedAt));
    setText('#resources-source', (data.resources && data.resources.source) || t('ui.curated'));
    renderTypeChips();
    renderLevelOptions();
    renderLangOptions();
    render();
  });

  render();
}

/* ---------- Projects ---------- */

export function initProjects(data) {
  renderDataBanner(data);
  const all = Array.isArray(data.projects && data.projects.items) ? data.projects.items.slice() : [];
  const meta = data.meta || {};
  const self = all.filter((item) => item.sourceType === 'self');
  const community = all.filter((item) => item.sourceType !== 'self');
  setText('#project-total', intlNumber(all.length));
  setText('#projects-updated', intlDateTime(meta.generatedAt));
  setText('#projects-source', (data.projects && data.projects.source) || t('ui.curated'));

  const selfGrid = $('#projects-self');
  const skillsGrid = $('#projects-skills');
  const grid = $('#projects-grid');
  const tagBar = $('#project-tags');
  const sortEl = $('#projects-sort');
  const searchEl = $('#projects-search');
  const resultEl = $('#projects-result-count');
  if (!grid) return;

  const renderProjectSkills = () => {
    if (!skillsGrid) return;
    const skillItems = data.skills && Array.isArray(data.skills.items) ? data.skills.items.slice() : [];
    const picks = skillItems
      .filter((item) => item.sourceType !== 'mine')
      .sort((a, b) => {
        const order = { official: 0, community: 1 };
        const sourceDiff = (order[a.sourceType] ?? 2) - (order[b.sourceType] ?? 2);
        if (sourceDiff) return sourceDiff;
        if (Boolean(b.featured) !== Boolean(a.featured)) return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        return (Number(b.stars) || 0) - (Number(a.stars) || 0);
      })
      .slice(0, 6);
    skillsGrid.innerHTML = picks.length
      ? picks.map((item) => projectSkillCardHtml(item)).join('')
      : `<div class="empty-state" role="status"><p class="empty-title">${esc(t('projects.skills.empty'))}</p></div>`;
  };
  renderProjectSkills();

  const state = { tag: 'all', sort: 'stars', q: '' };

  const tagCounts = new Map();
  all.forEach((item) => {
    (Array.isArray(item.tags) ? item.tags : []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);

  const renderSelfProjects = () => {
    if (!selfGrid) return;
    selfGrid.innerHTML = self.length
      ? self.map((item) => projectCardHtml(item, { featured: true })).join('')
      : emptyHtml({ title: t('projects.self.empty.title'), desc: t('projects.self.empty.desc') });
    selfGrid.classList.toggle('project-grid--single', self.length === 1);
  };
  renderSelfProjects();

  const renderTagChips = () => {
    if (!tagBar) return;
    tagBar.innerHTML = [
      `<button type="button" class="chip" data-project-tag="all" aria-pressed="true">${esc(t('ui.all'))}</button>`,
      ...tags.map(
        ([tag, count]) =>
          `<button type="button" class="chip" data-project-tag="${esc(tag)}" aria-pressed="false">${esc(
            tag
          )}<span class="chip-count">${count}</span></button>`
      ),
    ].join('');
  };
  renderTagChips();

  if (tagBar) {
    tagBar.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-project-tag]');
      if (!chip) return;
      state.tag = chip.dataset.projectTag;
      tagBar.querySelectorAll('[data-project-tag]').forEach((el) => {
        el.setAttribute('aria-pressed', el === chip ? 'true' : 'false');
      });
      render();
    });
  }

  if (sortEl) {
    sortEl.addEventListener('change', () => {
      state.sort = sortEl.value;
      render();
    });
  }
  if (searchEl) {
    searchEl.addEventListener(
      'input',
      debounce(() => {
        state.q = searchEl.value.trim().toLowerCase();
        render();
      }, 180)
    );
  }

  grid.addEventListener('click', (event) => {
    if (!event.target.closest('[data-reset-filters]')) return;
    state.tag = 'all';
    state.sort = 'stars';
    state.q = '';
    if (searchEl) searchEl.value = '';
    if (sortEl) sortEl.value = 'stars';
    if (tagBar) {
      tagBar.querySelectorAll('[data-project-tag]').forEach((el) => {
        el.setAttribute('aria-pressed', el.dataset.projectTag === 'all' ? 'true' : 'false');
      });
    }
    render();
  });

  function filtered() {
    return community
      .filter((item) => {
        if (state.tag !== 'all' && !(Array.isArray(item.tags) && item.tags.includes(state.tag))) return false;
        if (!state.q) return true;
        return [item.name, item.nameEn, item.owner, item.summary, item.summaryEn, item.highlight, item.highlightEn, ...(Array.isArray(item.tags) ? item.tags : [])]
          .join(' ')
          .toLowerCase()
          .includes(state.q);
      })
      .sort((a, b) => {
        if (state.sort === 'updated') return (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0);
        if (state.sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
        return (Number(b.stars) || 0) - (Number(a.stars) || 0);
      });
  }

  function render() {
    try {
      const result = filtered();
      if (resultEl) resultEl.textContent = t('projects.resultCount', { shown: intlNumber(result.length), total: intlNumber(community.length) });
      if (!result.length) {
        grid.innerHTML = emptyHtml({
          title: t('projects.empty.title'),
          desc: t('projects.empty.desc'),
          reset: true,
        });
        return;
      }
      grid.innerHTML = result.map((item) => projectCardHtml(item)).join('');
    } catch (error) {
      grid.innerHTML = emptyHtml({ title: t('projects.error.title'), desc: t('ui.dataError.desc'), error: true });
      reportRuntime('#projects-grid', error);
    }
  }

  pageRefreshers.set('projects', () => {
    setText('#project-total', intlNumber(all.length));
    renderProjectSkills();
    setText('#projects-updated', intlDateTime(meta.generatedAt));
    setText('#projects-source', (data.projects && data.projects.source) || t('ui.curated'));
    renderSelfProjects();
    renderTagChips();
    render();
  });

  render();
}

function projectCardHtml(item, { featured = false } = {}) {
  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .slice(0, 4)
    .map((tag) => `<li class="tag">${esc(tagLabel(tag))}</li>`)
    .join('');
  const stars = item.stars == null ? null : `${intlNumber(item.stars)}`;
  return `<article class="project-card${featured ? ' project-card--self' : ''}">
    <div class="project-head">
      <div>
        <h2 class="project-name"><a href="${esc(safeHref(item.url) || '#')}" target="_blank" rel="noopener noreferrer">${esc(
          (getLang() === 'en' && item.nameEn) || item.name || t('ui.untitledProject')
        )} ↗</a></h2>
        <p class="project-owner">${esc(item.owner || '')}${item.repo ? ` · ${esc(item.repo)}` : ''}${
          item.license ? ` · ${esc(item.license)}` : ''
        }</p>
      </div>
      ${
        featured
          ? `<span class="project-badge">${esc(t('data.projectType.self'))}</span>`
          : `<span class="project-stars" aria-label="Stars">★ ${esc(stars || '—')}</span>`
      }
    </div>
    <p class="project-summary">${esc(plainText(localizedItemField(item, 'summary') || '', 180))}</p>
    ${localizedItemField(item, 'highlight') ? `<p class="project-highlight">${esc(plainText(localizedItemField(item, 'highlight'), 100))}</p>` : ''}
    ${localizedItemField(item, 'why') && featured ? `<p class="project-why">${esc(plainText(localizedItemField(item, 'why'), 160))}</p>` : ''}
    ${tags ? `<ul class="project-tags">${tags}</ul>` : ''}
    <div class="project-foot">
      <span class="project-meta">${item.updatedAt ? t('ui.updatedOn', { date: intlDate(item.updatedAt) }) : ''}${
        featured ? '' : ' · ' + esc(t('data.projectType.community'))
      }</span>
      <span class="project-actions">
        <a class="link-arrow" href="${esc(safeHref(item.url) || '#')}" target="_blank" rel="noopener noreferrer">${esc(t('projects.viewProject'))}</a>
        ${shareButton({
          title: (getLang() === 'en' && item.nameEn) || item.name || t('nav.projects'),
          url: safeHref(item.url),
          desc: plainText(localizedItemField(item, 'summary') || localizedItemField(item, 'highlight') || '', 140),
        })}
      </span>
    </div>
  </article>`;
}

/* ---------- About page ---------- */

export function initAbout(data) {
  renderDataBanner(data);
  const renderAbout = () => {
  const meta = data.meta || {};
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  const counts = {
    models: (data.models && data.models.models && data.models.models.length) || 0,
    news: (data.news && data.news.items && data.news.items.length) || 0,
    boards: (data.rankings && data.rankings.boards && data.rankings.boards.length) || 0,
    resources: (data.resources && data.resources.items && data.resources.items.length) || 0,
    projects: (data.projects && data.projects.items && data.projects.items.length) || 0,
  };
  Object.entries(counts).forEach(([key, value]) => setText(`#about-count-${key}`, intlNumber(value)));
  setText('#about-source-total', intlNumber(sources.length));
  setText('#about-updated', intlDateTime(meta.generatedAt));
  setText('#about-mode', String(meta.mode || 'seed').toUpperCase());

  const table = $('#about-sources');
  if (table) {
    
    try {
      const rows = sources
        .map((source) => {
          const status = source.status || 'blocked';
          return `<tr>
            <td>
              ${
                safeHref(source.url)
                  ? `<a class="source-name" href="${esc(safeHref(source.url))}" target="_blank" rel="noopener noreferrer">${esc(
                      sourceNameText(source)
                    )} ↗</a>`
                  : `<span class="source-name">${esc(sourceNameText(source))}</span>`
              }
              ${sourceNoteText(source) ? `<p class="source-note">${esc(sourceNoteText(source))}</p>` : ''}
            </td>
            <td class="source-type"><span class="tag">${esc(sourceTypeLabelOf(source.type))}</span></td>
            <td><span class="source-status"><span class="status-dot status-dot--${esc(status)}"></span>${esc(
              statusLabelOf(status)
            )}</span></td>
            <td class="num-cell">${source.items == null ? '—' : esc(intlNumber(source.items))}</td>
            <td class="source-time">${source.lastFetchedAt ? esc(intlDateTime(source.lastFetchedAt)) : '—'}</td>
          </tr>`;
        })
        .join('');
      table.innerHTML = rows || `<tr><td colspan="5">${esc(t('about.sources.empty'))}</td></tr>`;
    } catch (error) {
      table.innerHTML = `<tr><td colspan="5">${esc(t('about.sources.error'))}</td></tr>`;
      reportRuntime('#about-sources', error);
    }
  }
  };
  renderAbout();
  pageRefreshers.set('about', renderAbout);
}

export { debounce };
