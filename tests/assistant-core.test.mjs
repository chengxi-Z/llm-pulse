import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_MAX_BYTES,
  DEFAULT_CONFIG,
  buildBrief,
  buildChatPayload,
  buildContext,
  buildShareText,
  buildSystemPrompt,
  chatCompletionsUrl,
  classifyError,
  composeMessages,
  createSSEParser,
  detectIntent,
  extractDelta,
  fitLinesToBytes,
  getBoards,
  getModels,
  isRoutingPseudoModel,
  localAnswer,
  markdownToPlain,
  normalizeConfig,
  parseSSE,
  priceScore,
  safeMarkdown,
  truncateUtf8,
  utf8Bytes,
} from '../site/assets/js/assistant-core.js';

/* ------------------------------- Fixtures ------------------------------- */

const MODELS = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  models: [
    {
      id: 'openai/gpt-6.1-terra-pro',
      name: 'GPT-6.1 Terra Pro',
      org: 'OpenAI',
      releaseDate: '2026-10-26',
      contextWindow: 1050000,
      openWeights: false,
      license: null,
      pricing: { input: 1, output: 5, currency: 'USD', unit: 'per_1m_tokens' },
      links: { api: 'https://openrouter.ai/openai/gpt-6.1-terra-pro' },
      description: 'OpenAI 旗舰推理模型',
    },
    {
      id: 'deepseek/v4.1-flash',
      name: 'DeepSeek V4.1 Flash',
      org: 'DeepSeek',
      releaseDate: '2026-11-01',
      contextWindow: 256000,
      openWeights: false,
      pricing: { input: 0.1, output: 0.3 },
      description: '高性价比快速模型',
    },
    {
      id: 'meta/muse-spark-open',
      name: 'Muse Spark Open',
      org: 'Meta',
      releaseDate: '2026-10-20',
      contextWindow: null,
      openWeights: true,
      license: 'Apache-2.0',
      pricing: { input: 0, output: 0 },
      description: '开源权重模型',
    },
    {
      // OpenRouter routing pseudo-models must not appear in offline answer/brief model conclusions
      id: 'openrouter/auto',
      name: 'Auto Router (Beta)',
      org: 'openrouter',
      releaseDate: '2026-11-02',
      contextWindow: 2000000,
      openWeights: false,
      pricing: { input: -1000000, output: -1000000 },
      description: '自动路由',
    },
  ],
};

const NEWS = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  items: [
    {
      id: 'release-gpt-terra',
      title: 'OpenAI 发布 GPT-6.1 Terra Pro：1.05M 上下文',
      summary: '旗舰线更新，价格 $1/$5。',
      kind: 'release',
      sourceName: 'OpenRouter',
      sourceUrl: 'https://openrouter.ai/api/v1/models',
      url: 'https://openrouter.ai/openai/gpt-6.1-terra-pro',
      publishedAt: '2026-10-26T00:00:00.000Z',
      tags: ['OpenAI', '推理'],
      importance: 3,
    },
    {
      id: 'pricing-deepseek-flash',
      title: 'DeepSeek V4.1 Flash 降价',
      summary: '输入价格下调。',
      kind: 'pricing',
      sourceName: '官方博客',
      sourceUrl: 'https://api-docs.deepseek.com/news',
      url: null,
      publishedAt: '2026-11-01T00:00:00.000Z',
      tags: ['DeepSeek', '价格'],
      importance: 2,
    },
  ],
};

const RANKINGS = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  boards: [
    {
      id: 'lmarena-text',
      name: 'LMArena 文本总榜',
      description: '盲测偏好 Elo',
      sourceName: 'LMArena',
      sourceUrl: 'https://lmarena.ai/leaderboard',
      updatedAt: '2026-11-01T00:00:00.000Z',
      metric: { name: 'Arena Score', unit: 'elo', higherIsBetter: true },
      entries: [
        { rank: 1, model: 'GPT-6.1 Terra Pro', org: 'OpenAI', score: 1482, scoreDisplay: '1482' },
        { rank: 2, model: 'Kimi K3.1 Pro', org: 'Moonshot', score: 1470, scoreDisplay: '1470' },
        { rank: 3, model: 'DeepSeek V4.1 Flash', org: 'DeepSeek', score: 1455, scoreDisplay: '1455' },
      ],
    },
  ],
};

