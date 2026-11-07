/**
 * normalize.mjs — pure normalization functions for the collection layer (no I/O, unit-testable).
 * Inputs are raw source responses (JSON/CSV/XML/HTML strings); outputs strictly follow
 * DATA-CONTRACT v1. No function may access the network; the now value is injected by the caller so
 * that identical inputs plus the same now value always produce identical output.
 */
import { inflateRawSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const SITE = { name: 'AI Pulse', brand: '照胆云', version: '1.0.0' };
export const LIMITS = {
  summary: 240, // Contract: summary <= 240 characters
  description: 120, // Contract: model description <= 120 characters
  modelNews: 30,
  modelNewsDays: 45,
  rssPerFeed: 8,
};
export const NEWS_KINDS = ['release', 'benchmark', 'oss', 'pricing', 'research', 'policy'];

export const ORG_BY_PROVIDER = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', 'meta-llama': 'Meta', meta: 'Meta',
  mistralai: 'Mistral AI', mistral: 'Mistral AI', deepseek: 'DeepSeek', qwen: 'Alibaba', alibaba: 'Alibaba',
  'x-ai': 'xAI', xai: 'xAI', 'z-ai': 'Z.ai', zhipu: 'Z.ai', moonshotai: 'Moonshot AI', minimax: 'MiniMax',
  nvidia: 'NVIDIA', cohere: 'Cohere', perplexity: 'Perplexity', amazon: 'Amazon', microsoft: 'Microsoft',
  bytedance: 'ByteDance', baidu: 'Baidu', ai21: 'AI21 Labs', nousresearch: 'Nous Research', gryphe: 'Gryphe',
  liquid: 'Liquid AI', allenai: 'Allen AI', inclusionai: 'InclusionAI', stepfun: 'StepFun', xiaomi: 'Xiaomi',
  tencent: 'Tencent', thudm: 'Zhipu AI', '01-ai': '01.AI', tngtech: 'TNG Technology', cognitivecomputations: 'Cognitive Computations',
  openrouter: 'OpenRouter', 'arcee-ai': 'Arcee AI', upstage: 'Upstage', naver: 'NAVER', reka: 'Reka AI',
  inflection: 'Inflection', databricks: 'Databricks', ibm: 'IBM', ai2: 'AI2', aisingapore: 'AI Singapore',
  'inclusion-ai': 'InclusionAI', agentica: 'Agentica', arliai: 'ArliAI', featherless: 'Featherless',
};
// Provider inference when a LiveBench / LMArena leaderboard only has model slugs
export const ORG_BY_SLUG_PREFIX = {
  claude: 'Anthropic', sonnet: 'Anthropic', opus: 'Anthropic', haiku: 'Anthropic', fable: 'Anthropic',
  gpt: 'OpenAI', codex: 'OpenAI', o1: 'OpenAI', o3: 'OpenAI', o4: 'OpenAI', chatgpt: 'OpenAI',
  gemini: 'Google', gemma: 'Google', palm: 'Google',
  deepseek: 'DeepSeek', qwen: 'Alibaba', quasar: 'Alibaba', glm: 'Z.ai', chatglm: 'Z.ai',
  kimi: 'Moonshot AI', moonshot: 'Moonshot AI', minimax: 'MiniMax', abab: 'MiniMax',
  grok: 'xAI', llama: 'Meta', mistral: 'Mistral AI', mixtral: 'Mistral AI', codestral: 'Mistral AI',
  step: 'StepFun', mimo: 'Xiaomi', hunyuan: 'Tencent', ernie: 'Baidu', doubao: 'ByteDance', seed: 'ByteDance',
  command: 'Cohere', jamba: 'AI21 Labs', nemotron: 'NVIDIA', phi: 'Microsoft', reka: 'Reka AI',
  inkling: 'Thinking Machines Lab', beam: 'Beam', composer: 'Cursor',
};
const MODALITY_ORDER = ['text', 'image', 'audio', 'video'];
const MODALITY_SET = new Set(MODALITY_ORDER);

// ---------------------------------------------------------------------------
// Generic helpers (pure functions)
// ---------------------------------------------------------------------------
export function clampText(s, max, { ellipsis = '…' } = {}) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, Math.max(1, max - ellipsis.length)).trimEnd() + ellipsis;
}

export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Plain-text cleaning (prevents RSS/source HTML leakage, including tags produced by
 * double-decoded entities): alternate tag stripping and entity decoding for at most
 * three rounds, then collapse whitespace and truncate. title/summary/description all
 * go through this helper.
 */
export function plainText(s, max = 0) {
  let t = String(s ?? '').replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '');
  for (let i = 0; i < 3; i++) {
    const next = decodeEntities(stripHtml(t));
    if (next === t) break;
    t = next;
  }
  t = t
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '') // Zero-width / direction control characters
    .replace(/\s+/g, ' ')
    .trim();
  return max > 0 ? clampText(t, max) : t;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#34': '"', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

/**
 * Decode HTML entities safely. Numeric entities are validated before conversion:
 * out-of-range code points (> 0x10FFFF), zero/negative values and surrogate code points
 * (0xD800-0xDFFF) are left as the original entity text instead of throwing RangeError.
 * This is a security boundary: hostile RSS/HTML must never crash the pipeline.
 */
export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (m, k) => {
      if (k[0] === '#') {
        const code = k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        const isValidCodePoint = Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
        return isValidCodePoint ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[k.toLowerCase()] ?? m;
    })
    .replace(/\u00a0/g, ' ');
}

// ---------------------------------------------------------------------------
// External URL hygiene (security: no plain http:// outbound links in generated data)
// ---------------------------------------------------------------------------
/** Hosts known to serve HTTPS; used only for deterministic http -> https upgrades (no network I/O). */
export const HTTPS_KNOWN_HOSTS = new Set([
  'arxiv.org', 'bair.berkeley.edu', 'blog.google', 'cookbook.openai.com', 'deepmind.google',
  'docs.anthropic.com', 'github.com', 'huggingface.co', 'jalammar.github.io', 'karpathy.ai',
  'lilianweng.github.io', 'modelcontextprotocol.io', 'news.mit.edu', 'openai.com',
  'qwenlm.github.io', 'web.stanford.edu', 'www.anthropic.com', 'www.promptingguide.ai',
  'aws.amazon.com', 'zh.d2l.ai',
]);

