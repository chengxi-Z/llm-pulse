#!/usr/bin/env node
/**
 * i18n dictionary checker for AI Pulse.
 *
 * Scans the site for i18n usage and validates it against the zh/en dictionaries:
 *
 *   - static text annotations:  `data-i18n="key"` and `data-i18n-attr="attr:key,..."`
 *   - dynamic lookups in JS:    `t('key')`, `t("key")`, `t(`key`)`,
 *                               `t('prefix.' + id + '.suffix')`, `t(`board.${id}.name`)`
 *   - referenced keys that only appear as literal values of mapping tables
 *     (`BOARD_NAME_KEYS`, `PAGE_META`, ...) are treated as used as well.
 *
 * Dictionary rules enforced (see docs/EN-STYLE.md and docs/V1.1-CONTRACT.md §3):
 *   - valid flat, dot-separated keys; string values only; no duplicate keys
 *   - zh.json and en.json expose exactly the same key set
 *   - no empty values; identical `{placeholder}` sets in both languages
 *   - no Chinese residue (Han characters / CJK punctuation) in en.json, except
 *     for substrings listed in scripts/i18n-allowlist.json
 *   - every referenced key exists in both dictionaries
 *   - no stale keys that nothing references
 *   - `data-i18n-html` is forbidden (XSS-safe design)
 *
 * Usage:
 *   node scripts/check-i18n.mjs                  # report, exit 0
 *   node scripts/check-i18n.mjs --strict         # exit 1 on any problem (CI)
 *   node scripts/check-i18n.mjs --json           # machine-readable report
 *   node scripts/check-i18n.mjs --dict-only      # dictionaries only, no site scan
 *   node scripts/check-i18n.mjs --root <dir>     # check another checkout (tests)
 *   node scripts/check-i18n.mjs --self-test      # verify the checker itself
 *
 * Exit codes: 0 = pass / advisory run, 1 = problems (strict) or fatal error,
 *             2 = invalid command-line usage.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

const HAN_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const CJK_PUNCT_RE =
  /[\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/;
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}|\{\s*([A-Za-z0-9_.-]+)\s*\}/g;

const SEVERITY = {
  fatal: 'fatal',
  problem: 'problem',
  warning: 'warning',
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function relPath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function buildLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineOf(lineStarts, offset) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function looksLikeKey(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 160 &&
    value.includes('.') &&
    !value.includes('..') &&
    KEY_RE.test(value)
  );
}

function looksLikePrefix(value) {
  return (
    typeof value === 'string' &&
    value.endsWith('.') &&
    value.length > 1 &&
    !/\s/.test(value) &&
    /^[A-Za-z0-9_.-]+$/.test(value)
  );
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkFiles(full, predicate, out);
    } else if (entry.isFile() && predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* JavaScript lexer (enough for i18n scanning)                         */
/* ------------------------------------------------------------------ */

const REGEX_PRECEDING_CHARS = new Set([
  '',
  '(',
  '[',
  '{',
  ',',
  ';',
  ':',
  '=',
  '!',
  '&',
  '|',
  '?',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
]);

const REGEX_PRECEDING_WORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'case',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'yield',
  'await',
  'throw',
]);

function scanQuoted(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    i += 1;
    if (ch === quote) break;
    if (ch === '\n') break;
  }
  return i;
}

function scanTemplateExpression(src, start) {
  let i = start;
  let depth = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = scanQuoted(src, i);
      continue;
    }
    if (ch === '`') {
      i = scanTemplate(src, i);
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      i += 1;
      if (depth === 0) return i;
      continue;
    }
    i += 1;
  }
  return i;
}

function scanTemplate(src, start) {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') return i + 1;
    if (ch === '$' && src[i + 1] === '{') {
      i = scanTemplateExpression(src, i + 2);
      continue;
    }
    i += 1;
  }
  return i;
}

/**
 * Ranges of `${...}` expressions inside a template literal. t() calls nested in
 * template expressions must be scanned as code, not as literal text.
 */
function templateExpressionRanges(src, start, end) {
  const ranges = [];
  let i = start + 1;
  while (i < end - 1) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '$' && src[i + 1] === '{') {
      const exprStart = i + 2;
      const exprEnd = scanTemplateExpression(src, exprStart);
      ranges.push({ start: exprStart, end: Math.min(exprEnd, end) });
      i = exprEnd;
      continue;
    }
    i += 1;
  }
  return ranges;
}

function scanRegexLiteral(src, start) {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      i += 1;
      break;
    } else if (ch === '\n') {
      break;
    }
    i += 1;
  }
  while (i < src.length && /[A-Za-z]/.test(src[i])) i += 1;
  return i;
}

/**
 * Tokenize JavaScript into code / comment / string / template / regex runs.
 * The tokens are only used to locate i18n calls, not to parse the language.
 */
