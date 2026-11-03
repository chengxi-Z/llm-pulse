/**
 * http.mjs — network I/O for the collection layer: timeouts, retries, rate-limit backoff,
 * and raw snapshot reads/writes. Node built-in fetch/fs only; PowerShell/curl use schannel
 * which does not work locally, so every request goes through this module.
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) llm-pulse-bot/0.1 (+https://github.com/chengxi-Z/llm-pulse)';

export class HttpError extends Error {
  constructor(message, { status = null, url = '', elapsedMs = null, retryable = false, snapshotMiss = false } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.elapsedMs = elapsedMs;
    this.retryable = retryable;
    this.snapshotMiss = snapshotMiss;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Hard cap for a single response body (security: hostile/huge responses must not exhaust memory). */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/** True when a declared content-length exceeds the limit (pure helper, unit-testable). */
export function contentLengthExceeds(contentLength, maxBytes = MAX_RESPONSE_BYTES) {
  const n = Number(contentLength);
  return Number.isFinite(n) && n >= 0 && n > maxBytes;
}

/** Read a fetch Response body with a hard byte cap. Throws HttpError (non-retryable) when exceeded. */
async function readBodyLimited(res, maxBytes, url) {
  const declared = res.headers.get('content-length');
  if (contentLengthExceeds(declared, maxBytes)) {
    throw new HttpError(`Response body too large (content-length ${declared} > ${maxBytes})`, { status: res.status, url, elapsedMs: null });
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new HttpError(`Response body too large (> ${maxBytes}B)`, { status: res.status, url, elapsedMs: null });
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) throw new HttpError(`Response body too large (> ${maxBytes}B)`, { status: res.status, url, elapsedMs: null });
      chunks.push(Buffer.from(value));
    }
  } catch (err) {
    try { await reader.cancel(); } catch { /* stream already closed */ }
    throw err;
  }
  return Buffer.concat(chunks);
}

/**
 * Policy-aware HTTP request. Returns { status, ok, text, buffer, bytes, elapsedMs, contentType, headers }.
 * opts: timeoutMs, retries, backoffMs, headers, method, body, json, maxBytes
 * Responses larger than maxBytes (default 5MB) are rejected with a non-retryable HttpError so the
 * caller can degrade the source instead of crashing the pipeline (M2).
 */
export async function httpRequest(url, { timeoutMs = 20000, retries = 1, backoffMs = 600, headers = {}, method = 'GET', body = null, json = null, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'user-agent': DEFAULT_UA,
          accept: 'application/json, text/html, application/xml, text/xml, text/csv, */*',
          ...headers,
          ...(json !== null ? { 'content-type': 'application/json' } : {}),
        },
        body: json !== null ? JSON.stringify(json) : body,
        signal: ctrl.signal,
        redirect: 'follow',
      });
      const buf = await readBodyLimited(res, maxBytes, url);
      const elapsedMs = Date.now() - started;
      const text = buf.toString('utf8');
      const out = { status: res.status, ok: res.ok, text, buffer: buf, bytes: buf.byteLength, elapsedMs, contentType: res.headers.get('content-type'), headers: res.headers };
      // Rate limited / server error -> retryable
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        lastErr = new HttpError(`HTTP ${res.status}`, { status: res.status, url, elapsedMs, retryable: true });
        await sleep(backoffMs * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new HttpError(`HTTP ${res.status}`, { status: res.status, url, elapsedMs });
      return out;
    } catch (err) {
      const elapsedMs = Date.now() - started;
      if (err instanceof HttpError && !err.retryable) throw err;
      lastErr = err instanceof HttpError ? err : new HttpError(`${err.name || 'Error'}: ${err.message}${err.cause?.code ? ` (${err.cause.code})` : ''}`, { url, elapsedMs, retryable: true });
      if (attempt < retries) { await sleep(backoffMs * (attempt + 1)); continue; }
      throw lastErr;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new HttpError('unknown http error', { url });
}

/** Snapshot store: fixed file names under data/snapshot/ for offline replay and degradation fallback */
export class SnapshotStore {
  constructor(dir) { this.dir = dir; }

  path(key, ext) { return join(this.dir, `${key}.${ext}`); }

  async save(key, ext, content) {
    await mkdir(this.dir, { recursive: true });
    const data = typeof content === 'string' ? content : Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2);
    await writeFile(this.path(key, ext), typeof content === 'string' ? content : data);
    return this.path(key, ext);
  }

  async load(key, ext) {
    try {
      const p = this.path(key, ext);
      const st = await stat(p);
      const buf = await readFile(p);
      return { text: buf.toString('utf8'), buffer: buf, bytes: st.size, mtime: st.mtime.toISOString() };
    } catch {
      return null;
    }
  }

  async loadJson(key) {
    const raw = await this.load(key, 'json');
    if (!raw) return null;
    try { return { ...raw, json: JSON.parse(raw.text) }; } catch { return null; }
  }
}

/** Binary snapshot extensions (must persist the raw Buffer, never as UTF-8 text) */
const BINARY_EXTS = new Set(['zip', 'parquet', 'gz', 'png', 'jpg', 'jpeg', 'webp', 'woff2']);

/**
 * Collection context: provides network access / offline replay and snapshot persistence in one place.
 * ctx: { mode, now, fromSnapshot, snap: SnapshotStore, log, fetchedAt }
 */
export function createFetchContext({ mode, now, fromSnapshot = false, snapshotDir, log = () => {} }) {
  const snap = new SnapshotStore(snapshotDir);
  const ctx = {
    mode,
    now,
    fromSnapshot,
    snap,
    log,
    get: async (url, { key, ext = 'json', timeoutMs = 20000, retries = 1, headers = {}, method = 'GET', json = null, save = true, maxBytes = MAX_RESPONSE_BYTES } = {}) => {
      if (fromSnapshot) {
        const cached = await snap.load(key, ext);
        if (!cached) throw new HttpError('快照不存在（离线模式）', { url, snapshotMiss: true });
        ctx.log(`[snapshot] ${key}.${ext} (${cached.bytes}B, ${cached.mtime})`);
        return cached;
      }
      const res = await httpRequest(url, { timeoutMs, retries, headers, method, json, maxBytes });
      if (save) await snap.save(key, ext, BINARY_EXTS.has(ext) ? res.buffer : res.text);
      ctx.log(`[http] ${res.status} ${res.elapsedMs}ms ${res.bytes}B ${url}`);
      return res;
    },
    /** Read a snapshot (no network) for degradation fallback */
    loadSnapshot: (key, ext) => snap.load(key, ext),
    saveSnapshot: (key, ext, content) => snap.save(key, ext, content),
  };
  return ctx;
}

/** Parse GitHub rate-limit headers (for reporting and self-throttling) */
export function githubRateInfo(headers) {
  const get = (k) => (typeof headers?.get === 'function' ? headers.get(k) : headers?.[k]);
  return {
    limit: Number(get('x-ratelimit-limit')) || null,
    remaining: Number(get('x-ratelimit-remaining')) || null,
    reset: Number(get('x-ratelimit-reset')) || null,
  };
}
