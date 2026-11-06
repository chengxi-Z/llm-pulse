/* =============================================================================
   AI Pulse — i18n.js
   Lightweight ES module i18n engine (no dependencies).

   Contract (v1.1 §3.1):
     initI18n()            resolve language + load dictionaries + apply DOM
     t(key, vars = {})     translate with {placeholder} interpolation
     getLang()             'zh' | 'en'
     setLang(lang)         persist, update <html lang>, apply DOM, notify
     onLangChange(cb)      subscribe, returns unsubscribe
     applyDom(root)        translate data-i18n / data-i18n-attr nodes

   Rules:
   - Top-level code never touches document/localStorage (Node-safe for tests).
   - Missing key falls back to zh dictionary, then to the key itself.
   - URL ?lang= wins over localStorage; user switching writes localStorage.
   ============================================================================= */

const SUPPORTED = ['zh', 'en'];
const DEFAULT_LANG = 'zh';
const STORAGE_KEY = 'aipulse.lang';
const DICT_BASE = 'assets/i18n/';

const dictionaries = new Map();
const listeners = new Set();
let lang = DEFAULT_LANG;
let langSource = 'default';
let ready = null;

const hasDocument = () => typeof document !== 'undefined' && document !== null;
const docRoot = () => (hasDocument() ? document.documentElement : null);

/** Every page's <title> / description / OG copy keys, written as literals so
 *  static i18n checkers can discover them. */
export const PAGE_META = {
  index: { title: 'page.index.title', desc: 'page.index.desc' },
  news: { title: 'page.news.title', desc: 'page.news.desc' },
  rankings: { title: 'page.rankings.title', desc: 'page.rankings.desc' },
  models: { title: 'page.models.title', desc: 'page.models.desc' },
  deepseek: { title: 'page.deepseek.title', desc: 'page.deepseek.desc' },
  resources: { title: 'page.resources.title', desc: 'page.resources.desc' },
  projects: { title: 'page.projects.title', desc: 'page.projects.desc' },
  about: { title: 'page.about.title', desc: 'page.about.desc' },
  skills: { title: 'page.skills.title', desc: 'page.skills.desc' },
  '404': { title: 'page.notFound.title', desc: 'page.notFound.desc' },
};

function readStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  } catch (error) {
    return null;
  }
}

function writeStorage(value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    /* Storage can be unavailable; language still works for this session. */
  }
}

function urlLang() {
  try {
    if (typeof location === 'undefined') return null;
    const value = new URLSearchParams(location.search).get('lang');
    return SUPPORTED.includes(value) ? value : null;
  } catch (error) {
    return null;
  }
}

function resolveInitialLang() {
  const fromUrl = urlLang();
  if (fromUrl) {
    langSource = 'url';
    return fromUrl;
  }
  const stored = readStorage();
  if (SUPPORTED.includes(stored)) {
    langSource = stored === 'en' ? 'manual' : 'default';
    return stored;
  }
  langSource = 'default';
  return DEFAULT_LANG;
}

function dictionaryUrl(code) {
  try {
    const base = hasDocument() ? document.baseURI || location.href : 'http://localhost/';
    return new URL(`${DICT_BASE}${code}.json`, base).href;
  } catch (error) {
    return `${DICT_BASE}${code}.json`;
  }
}

async function loadDictionary(code) {
  if (dictionaries.has(code)) return dictionaries.get(code);
  try {
    const response = await fetch(dictionaryUrl(code), { headers: { accept: 'application/json' }, cache: 'no-cache' });
    if (!response.ok) throw new Error(`dictionary ${code} HTTP ${response.status}`);
    const data = await response.json();
    const dict = data && typeof data === 'object' ? data : {};
    dictionaries.set(code, dict);
    return dict;
  } catch (error) {
    dictionaries.set(code, {});
    return {};
  }
}

/** Interpolate {name} placeholders; unknown placeholders are left untouched. */
function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

