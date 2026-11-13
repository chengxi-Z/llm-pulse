/* =============================================================================
   AI Pulse — data-match.js
   Pure helpers that match catalog models (models.json) against leaderboard
   entries (rankings.json) by normalised name. Scores are real data taken from
   the public leaderboards; unmatched models resolve to null and the UI renders
   an em dash instead of inventing a value.
   ============================================================================= */

/* Leaderboard sources shown in the comparison table and scatter plot. */
export const SCORE_SOURCES = [
  { key: 'aa', boardId: 'artificial-analysis-intelligence', source: 'Artificial Analysis', metric: 'AA Intelligence Index' },
  { key: 'lmarena', boardId: '', source: 'LMArena', metric: 'LMArena Arena' },
  { key: 'livebench', boardId: 'livebench-2.0', source: 'LiveBench', metric: 'LiveBench 2.0' },
  { key: 'epoch', boardId: 'epoch-eci', source: 'Epoch AI', metric: 'ECI' },
];

const VARIANT_TOKENS = new Set(['high', 'low', 'medium', 'thinking', 'reasoning', 'instruct', 'base', 'preview']);

/* Normalisation runs on every leaderboard entry and every catalogue model,
   often on the very same strings. The regex pipeline is the dominant cost of
   building the scatter data, so memoise by raw input. */
const normalizeCache = new Map();

/**
 * Lowercase, strip diacritics/parenthetical variants/vendor prefixes and
 * punctuation so "OpenAI: GPT-4o (High)" and "GPT-4o" can be compared.
 * @param {string} name
 * @returns {string}
 */
export function normalizeModelName(name) {
  const raw = String(name == null ? '' : name);
  const cacheKey = 'm:' + raw;
  const cached = normalizeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let value = raw.toLowerCase();
  try {
    value = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch (error) {
    /* Older engines may not support normalize. */
  }
  value = value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  normalizeCache.set(cacheKey, value);
  return value;
}

/**
 * Variant-aware normaliser: keeps parenthetical words as tokens so "Model (High)"
 * does not collide with "Model (Low)".
 * @param {string} name
 * @returns {string}
 */
export function normalizeFullName(name) {
  const raw = String(name == null ? '' : name);
  const cacheKey = 'f:' + raw;
  const cached = normalizeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let value = raw.toLowerCase();
  try {
    value = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch (error) {
    /* ignore */
  }
  const result = value
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  normalizeCache.set(cacheKey, result);
  return result;
}

/* Leaderboard entries and catalogue rows repeat the same names across boards.
   Cache the candidate lists by (name, org) so a model is normalised once per
   page instead of once per board lookup. */
const candidatesCache = new Map();
function cachedCandidates(kind, item) {
  if (!item) return [];
  const raw = String(item.name || '');
  const org = String(item.org || '');
  const key = kind + '\u0000' + raw + '\u0000' + org;
  let value = candidatesCache.get(key);
  if (!value) {
    value = kind === 'exact' ? computeExactCandidates(raw, org) : computeNameCandidates(raw, org);
    candidatesCache.set(key, value);
  }
  return value;
}

/**
 * Build candidate normalised names for one model or leaderboard entry.
 * @param {{name?:string, org?:string}} item
 * @returns {string[]}
 */
export function nameCandidates(item) {
  return cachedCandidates('loose', item);
}
function computeNameCandidates(raw, org) {
  const values = new Set();
  const push = (value) => {
    const normalized = normalizeModelName(value);
    if (normalized) values.add(normalized);
  };
  push(raw);
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) push(parts.slice(1).join(' '));
    if (parts.length > 1) push(parts[0]);
  }
  if (org && raw.toLowerCase().startsWith(org.toLowerCase())) {
    push(raw.slice(org.length));
  }
  /* Drop a trailing variant token such as "(High)" leftovers. */
  for (const candidate of [...values]) {
    const tokens = candidate.split(' ');
    while (tokens.length > 1 && VARIANT_TOKENS.has(tokens[tokens.length - 1])) tokens.pop();
    push(tokens.join(' '));
  }
  return [...values];
}

/**
 * Exact (variant-aware) candidates for a model or leaderboard entry.
 * @param {{name?:string, org?:string}} item
 * @returns {string[]}
 */
function exactCandidates(item) {
  return cachedCandidates('exact', item);
}
function computeExactCandidates(raw, org) {
  const values = new Set();
  const push = (value) => {
    const normalized = normalizeFullName(value);
    if (normalized) values.add(normalized);
  };
  push(raw);
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) push(parts.slice(1).join(' '));
  }
  if (org && raw.toLowerCase().startsWith(org.toLowerCase())) push(raw.slice(org.length));
  return [...values];
}

/**
 * Build a normalised-name index from all leaderboards.
 * @param {object} rankings data/rankings.json payload
 * @returns {Map<string, Record<string, object>>}
 */
