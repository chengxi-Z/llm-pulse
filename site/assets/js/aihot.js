/* =============================================================================
   aihot.js — AI Hot module (home section + standalone aihot.html page)
   Data comes from data/aihot.json, produced by scripts/fetch/aihot.mjs from
   AIHOT's anonymous public API (same dataset as its MCP server).
   All external text is escaped and treated as untrusted plain text.
   ========================================================================== */
import { t, getLang, onLangChange } from './i18n.js';
import { isAiHotEnabled } from './aihot-scope.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
const safeUrl = (value) => {
  const raw = String(value == null ? '' : value).trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
};
const text = (value, max = 0) => {
  const s = String(value == null ? '' : value).trim();
  return max > 0 ? s.slice(0, max) : s;
};
const fmtDate = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  try {
    return new Intl.DateTimeFormat(getLang() === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  } catch { return ''; }
};
const bundleOf = (data) => (data && data.aihot && typeof data.aihot === 'object' ? data.aihot : null);

let homeData = null;
let pageData = null;
let activeReport = 'daily';

/* ---------------- language gate ----------------
   AI Hot is a Chinese-only module. In the English edition every AIHOT node is
   detached from the DOM (not merely hidden), all generated content is cleared,
   and the home section index is renumbered. Switching back to Chinese restores
   the exact original nodes in their original order and re-renders them. */

const AIHOT_SELECTOR = '[data-aihot-only]';
const AIHOT_DYNAMIC_IDS = [
  'home-aihot-hot', 'home-aihot-resets',
  'aihot-meta', 'aihot-hot-list', 'aihot-report-panel', 'aihot-reset-grid',
];
const EXPLORE_IDX_ZH = '05';
const EXPLORE_IDX_EN = '04';
let detachedNodes = [];