/** Lowercase hostname of a http(s) URL, or null when unparseable. */
export function hostnameOf(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Upgrade an http:// link to https:// only when that is provably safe offline:
 * - same host as an HTTPS page/feed URL (same-origin evidence), or
 * - host in the known-HTTPS allowlist.
 * Unknown hosts are returned unchanged so the caller can record a warning (never rewrite blindly).
 */
export function upgradeExternalUrl(url, { pageUrl = null, httpsHosts = HTTPS_KNOWN_HOSTS } = {}) {
  if (typeof url !== 'string' || !/^http:\/\//i.test(url)) return url;
  const host = hostnameOf(url);
  if (!host) return url;
  if (pageUrl && /^https:/i.test(pageUrl) && hostnameOf(pageUrl) === host) return `https://${url.slice('http://'.length)}`;
  if (httpsHosts.has(host)) return `https://${url.slice('http://'.length)}`;
  return url;
}

/** URL/title -> stable ASCII slug (keep alphanumerics, fold everything else to -) */
export function slugify(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80) || 'item';
}

/** Simple stable short hash (FNV-1a 32-bit, hex) for entries without a natural id, such as RSS */
export function shortHash(s) {
  let h = 0x811c9dc5;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function toIsoDateTime(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Treat 10-digit values as second-level timestamps
    const ms = v > 1e12 ? v : v * 1000;
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function toIsoDateOnly(v) {
  const iso = toIsoDateTime(v);
  return iso ? iso.slice(0, 10) : null;
}

/** Price string (USD / token) -> USD / 1M tokens; returns null for invalid input */
export function pricePerMillion(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1e6 * 1e6) / 1e6;
}

export function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '免费';
  const s = n >= 1 ? n.toFixed(2) : n >= 0.01 ? n.toFixed(3) : n.toFixed(4);
  return '$' + s.replace(/0+$/, '').replace(/\.$/, '');
}

export function fmtTokens(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${+(n / 1000).toFixed(0)}K`;
  return String(n);
}

/** Minimal RFC4180 CSV parser (quotes, doubled-quote escapes, CRLF) */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/** CSV -> array of objects (the first row is the header) */
export function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 1) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Minimal ZIP reader (store/deflate, enough for the official benchmark_data.zip); returns [{name, data:Buffer}] */
export function unzip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP: EOCD not found');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('ZIP: bad central directory');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    off += 46 + nameLen + extraLen + commentLen;
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataOff, dataOff + compSize);
    const data = method === 0 ? Buffer.from(comp) : inflateRawSync(comp);
    out.push({ name, data });
  }
  return out;
}

// ---------------------------------------------------------------------------
// OpenRouter model catalog -> data/models.json
// ---------------------------------------------------------------------------
function orgFromOpenRouter(m) {
  const name = String(m.name || '');
  const idx = name.indexOf(': ');
  if (idx > 0) return name.slice(0, idx).trim();
  const provider = String(m.id || '').split('/')[0];
  return ORG_BY_PROVIDER[provider] || provider.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayNameFromOpenRouter(m) {
  const name = String(m.name || '').trim();
  const idx = name.indexOf(': ');
  return idx >= 0 ? name.slice(idx + 2).trim() : name;
}

function inferCapabilities(m) {
  const caps = new Set();
  const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
  if (params.includes('tools') || params.includes('tool_choice')) caps.add('tool-calling');
  if (params.includes('structured_outputs') || params.includes('response_format')) caps.add('structured-output');
  if (params.includes('reasoning') || params.includes('include_reasoning') || m.reasoning === true) caps.add('reasoning');
  const arch = m.architecture || {};
  const mods = [...(arch.input_modalities || []), ...(arch.output_modalities || [])];
  if (mods.includes('image')) caps.add('vision');
  if (mods.includes('audio')) caps.add('audio');
  if (mods.includes('video')) caps.add('video');
  return [...caps].sort();
}

function modalitiesFromOpenRouter(m) {
  const arch = m.architecture || {};
  const mods = new Set();
  for (const mod of [...(arch.input_modalities || []), ...(arch.output_modalities || [])]) {
    if (MODALITY_SET.has(mod)) mods.add(mod);
  }
  if (mods.size === 0) mods.add('text');
  return MODALITY_ORDER.filter((x) => mods.has(x));
}

/** OpenRouter /api/v1/models response -> contract model array (sorted by id, stable) */
export function normalizeOpenRouterModels(payload) {  const raw = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(raw)) throw new Error('OpenRouter: 响应缺少 data 数组');
  const seen = new Set();
  const models = [];
  for (const m of raw) {
    if (!m || typeof m.id !== 'string' || !m.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const prompt = pricePerMillion(m.pricing?.prompt);
    const completion = pricePerMillion(m.pricing?.completion);
    const pricing = prompt !== null || completion !== null
      ? { input: prompt, output: completion, currency: 'USD', unit: 'per_1m_tokens' }
      : null;
    const hf = m.hugging_face_id ? String(m.hugging_face_id) : null;
    const contextWindow = Number.isInteger(m.context_length) && m.context_length > 0 ? m.context_length : null;
    const maxOutput = Number.isInteger(m.top_provider?.max_completion_tokens) && m.top_provider.max_completion_tokens > 0
      ? m.top_provider.max_completion_tokens : null;
    models.push({
      id: m.id,
      name: String(m.name || m.id).trim(),
      org: orgFromOpenRouter(m),
      releaseDate: toIsoDateOnly(m.created),
      contextWindow,
      maxOutput,
      modalities: modalitiesFromOpenRouter(m),
      capabilities: inferCapabilities(m),
      openWeights: Boolean(hf),
      license: null,
      pricing,
      links: {
        official: null,
        api: `https://openrouter.ai/${m.id}`,
        hf: hf ? `https://huggingface.co/${hf}` : null,
      },
      description: m.description ? plainText(m.description, LIMITS.description) : null,
      sourceIds: ['openrouter'],
      benchmarks: null,
    });
  }
  models.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return models;
}

// ---------------------------------------------------------------------------
// OpenRouter model -> release update (data/news.json, kind "release")
// ---------------------------------------------------------------------------
export function buildNewsFromModels(models, { now, days = LIMITS.modelNewsDays, maxItems = LIMITS.modelNews } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const cutoff = nowMs - days * 86400e3;
  const candidates = models
    .filter((m) => m.releaseDate && Date.parse(m.releaseDate + 'T00:00:00.000Z') <= nowMs + 86400e3)
    .sort((a, b) => (a.releaseDate === b.releaseDate ? (a.id < b.id ? -1 : 1) : a.releaseDate < b.releaseDate ? 1 : -1))
    .filter((m) => Date.parse(m.releaseDate + 'T00:00:00.000Z') >= cutoff)
    .slice(0, maxItems);
  return candidates.map((m) => {
    const releaseMs = Date.parse(m.releaseDate + 'T00:00:00.000Z');
    const ageDays = (nowMs - releaseMs) / 86400e3;
    const short = displayNameFromOpenRouter({ name: m.name, id: m.id });
    const tags = new Set([m.org]);
    if (m.contextWindow && m.contextWindow >= 200000) tags.add('长上下文');
    if (m.modalities.length > 1) tags.add('多模态');
    if (m.capabilities.includes('reasoning')) tags.add('推理');
    if (m.openWeights) tags.add('开源权重');
    if (m.pricing?.input === 0 && m.pricing?.output === 0) tags.add('免费');
    const priceText = m.pricing ? `${fmtMoney(m.pricing.input)}/${fmtMoney(m.pricing.output)} 每百万 tokens` : '定价未公开';
    const capText = m.capabilities.length ? `，支持 ${m.capabilities.join('/')}` : '';
    return {
      id: `release-${slugify(m.id)}`,
      title: `${m.org} 上新：${short}（上下文 ${fmtTokens(m.contextWindow)}，${m.pricing ? `${fmtMoney(m.pricing.input)}/${fmtMoney(m.pricing.output)}` : '价格未公开'}）`,
      summary: clampText(
        `${m.name} 进入 OpenRouter 目录：上下文 ${fmtTokens(m.contextWindow)}，${priceText}${capText}。`,
        LIMITS.summary
      ),
      kind: 'release',
      sourceName: 'OpenRouter',
      sourceUrl: 'https://openrouter.ai/models',
      url: m.links?.api || 'https://openrouter.ai/models',
      publishedAt: `${m.releaseDate}T00:00:00.000Z`,
      tags: [...tags],
      models: [m.id],
      importance: ageDays <= 7 ? 3 : ageDays <= 21 ? 2 : 1,
      lang: 'zh',
    };
  });
}

