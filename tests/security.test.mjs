/**
 * Security-focused unit tests (node --test).
 *
 * Covers: XSS escaping in assistant markdown, URL scheme allowlist,
 * share-text safety, security scanner helpers, data matching normalization.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { safeMarkdown, buildShareText } from "../site/assets/js/assistant-core.js";
import { normalizeModelName, buildRankingIndex, matchModelScores } from "../site/assets/js/data-match.js";
import { detectPii, isPinnedUses, hasCsp } from "../scripts/security-check.mjs";

test("safeMarkdown escapes raw HTML/script payloads", () => {
  const out = safeMarkdown('<script>alert(1)</script><img src=x onerror=alert(2)>');
  assert.ok(!/<script/i.test(out), "script tag must be escaped");
  assert.ok(!/<img/i.test(out), "img tag must be escaped");
  assert.ok(out.includes("&lt;") || out.includes("alert(1)"), "payload rendered as text");
});

test("safeMarkdown only allows http(s) links", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x"]) {
    const out = safeMarkdown(`[click](${bad})`);
    assert.ok(!/href=["']?(javascript|data|vbscript):/i.test(out), `unsafe scheme must not become a link: ${bad}`);
  }
  const ok = safeMarkdown("[site](https://example.com)");
  assert.ok(ok.includes('href="https://example.com"'), "https links are allowed");
});

test("safeMarkdown blocks attribute injection via link text", () => {
  const out = safeMarkdown('[x" onmouseover="alert(1)](https://example.com)');
  assert.ok(!/\sonmouseover="alert/.test(out), "event handler must not survive as an attribute");
  assert.ok(out.includes("&quot;"), "quotes are HTML-escaped inside the link text");
});

test("buildShareText always carries site and repo URLs", () => {
  const text = buildShareText({ title: "Pulse update", url: "https://chengxi-z.github.io/llm-pulse/" });
  assert.ok(text.includes("chengxi-z.github.io/llm-pulse"));
  assert.ok(text.includes("Pulse update"));
  assert.ok(!/href=|<a\s/i.test(text), "share text is plain text, never an HTML fragment");
});

test("normalizeModelName strips variants for model score matching", () => {
  assert.equal(normalizeModelName("Claude Opus 5.5 (Max, Default Fallback)"), normalizeModelName("Claude Opus 5.5"));
});

test("matchModelScores does not invent missing scores", () => {
  const index = buildRankingIndex({ boards: [{ id: "b1", name: "Board", entries: [{ model: "Unknown Model", score: 99 }] }] });
  const matched = matchModelScores({ id: "a/b", name: "Model B", org: "B", pricing: { output: 1 }, contextWindow: 1000 }, index);
  assert.ok(Object.values(matched).every((v) => v === null), "unmatched model must not get a fabricated score");
});

test("security scanner: PII pattern detection", () => {
  assert.equal(detectPii("C:\\Users\\alice\\work"), true);
  assert.equal(detectPii("C:\\Users\\<name>\\work"), false);
});

test("security scanner: action pin detection", () => {
  assert.equal(isPinnedUses("uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4"), true);
  assert.equal(isPinnedUses("uses: actions/checkout@v4"), false);
});

test("security scanner: CSP detection", () => {
  assert.equal(hasCsp('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">'), true);
  assert.equal(hasCsp("<html></html>"), false);
});
