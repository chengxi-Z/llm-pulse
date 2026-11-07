/* =============================================================================
   AI Pulse - branded share card, leaderboard section.
   Draws Top10 as a single top-to-bottom list inside the fixed 1200x630 canvas.
   Ranks 1-3 use gold / champagne / graphite medal discs with explicit
   champion labels; ranks 4-10 keep a plain ordinal. Colors come from the
   caller's theme palette; no hex values here.
   ============================================================================= */

import { t } from './i18n.js';

/** Small medal disc: solid gold for #1, champagne for #2, outline for #3. */
function medal(ctx, P, rank, x, cy, fontSans) {
  const r = 11;
  ctx.beginPath();
  ctx.arc(x + r, cy, r, 0, Math.PI * 2);
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
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = rank === 3 ? P.muted : P.ink;
  ctx.font = `700 12px ${fontSans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), x + r, cy + 0.5);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

/** @returns {void} The section draws itself; the distribution strip starts at y=532. */
export function drawBoardSection(ctx, opts) {
  const { P, data, lang, padX, contentWidth, bodyY, cardW, fontSans, helpers } = opts;
  const { fitOneLine, wrapText, truncateText, formatShareDate } = helpers;
  const rows = (data.board?.rows || []).slice(0, 10);
  const right = cardW - padX;
  const floor = 508;

  if (!rows.length) {
    ctx.fillStyle = P.muted;
    ctx.font = `400 22px ${fontSans}`;
    ctx.fillText(t('share.board.empty'), padX, bodyY + 24);
    if (data.desc) {
      wrapText(ctx, truncateText(data.desc, 120), contentWidth, 2)
        .forEach((line, index) => ctx.fillText(line, padX, bodyY + 64 + index * 31));
    }
    return;
  }

  const meta = [
    data.board?.metric,
    data.board?.updatedAt ? formatShareDate(data.board.updatedAt, lang) : '',
    data.board?.source,
  ].filter(Boolean);
  ctx.fillStyle = P.gold;
  ctx.font = `600 13px ${fontSans}`;
  ctx.letterSpacing = '1.4px';
  const head = [t('share.board.top10'), ...(meta.length ? [meta.join('  ·  ')] : [])].join('   ');
  ctx.fillText(fitOneLine(ctx, head, contentWidth), padX, bodyY - 18);
  ctx.letterSpacing = '0px';

  const startY = bodyY + 12;
  const rowH = Math.min(27, Math.floor((floor - startY) / rows.length));
  rows.forEach((row, index) => {
    const rank = row.rank || index + 1;
    const cy = startY + index * rowH + rowH / 2 - 2;
    if (cy > floor) return;

    if (rank <= 3) {
      medal(ctx, P, rank, padX, cy, fontSans);
    } else {
      ctx.fillStyle = P.muted;
      ctx.font = `600 14px ${fontSans}`;
      ctx.fillText(String(rank).padStart(2, '0'), padX + 2, cy + 5);
    }

    const nameX = padX + 44;
    const showDates = rows.some((item) => item.releaseDate);
    const dateX = right - 118;
    const nameRight = showDates ? dateX - 24 : right - 90;
    ctx.fillStyle = P.ink;
    ctx.font = `500 19px ${fontSans}`;
    ctx.fillText(fitOneLine(ctx, row.model, nameRight - nameX), nameX, cy + 6);
    if (showDates) {
      const release = row.releaseDate ? String(row.releaseDate).slice(0, 10).replace(/-/g, '.') : '—';
      ctx.textAlign = 'right';
      ctx.fillStyle = P.muted;
      ctx.font = `500 12px ${fontSans}`;
      ctx.fillText(release, dateX, cy + 5);
      ctx.textAlign = 'left';
    }
    if (row.score) {
      ctx.textAlign = 'right';
      ctx.fillStyle = rank <= 3 ? P.gold : P.muted;
      ctx.font = `600 17px ${fontSans}`;
      ctx.fillText(row.score, right, cy + 6);
      ctx.textAlign = 'left';
    }

    ctx.strokeStyle = P.goldSoft;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(padX, cy + rowH / 2);
    ctx.lineTo(right, cy + rowH / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}
