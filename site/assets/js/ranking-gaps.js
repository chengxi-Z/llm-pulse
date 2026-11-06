/* =============================================================================
   AI Pulse — ranking-gaps.js
   Pure helpers for the "not listed yet, worth watching" block on benchmark
   leaderboards. A benchmark board (e.g. SWE-bench Verified by Epoch) only lists
   models that its source has actually re-evaluated. This module finds models
   that already have a score on a reference board (ECI) but are missing from the
   current board, so the UI can explain the gap instead of silently omitting
   strong/new models. No data is invented: entries come straight from the
   reference board.
   ============================================================================= */

import { normalizeModelName } from './data-match.js';

/* Variant / routing suffixes that do not identify a different model. */
const MODIFIER_TOKENS = new Set([
  'max', 'high', 'low', 'medium', 'xhigh', 'default', 'fallback', 'preview',
  'thinking', 'reasoning', 'instruct', 'base', 'customtools', 'batch',
]);
/* Date-like suffixes are kept: "Opus 4.5.20251101" is the same model as "Opus 4.5". */
const DATE_TOKEN = /^\d{6,}$/;

/** Reference board used to discover models that are missing from a benchmark. */
export const GAP_REFERENCE = Object.freeze({
  'epoch-swe-bench-verified': 'epoch-eci',
  'epoch-gpqa-diamond': 'epoch-eci',
});

/**
 * Normalised tokens of a model name, with comparison-variant suffixes removed.
 * @param {string} name
 * @returns {string[]}
 */
export function modelTokens(name) {
  return normalizeModelName(name)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !MODIFIER_TOKENS.has(token));
}

/** Stable comparison key for one model name. */
export function modelKey(name) {
  return modelTokens(name).join(' ');
}

/**
 * True when two model names refer to the same model (variant/date aware).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function matchesModelNames(a, b) {
  const left = modelTokens(a);
  const right = modelTokens(b);
  if (!left.length || !right.length) return false;
  if (left.join(' ') === right.join(' ')) return true;
  const short = left.length <= right.length ? left : right;
  const long = left.length <= right.length ? right : left;
  if (short.length < 2 || long.length <= short.length) return false;
  for (let index = 0; index < short.length; index += 1) {
    if (long[index] !== short[index]) return false;
  }
  /* Only date-like extra tokens are accepted ("4.5" vs "4.5.20251101"). */
  return long.slice(short.length).every((token) => DATE_TOKEN.test(token));
}

/**
 * Models with a reference score that are absent from the current board.
 * @param {{id:string, entries?:Array}} board current board from rankings.json
 * @param {Array} boards all boards from rankings.json
 * @param {{limit?:number}} options
 * @returns {Array<{model:string, org:string, rank:number|null, score:number, scoreDisplay:string|null, referenceId:string}>}
 */
export function findGapModels(board, boards, { limit = 6 } = {}) {
  const referenceId = board && GAP_REFERENCE[board.id];
  if (!referenceId || !Array.isArray(boards)) return [];
  const reference = boards.find((candidate) => candidate.id === referenceId);
  if (!reference || !Array.isArray(reference.entries)) return [];

  const currentTokens = (Array.isArray(board.entries) ? board.entries : [])
    .map((entry) => modelTokens(entry && entry.model));

  const seen = new Set();
  const gaps = [];
  const entries = reference.entries
    .filter((entry) => entry && entry.model)
    .slice()
    .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));

  for (const entry of entries) {
    if (gaps.length >= limit) break;
    const key = modelKey(entry.model);
    if (!key || seen.has(key)) continue;
    const present = currentTokens.some((tokens) => {
      const currentName = tokens.join(' ');
      return tokens.length > 0 && matchesModelNames(currentName, entry.model);
    });
    if (present) continue;
    seen.add(key);
    gaps.push({
      model: entry.model,
      org: entry.org || '',
      rank: entry.rank == null ? null : Number(entry.rank),
      score: entry.score,
      scoreDisplay: entry.scoreDisplay || null,
      referenceId,
    });
  }
  return gaps;
}