// ---------------------------------------------------------------------------
// LiveBench 2.0 -> leaderboard
// ---------------------------------------------------------------------------
export function prettifyModelName(slug) {
  const tokens = String(slug || '').split(/[-_]/).filter(Boolean);
  const out = [];
  const known = ['gpt', 'glm', 'kimi', 'qwen', 'deepseek', 'claude', 'gemini', 'llama', 'grok', 'mistral', 'chatglm', 'mixtral', 'codestral', 'jamba', 'nemotron', 'hunyuan', 'ernie', 'doubao', 'step', 'mimo', 'seed', 'inkling', 'composer', 'beam'];
  let prevWasNum = false;
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const isNum = /^\d+(\.\d+)*$/.test(raw);
    const low = raw.toLowerCase();
    if (isNum && i > 0) {
      const prev = out[out.length - 1] || '';
      const prevLow = String(prev).toLowerCase().replace(/[^a-z0-9.]/g, '');
      if (prevWasNum) { out[out.length - 1] = `${prev}.${raw}`; prevWasNum = true; continue; }
      if (known.includes(prevLow)) { out[out.length - 1] = `${prev}-${raw}`; prevWasNum = true; continue; }
      out.push(raw); prevWasNum = true; continue;
    }
    prevWasNum = false;
    const map = {
      gpt: 'GPT', glm: 'GLM', qwen: 'Qwen', deepseek: 'DeepSeek', claude: 'Claude', gemini: 'Gemini',
      llama: 'Llama', grok: 'Grok', mistral: 'Mistral', kimi: 'Kimi', minimax: 'MiniMax', mimo: 'MiMo',
      hle: 'HLE', mmlu: 'MMLU', swe: 'SWE', lcr: 'LCR', ifbench: 'IFBench', gpqa: 'GPQA',
    };
    const suffixes = {
      flashx: 'FlashX', flash: 'Flash', pro: 'Pro', max: 'Max', mini: 'Mini', air: 'Air', light: 'Light',
      turbo: 'Turbo', vision: 'Vision', code: 'Code', coder: 'Coder', instruct: 'Instruct', chat: 'Chat',
      thinking: 'Thinking', reasoning: 'Reasoning', oss: 'OSS', vl: 'VL', moe: 'MoE', next: 'Next',
      preview: 'Preview', alpha: 'Alpha', beta: 'Beta', base: 'Base', math: 'Math', science: 'Science',
      legal: 'Legal', agent: 'Agent', agents: 'Agents', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku',
    };
    out.push(map[low] || suffixes[low] || (raw.length <= 3 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1)));
  }
  return out.join(' ').replace(/-(?=\d)/g, '-');
}

export function orgFromModelSlug(slug) {
  const parts = String(slug || '').toLowerCase().split(/[-_.]/);
  for (const p of parts) {
    if (ORG_BY_SLUG_PREFIX[p]) return ORG_BY_SLUG_PREFIX[p];
  }
  return 'Other';
}

/**
 * LiveBench 2.0: table_<date>.csv + categories_<date>.json (with _overall_weights) -> leaderboard.
 * Overall = sum(weight_i * suite_i) / sum(weight_i), with weights from the official
 * categories.json, recomputed locally instead of scraping the published Overall.
 */