function lexJs(src) {
  const tokens = [];
  let i = 0;
  let codeStart = 0;
  let prevSig = '';
  let word = '';
  let lastWord = '';

  const flushCode = (end) => {
    if (end > codeStart) tokens.push({ kind: 'code', start: codeStart, end });
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === '/' && src[i + 1] === '/') {
      flushCode(i);
      const start = i;
      i += 2;
      while (i < src.length && src[i] !== '\n') i += 1;
      tokens.push({ kind: 'comment', start, end: i });
      codeStart = i;
      continue;
    }

    if (ch === '/' && src[i + 1] === '*') {
      flushCode(i);
      const start = i;
      i += 2;
      const end = src.indexOf('*/', i);
      i = end === -1 ? src.length : end + 2;
      tokens.push({ kind: 'comment', start, end: i });
      codeStart = i;
      continue;
    }

    if (ch === '"' || ch === "'") {
      flushCode(i);
      const start = i;
      i = scanQuoted(src, i);
      tokens.push({
        kind: 'string',
        quote: ch,
        start,
        end: i,
        value: src.slice(start + 1, Math.max(start + 1, i - 1)),
      });
      prevSig = ')';
      word = '';
      lastWord = '';
      codeStart = i;
      continue;
    }

    if (ch === '`') {
      flushCode(i);
      const start = i;
      i = scanTemplate(src, i);
      tokens.push({
        kind: 'template',
        start,
        end: i,
        value: src.slice(start + 1, Math.max(start + 1, i - 1)),
        exprRanges: templateExpressionRanges(src, start, i),
      });
      prevSig = ')';
      word = '';
      lastWord = '';
      codeStart = i;
      continue;
    }

    if (
      ch === '/' &&
      (REGEX_PRECEDING_CHARS.has(prevSig) ||
        REGEX_PRECEDING_WORDS.has(word) ||
        REGEX_PRECEDING_WORDS.has(lastWord))
    ) {
      flushCode(i);
      const start = i;
      i = scanRegexLiteral(src, i);
      tokens.push({ kind: 'regex', start, end: i });
      prevSig = ')';
      word = '';
      lastWord = '';
      codeStart = i;
      continue;
    }

    // Plain code character.
    if (/\s/.test(ch)) {
      if (word) {
        lastWord = word;
        word = '';
      }
    } else {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        word += ch;
      } else {
        if (word) {
          lastWord = word;
          word = '';
        }
        prevSig = ch;
      }
    }
    i += 1;
  }
  flushCode(src.length);
  return tokens;
}

function blankRanges(src, ranges) {
  const chars = src.split('');
  for (const range of ranges) {
    for (let i = range.start; i < range.end; i += 1) {
      const ch = chars[i];
      if (ch !== '\n' && ch !== '\r') chars[i] = ' ';
    }
  }
  return chars.join('');
}

function decodeJsString(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(
    /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[nrtbfv0'"`\\])/g,
    (match, esc) => {
      switch (esc) {
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case 'v':
          return '\v';
        case '0':
          return '\0';
        case '"':
          return '"';
        case "'":
          return "'";
        case '`':
          return '`';
        case '\\':
          return '\\';
        default:
          break;
      }
      if (esc.startsWith('u{')) {
        const code = Number.parseInt(esc.slice(2, -1), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (esc.startsWith('u')) {
        return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
      }
      if (esc.startsWith('x')) {
        return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
      }
      return match;
    },
  );
}

/** Find the index of the `)` matching the `(` at openPos (string/comment aware). */
function findMatchingParen(src, openPos) {
  let i = openPos + 1;
  let depth = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = scanQuoted(src, i);
      continue;
    }
    if (ch === '`') {
      i = scanTemplate(src, i);
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
      i += 1;
      continue;
    }
    i += 1;
  }
  return -1;
}

function parseAnnotationAttrValue(raw, file, line, problems) {
  const keys = [];
  const pairs = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (pairs.length === 0) {
    problems.push({
      severity: SEVERITY.problem,
      type: 'malformed-annotation',
      file,
      line,
      message: 'data-i18n-attr is empty; expected "attr:key,attr2:key2"',
    });
    return keys;
  }
  for (const pair of pairs) {
    const idx = pair.indexOf(':');
    if (idx <= 0 || idx === pair.length - 1) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'malformed-annotation',
        file,
        line,
        message: `data-i18n-attr entry "${pair}" is not in "attr:key" form`,
      });
      continue;
    }
    const attr = pair.slice(0, idx).trim();
    const key = pair.slice(idx + 1).trim();
    if (!/^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(attr)) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'malformed-annotation',
        file,
        line,
        message: `data-i18n-attr has invalid attribute name "${attr}"`,
      });
      continue;
    }
    keys.push({ key, file, line, source: 'data-i18n-attr' });
  }
  return keys;
}

function scanHtml(text, file, problems) {
  const lines = buildLineIndex(text);
  const commentRanges = [];
  const commentRe = /<!--[\s\S]*?-->/g;
  let match;
  while ((match = commentRe.exec(text))) {
    commentRanges.push({ start: match.index, end: match.index + match[0].length });
  }
  const visible = blankRanges(text, commentRanges);

  if (/data-i18n-html/.test(visible)) {
    const idx = visible.indexOf('data-i18n-html');
    problems.push({
      severity: SEVERITY.problem,
      type: 'forbidden-data-i18n-html',
      file,
      line: lineOf(lines, idx),
      message:
        'data-i18n-html is forbidden (XSS-safe design); use data-i18n / data-i18n-attr or build text with t()',
    });
  }

  const keys = [];
  const attrRe = /data-i18n(-attr)?\s*=\s*("([^"]*)"|'([^']*)')/g;
  while ((match = attrRe.exec(visible))) {
    const isAttr = Boolean(match[1]);
    const raw = (match[3] !== undefined ? match[3] : match[4] || '').trim();
    const line = lineOf(lines, match.index);
    if (!isAttr) {
      if (!raw) {
        problems.push({
          severity: SEVERITY.problem,
          type: 'malformed-annotation',
          file,
          line,
          message: 'data-i18n is empty',
        });
        continue;
      }
      if (raw.includes(',')) {
        problems.push({
          severity: SEVERITY.problem,
          type: 'malformed-annotation',
          file,
          line,
          message:
            'data-i18n must contain one key; use data-i18n-attr for attributes',
        });
        continue;
      }
      if (!looksLikeKey(raw)) {
        problems.push({
          severity: SEVERITY.problem,
          type: 'invalid-key',
          file,
          line,
          message: `data-i18n value "${raw}" is not a flat dot-separated key`,
        });
        continue;
      }
      keys.push({ key: raw, file, line, source: 'data-i18n' });
    }
  }

  const attrRe2 = /data-i18n-attr\s*=\s*("([^"]*)"|'([^']*)')/g;
  while ((match = attrRe2.exec(visible))) {
    const raw = (match[2] !== undefined ? match[2] : match[3] || '').trim();
    const line = lineOf(lines, match.index);
    keys.push(...parseAnnotationAttrValue(raw, file, line, problems));
  }

  keys.push(...scanKeyAttributes(visible, file, lines));

  return keys;
}

