import { buildShareText } from './assistant-core.js';
import { getLang, t } from './i18n.js';

const CARD_W = 1200;
const CARD_H = 630;
const SITE_URL = 'https://chengxi-z.github.io/llm-pulse/';
const SITE_HOST = 'chengxi-z.github.io/llm-pulse';
const GITHUB_URL = 'https://github.com/chengxi-Z/llm-pulse';
const GITHUB_HOST = 'github.com/chengxi-Z/llm-pulse';
const RSS_URL = `${SITE_URL}feed.xml`;
const QR_SRC = 'assets/img/qr-site.png';
const FONT_SANS = '"Inter","PingFang SC","Microsoft YaHei",system-ui,sans-serif';
const FONT_SERIF = '"Cormorant Garamond","Noto Serif SC","Songti SC","SimSun",Georgia,serif';
const KINDS = ['news', 'board', 'skill', 'site'];
const KIND_KEYS = { news: 'share.kind.news', board: 'share.kind.board', skill: 'share.kind.skill', site: 'share.kind.site' };
const KIND_BY_TYPE = {
  news: 'news', board: 'board', ranking: 'board', skill: 'skill',
  model: 'news', resource: 'news', project: 'news', page: 'site', site: 'site',
};
export const SHARE_LINKS = { siteUrl: SITE_URL, siteHost: SITE_HOST, githubUrl: GITHUB_URL, githubHost: GITHUB_HOST, rssUrl: RSS_URL };
/** v1.4 minimal distribution strip metrics (height must stay <= 12% of the card). */
export const DISTRIBUTION_STRIP = { top: 532, height: 72, ratio: 72 / 630, qrSize: 58, siteFont: 15, repoFont: 12.5 };

