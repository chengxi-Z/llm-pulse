/**
 * AI Pulse — site-wide AI assistant (floating launcher + drawer chat).
 *
 * Design:
 *  - Only the #assistant-root mount point is required; every other node is created here,
 *    so no page structure is assumed;
 *  - BYOK: baseURL / model / apiKey live in localStorage; keys are only sent to the
 *    OpenAI-compatible endpoint the user configures;
 *  - No key or a failed request -> local offline answers (assistant-core.localAnswer),
 *    so the assistant is always available;
 *  - Streaming: fetch + ReadableStream + createSSEParser, rendering Markdown-lite per
 *    chunk (XSS-safe);
 *  - Accessibility: role=dialog, focus management, Esc to close, aria-live, keyboard
 *    support, prefers-reduced-motion.
 */

import {
  CONFIG_STORAGE_KEY,
  DEFAULT_CONFIG,
  buildBrief,
  buildChatPayload,
  buildContext,
  chatCompletionsUrl,
  classifyError,
  composeMessages,
  createSSEParser,
  escapeHtml as esc,
  localAnswer,
  markdownToPlain,
  normalizeConfig,
  safeMarkdown,
} from './assistant-core.js';
import { getLang, onLangChange, t } from './i18n.js';

const SITE_URL = 'https://chengxi-z.github.io/llm-pulse/';
const siteName = () => (getLang() === 'en' ? 'AI Pulse · Z Cloud' : 'AI Pulse · 照胆云');
/**
 * Escape dictionary values before interpolating them into innerHTML templates.
 * Dictionary content is controlled, but defense in depth keeps HTML structure
 * safe even if a translation accidentally contains markup.
 */
const et = (key, vars) => esc(t(key, vars));
const quickQuestions = () => [
  t('assistant.quick.q1'),
  t('assistant.quick.q2'),
  t('assistant.quick.q3'),
  t('assistant.quick.q4'),
  t('assistant.quick.q5'),
  t('assistant.quick.q6'),
];
const lang = () => getLang();
const REQUEST_TIMEOUT_MS = 90_000;
const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
/** Max length of a `?ask=` deep-link prefill; control characters are stripped. */
const ASK_PREFILL_MAX = 500;

/** Sanitize a `?ask=` deep-link value before putting it in the composer. */
function sanitizeAskPrefill(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, ASK_PREFILL_MAX);
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ **/

const state = {
  mounted: false,
  open: false,
  settingsOpen: false,
  contextOpen: false,
  busy: false,
  abort: null,
  config: loadStoredConfig(),
  data: null,
  dataStatus: 'idle', // idle | loading | ready | error
  messages: [], // {role, content, mode, stopped, brief}
  dataPromise: null,
  lastFocus: null,
  toastTimer: 0,
  uid: 0,
};

function loadStoredConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const { config } = normalizeConfig(parsed || {});
    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function persistConfig(config) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function getAssistantState() {
  return {
    open: state.open,
    settingsOpen: state.settingsOpen,
    busy: state.busy,
    mode: state.config.apiKey ? 'online' : 'offline',
    dataStatus: state.dataStatus,
    messageCount: state.messages.length,
    messages: state.messages.map((m) => ({ role: m.role, content: m.content, mode: m.mode })),
    config: { baseUrl: state.config.baseUrl, model: state.config.model, hasKey: !!state.config.apiKey },
  };
}

/* ------------------------------------------------------------------ *
 * Site data loading (prefer data.js -> fall back to fetching candidate paths)
 * ------------------------------------------------------------------ **/

async function fetchCandidateData() {
  const bases = ['./data', '../data', 'data', '../../data'];
  for (const base of bases) {
    for (const root of [base, `/${base.replace(/^\.?\//, '')}`]) {
      try {
        const url = new URL(`${root}/meta.json`, document.baseURI).href;
        const probe = await fetch(url, { cache: 'no-cache' });
        if (!probe.ok) continue;
        const names = ['meta', 'models', 'news', 'rankings', 'resources', 'projects'];
        const settled = await Promise.allSettled(
          names.map(async (name) => {
            const res = name === 'meta' ? probe : await fetch(new URL(`${root}/${name}.json`, document.baseURI).href, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`${name} ${res.status}`);
            return [name, await res.json()];
          })
        );
        const data = {};
        for (const item of settled) if (item.status === 'fulfilled') data[item.value[0]] = item.value[1];
        if (Object.keys(data).length) return data;
      } catch {
        /* Try the next candidate path */
      }
    }
  }
  return null;
}