/**
 * Dynamic copy-feedback bindings: `data-copy-label-key="footer.siteCopied"` and
 * `data-copy-fail-key="..."` (and any future `data-*-key` attribute) hold a flat
 * dictionary key in an attribute value, so the runtime can resolve the string
 * without inline text. Treat them as ordinary key references.
 */
function scanKeyAttributes(text, file, lines) {
  const keys = [];
  const re = /\bdata-[a-z0-9-]*key\s*=\s*(?:"([^"]*)"|'([^']*)'|\\"([^"\\]*)\\")/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!raw) continue;
    const line = lineOf(lines, match.index);
    if (looksLikeKey(raw)) {
      keys.push({ key: raw, file, line, source: 'data-*-key' });
    }
  }
  return keys;
}

function scanJs(text, file, problems) {
  const tokens = lexJs(text);
  const lines = buildLineIndex(text);
  // Code mask: literal text (strings, comments, template static parts, regexes)
  // is blanked; `${...}` template expressions stay as code so nested t() calls
  // are discovered.
  const codeMaskChars = text.split('');
  const blankRange = (start, end) => {
    for (let i = start; i < end; i += 1) {
      const ch = codeMaskChars[i];
      if (ch !== '\n' && ch !== '\r') codeMaskChars[i] = ' ';
    }
  };
  for (const token of tokens) {
    if (token.kind === 'code') continue;
    if (token.kind === 'template' && Array.isArray(token.exprRanges)) {
      let cursor = token.start;
      for (const range of token.exprRanges) {
        blankRange(cursor, range.start);
        cursor = range.end;
      }
      blankRange(cursor, token.end);
    } else {
      blankRange(token.start, token.end);
    }
  }
  const codeMask = codeMaskChars.join('');
  const commentsMask = blankRanges(
    text,
    tokens.filter((token) => token.kind === 'comment'),
  );

  const literalKeys = [];
  const annotationKeys = [];
  const candidateStringKeys = [];
  const dynamicPrefixes = [];
  const unresolved = [];

  // 1) References that look like complete dictionary keys (mapping tables etc.).
  for (const token of tokens) {
    if (token.kind === 'string') {
      const value = decodeJsString(token.value);
      if (looksLikeKey(value)) {
        candidateStringKeys.push({
          key: value,
          file,
          line: lineOf(lines, token.start),
          source: 'js-string',
        });
      }
    } else if (token.kind === 'template') {
      if (!token.value.includes('${')) {
        const value = decodeJsString(token.value);
        if (looksLikeKey(value)) {
          candidateStringKeys.push({
            key: value,
            file,
            line: lineOf(lines, token.start),
            source: 'js-string',
          });
        }
      } else {
        // String literals nested inside `${...}` expressions (e.g. a helper like
        // `${et('assistant.title')}`). The lexer treats template expressions as
        // code, so scan their raw source for flat key literals.
        for (const range of token.exprRanges || []) {
          const expr = text.slice(range.start, range.end);
          const literalRe = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
          let literal;
          while ((literal = literalRe.exec(expr))) {
            const value = decodeJsString(literal[2]);
            if (!looksLikeKey(value)) continue;
            candidateStringKeys.push({
              key: value,
              file,
              line: lineOf(lines, range.start + literal.index),
              source: 'js-template-literal',
            });
          }
        }
      }
    }
  }

  // 2) Template strings / string literals that embed data-i18n markup.
  const annotRe =
    /data-i18n(?:-attr)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\\"([^"\\]*)\\")/g;
  let annot;
  while ((annot = annotRe.exec(commentsMask))) {
    const marker = annot[0].slice(0, 16);
    const raw = (annot[1] ?? annot[2] ?? annot[3] ?? '').trim();
    const line = lineOf(lines, annot.index);
    if (marker.startsWith('data-i18n-attr')) {
      annotationKeys.push(...parseAnnotationAttrValue(raw, file, line, problems));
    } else if (!raw) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'malformed-annotation',
        file,
        line,
        message: 'embedded data-i18n is empty',
      });
    } else if (raw.includes(',') || !looksLikeKey(raw)) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'malformed-annotation',
        file,
        line,
        message: `embedded data-i18n value "${raw}" is not a single flat key`,
      });
    } else {
      annotationKeys.push({ key: raw, file, line, source: 'data-i18n' });
    }
  }
  annotationKeys.push(...scanKeyAttributes(commentsMask, file, lines));

  // 3) t('key') / t("key") / t(`key`) call sites.
  const callRe = /\bt\s*\(/g;
  let call;
  while ((call = callRe.exec(codeMask))) {
    const line = lineOf(lines, call.index);
    let pos = call.index + call[0].length;
    while (pos < text.length && /\s/.test(text[pos])) pos += 1;
    const quote = text[pos];

    if (quote === '"' || quote === "'") {
      const start = pos;
      let end = start + 1;
      while (end < text.length) {
        if (text[end] === '\\') {
          end += 2;
          continue;
        }
        end += 1;
        if (text[end - 1] === quote) break;
      }
      const raw = text.slice(start + 1, Math.max(start + 1, end - 1));
      const value = decodeJsString(raw);
      let after = end;
      while (after < text.length && /\s/.test(text[after])) after += 1;
      if (text[after] === '+') {
        if (looksLikePrefix(value)) {
          dynamicPrefixes.push({ prefix: value, file, line });
        } else {
          unresolved.push({
            file,
            line,
            message: `dynamic t() call with non-prefix literal "${value}"`,
          });
        }
      } else if (looksLikeKey(value)) {
        literalKeys.push({ key: value, file, line, source: 't()' });
      } else {
        problems.push({
          severity: SEVERITY.problem,
          type: 'invalid-key',
          file,
          line,
          message: `t() argument "${value}" is not a flat dot-separated key`,
        });
      }
      continue;
    }

    if (quote === '`') {
      const end = scanTemplate(text, pos);
      const raw = text.slice(pos + 1, Math.max(pos + 1, end - 1));
      const exprIdx = raw.indexOf('${');
      if (exprIdx === -1) {
        const value = decodeJsString(raw);
        if (looksLikeKey(value)) {
          literalKeys.push({ key: value, file, line, source: 't()' });
        } else if (value) {
          problems.push({
            severity: SEVERITY.problem,
            type: 'invalid-key',
            file,
            line,
            message: `t() template argument "${value}" is not a flat dot-separated key`,
          });
        }
      } else {
        const prefix = decodeJsString(raw.slice(0, exprIdx));
        if (looksLikePrefix(prefix)) {
          dynamicPrefixes.push({ prefix, file, line });
        } else {
          unresolved.push({
            file,
            line,
            message: `dynamic t() template without a static prefix: "${raw
              .slice(0, 60)
              .replace(/\s+/g, ' ')}"`,
          });
        }
      }
      continue;
    }

    // Ternary expressions such as t(open ? 'ui.a' : 'ui.b') still reference
    // literal keys; extract every flat key literal inside the call arguments.
    const parenEnd = findMatchingParen(text, call.index + call[0].length - 1);
    const spanEnd = parenEnd === -1 ? Math.min(call.index + 200, text.length) : parenEnd;
    const span = text.slice(call.index, spanEnd + 1);
    const literalRe = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
    let literal;
    let found = 0;
    while ((literal = literalRe.exec(span))) {
      const value = decodeJsString(literal[2]);
      if (looksLikeKey(value)) {
        literalKeys.push({ key: value, file, line, source: 't()-ternary' });
        found += 1;
      }
    }
    if (found === 0) {
      unresolved.push({
        file,
        line,
        message: `t() called with a non-literal argument: "${text
          .slice(call.index, Math.min(call.index + 70, text.length))
          .replace(/\s+/g, ' ')}"`,
      });
    }
  }

  const dedupedPrefixes = [];
  const seen = new Set();
  for (const item of dynamicPrefixes) {
    if (seen.has(item.prefix)) continue;
    seen.add(item.prefix);
    dedupedPrefixes.push(item);
  }

  return {
    literalKeys,
    annotationKeys,
    candidateStringKeys,
    dynamicPrefixes: dedupedPrefixes,
    unresolved,
  };
}

