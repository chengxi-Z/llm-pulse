/* =============================================================================
   AI Pulse — app.js
   Global interactions: i18n bootstrap / theme system / mobile navigation /
   language toggle / scroll reveal / error reporting / back-to-top / per-page
   rendering bootstrap.

   Dependencies: data.js (data loading), render.js (page renderers), i18n.js.
   ============================================================================= */

import { loadAll } from './data.js';
import {
  initHome,
  initNews,
  initRankings,
  initModels,
  initResources,
  initProjects,
  initAbout,
  refreshPage,
  intlDateTime,
} from './render.js';
import { initI18n, t, getLang, setLang, onLangChange, applyDom } from './i18n.js';
import { initSkills, refreshSkills } from './skills.js';
import { initDashboard, refreshDashboard } from './dashboard.js';

const PAGE_INITS = {
  index: initHome,
  news: initNews,
  rankings: initRankings,
  models: initModels,
  resources: initResources,
  projects: initProjects,
  skills: initSkills,
  about: initAbout,
};

let currentPage = '';
let currentData = null;

/* ---------- Error collection sync ----------
   The inline head script initializes window.__siteErrors before any resource
   loads, so runtime failures can be surfaced in body[data-console-errors]. */

function errorBucket() {
  return window.__siteErrors || { js: [], resource: [], runtime: [] };
}

function syncErrors() {
  const errors = errorBucket();
  const groups = [
    ['consoleErrors', [...errors.js, ...errors.runtime]],
    ['resourceErrors', errors.resource],
  ];
  groups.forEach(([datasetKey, list]) => {
    const unique = [...new Set(list.filter(Boolean))];
    if (unique.length) {
      document.body.dataset[datasetKey] = unique.join(' | ');
    } else {
      delete document.body.dataset[datasetKey];
    }
  });
}

/* ---------- Theme system ----------
   Theme choices: ivory | noir | jade | rose | graphite | auto.
   `data-theme` holds a resolved concrete theme, `data-theme-choice` the selected
   option (including "auto"), `data-theme-source` the origin: manual|system|url. */

const THEMES = ['ivory', 'noir', 'jade', 'rose', 'graphite'];
const THEME_CHOICES = [...THEMES, 'auto'];
const THEME_STORAGE_KEY = 'aipulse.theme';
const THEME_COLORS = {
  ivory: '#F6F1E9',
  noir: '#0E0D0B',
  jade: '#EEF2EC',
  rose: '#F6EDEA',
  graphite: '#F3F2EF',
};
const LEGACY_THEME_MAP = { dark: 'noir', light: 'ivory' };

function prefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (error) {
    return false;
  }
}

function resolveTheme(choice) {
  if (choice === 'auto') return prefersDark() ? 'noir' : 'ivory';
  return THEMES.includes(choice) ? choice : 'ivory';
}

function currentChoice() {
  return document.documentElement.getAttribute('data-theme-choice') || 'auto';
}

function syncThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  let color = '';
  try {
    color = window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  } catch (error) {
    color = '';
  }
  meta.setAttribute('content', color || THEME_COLORS[theme] || THEME_COLORS.ivory);
}

function syncThemeOptions(choice) {
  document.querySelectorAll('[data-theme-value]').forEach((option) => {
    const active = option.getAttribute('data-theme-value') === choice;
    option.setAttribute('aria-checked', active ? 'true' : 'false');
    option.classList.toggle('is-active', active);
    option.tabIndex = active ? 0 : -1;
  });
}

function applyThemeChoice(choice, { source = 'manual', persist = false } = {}) {
  const safeChoice = THEME_CHOICES.includes(choice) ? choice : 'auto';
  const theme = resolveTheme(safeChoice);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-choice', safeChoice);
  root.setAttribute('data-theme-source', source);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, safeChoice);
    } catch (error) {
      /* Storage may be unavailable; ignore. */
    }
  }
  syncThemeColor(theme);
  syncThemeOptions(safeChoice);
  document.dispatchEvent(new CustomEvent('aipulse:themechange', { detail: { choice: safeChoice, theme, source } }));
}

function clearThemeParamFromUrl() {
  try {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('theme')) return;
    url.searchParams.delete('theme');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    /* Ignore environments without the History API. */
  }
}

