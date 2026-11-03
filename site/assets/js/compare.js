/* =============================================================================
   AI Pulse — compare.js (v1.4)
   Model comparison for the catalog page: up to six models, selected through
   checkboxes, shown in a floating bar and a keyboard-accessible modal table.
   Scores are real leaderboard values matched by normalised model name
   (data-match.js); unmatched values render an em dash instead of a guess.
   All dynamic strings are escaped and all URL values are not rendered here.
   ============================================================================= */

import { t, getLang } from './i18n.js';
import { escapeHtml as esc, fmtNumber, fmtDate } from './data.js';
import { SCORE_SOURCES, buildRankingIndex, matchModelScores } from './data-match.js';

const MAX_COMPARE = 6;

const PRICE_LABELS = {
  input: 'compare.field.priceInput',
  output: 'compare.field.priceOutput',
};

function displayName(model) {
  const name = String(model.name || model.id || '');
  if (getLang() === 'en') return name;
  /* The catalog stores "Org: Model"; the Chinese UI keeps the model part. */
  if (name.includes(':')) {
    const parts = name.split(':');
    return parts.slice(1).join(':').trim() || name;
  }
  return name;
}

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `$${num.toFixed(2)}`;
}

function formatContext(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1048576 && num % 1048576 === 0) return `${Number((num / 1048576).toFixed(2))}M`;
  if (num >= 1000000) return `${Number((num / 1000000).toFixed(2))}M`;
  if (num >= 1000) return `${Number((num / 1000).toFixed(1))}K`;
  return String(num);
}

function modalityText(model) {
  const list = Array.isArray(model.modalities) ? model.modalities : [];
  if (!list.length) return null;
  return list.map((value) => t(`data.modality.${value}`)).join(' / ');
}

/**
 * Create the comparison controller for one catalog page.
 * @param {{models: object[], rankings: object}} options
 */