const state = { mounted: false, menu: null, modal: null, lastFocus: null, blob: null, toast: 0, qr: undefined };
const siteName = () => (getLang() === 'en' ? 'AI Pulse' : 'AI Pulse · 照胆云');

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child != null) node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function toast(message) {
  if (!document.body) return;
  let node = document.getElementById('share-toast');
  if (!node) {
    node = el('div', { id: 'share-toast', class: 'share-toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(state.toast);
  state.toast = setTimeout(() => node.classList.remove('is-visible'), 2400);
}

async function copyText(text, message = t('ui.copied')) {
  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(String(text));
    } else {
      const area = el('textarea', { style: 'position:fixed;left:-9999px;top:0' });
      area.value = String(text);
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast(message);
    return true;
  } catch {
    toast(t('ui.copyFailed'));
    return false;
  }
}

const truncateText = (text, max = 120) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

function siteStatsLine(data) {
  const stats = (data || (typeof window !== 'undefined' ? window.__AIPULSE_DATA__ : null))?.meta?.stats;
  if (!stats) return '';
  const parts = [];
  if (stats.models) parts.push(t('share.card.countModels', { count: stats.models }));
  if (stats.news) parts.push(t('share.card.countNews', { count: stats.news }));
  if (stats.boards) parts.push(t('share.card.countBoards', { count: stats.boards }));
  if (stats.resources) parts.push(t('share.card.countResources', { count: stats.resources }));
  return parts.join(' · ');
}

let siteDataPromise = null;
async function resolveSiteData() {
  if (typeof window !== 'undefined' && window.__AIPULSE_DATA__) return window.__AIPULSE_DATA__;
  if (!siteDataPromise) {
    siteDataPromise = import('./data.js')
      .then((module) => (typeof module.loadAll === 'function' ? module.loadAll() : null))
      .catch(() => null);
  }
  return siteDataPromise;
}

async function resolveStats() {
  return siteStatsLine() || siteStatsLine(await resolveSiteData());
}

export function formatShareDate(value = new Date(), lang = getLang()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (lang === 'en') {
    try {
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    } catch {
    }
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function loadShareQr() {
  if (state.qr !== undefined) return Promise.resolve(state.qr);
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      state.qr = null;
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      state.qr = image;
      resolve(image);
    };
    image.onerror = () => {
      state.qr = null;
      resolve(null);
    };
    try {
      image.src = new URL(QR_SRC, document.baseURI).href;
    } catch {
      state.qr = null;
      resolve(null);
    }
  });
}

export function boardDeepLink(id, baseUrl = `${SITE_URL}rankings.html`) {
  return `${baseUrl}#board-${encodeURIComponent(String(id || ''))}`;
}

export function normalizeSharePayload(raw = {}, opts = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const declared = String(source.kind || source.type || '').toLowerCase();
  const kind = KINDS.includes(declared) ? declared : KIND_BY_TYPE[declared] || 'news';
  const title = String(source.title || '').trim() || siteName();
  let desc = String(source.desc || source.description || '').trim();
  const url = String(source.url || '').trim() || (kind === 'board' ? boardDeepLink('', `${SITE_URL}rankings.html`) : SITE_URL);
  const out = { kind, title, desc, url, stats: String(source.stats || '').trim(), board: null, install: '' };
  if (kind === 'board') {
    const board = source.board && typeof source.board === 'object' ? source.board : source;
    let id = String(board.id || '');
    if (!id) {
      try {
        id = decodeURIComponent(new URL(url, SITE_URL).hash.replace(/^#(?:board-)?/, ''));
      } catch {
      }
    }
    out.board = {
      id,
      metric: typeof board.metric === 'string' ? board.metric : String(board.metric?.name || ''),
      updatedAt: String(board.updatedAt || ''),
      source: String(board.sourceName || board.source || ''),
      rows: (Array.isArray(board.top3) ? board.top3 : Array.isArray(board.entries) ? board.entries : Array.isArray(board.rows) ? board.rows : [])
        .slice(0, 3)
        .map((entry, index) => ({
          rank: Number(entry?.rank) || index + 1,
          model: String(entry?.model || entry?.name || '').trim(),
          score: String(entry?.scoreDisplay ?? entry?.score ?? '').trim(),
        }))
        .filter((entry) => entry.model),
    };
    if (!desc) desc = String(board.description || '');
  } else if (kind === 'skill') {
    out.install = String(source.install || source.skill?.install || out.stats || '').trim();
  }
  return out;
}

export function boardPayloadFromData(data, boardId, opts = {}) {
  const source = data?.rankings;
  const boards = Array.isArray(source) ? source : Array.isArray(source?.boards) ? source.boards : [];
  const board = boards.find((item) => item && item.id === boardId);
  if (!board) return null;
  return normalizeSharePayload({
    kind: 'board',
    title: board.name || board.id,
    desc: board.description || '',
    url: boardDeepLink(board.id, opts.baseUrl || `${SITE_URL}rankings.html`),
    stats: [board.metric?.name, board.sourceName].filter(Boolean).join(' · '),
    board,
  });
}

async function hydratePayload(raw) {
  const data = normalizeSharePayload(raw);
  if (data.kind !== 'board' || !data.board?.id || data.board.rows.length) return data;
  const siteData = await resolveSiteData().catch(() => null);
  const resolved = siteData ? boardPayloadFromData(siteData, data.board.id) : null;
  if (!resolved) return data;
  return normalizeSharePayload({
    ...resolved,
    title: raw?.title || resolved.title,
    desc: raw?.desc || resolved.desc,
    url: raw?.url || resolved.url,
    stats: raw?.stats || resolved.stats,
  });
}

export function buildShareMessage(payload = {}, opts = {}) {
  const data = normalizeSharePayload(payload, opts);
  const base = buildShareText(
    { title: truncateText(data.title, 90), desc: data.desc, url: data.url, stats: data.stats, siteName: siteName() },
    { lang: opts.lang || getLang() }
  );
  return [base, `🌐 ${opts.siteUrl || SITE_URL}`, `⭐ ${opts.githubUrl || GITHUB_URL}`].filter(Boolean).join('\n');
}

export function shareIntent(name, payload = {}, opts = {}) {
  const data = normalizeSharePayload(payload, opts);
  const text = [truncateText(data.title, 90), opts.siteUrl || SITE_URL, opts.githubUrl || GITHUB_URL].join('\n');
  if (name === 'x') return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(data.url)}`;
  if (name === 'telegram') return `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(text)}`;
  if (name === 'weibo') return `https://service.weibo.com/share/share.php?url=${encodeURIComponent(data.url)}&title=${encodeURIComponent(text)}`;
  return '';
}

function closeShareMenu({ restoreFocus = true } = {}) {
  if (!state.menu) return;
  state.menu.remove();
  state.menu = null;
  document.removeEventListener('keydown', onMenuKeydown, true);
  document.removeEventListener('pointerdown', onMenuOutside, true);
  if (restoreFocus && state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function onMenuKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeShareMenu();
  }
}

function onMenuOutside(event) {
  if (state.menu && !state.menu.contains(event.target)) closeShareMenu({ restoreFocus: false });
}

function openIntent(name, payload) {
  const url = shareIntent(name, payload, { lang: getLang() });
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer,width=680,height=560');
  closeShareMenu();
  toast(name === 'x' ? t('share.openedX') : name === 'telegram' ? t('share.openedTelegram') : t('share.openedWeibo'));
}

export async function openShareMenu(anchor, payload) {
  ensureMounted();
  closeShareMenu({ restoreFocus: false });
  state.lastFocus = anchor || document.activeElement;
  const data = await hydratePayload(payload || payloadFromElement(anchor));
  const menu = el('div', { class: 'share-menu', role: 'menu', 'aria-label': t('share.menu') });
  const add = (label, onClick) => {
    const item = el('button', { type: 'button', class: 'share-menu-item', role: 'menuitem' });
    item.append(el('span', { text: label }));
    item.addEventListener('click', onClick);
    menu.append(item);
  };
  const sep = () => menu.append(el('div', { class: 'share-menu-sep', role: 'separator' }));
  const copy = (value, message) => async () => {
    await copyText(value, message);
    closeShareMenu();
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    add(t('share.system'), async () => {
      try {
        await navigator.share({ title: data.title, text: `${truncateText(data.title, 90)}\n${SITE_URL}`, url: data.url });
        closeShareMenu();
        toast(t('share.systemOpened'));
      } catch {
      }
    });
  }
  add(t('share.copyLink'), copy(data.url, t('share.linkCopied')));
  if (data.kind === 'board') add(t('share.copyBoardLink'), copy(data.url, t('share.boardLinkCopied')));
  add(t('share.copyText'), copy(buildShareMessage(data), t('share.textCopied')));
  add(t('share.card'), async () => {
    closeShareMenu({ restoreFocus: false });
    await openShareCard(data);
  });
  sep();
  add(t('share.copySite'), copy(SITE_URL, t('share.siteCopied')));
  add(t('share.copyGithub'), copy(GITHUB_URL, t('share.githubCopied')));
  add(t('share.openGithub'), () => {
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
    closeShareMenu();
  });
  add(t('share.copyRss'), copy(RSS_URL, t('share.rssCopied')));
  sep();
  add(t('share.toX'), () => openIntent('x', data));
  add(t('share.toTelegram'), () => openIntent('telegram', data));
  add(t('share.toWeibo'), () => openIntent('weibo', data));

  document.body.append(menu);
  state.menu = menu;
  positionMenu(menu, anchor || state.lastFocus);
  document.addEventListener('keydown', onMenuKeydown, true);
  document.addEventListener('pointerdown', onMenuOutside, true);
  menu.querySelector('button')?.focus();
}

function positionMenu(menu, anchor) {
  if (!anchor || !anchor.getBoundingClientRect) return;
  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let left = Math.max(12, Math.min(rect.left + rect.width / 2 - menuRect.width / 2, window.innerWidth - menuRect.width - 12));
  let top = rect.bottom + 8;
  if (top + menuRect.height > window.innerHeight - 12) top = Math.max(12, rect.top - menuRect.height - 8);
  menu.style.left = `${left + window.scrollX}px`;
  menu.style.top = `${top + window.scrollY}px`;
}

function palette(dark) {
  return dark
    ? { bg: '#0E0D0B', ink: '#F2ECE2', muted: '#A79B8A', gold: '#C9A227', goldSoft: '#6A5626', dark: true }
    : { bg: '#F6F1E9', ink: '#14100C', muted: '#6B6257', gold: '#B08A4F', goldSoft: '#D9C39A', dark: false };
}

const isDarkPreferred = () => {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wrap on word boundaries for Latin tokens and per character for CJK; max lines + ellipsis. */
function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const lines = [];
  for (const paragraph of String(text || '').replace(/\r/g, '').split('\n')) {
    if (!paragraph) continue;
    let line = '';
    for (const token of paragraph.match(/[A-Za-z0-9$%+,./:_-]+|[\s\S]/gu) || []) {
      if (!line && !token.trim()) continue;
      if (ctx.measureText(line + token).width <= maxWidth) {
        line += token;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = token.trim() ? token : '';
      if (lines.length >= maxLines) break;
      if (ctx.measureText(line).width > maxWidth) {
        let chunk = '';
        for (const ch of line) {
          if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
            lines.push(chunk);
            chunk = '';
            if (lines.length >= maxLines) break;
          }
          chunk += ch;
        }
        line = chunk;
        if (lines.length >= maxLines) break;
      }
    }
    if (line.trim() && lines.length < maxLines) lines.push(line.trimEnd());
    if (lines.length >= maxLines) break;
  }
  if (lines.length >= maxLines && lines.join('').length < String(text).replace(/\s+/g, '').length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

const fitOneLine = (ctx, text, maxWidth) => {
  let value = String(text || '').trim();
  if (ctx.measureText(value).width <= maxWidth) return value;
  while (value && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
};

function polygon(ctx, cx, cy, radius, points, ratio, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points; i += 1) {
    const angle = (i * 2 * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? radius : radius * ratio;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** v1.4 minimal distribution strip (72px high): tiny logo + site URL (15px) + GitHub short
 *  address + 58px QR; text-only drawing, no external assets beyond the bundled QR PNG. */
function drawDistributionStrip(ctx, P, image) {
  const x = 68;
  const siteLabel = t('share.card.siteShort').toUpperCase();
  const repoLabel = t('share.card.repoShort').toUpperCase();
  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 532);
  ctx.lineTo(CARD_W - 68, 532);
  ctx.stroke();
  polygon(ctx, x + 4, 553, 4.5, 8, 0.36, P.gold);
  ctx.fillStyle = P.gold;
  ctx.font = `600 8px ${FONT_SANS}`;
  ctx.letterSpacing = '1.2px';
  ctx.fillText(siteLabel, x + 14, 556);
  ctx.fillText(repoLabel, x, 581);
  const siteLabelW = ctx.measureText(siteLabel).width;
  const repoLabelW = ctx.measureText(repoLabel).width;
  ctx.letterSpacing = '0px';
  ctx.fillStyle = P.ink;
  ctx.font = `500 15px ${FONT_SANS}`;
  ctx.fillText(SITE_HOST, x + 22 + siteLabelW, 558);
  ctx.fillStyle = P.muted;
  ctx.font = `400 12.5px ${FONT_SANS}`;
  ctx.fillText(GITHUB_HOST, x + 12 + repoLabelW, 581);
  if (image) {
    const size = 58;
    try {
      ctx.drawImage(image, CARD_W - 68 - size, 539, size, size);
    } catch {
      /* QR failed to load: strip stays text-only */
    }
  }
}

/** Restrained 1/2/3 rank badge for board cards: gold-tinted #1, outlined #2/#3. */
function drawRankBadge(ctx, P, rank, x, baseline) {
  const w = 28;
  const h = 26;
  roundRect(ctx, x, baseline - 19, w, h, 6);
  if (rank === 1) {
    ctx.fillStyle = P.goldSoft;
    ctx.fill();
  }
  ctx.strokeStyle = rank === 1 ? P.gold : P.goldSoft;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = P.ink;
  ctx.font = `600 13px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(rank), x + w / 2, baseline - 2);
  ctx.textAlign = 'left';
}

export function drawShareCard(canvas, payload = {}, opts = {}) {
  const dark = typeof opts.dark === 'boolean' ? opts.dark : isDarkPreferred();
  const lang = opts.lang || getLang();
  const P = palette(dark);
  const data = normalizeSharePayload(payload, opts);
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  const padX = 68;
  const contentWidth = 1064;

  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W - 180, 90, 20, CARD_W - 180, 90, 620);
  glow.addColorStop(0, dark ? 'rgba(201,162,39,0.16)' : 'rgba(176,138,79,0.16)');
  glow.addColorStop(1, 'rgba(176,138,79,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, CARD_W - 52, CARD_H - 52);

  const qr = opts.qrImage || state.qr;

  ctx.textBaseline = 'alphabetic';
  polygon(ctx, padX + 7, 78, 7, 8, 0.36, P.gold);
  ctx.font = `600 20px ${FONT_SANS}`;
  ctx.letterSpacing = '3px';
  ctx.fillStyle = P.gold;
  ctx.fillText('AI PULSE', padX + 24, 84);
  const brandWidth = ctx.measureText('AI PULSE').width;
  ctx.letterSpacing = '0px';
  if (lang !== 'en') {
    ctx.fillStyle = P.muted;
    ctx.font = `400 14px ${FONT_SANS}`;
    ctx.fillText('· 照胆云', padX + 30 + brandWidth, 84);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = P.muted;
  ctx.font = `400 15px ${FONT_SANS}`;
  const dateText = formatShareDate(opts.date instanceof Date ? opts.date : new Date(), lang);
  ctx.fillText(dateText, CARD_W - 68, 84);
  const dateWidth = ctx.measureText(dateText).width;
  ctx.fillStyle = P.gold;
  ctx.font = `600 14px ${FONT_SANS}`;
  ctx.fillText(`#${t(KIND_KEYS[data.kind] || KIND_KEYS.site)}`, CARD_W - 68 - dateWidth - 16, 84);
  ctx.textAlign = 'left';
  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, 104);
  ctx.lineTo(CARD_W - 68, 104);
  ctx.stroke();

  const titleSize = data.kind === 'news' ? 52 : 50;
  ctx.fillStyle = P.ink;
  ctx.font = `600 ${titleSize}px ${FONT_SERIF}`;
  const titleLines = wrapText(ctx, data.title, contentWidth, data.kind === 'news' ? 3 : 2);
  let y = 158;
  for (const line of titleLines) {
    ctx.fillText(line, padX, y);
    y += 60;
  }
  let bodyY = y + 8;

  if (data.kind === 'board') {
    const rows = data.board?.rows || [];
    rows.forEach((row, index) => {
      const base = bodyY + index * 36;
      if (base > 476) return;
      drawRankBadge(ctx, P, row.rank || index + 1, padX, base);
      ctx.fillStyle = P.ink;
      ctx.font = `500 24px ${FONT_SANS}`;
      ctx.fillText(fitOneLine(ctx, row.model, 840), padX + 42, base);
      if (row.score) {
        ctx.textAlign = 'right';
        ctx.fillStyle = P.muted;
        ctx.font = `600 21px ${FONT_SANS}`;
        ctx.fillText(row.score, CARD_W - 68, base);
        ctx.textAlign = 'left';
      }
    });
    if (rows.length) bodyY += rows.length * 36;
    else if (data.desc) {
      ctx.fillStyle = P.muted;
      ctx.font = `400 24px ${FONT_SANS}`;
      for (const line of wrapText(ctx, truncateText(data.desc, 120), contentWidth, 2)) {
        if (bodyY > 476) break;
        ctx.fillText(line, padX, bodyY);
        bodyY += 31;
      }
    }
    const meta = [data.board?.metric, data.board?.updatedAt ? formatShareDate(data.board.updatedAt, lang) : '', data.board?.source].filter(Boolean);
    if (meta.length && bodyY + 18 <= 508) {
      ctx.fillStyle = P.gold;
      ctx.font = `500 15px ${FONT_SANS}`;
      ctx.letterSpacing = '1.4px';
      ctx.fillText(meta.join('  ·  '), padX, bodyY + 18);
      ctx.letterSpacing = '0px';
    }
  } else if (data.kind === 'skill') {
    const skillDesc = data.install && data.desc.includes(data.install) ? data.desc.replace(data.install, '').replace(/[·\s]+$/, '') : data.desc;
    if (skillDesc) {
      ctx.fillStyle = P.muted;
      ctx.font = `400 24px ${FONT_SANS}`;
      for (const line of wrapText(ctx, truncateText(skillDesc, 180), contentWidth, titleLines.length >= 3 ? 2 : 3)) {
        if (bodyY > 476) break;
        ctx.fillText(line, padX, bodyY);
        bodyY += 31;
      }
    }
    if (data.install && bodyY + 12 <= 508) {
      ctx.fillStyle = P.gold;
      ctx.font = `500 19px ${FONT_SANS}`;
      ctx.fillText(`→ ${fitOneLine(ctx, data.install, contentWidth - 30)}`, padX, bodyY + 12);
    }
  } else {
    if (data.desc) {
      ctx.fillStyle = P.muted;
      ctx.font = `400 24px ${FONT_SANS}`;
      for (const line of wrapText(ctx, truncateText(data.desc, 180), contentWidth, titleLines.length >= 3 ? 2 : 3)) {
        if (bodyY > 476) break;
        ctx.fillText(line, padX, bodyY);
        bodyY += 31;
      }
    }
    const stats = data.stats || siteStatsLine() || t('share.card.tagline');
    if (stats && bodyY + 16 <= 508) {
      ctx.fillStyle = P.gold;
      ctx.font = `600 15px ${FONT_SANS}`;
      ctx.letterSpacing = '2px';
      ctx.fillText(fitOneLine(ctx, stats.toUpperCase(), contentWidth), padX, bodyY + 16);
      ctx.letterSpacing = '0px';
    }
  }

  drawDistributionStrip(ctx, P, qr);
  return canvas;
}

function ensureCardCanvas() {
  let canvas = document.getElementById('share-card-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'share-card-canvas';
    canvas.className = 'share-card-canvas';
    canvas.setAttribute('aria-label', `${t('share.card.previewAria')} · ${t('share.card.stripAria')}`);
    canvas.setAttribute('role', 'img');
    canvas.hidden = true;
    document.body.append(canvas);
  }
  return canvas;
}

function cardFilename(payload) {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const slug = String(payload.title || 'ai-pulse').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return `ai-pulse-${slug || 'share'}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}

export async function generateShareCard(payload, opts = {}) {
  const data = normalizeSharePayload(payload, opts);
  const qrImage = opts.qrImage !== undefined ? opts.qrImage : await loadShareQr();
  const canvas = ensureCardCanvas();
  drawShareCard(canvas, data, { ...opts, qrImage });
  const blob = await new Promise((resolve) => canvas.toBlob((result) => resolve(result), 'image/png'));
  if (!blob) throw new Error(t('share.card.exportFailed'));
  return { canvas, blob };
}

export async function downloadShareCard(payload, opts = {}) {
  const { blob } = await generateShareCard(payload, opts);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = cardFilename(normalizeSharePayload(payload));
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(t('share.card.downloadStarted'));
  return blob;
}

async function copyCardImage(blob) {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast(t('share.card.imageCopied'));
    return true;
  } catch {
    toast(t('share.card.copyUnsupported'));
    return false;
  }
}

function closeShareCard() {
  state.modal?.remove();
  state.modal = null;
  document.removeEventListener('keydown', onCardKeydown, true);
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function onCardKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeShareCard();
  }
}

function addressRow(label, href, text) {
  return el('p', { class: 'share-card-address-row' }, [
    el('span', { class: 'share-card-address-label', text: label }),
    el('a', { class: 'share-card-url', href, target: '_blank', rel: 'noopener', text }),
  ]);
}

export async function openShareCard(payload = {}) {
  ensureMounted();
  const data = await hydratePayload({
    kind: payload.kind || payload.type,
    title: payload.title || document.title,
    desc: payload.desc || (document.querySelector('meta[name="description"]') || {}).content || '',
    url: payload.url || location.href,
    stats: payload.stats || (await resolveStats()),
    board: payload.board,
    install: payload.install || payload.skill?.install,
  });
  state.lastFocus = document.activeElement;
  const { canvas, blob } = await generateShareCard(data);
  state.blob = blob;
  closeShareCard();

  const download = async () => {
    const current = state.blob || (await generateShareCard(data)).blob;
    const url = URL.createObjectURL(current);
    const link = el('a', { href: url, download: cardFilename(data) });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(t('share.card.downloadStarted'));
  };

  const panel = el('div', { class: 'share-card-panel' }, [
    el('h2', { id: 'share-card-title', text: t('share.card.badge') }),
    el('p', { class: 'share-card-hint', text: t('share.card.note') }),
    el('p', { class: 'share-card-hint', text: t('share.card.addressHint') }),
    el('div', { class: 'share-card-preview' }, [canvas]),
    el('div', { class: 'share-card-address' }, [
      addressRow(t('share.card.siteAddressLabel'), SITE_URL, SITE_HOST),
      addressRow(t('share.card.githubLabel'), GITHUB_URL, GITHUB_HOST),
      addressRow('RSS', RSS_URL, 'feed.xml'),
    ]),
    el('div', { class: 'share-card-actions' }, [
      el('button', { type: 'button', class: 'share-card-primary', text: t('share.card.download'), onclick: download }),
      el('button', { type: 'button', class: 'share-card-btn', text: t('share.card.copyImage'), onclick: () => copyCardImage(state.blob) }),
      el('button', { type: 'button', class: 'share-card-btn', text: t('share.card.copyTextShort'), onclick: () => copyText(buildShareMessage(data), t('share.textCopied')) }),
      el('button', { type: 'button', class: 'share-card-close', text: t('ui.close'), 'aria-label': t('share.card.close'), onclick: () => closeShareCard() }),
    ]),
  ]);
  canvas.hidden = false;
  canvas.removeAttribute('hidden');
  const modal = el('div', { class: 'share-card-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'share-card-title' });
  modal.append(el('div', { class: 'share-card-backdrop', onclick: closeShareCard }), panel);
  document.body.append(modal);
  state.modal = modal;
  document.addEventListener('keydown', onCardKeydown, true);
  requestAnimationFrame(() => modal.querySelector('button')?.focus());
  return { canvas, blob };
}

function payloadFromElement(node) {
  const attr = (name) => (node?.dataset ? node.dataset[name] : '') || '';
  let extra = {};
  try {
    extra = JSON.parse(attr('sharePayload') || '{}') || {};
  } catch {
  }
  const kind = attr('shareKind') || attr('shareType') || extra.kind || extra.type || '';
  const title = attr('shareTitle') || extra.title || (node && node.textContent ? node.textContent.trim().slice(0, 120) : '') || document.title;
  const desc = attr('shareDesc') || extra.desc || (document.querySelector('meta[name="description"]') || {}).content || '';
  return {
    ...extra,
    id: attr('shareBoard') || extra.id || '',
    kind,
    type: attr('shareType') || extra.type || kind,
    title: String(title).trim(),
    desc: String(desc).trim(),
    url: attr('shareUrl') || extra.url || location.href,
    stats: attr('shareStats') || extra.stats || siteStatsLine(),
  };
}

async function onDocumentClick(event) {
  const target = event.target.closest('[data-share]');
  if (target) {
    event.preventDefault();
    const payload = await hydratePayload(payloadFromElement(target));
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && coarse) {
      navigator
        .share({ title: payload.title, text: `${truncateText(payload.title, 90)}\n${SITE_URL}\n${GITHUB_URL}`, url: payload.url })
        .then(() => toast(t('share.systemOpened')))
        .catch(() => openShareMenu(target, payload));
      return;
    }
    openShareMenu(target, payload);
    return;
  }
  const cardTarget = event.target.closest('[data-share-card]');
  if (cardTarget) {
    event.preventDefault();
    const base = cardTarget.closest('[data-share]');
    openShareCard(base ? payloadFromElement(base) : payloadFromElement(cardTarget));
    return;
  }
  const openCard = event.target.closest('[data-share-card-open]');
  if (openCard) {
    event.preventDefault();
    openShareCard(document.querySelector('[data-share]') ? payloadFromElement(document.querySelector('[data-share]')) : undefined);
  }
}

function ensureMounted() {
  if (state.mounted || typeof document === 'undefined') return;
  state.mounted = true;
  ensureCardCanvas();
}

export function initShare() {
  if (typeof document === 'undefined') return;
  ensureMounted();
  document.addEventListener('click', onDocumentClick);
  window.__AIPULSE_SHARE__ = {
    openMenu: openShareMenu,
    openCard: openShareCard,
    generateCard: generateShareCard,
    downloadCard: downloadShareCard,
    drawCard: drawShareCard,
    buildMessage: buildShareMessage,
    normalize: normalizeSharePayload,
    boardPayload: boardPayloadFromData,
    links: { ...SHARE_LINKS },
  };
  window.dispatchEvent(new CustomEvent('share:ready'));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShare, { once: true });
  else initShare();
}