const RESOURCES = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  items: [
    {
      id: 'hf-llm-course',
      title: 'Hugging Face LLM Course',
      type: 'course',
      level: 'beginner',
      lang: 'en',
      url: 'https://huggingface.co/learn/llm-course',
      description: '系统课程',
      free: true,
      featured: true,
      addedAt: '2026-11-03T00:00:00.000Z',
    },
    {
      id: 'survey-paper',
      title: 'LLM Survey 2026',
      type: 'paper',
      level: 'advanced',
      lang: 'en',
      url: 'https://arxiv.org/abs/1234.5678',
      description: '综述',
      free: true,
      featured: false,
      addedAt: '2026-11-03T00:00:00.000Z',
    },
  ],
};

const PROJECTS = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  items: [
    {
      id: 'open-webui',
      name: 'Open WebUI',
      owner: 'open-webui',
      url: 'https://github.com/open-webui/open-webui',
      summary: '自托管 LLM Web 界面',
      tags: ['chat-ui'],
      sourceType: 'community',
      stars: 112000,
    },
    {
      id: 'self-pulse',
      name: 'AI Pulse 本身',
      owner: 'chengxi-Z',
      url: 'https://github.com/chengxi-Z/llm-pulse',
      summary: '本项目',
      tags: ['site'],
      sourceType: 'self',
      stars: 1,
    },
  ],
};

const META = {
  schemaVersion: 1,
  generatedAt: '2026-11-03T12:00:00.000Z',
  mode: 'seed',
  site: { name: 'AI Pulse', brand: '照胆云', version: '1.0.0' },
  stats: { models: 3, news: 2, boards: 1, resources: 2, projects: 2, orgs: 2, sourcesOk: 1, sourcesDegraded: 1 },
  sources: [
    { id: 'openrouter', name: 'OpenRouter', type: 'api', status: 'ok', lastFetchedAt: '2026-11-03T12:00:00.000Z', items: 3 },
    { id: 'lmarena', name: 'LMArena', type: 'dataset', status: 'degraded', lastFetchedAt: null, items: 0 },
  ],
  latestHighlights: ['OpenRouter 新增模型', 'LMArena 榜单降级'],
};

const DATA = { meta: META, models: MODELS, news: NEWS, rankings: RANKINGS, resources: RESOURCES, projects: PROJECTS };

/* ----------------------------- Test helpers ----------------------------- */

test('utf8Bytes / truncateUtf8 按字节裁剪且不切断多字节字符', () => {
  assert.equal(utf8Bytes('abc'), 3);
  assert.equal(utf8Bytes('中文'), 6);
  assert.equal(utf8Bytes('😀'), 4);
  const out = truncateUtf8('中文😀abc', 8);
  assert.ok(utf8Bytes(out) <= 8);
  assert.ok(!out.includes('\uFFFD'));
  assert.equal(truncateUtf8('abc', 10), 'abc');
  assert.equal(truncateUtf8('abc', 0), '');
});

test('fitLinesToBytes 保留整行且不超过上限', () => {
  const text = ['# 标题', '第一行内容', '第二行内容', '第三行内容'].join('\n');
  const out = fitLinesToBytes(text, 40);
  assert.ok(utf8Bytes(out) <= 40, `实际 ${utf8Bytes(out)} 字节`);
  assert.ok(out.startsWith('# 标题'));
  assert.ok(out.includes('已截断'));
  assert.equal(fitLinesToBytes(text, 1000), text);
  // When the budget is very small, degrade to pure truncation but never exceed it
  const tiny = fitLinesToBytes(text, 30);
  assert.ok(utf8Bytes(tiny) <= 30);
  assert.ok(!tiny.includes('\uFFFD'));
});

/* ---------------------------- buildContext ---------------------------- */