export function createCompare({ models = [], rankings = null } = {}) {
  const byId = new Map(models.map((model) => [model.id, model]));
  const selected = new Set();
  const index = buildRankingIndex(rankings);
  let modalOpen = false;
  let lastTrigger = null;

  const bar = document.getElementById('compare-bar');
  const chipsEl = document.getElementById('compare-chips');
  const countEl = document.getElementById('compare-bar-count');
  const openBtn = document.querySelector('[data-compare-open]');
  const clearBtn = document.querySelector('[data-compare-clear]');
  const modal = document.getElementById('compare-modal');
  const scrollEl = document.getElementById('compare-scroll');

  const selectedModels = () => [...selected].map((id) => byId.get(id)).filter(Boolean);

  function checkboxHtml(model, variant = 'table') {
    const name = displayName(model);
    const isSelected = selected.has(model.id);
    const full = selected.size >= MAX_COMPARE && !isSelected;
    return `<label class="compare-check${variant === 'card' ? ' compare-check--card' : ''}">
      <input class="compare-check-input" type="checkbox" data-compare-id="${esc(model.id)}"
        aria-label="${esc(t('compare.selectAria', { name }))}"${isSelected ? ' checked' : ''}${full ? ' disabled' : ''}>
      <span class="compare-check-box" aria-hidden="true"></span>
    </label>`;
  }

  function renderBar() {
    if (!bar) return;
    const list = selectedModels();
    bar.hidden = list.length === 0;
    if (countEl) countEl.textContent = t('compare.count', { selected: fmtNumber(list.length), max: fmtNumber(MAX_COMPARE) });
    if (chipsEl) {
      chipsEl.innerHTML = list
        .map(
          (model) => `<li class="compare-chip">
            <span class="compare-chip-name">${esc(displayName(model))}</span>
            <button type="button" class="compare-chip-remove" data-compare-remove="${esc(model.id)}"
              aria-label="${esc(t('compare.remove', { name: displayName(model) }))}">×</button>
          </li>`
        )
        .join('');
    }
    if (openBtn) openBtn.disabled = list.length < 2;
  }

  function syncRenderedCheckboxes() {
    document.querySelectorAll('[data-compare-id]').forEach((input) => {
      const id = input.getAttribute('data-compare-id');
      const isSelected = selected.has(id);
      input.checked = isSelected;
      input.disabled = selected.size >= MAX_COMPARE && !isSelected;
      const card = input.closest('.model-card');
      if (card) card.classList.toggle('is-compared', isSelected);
      const row = input.closest('tr');
      if (row) row.classList.toggle('is-compared', isSelected);
    });
  }

  function bestIndexes(values, higherIsBetter = true) {
    const numeric = values.map((value) => (Number.isFinite(value) ? value : null));
    const present = numeric.filter((value) => value != null);
    if (present.length < 2) return new Set();
    const best = higherIsBetter ? Math.max(...present) : Math.min(...present);
    const indexes = new Set();
    numeric.forEach((value, index) => {
      if (value != null && value === best) indexes.add(index);
    });
    return indexes;
  }

  function scoreRow(source, list) {
    const values = list.map((model) => {
      const scores = matchModelScores(model, index);
      const record = scores[source.key];
      return record ? Number(record.score) : null;
    });
    const best = bestIndexes(values);
    const label = t(`compare.field.${source.key}`);
    const cells = list
      .map((model, position) => {
        const scores = matchModelScores(model, index);
        const record = scores[source.key];
        if (!record || !Number.isFinite(Number(record.score))) {
          return `<td class="compare-cell is-missing" title="${esc(t('compare.notMatched'))}">—</td>`;
        }
        const value = record.scoreDisplay || String(record.score);
        const sourceName = record.source || source.source;
        const metric = record.metric || source.metric;
        return `<td class="compare-cell${best.has(position) ? ' is-best' : ''}" title="${esc(`${sourceName} · ${metric}`)}">${esc(
          String(value)
        )}</td>`;
      })
      .join('');
    return `<tr><th class="compare-field" scope="row">${esc(label)}</th>${cells}</tr>`;
  }

  function valueRow(label, values, { higherIsBetter = null, missing = null } = {}) {
    const numeric = values.map((value) => (value && Number.isFinite(Number(value.raw)) ? Number(value.raw) : null));
    const best = higherIsBetter == null ? new Set() : bestIndexes(numeric, higherIsBetter);
    const cells = values
      .map((value, position) => {
        if (value == null || value.text == null) {
          return `<td class="compare-cell is-missing" title="${esc(missing || t('compare.notMatched'))}">—</td>`;
        }
        return `<td class="compare-cell${best.has(position) ? ' is-best' : ''}">${esc(value.text)}</td>`;
      })
      .join('');
    return `<tr><th class="compare-field" scope="row">${esc(label)}</th>${cells}</tr>`;
  }

  function renderTable() {
    if (!scrollEl) return;
    const list = selectedModels();
    if (list.length < 2) {
      scrollEl.innerHTML = `<p class="compare-empty">${esc(t('compare.title'))}</p>`;
      return;
    }
    const head = list
      .map(
        (model) => `<th class="compare-col compare-col--model" scope="col">
          <span class="compare-col-name">${esc(displayName(model))}</span>
          <span class="compare-col-sub">${esc(model.org || '—')}</span>
        </th>`
      )
      .join('');
    const scoreRows = SCORE_SOURCES.map((source) => scoreRow(source, list)).join('');
    const priceRows = ['input', 'output']
      .map((field) =>
        valueRow(
          t(PRICE_LABELS[field]),
          list.map((model) => {
            const raw = model.pricing ? Number(model.pricing[field]) : NaN;
            const text = formatPrice(raw);
            return text == null ? null : { raw, text };
          }),
          { higherIsBetter: false }
        )
      )
      .join('');
    const extraRows = [
      valueRow(t('models.thContext'), list.map((model) => ({ raw: Number(model.contextWindow), text: formatContext(model.contextWindow) })), {
        higherIsBetter: true,
      }),
      valueRow(t('models.thModality'), list.map((model) => ({ text: modalityText(model) }))),
      valueRow(t('models.thOpen'), list.map((model) => ({ text: model.openWeights ? t('data.open.open') : t('data.open.closed') }))),
      valueRow(t('compare.field.license'), list.map((model) => ({ text: model.license || null }))),
      valueRow(t('models.thRelease'), list.map((model) => ({ text: fmtDate(model.releaseDate) }))),
      valueRow(t('compare.field.org'), list.map((model) => ({ text: model.org || null }))),
    ].join('');
    scrollEl.innerHTML = `<table class="compare-table">
      <caption class="u-visually-hidden">${esc(t('compare.title'))}</caption>
      <thead><tr><th class="compare-field compare-field--head" scope="col"><span class="u-visually-hidden">${esc(t('compare.title'))}</span></th>${head}</tr></thead>
      <tbody>${scoreRows}${priceRows}${extraRows}</tbody>
    </table>
    <p class="compare-table-note">${esc(t('compare.sourceNote'))}</p>
    <p class="compare-table-note">${esc(t('compare.rule'))}</p>`;
  }

  function focusable() {
    if (!modal) return [];
    return [...modal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (element) => !element.hidden
    );
  }

  function openModal() {
    if (!modal || selected.size < 2) return;
    modalOpen = true;
    lastTrigger = document.activeElement;
    renderTable();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const close = modal.querySelector('[data-compare-close]');
    if (close && close.focus) close.focus();
  }

  function closeModal() {
    if (!modal || !modalOpen) return;
    modalOpen = false;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  function toggle(id, checked) {
    if (!byId.has(id)) return;
    if (checked) {
      if (selected.size >= MAX_COMPARE) return;
      selected.add(id);
    } else {
      selected.delete(id);
    }
    renderBar();
    syncRenderedCheckboxes();
    if (modalOpen) renderTable();
  }

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-compare-id]');
    if (!input) return;
    toggle(input.getAttribute('data-compare-id'), input.checked);
  });

  document.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-compare-remove]');
    if (remove) {
      toggle(remove.getAttribute('data-compare-remove'), false);
      return;
    }
    if (event.target.closest('[data-compare-clear]')) {
      selected.clear();
      renderBar();
      syncRenderedCheckboxes();
      if (modalOpen) renderTable();
      return;
    }
    if (event.target.closest('[data-compare-open]')) {
      openModal();
      return;
    }
    if (event.target.closest('[data-compare-close]')) closeModal();
  });

  if (modal) {
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  return {
    checkboxHtml,
    sync() {
      renderBar();
      syncRenderedCheckboxes();
      if (modalOpen) renderTable();
    },
    refresh() {
      this.sync();
    },
    open: openModal,
    close: closeModal,
  };
}