function clearDynamicBlocks() {
  AIHOT_DYNAMIC_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

function restoreNodes() {
  if (!detachedNodes.length) return;
  detachedNodes.slice().reverse().forEach(({ node, parent, next }) => {
    if (!parent || !parent.isConnected) return;
    parent.insertBefore(node, next && next.parentNode === parent ? next : null);
  });
  detachedNodes = [];
}

function syncExploreIndex(enabled) {
  const idx = document.getElementById('home-explore-idx');
  if (idx) idx.textContent = enabled ? EXPLORE_IDX_ZH : EXPLORE_IDX_EN;
}

export function applyAiHotGate(lang = getLang()) {
  const enabled = isAiHotEnabled(lang);
  if (enabled) {
    restoreNodes();
    document.querySelectorAll(AIHOT_SELECTOR).forEach((el) => { el.hidden = false; });
    document.documentElement.setAttribute('data-aihot', 'on');
    syncExploreIndex(true);
  } else {
    document.querySelectorAll(AIHOT_SELECTOR).forEach((el) => {
      el.hidden = true;
      detachedNodes.push({ node: el, parent: el.parentNode, next: el.nextSibling });
      el.remove();
    });
    clearDynamicBlocks();
    document.documentElement.setAttribute('data-aihot', 'off');
    syncExploreIndex(false);
  }
  return enabled;
}

/* ---------------- shared fragments ---------------- */

function metaLine(parts) {
  return parts.filter(Boolean).map((p) => `<span class="ah-meta-item">${esc(p)}</span>`).join('<span class="ah-meta-sep" aria-hidden="true">·</span>');
}

function hotItemHtml(topic, { detailed = false } = {}) {
  const title = text(topic.title, 200);
  const url = safeUrl(topic.url);
  const story = safeUrl(topic.storyUrl);
  const original = safeUrl(topic.originalUrl);
  if (!title || !url) return '';
  const rank = Number.isInteger(topic.rank) ? topic.rank : 0;
  const meta = metaLine([
    t('aihot.hot.sources', { count: topic.sourceCount || 0 }),
    t('aihot.hot.signals', { count: topic.signalCount || 0 }),
    fmtDate(topic.latestAt),
  ]);
  const names = Array.isArray(topic.sourceNames) ? topic.sourceNames.slice(0, 3).join(' / ') : '';
  if (!detailed) {
    return `<li class="ah-hot-item"><a class="ah-hot-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
      <span class="ah-hot-rank">${String(rank).padStart(2, '0')}</span>
      <span><span class="ah-hot-title">${esc(title)}</span><span class="ah-meta ah-hot-meta">${meta}</span></span>
    </a></li>`;
  }
  const links = [
    story ? `<a href="${esc(story)}" target="_blank" rel="noopener noreferrer">${esc(t('aihot.hot.story'))} ↗</a>` : '',
    original ? `<a href="${esc(original)}" target="_blank" rel="noopener noreferrer">${esc(t('aihot.hot.original'))} ↗</a>` : '',
  ].filter(Boolean).join('');
  return `<li class="ah-board-item">
    <span class="ah-board-rank">${String(rank).padStart(2, '0')}</span>
    <div>
      <h3 class="ah-board-title"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></h3>
      <span class="ah-meta">${meta}</span>
      ${names ? `<p class="ah-board-sources">${esc(t('aihot.hot.moreSources', { names }))}</p>` : ''}
      ${links ? `<div class="ah-board-links">${links}</div>` : ''}
    </div>
  </li>`;
}

function resetEventHtml(event) {
  const title = text(event.title, 160) || text(event.displayLabel, 80);
  if (!title) return '';
  const statusKey = `aihot.resets.status.${text(event.status) || 'unknown'}`;
  const status = t(statusKey) === statusKey ? t('aihot.resets.status.unknown') : t(statusKey);
  const notes = [status];
  if (event.audience) notes.push(text(event.audience, 100));
  if (event.scope) notes.push(text(event.scope, 100));
  if (event.estimateLabel) notes.push(`${t('aihot.resets.estimate')} ${text(event.estimateLabel, 100)}`);
  if (event.createdAt) notes.push(fmtDate(event.createdAt));
  return `<li class="ah-reset-event">
    <span class="ah-reset-event-top"><span class="ah-tag">${esc(text(event.displayLabel, 40))}</span></span>
    <span class="ah-reset-event-title">${esc(title)}</span>
    <span class="ah-reset-event-note">${esc(notes.filter(Boolean).join(' · '))}</span>
  </li>`;
}

/* ---------------- home section ---------------- */

export function initHomeAihot(data) {
  homeData = data;
  if (!isAiHotEnabled(getLang())) return;
  renderHome();
}

export function refreshHomeAihot() {
  if (homeData && isAiHotEnabled(getLang())) renderHome();
}

function renderHome() {
  if (!isAiHotEnabled(getLang())) return;
  const hotEl = $('#home-aihot-hot');
  const resetEl = $('#home-aihot-resets');
  if (!hotEl && !resetEl) return;
  const bundle = bundleOf(homeData);
  const topics = (bundle && Array.isArray(bundle.hotTopics) ? bundle.hotTopics : []).slice(0, 5);
  if (hotEl) {
    hotEl.innerHTML = topics.length
      ? topics.map((topic) => hotItemHtml(topic)).join('')
      : `<li class="ah-empty">${esc(t('home.aihot.empty'))}</li>`;
  }
  if (resetEl) {
    const resets = (bundle && bundle.resets && typeof bundle.resets === 'object') ? Object.values(bundle.resets) : [];
    resetEl.innerHTML = resets.length
      ? resets.map((reset) => {
          const latest = Array.isArray(reset.events) && reset.events.length ? reset.events[0] : null;
          const headline = latest ? (text(latest.title, 90) || text(latest.displayLabel, 60)) : t('aihot.resets.noEvents');
          const sub = latest && latest.estimateLabel
            ? `${t('aihot.resets.estimate')} ${text(latest.estimateLabel, 70)}`
            : (latest ? fmtDate(latest.createdAt || latest.updatedAt) : '');
          return `<div class="ah-pulse-row">
            <span class="ah-pulse-name">${esc(text(reset.label, 30))}</span>
            <span><span class="ah-pulse-title">${esc(headline)}</span>${sub ? `<span class="ah-pulse-sub">${esc(sub)}</span>` : ''}</span>
          </div>`;
        }).join('')
      : `<p class="ah-empty">${esc(t('home.aihot.empty'))}</p>`;
  }
}

/* ---------------- standalone page ---------------- */

export function initAiHot(data) {
  pageData = data;
  if (!isAiHotEnabled(getLang())) return;
  bindTabs();
  renderPage();
}

export function refreshAiHot() {
  if (pageData && isAiHotEnabled(getLang())) renderPage();
}

function bindTabs() {
  const tabs = $('#aihot-report-tabs');
  if (!tabs || tabs.dataset.bound === 'true') return;
  tabs.dataset.bound = 'true';
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-report]');
    if (!button) return;
    activeReport = button.getAttribute('data-report') || 'daily';
    renderReport();
  });
}

function renderPage() {
  if (!isAiHotEnabled(getLang())) return;
  const bundle = bundleOf(pageData);
  const metaEl = $('#aihot-meta');
  const hotEl = $('#aihot-hot-list');
  const resetEl = $('#aihot-reset-grid');
  if (metaEl) {
    const topics = bundle && Array.isArray(bundle.hotTopics) ? bundle.hotTopics.length : 0;
    const picks = bundle && Array.isArray(bundle.latest) ? bundle.latest.length : 0;
    metaEl.innerHTML = metaLine([
      `${t('aihot.meta.updated')} ${fmtDate(bundle && bundle.generatedAt) || '—'}`,
      `${t('aihot.meta.hotBefore')} ${topics}`,
      `${t('aihot.meta.picks')} ${picks}`,
      `${t('aihot.meta.source')} AIHOT`,
    ]);
  }
  if (hotEl) {
    const topics = (bundle && Array.isArray(bundle.hotTopics) ? bundle.hotTopics : []).slice(0, 10);
    hotEl.innerHTML = topics.length
      ? topics.map((topic) => hotItemHtml(topic, { detailed: true })).join('')
      : `<li class="ah-empty">${esc(t('aihot.empty'))}</li>`;
  }
  if (resetEl) {
    const resets = (bundle && bundle.resets && typeof bundle.resets === 'object') ? Object.values(bundle.resets) : [];
    resetEl.innerHTML = resets.length ? resets.map(resetCardHtml).join('') : `<p class="ah-empty">${esc(t('aihot.empty'))}</p>`;
  }
  renderReport();
}

