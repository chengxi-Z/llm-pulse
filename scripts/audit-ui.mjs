#!/usr/bin/env node
/**
 * Headless UI overflow + render-performance audit for AI Pulse.
 *
 * Zero dependencies: Node 20+ (global fetch/WebSocket) plus a locally installed
 * Chromium/Edge. It boots scripts/serve.mjs and a headless browser, visits every
 * page in zh/en at several widths, and reports clipped text, horizontal scroll,
 * SVG label overflow, long tasks and the in-app render timing.
 *
 * Usage:
 *   node scripts/audit-ui.mjs
 *   node scripts/audit-ui.mjs --pages=index,models --widths=1440,390 --langs=en,zh
 *   node scripts/audit-ui.mjs --out=_tmp/ui-audit.json --quiet
 *   node scripts/audit-ui.mjs --shots=index@1440@en,index@390@zh
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
const list = (name, fallback) => flag(name, fallback).split(',').map((v) => v.trim()).filter(Boolean);

const PAGES = list('pages', 'index,news,rankings,models,resources,projects,skills,about,deepseek,aihot');
const WIDTHS = list('widths', '1440,1024,768,390').map(Number);
const LANGS = list('langs', 'en,zh');
const OUT = resolve(ROOT, flag('out', '_tmp/ui-audit.json'));
const SHOTS = has('shots') ? (flag('shots', 'index@1440@en,index@390@zh') === 'all' ? '*' : new Set(flag('shots', 'index@1440@en,index@390@zh').split(',').map((v) => v.trim()))) : new Set();
const SHOT_DIR = join(ROOT, '_tmp', 'shots');
const SHOT_SCROLL = flag('shot-scroll', '');
const PORT = Number(flag('port', '4173'));
const CDP_PORT = Number(flag('cdp', '9229'));
const QUIET = has('quiet');
const BASE = `http://127.0.0.1:${PORT}`;

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, timeoutMs = 15000, label = 'service') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return true;
    } catch (_) { /* not ready yet */ }
    await sleep(150);
  }
  throw new Error(`${label} did not become ready in ${timeoutMs}ms`);
}

