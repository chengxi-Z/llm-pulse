/**
 * Data-side test 3: HTTP safety guards (M2) — response body size cap and pure helpers.
 * Runs against a loopback HTTP server created in-process (no external network).
 * Run: node --test tests/data-http.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpRequest, contentLengthExceeds, MAX_RESPONSE_BYTES } from '../scripts/fetch/http.mjs';

const listen = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
});
const close = (server) => new Promise((resolve) => {
  server.closeAllConnections?.();
  server.close(() => resolve());
});

test('M2 contentLengthExceeds: pure helper', () => {
  assert.equal(MAX_RESPONSE_BYTES, 5 * 1024 * 1024);
  assert.equal(contentLengthExceeds(1024, 1024), false);
  assert.equal(contentLengthExceeds(1025, 1024), true);
  assert.equal(contentLengthExceeds(undefined, 1024), false);
  assert.equal(contentLengthExceeds('999999999', 1024), true);
  assert.equal(contentLengthExceeds('-1', 1024), false);
});

test('M2 httpRequest: declared content-length over the cap is rejected early', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': '9999999' });
    res.end('tiny');
  });
  try {
    await assert.rejects(
      () => httpRequest(`${base}/declared-too-big`, { maxBytes: 1024, retries: 0, timeoutMs: 5000 }),
      (err) => err.name === 'HttpError' && /too large/i.test(err.message)
    );
  } finally {
    await close(server);
  }
});

test('M2 httpRequest: streamed body over the cap is truncated/rejected, small body passes', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('x'.repeat(4096));
  });
  try {
    await assert.rejects(
      () => httpRequest(`${base}/big`, { maxBytes: 1024, retries: 0, timeoutMs: 5000 }),
      (err) => err.name === 'HttpError' && /too large/i.test(err.message)
    );
    const ok = await httpRequest(`${base}/big`, { maxBytes: 8192, retries: 0, timeoutMs: 5000 });
    assert.equal(ok.ok, true);
    assert.equal(ok.bytes, 4096);
  } finally {
    await close(server);
  }
});

test('M2 httpRequest: default cap does not reject normal-size responses', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, payload: 'a'.repeat(1000) }));
  });
  try {
    const res = await httpRequest(`${base}/normal`, { retries: 0, timeoutMs: 5000 });
    assert.equal(res.ok, true);
    assert.ok(res.bytes > 1000 && res.bytes <= MAX_RESPONSE_BYTES);
  } finally {
    await close(server);
  }
});
