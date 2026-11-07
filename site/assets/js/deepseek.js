/* =============================================================================
   AI Pulse - DeepSeek focus page.
   Renders the editorial milestones from data/deepseek.json and the latest
   DeepSeek dispatches from the daily news feed. All content is escaped and
   every external link is allowlisted before it reaches the DOM.
   ============================================================================= */

import { loadAll, safeHttpUrl, escapeHtml } from './data.js';
import { t, getLang, initI18n, onLangChange } from './i18n.js';

const DATA_URL = new URL('./data/deepseek.json', document.baseURI).href;
const esc = escapeHtml;
const MAX_NEWS = 8;

const $ = (id) => document.getElementById(id);

let focusData = { milestones: [], sourceLabel: { zh: '', en: '' } };
let siteData = null;

/* ---------- Formatting helpers ---------- */

const DEEPSEEK_TAG_EN = {
  '官方公告': 'Official update',
  '模型发布': 'Model release',
  '官方博客': 'Official blog',
  '开源': 'Open source',
  '多模态': 'Multimodal',
  '推理': 'Reasoning',
  '长上下文': 'Long context',
  '评测': 'Evaluation',
  '定价': 'Pricing',
  '研究': 'Research',
  '政策/安全': 'Policy & safety',
  '开源权重': 'Open weights',
  '免费': 'Free',
};
const deepseekTag = (tag) => (getLang() === 'en' ? DEEPSEEK_TAG_EN[tag] || tag : tag);
function localized(value, lang) {
  if (value && typeof value === 'object') return String(value[lang] ?? value.zh ?? value.en ?? '');
  return String(value ?? '');
}

function dateParts(value) {
  const raw = String(value ?? '');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return { day: '--', month: '' };
  const lang = getLang();
  const year = date.getUTCFullYear();
  const monthNumber = String(date.getUTCMonth() + 1).padStart(2, '0');
  const month = lang === 'en'
    ? `${new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)} ${year}`
    : `${year}.${monthNumber}`;
  return { day: String(date.getUTCDate()).padStart(2, '0'), month };
}

function shortDate(value) {
  const raw = String(value ?? '');
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : raw.slice(0, 10);
}

function isDeepSeekModel(model) {
  return /deepseek/i.test(`${model.id || ''} ${model.name || ''} ${model.org || ''}`);
}

function isDeepSeekNews(item) {
  const hay = [item.title, item.id, (item.tags || []).join(' '), (item.models || []).join(' ')].join(' ');
  return /deepseek/i.test(hay);
}

function sortedNews(items) {
  return items
    .filter(isDeepSeekNews)
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
}

/* ---------- Markup ---------- */

function emptyState(title, desc) {
  return `<li class="empty-state" role="status">
    <p class="empty-title">${esc(title)}</p>
    <p class="empty-desc">${esc(desc)}</p>
  </li>`;
}

function dispatchItem({ dateValue, kind, title, summary, url, source, tags = [], importance = 1 }) {
  const link = safeHttpUrl(url);
  const { day, month } = dateParts(dateValue);
  const heading = link
    ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`
    : esc(title);
  const tagList = tags.slice(0, 4).map((tag) => `<li class="tag">${esc(deepseekTag(tag))}</li>`).join('');
  const sourceLine = link
    ? `<a class="source-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(t('ui.source'))} - ${esc(source)}</a>`
    : `<span>${esc(t('ui.source'))} - ${esc(source)}</span>`;
  return `<li class="timeline-item" data-importance="${Number(importance) || 1}">
    <div class="timeline-date">
      <span class="day">${esc(day)}</span>
      <span class="month">${esc(month)}</span>
    </div>
    <article class="dispatch-card">
      <div class="dispatch-head">
        <span class="tag tag--gold">${esc(kind)}</span>
        <span class="focus-source">${esc(source)}</span>
      </div>
      <h2 class="dispatch-title">${heading}</h2>
      ${summary ? `<p class="dispatch-summary">${esc(summary)}</p>` : ''}
      <div class="dispatch-foot">
        ${sourceLine}
        <span>${esc(shortDate(dateValue))}</span>
        ${tagList ? `<ul class="dispatch-tags">${tagList}</ul>` : ''}
      </div>
    </article>
  </li>`;
}

