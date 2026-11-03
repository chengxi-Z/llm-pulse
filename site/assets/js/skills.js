/* =============================================================================
   AI Pulse — skills.js
   Renderer and interactions for the My Skills page: card grid, source/category
   filters, search, usage-guide modal (focus trap, copy, deep links), share
   buttons and the client-side JSON template download. Data comes from
   data/skills.json (schema in DATA-CONTRACT §6.1); UI copy goes through i18n.
   ============================================================================= */

import { escapeHtml as esc, debounce, safeHttpUrl } from './data.js';
import { intlDate, intlDateTime, intlNumber } from './render.js';
import { t, getLang } from './i18n.js';

const SITE_URL = 'https://chengxi-z.github.io/llm-pulse/';
const SKILLS_URL = `${SITE_URL}skills.html`;

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

const SOURCE_ORDER = { mine: 0, official: 1, community: 2 };

const SOURCE_FILTER_KEYS = {
  mine: 'skills.filter.mine',
  official: 'skills.filter.official',
  community: 'skills.filter.community',
};

const state = {
  source: 'all',
  category: 'all',
  q: '',
};

let payload = null;
let items = [];
let bound = false;
let animated = false;
let lastTrigger = null;
let currentSkill = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function pick(item, field) {
  if (!item) return '';
  if (getLang() === 'en') return item[field] || item[`${field}Zh`] || '';
  return item[`${field}Zh`] || item[field] || '';
}

function pickList(item, field) {
  if (!item) return [];
  const primary = getLang() === 'en' ? item[field] : item[`${field}Zh`];
  const fallback = getLang() === 'en' ? item[`${field}Zh`] : item[field];
  if (Array.isArray(primary) && primary.length) return primary;
  return Array.isArray(fallback) ? fallback : [];
}

function categoryLabel(value) {
  const key = SKILL_CATEGORY_KEYS[value];
  return key ? t(key) : value || '';
}

function sourceLabel(value) {
  const key = SKILL_SOURCE_KEYS[value];
  return key ? t(key) : value || '';
}

function skillSourceUrl(item) {
  const direct = safeHttpUrl(item.url);
  if (direct) return direct;
  if (item.repo) return `https://github.com/${String(item.repo).replace(/[^a-zA-Z0-9._/-]/g, '')}`;
  return 'https://github.com/chengxi-Z/llm-pulse';
}

function skillShareHtml(item) {
  const name = pick(item, 'name') || item.id;
  const desc = pick(item, 'description');
  const target = (item.install && item.install.target) || '';
  const url = `${SKILLS_URL}#${item.id}`;
  const attrs = [
    'type="button"',
    'class="share-btn"',
    'data-share',
    'data-share-kind="skill"',
    'data-share-type="skill"',
    `data-share-title="${esc(name)}"`,
    `data-share-desc="${esc(`${desc}${target ? ` · ${target}` : ''}`)}"`,
    `data-share-url="${esc(url)}"`,
    `data-share-stats="${esc(target || 'SKILL.md')}"`,
    `aria-label="${esc(t('skills.card.share'))}"`,
    `title="${esc(t('skills.card.share'))}"`,
  ].join(' ');
  return `<button ${attrs}><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H3.8A1.8 1.8 0 0 0 2 4.8v7.4A1.8 1.8 0 0 0 3.8 14h7.4a1.8 1.8 0 0 0 1.8-1.8V10"/><path d="M9.5 1.5H14v4.5"/><path d="M13.8 2.2 7.5 8.5"/></svg></button>`;
}

