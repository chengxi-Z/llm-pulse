import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DISTRIBUTION_STRIP,
  SHARE_LINKS,
  boardDeepLink,
  boardPayloadFromData,
  buildShareMessage,
  formatShareDate,
  normalizeSharePayload,
  shareIntent,
} from '../site/assets/js/share.js';

const SITE = 'https://chengxi-z.github.io/llm-pulse/';
const GITHUB = 'https://github.com/chengxi-Z/llm-pulse';

const BOARD = {
  id: 'lmarena-text',
  name: 'LMArena 文本总榜',
  description: '人类盲测偏好的 Elo 排名，衡量通用对话体验。',
  sourceName: 'LMArena',
  sourceUrl: 'https://lmarena.ai/leaderboard',
  updatedAt: '2026-11-01T00:00:00.000Z',
  metric: { name: 'Arena Score', unit: 'elo', higherIsBetter: true },
  entries: [
    { rank: 1, model: 'GPT-6.1 Terra Pro', org: 'OpenAI', score: 1482, scoreDisplay: '1482' },
    { rank: 2, model: 'Kimi K3.1 Pro', org: 'Moonshot', score: 1470, scoreDisplay: '1470' },
    { rank: 3, model: 'DeepSeek V4.1 Flash', org: 'DeepSeek', score: 1455, scoreDisplay: '1455' },
    { rank: 4, model: 'GLM-5.3 FlashX', org: 'Z.ai', score: 1440, scoreDisplay: '1440' },
  ],
};

test('SHARE_LINKS 提供站点 / GitHub / RSS 规范地址', () => {
  assert.equal(SHARE_LINKS.siteUrl, SITE);
  assert.equal(SHARE_LINKS.siteHost, 'chengxi-z.github.io/llm-pulse');
  assert.equal(SHARE_LINKS.githubUrl, GITHUB);
  assert.equal(SHARE_LINKS.githubHost, 'github.com/chengxi-Z/llm-pulse');
  assert.equal(SHARE_LINKS.rssUrl, `${SITE}feed.xml`);
});

test('normalizeSharePayload：默认 news 与基础字段', () => {
  const data = normalizeSharePayload({ title: ' 新闻标题 ', desc: '摘要', url: 'https://example.com/a', stats: '451 个模型' });
  assert.equal(data.kind, 'news');
  assert.equal(data.title, '新闻标题');
  assert.equal(data.desc, '摘要');
  assert.equal(data.url, 'https://example.com/a');
  assert.equal(data.stats, '451 个模型');
  assert.equal(data.board, null);
  assert.equal(data.install, '');
  // Empty payload still yields usable title and URL (cards are never blank).
  const empty = normalizeSharePayload({});
  assert.ok(empty.title.length > 0);
  assert.equal(empty.url, SITE);
});

test('normalizeSharePayload：legacy type 映射到 v1.2 kind', () => {
  assert.equal(normalizeSharePayload({ type: 'ranking' }).kind, 'board');
  assert.equal(normalizeSharePayload({ type: 'news' }).kind, 'news');
  assert.equal(normalizeSharePayload({ type: 'model' }).kind, 'news');
  assert.equal(normalizeSharePayload({ type: 'page' }).kind, 'site');
  assert.equal(normalizeSharePayload({ type: 'skill' }).kind, 'skill');
  assert.equal(normalizeSharePayload({ kind: 'board' }).kind, 'board');
});

test('normalizeSharePayload：board 提取 id / top10 / 指标 / 更新 / 来源', () => {
  const data = normalizeSharePayload({
    kind: 'board',
    title: 'LMArena 文本总榜',
    url: `${SITE}rankings.html#board-lmarena-text`,
    board: BOARD,
  });
  assert.equal(data.kind, 'board');
  assert.equal(data.board.id, 'lmarena-text');
  assert.equal(data.board.metric, 'Arena Score');
  assert.equal(data.board.updatedAt, BOARD.updatedAt);
  assert.equal(data.board.source, 'LMArena');
  assert.equal(data.board.rows.length, 4); // fixture has 4 entries, capped at Top10
  assert.deepEqual(data.board.rows[0], { rank: 1, model: 'GPT-6.1 Terra Pro', score: '1482', releaseDate: '' });
  // Without a board object the id is inferred from the deep-link hash and desc is kept.
  const fallback = normalizeSharePayload({ kind: 'board', url: `${SITE}rankings.html#board-context-window`, desc: 'Top3: ...' });
  assert.equal(fallback.board.id, 'context-window');
  assert.equal(fallback.board.rows.length, 0);
});

test('normalizeSharePayload：board 最多保留 Top10', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, model: `Model ${i + 1}`, score: String(1500 - i) }));
  const data = normalizeSharePayload({ kind: 'board', board: { id: 'many', entries } });
  assert.equal(data.board.rows.length, 10);
  assert.equal(data.board.rows[0].rank, 1);
  assert.equal(data.board.rows[9].rank, 10);
});

test('boardDeepLink 生成 #board-<id> 绝对深链并编码', () => {
  assert.equal(boardDeepLink('lmarena-text'), `${SITE}rankings.html#board-lmarena-text`);
  assert.equal(boardDeepLink('a b/c'), `${SITE}rankings.html#board-a%20b%2Fc`);
});