/* ------------------------------------------------------------------ */
/* Dictionary loading                                                  */
/* ------------------------------------------------------------------ */

function extractPlaceholders(value) {
  const found = new Set();
  let match;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(value))) {
    found.add(match[1] || match[2]);
  }
  return found;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function loadDictionary(file, root, problems, fatal) {
  const label = relPath(root, file);
  if (!fs.existsSync(file)) {
    fatal.push({
      type: 'missing-dictionary',
      message: `Dictionary not found: ${label}`,
    });
    return null;
  }
  let raw;
  try {
    raw = readText(file);
  } catch (error) {
    fatal.push({
      type: 'unreadable-dictionary',
      message: `Cannot read ${label}: ${error.message}`,
    });
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fatal.push({
      type: 'invalid-json',
      message: `${label} is not valid JSON: ${error.message}`,
    });
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fatal.push({
      type: 'invalid-dictionary',
      message: `${label} must contain a flat JSON object of key/value pairs`,
    });
    return null;
  }

  const map = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    if (!looksLikeKey(key)) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'invalid-key',
        file: label,
        message: `Dictionary key "${key}" is not a flat dot-separated key`,
      });
      continue;
    }
    if (typeof value !== 'string') {
      problems.push({
        severity: SEVERITY.problem,
        type: 'non-string-value',
        key,
        file: label,
        message: `Dictionary value for "${key}" must be a string (got ${Array.isArray(value) ? 'array' : typeof value}); nested objects are not allowed`,
      });
      continue;
    }
    map.set(key, value);
  }

  // Duplicate keys are silently collapsed by JSON.parse; detect them textually.
  const keyRe = /[{,]\s*"((?:[^"\\]|\\.)*)"\s*:/g;
  const counts = new Map();
  let match;
  while ((match = keyRe.exec(raw))) {
    const key = match[1];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, count] of counts) {
    if (count > 1) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'duplicate-key',
        key,
        file: label,
        message: `Key "${key}" appears ${count} times in ${label}`,
      });
    }
  }

  return { file: label, map };
}

/* ------------------------------------------------------------------ */
/* Main check                                                          */
/* ------------------------------------------------------------------ */