function cardHtml(item) {
  const name = pick(item, 'name') || item.id;
  const desc = pick(item, 'description');
  const sourceType = item.sourceType || 'community';
  const allTags = Array.isArray(item.tags) ? item.tags : [];
  const visibleTags = allTags.slice(0, 4);
  const moreTags = allTags.length > visibleTags.length ? allTags.length - visibleTags.length : 0;
  const tags = [
    ...visibleTags.map((tag) => `<li class="tag">${esc(tag)}</li>`),
    ...(moreTags ? [`<li class="tag tag--more">+${moreTags}</li>`] : []),
  ].join('');
  const stars =
    item.stars == null
      ? ''
      : `<span class="skill-stars" title="${esc(
          t('skills.card.stars', { count: intlNumber(item.stars) })
        )}" aria-label="${esc(t('skills.card.stars', { count: intlNumber(item.stars) }))}">★ ${esc(
          intlNumber(item.stars)
        )}</span>`;
  const featured = item.featured ? `<span class="tag tag--gold">${esc(t('skills.card.featured'))}</span>` : '';
  const source = skillSourceUrl(item);
  return `<article class="skill-card" id="skill-${esc(item.id)}" aria-label="${esc(
    t('skills.card.aria', { name })
  )}">
    <div class="skill-card-top">
      <span class="skill-badge skill-badge--${esc(sourceType)}">${esc(sourceLabel(sourceType))}</span>
      <span class="skill-category">${esc(categoryLabel(item.category))}</span>
      ${featured}
      ${stars}
    </div>
    <h3 class="skill-name"><a href="#${esc(item.id)}" data-skill-open="${esc(item.id)}">${esc(name)}</a></h3>
    <p class="skill-desc">${esc(desc)}</p>
    ${tags ? `<ul class="skill-tags">${tags}</ul>` : ''}
    <div class="skill-card-footer">
      <div class="skill-meta">
        <span>${esc(t('skills.card.by', { author: item.author || '—' }))}</span>
        ${item.license ? `<span>${esc(item.license)}</span>` : ''}
        ${item.updatedAt ? `<span>${esc(t('skills.card.updated', { date: intlDate(item.updatedAt) }))}</span>` : ''}
      </div>
      <div class="skill-actions">
      <button type="button" class="btn btn--ghost btn--sm" data-skill-open="${esc(item.id)}">${esc(
        t('skills.card.guide')
      )}</button>
      <a class="btn btn--ghost btn--sm" href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(
        t('skills.card.sourceCode')
      )}</a>
      ${
        item.install && item.install.command
          ? `<button type="button" class="btn btn--ghost btn--sm" data-copy-text="${esc(
              item.install.command
            )}" data-copy-label-key="skills.guide.commandCopied" data-copy-fail-key="skills.guide.copyFailed">${esc(
              t('skills.card.install')
            )}</button>`
          : ''
      }
      ${skillShareHtml(item)}
      </div>
    </div>
  </article>`;
}