test('buildContext 生成摘要并控制在 6KB 内', () => {
  const ctx = buildContext(DATA);
  assert.ok(ctx.includes('GPT-6.1 Terra Pro'));
  assert.ok(ctx.includes('上下文'));
  assert.ok(ctx.includes('最新动态'));
  assert.ok(ctx.includes('LMArena 文本总榜'));
  assert.ok(ctx.includes('Hugging Face LLM Course'));
  assert.ok(ctx.includes('Open WebUI'));
  assert.ok(utf8Bytes(ctx) <= CONTEXT_MAX_BYTES, `上下文 ${utf8Bytes(ctx)} 字节 > ${CONTEXT_MAX_BYTES}`);
});

test('buildContext 支持自定义预算并保证不超限', () => {
  const small = buildContext(DATA, { maxBytes: 400 });
  assert.ok(utf8Bytes(small) <= 400, `实际 ${utf8Bytes(small)} 字节`);
  const tiny = buildContext(DATA, { maxBytes: 120 });
  assert.ok(utf8Bytes(tiny) <= 120);
});

test('buildContext 对空/缺失数据优雅降级', () => {
  const ctx = buildContext(null);
  assert.ok(ctx.includes('站点数据摘要'));
  assert.ok(ctx.includes('暂不可用'));
  assert.ok(utf8Bytes(ctx) <= CONTEXT_MAX_BYTES);
  // Partial data with only meta must not throw
  assert.doesNotThrow(() => buildContext({ meta: { generatedAt: '2026-11-03T00:00:00.000Z' } }));
});

test('buildContext 兼容 loadAll() 返回的数组形态', () => {
  const data = { meta: META, models: MODELS.models, news: NEWS.items, rankings: RANKINGS.boards, resources: RESOURCES.items, projects: PROJECTS.items };
  const ctx = buildContext(data);
  assert.ok(ctx.includes('GPT-6.1 Terra Pro'));
  assert.equal(getModels({ models: MODELS.models }).length, 4);
  assert.equal(getBoards({ rankings: RANKINGS.boards }).length, 1);
});

test('isRoutingPseudoModel 过滤 OpenRouter 路由/自动聚合伪模型', () => {
  assert.equal(isRoutingPseudoModel({ id: 'openrouter/auto', name: 'Auto Router (Beta)' }), true);
  assert.equal(isRoutingPseudoModel({ id: 'openrouter/auto-beta', name: 'Auto' }), true);
  assert.equal(isRoutingPseudoModel({ id: 'x/pareto-code-router', name: 'Pareto Code Router' }), true);
  assert.equal(isRoutingPseudoModel({ id: 'openai/gpt-6.1-terra', name: 'GPT-6.1 Terra' }), false);
  assert.equal(isRoutingPseudoModel({ id: 'meta/muse-spark-open', name: 'Muse Spark Open' }), false);
  assert.equal(isRoutingPseudoModel(null), false);
  // The context summary must not list pseudo-models among "recent releases"
  const ctx = buildContext(DATA);
  assert.ok(!ctx.includes('Auto Router'));
});

test('buildSystemPrompt / composeMessages 注入上下文与历史', () => {
  const ctx = buildContext(DATA);
  const sys = buildSystemPrompt(ctx);
  assert.ok(sys.includes('AI Pulse'));
  assert.ok(sys.includes(ctx));
  const messages = composeMessages('现在有哪些新模型？', ctx, [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好，我是助手' },
    { role: 'system', content: '不应出现' },
  ]);
  assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.includes('站点数据摘要'));
  assert.equal(messages.at(-1).role, 'user');
  assert.ok(!messages.some((m) => m.content === '不应出现'));
  assert.equal(messages.filter((m) => m.role === 'user').length, 2);
});

/* ------------------------------- SSE ------------------------------- */

test('parseSSE 解析完整 OpenAI 兼容流并拼接文本', () => {
  const body =
    'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"好！"}}]}\n\n' +
    ': keep-alive\n\n' +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
    'data: [DONE]\n\n';
  const result = parseSSE(body);
  assert.equal(result.text, '你好！');
  assert.equal(result.done, true);
  assert.equal(result.errors.length, 0);
});