/* ---- Minimal CDP client (flatten sessions, no external packages) ---- */
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Set();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res(), { once: true });
      this.ws.addEventListener('error', (e) => rej(new Error(`CDP socket error: ${e.message || e}`)), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (_) { return; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve: ok, reject: bad } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) bad(new Error(`${msg.error.code || ''} ${msg.error.message || ''}`.trim()));
        else ok(msg.result);
      } else if (msg.method) {
        this.handlers.forEach((fn) => fn(msg));
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((ok, bad) => {
      this.pending.set(id, { resolve: ok, reject: bad });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          bad(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
  close() { try { this.ws.close(); } catch (_) { /* already closed */ } }
}

/* ---- In-page probe: runs after data render settles ---- */
function pageProbe() {
  const MAX_PER_TYPE = 24;
  const seen = new Set();
  const issues = [];
  const short = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const pathOf = (el) => {
    const parts = [];
    let node = el;
    for (let i = 0; node && i < 5; i += 1, node = node.parentElement) {
      let part = node.tagName ? node.tagName.toLowerCase() : 'svg';
      if (node.id) { part += `#${node.id}`; parts.unshift(part); break; }
      const cls = (node.getAttribute && node.getAttribute('class')) || '';
      const first = cls.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      if (first) part += `.${first}`;
      parts.unshift(part);
    }
    return parts.join(' > ');
  };
  const add = (type, el, detail) => {
    const key = `${type}|${pathOf(el)}|${short(detail.text || '')}`;
    if (seen.has(key)) return;
    if (issues.filter((i) => i.type === type).length >= MAX_PER_TYPE) return;
    seen.add(key);
    issues.push({ type, path: pathOf(el), ...detail });
  };
  const srOnly = (el, cs) => el.classList.contains('u-visually-hidden')
    || (cs.position === 'absolute' && (parseFloat(cs.width) <= 1 || cs.clip !== 'auto'));
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
    if (srOnly(el, cs)) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return { cs, rect };
  };
  const ownText = (el) => Array.from(el.childNodes || [])
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent || '')
    .join('')
    .trim();
  // Wide tables, board tab strips and code blocks are intentionally scrollable;
  // their content reaching past the viewport is not a layout defect.
  const inScrollable = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if (/auto|scroll/.test(cs.overflowX) && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  };
  let scrollableOverflow = 0;

  // 1. Document-level horizontal overflow.
  const docOverflow = document.documentElement.scrollWidth - window.innerWidth;
  if (docOverflow > 1) {
    issues.push({ type: 'viewport-x', path: 'html', text: '', overflowPx: Math.round(docOverflow), viewport: window.innerWidth });
  }

  // 2. Clipped / overflowing text elements.
  const all = Array.from(document.querySelectorAll('body *'));
  for (const el of all) {
    if (el.closest('[hidden], template, script, style')) continue;
    if (el.tagName === 'OPTION' || el.tagName === 'SELECT') continue;
    const v = visible(el);
    if (!v) continue;
    const { cs, rect } = v;
    const text = ownText(el);
    const isLeafText = text.length > 1;
    if (!isLeafText) continue;
    const dx = el.scrollWidth - el.clientWidth;
    const dy = el.scrollHeight - el.clientHeight;
    const clippedX = /hidden|clip/.test(cs.overflowX);
    const clippedY = /hidden|clip/.test(cs.overflowY);
    const ellipsis = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
    if (dx > 2 && clippedX && !ellipsis) {
      add('clip-x', el, { overflowPx: Math.round(dx), clientWidth: el.clientWidth, text: short(text) });
    } else if (dx > 2 && cs.whiteSpace === 'nowrap' && cs.overflowX === 'visible') {
      add('overflow-x', el, { overflowPx: Math.round(dx), clientWidth: el.clientWidth, text: short(text) });
    }
    if (dy > 3 && clippedY && !ellipsis && cs.whiteSpace !== 'nowrap') {
      add('clip-y', el, { overflowPx: Math.round(dy), clientHeight: el.clientHeight, text: short(text) });
    }
    if (cs.position !== 'fixed' && rect.right > window.innerWidth + 2 && rect.left >= -2 && cs.overflowX !== 'auto') {
      if (inScrollable(el)) scrollableOverflow += 1;
      else add('outside-viewport', el, { overflowPx: Math.round(rect.right - window.innerWidth), text: short(text) });
    }
  }

  // 3. Real glyph boxes escaping a clipping ancestor. Range rects describe the
  //    painted text lines, so wrapped lines and nested inline text are covered.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || '').trim();
    if (text.length < 2) continue;
    const el = node.parentElement;
    if (!el || !visible(el) || el.closest('[hidden], .u-visually-hidden, option, select, svg')) continue;
    const range = document.createRange();
    try { range.selectNodeContents(node); } catch (_) { continue; }
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    let clip = el;
    let clipped = null;
    while (clip && clip !== document.body) {
      const cs = getComputedStyle(clip);
      if (/hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflowY)) { clipped = { clip, cs }; break; }
      clip = clip.parentElement;
    }
    for (const r of rects) {
      if (r.right > window.innerWidth + 2) {
        if (inScrollable(el)) { scrollableOverflow += 1; break; }
        add('glyph-outside-viewport', el, { overflowPx: Math.round(r.right - window.innerWidth), text: short(text) });
        break;
      }
      if (!clipped) continue;
      const { clip: box, cs } = clipped;
      const intentional = cs.textOverflow === 'ellipsis'
        || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')
        || /auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY);
      if (intentional) continue;
      const br = box.getBoundingClientRect();
      const dx = Math.max(0, r.right - br.right, br.left - r.left);
      if (dx > 3) {
        add('glyph-clipped', el, { overflowPx: Math.round(dx), clipBy: pathOf(box), text: short(text) });
        break;
      }
    }
  }

  // 4. Section heading vs. its aside: overlapping text is a layout bug.
  document.querySelectorAll('.section-head').forEach((head) => {
    const title = head.querySelector('h1, h2, h3');
    const aside = head.querySelector('.section-head__aside');
    if (!title || !aside || !visible(title) || !visible(aside)) return;
    const a = title.getBoundingClientRect();
    const b = aside.getBoundingClientRect();
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (overlapX > 2 && overlapY > 2) {
      add('head-aside-overlap', title, { overflowPx: Math.round(overlapX), text: short(title.textContent), aside: short(aside.textContent) });
    }
  });

  // 5. SVG text outside its own viewBox (chart labels are the usual offender).
  document.querySelectorAll('svg[viewBox] text').forEach((node) => {
    const svg = node.ownerSVGElement || node.closest('svg');
    if (!svg || !visible(node)) return;
    let box;
    try { box = node.getBBox(); } catch (_) { return; }
    const vb = svg.viewBox.baseVal;
    if (!vb || !vb.width) return;
    const outL = vb.x - box.x;
    const outR = box.x + box.width - (vb.x + vb.width);
    const outT = vb.y - box.y;
    const outB = box.y + box.height - (vb.y + vb.height);
    const worst = Math.max(outL, outR, outT, outB);
    if (worst > 2) add('svg-label-outside', node, { overflowPx: Math.round(worst), text: short(node.textContent) });
  });

  const perf = window.__AIPULSE_PERF__ || {};
  const audit = window.__AIPULSE_AUDIT__ || {};
  const paints = {};
  performance.getEntriesByType('paint').forEach((e) => { paints[e.name] = Math.round(e.startTime * 10) / 10; });
  const nav = performance.getEntriesByType('navigation')[0] || {};
  return {
    issues,
    scrollableOverflow,
    deferredContent: {
      newModels: document.querySelectorAll('#new-models-grid .model-card').length,
      newsRows: document.querySelectorAll('#latest-news li').length,
      boardTabs: document.querySelectorAll('#home-rankings-tabs .board-tab').length,
    },
    cumulativeTrend: (() => {
      const line = document.querySelector('.dash-kpi-trend .dash-trend-line');
      if (!line) return null;
      const ys = (line.getAttribute('points') || '').trim().split(/\s+/)
        .map((pair) => Number(pair.split(',')[1])).filter(Number.isFinite);
      // SVG y grows downwards: a rising cumulative curve has decreasing y.
      const rising = ys.length > 1 && ys.every((y, i) => i === 0 || y <= ys[i - 1] + 0.2);
      return { points: ys.length, rising, firstY: ys[0], lastY: ys[ys.length - 1] };
    })(),
    perf: {
      renderMs: perf.renderMs != null ? Math.round(perf.renderMs * 10) / 10 : null,
      metricsMs: perf.metricsMs != null ? Math.round(perf.metricsMs * 10) / 10 : null,
      dataMs: perf.dataMs != null ? Math.round(perf.dataMs * 10) / 10 : null,
      breakdown: perf.breakdown || {},
      dashPhases: perf.dashPhases || {},
      longTasks: (audit.longTasks || []).map((d) => Math.round(d)),
      longestTask: (audit.longTasks || []).length ? Math.round(Math.max(...audit.longTasks)) : 0,
      domContentLoaded: Math.round((nav.domContentLoadedEventEnd || 0) * 10) / 10,
      ...paints,
    },
    consoleErrors: (window.__siteErrors ? [...window.__siteErrors.js, ...window.__siteErrors.runtime, ...window.__siteErrors.resource] : []).slice(0, 6),
  };
}