/** Load and cache site data; returns null on failure (offline answers still degrade gracefully). */
export function loadAssistantData() {
  if (state.data) return Promise.resolve(state.data);
  if (state.dataPromise) return state.dataPromise;
  state.dataStatus = 'loading';
  updateModeBadge();
  state.dataPromise = (async () => {
    try {
      const injected = window.__AIPULSE_DATA__;
      if (injected) {
        state.data = await injected;
        state.dataStatus = 'ready';
        return state.data;
      }
      try {
        const dataModule = await import('./data.js');
        if (typeof dataModule.loadAll === 'function') {
          state.data = await dataModule.loadAll();
          state.dataStatus = 'ready';
          updateModeBadge();
          return state.data;
        }
      } catch {
        /* This page may not have data.js; fetch directly */
      }
      state.data = await fetchCandidateData();
      state.dataStatus = state.data ? 'ready' : 'error';
      updateModeBadge();
      return state.data;
    } catch {
      state.dataStatus = 'error';
      state.data = null;
      updateModeBadge();
      return null;
    }
  })();
  return state.dataPromise;
}

export function setAssistantData(data) {
  state.data = data || null;
  state.dataStatus = data ? 'ready' : 'error';
  state.dataPromise = Promise.resolve(state.data);
  updateModeBadge();
}

/* ------------------------------------------------------------------ *
 * DOM construction
 * ------------------------------------------------------------------ **/

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const SVG_ICON = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm6.5 11l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12l16-7-6 7 6 7-16-7z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M5 15V5a2 2 0 012-2h9" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h8l4 4v14H6z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
};

function icon(name) {
  const span = document.createElement('span');
  span.className = 'as-icon';
  span.innerHTML = SVG_ICON[name] || '';
  return span;
}

function button(attrs = {}, children = []) {
  return el('button', { type: 'button', ...attrs }, children);
}

let dom = null;