test('boardPayloadFromData 从 rankings.json 构造榜单卡片 payload', () => {
  const objectShape = boardPayloadFromData({ rankings: { boards: [BOARD] } }, 'lmarena-text');
  assert.ok(objectShape);
  assert.equal(objectShape.kind, 'board');
  assert.equal(objectShape.title, 'LMArena 文本总榜');
  assert.equal(objectShape.url, `${SITE}rankings.html#board-lmarena-text`);
  assert.equal(objectShape.stats, 'Arena Score · LMArena');
  assert.deepEqual(objectShape.board.rows[0], { rank: 1, model: 'GPT-6.1 Terra Pro', score: '1482', releaseDate: '' });
  // Array form is supported too.
  assert.ok(boardPayloadFromData({ rankings: [BOARD] }, 'lmarena-text'));
  // Unknown board returns null so callers fall back to data-* copy.
  assert.equal(boardPayloadFromData({ rankings: { boards: [BOARD] } }, 'missing-board'), null);
  assert.equal(boardPayloadFromData(null, 'lmarena-text'), null);
});

test('skill payload：install 从 stats 或 install 字段读取', () => {
  const fromStats = normalizeSharePayload({ kind: 'skill', title: 'One-Sentence Project', stats: '~/.dsh/skills/one-sentence-project' });
  assert.equal(fromStats.install, '~/.dsh/skills/one-sentence-project');
  const fromField = normalizeSharePayload({ kind: 'skill', title: 'X', install: '~/.claude/skills/x', stats: 'ignored' });
  assert.equal(fromField.install, '~/.claude/skills/x');
});

test('buildShareMessage 始终包含站点 URL 与 GitHub 地址（长文案不截断地址）', () => {
  const longTitle = `OpenAI 发布 GPT-6.1 Terra Pro：${'很长的标题'.repeat(20)}`;
  const message = buildShareMessage({
    title: longTitle,
    desc: '旗舰线更新，价格 $1/$5。'.repeat(10),
    url: 'https://openrouter.ai/openai/gpt-6.1-terra-pro',
    stats: '451 个模型',
  });
  assert.ok(message.includes(SITE), '缺少站点 URL');
  assert.ok(message.includes(GITHUB), '缺少 GitHub 地址');
  assert.ok(message.includes('451 个模型'));
  // The entry link itself is kept as well.
  assert.ok(message.includes('https://openrouter.ai/openai/gpt-6.1-terra-pro'));
  // Summary is truncated while the addresses stay complete.
  assert.ok(!message.includes('很长的标题'.repeat(20)));
});

test('buildShareMessage 支持自定义 lang 与地址覆盖（测试注入）', () => {
  const message = buildShareMessage({ title: 'Hello' }, { lang: 'en', siteUrl: 'https://preview.test/', githubUrl: 'https://github.test/repo' });
  assert.ok(message.includes('https://preview.test/'));
  assert.ok(message.includes('https://github.test/repo'));
  assert.ok(message.includes('AI Pulse'));
});

test('shareIntent：X / Telegram / 微博 文本均含站点与 GitHub 地址', () => {
  const payload = { title: '榜单分享', url: `${SITE}rankings.html#board-lmarena-text`, board: BOARD, kind: 'board' };
  for (const name of ['x', 'telegram', 'weibo']) {
    const url = shareIntent(name, payload);
    assert.ok(url.startsWith('https://'), `${name} 意图 URL 无效`);
    const decoded = decodeURIComponent(url);
    assert.ok(decoded.includes(SITE), `${name} 缺少站点 URL`);
    assert.ok(decoded.includes(GITHUB), `${name} 缺少 GitHub 地址`);
    assert.ok(decoded.includes('rankings.html#board-lmarena-text'), `${name} 缺少榜单深链`);
  }
  assert.equal(shareIntent('unknown', payload), '');
  // Long titles are truncated in intents but addresses are kept.
  const longIntent = decodeURIComponent(shareIntent('x', { title: '标题'.repeat(200) }));
  assert.ok(longIntent.includes(SITE));
  assert.ok(longIntent.includes(GITHUB));
});

test('formatShareDate 中英文本地化日期', () => {
  assert.equal(formatShareDate('2026-11-03T12:00:00.000Z', 'zh'), '2026.11.03');
  assert.equal(formatShareDate('2026-11-03T12:00:00.000Z', 'en'), 'Nov 3, 2026');
  assert.equal(formatShareDate('not-a-date', 'zh'), '');
});

test('share.js 体积增量满足 v1.2 预算（≤6KB raw）', async () => {
  const size = (await fs.stat(new URL('../site/assets/js/share.js', import.meta.url))).size;
  const baseline = 26143; // v1.1.1 released share.js size
  assert.ok(size <= baseline + 6000, `share.js ${size}B exceeds v1.1.1 ${baseline}B + 6KB budget`);
});

test('v1.4 极简分发 strip：高度 ≤12%、二维码 56–64px、地址字号 ≤16px', () => {
  assert.ok(DISTRIBUTION_STRIP.ratio <= 0.12, `strip ratio ${DISTRIBUTION_STRIP.ratio}`);
  assert.ok(DISTRIBUTION_STRIP.top + DISTRIBUTION_STRIP.height <= 604, 'strip must stay inside the gold frame');
  assert.ok(DISTRIBUTION_STRIP.qrSize >= 56 && DISTRIBUTION_STRIP.qrSize <= 64, `qr=${DISTRIBUTION_STRIP.qrSize}px`);
  assert.ok(DISTRIBUTION_STRIP.siteFont <= 16 && DISTRIBUTION_STRIP.repoFont <= 16, 'address fonts must be <=16px');
});

test('share.js 安全约束：无动态代码 / 本地存储 / 分析上报', async () => {
  const src = await fs.readFile(new URL('../site/assets/js/share.js', import.meta.url), 'utf8');
  for (const pattern of [/\beval\s*\(/, /\bnew Function\b/, /document\.write/, /localStorage/, /console\.(log|info|debug)\(/]) {
    assert.ok(!pattern.test(src), `share.js must not contain ${pattern}`);
  }
});