function resetCardHtml(reset) {
  const events = Array.isArray(reset.events) ? reset.events.slice(0, 4) : [];
  const status = text(reset.status, 40);
  const healthy = status === 'healthy';
  return `<article class="ah-reset-card">
    <div class="ah-reset-head">
      <h3 class="ah-reset-name">${esc(text(reset.label, 40))}</h3>
      <span class="ah-reset-status ${healthy ? 'is-healthy' : ''}">${esc(healthy ? t('aihot.resets.status.healthy') : status)}</span>
    </div>
    <div class="ah-reset-meta">${esc(t('aihot.resets.monitor'))} · ${esc(t('aihot.resets.pending', { count: reset.pendingCount || 0 }))}</div>
    <ul class="ah-reset-events">
      ${events.length ? events.map(resetEventHtml).join('') : `<li class="ah-reset-event"><span class="ah-reset-event-note">${esc(t('aihot.resets.noEvents'))}</span></li>`}
    </ul>
    <div class="ah-reset-foot">${esc(t('aihot.resets.checked'))} ${esc(fmtDate(reset.checkedAt) || '—')}</div>
  </article>`;
}

function renderReport() {
  if (!isAiHotEnabled(getLang())) return;
  const panel = $('#aihot-report-panel');
  if (!panel) return;
  $$('#aihot-report-tabs [data-report]').forEach((button) => {
    const active = button.getAttribute('data-report') === activeReport;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const bundle = bundleOf(pageData);
  const reports = (bundle && bundle.reports && typeof bundle.reports === 'object') ? bundle.reports : {};
  const report = reports[activeReport];
  if (!report) {
    panel.innerHTML = `<p class="ah-empty">${esc(t('aihot.reports.noReport'))}</p>`;
    return;
  }
  const period = text(report.key, 40) || '—';
  const overview = text(report.headline, 500) || text(report.overview, 800);
  const lead = report.lead && (text(report.lead.title, 200) || text(report.lead.leadParagraph, 600));
  const sections = Array.isArray(report.sections) ? report.sections : [];
  const sectionHtml = sections.map((section) => {
    const items = Array.isArray(section.items) ? section.items : [];
    return `<div class="ah-section">
      <h4 class="ah-section-head">${esc(text(section.label, 60))}</h4>
      ${section.summary ? `<p class="ah-section-summary">${esc(text(section.summary, 300))}</p>` : ''}
      <ul class="ah-section-list">${items.map((item) => {
        const url = safeUrl(item.aihotUrl) || safeUrl(item.originalUrl);
        const title = text(item.title, 160);
        if (!title || !url) return '';
        return `<li class="ah-section-item"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>
          <span class="ah-section-item-src">${esc(t('aihot.reports.itemSource'))} · ${esc(text(item.sourceName, 60))}</span></li>`;
      }).join('')}</ul>
    </div>`;
  }).join('');
  const reportUrl = safeUrl(report.aihotUrl);
  panel.innerHTML = `
    <div class="ah-report-head">
      <span class="ah-report-period">${esc(period)}</span>
      ${reportUrl ? `<a class="link-arrow" href="${esc(reportUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('aihot.reports.open'))}</a>` : ''}
    </div>
    ${overview ? `<p class="ah-report-overview">${esc(overview)}</p>` : ''}
    ${lead ? `<div class="ah-lead">
      <span class="ah-eyebrow">${esc(t('aihot.reports.lead'))}</span>
      ${report.lead && report.lead.title ? `<h4 class="ah-lead-title">${esc(text(report.lead.title, 200))}</h4>` : ''}
      ${report.lead && report.lead.leadParagraph ? `<p class="ah-lead-body">${esc(text(report.lead.leadParagraph, 600))}</p>` : ''}
    </div>` : ''}
    ${sectionHtml ? `<div class="ah-sections">${sectionHtml}</div>` : ''}
  `;
}

/* Language switch: apply the gate first, then re-render the restored blocks
   (static DOM translation is handled by app.js). */
onLangChange((lang) => {
  const enabled = applyAiHotGate(lang);
  if (!enabled) return;
  const page = document.body.dataset.page;
  if (page === 'index' && homeData) renderHome();
  if (page === 'aihot' && pageData) renderPage();
});