function buildDom() {
  const root = document.getElementById('assistant-root') || (() => {
    const node = el('div', { id: 'assistant-root' });
    document.body.append(node);
    return node;
  })();
  root.setAttribute('data-mounted', 'true');
  root.innerHTML = '';

  const launch = button(
    {
      id: 'assistant-launch',
      class: 'as-launch',
      'aria-label': t('assistant.open'),
      'aria-expanded': 'false',
      'aria-controls': 'assistant-panel',
      title: t('assistant.open'),
    },
    [icon('spark'), el('span', { class: 'as-launch-label', text: t('assistant.title') })]
  );

  const modeBadge = el('span', { class: 'as-mode', 'data-mode': 'offline', text: t('assistant.status.offline') });
  const log = el('div', {
    class: 'as-log',
    id: 'assistant-log',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
    'aria-label': t('assistant.drawer.aria'),
  });

  const settings = el('section', { class: 'as-settings', id: 'assistant-settings', hidden: true, 'aria-label': t('assistant.settings') });
  settings.innerHTML = `
    <div class="as-settings-head">
      <h3>${et('assistant.settings.title')} <span class="as-tag">BYOK</span></h3>
      <p class="as-hint">${et('assistant.settings.hint')}</p>
    </div>
    <label class="as-field"><span>baseURL</span>
      <input id="as-baseurl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://api.deepseek.com/v1" />
    </label>
    <label class="as-field"><span>model</span>
      <input id="as-model" type="text" autocomplete="off" spellcheck="false" list="as-model-list" placeholder="deepseek-chat" />
      <datalist id="as-model-list">
        <option value="deepseek-chat"></option>
        <option value="deepseek-reasoner"></option>
        <option value="deepseek/deepseek-chat"></option>
        <option value="openai/gpt-4o-mini"></option>
        <option value="Qwen/Qwen2.5-7B-Instruct"></option>
      </datalist>
    </label>
    <label class="as-field"><span>apiKey</span>
      <span class="as-key-row">
        <input id="as-apikey" type="password" autocomplete="off" spellcheck="false" placeholder="${et('assistant.settings.keyPlaceholder')}" />
        <button type="button" class="as-ghost" id="as-toggle-key" aria-label="${et('assistant.settings.toggleKey')}">${et('assistant.settings.show')}</button>
      </span>
    </label>
    <p class="as-warn" id="as-config-warn" hidden></p>
    <div class="as-settings-actions">
      <button type="button" class="as-primary" id="as-save-config">${et('assistant.settings.save')}</button>
      <button type="button" class="as-ghost" id="as-clear-key">${et('assistant.settings.clear')}</button>
    </div>
    <p class="as-privacy">${et('assistant.settings.privacy')}</p>
  `;

  const suggestions = el('div', { class: 'as-suggest', id: 'assistant-suggestions', 'aria-label': t('assistant.quick.title') });
  for (const q of quickQuestions()) {
    suggestions.append(button({ class: 'as-chip', 'data-quick': q, text: q }));
  }

  const textarea = el('textarea', {
    class: 'as-input',
    id: 'as-input',
    rows: '2',
    placeholder: t('assistant.input.placeholder'),
    title: t('assistant.input.hint'),
    'aria-label': t('assistant.input.aria'),
    maxlength: '2000',
  });
  const sendBtn = button({ class: 'as-send', id: 'as-send', 'aria-label': t('assistant.send') }, [icon('send'), el('span', { text: t('assistant.sendShort') })]);
  const stopBtn = button({ class: 'as-stop', id: 'as-stop', 'aria-label': t('assistant.stop'), hidden: true, text: t('assistant.stopShort') });
  const composer = el('form', { class: 'as-composer', id: 'assistant-composer' }, [textarea, sendBtn, stopBtn]);

  const contextPanel = el('section', { class: 'as-context-panel', id: 'as-context-panel', hidden: true, 'aria-label': t('assistant.context.injected') });
  contextPanel.innerHTML = `
    <div class="as-context-head"><h3>${et('assistant.context.title')}</h3><span class="as-hint" id="as-context-size"></span></div>
    <pre class="as-context-pre" id="as-context-pre"></pre>
    <div class="as-context-actions"><button type="button" class="as-ghost" id="as-copy-context">${et('assistant.context.copy')}</button><button type="button" class="as-ghost" id="as-close-context">${et('assistant.context.collapse')}</button></div>
  `;

  const panel = el('div', {
    class: 'as-panel',
    id: 'assistant-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'assistant-title',
    hidden: true,
  }, [
    el('header', { class: 'as-head' }, [
      el('div', { class: 'as-title-wrap' }, [
        el('span', { class: 'as-mark', 'aria-hidden': 'true', html: SVG_ICON.spark }),
        el('h2', { id: 'assistant-title', text: t('assistant.title') }),
        modeBadge,
      ]),
      el('div', { class: 'as-actions' }, [
        button({ class: 'as-icon-btn', 'data-action': 'brief', 'aria-label': t('assistant.brief.generate'), title: t('assistant.brief.short') }, [icon('doc'), el('span', { class: 'as-icon-label', text: t('assistant.brief.badge') })]),
        button({ class: 'as-icon-btn', 'data-action': 'settings', 'aria-label': t('assistant.settings'), title: t('assistant.settingsShort'), 'aria-expanded': 'false' }, [icon('gear')]),
        button({ class: 'as-icon-btn', 'data-action': 'clear', 'aria-label': t('assistant.clear'), title: t('assistant.clearShort') }, [icon('trash')]),
        button({ class: 'as-icon-btn', 'data-action': 'close', 'aria-label': t('assistant.close'), title: t('assistant.closeShort') }, [icon('close')]),
      ]),
    ]),
    settings,
    log,
    suggestions,
    contextPanel,
    composer,
    el('footer', { class: 'as-foot' }, [
      button({ class: 'as-link-btn', 'data-action': 'context', text: t('assistant.viewContext') }),
      el('span', { class: 'as-foot-sep', 'aria-hidden': 'true', text: '·' }),
      el('span', { class: 'as-privacy', text: t('assistant.privacyBadge') }),
    ]),
    el('div', { class: 'as-toast', id: 'as-toast', role: 'status', 'aria-live': 'polite' }),
  ]);

  root.append(launch, panel);
  dom = { root, launch, panel, log, modeBadge, settings, suggestions, textarea, sendBtn, stopBtn, composer, contextPanel, toast: panel.querySelector('#as-toast') };

  launch.addEventListener('click', () => (state.open ? closeAssistant() : openAssistant()));
  panel.addEventListener('click', onPanelClick);
  stopBtn.addEventListener('click', () => {
    if (state.abort) {
      try {
        state.abort.abort();
      } catch {
        /* ignore */
      }
    }
  });
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    sendCurrentInput();
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendCurrentInput();
    }
  });
  settings.addEventListener('click', onSettingsClick);
  contextPanel.addEventListener('click', onContextClick);
  document.removeEventListener('keydown', onGlobalKeydown);
  document.addEventListener('keydown', onGlobalKeydown);
  if (state.open) {
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    root.classList.add('as-open');
    document.body.classList.add('as-body-open');
  }
  renderWelcome();
}

