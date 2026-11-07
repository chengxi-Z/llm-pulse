/* ============================================================================= AI Pulse — data.js Responsibility: data loading (site-root relative ./data/*.json) + cache + formatting helpers Contract: DATA-CONTRACT.md §7 Fallback: any missing/timed-out file -> built-in sample data + meta._failed flag, the page shows a banner and never goes blank ============================================================================= */

const DATA_BASE = new URL('./data/', document.baseURI).href;
const FETCH_TIMEOUT = 8000;
const FILES = ['meta', 'models', 'news', 'rankings', 'resources', 'projects', 'skills', 'topics', 'usage'];
const cache = new Map();

/* ---------- Loading ---------- */

async function fetchJson(name) {
  const url = `${DATA_BASE}${name}.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-cache',
    });
    if (!res.ok) throw new Error(`${name}.json HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);

function normalize(name, data) {
  if (!data || typeof data !== 'object') return FALLBACK[name];
  switch (name) {
    case 'meta':
      return { ...FALLBACK.meta, ...data };
    case 'models':
      return { ...data, models: asArray(data.models) };
    case 'news':
      return { ...data, items: asArray(data.items) };
    case 'rankings':
      return { ...data, boards: asArray(data.boards) };
    case 'resources':
      return { ...data, items: asArray(data.items) };
    case 'projects':
      return { ...data, items: asArray(data.items) };
    case 'skills':
      return { ...data, items: asArray(data.items) };
    case 'topics':
      return { ...data, items: asArray(data.items) };
    case 'usage':
      return { ...data, weeks: asArray(data.weeks) };
    default:
      return data;
  }
}

/**
 * Load all data in parallel; a single file failure falls back to built-in sample data.
 * @returns {Promise<{meta:object, models:object, news:object, rankings:object, resources:object, projects:object, skills:object, topics:object}>}
 */
export async function loadAll() {
  if (cache.has('all')) return cache.get('all');

  const settled = await Promise.all(
    FILES.map(async (name) => {
      try {
        return { name, data: normalize(name, await fetchJson(name)), ok: true };
      } catch (error) {
        return { name, data: FALLBACK[name], ok: false, error: String(error && error.message ? error.message : error) };
      }
    })
  );

  const out = {};
  const failed = [];
  for (const entry of settled) {
    out[entry.name] = entry.data;
    if (!entry.ok) failed.push(entry.name);
  }
  out.meta = { ...out.meta, _failed: failed, _fallback: failed.length > 0 };
  cache.set('all', out);
  return out;
}

/* ---------- Formatting helpers ---------- */

/**
 * Allow only absolute http(s) URLs coming from external data; anything else
 * becomes an empty string so callers can degrade to plain text or '#'.
 * @param {*} value
 * @returns {string}
 */