function renderMilestones() {
  const list = $('deepseek-milestones-list');
  if (!list) return;
  const lang = getLang();
  const items = Array.isArray(focusData.milestones) ? focusData.milestones : [];
  list.innerHTML = items.length
    ? items
        .slice()
        .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))
        .map((item) =>
          dispatchItem({
            dateValue: item.date,
            kind: localized(item.kind, lang),
            title: localized(item.title, lang),
            summary: localized(item.summary, lang),
            url: item.url,
            source: localized(item.source, lang) || localized(focusData.sourceLabel, lang),
            tags: [],
            importance: item.importance,
          })
        )
        .join('')
    : emptyState(t('deepseek.milestones.emptyTitle'), t('deepseek.latest.emptyDesc'));
}

function renderNews() {
  const list = $('deepseek-news-list');
  if (!list) return;
  const items = sortedNews(siteData?.news?.items || []);
  const lang = getLang();
  list.innerHTML = items.length
    ? items
        .slice(0, MAX_NEWS)
        .map((item) =>
          dispatchItem({
            dateValue: item.publishedAt,
            kind: lang === 'en' ? 'DISPATCH' : '动态',
            title: (lang === 'en' && item.titleEn) || item.title || t('ui.untitledNews'),
            summary: (lang === 'en' && item.summaryEn) || item.summary,
            url: item.url || item.sourceUrl,
            source: item.sourceName || t('ui.publicSource'),
            tags: item.tags,
            importance: item.importance,
          })
        )
        .join('')
    : emptyState(t('deepseek.latest.emptyTitle'), t('deepseek.latest.emptyDesc'));
  const count = $('deepseek-news-count');
  if (count) count.textContent = String(items.length);
  return items;
}

function renderSnapshot(items) {
  const models = (siteData?.models?.models || []).filter(isDeepSeekModel);
  const latest = models
    .slice()
    .sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')))[0];
  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };
  set('deepseek-models-count', String(models.length));
  set('deepseek-latest-date', latest?.releaseDate || '--');
  set('deepseek-updated', String(siteData?.meta?.generatedAt || focusData.updatedAt || '').slice(0, 10) || '--');
  set('deepseek-source', [...new Set((items || []).map((n) => n.sourceName).filter(Boolean))].slice(0, 3).join(' / ') || '--');
  set('focus-stat-models', String(models.length));
  set('focus-stat-latest', latest?.name || '--');
  set('focus-stat-news', String((items || []).length));
  set('focus-stat-updated', String(siteData?.meta?.generatedAt || focusData.updatedAt || '').slice(0, 10) || '--');
}

function renderAll() {
  const items = sortedNews(siteData?.news?.items || []);
  renderNews();
  renderMilestones();
  renderSnapshot(items);
}

/* ---------- Bootstrap ---------- */

async function loadFocus() {
  try {
    const res = await fetch(DATA_URL, { headers: { accept: 'application/json' }, cache: 'no-cache' });
    if (!res.ok) throw new Error(`deepseek.json HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') focusData = data;
  } catch (error) {
    if (window.__siteErrors) window.__siteErrors.runtime.push(`deepseek.json: ${error.message}`);
  }
}

async function init() {
  await initI18n();
  const [data] = await Promise.all([
    loadAll().catch(() => null),
    loadFocus(),
  ]);
  siteData = data;
  renderAll();
  onLangChange(renderAll);
}

init().catch((error) => {
  if (window.__siteErrors) window.__siteErrors.runtime.push(`deepseek init: ${error.message}`);
});