function runCheck(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const dictOnly = Boolean(options.dictOnly);
  const allowlistPath = options.allowlistPath || path.join(root, 'scripts', 'i18n-allowlist.json');

  const problems = [];
  const warnings = [];
  const notes = [];
  const fatal = [];

  const dictDir = path.join(root, 'site', 'assets', 'i18n');
  const zh = loadDictionary(path.join(dictDir, 'zh.json'), root, problems, fatal);
  const en = loadDictionary(path.join(dictDir, 'en.json'), root, problems, fatal);

  let allowlist = {
    allowedCjkSubstrings: [],
    allowedCjkKeys: [],
    manualDynamicPrefixes: [],
    ignoredUnusedKeys: [],
  };
  if (fs.existsSync(allowlistPath)) {
    try {
      const parsed = JSON.parse(readText(allowlistPath));
      allowlist = {
        ...allowlist,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
      };
    } catch (error) {
      fatal.push({
        type: 'invalid-allowlist',
        message: `Cannot parse ${relPath(root, allowlistPath)}: ${error.message}`,
      });
    }
  } else {
    notes.push(`Allowlist not found at ${relPath(root, allowlistPath)}; using empty allowlist.`);
  }

  const zhMap = zh ? zh.map : new Map();
  const enMap = en ? en.map : new Map();
  const dictKeys = new Set([...zhMap.keys(), ...enMap.keys()]);

  const references = new Map();
  const addReference = (key, ref) => {
    if (!references.has(key)) references.set(key, []);
    const list = references.get(key);
    if (list.some((item) => item.file === ref.file && item.line === ref.line)) return;
    list.push(ref);
  };

  let htmlFiles = [];
  let jsFiles = [];
  const dynamicPrefixes = [];

  if (!dictOnly) {
    const siteDir = path.join(root, 'site');
    htmlFiles = walkFiles(
      siteDir,
      (file) => file.endsWith('.html') && path.dirname(file) === siteDir,
    ).sort();
    jsFiles = walkFiles(
      path.join(siteDir, 'assets', 'js'),
      (file) => file.endsWith('.js') || file.endsWith('.mjs'),
    ).sort();

    for (const file of htmlFiles) {
      const label = relPath(root, file);
      const keys = scanHtml(readText(file), label, problems);
      for (const key of keys) addReference(key.key, key);
    }

    for (const file of jsFiles) {
      const label = relPath(root, file);
      const scan = scanJs(readText(file), label, problems);
      for (const item of [
        ...scan.literalKeys,
        ...scan.annotationKeys,
      ]) {
        addReference(item.key, item);
      }
      for (const item of scan.candidateStringKeys) {
        if (dictKeys.has(item.key)) addReference(item.key, item);
      }
      for (const item of scan.dynamicPrefixes) {
        dynamicPrefixes.push({ ...item, file: label });
      }
      for (const item of scan.unresolved) {
        // The engine itself legitimately calls t(dynamicKey) while applying the
        // DOM; those internal calls are covered by the data-i18n scan instead.
        if (label.endsWith('i18n.js')) continue;
        warnings.push({
          severity: SEVERITY.warning,
          type: 'unresolved-dynamic-t',
          file: item.file,
          line: item.line,
          message: item.message,
        });
      }
    }

    for (const prefix of allowlist.manualDynamicPrefixes || []) {
      if (typeof prefix === 'string' && prefix.length > 0) {
        dynamicPrefixes.push({
          prefix,
          file: 'scripts/i18n-allowlist.json',
          line: 0,
        });
      }
    }

    if (references.size === 0) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'no-annotations',
        message:
          'No i18n annotations found in site/ (expected data-i18n / data-i18n-attr / t() usages). Use --dict-only to validate dictionaries before the front end is annotated.',
      });
    }
  }

  const usedKeys = new Set(references.keys());
  const ignoredUnused = new Set(
    Array.isArray(allowlist.ignoredUnusedKeys) ? allowlist.ignoredUnusedKeys : [],
  );

  const dynamicCoveredKeys = new Set();
  for (const prefix of dynamicPrefixes) {
    let covered = 0;
    for (const key of dictKeys) {
      if (key.startsWith(prefix.prefix)) {
        dynamicCoveredKeys.add(key);
        covered += 1;
      }
    }
    if (covered === 0) {
      warnings.push({
        severity: SEVERITY.warning,
        type: 'dynamic-prefix-unmatched',
        file: prefix.file,
        line: prefix.line || undefined,
        message: `Dynamic prefix "${prefix.prefix}" does not match any dictionary key`,
      });
    }
  }

  // --- Key presence / key-set consistency -------------------------------
  const allKeys = new Set([...dictKeys, ...usedKeys]);
  for (const key of [...allKeys].sort()) {
    const inZh = zhMap.has(key);
    const inEn = enMap.has(key);
    const refs = references.get(key) || [];
    if (!inZh) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'missing-in-zh',
        key,
        file: refs.length ? refs[0].file : relPath(root, path.join(dictDir, 'zh.json')),
        line: refs.length ? refs[0].line : undefined,
        message: refs.length
          ? `Key "${key}" is referenced (${refs[0].file}:${refs[0].line}) but missing from zh.json`
          : `Key "${key}" exists in en.json but not in zh.json`,
      });
    }
    if (!inEn) {
      problems.push({
        severity: SEVERITY.problem,
        type: 'missing-in-en',
        key,
        file: refs.length ? refs[0].file : relPath(root, path.join(dictDir, 'en.json')),
        line: refs.length ? refs[0].line : undefined,
        message: refs.length
          ? `Key "${key}" is referenced (${refs[0].file}:${refs[0].line}) but missing from en.json`
          : `Key "${key}" exists in zh.json but not in en.json`,
      });
    }
  }

  // --- Unused keys (warning by default; --strict-unused promotes to error) ---
  if (!dictOnly) {
    for (const key of [...zhMap.keys()].sort()) {
      if (usedKeys.has(key) || dynamicCoveredKeys.has(key) || ignoredUnused.has(key)) {
        continue;
      }
      warnings.push({
        severity: SEVERITY.warning,
        type: 'unused-key',
        key,
        file: relPath(root, path.join(dictDir, 'zh.json')),
        message: `Key "${key}" is defined but never referenced by the site (remove it, or add it to allowlist.ignoredUnusedKeys with a reason)`,
      });
    }
  }

  // --- Content checks ---------------------------------------------------
  const checkCjkResidue = (value) => {
    let stripped = value;
    for (const allowed of allowlist.allowedCjkSubstrings || []) {
      if (typeof allowed === 'string' && allowed.length > 0) {
        stripped = stripped.split(allowed).join('');
      }
    }
    return {
      han: HAN_RE.test(stripped),
      punct: CJK_PUNCT_RE.test(stripped),
      stripped,
    };
  };

  for (const [key, zhValue] of zhMap) {
    if (zhValue.trim() === '') {
      problems.push({
        severity: SEVERITY.problem,
        type: 'empty-value',
        key,
        file: zh.file,
        message: `zh.json value for "${key}" is empty`,
      });
    }
  }

  const allowedCjkKeys = new Set(
    Array.isArray(allowlist.allowedCjkKeys) ? allowlist.allowedCjkKeys : [],
  );

  for (const [key, enValue] of enMap) {
    if (enValue.trim() === '') {
      problems.push({
        severity: SEVERITY.problem,
        type: 'empty-value',
        key,
        file: en.file,
        message: `en.json value for "${key}" is empty`,
      });
      continue;
    }
    if (!allowedCjkKeys.has(key)) {
      const residue = checkCjkResidue(enValue);
      if (residue.han || residue.punct) {
        const kind = residue.han ? 'Chinese characters' : 'CJK punctuation';
        problems.push({
          severity: SEVERITY.problem,
          type: 'en-cjk-residue',
          key,
          file: en.file,
          message: `en.json value for "${key}" contains ${kind}: "${enValue}" (add proper nouns to allowlist.allowedCjkSubstrings or translate)`,
        });
      }
    }
    if (enValue !== enValue.trim()) {
      warnings.push({
        severity: SEVERITY.warning,
        type: 'en-value-whitespace',
        key,
        file: en.file,
        message: `en.json value for "${key}" has leading/trailing whitespace`,
      });
    }
    const zhValue = zhMap.get(key);
    if (typeof zhValue === 'string' && zhValue.trim() !== '') {
      const zhPlaceholders = extractPlaceholders(zhValue);
      const enPlaceholders = extractPlaceholders(enValue);
      if (!sameSet(zhPlaceholders, enPlaceholders)) {
        problems.push({
          severity: SEVERITY.problem,
          type: 'placeholder-mismatch',
          key,
          file: en.file,
          message: `Placeholders differ for "${key}": zh has {${[...zhPlaceholders].sort().join(', ')}} but en has {${[...enPlaceholders].sort().join(', ')}}`,
        });
      }
    }
  }

  const stats = {
    root,
    mode: dictOnly ? 'dictionary-only' : 'full',
    htmlFiles: htmlFiles.length,
    jsFiles: jsFiles.length,
    zhKeys: zhMap.size,
    enKeys: enMap.size,
    usedKeys: usedKeys.size,
    referencedKeys: references.size,
    dynamicPrefixes: dynamicPrefixes.map((item) => item.prefix),
    dynamicCoveredKeys: dynamicCoveredKeys.size,
    dictionaryPresent: Boolean(zh && en),
  };

  return {
    ok: fatal.length === 0 && problems.length === 0,
    stats,
    problems,
    warnings,
    notes,
    fatal,
    // Internal access for tooling/tests: key -> [{file, line, source}].
    references,
  };
}