const BOOT_SCRIPT = `
window.__AIPULSE_AUDIT__ = { longTasks: [] };
try {
  new PerformanceObserver((list) => {
    list.getEntries().forEach((e) => window.__AIPULSE_AUDIT__.longTasks.push(e.duration));
  }).observe({ entryTypes: ['longtask'] });
} catch (e) {}
`;

async function main() {
  const browserPath = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!browserPath) throw new Error('No headless Chromium/Edge found. Install Edge or add its path to EDGE_CANDIDATES.');

  const children = [];
  const stop = (child) => { try { child.kill(); } catch (_) { /* noop */ } };
  const cleanup = () => children.forEach(stop);

  if (!QUIET) console.log(`[audit] starting preview server on ${BASE}`);
  const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs'), '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  children.push(server);
  await waitFor(async () => (await fetch(`${BASE}/index.html`)).ok, 15000, 'preview server');

  const profile = join(ROOT, '_tmp', 'edge-audit-profile');
  await mkdir(profile, { recursive: true });
  if (!QUIET) console.log('[audit] launching headless browser');
  const browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--mute-audio',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--window-size=1440,900', 'about:blank',
  ], { cwd: ROOT, stdio: 'ignore' });
  children.push(browser);

  let cdp;
  try {
    await waitFor(async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok, 20000, 'CDP endpoint');
    const version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
    cdp = new CDP(version.webSocketDebuggerUrl);
    await cdp.ready;
    let sessionId = '';
    let currentWidth = WIDTHS[0];
    const openSession = async () => {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      sessionId = attached.sessionId;
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: BOOT_SCRIPT }, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: currentWidth, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    };
    await openSession();

    const results = [];
    for (const width of WIDTHS) {
      currentWidth = width;
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
      for (const page of PAGES) {
        for (const lang of LANGS) {
          // AI Hot is Chinese-only; in English the app redirects to index.html,
          // which races the CDP session. The redirected page is not a real view.
          if (page === 'aihot' && lang === 'en') continue;
          const url = `${BASE}/${page}.html?lang=${lang}&theme=ivory`;
          try {
          await cdp.send('Page.navigate', { url }, sessionId);
          const settle = await cdp.send('Runtime.evaluate', {
            expression: `(async () => {
              const deadline = performance.now() + 9000;
              while (document.readyState !== 'complete' || !(document.body && document.body.dataset.pageReady === 'true')) {
                if (performance.now() > deadline) return 'timeout';
                await new Promise((r) => setTimeout(r, 25));
              }
              // Let the progressively rendered, below-the-fold home sections
              // settle before probing their text for overflow.
              await new Promise((r) => setTimeout(r, 240));
              return 'ok';
            })()`,
            awaitPromise: true,
            returnByValue: true,
          }, sessionId);
          const expression = `(${pageProbe.toString()})()`;
          const evaluation = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
          if (evaluation.exceptionDetails) {
            results.push({ page, lang, width, error: evaluation.exceptionDetails.text || 'probe failed', issues: [] });
            continue;
          }
          const data = evaluation.result.value || { issues: [] };
          results.push({ page, lang, width, settle: settle.result?.value, ...data });
          const shotKey = `${page}@${width}@${lang}`;
          if (SHOTS === '*' || SHOTS.has(shotKey)) {
            if (SHOT_SCROLL) {
              await cdp.send('Runtime.evaluate', {
                expression: `(() => { const el = document.querySelector(${JSON.stringify(SHOT_SCROLL)}); if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' }); return !!el; })()`,
                returnByValue: true,
              }, sessionId);
              await sleep(260);
            }
            const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
            await mkdir(SHOT_DIR, { recursive: true });
            await writeFile(join(SHOT_DIR, `${shotKey}.png`), Buffer.from(shot.data, 'base64'));
          }
          if (!QUIET) {
            const n = data.issues.length;
            const r = data.perf?.renderMs;
            console.log(`[audit] ${page.padEnd(10)} ${lang} @${width}  issues=${String(n).padStart(2)}  render=${r == null ? 'n/a' : r + 'ms'}  longestTask=${data.perf?.longestTask ?? '?'}ms${settle.result?.value === 'timeout' ? '  (settle timeout)' : ''}`);
          }
          } catch (error) {
            results.push({ page, lang, width, error: error.message, issues: [] });
            if (!QUIET) console.log(`[audit] ${page.padEnd(10)} ${lang} @${width}  RECOVER ${error.message}`);
            try { await openSession(); } catch (_) { /* next try will report it */ }
          }
        }
      }
    }

    const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
    const report = {
      generatedAt: new Date().toISOString(),
      pages: PAGES, widths: WIDTHS, langs: LANGS,
      totalIssues,
      scrollableOverflow: results.reduce((sum, r) => sum + (r.scrollableOverflow || 0), 0),
      issueTypes: results.reduce((acc, r) => {
        (r.issues || []).forEach((i) => { acc[i.type] = (acc[i.type] || 0) + 1; });
        return acc;
      }, {}),
      renderMs: results.filter((r) => r.perf?.renderMs != null).map((r) => ({ page: r.page, lang: r.lang, width: r.width, ms: r.perf.renderMs })),
      results,
    };
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(report, null, 2));
    console.log(`[audit] done: ${totalIssues} issue(s), report -> ${OUT}`);
    cdp.close();
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(`[audit] FAILED: ${error.message}`);
  process.exitCode = 1;
});