export function safeHttpUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    return '';
  }
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function fmtNumber(value) {
  const num = Number(value);
  if (value == null || !Number.isFinite(num)) return '—';
  return num.toLocaleString('zh-CN');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local-timezone YYYY.MM.DD */
export function fmtDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

/** Local-timezone YYYY.MM.DD HH:mm */
export function fmtDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${fmtDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Local-timezone MM.DD */
export function fmtShortDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

/** Month abbreviation (Chinese locale) */
export function fmtMonth(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${date.getMonth() + 1}月`;
}

/** Relative time: just now / N minutes ago / N hours ago / N days ago / date */
export function relativeTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return '刚刚';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return fmtDate(date);
}

export function debounce(fn, wait = 200) {
  let timer = 0;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Price: {input,output} -> "$1.00 / $5.00" */
export function fmtPrice(pricing) {
  if (!pricing || pricing.input == null || pricing.output == null) return null;
  const money = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return `$${num >= 10 || Number.isInteger(num) ? num.toFixed(2) : String(num)}`;
  };
  return `${money(pricing.input)} / ${money(pricing.output)}`;
}

/** Context window: 1048576 -> "1.05M", 200000 -> "200K" */
export function fmtContext(tokens) {
  const num = Number(tokens);
  if (!Number.isFinite(num) || num <= 0) return '—';
  const trim = (value, digits) => value.toFixed(digits).replace(/\.?0+$/, '');
  if (num >= 1e6) return `${trim(num / 1e6, 2)}M`;
  if (num >= 1e3) return `${trim(num / 1e3, 0)}K`;
  return fmtNumber(num);
}

export function truncate(text, max = 120) {
  const value = String(text == null ? '' : text).trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/** Strip occasional HTML tags/entities from RSS summaries; the contract requires plain-text fields. */
export function stripHtml(value) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|ldquo|rdquo|mdash|hellip);/g, (match) => {
      const map = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&ldquo;': '「',
        '&rdquo;': '」',
        '&mdash;': '—',
        '&hellip;': '…',
      };
      return map[match] || '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Display-ready plain text: strip tags, then truncate. */
export function plainText(value, max = 240) {
  return truncate(stripHtml(value), max);
}

export function safeId(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Strip a duplicate provider prefix from the model name ("Z.ai: GLM ..." -> "GLM ...") */
export function displayModelName(model) {
  const name = String(model && model.name ? model.name : '');
  const org = String(model && model.org ? model.org : '');
  if (!name) return '—';
  const prefix = `${org}: `;
  return org && name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/* ---------- Enum labels ---------- */

export const KIND_LABELS = {
  release: '发布',
  benchmark: '评测',
  oss: '开源',
  pricing: '价格',
  research: '研究',
  policy: '政策',
};

export const MODALITY_LABELS = {
  text: '文本',
  image: '视觉',
  audio: '音频',
  video: '视频',
  file: '文件',
};

export const CAPABILITY_LABELS = {
  reasoning: '推理',
  'tool-calling': '工具调用',
  'structured-output': '结构化输出',
  'function-calling': '函数调用',
  'long-context': '长上下文',
  streaming: '流式',
};

export const TYPE_LABELS = {
  course: '课程',
  tutorial: '教程',
  paper: '论文',
  tool: '工具',
  awesome: 'Awesome',
  video: '视频',
  book: '书籍',
};

export const LEVEL_LABELS = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
};

export const LANG_LABELS = {
  en: '英文',
  zh: '中文',
  multi: '多语',
};

export const STATUS_LABELS = {
  ok: '正常',
  degraded: '降级',
  blocked: '不可达',
};

/* ---------- Built-in sample data (fallback when data/*.json is unavailable) ---------- */

const FALLBACK = {
  usage: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'openrouter-rankings',
    sourceLabel: 'OpenRouter token volume',
    granularity: 'week',
    weeks: Array.from({ length: 12 }, (_, index) => ({
      weekStart: new Date(Date.UTC(2026, 7, 17 + index * 7)).toISOString().slice(0, 10),
      tokens: 8e13 + index * 1.2e13,
    })),
    monthlyTokens: 3.6e14,
    monthlyDays: 28,
    note: 'fallback sample',
  },
  meta: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    mode: 'fallback',
    site: { name: 'AI Pulse', brand: '照胆云', version: '0.1.0' },
    stats: { models: 451, news: 40, boards: 2, resources: 22, projects: 13, orgs: 63, sourcesOk: 3, sourcesDegraded: 7 },
    sources: [
      { id: 'openrouter', name: 'OpenRouter Models API', url: 'https://openrouter.ai/api/v1/models', type: 'api', status: 'ok', lastFetchedAt: '2026-11-03T12:00:00.000Z', items: 451, note: null },
      { id: 'github', name: 'GitHub API', url: 'https://api.github.com', type: 'api', status: 'ok', lastFetchedAt: '2026-11-03T12:00:00.000Z', items: 13, note: null },
      { id: 'hf-mirror', name: 'Hugging Face 镜像', url: 'https://hf-mirror.com/api/models', type: 'api', status: 'ok', lastFetchedAt: '2026-11-03T12:00:00.000Z', items: null, note: null },
      { id: 'livebench', name: 'LiveBench', url: 'https://livebench.ai/', type: 'html', status: 'degraded', lastFetchedAt: null, items: null, note: null },
      { id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/api', type: 'api', status: 'blocked', lastFetchedAt: null, items: null, note: null },
    ],
    latestHighlights: ['OpenRouter 目录共 451 个模型，覆盖 63 家厂商', '已收录 22 个学习资源与 13 个优秀项目'],
  },
  models: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'fallback',
    count: 4,
    models: [
      { id: 'openai/gpt-6.1-terra-pro', name: 'GPT-6.1 Terra Pro', org: 'OpenAI', releaseDate: '2026-10-26', contextWindow: 1050000, maxOutput: null, modalities: ['text', 'image'], capabilities: ['reasoning', 'tool-calling'], openWeights: false, license: null, pricing: { input: 1, output: 5, currency: 'USD', unit: 'per_1m_tokens' }, links: { official: null, api: null, hf: null }, description: 'OpenAI 旗舰推理模型，1.05M 上下文。', sourceIds: ['openrouter'], benchmarks: null },
      { id: 'z-ai/glm-5.3-flashx-legal', name: 'Z.ai: GLM 5.3 FlashX Legal', org: 'Z.ai', releaseDate: '2026-11-02', contextWindow: 1048576, maxOutput: null, modalities: ['text', 'image'], capabilities: ['reasoning'], openWeights: false, license: null, pricing: { input: 0.37, output: 1.25, currency: 'USD', unit: 'per_1m_tokens' }, links: { official: null, api: null, hf: null }, description: 'Z.ai 法律领域多模态变体。', sourceIds: ['openrouter'], benchmarks: null },
      { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4.1 Flash', org: 'DeepSeek', releaseDate: '2026-10-20', contextWindow: 524288, maxOutput: null, modalities: ['text'], capabilities: ['reasoning'], openWeights: true, license: 'MIT', pricing: { input: 0.1, output: 0.4, currency: 'USD', unit: 'per_1m_tokens' }, links: { official: null, api: null, hf: null }, description: '高吞吐开源权重模型。', sourceIds: ['openrouter'], benchmarks: null },
      { id: 'moonshotai/kimi-k3.1-pro', name: 'Kimi K3.1 Pro', org: 'MoonshotAI', releaseDate: '2026-10-18', contextWindow: 524288, maxOutput: null, modalities: ['text', 'image'], capabilities: ['reasoning', 'tool-calling'], openWeights: false, license: null, pricing: { input: 0.6, output: 2.5, currency: 'USD', unit: 'per_1m_tokens' }, links: { official: null, api: null, hf: null }, description: '长上下文通用模型。', sourceIds: ['openrouter'], benchmarks: null },
    ],
  },
  news: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'fallback',
    items: [
      { id: 'release-openai-gpt-6-1-terra-pro', title: 'OpenAI 发布 GPT-6.1 Terra Pro：1.05M 上下文，$1/$5 每百万 tokens', summary: 'OpenAI 旗舰线更新，Terra 系列同时提供批量变体。', kind: 'release', sourceName: 'OpenRouter', sourceUrl: 'https://openrouter.ai/models', url: null, publishedAt: '2026-10-26T00:00:00.000Z', tags: ['OpenAI', '长上下文', '推理'], models: ['openai/gpt-6.1-terra-pro'], importance: 3, lang: 'zh' },
      { id: 'release-z-ai-glm-5-3-flashx-legal', title: 'Z.ai 上新：GLM 5.3 FlashX Legal（1.05M 上下文，$0.37/$1.25）', summary: 'Z.ai 法律领域多模态变体进入 OpenRouter 目录。', kind: 'release', sourceName: 'OpenRouter', sourceUrl: 'https://openrouter.ai/models', url: null, publishedAt: '2026-11-02T00:00:00.000Z', tags: ['Z.ai', '法律', '多模态'], models: ['z-ai/glm-5.3-flashx-legal'], importance: 3, lang: 'zh' },
      { id: 'release-kimi-k3-1-pro', title: 'MoonshotAI 上新：Kimi K3.1 Pro（524K 上下文）', summary: '推理与工具调用能力同步更新。', kind: 'release', sourceName: 'OpenRouter', sourceUrl: 'https://openrouter.ai/models', url: null, publishedAt: '2026-10-18T00:00:00.000Z', tags: ['MoonshotAI', '长上下文', '推理'], models: ['moonshotai/kimi-k3.1-pro'], importance: 2, lang: 'zh' },
    ],
  },
  rankings: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'fallback',
    boards: [
      {
        id: 'context-window',
        name: '上下文窗口榜',
        description: '按模型可用的上下文窗口长度排序。',
        sourceName: 'OpenRouter',
        sourceUrl: 'https://openrouter.ai/models',
        updatedAt: '2026-11-03T12:00:00.000Z',
        metric: { name: '上下文窗口', unit: 'tokens', higherIsBetter: true },
        entries: [
          { rank: 1, model: 'SpaceXAI: Grok 4.20', org: 'SpaceXAI', score: 2000000, scoreDisplay: '2M tokens', votes: null, delta: null },
          { rank: 2, model: 'OpenAI: GPT-6.1 Terra Pro', org: 'OpenAI', score: 1050000, scoreDisplay: '1.05M tokens', votes: null, delta: null },
        ],
      },
    ],
  },
  resources: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'fallback',
    items: [
      { id: 'huggingface-llm-course', title: 'Hugging Face LLM Course', type: 'course', level: 'beginner', lang: 'en', url: 'https://huggingface.co/learn/llm-course', author: 'Hugging Face', description: '从 Transformer 到微调与部署的系统课程。', tags: ['LLM', 'fine-tuning'], free: true, featured: true, addedAt: '2026-11-03T00:00:00.000Z' },
    ],
  },
  topics: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'hn-ai',
    count: 0,
    items: [],
  },
  skills: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'fallback',
    count: 1,
    items: [
      {
        id: 'one-sentence-project',
        name: 'One-Sentence Project',
        nameZh: '一句话交付项目',
        description: 'Turn a one-sentence request into a deployable public tracker site.',
        descriptionZh: '把一句话需求变成可上线的公域数据站。',
        category: 'methodology',
        author: 'chengxi-Z',
        repo: 'chengxi-Z/llm-pulse',
        url: 'https://github.com/chengxi-Z/llm-pulse/tree/main/skills/one-sentence-project',
        license: 'MIT',
        stars: null,
        updatedAt: '2026-11-03T12:00:00.000Z',
        sourceType: 'mine',
        tags: ['methodology', 'agent-skill'],
        featured: true,
        lang: 'en',
        whenToUse: 'One-sentence request for a public tracker site.',
        whenToUseZh: '一句话需求做公域数据站时。',
        whenNotToUse: 'Generic web apps, backends, accounts or real-time systems.',
        whenNotToUseZh: '通用 Web 应用、后端、账号或实时系统。',
        install: { target: '~/.dsh/skills/one-sentence-project', command: 'cp -r skills/one-sentence-project ~/.dsh/skills/' },
        usageSteps: ['Copy the skill into your local skills directory.', 'Describe your one-sentence request.', 'Run the POC to Release workflow.'],
        usageStepsZh: ['复制技能到本机 skills 目录。', '描述一句话需求。', '按 POC → Release 流程执行。'],
        skillPath: 'skills/one-sentence-project/SKILL.md'
      }
    ],
  },
  projects: {
    schemaVersion: 1,
    generatedAt: '2026-11-03T12:00:00.000Z',
    source: 'fallback',
    items: [
      { id: 'ai-pulse', name: 'AI Pulse · 照胆云', owner: 'chengxi-Z', url: 'https://github.com/chengxi-Z/llm-pulse', repo: 'chengxi-Z/llm-pulse', summary: '公域轻量级大模型追踪站。', tags: ['static-site'], highlight: '纯静态 + 每日自动刷新', sourceType: 'self', license: 'MIT', stars: null, updatedAt: '2026-11-03T00:00:00.000Z', why: '个人 AI 项目成果展示位。' },
    ],
  },
};

export { DATA_BASE };
