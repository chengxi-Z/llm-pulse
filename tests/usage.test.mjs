/**
 * Tests for the OpenRouter token-volume normalizer (weekly usage series).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeOpenRouterUsage } from "../scripts/normalize.mjs";

const payload = {
  data: {
    data: [
      { x: "2026-10-05", ys: { "openai/a": 10, "openai/b": 30, Others: 60 } },
      { x: "2026-10-12", ys: { "openai/a": 20, "openai/b": 40, Others: 80 } },
      { x: "2026-10-19", ys: { "openai/a": 30, "openai/b": 50, Others: 100 } },
      { x: "2026-10-26", ys: { "openai/a": 40, "openai/b": 60, Others: 120 } },
      { x: "2026-11-02", ys: { "openai/a": 50, "openai/b": 70, Others: 140 } },
    ],
  },
};

test("normalizeOpenRouterUsage aggregates weekly totals", () => {
  const usage = normalizeOpenRouterUsage(payload, { now: new Date("2026-11-07T00:00:00Z") });
  assert.equal(usage.granularity, "week");
  assert.equal(usage.weeks.length, 5);
  assert.deepEqual(usage.weeks.map((week) => week.tokens), [100, 140, 180, 220, 260]);
  assert.equal(usage.monthlyTokens, 140 + 180 + 220 + 260);
  assert.equal(usage.monthlyDays, 28);
  assert.equal(usage.source, "openrouter-rankings");
});

test("normalizeOpenRouterUsage sorts weeks and caps at 12", () => {
  const many = Array.from({ length: 20 }, (_, index) => ({
    x: `2026-${String(Math.floor(index / 4) + 1).padStart(2, "0")}-${String((index % 4) * 7 + 1).padStart(2, "0")}`,
    ys: { model: index + 1 },
  }));
  const usage = normalizeOpenRouterUsage({ data: { data: many } });
  assert.equal(usage.weeks.length, 12);
  assert.ok(usage.weeks.every((week, index) => index === 0 || usage.weeks[index - 1].weekStart <= week.weekStart));
  assert.ok(Number.isFinite(Date.parse(usage.generatedAt)));
});

test("normalizeOpenRouterUsage tolerates missing payloads", () => {
  const usage = normalizeOpenRouterUsage(null);
  assert.deepEqual(usage.weeks, []);
  assert.equal(usage.monthlyTokens, 0);
});