export function normalizeLiveBench({ tableCsv, categoriesJson, tableUpdatedAt, sourceUrl = 'https://livebench.ai/' } = {}) {
  const rows = csvToObjects(tableCsv);
  if (!rows.length) return null;
  let categories = {};
  try { categories = typeof categoriesJson === 'string' ? JSON.parse(categoriesJson) : (categoriesJson || {}); } catch { categories = {}; }
  const weights = categories._overall_weights && typeof categories._overall_weights === 'object' ? categories._overall_weights : null;
  const suites = Object.entries(categories).filter(([k, v]) => k !== '_overall_weights' && Array.isArray(v) && v.length);
  const suiteCols = suites.length
    ? suites.map(([name, cols]) => ({ name, col: cols[0], weight: weights?.[name] ?? 1 }))
    : Object.keys(rows[0]).filter((k) => k !== 'model').map((col) => ({ name: col, col, weight: 1 }));
  const hasWeights = Boolean(weights);
  const scored = [];
  for (const row of rows) {
    const model = String(row.model || '').trim();
    if (!model) continue;
    let wsum = 0;
    let acc = 0;
    let used = 0;
    for (const { col, weight } of suiteCols) {
      const raw = row[col];
      if (raw === undefined || raw === '' || /^n\/?a$/i.test(String(raw).trim())) continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      acc += v * weight;
      wsum += weight;
      used += 1;
    }
    if (!used || wsum === 0) continue;
    if (used < suiteCols.length && suiteCols.length > 0) continue; // Include only models with every category present so partial scores never drive the ranking
    scored.push({ model, score: acc / wsum });
  }
  scored.sort((a, b) => (b.score - a.score) || (a.model < b.model ? -1 : 1));
  if (!scored.length) return null;
  const updatedAt = toIsoDateTime(tableUpdatedAt) || new Date().toISOString();
  return {
    id: 'livebench-2.0',
    name: 'LiveBench 2.0 综合榜',
    description: hasWeights
      ? 'LiveBench 2.0 七大赛道加权均分（权重取自官方 categories.json，站点本地复算 Overall），0-100 越高越好'
      : 'LiveBench 2.0 七大赛道等权均分（未取到官方权重时的降级口径），0-100 越高越好',
    sourceName: 'LiveBench',
    sourceUrl,
    updatedAt,
    metric: { name: 'LiveBench 2.0 Overall', unit: 'score', higherIsBetter: true },
    entries: scored.map((s, i) => ({
      rank: i + 1,
      model: prettifyModelName(s.model),
      org: orgFromModelSlug(s.model),
      score: Math.round(s.score * 100) / 100,
      scoreDisplay: s.score.toFixed(1),
      votes: null,
      delta: null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Artificial Analysis homepage embedded data (Next.js flight payload) -> leaderboard
// ---------------------------------------------------------------------------
/** Extract a JSON array by key from a Next.js flight payload (bracket balancing + string state machine) */
export function extractFlightArray(flight, key) {
  const idx = flight.indexOf(`"${key}":`);
  if (idx < 0) return [];
  const start = flight.indexOf('[', idx);
  if (start < 0) return [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < flight.length; i++) {
    const ch = flight[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return [];
  try { const arr = JSON.parse(flight.slice(start, end)); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

/** Join the self.__next_f.push flight chunks from the AA homepage HTML into one string */
export function buildNextFlight(html) {
  const chunks = [...String(html || '').matchAll(/<script>self\.__next_f\.push\(\[1,([\s\S]*?)\]\)<\/script>/g)].map((m) => m[1]);
  let flight = '';
  for (const c of chunks) {
    try { const arr = JSON.parse(`[${c}]`); if (typeof arr[0] === 'string') flight += arr[0]; } catch { /* ignore chunk */ }
  }
  return flight;
}

/** Extract the initialData model array from the AA homepage HTML (pure function, returns [] on failure) */
export function parseAaInitialData(html) {
  return extractFlightArray(buildNextFlight(html), 'initialData');
}

/** Extract the full initialModels array from the AA /leaderboards/models HTML */
export function parseAaLeaderboardModels(html) {
  return extractFlightArray(buildNextFlight(html), 'initialModels');
}

/** AA model array (full initialModels or homepage initialData) -> intelligence index leaderboard */
export function normalizeAaLeaderboard(aaModels, { sourceUrl = 'https://artificialanalysis.ai/leaderboards/models', updatedAt, full = true } = {}) {
  const scored = (Array.isArray(aaModels) ? aaModels : [])
    .filter((m) => m && typeof m.intelligenceIndex === 'number' && Number.isFinite(m.intelligenceIndex))
    .map((m) => ({
      model: String(m.name || m.shortName || m.slug || '').trim(),
      org: String(m.creator?.name || m.modelCreatorName || m.creator?.slug || 'Other').trim(),
      score: Math.round(m.intelligenceIndex * 100) / 100,
      releaseDate: toIsoDateOnly(m.releaseDate) || null,
    }))
    .filter((m) => m.model)
    .sort((a, b) => (b.score - a.score) || (a.model < b.model ? -1 : 1));
  if (!scored.length) return null;
  return {
    id: 'artificial-analysis-intelligence',
    name: 'Artificial Analysis 智能指数榜',
    description: full
      ? 'AA Intelligence Index v5 综合智能指数全量榜（/leaderboards/models 页内嵌 initialModels 解析），分数越高越好'
      : 'AA Intelligence Index v5 综合智能指数（首页默认精选模型集，非全量目录），分数越高越好',
    sourceName: 'Artificial Analysis',
    sourceUrl,
    updatedAt: toIsoDateTime(updatedAt) || new Date().toISOString(),
    metric: { name: 'AA Intelligence Index', unit: 'index', higherIsBetter: true },
    entries: scored.map((s, i) => ({
      rank: i + 1,
      model: s.model,
      org: s.org,
      score: s.score,
      scoreDisplay: s.score.toFixed(1),
      releaseDate: s.releaseDate || null,
      votes: null,
      delta: null,
    })),
  };
}

/** Homepage featured structure (kept for compatibility): initialData -> intelligence index leaderboard */
export function normalizeAaRankings(aaModels, { sourceUrl = 'https://artificialanalysis.ai/', updatedAt } = {}) {
  return normalizeAaLeaderboard(aaModels, { sourceUrl, updatedAt, full: false });
}

// ---------------------------------------------------------------------------
// LMArena（CI：HF datasets-server rows API）→ board
// ---------------------------------------------------------------------------
function pickKey(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    const found = Object.keys(obj).find((ok) => ok.toLowerCase().replace(/[^a-z]/g, '') === k.toLowerCase().replace(/[^a-z]/g, ''));
    if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== '') return obj[found];
  }
  return null;
}

/** HF datasets-server rows response -> LMArena text overall leaderboard (pure function) */
export function normalizeLmarenaRows(payload, { updatedAt, sourceUrl = 'https://lmarena.ai/leaderboard', maxEntries = 100 } = {}) {
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) return null;
  const features = (payload.features || []).map((f) => f.name);
  const rows = payload.rows.map((r) => (r && r.row && typeof r.row === 'object' ? r.row : r)).filter((r) => r && typeof r === 'object');
  const entries = [];
  for (const r of rows) {
    const model = pickKey(r, ['model_name', 'model', 'name', 'modelname']);
    const score = Number(pickKey(r, ['score', 'arena_score', 'rating', 'elo', 'arenascore']));
    if (!model || !Number.isFinite(score)) continue;
    const org = pickKey(r, ['organization', 'org', 'vendor', 'author', 'model_organization']) || orgFromModelSlug(String(model));
    const votesRaw = Number(pickKey(r, ['votes', 'vote_count', 'num_votes', 'votes_count']));
    const rankRaw = Number(pickKey(r, ['rank', 'ranking']));
    entries.push({ model: String(model), org: String(org), score, votes: Number.isFinite(votesRaw) ? votesRaw : null, rankRaw: Number.isFinite(rankRaw) ? rankRaw : null });
  }
  if (!entries.length) return null;
  entries.sort((a, b) => (b.score - a.score) || (a.model < b.model ? -1 : 1));
  const clipped = entries.slice(0, maxEntries);
  return {
    id: 'lmarena-text',
    name: 'LMArena 文本总榜',
    description: `人类盲测偏好的 Arena Score 排名（HF 数据集 text/latest 快照，${features.length} 个字段）`,
    sourceName: 'LMArena',
    sourceUrl,
    updatedAt: toIsoDateTime(updatedAt) || new Date().toISOString(),
    metric: { name: 'Arena Score', unit: 'elo', higherIsBetter: true },
    entries: clipped.map((e, i) => ({
      rank: i + 1,
      model: e.model,
      org: e.org,
      score: Math.round(e.score * 100) / 100,
      scoreDisplay: String(Math.round(e.score)),
      votes: e.votes,
      delta: null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Official blog RSS -> news
// ---------------------------------------------------------------------------
const KIND_KEYWORDS = [
  ['policy', /\b(security|safety|policy|regulation|regulatory|governance|privacy|compliance|bug bounty|defender|threat|alignment|protect|law|litigation|trust)\b/i],
  ['oss', /\b(open[- ]source|open[- ]weights?|openweight|apache|mit license|github)\b/i],
  ['pricing', /\b(pricing|price|prices|cost|billing|discount|free tier)\b/i],
  ['benchmark', /\b(benchmark|leaderboard|evaluation|evals?|sota|arena|score|bench)\b/i],
  ['research', /\b(research|paper|study|technical report|findings|arxiv|neurips|icml|iclr|survey)\b/i],
  ['release', /\b(release|launch|introduc\w*|announc\w*|available|now live|unveil\w*|rollout|debut|upgrade|new model|gpt|claude|gemini|deepseek|qwen|glm|kimi|minimax|llama|grok|mistral|sonnet|opus|haiku|terra|argon)\b/i],
];

/** Rough classification: check the title first (strong signal), then the summary; default to release (official vendor blogs mostly announce releases/products) */
export function classifyKind(title, summary = '') {
  for (const [kind, re] of KIND_KEYWORDS) if (re.test(title)) return kind;
  for (const [kind, re] of KIND_KEYWORDS) if (re.test(summary)) return kind;
  return 'release';
}

/** Source weight (used for importance: first-party official blogs rank above aggregators/secondary blogs) */
const SOURCE_WEIGHT = {
  'OpenAI Blog': 1,
  'Google DeepMind': 1,
  'Google AI Blog': 0.75,
  'Qwen Blog': 0.8,
};

export function sourceWeight(sourceName) {
  return SOURCE_WEIGHT[sourceName] ?? 0.9;
}

/** RSS 2.0 / Atom (simplified) -> [{id,title,summary,url,publishedAt}] */
export function parseRssItems(xml, { maxItems = LIMITS.rssPerFeed } = {}) {
  const text = String(xml || '');
  const items = [];
  const blocks = [...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const atomBlocks = [...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  const chosen = blocks.length ? blocks : atomBlocks;
  for (const block of chosen) {
    const get = (tag) => {
      const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
      const m = block.match(re);
      if (!m) return '';
      return decodeEntities(stripHtml(m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ''))).trim();
    };
    const title = plainText(get('title'), 200);
    let link = get('link');
    if (!link) {
      const m = block.match(/<link[^>]*href="([^"]+)"/i) || block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
      if (m) link = decodeEntities(m[1]).trim();
    }
    if (!title) continue;
    const pub = get('pubDate') || get('published') || get('updated') || get('dc:date');
    const desc = get('description') || get('summary') || get('content:encoded') || get('content');
    const publishedAt = toIsoDateTime(pub);
    items.push({
      id: `rss-${shortHash(link || title)}`,
      title,
      summary: plainText(desc, LIMITS.summary) || null,
      url: link || null,
      publishedAt,
    });
  }
  return items.slice(0, maxItems);
}

/** Raw RSS XML -> contract news items (pure function; `now` is used for missing timestamps and importance) */
export function normalizeRssNews(xml, { sourceName, sourceKey, feedUrl, now, maxItems = LIMITS.rssPerFeed } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const parsed = parseRssItems(xml, { maxItems: Math.max(maxItems * 2, 20) });
  const items = [];
  const seen = new Set();
  for (const p of parsed) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const publishedAt = p.publishedAt || nowIso;
    const pubMs = Date.parse(publishedAt);
    const ageDays = (nowMs - pubMs) / 86400e3;
    if (ageDays > 120) continue; // Keep only the last ~4 months of official blog content so stale items do not crowd the timeline
    const kind = classifyKind(p.title, p.summary || '');
    const tags = new Set([sourceName.replace(/\s*(Blog|News|RSS).*$/i, '').trim() || sourceName, '官方博客']);
    if (kind === 'release') tags.add('模型发布');
    if (kind === 'research') tags.add('研究');
    if (kind === 'benchmark') tags.add('评测');
    if (kind === 'oss') tags.add('开源');
    if (kind === 'policy') tags.add('政策/安全');
    if (kind === 'pricing') tags.add('定价');
    const weight = sourceWeight(sourceName);
    let importance = kind === 'release' || kind === 'policy' ? (ageDays <= 2 ? 3 : ageDays <= 7 ? 2 : 1) : (ageDays <= 3 ? 2 : 1);
    if (weight < 0.85 && importance > 1) importance -= 1;
    items.push({
      id: p.id,
      title: plainText(p.title, 160),
      summary: plainText(p.summary || p.title, LIMITS.summary),
      kind,
      sourceName,
      sourceUrl: feedUrl,
      // Same-host HTTPS feed is same-origin evidence: upgrade item http:// links to https:// here.
      url: upgradeExternalUrl(p.url || feedUrl, { pageUrl: feedUrl }),
      publishedAt,
      tags: [...tags],
      models: [],
      importance,
      lang: 'en',
    });
    if (items.length >= maxItems) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// GitHub project refresh (stars/license/updatedAt)
// ---------------------------------------------------------------------------
export function normalizeGithubProjects(curatedProjects, repoDataByRepo, { now } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const items = [];
  for (const c of Array.isArray(curatedProjects) ? curatedProjects : []) {
    const repoData = c.repo ? repoDataByRepo?.[c.repo] : null;
    const stars = Number.isFinite(repoData?.stargazers_count) ? repoData.stargazers_count : (Number.isFinite(c.stars) ? c.stars : null);
    const license = repoData?.license?.spdx_id && repoData.license.spdx_id !== 'NOASSERTION'
      ? repoData.license.spdx_id
      : (c.license ?? null);
    const updatedAt = toIsoDateTime(repoData?.pushed_at) || (c.updatedAt ? toIsoDateTime(c.updatedAt) : nowIso);
    items.push({
      id: c.id,
      name: c.name,
      owner: c.owner,
      url: repoData?.html_url || c.url || (c.repo ? `https://github.com/${c.repo}` : ''),
      repo: c.repo ?? null,
      summary: c.summary,
      tags: Array.isArray(c.tags) ? c.tags : [],
      highlight: c.highlight ?? null,
      sourceType: c.sourceType || 'community',
      license,
      stars,
      updatedAt,
      why: c.why ?? null,
    });
  }
  items.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || (a.id < b.id ? -1 : 1));
  return items;
}

// ---------------------------------------------------------------------------
// Derived leaderboards (not quality rankings; explicitly labeled)
// ---------------------------------------------------------------------------
export function buildDerivedRankings(models, { now, topN = 10 } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const boards = [];
  const ctx = models.filter((m) => Number.isInteger(m.contextWindow) && m.contextWindow > 0)
    .sort((a, b) => b.contextWindow - a.contextWindow || (a.id < b.id ? -1 : 1))
    .slice(0, topN);
  if (ctx.length) {
    boards.push({
      id: 'context-window',
      name: '上下文窗口榜',
      description: '按 API 支持的最大上下文长度排序（由 OpenRouter 目录派生，非质量排名）',
      sourceName: 'OpenRouter',
      sourceUrl: 'https://openrouter.ai/models',
      updatedAt: nowIso,
      metric: { name: '上下文窗口', unit: 'tokens', higherIsBetter: true },
      entries: ctx.map((m, i) => ({
        rank: i + 1,
        model: displayNameFromOpenRouter({ name: m.name, id: m.id }),
        org: m.org,
        score: m.contextWindow,
        scoreDisplay: `${fmtTokens(m.contextWindow)} tokens`,
        votes: null,
        delta: null,
      })),
    });
  }
  const price = models.filter((m) => m.pricing && typeof m.pricing.output === 'number' && m.pricing.output > 0)
    .sort((a, b) => a.pricing.output - b.pricing.output || (a.id < b.id ? -1 : 1))
    .slice(0, topN);
  if (price.length) {
    boards.push({
      id: 'output-price',
      name: '输出价格榜（低价优先）',
      description: '按 OpenRouter 输出价格从低到高排序（由目录价格派生，非质量排名）',
      sourceName: 'OpenRouter',
      sourceUrl: 'https://openrouter.ai/models',
      updatedAt: nowIso,
      metric: { name: '输出价格', unit: 'USD/1M tokens', higherIsBetter: false },
      entries: price.map((m, i) => ({
        rank: i + 1,
        model: displayNameFromOpenRouter({ name: m.name, id: m.id }),
        org: m.org,
        score: m.pricing.output,
        scoreDisplay: `$${m.pricing.output} / 1M`,
        votes: null,
        delta: null,
      })),
    });
  }
  return boards;
}

// ---------------------------------------------------------------------------
// Resources / news dedupe / assembly
// ---------------------------------------------------------------------------
export function normalizeResources(curatedResources, { now } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const seen = new Set();
  const items = [];
  for (const r of Array.isArray(curatedResources) ? curatedResources : []) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    items.push({
      id: r.id,
      title: r.title,
      type: r.type,
      level: r.level,
      lang: r.lang,
      url: r.url,
      author: r.author,
      description: r.description,
      tags: Array.isArray(r.tags) ? r.tags : [],
      free: Boolean(r.free),
      featured: Boolean(r.featured),
      addedAt: toIsoDateTime(r.addedAt) || nowIso,
    });
  }
  items.sort((a, b) => Number(b.featured) - Number(a.featured) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  return items;
}

export function dedupeNews(items) {
  const seen = new Set();
  const out = [];
  for (const n of Array.isArray(items) ? items : []) {
    if (!n || !n.id || seen.has(n.id)) continue;
    seen.add(n.id);
    // Plain-text fallback: no source title/summary may leak HTML tags or entities
    out.push({ ...n, title: plainText(n.title, 200), summary: plainText(n.summary, LIMITS.summary) });
  }
  out.sort((a, b) => (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) || (a.id < b.id ? -1 : 1));
  return out;
}

// ---------------------------------------------------------------------------
// Hacker News AI hot topics (v1.4 B4) -> data/topics.json
// Source: HN Algolia public API (no key). Only public data; every summary is
// plain text (tags/entities stripped) and capped at 160 chars.
// ---------------------------------------------------------------------------
export const HN_TOPIC_LIMIT = 10;
export const HN_MIN_POINTS = 30;

const HN_AI_PATTERNS = [
  /\bai\b/i, /\bllms?\b/i, /\bgpt\b/i, /\bgpt-\d/i, /\bchatgpt\b/i, /\bclaude\b/i, /\bgemini\b/i,
  /\bdeepseek\b/i, /\bqwen\b/i, /\bllama\b/i, /\bmistral\b/i, /\bopenai\b/i, /\banthropic\b/i,
  /\bopen[- ]?weights?\b/i, /\blanguage model/i, /\bmachine learning\b/i, /\bneural\b/i, /\btransformer/i,
  /\bagents?\b/i, /\bagentic\b/i, /\bchatbot\b/i, /\bdiffusion\b/i, /\bcopilot\b/i, /\bhugging ?face\b/i,
  /\binference\b/i, /\bfine[- ]?tun/i, /\brag\b/i, /\bcontext window\b/i, /\bdata ?cent(er|re)\b/i,
];

// Topic tag hints (kept small + deterministic; tags are optional per contract)
const HN_TAG_HINTS = [
  ['OpenAI', /\bopenai|chatgpt|gpt-?\d/i],
  ['Anthropic', /\banthropic|claude\b/i],
  ['Google', /\bgoogle|gemini|deepmind/i],
  ['Meta', /\bmeta\b|llama/i],
  ['DeepSeek', /\bdeepseek/i],
  ['Alibaba', /\bqwen|alibaba/i],
  ['Mistral', /\bmistral/i],
  ['Agent', /\bagents?\b|agentic/i],
  ['LLM', /\bllm|language model/i],
  ['Open Weights', /\bopen[- ]?weights?/i],
  ['Security', /\bsecurity|vulnerab|exploit|hack/i],
  ['Policy', /\bregulat|policy|law|lawsuit|copyright/i],
  ['Economics', /\bcost|price|billion|market|stock|econom/i],
];

/** Whether a HN Algolia story hit is AI-related (title/URL based; server-side query=AI is only a pre-filter). */
export function isAiRelatedTopic(hit) {
  if (!hit || !hit.title) return false;
  const haystack = `${hit.title} ${hit.url || ''}`;
  return HN_AI_PATTERNS.some((re) => re.test(haystack));
}

/**
 * Extract a plain-text discussion summary from a HN story item tree.
 * Algolia's items API usually returns `points: null` for comments, so the "top comment"
 * is approximated by the first top-level comment with substantive text (HN rank order);
 * if numeric points are present we prefer the highest-scored among the first 5.
 */
export function extractHnDiscussionSummary(itemTree, { max = 160 } = {}) {
  const children = Array.isArray(itemTree?.children) ? itemTree.children : [];
  const hasSubstance = (c) => c && typeof c.text === 'string' && plainText(c.text, 0).length >= 24;
  const candidates = children.filter(hasSubstance);
  if (!candidates.length) {
    // Fall back to a nested reply when no top-level comment has enough text.
    const queue = [...children];
    while (queue.length && !candidates.length) {
      const node = queue.shift();
      for (const child of node?.children || []) {
        if (hasSubstance(child)) candidates.push(child);
        queue.push(child);
      }
    }
  }
  if (!candidates.length) return null;
  const scored = candidates.slice(0, 5).filter((c) => typeof c.points === 'number' && Number.isFinite(c.points));
  const pick = scored.length ? scored.slice().sort((a, b) => b.points - a.points)[0] : candidates[0];
  const summary = plainText(pick.text, max);
  if (!summary) return null;
  return { summary, commentId: pick.id ?? null, author: pick.author ?? null };
}

/**
 * Normalize an Algolia HN search response into data/topics.json items.
 * summaries: { [objectID]: string | { summary: string } } extracted from story item trees.
 */
export function normalizeHnTopics(searchPayload, { now, limit = HN_TOPIC_LIMIT, summaries = {}, sourceName = 'Hacker News' } = {}) {
  const hits = Array.isArray(searchPayload?.hits)
    ? searchPayload.hits
    : Array.isArray(searchPayload) ? searchPayload : [];
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const items = [];
  for (const hit of hits) {
    if (!hit || hit.objectID === undefined || hit.objectID === null || !hit.title) continue;
    if (!isAiRelatedTopic(hit)) continue;
    const points = Number.isInteger(hit.points) ? hit.points : parseInt(hit.points, 10);
    if (!Number.isFinite(points) || points < HN_MIN_POINTS) continue;
    const parsedComments = Number.isInteger(hit.num_comments) ? hit.num_comments : parseInt(hit.num_comments, 10);
    const comments = Number.isFinite(parsedComments) && parsedComments >= 0 ? parsedComments : 0;
    const id = `hn-${hit.objectID}`;
    const rawUrl = typeof hit.url === 'string' && /^https?:\/\//i.test(hit.url.trim()) ? hit.url.trim() : null;
    const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    let domain = null;
    if (rawUrl) {
      try { domain = new URL(rawUrl).hostname.replace(/^www\./, ''); } catch { domain = null; }
    }
    const title = plainText(hit.title, 200);
    const supplied = summaries[id] ?? summaries[String(hit.objectID)] ?? null;
    const suppliedText = typeof supplied === 'string' ? supplied : supplied?.summary;
    const fallback = `Hacker News 讨论：${title}（${points} points，${comments} 条评论）`;
    const tags = new Set(['AI']);
    for (const [tag, re] of HN_TAG_HINTS) if (re.test(`${title} ${rawUrl || ''}`)) tags.add(tag);
    items.push({
      id,
      title,
      url: rawUrl, // may be null -> front-end falls back to hnUrl (contract allows)
      hnUrl,
      domain,
      points,
      comments,
      publishedAt: toIsoDateTime(hit.created_at_i) || toIsoDateTime(hit.created_at) || nowIso,
      summary: plainText(suppliedText || fallback, 160),
      source: sourceName,
      tags: [...tags],
    });
  }
  items.sort((a, b) => (b.points - a.points) || (a.id < b.id ? -1 : 1));
  return items.slice(0, limit);
}

/**
 * OpenRouter public token-volume chart -> weekly usage series.
 * Endpoint: GET https://openrouter.ai/api/frontend/v1/rankings/model-rankings-chart
 * Payload: { data: { data: [{ x: "YYYY-MM-DD", ys: { model: tokens, ... } }] } }
 */
export function normalizeOpenRouterUsage(payload, { now } = {}) {
  const points = payload && payload.data && Array.isArray(payload.data.data) ? payload.data.data : [];
  const weeks = points
    .filter((point) => point && typeof point.x === 'string' && point.ys && typeof point.ys === 'object')
    .map((point) => ({
      weekStart: point.x,
      tokens: Object.values(point.ys).reduce((sum, value) => sum + (Number(value) || 0), 0),
    }))
    .filter((point) => point.tokens > 0)
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
    .slice(-12);
  const last4 = weeks.slice(-4);
  const monthlyTokens = last4.reduce((sum, point) => sum + point.tokens, 0);
  return {
    schemaVersion: 1,
    generatedAt: toIsoDateTime(now) || new Date().toISOString(),
    source: 'openrouter-rankings',
    sourceLabel: 'OpenRouter token volume',
    granularity: 'week',
    weeks,
    monthlyTokens,
    monthlyDays: last4.length * 7,
    note: 'OpenRouter public rankings chart: weekly tokens processed across its API.',
  };
}

/**
 * Assembly: merge source contributions into the contract file objects.
 * sources: [{id,name,url,type,status,lastFetchedAt,items,note}]
 */
export function assembleData({ mode, now, sources, collections, highlights }) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  // Security (M4): normalize external URL schemes for every generated artifact.
  // Only provably-safe http -> https upgrades are applied offline (same-host HTTPS evidence or
  // allowlisted host); anything else stays http:// and is surfaced as meta.linkWarnings.
  const linkWarnings = new Set();
  const fixUrl = (url, tag, pageUrl = null) => {
    if (url === null || url === undefined || url === '') return url ?? null;
    if (typeof url !== 'string') return url;
    const fixed = upgradeExternalUrl(url, { pageUrl });
    if (/^http:\/\//i.test(fixed)) linkWarnings.add(`${tag}: ${fixed}`);
    return fixed;
  };
  const models = (collections.models || []).slice()
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((m) => ({
      ...m,
      links: m.links && typeof m.links === 'object'
        ? Object.fromEntries(Object.entries(m.links).map(([k, v]) => [k, fixUrl(v, `models.${m.id}.links.${k}`)]))
        : m.links,
    }));
  const news = dedupeNews(collections.news || []).map((n) => ({
    ...n,
    url: fixUrl(n.url, `news.${n.id}.url`, n.sourceUrl),
    sourceUrl: fixUrl(n.sourceUrl, `news.${n.id}.sourceUrl`),
  }));
  const boards = (collections.boards || []).filter((b) => b && Array.isArray(b.entries) && b.entries.length)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((b) => ({ ...b, sourceUrl: fixUrl(b.sourceUrl, `rankings.${b.id}.sourceUrl`) }));
  const resources = normalizeResources(collections.resources || [], { now })
    .map((r) => ({ ...r, url: fixUrl(r.url, `resources.${r.id}.url`) }));
  const projects = (collections.projects || []).slice()
    .sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || (a.id < b.id ? -1 : 1))
    .map((p) => ({ ...p, url: fixUrl(p.url, `projects.${p.id}.url`) }));
  const topics = (Array.isArray(collections.topics) ? collections.topics : [])
    .slice()
    .sort((a, b) => (b.points - a.points) || (a.id < b.id ? -1 : 1))
    .map((t) => ({
      ...t,
      url: fixUrl(t.url, `topics.${t.id}.url`, t.hnUrl),
      hnUrl: fixUrl(t.hnUrl, `topics.${t.id}.hnUrl`),
    }));
  const usage = collections.usage && Array.isArray(collections.usage.weeks) ? collections.usage : null;
  const orgs = new Set(models.map((m) => m.org).filter(Boolean)).size;
  const statusOk = sources.filter((s) => s.status === 'ok').length;
  const stats = {
    models: models.length,
    news: news.length,
    boards: boards.length,
    resources: resources.length,
    projects: projects.length,
    topics: topics.length,
    usageWeeks: usage ? usage.weeks.length : 0,
    orgs,
    sourcesOk: statusOk,
    sourcesDegraded: sources.length - statusOk,
  };
  const srcLabel = (names) => names.filter(Boolean).join('+') || 'unknown';
  const gen = nowIso;
  const warnings = [...linkWarnings].sort();
  const meta = {
    schemaVersion: 1,
    generatedAt: gen,
    source: `fetch-pipeline:${mode}`,
    mode,
    site: { ...SITE },
    stats,
    sources,
    ...(warnings.length ? { linkWarnings: warnings } : {}),
    latestHighlights: (highlights || []).filter(Boolean).slice(0, 3),
  };
  const modelsFile = { schemaVersion: 1, generatedAt: gen, source: srcLabel(['openrouter']), count: models.length, models };
  const newsFile = { schemaVersion: 1, generatedAt: gen, source: srcLabel([...new Set(news.map((n) => n.sourceName))]) || 'openrouter-diff', items: news };
  const rankingsFile = { schemaVersion: 1, generatedAt: gen, source: srcLabel([...new Set(boards.map((b) => b.sourceName))]), boards };
  const resourcesFile = { schemaVersion: 1, generatedAt: gen, source: 'curated', items: resources };
  const projectsFile = { schemaVersion: 1, generatedAt: gen, source: 'curated+github', items: projects };
  const topicsFile = { schemaVersion: 1, generatedAt: gen, source: 'hn-ai', count: topics.length, items: topics };
  const usageFile = usage
    ? { ...usage, generatedAt: gen }
    : { schemaVersion: 1, generatedAt: gen, source: 'openrouter-rankings', sourceLabel: 'OpenRouter token volume', granularity: 'week', weeks: [], monthlyTokens: 0, monthlyDays: 0, note: 'unavailable' };
  return {
    files: { meta, models: modelsFile, news: newsFile, rankings: rankingsFile, resources: resourcesFile, projects: projectsFile, topics: topicsFile, usage: usageFile },
    stats,
    linkWarnings: warnings,
  };
}

// ---------------------------------------------------------------------------
// OpenCompass Arena (official API) -> leaderboard
// POST https://rank.opencompass.org.cn/gw/opencompass-be/api/v1/rank/listArenaRankings {rankingType}
// ---------------------------------------------------------------------------
export function normalizeOpenCompassArena(payload, { id = 'opencompass-arena', name = 'OpenCompass 中文 Arena 榜', description = '司南 OpenCompass Arena 中文盲测对战 Elo 排名（官方 API）', sourceUrl = 'https://rank.opencompass.org.cn/arena', updatedAt, maxEntries = 30 } = {}) {
  const data = payload?.data ?? payload;
  const rankings = Array.isArray(data?.rankings) ? data.rankings : null;
  if (!rankings || !rankings.length) return null;
  const entries = rankings
    .map((r) => ({
      model: String(r.model || '').trim(),
      org: String(r.org || '').trim() || orgFromModelSlug(String(r.model || '')),
      score: Number(r.eloRating ?? r.elo),
      votes: Number.isFinite(Number(r.votes)) ? Number(r.votes) : null,
      delta: Number.isFinite(Number(r.rankingChanges)) ? Number(r.rankingChanges) : null,
      ci: r.eloCI95 || null,
    }))
    .filter((e) => e.model && Number.isFinite(e.score))
    .sort((a, b) => (b.score - a.score) || (a.model < b.model ? -1 : 1))
    .slice(0, maxEntries);
  if (!entries.length) return null;
  const upd = toIsoDateTime(updatedAt) || toIsoDateTime(data?.lastUpdate) || new Date().toISOString();
  return {
    id,
    name,
    description: `${description}，共 ${data?.totalModels ?? entries.length} 个模型、${data?.totalVotes ?? '—'} 票`,
    sourceName: 'OpenCompass',
    sourceUrl,
    updatedAt: upd,
    metric: { name: data?.rankBy === 'Elo' ? 'Elo 评分' : (data?.rankBy || 'Elo 评分'), unit: 'elo', higherIsBetter: true },
    entries: entries.map((e, i) => ({
      rank: i + 1,
      model: e.model,
      org: e.org,
      score: Math.round(e.score * 100) / 100,
      scoreDisplay: String(Math.round(e.score)),
      votes: e.votes,
      delta: e.delta,
    })),
  };
}

// ---------------------------------------------------------------------------
// Epoch AI official benchmark_data.zip -> ECI leaderboard / single-benchmark leaderboards
// ---------------------------------------------------------------------------
/** epoch_capabilities_index/eci_scores.csv -> ECI leaderboard (CSV already sorted by ECI desc, includes CI and release date) */
export function normalizeEpochEci(csvText, { updatedAt, sourceUrl = 'https://epoch.ai/data/ai-benchmarking-dashboard', maxEntries = 40 } = {}) {
  const rows = csvToObjects(csvText);
  const entries = [];
  for (const row of rows) {
    const model = String(row['Display name'] || row.Model || '').trim();
    const score = Number(row.eci);
    if (!model || !Number.isFinite(score)) continue;
    entries.push({
      model,
      org: String(row.Organization || '').trim() || orgFromModelSlug(model),
      score,
      releaseDate: row.date || null,
      ciLow: Number(row.eci_ci_low),
      ciHigh: Number(row.eci_ci_high),
    });
  }
  if (!entries.length) return null;
  entries.sort((a, b) => (b.score - a.score) || (a.model < b.model ? -1 : 1));
  const dates = rows.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort();
  const upd = toIsoDateTime(updatedAt) || toIsoDateTime(dates[dates.length - 1]) || new Date().toISOString();
  return {
    id: 'epoch-eci',
    name: 'Epoch AI ECI 能力指数榜',
    description: 'Epoch Capabilities Index（由多个基准合成的通用能力指数），数值越高越强；取官方 benchmark_data.zip 的 eci_scores.csv',
    sourceName: 'Epoch AI',
    sourceUrl,
    updatedAt: upd,
    metric: { name: 'ECI', unit: 'index', higherIsBetter: true },
    entries: entries.slice(0, maxEntries).map((e, i) => ({
      rank: i + 1,
      model: e.model,
      org: e.org,
      score: Math.round(e.score * 100) / 100,
      scoreDisplay: e.score.toFixed(1),
      votes: null,
      delta: null,
    })),
  };
}

/** A single Epoch benchmark CSV (columns: Model version, mean_score, Organization, ...) -> leaderboard */
export function normalizeEpochBenchmark(csvText, { id, name, description, metricName = 'mean_score', sourceUrl = 'https://epoch.ai/data/ai-benchmarking-dashboard', updatedAt, maxEntries = 25 } = {}) {
  const rows = csvToObjects(csvText);
  const best = new Map();
  for (const row of rows) {
    const model = String(row['Model version'] || '').trim();
    const score = Number(row.mean_score);
    if (!model || !Number.isFinite(score)) continue;
    if (!/^(.*?)(?:_(high|max|medium|low|xhigh|default))?$/.test(model)) continue;
    if (!best.has(model) || score > best.get(model).score) {
      best.set(model, { model, score, org: String(row.Organization || '').trim(), releaseDate: row['Release date'] || null });
    }
  }
  const entries = [...best.values()].sort((a, b) => (b.score - a.score) || (a.model < b.model ? -1 : 1)).slice(0, maxEntries);
  if (!entries.length) return null;
  const upd = toIsoDateTime(updatedAt) || new Date().toISOString();
  return {
    id,
    name,
    description,
    sourceName: 'Epoch AI',
    sourceUrl,
    updatedAt: upd,
    metric: { name: metricName, unit: 'score', higherIsBetter: true },
    entries: entries.map((e, i) => ({
      rank: i + 1,
      model: prettifyModelName(e.model.replace(/_(high|max|medium|low|xhigh|default)$/i, '')),
      org: e.org || orgFromModelSlug(e.model),
      score: Math.round(e.score * 10000) / 10000,
      scoreDisplay: (e.score * 100).toFixed(1),
      votes: null,
      delta: null,
    })),
  };
}

// ---------------------------------------------------------------------------
// DeepSeek official Change Log (HTML) -> news (Chinese vendor updates; reachable locally, not RSS)
// ---------------------------------------------------------------------------
export function normalizeDeepseekUpdates(html, { now, maxItems = 8, sourceUrl = 'https://api-docs.deepseek.com/updates', freshnessDays = 240 } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const text = String(html || '');
  const art = (text.match(/<article[\s\S]*?<\/article>/i) || [text])[0];
  const marks = [...art.matchAll(/<h2[^>]*>\s*Date:\s*(20\d{2}-\d{2}-\d{2})[\s\S]*?<\/h2>/gi)];
  const items = [];
  for (let i = 0; i < marks.length; i++) {
    const date = marks[i][1];
    const pubMs = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(pubMs)) continue;
    const ageDays = (nowMs - pubMs) / 86400e3;
    if (ageDays < 0 || ageDays > freshnessDays) continue;
    const start = marks[i].index + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : art.length;
    const body = art.slice(start, end);
    // Item title: prefer h3; otherwise the first title-like <strong>; otherwise the first sentence of the body
    const h3s = [...body.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => plainText(m[1], 100)).filter(Boolean);
    const strongs = [...body.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)].map((m) => plainText(m[1], 100))
      .filter((s) => s.length >= 4 && s.length <= 80 && !/[。.!?]$/.test(s));
    const bodyText = plainText(body.replace(/<h[1-6][\s\S]*?<\/h[1-6]>/gi, ' '), 500);
    const titles = h3s.length ? h3s.slice(0, 3) : (strongs.length ? strongs.slice(0, 2) : [bodyText.split(/(?<=[.!?。！？])\s/)[0]?.slice(0, 80) || '更新公告']);
    for (const title of titles) {
      items.push({
        id: `release-deepseek-${date}-${shortHash(title)}`,
        title: clampText(`DeepSeek 官方更新（${date}）：${title}`, 160),
        summary: clampText(`DeepSeek Change Log ${date}：${bodyText}`, LIMITS.summary),
        kind: 'release',
        sourceName: 'DeepSeek',
        sourceUrl,
        url: `${sourceUrl}#${date}`,
        publishedAt: `${date}T00:00:00.000Z`,
        tags: ['DeepSeek', '官方公告', '模型发布'],
        models: [],
        importance: ageDays <= 14 ? 3 : ageDays <= 60 ? 2 : 1,
        lang: 'zh',
      });
    }
  }
  const seen = new Set();
  return items
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .sort((a, b) => (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) || (a.id < b.id ? -1 : 1))
    .slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// GitHub Releases (open-source tool updates) -> news
// ---------------------------------------------------------------------------
export function normalizeGithubReleases(releasesByRepo, { now, maxPerRepo = 3 } = {}) {
  const nowIso = toIsoDateTime(now) || new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const items = [];
  for (const [repo, payload] of Object.entries(releasesByRepo || {})) {
    const releases = Array.isArray(payload) ? payload : [];
    for (const rel of releases.slice(0, maxPerRepo)) {
      if (!rel || rel.draft) continue;
      const tag = String(rel.tag_name || rel.name || '').trim();
      if (!tag) continue;
      const publishedAt = toIsoDateTime(rel.published_at || rel.created_at);
      if (!publishedAt) continue;
      const ageDays = (nowMs - Date.parse(publishedAt)) / 86400e3;
      if (ageDays > 90) continue;
      const title = rel.name && rel.name.trim() ? String(rel.name).trim() : tag;
      items.push({
        id: `github-release-${slugify(repo)}-${slugify(tag)}`,
        title: clampText(`${repo} 发布 ${title}`, 160),
        summary: clampText(plainText(rel.body || '', LIMITS.summary) || `${repo} 新版本 ${tag}（GitHub Releases）`, LIMITS.summary),
        kind: 'oss',
        sourceName: 'GitHub Releases',
        sourceUrl: `https://github.com/${repo}/releases`,
        url: rel.html_url || `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`,
        publishedAt,
        tags: [repo.split('/')[1] || repo, 'GitHub Release', '开源'],
        models: [],
        importance: ageDays <= 7 ? 2 : 1,
        lang: 'en',
      });
    }
  }
  const seen = new Set();
  return items
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .sort((a, b) => (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) || (a.id < b.id ? -1 : 1));
}

/** Build homepage highlights (max 3, pure function) */
export function buildHighlights({ models, boards, news, resources, projects, now }) {
  const out = [];
  const orgs = new Set((models || []).map((m) => m.org).filter(Boolean)).size;
  if (models?.length) out.push(`OpenRouter 目录共 ${models.length} 个模型，覆盖 ${orgs} 家厂商`);
  const board = (boards || []).find((b) => b.id === 'livebench-2.0');
  if (board?.entries?.length) {
    const d = board.updatedAt.slice(0, 10);
    out.push(`LiveBench 2.0 榜单已接入（${d}），当前 Top1：${board.entries[0].model}`);
  } else if (news?.length) {
    out.push(`最新动态：${news[0].title}`);
  }
  if (resources?.length || projects?.length) out.push(`已收录 ${resources?.length ?? 0} 个学习资源与 ${projects?.length ?? 0} 个优秀项目`);
  return out.slice(0, 3);
}