export function buildRankingIndex(rankings, sources = SCORE_SOURCES) {
  const exact = new Map();
  const loose = new Map();
  const add = (map, key, sourceKey, record) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, {});
    const bucket = map.get(key);
    if (!bucket[sourceKey]) bucket[sourceKey] = record;
  };
  const boards = Array.isArray(rankings && rankings.boards) ? rankings.boards : [];
  const byId = new Map(boards.map((board) => [board.id, board]));
  for (const source of sources) {
    if (!source.boardId) continue;
    const board = byId.get(source.boardId);
    if (!board) continue;
    const entries = Array.isArray(board.entries) ? board.entries : [];
    entries.forEach((entry) => {
      const record = {
        source: source.source,
        metric: (board.metric && board.metric.name) || source.metric,
        boardId: board.id,
        rank: entry.rank,
        score: entry.score,
        scoreDisplay: entry.scoreDisplay,
        model: entry.model,
        org: entry.org,
        updatedAt: board.updatedAt,
      };
      exactCandidates({ name: entry.model, org: entry.org }).forEach((key) => add(exact, key, source.key, record));
      nameCandidates({ name: entry.model, org: entry.org }).forEach((key) => add(loose, key, source.key, record));
    });
  }
  return { exact, loose };
}

/**
 * Match one catalog model against the normalised leaderboard index.
 * @param {object} model model record from models.json
 * @param {Map<string, Record<string, object>>} index
 * @returns {Record<string, object|null>}
 */
export function matchModelScores(model, index) {
  const result = {};
  if (!model || !index || !index.exact || !index.loose) return result;
  const fill = (map, candidates) => {
    for (const candidate of candidates) {
      const bucket = map.get(candidate);
      if (!bucket) continue;
      for (const key of Object.keys(bucket)) {
        if (result[key] == null && bucket[key]) result[key] = bucket[key];
      }
    }
  };
  fill(index.exact, exactCandidates({ name: model.name, org: model.org }));
  fill(index.loose, nameCandidates({ name: model.name, org: model.org }));
  return result;
}

/**
 * Turn one matched leaderboard record into a capability x cost point.
 * @returns {object|null}
 */
function pointFromRecord(model, output, record, sourceKey) {
  if (!record) return null;
  const displayRaw = record.scoreDisplay != null ? record.scoreDisplay : record.score;
  const displayNumber = Number(String(displayRaw).replace(/[^0-9.-]/g, ''));
  const score = Number.isFinite(displayNumber) ? displayNumber : Number(record.score);
  if (!Number.isFinite(score)) return null;
  return {
    model,
    score,
    scoreDisplay: record.scoreDisplay || String(Number(score.toFixed(1))),
    price: output,
    org: model.org || '—',
    scoreSource: record.source,
    scoreMetric: record.metric,
    scoreKey: sourceKey,
  };
}

/**
 * Catalogue models paired with their score and output price for one source.
 * @param {object[]} models
 * @param {Map<string, Record<string, object>>} index
 * @returns {{model:object, score:number, scoreDisplay:string, price:number, org:string}[]}
 */
export function collectCapabilityCostPointsForSource(models, index, sourceKey = 'aa') {
  const points = [];
  (Array.isArray(models) ? models : []).forEach((model) => {
    const output = model && model.pricing && Number(model.pricing.output);
    if (!Number.isFinite(output)) return;
    const scores = matchModelScores(model, index);
    const point = pointFromRecord(model, output, scores[sourceKey], sourceKey);
    if (point) points.push(point);
  });
  return points;
}

/**
 * Match every model once and bucket the resulting points by score source.
 * Name normalisation is by far the most expensive part of the dashboard build;
 * calling collectCapabilityCostPointsForSource() once per source repeated it
 * N times for the same models.
 * @param {object[]} models
 * @param {Map<string, Record<string, object>>} index
 * @param {string[]} sourceKeys
 * @returns {Record<string, object[]>}
 */
export function collectCapabilityCostPointsBySource(models, index, sourceKeys = ['aa']) {
  const groups = {};
  sourceKeys.forEach((key) => { groups[key] = []; });
  (Array.isArray(models) ? models : []).forEach((model) => {
    const output = model && model.pricing && Number(model.pricing.output);
    if (!Number.isFinite(output)) return;
    const scores = matchModelScores(model, index);
    for (const key of sourceKeys) {
      const point = pointFromRecord(model, output, scores[key], key);
      if (point) groups[key].push(point);
    }
  });
  return groups;
}

export function collectCapabilityCostPoints(models, index) {
  return collectCapabilityCostPointsForSource(models, index, 'aa');
}

/**
 * Median (P50) of a numeric list; returns null for an empty list.
 * @param {number[]} values
 * @returns {number|null}
 */
export function median(values) {
  const list = (Array.isArray(values) ? values : []).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}
