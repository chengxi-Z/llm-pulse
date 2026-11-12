/* =============================================================================
   aihot-scope.mjs — language scoping for the AI Hot module (pure helpers).

   AI Hot is a Chinese-only module: every AIHOT-derived surface is stripped from
   the English edition and left untouched in the Chinese edition.

   These helpers have no DOM / browser dependency on purpose, so the runtime
   modules (aihot.js, render.js, dashboard.js, app.js), the feed builder and the
   Node test suite all share exactly the same rules.
   ========================================================================== */

export const AIHOT_SOURCE_ID = 'aihot';

/** The AI Hot module is enabled in Chinese only. */
export function isAiHotEnabled(lang) {
  return lang === 'zh';
}

function isAihotNewsItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.aihot) return true;
  return String(item.id || '').startsWith('aihot-') || /aihot\.news/i.test(String(item.sourceUrl || ''));
}

function isAihotSource(source) {
  if (!source || typeof source !== 'object') return false;
  return source.id === AIHOT_SOURCE_ID || /aihot\.news/i.test(String(source.url || ''));
}

/** Updates entries visible in the given language. */
export function filterAihotNews(items, lang) {
  const list = Array.isArray(items) ? items : [];
  return isAiHotEnabled(lang) ? list.slice() : list.filter((item) => !isAihotNewsItem(item));
}

/** Information sources visible in the given language. */
export function filterAihotSources(sources, lang) {
  const list = Array.isArray(sources) ? sources : [];
  return isAiHotEnabled(lang) ? list.slice() : list.filter((source) => !isAihotSource(source));
}

/**
 * Hot-topic list for the given language.
 * Chinese keeps the AIHOT ranked board; English falls back to the original
 * Hacker News topics (data/topics.json `hnItems`), i.e. the pre-integration
 * English data source, so no AIHOT content can leak into the English edition.
 */
export function topicsForLang(topics, lang) {
  const bundle = topics && typeof topics === 'object' ? topics : {};
  if (isAiHotEnabled(lang)) {
    return Array.isArray(bundle.items) ? bundle.items.slice() : [];
  }
  if (Array.isArray(bundle.hnItems) && bundle.hnItems.length) {
    return bundle.hnItems.slice();
  }
  return Array.isArray(bundle.items) ? bundle.items.filter((item) => !item.hot).slice() : [];
}