export function t(key, vars = {}) {
  if (!key) return '';
  const current = dictionaries.get(lang) || {};
  const fallback = dictionaries.get(DEFAULT_LANG) || {};
  const template = current[key] || fallback[key] || key;
  return interpolate(template, vars);
}

export function getLang() {
  return lang;
}

export function onLangChange(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setDocumentLang() {
  const root = docRoot();
  if (!root) return;
  root.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
  root.setAttribute('data-lang', lang);
}

function applyMeta() {
  if (!hasDocument()) return;
  const page = (document.body && document.body.dataset.page) || '';
  const metaKeys = PAGE_META[page];
  if (!metaKeys) return;
  const title = t(metaKeys.title);
  const description = t(metaKeys.desc);
  if (title && title !== metaKeys.title) document.title = title;
  const pairs = [
    ['meta[name="description"]', description],
    ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description],
    ['meta[name="twitter:title"]', title],
    ['meta[name="twitter:description"]', description],
  ];
  pairs.forEach(([selector, value]) => {
    if (!value || value === selector) return;
    const node = document.querySelector(selector);
    if (node) node.setAttribute('content', value);
  });
}

export function applyDom(root = hasDocument() ? document : null) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    const value = t(key);
    if (value && value !== key) element.textContent = value;
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    const spec = element.getAttribute('data-i18n-attr');
    if (!spec) return;
    spec.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((part) => part && part.trim());
      if (!attr || !key) return;
      const value = t(key);
      if (value && value !== key) element.setAttribute(attr, value);
    });
  });
  setDocumentLang();
  applyMeta();
}

function dispatchLangChange() {
  const detail = { lang, source: langSource };
  if (typeof document !== 'undefined' && document.dispatchEvent) {
    try {
      document.dispatchEvent(new CustomEvent('aipulse:langchange', { detail }));
    } catch (error) {
      /* CustomEvent may be unavailable in non-browser environments. */
    }
  }
  listeners.forEach((callback) => {
    try {
      callback(lang, detail);
    } catch (error) {
      /* A broken listener must not block other listeners. */
    }
  });
}

function clearLangParamFromUrl() {
  try {
    if (typeof window === 'undefined' || !window.history || !window.location) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('lang')) return;
    url.searchParams.delete('lang');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    /* ignore */
  }
}

/**
 * Apply a language. User switching persists to localStorage and strips the
 * ?lang= deep link; URL-driven initialization does not persist.
 */
export async function setLang(nextLang, { persist = true } = {}) {
  const code = SUPPORTED.includes(nextLang) ? nextLang : DEFAULT_LANG;
  lang = code;
  langSource = persist ? 'manual' : langSource;
  if (persist) {
    writeStorage(code);
    clearLangParamFromUrl();
  }
  await loadDictionary(code);
  if (code === 'en') await loadDictionary('zh');
  applyDom();
  dispatchLangChange();
  return code;
}

export async function initI18n() {
  const initial = resolveInitialLang();
  if (ready) {
    // Re-resolve when the page URL / storage changed (e.g. multi-page test
    // harnesses reusing the same module instance).
    if (initial !== lang) {
      lang = initial;
      await loadDictionary('zh');
      await loadDictionary(lang);
      applyDom();
      dispatchLangChange();
    }
    return ready;
  }
  lang = initial;
  setDocumentLang();
  ready = (async () => {
    await loadDictionary('zh');
    await loadDictionary(lang);
    applyDom();
    dispatchLangChange();
    return { lang, source: langSource };
  })();
  return ready;
}

/** Browser bridge for non-module helpers (back-to-top aria label, legacy code). */
function exposeBridge() {
  if (typeof window === 'undefined') return;
  window.__i18n = { t, getLang, setLang, onLangChange, applyDom, initI18n, langSource: () => langSource };
}

if (typeof window !== 'undefined') exposeBridge();
