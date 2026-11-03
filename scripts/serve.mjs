#!/usr/bin/env node
/**
 * Zero-dependency local static preview server.
 *
 * The site root is the repository's site/, while the repository's data/ is mapped to
 * /data/, matching the published artifact layout produced by stage-site.mjs
 * (site + data).
 *
 * Usage:
 *   node scripts/serve.mjs                     # http://127.0.0.1:4173
 *   node scripts/serve.mjs --port 8080
 *   node scripts/serve.mjs --host 0.0.0.0 --port 8080
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE = join(ROOT, "site");
const DATA = join(ROOT, "data");

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const PORT = Number(getArg("port", process.env.PORT || 4173));
const HOST = getArg("host", process.env.HOST || "127.0.0.1");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Prevent path traversal: the resolved path must stay inside the base directory */
function safeResolve(base, relPath) {
  const full = resolve(base, "." + normalize("/" + relPath));
  if (full !== base && !full.startsWith(base + sep)) return null;
  return full;
}

async function serveFile(res, filePath, method) {
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return false;
    const body = method === "HEAD" ? null : await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-cache",
      "access-control-allow-origin": "*",
      "content-length": s.size,
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url || "/", `http://${req.headers.host || HOST}`);
  let pathname = decodeURIComponent(url.pathname);

  try {
    let filePath = null;

    if (pathname.startsWith("/data/")) {
      filePath = safeResolve(DATA, pathname.slice("/data/".length));
      if (filePath && (await serveFile(res, filePath, req.method))) return log(req, 200, pathname, started);
      filePath = null;
    }

    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const candidates = [];
    const sitePath = safeResolve(SITE, rel);
    if (sitePath) {
      candidates.push(sitePath);
      if (!extname(rel)) candidates.push(sitePath + ".html", join(sitePath, "index.html"));
    }
    for (const c of candidates) {
      if (await serveFile(res, c, req.method)) return log(req, 200, pathname, started);
    }

    const notFound = join(SITE, "404.html");
    const body = (await readFile(notFound).catch(() => null)) || Buffer.from("404 Not Found");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : body);
    log(req, 404, pathname, started);
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("500 Internal Server Error: " + e.message);
    console.error("[500]", pathname, e.message);
  }
});

function log(req, status, pathname, started) {
  if (pathname.startsWith("/assets/") || pathname.startsWith("/data/")) return; // Reduce log noise for static assets
  console.log(`${status} ${req.method} ${pathname} ${Date.now() - started}ms`);
}

server.listen(PORT, HOST, () => {
  console.log(`\n  AI Pulse · 本地预览\n  → http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/\n`);
  console.log(`  site: ${SITE}`);
  console.log(`  data: ${DATA}\n  Ctrl+C 停止\n`);
});
server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `端口 ${PORT} 已被占用，试试 --port 4174` : e.message);
  process.exit(1);
});