/* ------------------------------------------------------------------ */
/* Report rendering                                                    */
/* ------------------------------------------------------------------ */

function formatReport(report, { strict = false, strictUnused = false } = {}) {
  const out = [];
  out.push('AI Pulse · i18n check');
  out.push(`Root       : ${report.stats.root}`);
  out.push(`Mode       : ${report.stats.mode}${strict ? ' (strict)' : ''}`);
  if (report.stats.dictionaryPresent) {
    out.push(
      `Dictionaries: zh.json ${report.stats.zhKeys} keys · en.json ${report.stats.enKeys} keys`,
    );
  }
  if (report.stats.mode === 'full') {
    out.push(
      `Site scan  : ${report.stats.htmlFiles} HTML files · ${report.stats.jsFiles} JS files · ${report.stats.referencedKeys} referenced keys`,
    );
    const prefixes = report.stats.dynamicPrefixes;
    out.push(
      `Dynamic    : ${prefixes.length ? prefixes.join(', ') : 'none'} (${report.stats.dynamicCoveredKeys} keys covered)`,
    );
  }
  for (const note of report.notes) out.push(`Note       : ${note}`);

  const sortedProblems = [...report.problems].sort(
    (a, b) =>
      String(a.type).localeCompare(String(b.type)) ||
      String(a.key || '').localeCompare(String(b.key || '')),
  );
  if (sortedProblems.length) {
    out.push('');
    out.push(`Errors (${sortedProblems.length}):`);
    for (const problem of sortedProblems) {
      const location =
        problem.file && problem.line
          ? ` — ${problem.file}:${problem.line}`
          : problem.file
            ? ` — ${problem.file}`
            : '';
      out.push(`  [${problem.type}] ${problem.message || problem.key}${location}`);
    }
  }

  if (report.warnings.length) {
    out.push('');
    out.push(`Warnings (${report.warnings.length}):`);
    for (const warning of report.warnings) {
      const location =
        warning.file && warning.line
          ? ` — ${warning.file}:${warning.line}`
          : warning.file
            ? ` — ${warning.file}`
            : '';
      out.push(`  [${warning.type}] ${warning.message}${location}`);
    }
  }

  if (report.fatal.length) {
    out.push('');
    out.push(`Fatal (${report.fatal.length}):`);
    for (const fatal of report.fatal) out.push(`  [${fatal.type}] ${fatal.message}`);
  }

  out.push('');
  if (report.fatal.length) {
    out.push('Result: FAIL (fatal error)');
  } else if (report.problems.length === 0) {
    out.push(
      `Result: PASS — 0 errors, ${report.warnings.length} warning(s)${
        report.stats.mode === 'full' ? ` · ${report.stats.usedKeys} used keys` : ''
      }${strictUnused && report.warnings.some((item) => item.type === 'unused-key') ? ' · strict-unused: FAIL' : ''}`,
    );
  } else if (strict) {
    out.push(`Result: FAIL — ${report.problems.length} error(s), ${report.warnings.length} warning(s), strict mode`);
  } else {
    out.push(
      `Result: ${report.problems.length} error(s), ${report.warnings.length} warning(s) (advisory run; use --strict to fail on errors)`,
    );
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Self test                                                           */
/* ------------------------------------------------------------------ */

function writeFileDeep(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function createFixture(root, variant) {
  const dictDir = path.join(root, 'site', 'assets', 'i18n');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });

  const ok = variant === 'ok';
  const zh = {
    'nav.home': '首页',
    'nav.news': '动态',
    'home.title': '首页标题',
    'home.lede': '欢迎，{name}',
    'news.search.placeholder': '搜索动态',
    'page.index.title': '首页',
    'page.index.desc': '首页描述',
    'page.news.title': '动态',
    'page.news.desc': '动态描述',
    'board.demo.name': '示例榜单',
    'board.demo.desc': '示例描述',
    'ui.theme.ivory.label': '纸墨雅金',
    'share.copy': '复制链接',
    'assistant.greeting': '你好 {name}，我能帮你什么？',
  };
  const en = {
    'nav.home': 'Home',
    'nav.news': ok ? 'News' : '动态',
    'home.title': 'Home title',
    'home.lede': ok ? 'Welcome, {name}' : 'Welcome there',
    'news.search.placeholder': 'Search news',
    'page.index.title': 'Home',
    'page.index.desc': 'Home description',
    'page.news.title': 'News',
    'page.news.desc': 'News description',
    'board.demo.name': 'Demo leaderboard',
    'board.demo.desc': 'Demo description',
    'ui.theme.ivory.label': 'Ivory',
    'share.copy': 'Copy link',
    'assistant.greeting': 'Hello {name}, how can I help?',
  };
  if (!ok) {
    en['extra.only.in.en'] = 'Extra';
    delete en['page.index.desc'];
  }
  if (!ok) {
    // Inject an empty value and a duplicate key to exercise those checks.
    zh['nav.empty'] = ' ';
  }
  let zhText = JSON.stringify(zh, null, 2);
  if (!ok) {
    zhText = zhText.replace(
      '"nav.home": "首页",',
      '"nav.home": "首页",\n  "nav.home": "首页（重复）",',
    );
  }
  writeFileDeep(path.join(dictDir, 'zh.json'), `${zhText}\n`);
  writeFileDeep(
    path.join(dictDir, 'en.json'),
    `${JSON.stringify(en, null, 2)}\n`,
  );

  writeFileDeep(
    path.join(root, 'scripts', 'i18n-allowlist.json'),
    `${JSON.stringify(
      {
        version: 1,
        allowedCjkSubstrings: ['照胆云'],
        allowedCjkKeys: [],
        manualDynamicPrefixes: [],
        ignoredUnusedKeys: [],
      },
      null,
      2,
    )}\n`,
  );

  const html = ok
    ? `<!doctype html>
<html lang="zh-CN">
<head><title data-i18n="page.index.title">首页</title></head>
<body>
  <nav><a data-i18n="nav.home" href="index.html">首页</a><a data-i18n="nav.news" href="news.html">动态</a></nav>
  <h1 data-i18n="home.title">首页标题</h1>
  <input data-i18n-attr="placeholder:news.search.placeholder,title:nav.news">
  <button data-i18n="share.copy">复制链接</button>
  <button data-copy-label-key="share.copy">copy</button>
  <a data-i18n-attr="title:ui.theme.ivory.label" href="#">纸墨雅金</a>
  <span data-i18n="home.lede">欢迎</span>
  <span data-i18n="assistant.greeting">你好</span>
</body>
</html>
`
    : `<!doctype html>
<html lang="zh-CN">
<head><title data-i18n="page.index.title">首页</title></head>
<body>
  <nav><a data-i18n="nav.home" href="index.html">首页</a><a data-i18n="nav.news" href="news.html">动态</a></nav>
  <h1 data-i18n="home.title">首页标题</h1>
  <input data-i18n-attr="placeholder:news.search.placeholder,title:nav.news">
  <p data-i18n-html="home.title">x</p>
  <span data-i18n="nav.missing">缺</span>
  <span data-i18n-attr="broken-attr">bad</span>
  <span data-i18n-attr="title:ui.theme.ivory.label">纸墨雅金</span>
</body>
</html>
`;
  writeFileDeep(path.join(root, 'site', 'index.html'), html);

  const js = ok
    ? `// i18n usage in JS — t('fake.key') inside comments is ignored
const IGNORED = "t('string.only') inside a string is ignored";
const PAGE_META = {
  index: { title: 'page.index.title', desc: 'page.index.desc' },
  news: { title: 'page.news.title', desc: 'page.news.desc' },
};
const BOARD_NAME_KEYS = { demo: 'board.demo.name' };
const BOARD_DESC_KEYS = { demo: 'board.demo.desc' };

export function boot(t, page, id) {
  t('home.title');
  t("share.copy");
  t(\`ui.theme.ivory.label\`);
  t('page.' + page + '.title');
  t(\`board.\${id}.name\`);
  const et = (key) => esc(t(key));
  const embedded = \`\${et('home.lede')}\`;
  return { PAGE_META, BOARD_NAME_KEYS, BOARD_DESC_KEYS, IGNORED, embedded };
}
`
    : `// t('fake.key') in a comment is ignored
const IGNORED = "t('string.only') in a string is ignored";
const PAGE_META = {
  index: { title: 'page.index.title', desc: 'page.index.desc' },
};
export function boot(t, page) {
  t('home.title');
  t('page.' + page + '.title');
  t(dynamicKey);
  return { PAGE_META, IGNORED };
}
`;
  writeFileDeep(path.join(root, 'site', 'assets', 'js', 'app.js'), js);
}

function runSelfTest() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'aipulse-i18n-'));
  const results = [];
  const expect = (condition, label) => {
    results.push({ ok: Boolean(condition), label });
    if (!condition) console.error(`  FAIL: ${label}`);
  };

  try {
    createFixture(base, 'broken');
    const broken = runCheck({ root: base });
    const types = new Set(broken.problems.map((item) => item.type));
    expect(types.has('missing-in-en'), 'detects a key missing from en.json');
    expect(types.has('missing-in-zh'), 'detects a key only present in en.json');
    expect(types.has('empty-value'), 'detects an empty dictionary value');
    expect(types.has('en-cjk-residue'), 'detects Chinese residue in en.json');
    expect(types.has('placeholder-mismatch'), 'detects mismatched {placeholders}');
    expect(
      broken.warnings.some((item) => item.type === 'unused-key'),
      'reports stale dictionary keys as warnings (not hard errors)',
    );
    expect(types.has('forbidden-data-i18n-html'), 'rejects data-i18n-html');
    expect(types.has('malformed-annotation'), 'detects malformed data-i18n-attr');
    expect(types.has('duplicate-key'), 'detects duplicate JSON keys');
    expect(
      broken.warnings.some((item) => item.type === 'unresolved-dynamic-t'),
      'warns about unresolvable dynamic t() calls',
    );
    expect(broken.fatal.length === 0, 'broken fixture is not fatal');
    expect(!broken.ok, 'broken fixture reports not ok');

    createFixture(base, 'ok');
    const good = runCheck({ root: base });
    expect(good.fatal.length === 0, 'ok fixture has no fatal errors');
    expect(good.problems.length === 0, `ok fixture has no problems (${good.problems.length})`);
    expect(good.stats.usedKeys >= 10, 'ok fixture references >= 10 keys');
    expect(
      good.references.has('share.copy') &&
        good.references.get('share.copy').some((ref) => ref.source === 'data-*-key'),
      'discovers dynamic key references bound through data-*-key attributes',
    );
    expect(
      good.references.has('home.lede') &&
        good.references
          .get('home.lede')
          .some((ref) => ref.source === 'js-template-literal'),
      'discovers key literals inside template literal expressions (wrapped helpers)',
    );
    expect(
      good.stats.dynamicPrefixes.includes('page.') &&
        good.stats.dynamicPrefixes.includes('board.'),
      'ok fixture extracts dynamic key prefixes',
    );
  } catch (error) {
    results.push({ ok: false, label: `self-test crashed: ${error.message}` });
    console.error(error);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }

  const failed = results.filter((item) => !item.ok);
  for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`);
  console.log('');
  console.log(
    failed.length === 0
      ? `Self-test: PASS (${results.length} assertions)`
      : `Self-test: FAIL (${failed.length}/${results.length} assertions failed)`,
  );
  return failed.length === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    strict: false,
    strictUnused: false,
    json: false,
    dictOnly: false,
    selfTest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--strict':
        options.strict = true;
        break;
      case '--strict-unused':
        options.strictUnused = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--dict-only':
        options.dictOnly = true;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--root': {
        i += 1;
        if (i >= argv.length) throw new Error('--root requires a directory argument');
        options.root = path.resolve(argv[i]);
        break;
      }
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/check-i18n.mjs [options]',
      '',
      'Options:',
      '  --strict          Exit with code 1 on hard errors (missing/extra keys between',
      '                    dictionaries, empty values, Chinese residue in en.json,',
      '                    invalid annotations, placeholder mismatches). Warnings',
      '                    (stale unused keys, unresolved dynamic t() calls) do not fail.',
      '  --strict-unused   Additionally fail on unused dictionary keys (CI tightening).',
      '  --json            Print a machine-readable JSON report instead of text.',
      '  --dict-only       Validate zh/en dictionaries only (skip the site scan).',
      '  --root <dir>      Project root to check (default: repository root).',
      '  --self-test       Run built-in fixtures to verify the checker itself.',
      '  -h, --help        Show this help.',
      '',
      'Exit codes: 0 = pass/advisory, 1 = errors in strict mode or fatal error,',
      '            2 = invalid usage.',
    ].join('\n'),
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`check-i18n: ${error.message}`);
    console.error('Run with --help for usage.');
    process.exit(2);
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }
  if (options.selfTest) {
    process.exit(runSelfTest());
    return;
  }

  const report = runCheck(options);
  if (options.json) {
    const payload = {
      ok: report.ok,
      strict: options.strict,
      strictUnused: options.strictUnused,
      summary: {
        errors: report.problems.length,
        warnings: report.warnings.length,
        fatal: report.fatal.length,
        unusedKeys: report.warnings.filter((item) => item.type === 'unused-key').length,
      },
      stats: report.stats,
      problems: report.problems,
      warnings: report.warnings,
      notes: report.notes,
      fatal: report.fatal,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatReport(report, { strict: options.strict, strictUnused: options.strictUnused }));
  }

  if (report.fatal.length > 0) process.exit(1);
  if (options.strict && report.problems.length > 0) process.exit(1);
  if (
    options.strictUnused &&
    report.warnings.some((item) => item.type === 'unused-key')
  ) {
    process.exit(1);
  }
}

// Shared helpers, also imported by scripts/check-comments.mjs.
export {
  HAN_RE,
  CJK_PUNCT_RE,
  KEY_RE,
  buildLineIndex,
  decodeJsString,
  lexJs,
  lineOf,
  readText,
  relPath,
  runCheck,
  scanHtml,
  scanJs,
  walkFiles,
  formatReport,
  runSelfTest,
};

// Guard the CLI entry point so the module can also be imported by tests and by
// the code-comment checker (scripts/check-comments.mjs).
const ENTRY = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (ENTRY === fileURLToPath(import.meta.url)) main();