test('createSSEParser 支持任意字符串分块（含事件被拆开）', () => {
  const body = 'data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: {"choices":[{"delta":{"content":"B"}}]}\n\ndata: [DONE]\n\n';
  for (let cut = 1; cut < body.length; cut += 7) {
    const parser = createSSEParser();
    const chunks = [body.slice(0, cut), body.slice(cut, cut * 2 + 1), body.slice(cut * 2 + 1)];
    let text = '';
    let done = false;
    for (const chunk of chunks) {
      const res = parser.push(chunk);
      text += res.deltas.join('');
      done = done || res.done;
    }
    const tail = parser.end();
    text += tail.deltas.join('');
    done = done || tail.done;
    assert.equal(text, 'AB', `cut=${cut}`);
    assert.equal(done, true, `cut=${cut} 未识别 [DONE]`);
  }
});

test('createSSEParser 在任意字节位置分块也能正确解码多字节 UTF-8', () => {
  const content = '中文😀混合ABC';
  const body =
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n` + 'data: [DONE]\n\n';
  const bytes = new TextEncoder().encode(body);
  for (let cut = 1; cut < bytes.length; cut += 3) {
    const parser = createSSEParser();
    const first = parser.push(bytes.subarray(0, cut));
    const second = parser.push(bytes.subarray(cut));
    const last = parser.end();
    const text = first.deltas.join('') + second.deltas.join('') + last.deltas.join('');
    assert.equal(text, content, `cut=${cut} 时多字节解码错误`);
    assert.ok(first.done || second.done || last.done);
  }
});

test('parseSSE 处理 CRLF、缺失尾行与非法 JSON', () => {
  const crlf = 'data: {"choices":[{"delta":{"content":"ok"}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  assert.equal(parseSSE(crlf).text, 'ok');
  const noTrailing = 'data: {"choices":[{"delta":{"content":"end"}}]}';
  const tail = parseSSE(noTrailing);
  assert.equal(tail.text, 'end');
  assert.equal(tail.done, false);
  const bad = 'data: not-json\n\ndata: {"choices":[{"delta":{"content":"x"}}]}\n\n';
  const mixed = parseSSE(bad);
  assert.equal(mixed.text, 'x');
  assert.equal(mixed.errors.length, 1);
});

test('extractDelta 兼容 delta/message/数组格式与 error', () => {
  assert.equal(extractDelta({ choices: [{ delta: { content: 'a' } }] }), 'a');
  assert.equal(extractDelta({ choices: [{ message: { content: 'b' } }] }), 'b');
  assert.equal(extractDelta({ choices: [{ delta: { content: [{ text: 'c' }, { text: 'd' }] } }] }), 'cd');
  assert.equal(extractDelta({ error: { message: 'bad key' } }), '');
  assert.equal(extractDelta(null), '');
});

/* --------------------------- safeMarkdown --------------------------- */

test('safeMarkdown 转义 HTML 且阻止 javascript: 链接', () => {
  const html = safeMarkdown('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  const link = safeMarkdown('[点我](javascript:alert(1))');
  assert.ok(!/href\s*=\s*"javascript:/i.test(link));
  assert.ok(!link.includes('<a'));
  const dataLink = safeMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)');
  assert.ok(!dataLink.includes('<a'));
  // Malicious href with quotes: escaping prevents real attribute injection (quotes are entities after serialization)
  const evilAttr = safeMarkdown('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!evilAttr.includes('onmouseover="alert'));
});

test('safeMarkdown 渲染粗体/列表/行内代码/链接/标题', () => {
  const html = safeMarkdown('## 标题\n\n**加粗** 与 `code`\n\n- 一\n- 二\n\n1. 甲\n2. 乙\n\n[链接](https://example.com/a?b=1&c=2)');
  assert.ok(html.includes('<h3>标题</h3>'));
  assert.ok(html.includes('<strong>加粗</strong>'));
  assert.ok(html.includes('<code>code</code>'));
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<li>一</li>'));
  assert.ok(html.includes('<ol>'));
  assert.ok(html.includes('href="https://example.com/a?b=1&amp;c=2"'));
  assert.ok(html.includes('rel="noopener noreferrer nofollow"'));
});

test('safeMarkdown 处理代码块与普通文本换行', () => {
  const html = safeMarkdown('前\n后\n\n```js\nconst a = "<b>";\n```');
  assert.ok(html.includes('<p>前<br>后</p>'));
  assert.ok(html.includes('const a = &quot;&lt;b&gt;&quot;'));
  assert.ok(html.includes('<pre class="md-pre">'));
});

/* ---------------------------- localAnswer ---------------------------- */

test('detectIntent 识别常见意图', () => {
  assert.equal(detectIntent('现在上下文最长的模型？'), 'context');
  assert.equal(detectIntent('性价比最高的模型'), 'price');
  assert.equal(detectIntent('本周要点简报'), 'brief');
  assert.equal(detectIntent('推荐入门课程'), 'learn');
  assert.equal(detectIntent('排行榜第一是谁'), 'ranking');
  assert.equal(detectIntent('最近有什么新动态'), 'news');
  assert.equal(detectIntent('有哪些开源模型'), 'open');
  assert.equal(detectIntent('数据源可靠吗'), 'about');
  assert.equal(detectIntent('随便聊聊天气'), 'fallback');
});

test('localAnswer 离线回答上下文、价格、榜单、资源、项目', () => {
  const ctx = localAnswer('现在上下文最长的模型是哪个？', DATA);
  assert.ok(ctx.includes('GPT-6.1 Terra Pro'));
  assert.ok(ctx.includes('1.05M'));
  assert.ok(!ctx.includes('Auto Router'), '路由伪模型不应出现在上下文最长结论中');
  assert.ok(!ctx.includes('2M tokens'), '伪模型 2M 上下文不应出现');

  const price = localAnswer('性价比最高的模型？', DATA);
  assert.ok(price.includes('DeepSeek V4.1 Flash'));
  assert.ok(price.includes('每 1M tokens'));
  assert.ok(!price.includes('Auto Router'));

  const rank = localAnswer('排行榜第一是谁？', DATA);
  assert.ok(rank.includes('LMArena'));
  assert.ok(rank.includes('GPT-6.1 Terra Pro'));

  const learn = localAnswer('推荐入门课程', DATA);
  assert.ok(learn.includes('Hugging Face LLM Course'));

  const proj = localAnswer('有哪些项目？', DATA);
  assert.ok(proj.includes('Open WebUI'));

  const news = localAnswer('最近有什么新动态？', DATA);
  assert.ok(news.includes('GPT-6.1 Terra Pro'));
});

test('localAnswer 无数据/空问题时给出友好降级', () => {
  const empty = localAnswer('上下文最长？', null);
  assert.ok(empty.includes('站点数据暂不可用'));
  const empty2 = localAnswer('推荐课程', {});
  assert.ok(empty2.includes('站点数据暂不可用'));
  assert.ok(localAnswer('', DATA).length > 0);
});

test('localAnswer 未命中关键词时做本地检索兜底', () => {
  const out = localAnswer('Terra 有什么特点？', DATA);
  assert.ok(/GPT-6\.1 Terra Pro|没有在站点数据中直接检索到/.test(out));
});

/* ----------------------------- buildBrief ----------------------------- */

test('buildBrief 生成五段式简报，含日期与来源', () => {
  const brief = buildBrief(DATA, { now: new Date('2026-11-03T12:00:00.000Z'), siteUrl: 'https://example.com/llm-pulse/' });
  assert.ok(brief.startsWith('# AI Pulse · 本周 AI 简报'));
  assert.ok(brief.includes('2026-11-03'));
  assert.ok(brief.includes('## 一、关键数字'));
  assert.ok(brief.includes('## 二、本周新模型'));
  assert.ok(brief.includes('DeepSeek V4.1 Flash')); // 2026-11-01 falls inside the current-week window
  assert.ok(brief.includes('## 三、榜单风向'));
  assert.ok(brief.includes('## 四、值得一读的动态'));
  assert.ok(brief.includes('## 五、学习与项目'));
  assert.ok(brief.includes('https://example.com/llm-pulse/'));
  assert.ok(utf8Bytes(brief) < 8000);
});

test('buildBrief 无数据时返回可读提示', () => {
  const brief = buildBrief(null, { now: new Date('2026-11-03T12:00:00.000Z') });
  assert.ok(brief.includes('站点数据暂不可用'));
});

test('markdownToPlain 去除 Markdown 标记', () => {
  const plain = markdownToPlain('# 标题\n\n- **要点** [链接](https://a.com) `code`');
  assert.ok(plain.includes('标题'));
  assert.ok(plain.includes('要点'));
  assert.ok(plain.includes('链接（https://a.com）'));
  assert.ok(!plain.includes('**'));
  assert.ok(!plain.includes('`'));
});