function setupThemePicker() {
  const picker = document.querySelector('[data-theme-picker]');
  const menu = document.querySelector('[data-theme-menu]');
  if (!picker || !menu) return;
  const wrap = picker.closest('.theme-picker-wrap') || picker.parentElement;
  const options = Array.from(menu.querySelectorAll('[data-theme-value]'));
  if (!options.length) return;

  const isOpen = () => !menu.hidden;

  const focusOption = (index) => {
    const target = options[Math.max(0, Math.min(options.length - 1, index))];
    if (target) target.focus();
  };

  const open = (focusIndex) => {
    if (isOpen()) return;
    menu.hidden = false;
    if (wrap) wrap.classList.add('is-open');
    picker.setAttribute('aria-expanded', 'true');
    syncThemeOptions(currentChoice());
    const checkedIndex = options.findIndex((option) => option.getAttribute('aria-checked') === 'true');
    focusOption(typeof focusIndex === 'number' ? focusIndex : Math.max(0, checkedIndex));
  };

  const close = ({ focusPicker = false } = {}) => {
    if (!isOpen()) return;
    menu.hidden = true;
    if (wrap) wrap.classList.remove('is-open');
    picker.setAttribute('aria-expanded', 'false');
    if (focusPicker) picker.focus();
  };

  const select = (choice) => {
    if (!THEME_CHOICES.includes(choice)) return;
    applyThemeChoice(choice, { source: choice === 'auto' ? 'system' : 'manual', persist: true });
    clearThemeParamFromUrl();
    close({ focusPicker: true });
  };

  picker.addEventListener('click', () => {
    if (isOpen()) close();
    else open();
  });

  picker.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (!isOpen()) {
        event.preventDefault();
        open(0);
      }
    }
  });

  menu.addEventListener('click', (event) => {
    const option = event.target.closest('[data-theme-value]');
    if (option) select(option.getAttribute('data-theme-value'));
  });

  menu.addEventListener('keydown', (event) => {
    const activeIndex = options.indexOf(document.activeElement);
    const move = (delta) => {
      event.preventDefault();
      focusOption((activeIndex + delta + options.length) % options.length);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(options.length - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = document.activeElement.closest('[data-theme-value]');
        if (option) select(option.getAttribute('data-theme-value'));
        break;
      }
      case 'Escape':
        event.preventDefault();
        close({ focusPicker: true });
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  });

  document.addEventListener('click', (event) => {
    if (!isOpen()) return;
    if (menu.contains(event.target)) return;
    if (picker === event.target || picker.contains(event.target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close({ focusPicker: true });
    }
  });

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  if (media.addEventListener) {
    media.addEventListener('change', () => {
      if (currentChoice() === 'auto') applyThemeChoice('auto', { source: 'system' });
    });
  }

  syncThemeOptions(currentChoice());
  syncThemeColor(resolveTheme(currentChoice()));
}

function setupTheme() {
  const root = document.documentElement;
  let choice = root.getAttribute('data-theme-choice');
  let source = root.getAttribute('data-theme-source');

  // Fallback resolution when the inline bootstrap did not run.
  if (!choice) {
    let forced = null;
    let stored = null;
    try {
      forced = new URLSearchParams(window.location.search).get('theme');
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
    forced = LEGACY_THEME_MAP[forced] || forced;
    if (forced && THEME_CHOICES.includes(forced)) {
      choice = forced;
      source = 'url';
    } else if (stored && THEME_CHOICES.includes(stored)) {
      choice = stored;
      source = stored === 'auto' ? 'system' : 'manual';
    } else {
      choice = 'auto';
      source = 'system';
    }
  }

  applyThemeChoice(choice, { source: source || 'system', persist: false });
  setupThemePicker();
}

/* ---------- Language toggle ---------- */

function syncLanguageToggle() {
  const toggle = document.querySelector('[data-lang-toggle]');
  if (!toggle) return;
  const current = getLang();
  toggle.querySelectorAll('[data-lang-code]').forEach((element) => {
    element.classList.toggle('is-active', element.getAttribute('data-lang-code') === current);
  });
  const label = t('ui.lang.toggle');
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
}

function setupLanguageToggle() {
  const toggle = document.querySelector('[data-lang-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      setLang(getLang() === 'zh' ? 'en' : 'zh');
    });
  }
  syncLanguageToggle();
}

/* ---------- Back-to-top button ---------- */

function updateToTopLabel() {
  const button = document.querySelector('[data-to-top]');
  if (!button) return;
  const label = t('ui.toTop');
  button.setAttribute('aria-label', label);
  button.title = label;
}

function setupToTop() {
  if (document.querySelector('[data-to-top]')) return;
  const button = document.createElement('button');
  button.className = 'to-top';
  button.type = 'button';
  button.setAttribute('data-to-top', '');
  button.innerHTML =
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(button);

  button.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  let ticking = false;
  const update = () => button.classList.toggle('is-visible', window.scrollY > 600);
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  updateToTopLabel();
}

/* ---------- Mobile navigation ---------- */

function setupNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('#site-nav');
  if (!toggle || !nav) return;

  const isOpen = () => document.body.classList.contains('nav-open');

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', t(open ? 'ui.nav.closeAria' : 'ui.nav.openAria'));
    toggle.title = t(open ? 'ui.nav.closeAria' : 'ui.nav.openAria');
    if (open) {
      const first = nav.querySelector('a');
      if (first) first.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960 && isOpen()) setOpen(false);
  });

  // Keep the toggle label translated when the language changes.
  onLangChange(() => {
    toggle.setAttribute('aria-label', t(isOpen() ? 'ui.nav.closeAria' : 'ui.nav.openAria'));
    toggle.title = t(isOpen() ? 'ui.nav.closeAria' : 'ui.nav.openAria');
  });
}

/* ---------- Forms: search inputs must not submit the whole page ---------- */

function setupForms() {
  document.querySelectorAll('form.filter-bar').forEach((form) => {
    form.addEventListener('submit', (event) => event.preventDefault());
  });
}

