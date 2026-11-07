import { t } from './i18n.js';
import { intlNumber, intlDateTime, intlShortDate } from './render.js';
import { escapeHtml as esc, safeHttpUrl } from './data.js';
import { buildRankingIndex, collectCapabilityCostPoints, median as medianOf } from './data-match.js';
const COUNT_UP_MS = 900;
const PRICE_TIERS = ['free', 'low', 'mid', 'high', 'premium'];
const CAROUSEL_INTERVAL = 6500;
const MANUAL_PAUSE_MS = 12000;
const SCATTER_W = 900;
const SCATTER_H = 280;
const X_LOG_MIN = 0.01;
const Y_MAX = 100;
let carouselState = null;
let dataset = null;
let animated = false;
let tooltipBound = false;
let pieBound = false;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
function compactNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  const trim = (input) => String(Number(input));
  if (num >= 1e15) return `${trim((num / 1e15).toPrecision(4))}Q`;
  if (num >= 1e12) return `${trim((num / 1e12).toPrecision(4))}T`;
  if (num >= 1e9) return `${trim((num / 1e9).toPrecision(4))}B`;
  if (num >= 1e6) return `${trim((num / 1e6).toPrecision(4))}M`;
  if (num >= 1e3) return `${trim((num / 1e3).toPrecision(4))}K`;
  return intlNumber(num);
}
function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return '0.00';
  if (num >= 100) return num.toFixed(0);
  if (num >= 1) return num.toFixed(2);
  return num.toFixed(2).replace(/0$/, '');
}
function roundPercent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}
function mondayStart(date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - (day - 1));
  value.setHours(0, 0, 0, 0);
  return value;
}
function addDays(date, days) {
  const value = new Date(date.getTime());
  value.setDate(value.getDate() + days);
  return value;
}
function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (error) {
    return false;
  }
}
const tierLabel = (tier) => t(`dashboard.price.${tier}`);
function formatKpiNumber(kpi, value) {
  if (kpi.format === 'ratio') return `${intlNumber(Math.round(value))}/${kpi.total}`;
  if (kpi.format === 'capacity' || kpi.format === 'tokens') return compactNumber(value);
  return intlNumber(Math.round(value));
}
function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}
const escapeText = (value) => String(value == null ? '' : value);
function computeMetrics(data) {
  const models = (data.models && data.models.models) || [];
  const meta = data.meta || {};
  const boards = (data.rankings && data.rankings.boards) || [];
  const news = (data.news && data.news.items) || [];
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  const generatedAt = meta.generatedAt ? new Date(meta.generatedAt) : new Date();
  const orgCounts = new Map();
  models.forEach((model) => orgCounts.set(model.org || '—', (orgCounts.get(model.org || '—') || 0) + 1));
  const contextTotal = models.reduce((sum, model) => sum + (Number(model.contextWindow) || 0), 0);
  const usageWeeks = (data.usage && Array.isArray(data.usage.weeks) ? data.usage.weeks : []).slice(-12);
  const usageMonthly = Number(data.usage && data.usage.monthlyTokens) || usageWeeks.slice(-4).reduce((sum, point) => sum + Number(point.tokens || 0), 0);
  const usageDays = Number(data.usage && data.usage.monthlyDays) || usageWeeks.slice(-4).length * 7;
  const since7 = addDays(generatedAt, -7);
  const newModels = models.filter((model) => {
    const date = new Date(model.releaseDate || '');
    return !Number.isNaN(date.getTime()) && date >= since7 && date <= generatedAt;
  }).length;
  const boardSources = new Set(boards.map((board) => board.sourceName).filter(Boolean));
  const okSources = sources.filter((source) => source.status === 'ok').length;
  const newsSources = new Set(news.map((item) => item.sourceName).filter(Boolean));
  const currentWeek = mondayStart(generatedAt);
  const trend = [];
  for (let index = 11; index >= 0; index -= 1) {
    const weekStart = addDays(currentWeek, -7 * index);
    const weekEnd = addDays(weekStart, 7);
    const count = models.filter((model) => {
      const date = new Date(model.releaseDate || '');
      return !Number.isNaN(date.getTime()) && date >= weekStart && date < weekEnd;
    }).length;
    trend.push({ date: weekStart, count });
  }
  const totalReleases = trend.reduce((sum, point) => sum + point.count, 0);
  const meanReleases = totalReleases / trend.length;
  const tiers = { free: 0, low: 0, mid: 0, high: 0, premium: 0 };
  let pricedCount = 0;
  models.forEach((model) => {
    const output = model.pricing && Number(model.pricing.output);
    if (!Number.isFinite(output)) return;
    pricedCount += 1;
    if (output === 0) tiers.free += 1;
    else if (output < 1) tiers.low += 1;
    else if (output < 5) tiers.mid += 1;
    else if (output < 15) tiers.high += 1;
    else tiers.premium += 1;
  });
  const rankingIndex = buildRankingIndex(data.rankings);
  const points = collectCapabilityCostPoints(models, rankingIndex);
  const priceMedian = medianOf(points.map((point) => point.price));
  const scoreMedian = medianOf(points.map((point) => point.score));
  const quadrant = { survival: 0, highCost: 0, lowCapability: 0, kill: 0 };
  if (priceMedian != null && scoreMedian != null) {
    points.forEach((point) => {
      const lowCost = point.price <= priceMedian;
      const highCapability = point.score >= scoreMedian;
      if (lowCost && highCapability) quadrant.survival += 1;
      else if (!lowCost && highCapability) quadrant.highCost += 1;
      else if (lowCost) quadrant.lowCapability += 1;
      else quadrant.kill += 1;
    });
  }
  const topics = (data.topics && Array.isArray(data.topics.items) ? data.topics.items : []).slice(0, 10);
  return {
    modelsCount: models.length,
    orgsCount: new Set(models.map((model) => model.org).filter(Boolean)).size,
    contextTotal,
    usageWeeks,
    usageMonthly,
    usageDays,
    newModels,
    newModelsDays: 7,
    boardsCount: boards.length,
    boardSources: boardSources.size,
    sourcesOk: okSources,
    sourcesTotal: sources.length,
    newsCount: news.length,
    newsSources: newsSources.size,
    generatedAt,
    trend,
    meanReleases,
    tiers,
    pricedCount,
    unpricedCount: models.length - pricedCount,
    points,
    priceMedian,
    scoreMedian,
    quadrant,
    topics,
    topicsUpdatedAt: data.topics && data.topics.generatedAt,
  };
}
function kpiDefinitions(metrics) {
  return [
    { id: 'models', label: t('dashboard.kpi.models'), value: metrics.modelsCount, hint: t('dashboard.kpi.modelsHint', { n: intlNumber(metrics.orgsCount) }) },
    { id: 'usage', label: t('dashboard.kpi.tokens'), value: metrics.usageMonthly, format: 'tokens', unit: 'tokens', hint: t('dashboard.kpi.tokensHint', { days: intlNumber(metrics.usageDays) }) },
    { id: 'newModels', label: t('dashboard.kpi.newModels'), value: metrics.newModels, hint: t('dashboard.kpi.newModelsHint', { n: intlNumber(metrics.newModelsDays) }) },
    { id: 'boards', label: t('dashboard.kpi.boards'), value: metrics.boardsCount, hint: t('dashboard.kpi.boardsHint', { n: intlNumber(metrics.boardSources) }) },
    { id: 'sources', label: t('dashboard.kpi.sources'), value: metrics.sourcesOk, total: metrics.sourcesTotal, format: 'ratio', hint: t('dashboard.kpi.sourcesHint') },
    { id: 'news', label: t('dashboard.kpi.news'), value: metrics.newsCount, hint: t('dashboard.kpi.newsHint', { n: intlNumber(metrics.newsSources) }) },
  ];
}
function usageTrendHtml(metrics) {
  const weeks = metrics.usageWeeks || [];
  if (weeks.length < 2) return '';
  const width = 248;
  const height = 78;
  const pad = 8;
  const max = Math.max(...weeks.map((point) => Number(point.tokens) || 0));
  const min = Math.min(...weeks.map((point) => Number(point.tokens) || 0));
  const span = max - min || 1;
  const xFor = (index) => pad + (index / (weeks.length - 1)) * (width - pad * 2);
  const yFor = (value) => height - pad - ((Number(value) - min) / span) * (height - pad * 2);
  const points = weeks.map((point, index) => `${xFor(index).toFixed(1)},${yFor(point.tokens).toFixed(1)}`);
  const area = `M${pad},${height - pad} L${points.join(' L')} L${width - pad},${height - pad} Z`;
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  return `<div class="dash-kpi-trend" role="img" aria-label="${esc(t('dashboard.kpi.trendAria'))}">
    <p class="dash-kpi-trend-title">${esc(t('dashboard.kpi.trendTitle'))}</p>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
      <path class="dash-trend-area" d="${area}" />
      <polyline class="dash-trend-line" points="${points.join(' ')}" />
      <circle class="dash-trend-dot" cx="${xFor(weeks.length - 1).toFixed(1)}" cy="${yFor(last.tokens).toFixed(1)}" r="2.6" />
    </svg>
    <p class="dash-kpi-trend-note">${esc(t('dashboard.kpi.trendNote', { weeks: intlNumber(weeks.length), start: intlShortDate(first.weekStart), end: intlShortDate(last.weekStart) }))}</p>
  </div>`;
}
function renderKpis(metrics) {
  const container = $('#dash-kpis');
  if (!container) return [];
  const definitions = kpiDefinitions(metrics);
  container.innerHTML = definitions
    .map((kpi) => {
      const display = metrics.modelsCount ? formatKpiNumber(kpi, animated ? kpi.value : 0) : t('dashboard.kpi.noData');
      const unit = kpi.unit ? `<span class="dash-kpi-unit">${kpi.unit}</span>` : '';
      return `<div class="dash-kpi" data-kpi="${kpi.id}"${kpi.id === 'usage' ? ' tabindex="0"' : ''}>
        <p class="dash-kpi-label">${kpi.label}</p>
        <p class="dash-kpi-value"><span class="dash-kpi-number" data-countup-value="${kpi.value}" data-countup-format="${kpi.format || 'number'}" data-countup-total="${kpi.total || ''}">${display}</span>${unit}</p>
        <p class="dash-kpi-note" title="${esc(kpi.hint)}">${kpi.hint}</p>
        ${kpi.id === 'usage' ? usageTrendHtml(metrics) : ''}
      </div>`;
    })
    .join('');
  return definitions;
}
function renderReleases(metrics) {
  const container = $('#dash-releases');
  if (!container) return;
  const trend = metrics.trend || [];
  if (!trend.length) {
    container.innerHTML = `<p class="u-muted">${t('dashboard.releases.empty')}</p>`;
    return;
  }
  const width = 640;
  const height = 260;
  const pad = { top: 26, right: 16, bottom: 38, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...trend.map((point) => point.count));
  const stepX = innerW / trend.length;
  const barW = Math.min(30, stepX * 0.54);
  const baseline = pad.top + innerH;
  const y = (value) => pad.top + innerH - (value / max) * innerH;
  const meanY = y(metrics.meanReleases);
  const reduce = prefersReducedMotion();
  const grid = [0, 0.5, 1]
    .map((ratio) => {
      const yPos = pad.top + innerH * (1 - ratio);
      return `<line class="dash-grid-line" x1="${pad.left}" y1="${yPos}" x2="${width - pad.right}" y2="${yPos}" />`;
    })
    .join('');
  const yLabels = [0, 0.5, 1]
    .map((ratio) => {
      const value = Math.round(max * ratio);
      const yPos = pad.top + innerH * (1 - ratio);
      return `<text class="dash-axis-label" x="${pad.left - 10}" y="${yPos + 4}" text-anchor="end">${intlNumber(value)}</text>`;
    })
    .join('');
  const barRects = trend
    .map((point, index) => {
      const x = pad.left + stepX * index + (stepX - barW) / 2;
      const barH = Math.max(point.count ? 2 : 0, (point.count / max) * innerH);
      const barY = baseline - barH;
      const label = t('dashboard.releases.tooltip', { week: intlShortDate(point.date), n: intlNumber(point.count) });
      const valueLabel =
        point.count === max && point.count > 0
          ? `<text class="dash-bar-value" x="${(x + barW / 2).toFixed(1)}" y="${(barY - 8).toFixed(1)}" text-anchor="middle">${intlNumber(point.count)}</text>`
          : '';
      return `<rect class="dash-bar" x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}"
        style="--i:${index}" tabindex="0" role="img" aria-label="${esc(label)}"
        data-dash-tip="${esc(label)}"></rect>${valueLabel}`;
    })
    .join('');
  const barLabels = trend
    .map((point, index) => {
      const x = pad.left + stepX * index + (stepX - barW) / 2 + barW / 2;
      return `<text class="dash-axis-label${index % 2 ? ' dash-axis-label--alt' : ''}" x="${x.toFixed(1)}" y="${height - 12}" text-anchor="middle">${intlShortDate(point.date)}</text>`;
    })
    .join('');
  container.innerHTML = `<svg class="dash-barchart${reduce ? ' is-reduced' : ''}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(t('dashboard.releases.aria'))}">
    <g class="dash-grid-lines">${grid}</g>
    <g class="dash-axis-y">${yLabels}</g>
    <line class="dash-mean-line" x1="${pad.left}" y1="${meanY.toFixed(1)}" x2="${width - pad.right}" y2="${meanY.toFixed(1)}" />
    <text class="dash-mean-label" x="${width - pad.right}" y="${(meanY - 8).toFixed(1)}" text-anchor="end">${esc(t('dashboard.releases.mean', { n: Number(metrics.meanReleases.toFixed(1)) }))}</text>
    <g class="dash-bars">${barRects}</g>
    <g class="dash-axis-x">${barLabels}</g>
  </svg>`;
}
function donutArcs(segments) {
  const cx = 120;
  const cy = 120;
  const outer = 88;
  const inner = 54;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let angle = -Math.PI / 2;
  return segments.map((segment) => {
    const sweep = (segment.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const half = sweep / 2;
    const large = sweep > Math.PI ? 1 : 0;
    const point = (radius, current) => `${(cx + Math.cos(current) * radius).toFixed(2)} ${(cy + Math.sin(current) * radius).toFixed(2)}`;
    const outerStart = point(outer, start);
    const outerEnd = point(outer, end);
    const innerEnd = point(inner, end);
    const innerStart = point(inner, start);
    const path =
      sweep >= Math.PI * 2 - 0.0001
        ? `M${cx - outer} ${cy} A${outer} ${outer} 0 1 1 ${cx + outer} ${cy} A${outer} ${outer} 0 1 1 ${cx - outer} ${cy} Z M${cx - inner} ${cy} A${inner} ${inner} 0 1 1 ${cx + inner} ${cy} A${inner} ${inner} 0 1 1 ${cx - inner} ${cy} Z`
        : `M${outerStart} A${outer} ${outer} 0 ${large} 1 ${outerEnd} L${innerEnd} A${inner} ${inner} 0 ${large} 0 ${innerStart} Z`;
    return { ...segment, path, sweep, half };
  });
}
function renderPricePie(metrics) {
  const container = $('#dash-price-pie');
  const legend = $('#dash-price-legend');
  if (!container) return;
  const total = metrics.pricedCount;
  if (!total) {
    container.innerHTML = `<p class="u-muted">${t('dashboard.pricePie.empty')}</p>`;
    if (legend) legend.innerHTML = '';
    return;
  }
  const segments = PRICE_TIERS.map((tier) => ({
    tier,
    value: metrics.tiers[tier] || 0,
    label: tierLabel(tier),
    count: metrics.tiers[tier] || 0,
    percent: roundPercent(metrics.tiers[tier] || 0, total),
  }));
  const arcs = donutArcs(segments);
  const centerModels = t('dashboard.pricePie.centerModels', { count: intlNumber(metrics.modelsCount) });
  const centerPriced = t('dashboard.pricePie.centerPriced', { count: intlNumber(total) });
  const reduce = prefersReducedMotion();
  container.innerHTML = `<svg class="dash-donut${reduce ? ' is-reduced' : ''}" viewBox="0 0 240 240" role="img" aria-label="${esc(t('dashboard.pricePie.aria'))}">
      <g class="dash-donut-segs">${arcs
        .map(
          (arc) =>
            `<path class="dash-donut-seg" data-tier="${arc.tier}" d="${arc.path}" tabindex="0" role="img"
              aria-label="${esc(`${arc.label} · ${t('dashboard.pricePie.legendValue', { count: intlNumber(arc.count), percent: arc.percent })}`)}"
              data-dash-tip="${esc(`${arc.label} · ${t('dashboard.pricePie.legendValue', { count: intlNumber(arc.count), percent: arc.percent })}`)}"></path>`
        )
        .join('')}</g>
    </svg>
    <p class="dash-donut-center"><strong class="dash-donut-total">${esc(centerModels)}</strong><span class="dash-donut-sub">${esc(centerPriced)}</span></p>`;
  if (legend) {
    legend.setAttribute('aria-label', t('dashboard.pricePie.legend'));
    legend.classList.add('dash-legend');
    legend.innerHTML = segments
      .map(
        (segment) => `<li class="dash-legend-row${segment.value ? '' : ' is-empty'}" data-tier="${segment.tier}" tabindex="0">
          <span class="dash-legend-dot" data-tier="${segment.tier}"></span>
          <span class="dash-legend-name">${esc(segment.label)}</span>
          <span class="dash-legend-count">${intlNumber(segment.count)}</span>
          <span class="dash-legend-pct">${segment.percent}%</span>
        </li>`
      )
      .join('');
    bindPieHover();
  }
}
function bindPieHover() {
  if (pieBound) return;
  pieBound = true;
  const root = $('#dash-slide-price') || document;
  const setActive = (tier, active) => {
    $$(`[data-tier="${tier}"]`, root).forEach((node) => node.classList.toggle('is-active', active));
  };
  root.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-tier]');
    if (target) setActive(target.getAttribute('data-tier'), true);
  });
  root.addEventListener('mouseout', (event) => {
    const target = event.target.closest('[data-tier]');
    if (target) setActive(target.getAttribute('data-tier'), false);
  });
  root.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-tier]');
    if (target) setActive(target.getAttribute('data-tier'), true);
  });
  root.addEventListener('focusout', (event) => {
    const target = event.target.closest('[data-tier]');
    if (target) setActive(target.getAttribute('data-tier'), false);
  });
}
function formatAxisPrice(value) {
  if (!(Number(value) > 0)) return '$0';
  if (value >= 100) return '$100';
  if (value >= 10) return '$10';
  if (value >= 1) return '$1';
  if (value >= 0.1) return '$0.1';
  return '$0.01';
}
function shortModelName(model) {
  let name = String((model && (model.name || model.id)) || '').replace(/^[^:]{1,40}:\s*/, '');
  name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return name.length > 22 ? name.slice(0, 21) + '\u2026' : name;
}
function representativePoints(points, metrics, xFor, yFor) {
  const scoreMedian = metrics.scoreMedian;
  const priceMedian = metrics.priceMedian;
  const groups = {
    survival: [],
    highCost: [],
    lowCapability: [],
    kill: [],
  };
  points.forEach((point) => {
    const highCapability = point.score >= scoreMedian;
    const lowCost = point.price <= priceMedian;
    if (highCapability && lowCost) groups.survival.push(point);
    else if (highCapability) groups.highCost.push(point);
    else if (lowCost) groups.lowCapability.push(point);
    else groups.kill.push(point);
  });
  const picked = [];
  const seenNames = new Set();
  ['survival', 'highCost', 'lowCapability', 'kill'].forEach((key) => {
    const group = groups[key];
    if (!group.length) return;
    const cx = group.reduce((sum, point) => sum + xFor(point.price), 0) / group.length;
    const cy = group.reduce((sum, point) => sum + yFor(point.score), 0) / group.length;
    const ranked = group.slice().sort(
      (a, b) => Math.hypot(xFor(a.price) - cx, yFor(a.score) - cy) - Math.hypot(xFor(b.price) - cx, yFor(b.score) - cy)
    );
    for (const point of ranked) {
      const name = shortModelName(point.model);
      if (!name || seenNames.has(name)) continue;
      seenNames.add(name);
      picked.push({ point, name });
      break;
    }
  });
  return picked;
}
function renderScatter(metrics) {
  const container = $('#dash-scatter');
  if (!container) return;
  const points = metrics.points || [];
  if (!points.length || metrics.priceMedian == null || metrics.scoreMedian == null) {
    container.innerHTML = '<p class="u-muted">' + t('dashboard.scatter.empty') + '</p>';
    return;
  }
  const pad = { top: 18, right: 18, bottom: 40, left: 58 };
  const innerW = SCATTER_W - pad.left - pad.right;
  const innerH = SCATTER_H - pad.top - pad.bottom;
  const prices = points.map((point) => point.price);
  const maxPrice = Math.max(100, ...prices);
  const logMin = Math.log10(X_LOG_MIN);
  const logMax = Math.log10(maxPrice);
  const xFor = (price) => pad.left + ((Math.log10(Math.max(price, X_LOG_MIN)) - logMin) / (logMax - logMin)) * innerW;
  const yFor = (score) => pad.top + innerH - (Math.min(Y_MAX, Math.max(0, score)) / Y_MAX) * innerH;
  const priceX = xFor(metrics.priceMedian);
  const scoreY = yFor(metrics.scoreMedian);
  const xTicks = [0.01, 0.1, 1, 10, 100].map((value) => ({ value, x: xFor(value), label: formatAxisPrice(value) }));
  const yTicks = [0, 50, 100].map((value) => ({ value, y: yFor(value), label: String(value) }));
  const quadrants = [
    { key: 'survival', cls: 'is-survival', label: t('dashboard.scatter.quadSurvival'), x: pad.left, y: pad.top, w: priceX - pad.left, h: scoreY - pad.top },
    { key: 'highCost', cls: 'is-highcost', label: t('dashboard.scatter.quadHighCost'), x: priceX, y: pad.top, w: SCATTER_W - pad.right - priceX, h: scoreY - pad.top },
    { key: 'lowCapability', cls: 'is-lowability', label: t('dashboard.scatter.quadLowAbility'), x: pad.left, y: scoreY, w: priceX - pad.left, h: SCATTER_H - pad.bottom - scoreY },
    { key: 'kill', cls: 'is-kill', label: t('dashboard.scatter.quadKilled'), x: priceX, y: scoreY, w: SCATTER_W - pad.right - priceX, h: SCATTER_H - pad.bottom - scoreY },
  ];
  const rects = quadrants
    .map(
      (quadrant) =>
        '<rect class="dash-quadrant ' +
        quadrant.cls +
        '" x="' +
        quadrant.x.toFixed(1) +
        '" y="' +
        quadrant.y.toFixed(1) +
        '" width="' +
        Math.max(0, quadrant.w).toFixed(1) +
        '" height="' +
        Math.max(0, quadrant.h).toFixed(1) +
        '"></rect>'
    )
    .join('');
  const quadrantLegend = quadrants
    .map(
      (quadrant) =>
        '<li><span class="dash-quadrant-swatch ' +
        quadrant.cls +
        '"></span>' +
        esc(quadrant.label) +
        '<span class="dash-quadrant-count">' +
        intlNumber(metrics.quadrant[quadrant.key] || 0) +
        '</span></li>'
    )
    .join('');
  const xLabels = xTicks
    .map(
      (tick, index) =>
        '<text class="dash-axis-label' +
        (index % 2 ? ' dash-axis-label--alt' : '') +
        '" x="' +
        tick.x.toFixed(1) +
        '" y="' +
        (SCATTER_H - 14) +
        '" text-anchor="middle">' +
        esc(tick.label) +
        '</text>'
    )
    .join('');
  const yLabels = yTicks
    .map(
      (tick) =>
        '<text class="dash-axis-label" x="' +
        (pad.left - 12) +
        '" y="' +
        (tick.y + 4).toFixed(1) +
        '" text-anchor="end">' +
        esc(tick.label) +
        '</text>'
    )
    .join('');
  const pointHtml = points
    .map((point, index) => {
      const survival = point.score >= metrics.scoreMedian && point.price <= metrics.priceMedian;
      const tip = t('dashboard.killLine2.tooltip', {
        model: point.model.name,
        score: point.scoreDisplay,
        price: formatPrice(point.price),
      });
      const radius = survival ? 6 : 4;
      return (
        '<circle class="dash-scatter-point' +
        (survival ? ' is-survive' : ' is-dead') +
        '" cx="' +
        xFor(point.price).toFixed(1) +
        '" cy="' +
        yFor(point.score).toFixed(1) +
        '" r="' +
        radius +
        '" style="--i:' +
        index +
        '" tabindex="0" role="img" aria-label="' +
        esc(tip) +
        '" data-dash-tip="' +
        esc(tip) +
        '"></circle>'
      );
    })
    .join('');
  const representative = representativePoints(points, metrics, xFor, yFor);
  const labelBoxes = [];
  const labelHtml = representative
    .map(({ point, name }) => {
      const x = xFor(point.price);
      const y = yFor(point.score);
      const anchor = x > SCATTER_W - 180 ? 'end' : 'start';
      const dx = anchor === 'end' ? -10 : 10;
      const approxWidth = name.length * 7.2 + 10;
      const x0 = anchor === 'end' ? x + dx - approxWidth : x + dx;
      const x1 = x0 + approxWidth;
      let ty = null;
      for (const offset of [-10, 16, -28, 34, -46, 52, -64]) {
        const candidate = y + offset;
        if (candidate < pad.top + 14 || candidate > SCATTER_H - pad.bottom - 6) continue;
        const box = { x0, x1, y0: candidate - 12, y1: candidate + 2 };
        const overlap = labelBoxes.some(
          (placed) =>
            !(box.x1 < placed.x0 - 4 || box.x0 > placed.x1 + 4 || box.y1 < placed.y0 - 2 || box.y0 > placed.y1 + 2)
        );
        if (!overlap) {
          ty = candidate;
          labelBoxes.push(box);
          break;
        }
      }
      if (ty == null) {
        ty = Math.min(SCATTER_H - pad.bottom - 6, Math.max(pad.top + 14, y + 16));
        labelBoxes.push({ x0, x1, y0: ty - 12, y1: ty + 2 });
      }
      return (
        '<text class="dash-scatter-label" x="' +
        (x + dx).toFixed(1) +
        '" y="' +
        ty.toFixed(1) +
        '" text-anchor="' +
        anchor +
        '">' +
        esc(name) +
        '</text>'
      );
    })
    .join('');
  container.innerHTML =
    '<svg class="dash-scatter-svg" viewBox="0 0 ' +
    SCATTER_W +
    ' ' +
    SCATTER_H +
    '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
    esc(t('dashboard.scatter.aria')) +
    '">' +
    '<g class="dash-quadrants">' +
    rects +
    '</g>' +
    '<line class="dash-scatter-line dash-scatter-line--cap" x1="' +
    pad.left +
    '" y1="' +
    scoreY.toFixed(1) +
    '" x2="' +
    (SCATTER_W - pad.right) +
    '" y2="' +
    scoreY.toFixed(1) +
    '"></line>' +
    '<line class="dash-scatter-line dash-scatter-line--cost" x1="' +
    priceX.toFixed(1) +
    '" y1="' +
    pad.top +
    '" x2="' +
    priceX.toFixed(1) +
    '" y2="' +
    (SCATTER_H - pad.bottom) +
    '"></line>' +
    '<g class="dash-axis dash-axis-x">' +
    xLabels +
    '</g>' +
    '<g class="dash-axis dash-axis-y">' +
    yLabels +
    '</g>' +
    '<text class="dash-axis-label dash-scatter-axis-title" x="' +
    (SCATTER_W - pad.right) +
    '" y="' +
    (SCATTER_H - 2) +
    '" text-anchor="end">' +
    esc(t('dashboard.scatter.xAxis')) +
    '</text>' +
    '<text class="dash-axis-label dash-scatter-axis-title" x="' +
    pad.left +
    '" y="' +
    (pad.top - 6) +
    '" text-anchor="start">' +
    esc(t('dashboard.scatter.yAxis')) +
    '</text>' +
    '<text class="dash-axis-label dash-scatter-line-label" x="' +
    (SCATTER_W - pad.right) +
    '" y="' +
    (scoreY - 6).toFixed(1) +
    '" text-anchor="end">' +
    esc(t('dashboard.scatter.abilityLine', { score: Number(metrics.scoreMedian.toFixed(1)) })) +
    '</text>' +
    '<text class="dash-axis-label dash-scatter-line-label" x="' +
    (priceX + 6).toFixed(1) +
    '" y="' +
    (pad.top + 12) +
    '" text-anchor="start">' +
    esc(t('dashboard.scatter.priceLine', { price: '$' + formatPrice(metrics.priceMedian) })) +
    '</text>' +
    '<g class="dash-scatter-points">' +
    pointHtml +
    '</g>' +
    '<g class="dash-scatter-labels">' +
    labelHtml +
    '</g>' +
    '</svg>' +
    '<ul class="dash-quadrant-legend">' +
    quadrantLegend +
    '</ul>' +
    '<p class="dash-scatter-meta">' +
    esc(t('dashboard.scatter.sample', { count: intlNumber(points.length) })) +
    ' · ' +
    esc(t('dashboard.scatter.note')) +
    '</p>' +
    '<p class="dash-scatter-disclaimer">' +
    esc(t('dashboard.killLine2.rule')) +
    '</p>' +
    '<p class="dash-scatter-disclaimer">' +
    esc(t('dashboard.killLine.disclaimer')) +
    '</p>';
}
function renderTopics(metrics) {
  const list = $('#dash-topics');
  const note = $('#dash-topics-note');
  if (!list) return;
  const topics = metrics.topics || [];
  if (note) note.textContent = t('dashboard.topics.note');
  if (!topics.length) {
    list.innerHTML = '<li class="dash-topic-empty u-muted">' + esc(t('dashboard.topics.empty')) + '</li>';
    return;
  }
  list.innerHTML = topics
    .map((item, index) => {
      const title = String(item.title || '').trim();
      if (!title) return '';
      const url = safeHttpUrl(item.url) || safeHttpUrl(item.hnUrl);
      if (!url) return '';
      const domain = String(item.domain || '').trim() || safeHttpUrl(item.hnUrl) || '';
      const summary = String(item.summary || '').trim().slice(0, 160);
      const meta = [
        t('dashboard.topics.points', { count: intlNumber(item.points) }),
        t('dashboard.topics.comments', { count: intlNumber(item.comments) }),
        domain,
        intlShortDate(item.publishedAt),
      ]
        .filter(Boolean)
        .map((part) => '<span class="dash-topic-meta-item">' + esc(part) + '</span>')
        .join('<span class="dash-topic-meta-sep" aria-hidden="true">·</span>');
      return (
        '<li class="dash-topic"><a class="dash-topic-link" href="' +
        esc(url) +
        '" target="_blank" rel="noopener noreferrer" aria-label="' +
        esc(t('dashboard.topics.openAria', { title })) +
        '"><span class="dash-topic-rank">' +
        String(index + 1).padStart(2, '0') +
        '</span><span class="dash-topic-body"><span class="dash-topic-title">' +
        esc(title) +
        '</span>' +
        (summary ? '<span class="dash-topic-summary">' + esc(summary) + '</span>' : '') +
        '<span class="dash-topic-meta">' +
        meta +
        '</span></span></a></li>'
      );
    })
    .join('');
}
function carouselViews() {
  return [
    { title: t('dashboard.carousel.viewReleases') },
    { title: t('dashboard.carousel.viewPrice') },
    { title: t('dashboard.carousel.viewKillLine') },
  ];
}
function updateCarouselLabels() {
  if (!carouselState) return;
  const views = carouselViews();
  carouselState.slides.forEach((slide, index) => {
    if (views[index]) slide.setAttribute('aria-label', views[index].title);
  });
  $$('.dash-dot', carouselState.root).forEach((dot, index) => {
    if (views[index]) dot.setAttribute('aria-label', t('dashboard.carousel.tabAria', { title: views[index].title }));
  });
}
function initCarousel() {
  const root = $('#dash-carousel');
  if (!root) return;
  const slides = $$('.dash-slide', root);
  if (!slides.length) return;
  if (carouselState && carouselState.root === root) {
    updateCarouselLabels();
    return;
  }
  const dotsEl = $('#dash-carousel-dots', root);
  const state = {
    root,
    slides,
    index: 0,
    timer: null,
    paused: false,
    reduced: prefersReducedMotion(),
    manualUntil: 0,
  };
  carouselState = state;
  if (dotsEl) {
    dotsEl.innerHTML = carouselViews()
      .map(
        (view, index) =>
          '<button type="button" class="dash-dot" role="tab" aria-selected="' +
          (index === 0 ? 'true' : 'false') +
          '" aria-label="' +
          esc(t('dashboard.carousel.tabAria', { title: view.title })) +
          '" data-carousel-dot="' +
          index +
          '"></button>'
      )
      .join('');
  }
  const clearTimer = () => {
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = null;
  };
  const schedule = () => {
    clearTimer();
    if (state.reduced) return;
    state.timer = window.setTimeout(() => {
      state.timer = null;
      if (state.paused || document.hidden) {
        schedule();
        return;
      }
      if (Date.now() < state.manualUntil) {
        schedule();
        return;
      }
      root.classList.remove('is-manual');
      setSlide(state.index + 1);
    }, CAROUSEL_INTERVAL);
  };
  const setSlide = (next, { manual = false } = {}) => {
    const total = slides.length;
    const index = ((next % total) + total) % total;
    state.index = index;
    const track = $('#dash-carousel-track', root);
    if (track) track.style.transform = 'translateX(-' + index * 100 + '%)';
    slides.forEach((slide, position) => {
      const active = position === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) slide.removeAttribute('inert');
      else slide.setAttribute('inert', '');
    });
    $$('.dash-dot', root).forEach((dot, position) => {
      dot.setAttribute('aria-selected', position === index ? 'true' : 'false');
      dot.setAttribute('tabindex', position === index ? '0' : '-1');
    });
    if (manual) {
      state.manualUntil = Date.now() + MANUAL_PAUSE_MS;
      root.classList.add('is-manual');
    }
    schedule();
  };
  state.setSlide = setSlide;
  state.schedule = schedule;
  if (dotsEl) {
    dotsEl.addEventListener('click', (event) => {
      const dot = event.target.closest('[data-carousel-dot]');
      if (dot) setSlide(Number(dot.getAttribute('data-carousel-dot')), { manual: true });
    });
  }
  $$('[data-carousel-prev]', root).forEach((button) => {
    button.addEventListener('click', () => setSlide(state.index - 1, { manual: true }));
  });
  $$('[data-carousel-next]', root).forEach((button) => {
    button.addEventListener('click', () => setSlide(state.index + 1, { manual: true }));
  });
  const pause = () => {
    state.paused = true;
    root.classList.add('is-paused');
    clearTimer();
  };
  const resume = () => {
    state.paused = false;
    root.classList.remove('is-paused');
    schedule();
  };
  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) resume();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimer();
    else schedule();
  });
  let startX = null;
  const viewport = $('.dash-carousel-viewport', root);
  if (viewport) {
    viewport.addEventListener(
      'pointerdown',
      (event) => {
        startX = event.clientX;
      },
      { passive: true }
    );
    viewport.addEventListener(
      'pointerup',
      (event) => {
        if (startX == null) return;
        const delta = event.clientX - startX;
        startX = null;
        if (Math.abs(delta) > 40) setSlide(state.index + (delta < 0 ? 1 : -1), { manual: true });
      },
      { passive: true }
    );
  }
  root.classList.add('is-ready');
  slides.forEach((slide, index) => {
    const active = index === 0;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    if (!active) slide.setAttribute('inert', '');
  });
  updateCarouselLabels();
  schedule();
}
function showTooltip(target) {
  const tooltip = $('#dash-tooltip');
  if (!tooltip) return;
  const text = target.getAttribute('data-dash-tip');
  if (!text) return;
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.classList.add('is-visible');
  const section = $('#overview-dashboard') || document.body;
  const rect = target.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = rect.left - sectionRect.left + rect.width / 2 - tooltipRect.width / 2;
  left = Math.max(8, Math.min(left, sectionRect.width - tooltipRect.width - 8));
  const top = Math.max(8, rect.top - sectionRect.top - tooltipRect.height - 8);
  tooltip.style.left = `${left + section.scrollLeft}px`;
  tooltip.style.top = `${top + section.scrollTop}px`;
}
function hideTooltip() {
  const tooltip = $('#dash-tooltip');
  if (tooltip) {
    tooltip.hidden = true;
    tooltip.classList.remove('is-visible');
  }
}
function bindTooltip() {
  if (tooltipBound) return;
  tooltipBound = true;
  const section = $('#overview-dashboard');
  if (!section) return;
  const show = (event) => {
    const target = event.target.closest('[data-dash-tip]');
    if (target) showTooltip(target);
  };
  section.addEventListener('mouseover', show);
  section.addEventListener('focusin', show);
  section.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest('[data-dash-tip]')) hideTooltip();
  });
  section.addEventListener('focusout', hideTooltip);
  section.addEventListener('click', show);
}
function countUp(metrics) {
  if (animated) return;
  animated = true;
  const nodes = $$('[data-countup-value]');
  if (!nodes.length) return;
  const definitions = kpiDefinitions(metrics);
  const reduced = prefersReducedMotion();
  nodes.forEach((node) => {
    const kpi = definitions.find((entry) => entry.id === node.closest('.dash-kpi').getAttribute('data-kpi'));
    if (!kpi) return;
    const finalValue = kpi.value;
    if (reduced || !finalValue) {
      node.textContent = metrics.modelsCount ? formatKpiNumber(kpi, finalValue) : t('dashboard.kpi.noData');
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      node.textContent = formatKpiNumber(kpi, finalValue * easeOutCubic(progress));
      if (progress < 1) window.requestAnimationFrame(tick);
      else node.textContent = formatKpiNumber(kpi, finalValue);
    };
    window.requestAnimationFrame(tick);
  });
}
function renderUpdated(metrics) {
  const node = $('#dashboard-updated');
  if (node) node.textContent = t('dashboard.updated', { date: intlDateTime(metrics.generatedAt) });
}
function setupAnimation(metrics) {
  const section = $('#overview-dashboard');
  if (!section) return;
  const animate = () => {
    section.classList.add('is-in');
    section.classList.add('is-animated');
    countUp(metrics);
  };
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    animate();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.15 }
  );
  observer.observe(section);
}
function renderAll(metrics) {
  renderUpdated(metrics);
  renderKpis(metrics);
  renderReleases(metrics);
  renderPricePie(metrics);
  renderScatter(metrics);
  renderTopics(metrics);
}
export function initDashboard(data) {
  dataset = data || {};
  const metrics = computeMetrics(dataset);
  renderAll(metrics);
  initCarousel();
  bindTooltip();
  setupAnimation(metrics);
}
export function refreshDashboard() {
  if (!dataset) return;
  const metrics = computeMetrics(dataset);
  renderAll(metrics);
  updateCarouselLabels();
  if (animated) countUp(metrics);
}