function filtered() {
  const query = state.q.toLowerCase();
  return items
    .filter((item) => {
      if (state.source !== 'all' && item.sourceType !== state.source) return false;
      if (state.category !== 'all' && item.category !== state.category) return false;
      if (!query) return true;
      return [pick(item, 'name'), pick(item, 'description'), item.author, item.id, ...(item.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => {
      const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredDiff) return featuredDiff;
      const sourceDiff = (SOURCE_ORDER[a.sourceType] ?? 9) - (SOURCE_ORDER[b.sourceType] ?? 9);
      if (sourceDiff) return sourceDiff;
      const starDiff = (Number(b.stars) || 0) - (Number(a.stars) || 0);
      if (starDiff) return starDiff;
      return (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0);
    });
}

function renderSourceChips() {
  const container = $('#skill-source-chips');
  if (!container) return;
  const counts = items.reduce((acc, item) => {
    const key = item.sourceType || 'community';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const chip = (value, label, count) =>
    `<button type="button" class="chip" data-skill-source="${esc(value)}" aria-pressed="${
      state.source === value ? 'true' : 'false'
    }">${esc(label)}${count == null ? '' : `<span class="chip-count">${count}</span>`}</button>`;
  container.innerHTML = [
    chip('all', t('skills.filter.all'), items.length),
    ...['mine', 'official', 'community'].map((value) => chip(value, t(SOURCE_FILTER_KEYS[value]), counts[value] || 0)),
  ].join('');
}

function renderCategoryChips() {
  const container = $('#skill-category-chips');
  if (!container) return;
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
  const ordered = Object.keys(SKILL_CATEGORY_KEYS).filter((category) => categories.includes(category));
  const other = categories.filter((category) => !SKILL_CATEGORY_KEYS[category]);
  const chip = (value, label) =>
    `<button type="button" class="chip" data-skill-category="${esc(value)}" aria-pressed="${
      state.category === value ? 'true' : 'false'
    }">${esc(label)}</button>`;
  container.innerHTML = [
    chip('all', t('skills.filter.allCategories')),
    ...ordered.map((category) => chip(category, categoryLabel(category))),
    ...other.map((category) => chip(category, category)),
  ].join('');
}

function renderMeta() {
  const meta = $('#skills-meta');
  if (!meta || !payload) return;
  const date = payload.generatedAt ? intlDateTime(payload.generatedAt) : '—';
  meta.textContent = `${t('skills.masthead.count', { count: intlNumber(items.length) })} · ${t('ui.updatedOn', {
    date,
  })}`;
}

function renderGrid() {
  const grid = $('#skills-grid');
  const result = $('#skills-result-count');
  if (!grid) return;
  const list = filtered();
  if (result) result.textContent = t('skills.results', { shown: intlNumber(list.length), total: intlNumber(items.length) });
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state" role="status"><p class="empty-title">${esc(
      t('skills.empty.title')
    )}</p><p class="empty-desc">${esc(t('skills.empty.desc'))}</p></div>`;
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" role="status"><p class="empty-title">${esc(
      t('skills.empty.filterTitle')
    )}</p><p class="empty-desc">${esc(t('skills.empty.filterDesc'))}</p><button type="button" class="filter-empty-reset" data-reset-skill-filters>${esc(
      t('ui.clearFilters')
    )}</button></div>`;
    return;
  }
  try {
    grid.innerHTML = list.map((item) => cardHtml(item)).join('');
  } catch (error) {
    grid.innerHTML = `<div class="empty-state empty-state--error" role="status"><p class="empty-title">${esc(
      t('skills.error.title')
    )}</p></div>`;
  }
}

/* ---------- Usage guide modal ---------- */

function modalEl() {
  return $('#skill-modal');
}

function focusables() {
  const modal = modalEl();
  if (!modal) return [];
  return $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', modal).filter(
    (element) => !element.hidden
  );
}

function openSkill(id, trigger) {
  const item = items.find((entry) => entry.id === id);
  const modal = modalEl();
  if (!item || !modal) return;
  currentSkill = item;
  lastTrigger = trigger || document.activeElement;
  const name = pick(item, 'name') || item.id;
  const badge = $('#skill-modal-badge');
  if (badge) {
    badge.className = `skill-badge skill-badge--${item.sourceType || 'community'}`;
    badge.textContent = sourceLabel(item.sourceType || 'community');
  }
  const title = $('#skill-modal-title');
  if (title) title.textContent = t('skills.guide.title', { name });
  const value = $('#skill-modal-value');
  if (value) value.textContent = pick(item, 'description');
  const when = $('#skill-modal-when');
  if (when) when.textContent = pick(item, 'whenToUse') || '—';
  const notWhen = $('#skill-modal-not-when');
  if (notWhen) notWhen.textContent = pick(item, 'whenNotToUse') || '—';
  const command = $('#skill-modal-command');
  const installCommand = (item.install && item.install.command) || `cp -r skills/${item.id} ~/.dsh/skills/`;
  if (command) command.textContent = installCommand;
  const target = $('#skill-modal-target');
  if (target) target.textContent = (item.install && item.install.target) || `~/.dsh/skills/${item.id}`;
  const selfcheck = $('#skill-modal-selfcheck');
  if (selfcheck) {
    const dir = (item.skillPath || `skills/${item.id}/SKILL.md`).replace(/\/SKILL\.md$/, '');
    selfcheck.textContent = `node ${dir}/scripts/check-project.mjs --self`;
  }
  const steps = $('#skill-modal-steps');
  if (steps) {
    const list = pickList(item, 'usageSteps');
    steps.innerHTML = list.map((step) => `<li>${esc(step)}</li>`).join('') || '<li>—</li>';
  }
  const source = $('#skill-modal-source');
  if (source) source.href = skillSourceUrl(item);
  const share = $('#skill-modal-share');
  if (share) {
    const target = (item.install && item.install.target) || '';
    share.dataset.shareTitle = name;
    share.dataset.shareDesc = `${pick(item, 'description')}${target ? ` · ${target}` : ''}`;
    share.dataset.shareUrl = `${SKILLS_URL}#${item.id}`;
    share.dataset.shareStats = target || 'SKILL.md';
  }
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const close = $('[data-skill-modal-close]', modal);
  if (close && close.focus) close.focus();
}

