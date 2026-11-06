/* =============================================================================
   AI Pulse - branded share card, leaderboard section.
   Draws Top10 inside the fixed 1200x630 canvas: a podium column for ranks 1-3
   with explicit champion / runner-up / third labels, plus a compact 4-10
   column. Colors come from the caller's theme palette; no hex values here.
   ============================================================================= */

import { t } from './i18n.js';

/** Restrained podium badge: gold fill for #1, champagne for #2, outline for #3. */
function podiumBadge(ctx, P, rank, x, baseline, fontSans, roundRect) {
  const w = 36;
  const h = 30;
  roundRect(ctx, x, baseline - 24, w, h, 6);
  if (rank === 1) {
    ctx.fillStyle = P.goldSoft;
    ctx.fill();
  } else if (rank === 2) {
    ctx.globalAlpha = P.dark ? 0.7 : 0.45;
    ctx.fillStyle = P.goldSoft;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = rank === 3 ? P.goldSoft : P.gold;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = rank === 3 ? P.muted : P.ink;
  ctx.font = `700 16px ${fontSans}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(rank), x + w / 2, baseline - 3);
  ctx.textAlign = 'left';
}

/** @returns {void} The section draws itself; the distribution strip starts at y=532. */
export function drawBoardSection(ctx, opts) {
  const { P, data, lang, padX, contentWidth, bodyY, cardW, fontSans, helpers } = opts;
  const { roundRect, fitOneLine, formatShareDate } = helpers;
  const rows = (data.board?.rows || []).slice(0, 10);
  const right = cardW - padX;
  const splitX = padX + Math.round(contentWidth * 0.6);
  const leftW = splitX - padX - 28;
  const rightX = splitX + 28;
  const rightW = right - rightX;
  const floor = 508;
  const startY = bodyY + 34;

  if (!rows.length) {
    ctx.fillStyle = P.muted;
    ctx.font = `400 22px ${fontSans}`;
    ctx.fillText(t('share.board.empty'), padX, bodyY + 24);
    if (data.desc) {
      for (const line of helpers.wrapText(ctx, helpers.truncateText(data.desc, 120), contentWidth, 2)) {
        ctx.fillText(line, padX, bodyY + 64);
        break;
      }
    }
    return;
  }

  ctx.fillStyle = P.gold;
  ctx.font = `600 13px ${fontSans}`;
  ctx.letterSpacing = '1.6px';
  ctx.fillText(t('share.board.podium'), padX, bodyY);
  ctx.fillText(t('share.board.others'), rightX, bodyY);
  ctx.letterSpacing = '0px';

  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(splitX, bodyY - 14);
  ctx.lineTo(splitX, floor - 4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const podium = rows.slice(0, 3);
  const podiumRowH = 50;
  podium.forEach((row, index) => {
    const base = startY + 26 + index * podiumRowH;
    if (base > floor) return;
    const rank = row.rank || index + 1;
    podiumBadge(ctx, P, rank, padX, base, fontSans, roundRect);
    const label = index === 0
      ? t('share.board.rank1')
      : index === 1
        ? t('share.board.rank2')
        : t('share.board.rank3');
    ctx.fillStyle = rank === 1 ? P.gold : P.muted;
    ctx.font = `600 13px ${fontSans}`;
    ctx.fillText(label, padX + 44, base - 2);
    const labelW = ctx.measureText(label).width;
    const scoreW = row.score ? 76 : 0;
    ctx.fillStyle = P.ink;
    ctx.font = `500 21px ${fontSans}`;
    ctx.fillText(fitOneLine(ctx, row.model, leftW - 52 - labelW - scoreW - 12), padX + 52 + labelW, base);
    if (row.score) {
      ctx.textAlign = 'right';
      ctx.fillStyle = P.gold;
      ctx.font = `600 19px ${fontSans}`;
      ctx.fillText(row.score, padX + leftW, base);
      ctx.textAlign = 'left';
    }
    ctx.strokeStyle = P.goldSoft;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(padX, base + 12);
    ctx.lineTo(padX + leftW, base + 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  const rest = rows.slice(3);
  const available = floor - startY - 8;
  const rowH = rest.length ? Math.max(21, Math.min(27, Math.floor(available / rest.length))) : 27;
  rest.forEach((row, index) => {
    const base = startY + 20 + index * rowH;
    if (base > floor) return;
    ctx.fillStyle = P.muted;
    ctx.font = `600 14px ${fontSans}`;
    ctx.fillText(String(row.rank || index + 4).padStart(2, '0'), rightX, base);
    ctx.fillStyle = P.ink;
    ctx.font = `400 16px ${fontSans}`;
    const scoreW = row.score ? 62 : 0;
    ctx.fillText(fitOneLine(ctx, row.model, rightW - 34 - scoreW - 10), rightX + 34, base);
    if (row.score) {
      ctx.textAlign = 'right';
      ctx.fillStyle = P.muted;
      ctx.font = `500 14px ${fontSans}`;
      ctx.fillText(row.score, right, base);
      ctx.textAlign = 'left';
    }
  });

  const meta = [
    data.board?.metric,
    data.board?.updatedAt ? formatShareDate(data.board.updatedAt, lang) : '',
    data.board?.source,
  ].filter(Boolean);
  if (meta.length) {
    const metaY = Math.min(floor - 6, startY + 26 + podiumRowH * podium.length + 16);
    ctx.fillStyle = P.gold;
    ctx.font = `500 14px ${fontSans}`;
    ctx.letterSpacing = '1px';
    ctx.fillText(fitOneLine(ctx, meta.join('  ·  '), leftW), padX, metaY);
    ctx.letterSpacing = '0px';
  }
}