/**
 * Rebuild the assistant chrome in the current language. Conversation content
 * and BYOK settings are preserved (state lives outside the DOM).
 */
function relocalize() {
  if (!IS_BROWSER || !state.mounted) return;
  const wasSettingsOpen = state.settingsOpen;
  const wasContextOpen = state.contextOpen;
  buildDom();
  renderMessages();
  updateModeBadge();
  updateBusyUi();
  if (wasSettingsOpen) toggleSettings(true);
  if (wasContextOpen) toggleContext(true);
}

/* ------------------------------------------------------------------ *
 * Open / close / focus management
 * ------------------------------------------------------------------ **/

export function openAssistant(prefill = '') {
  if (!state.mounted) mountAssistant();
  if (!dom) return;
  if (state.open) {
    if (prefill) setInput(prefill);
    return;
  }
  state.lastFocus = document.activeElement;
  state.open = true;
  dom.panel.hidden = false;
  dom.launch.setAttribute('aria-expanded', 'true');
  dom.root.classList.add('as-open');
  loadAssistantData();
  renderMessages();
  if (prefill) setInput(prefill);
  requestAnimationFrame(() => {
    if (prefill) dom.textarea.focus();
    else dom.textarea.focus();
  });
  document.body.classList.add('as-body-open');
}

export function closeAssistant({ restoreFocus = true } = {}) {
  if (!state.open) return;
  if (state.abort) {
    try {
      state.abort.abort();
    } catch {
      /* noop */
    }
    state.abort = null;
    state.busy = false;
    updateBusyUi();
  }
  state.open = false;
  state.settingsOpen = false;
  state.contextOpen = false;
  if (dom) {
    dom.panel.hidden = true;
    dom.launch.setAttribute('aria-expanded', 'false');
    dom.root.classList.remove('as-open');
    dom.settings.hidden = true;
    dom.contextPanel.hidden = true;
  }
  document.body.classList.remove('as-body-open');
  const target = state.lastFocus && document.contains(state.lastFocus) ? state.lastFocus : dom && dom.launch;
  if (restoreFocus && target && typeof target.focus === 'function') target.focus();
}