/* --------------------------- Config / errors --------------------------- */

test('normalizeConfig 规范化配置并回退非法 baseUrl', () => {
  const a = normalizeConfig({ baseUrl: 'https://api.deepseek.com/v1/', model: ' deepseek-chat ', apiKey: ' sk-test ' });
  assert.equal(a.config.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(a.config.model, 'deepseek-chat');
  assert.equal(a.config.apiKey, 'sk-test');
  assert.equal(a.warnings.length, 0);
  const b = normalizeConfig({ baseUrl: 'ftp://x', apiKey: 'k' });
  assert.equal(b.config.baseUrl, DEFAULT_CONFIG.baseUrl);
  assert.equal(b.warnings.length, 1);
  assert.equal(normalizeConfig(null).config.model, DEFAULT_CONFIG.model);
});

test('chatCompletionsUrl 兼容完整端点与 /v1 前缀', () => {
  assert.equal(chatCompletionsUrl('https://api.deepseek.com/v1'), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.deepseek.com/v1/'), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://openrouter.ai/api/v1/chat/completions'), 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.siliconflow.cn/v1'), 'https://api.siliconflow.cn/v1/chat/completions');
});

test('classifyError 归类 401/429/5xx/网络/超时', () => {
  assert.equal(classifyError({ status: 401 }).kind, 'auth');
  assert.ok(classifyError({ status: 401 }).message.includes('API Key'));
  assert.equal(classifyError({ status: 404 }).kind, 'notfound');
  assert.equal(classifyError({ status: 429 }).kind, 'rate');
  assert.equal(classifyError({ status: 503 }).kind, 'server');
  assert.equal(classifyError({ name: 'AbortError' }).kind, 'timeout');
  assert.equal(classifyError({ name: 'TypeError', message: 'Failed to fetch' }).kind, 'network');
  assert.ok(classifyError({ status: 401 }).offlineAvailable);
});

test('buildChatPayload 组装 OpenAI 兼容请求体', () => {
  const payload = buildChatPayload({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], stream: true, maxTokens: 800 });
  assert.equal(payload.model, 'deepseek-chat');
  assert.equal(payload.stream, true);
  assert.equal(payload.max_tokens, 800);
  assert.ok(!('temperature' in payload));
  assert.deepEqual(buildChatPayload({ messages: [] }).messages, []);
});

test('priceScore 计算价格合计', () => {
  assert.equal(priceScore({ pricing: { input: 1, output: 5 } }), 6);
  assert.equal(priceScore({}), Number.POSITIVE_INFINITY);
});

test('buildShareText 生成分享文案', () => {
  const text = buildShareText({ title: 'GPT-6.1 发布', desc: '1.05M 上下文', url: 'https://a.com/x', stats: '451 模型' });
  assert.ok(text.includes('【AI Pulse · 照胆云】GPT-6.1 发布'));
  assert.ok(text.includes('1.05M 上下文'));
  assert.ok(text.includes('451 模型'));
  assert.ok(text.includes('https://a.com/x'));
});