function closeSkill() {
  const modal = modalEl();
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  currentSkill = null;
  document.body.style.overflow = '';
  if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
}

/* ---------- JSON template download ---------- */

function downloadJsonTemplate() {
  const form = $('#skill-template-form');
  const read = (name) => {
    const field = form ? form.querySelector(`[name="${name}"]`) : null;
    return field ? field.value.trim() : '';
  };
  const name = read('name');
  const slug = (name || 'my-skill')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'my-skill';
  const template = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'curated+github',
    count: 1,
    items: [
      {
        id: slug,
        name: name || 'My Skill',
        description: read('description') || 'What it does in one sentence.',
        category: read('category') || 'methodology',
        author: read('author') || 'your-github-id',
        url: read('url') || 'https://github.com/your-id/your-skill',
        license: read('license') || 'MIT',
        stars: null,
        updatedAt: new Date().toISOString(),
        sourceType: 'community',
        tags: [],
        featured: false,
        lang: 'en',
        whenToUse: '',
        whenNotToUse: '',
        install: { target: `~/.dsh/skills/${slug}`, command: '' },
        usageSteps: [],
        skillPath: `skills/${slug}/SKILL.md`,
      },
    ],
  };
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'skill.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Binding ---------- */

function bindEvents() {
  const sourceChips = $('#skill-source-chips');
  if (sourceChips) {
    sourceChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-skill-source]');
      if (!chip) return;
      state.source = chip.getAttribute('data-skill-source');
      renderSourceChips();
      renderGrid();
    });
  }
  const categoryChips = $('#skill-category-chips');
  if (categoryChips) {
    categoryChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-skill-category]');
      if (!chip) return;
      state.category = chip.getAttribute('data-skill-category');
      renderCategoryChips();
      renderGrid();
    });
  }
  const search = $('#skills-search');
  if (search) {
    search.addEventListener(
      'input',
      debounce(() => {
        state.q = search.value.trim();
        renderGrid();
      }, 180)
    );
  }
  const form = $('#skills-filters');
  if (form) form.addEventListener('submit', (event) => event.preventDefault());

  const grid = $('#skills-grid');
  if (grid) {
    grid.addEventListener('click', (event) => {
      const open = event.target.closest('[data-skill-open]');
      if (open) {
        event.preventDefault();
        const id = open.getAttribute('data-skill-open');
        openSkill(id, open);
        try {
          history.replaceState(null, '', `#${id}`);
        } catch (error) {
          /* History API may be unavailable. */
        }
        return;
      }
      if (event.target.closest('[data-reset-skill-filters]')) {
        state.source = 'all';
        state.category = 'all';
        state.q = '';
        if (search) search.value = '';
        renderSourceChips();
        renderCategoryChips();
        renderGrid();
      }
    });
  }

  const modal = modalEl();
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-skill-modal-close]')) closeSkill();
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSkill();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusables();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  const download = $('#skill-json-download');
  if (download) {
    download.addEventListener('click', downloadJsonTemplate);
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash.replace(/^#/, '').replace(/^skill-/, '');
    if (id && items.some((item) => item.id === id)) openSkill(id, null);
  });
}

function handleDeepLink() {
  const id = location.hash.replace(/^#/, '').replace(/^skill-/, '');
  if (id && items.some((item) => item.id === id)) {
    openSkill(id, null);
  }
}

/* ---------- Public API ---------- */

export function initSkills(data) {
  payload = data && data.skills ? data.skills : { items: [], generatedAt: null, source: 'curated' };
  items = Array.isArray(payload.items) ? payload.items.slice() : [];
  if (!bound) {
    bindEvents();
    bound = true;
  }
  renderSourceChips();
  renderCategoryChips();
  renderMeta();
  renderGrid();
  handleDeepLink();
}

export function refreshSkills() {
  if (!payload) return;
  renderSourceChips();
  renderCategoryChips();
  renderMeta();
  renderGrid();
}