function onGlobalKeydown(event) {
  if (!state.open) {
    const target = event.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openAssistant();
    }
    return;
  }
  if (event.key === 'Escape') {
    event.stopPropagation();
    if (state.settingsOpen) toggleSettings(false);
    else if (state.contextOpen) toggleContext(false);
    else closeAssistant();
    return;
  }
  if (event.key === 'Tab' && dom) {
    const focusables = [...dom.panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
      (node) => node.offsetParent !== null || node === document.activeElement
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function onPanelClick(event) {
  const actionBtn = event.target.closest('[data-action]');
  if (actionBtn && dom.panel.contains(actionBtn)) {
    const action = actionBtn.dataset.action;
    if (action === 'close') closeAssistant();
    else if (action === 'settings') toggleSettings();
    else if (action === 'clear') clearConversation();
    else if (action === 'brief') askAssistant(t('assistant.quick.q3'));
    else if (action === 'context') toggleContext();
    else if (action === 'settings') toggleSettings(true);
    else if (action === 'retry') retryLast();
    else if (action === 'offline') offlineFallbackForLast();
    else if (action === 'copy') copyMessage(Number(actionBtn.dataset.index));
    else if (action === 'copy-plain') copyMessage(Number(actionBtn.dataset.index), { plain: true });
    return;
  }
  const quick = event.target.closest('[data-quick]');
  if (quick) {
    askAssistant(quick.dataset.quick);
    return;
  }
  const copyBtn = event.target.closest('[data-copy-index]');
  if (copyBtn) copyMessage(Number(copyBtn.dataset.copyIndex));
}

/* ------------------------------------------------------------------ *
 * Settings panel
 * ------------------------------------------------------------------ **/

function toggleSettings(force) {
  if (!dom) return;
  state.settingsOpen = typeof force === 'boolean' ? force : !state.settingsOpen;
  dom.settings.hidden = !state.settingsOpen;
  const gear = dom.panel.querySelector('[data-action="settings"]');
  if (gear) gear.setAttribute('aria-expanded', String(state.settingsOpen));
  if (state.settingsOpen) {
    dom.panel.querySelector('#as-baseurl').value = state.config.baseUrl;
    dom.panel.querySelector('#as-model').value = state.config.model;
    dom.panel.querySelector('#as-apikey').value = state.config.apiKey;
    const warn = dom.panel.querySelector('#as-config-warn');
    if (warn) warn.hidden = true;
    requestAnimationFrame(() => dom.panel.querySelector('#as-baseurl').focus());
  }
}

function onSettingsClick(event) {
  const target = event.target;
  if (target.closest('#as-save-config')) {
    const raw = {
      baseUrl: dom.panel.querySelector('#as-baseurl').value,
      model: dom.panel.querySelector('#as-model').value,
      apiKey: dom.panel.querySelector('#as-apikey').value,
    };
    const { config, warnings } = normalizeConfig(raw, { lang: lang() });
    state.config = config;
    const saved = persistConfig(config);
    if (warnings.length || !saved) {
      const warn = dom.panel.querySelector('#as-config-warn');
      if (warn) {
        warn.hidden = false;
        warn.textContent = [...warnings, ...(saved ? [] : [t('assistant.settings.storageBlocked')])].join('; ');
      }
    }
    updateModeBadge();
    toggleSettings(false);
    toast(config.apiKey ? t('assistant.settings.saved', { model: config.model }) : t('assistant.settings.savedOffline'));
    dom.textarea.focus();
    return;
  }
  if (target.closest('#as-clear-key')) {
    state.config = { ...state.config, apiKey: '' };
    persistConfig(state.config);
    dom.panel.querySelector('#as-apikey').value = '';
    updateModeBadge();
    toast(t('assistant.settings.cleared'));
    return;
  }
  if (target.closest('#as-toggle-key')) {
    const input = dom.panel.querySelector('#as-apikey');
    input.type = input.type === 'password' ? 'text' : 'password';
    target.closest('#as-toggle-key').textContent =
      input.type === 'password' ? t('assistant.settings.show') : t('assistant.settings.hide');
  }
}

/* ------------------------------------------------------------------ *
 * Context preview
 * ------------------------------------------------------------------ **/

function toggleContext(force) {
  if (!dom) return;
  state.contextOpen = typeof force === 'boolean' ? force : !state.contextOpen;
  dom.contextPanel.hidden = !state.contextOpen;
  if (state.contextOpen) {
    const context = buildContext(state.data, { lang: lang() });
    dom.panel.querySelector('#as-context-pre').textContent = context;
    dom.panel.querySelector('#as-context-size').textContent = t('assistant.context.size', {
      size: new TextEncoder().encode(context).length,
    });
    requestAnimationFrame(() => dom.panel.querySelector('#as-copy-context').focus());
  }
}

function onContextClick(event) {
  if (event.target.closest('#as-close-context')) {
    toggleContext(false);
    dom.textarea.focus();
  } else if (event.target.closest('#as-copy-context')) {
    copyText(dom.panel.querySelector('#as-context-pre').textContent, t('assistant.context.copied'));
  }
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ **/

function scrollLogToBottom() {
  if (!dom) return;
  requestAnimationFrame(() => {
    dom.log.scrollTop = dom.log.scrollHeight;
  });
}

function renderWelcome() {
  if (!dom) return;
  renderMessages();
}

function welcomeNode() {
  const wrap = el('div', { class: 'as-welcome' });
  wrap.innerHTML = `
    <p class="as-welcome-kicker">${et('assistant.welcome.kicker')}</p>
    <h3>${et('assistant.welcome.title')}</h3>
    <p class="as-welcome-desc">${et('assistant.welcome.desc')}</p>
  `;
  return wrap;
}

function messageNode(message, index) {
  const isUser = message.role === 'user';
  const wrap = el('article', { class: `as-msg ${isUser ? 'as-user' : 'as-bot'}${message.error ? ' as-error-msg' : ''}`, 'data-index': String(index) });
  const bubble = el('div', { class: 'as-bubble' });
  if (isUser) {
    bubble.textContent = message.content;
  } else {
    bubble.innerHTML = safeMarkdown(message.content);
    if (message.streaming) bubble.classList.add('as-streaming');
  }
  wrap.append(bubble);
  if (!isUser && !message.streaming) {
    const meta = el('div', { class: 'as-msg-meta' });
    if (message.mode === 'offline') meta.append(el('span', { class: 'as-badge', text: t('assistant.status.local') }));
    else if (message.mode === 'online') meta.append(el('span', { class: 'as-badge as-badge-online', text: t('assistant.status.online') }));
    else if (message.mode === 'error') meta.append(el('span', { class: 'as-badge as-badge-error', text: t('assistant.status.error') }));
    if (message.stopped) meta.append(el('span', { class: 'as-badge', text: t('assistant.status.stopped') }));
    meta.append(
      button(
        { class: 'as-mini-btn', 'data-action': 'copy', 'data-index': String(index), 'aria-label': t('assistant.copy.answer'), title: t('assistant.copy.answerShort') },
        [icon('copy'), el('span', { text: t('assistant.copy.answerShort') })]
      )
    );
    if (message.brief) {
      meta.append(
        button({ class: 'as-mini-btn', 'data-action': 'copy-plain', 'data-index': String(index), title: t('assistant.copy.plain') }, [
          el('span', { text: t('assistant.copy.plainShort') }),
        ])
      );
    }
    wrap.append(meta);
    if (message.actions && message.actions.length) {
      const actions = el('div', { class: 'as-msg-actions' });
      for (const action of message.actions) {
        actions.append(
          button({ class: 'as-chip as-chip-action', 'data-action': action.action, text: action.label })
        );
      }
      wrap.append(actions);
    }
  }
  return wrap;
}

function renderMessages() {
  if (!dom) return;
  dom.log.innerHTML = '';
  if (!state.messages.length) {
    dom.log.append(welcomeNode());
  } else {
    state.messages.forEach((message, index) => dom.log.append(messageNode(message, index)));
  }
  scrollLogToBottom();
}

function appendMessage(message) {
  state.messages.push(message);
  if (!dom) return message;
  if (dom.log.querySelector('.as-welcome')) dom.log.innerHTML = '';
  dom.log.append(messageNode(message, state.messages.length - 1));
  scrollLogToBottom();
  return message;
}

function updateLiveMessage() {
  if (!dom) return;
  const last = state.messages[state.messages.length - 1];
  if (!last || last.role !== 'assistant') return;
  const node = dom.log.querySelector(`.as-msg[data-index="${state.messages.length - 1}"] .as-bubble`);
  if (node) node.innerHTML = safeMarkdown(last.content);
  scrollLogToBottom();
}

function updateModeBadge() {
  if (!dom) return;
  const online = !!state.config.apiKey;
  dom.modeBadge.textContent = online ? t('assistant.status.online') : t('assistant.status.offline');
  dom.modeBadge.dataset.mode = online ? 'online' : 'offline';
  dom.modeBadge.title = online
    ? t('assistant.onlineModel', { model: state.config.model, baseUrl: state.config.baseUrl })
    : state.dataStatus === 'loading'
      ? t('assistant.searching')
      : t('assistant.searchingLocal');
}

function updateBusyUi() {
  if (!dom) return;
  dom.sendBtn.disabled = state.busy;
  dom.stopBtn.hidden = !state.busy;
  dom.sendBtn.hidden = state.busy;
  dom.textarea.setAttribute('aria-busy', String(state.busy));
}

function setInput(value) {
  if (!dom) return;
  dom.textarea.value = value;
  dom.textarea.focus();
  const end = dom.textarea.value.length;
  dom.textarea.setSelectionRange(end, end);
}

function toast(message) {
  if (!dom || !dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), 2400);
}

/* ------------------------------------------------------------------ *
 * Main conversation flow
 * ------------------------------------------------------------------ **/

async function sendCurrentInput() {
  if (!dom) return;
  const text = dom.textarea.value.trim();
  if (!text) {
    dom.textarea.focus();
    return;
  }
  if (state.busy) return;
  dom.textarea.value = '';
  await askAssistant(text);
}

/**
 * Send one message (called by the UI / tests).
 * With a key -> streaming online answer; without -> offline localAnswer.
 */
export async function askAssistant(text, opts = {}) {
  const question = String(text ?? '').trim();
  if (!question) return null;
  if (!state.mounted) mountAssistant();
  if (!state.open) openAssistant();
  await loadAssistantData();
  if (state.busy) return null;

  appendMessage({ role: 'user', content: question });
  updateBusyUi();

  const mode = opts.forceOffline || !state.config.apiKey ? 'offline' : 'online';
  state.busy = true;
  updateBusyUi();

  let answer;
  try {
    if (mode === 'online') answer = await runOnline(question);
    else answer = await runOffline(question);
  } catch (error) {
    answer = errorMessageFor(error);
  } finally {
    state.busy = false;
    state.abort = null;
    updateBusyUi();
  }
  if (answer && !answer.appended) appendMessage(answer);
  return answer;
}

async function runOffline(question) {
  // Small delay so the "searching locally" state is perceptible without blocking the UI.
  await new Promise((resolve) => setTimeout(resolve, 80));
  const content = localAnswer(question, state.data, { lang: lang() });
  const brief = /简报|周报|本周|brief|weekly/i.test(question) && content.startsWith('# AI Pulse');
  return { role: 'assistant', content, mode: 'offline', brief };
}

async function runOnline(question) {
  if (!dom) mountAssistant();
  const { baseUrl, model, apiKey } = state.config;
  const context = buildContext(state.data, { lang: lang() });
  const history = state.messages.slice(0, -1).filter((m) => !m.error && !m.brief && !m.actions);
  const messages = composeMessages(question, context, history, {
    siteUrl: SITE_URL,
    siteName: siteName(),
    lang: lang(),
  });
  const payload = buildChatPayload({ model, messages, stream: true, maxTokens: 1200 });
  const controller = new AbortController();
  state.abort = controller;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(chatCompletionsUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
  if (!response.ok) {
    clearTimeout(timer);
    let bodyText = '';
    try {
      bodyText = (await response.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    const error = new Error(`HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`);
    error.status = response.status;
    error.name = 'HttpError';
    throw error;
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    clearTimeout(timer);
    const parsed = createSSEParser();
    const result = parsed.push(text);
    const tail = parsed.end();
    const content = [...result.deltas, ...tail.deltas].join('') || text;
    if (!content.trim()) throw new Error(t('assistant.emptyReply'));
    return { role: 'assistant', content, mode: 'online' };
  }

  const live = appendMessage({ role: 'assistant', content: '', mode: 'online', streaming: true });
  const reader = response.body.getReader();
  const parser = createSSEParser();
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const result = parser.push(value);
      if (result.deltas.length) {
        text += result.deltas.join('');
        live.content = text;
        updateLiveMessage();
      }
      if (result.done) break;
    }
    const tail = parser.end();
    if (tail.deltas.length) {
      text += tail.deltas.join('');
      live.content = text;
      updateLiveMessage();
    }
  } catch (error) {
    live.streaming = false;
    if (error && error.name === 'AbortError') {
      clearTimeout(timer);
      if (timedOut) {
        throw Object.assign(new Error(t('assistant.timeout', { seconds: REQUEST_TIMEOUT_MS / 1000 })), {
          name: 'TimeoutError',
        });
      }
      live.stopped = true;
      if (!text) live.content = `_${t('assistant.stoppedMarkdown')}_`;
      renderMessages();
      live.appended = true;
      return live;
    }
    clearTimeout(timer);
    throw error;
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
  live.streaming = false;
  if (!text.trim()) {
    state.messages.pop();
    throw new Error(t('assistant.emptyContent'));
  }
  live.content = text;
  renderMessages();
  live.appended = true;
  return live;
}

function errorMessageFor(error) {
  const info = classifyError(
    { status: error && error.status, name: error && error.name, message: error && error.message },
    { lang: lang() }
  );
  const rawMessage = String((error && error.message) || error || t('assistant.unknownError')).slice(0, 180);
  const content = [
    `**${info.title}**`,
    '',
    info.message,
    '',
    '---',
    t('assistant.techInfo', { message: rawMessage }),
  ].join('\n');
  return {
    role: 'assistant',
    content,
    mode: 'error',
    error: true,
    actions: [
      { action: 'retry', label: t('assistant.retry') },
      { action: 'offline', label: t('assistant.useOffline') },
      { action: 'settings', label: t('assistant.checkSettings') },
    ],
  };
}

function retryLast() {
  const lastUser = [...state.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  state.messages = state.messages.filter((m) => !m.error);
  renderMessages();
  askAssistant(lastUser.content);
}

function offlineFallbackForLast() {
  const lastUser = [...state.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  state.messages = state.messages.filter((m) => !m.error);
  renderMessages();
  askAssistant(lastUser.content, { forceOffline: true });
}

function clearConversation() {
  if (state.abort) {
    try {
      state.abort.abort();
    } catch {
      /* ignore */
    }
    state.abort = null;
  }
  state.busy = false;
  updateBusyUi();
  state.messages = [];
  renderMessages();
  toast(t('assistant.conversationCleared'));
  if (dom) dom.textarea.focus();
}

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ **/

async function copyText(text, successMessage = t('ui.copied')) {
  const content = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(content);
    } else {
      const area = el('textarea', { style: 'position:fixed;left:-9999px;top:0' });
      area.value = content;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast(successMessage);
    return true;
  } catch {
    toast(t('ui.copyFailed'));
    return false;
  }
}

function copyMessage(index, { plain = false } = {}) {
  const message = state.messages[index];
  if (!message) return;
  copyText(
    plain ? markdownToPlain(message.content, { lang: lang() }) : message.content,
    plain ? t('assistant.copy.textCopied') : t('assistant.copy.markdownCopied')
  );
}

/* ------------------------------------------------------------------ *
 * Initialization
 * ------------------------------------------------------------------ **/

export function mountAssistant() {
  if (!IS_BROWSER || state.mounted) {
    if (state.mounted && dom) updateModeBadge();
    return;
  }
  buildDom();
  state.mounted = true;
  loadAssistantData();
  updateModeBadge();
  updateBusyUi();
  window.__AIPULSE_ASSISTANT__ = {
    open: openAssistant,
    close: closeAssistant,
    ask: askAssistant,
    getState: getAssistantState,
    setData: setAssistantData,
    clear: clearConversation,
    showBrief: () => askAssistant(t('assistant.quick.q3')),
    relocalize,
  };
  window.dispatchEvent(new CustomEvent('assistant:ready'));
}

if (IS_BROWSER) {
  onLangChange(() => {
    if (state.mounted) relocalize();
  });
  const boot = () => {
    if (!state.mounted && document.body) mountAssistant();
    // Deep links: ?assistant=open opens the drawer; ?ask=<question> only pre-fills the
    // composer - the user must press Send explicitly, so a crafted link can never trigger
    // a billable request against the visitor's BYOK key.
    try {
      const params = new URLSearchParams(window.location.search);
      const ask = sanitizeAskPrefill(params.get('ask'));
      if (params.has('assistant') || ask) {
        openAssistant();
        if (ask) setInput(ask);
      }
    } catch {
      /* Ignore URL parsing failures */
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