/* ---------- Header scroll state ---------- */

function setupHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* ---------- Scroll reveal ---------- */

function setupReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  targets.forEach((el) => observer.observe(el));
}

/* ---------- Footer year / data timestamp / issue number ---------- */

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
}

function setupChrome(data) {
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
  const issue = String(isoWeek(new Date())).padStart(3, '0');
  document.querySelectorAll('[data-issue-no]').forEach((el) => {
    el.textContent = t('ui.issueNo', { n: issue });
  });
  const footerUpdated = document.querySelector('[data-footer-updated]');
  if (footerUpdated) {
    footerUpdated.textContent =
      data && data.meta
        ? t('footer.updatedAt', { time: intlDateTime(data.meta.generatedAt) })
        : t('footer.updated');
  }
}

/* ---------- Global static re-translation after a language switch ---------- */

function refreshStaticChrome() {
  applyDom();
  syncLanguageToggle();
  updateToTopLabel();
  const issue = String(isoWeek(new Date())).padStart(3, '0');
  document.querySelectorAll('[data-issue-no]').forEach((el) => {
    el.textContent = t('ui.issueNo', { n: issue });
  });
  if (currentData) {
    setupChrome(currentData);
    refreshPage(currentPage);
    if (currentPage === 'index') refreshDashboard();
    if (currentPage === 'skills') refreshSkills();
  }
}

/* ---------- Copy-to-clipboard buttons (data-copy-text / data-copy-target) ---------- */

function writeClipboard(text) {
  const value = String(text == null ? '' : text).trim();
  if (!value) return Promise.reject(new Error('empty'));
  if (navigator.clipboard && window.isSecureContext !== false) {
    return navigator.clipboard.writeText(value);
  }
  return new Promise((resolve, reject) => {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      if (document.execCommand('copy')) resolve();
      else reject(new Error('copy failed'));
    } catch (error) {
      reject(error);
    } finally {
      area.remove();
    }
  });
}

function setupCopyButtons() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-text],[data-copy-target]');
    if (!button) return;
    const selector = button.getAttribute('data-copy-target');
    const target = selector ? document.querySelector(selector) : null;
    const text = button.getAttribute('data-copy-text') || (target ? target.textContent : '');
    const key = button.getAttribute('data-copy-label-key') || 'ui.copied';
    const failKey = button.getAttribute('data-copy-fail-key') || 'ui.copyFailed';
    const original = button.textContent;
    const feedback = (label) => {
      button.textContent = label;
      button.disabled = true;
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1600);
    };
    writeClipboard(text)
      .then(() => feedback(t(key)))
      .catch(() => feedback(t(failKey)));
  });
}

/* ---------- Boot ---------- */

async function boot() {
  syncErrors();
  try {
    await initI18n();
  } catch (error) {
    if (window.__siteErrors) {
      window.__siteErrors.runtime.push(`initI18n: ${error && error.message ? error.message : error}`);
    }
  }

  setupTheme();
  setupToTop();
  setupNav();
  setupLanguageToggle();
  setupHeader();
  setupForms();
  setupCopyButtons();
  onLangChange(refreshStaticChrome);

  if (location.protocol === 'file:') {
    const main = document.querySelector('main');
    if (main) {
      const banner = document.createElement('div');
      banner.className = 'container';
      banner.innerHTML = `<div class="data-banner" role="note"><strong>${t(
        'ui.fileProtocol.title'
      )}</strong><span>${t('ui.fileProtocol.desc')}</span></div>`;
      main.insertBefore(banner, main.firstChild);
    }
    document.body.dataset.pageReady = 'true';
    setupReveal();
    return;
  }

  currentPage = document.body.dataset.page || '';
  try {
    currentData = await loadAll();
    window.__AIPULSE_DATA__ = currentData;
  } catch (error) {
    if (window.__siteErrors) {
      window.__siteErrors.runtime.push(`loadAll: ${error && error.message ? error.message : error}`);
    }
    document.querySelectorAll('[data-page-content], #news-list, #new-models-grid').forEach((el) => {
      el.innerHTML = `<div class="empty-state empty-state--error" role="status"><p class="empty-title">${t(
        'ui.dataError.title'
      )}</p><p class="empty-desc">${t('ui.dataError.desc')}</p></div>`;
    });
  }

  document.body.dataset.dataMode = currentData && currentData.meta && currentData.meta._fallback ? 'fallback' : 'live';

  const init = PAGE_INITS[currentPage];
  if (typeof init === 'function' && currentData) {
    try {
      init(currentData);
      if (currentPage === 'index') initDashboard(currentData);
    } catch (error) {
      if (window.__siteErrors) {
        window.__siteErrors.runtime.push(
          `init:${currentPage}: ${error && error.message ? error.message : error}`
        );
      }
    }
  }

  setupChrome(currentData);
  setupReveal();

  window.requestAnimationFrame(() => {
    syncErrors();
    document.body.dataset.pageReady = 'true';
    window.setTimeout(syncErrors, 600);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

document.addEventListener('visibilitychange', syncErrors);
window.addEventListener('load', syncErrors);
