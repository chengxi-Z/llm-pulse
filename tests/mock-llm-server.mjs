#!/usr/bin/env node
/**
 * OpenAI-compatible mock server (zero dependencies, SSE streaming) for end-to-end AI assistant tests.
 *
 * Start: node tests/mock-llm-server.mjs [--port 4199]
 * Endpoints:
 *   GET  /v1/models             model list
 *   POST /v1/chat/completions   OpenAI-compatible; with stream:true returns text/event-stream and
 *                               writes 3-7 byte slices (deliberately splitting Chinese/emoji)
 *
 * Behaviour switches (for error-state testing):
 *   missing Authorization or "Bearer invalid" -> 401
 *   model === "mock-error" -> 500
 *   model === "mock-slow"  -> wait 3s before responding
 * All responses carry CORS headers so a browser page can call them directly.
 *
 * Safety: binds 127.0.0.1 only; never reads or records real keys (request headers are ignored/dropped).
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const DEFAULT_PORT = Number(process.env.MOCK_LLM_PORT || 4199);
const REPLY_MARKDOWN = [
  '你好！我是 **mock 模型**，用于验证 AI Pulse 助手的流式渲染。',
  '',
  '- 中文分块 ✅',
  '- 多字节边界 ✅',
  '- Markdown-lite 渲染 ✅',
  '',
  '> 密钥只保存在本地浏览器，本服务是测试替身。',
].join('\n');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    ...corsHeaders(),
  });
  res.end(body);
}

/** Split the reply into several content chunks (including Chinese and emoji) so the frontend can verify incremental rendering. */
function chunkReply(reply) {
  const pieces = [];
  const points = [...reply];
  let i = 0;
  while (i < points.length) {
    const size = 3 + (i % 5);
    pieces.push(points.slice(i, i + size).join(''));
    i += size;
  }
  return pieces;
}

function buildSseBody(reply, model) {
  const id = `chatcmpl-mock-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const events = [];
  for (const piece of chunkReply(reply)) {
    events.push(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
      })}\n\n`
    );
  }
  events.push(
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`
  );
  events.push('data: [DONE]\n\n');
  return Buffer.from(events.join(''), 'utf8');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function createHandler() {
  return async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      sendJson(res, 200, {
        object: 'list',
        data: [
          { id: 'mock-chat', object: 'model', owned_by: 'mock' },
          { id: 'mock-error', object: 'model', owned_by: 'mock' },
        ],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'mock-llm', sse: true });
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      sendJson(res, 404, { error: { message: 'not found', type: 'not_found' } });
      return;
    }
    let payload = {};
    try {
      payload = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 400, { error: { message: 'invalid json', type: 'invalid_request_error' } });
      return;
    }
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ') || auth === 'Bearer invalid' || auth === 'Bearer ') {
      sendJson(res, 401, { error: { message: 'invalid api key (mock)', type: 'authentication_error' } });
      return;
    }
    const model = String(payload.model || 'mock-chat');
    if (model === 'mock-error') {
      sendJson(res, 500, { error: { message: 'mock server error', type: 'server_error' } });
      return;
    }
    if (model === 'mock-slow') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (payload.stream === false) {
      sendJson(res, 200, {
        id: `chatcmpl-mock-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: REPLY_MARKDOWN }, finish_reason: 'stop' }],
      });
      return;
    }
    const body = buildSseBody(REPLY_MARKDOWN, model);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders(),
    });
    // Deliberately emit 3-7 byte slices: Chinese/emoji get split across two network chunks to exercise frontend streaming decode
    let offset = 0;
    const writeSlice = () => {
      if (offset >= body.length) {
        res.end();
        return;
      }
      const size = 3 + (offset % 5);
      res.write(body.subarray(offset, offset + size));
      offset += size;
      setTimeout(writeSlice, 4);
    };
    req.on('close', () => {
      offset = body.length;
    });
    writeSlice();
  };
}

export function startMockServer({ port = DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  const server = http.createServer(createHandler());
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === 'object' && address ? address.port : port,
        url: `http://${host}:${typeof address === 'object' && address ? address.port : port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg > -1 ? Number(process.argv[portArg + 1]) : DEFAULT_PORT;
  const instance = await startMockServer({ port });
  console.log(`[mock-llm] listening on ${instance.url}/v1/chat/completions (SSE)`);
  console.log('[mock-llm] try: curl-like fetch from Node; browser uses baseUrl ' + instance.url + '/v1');
}
