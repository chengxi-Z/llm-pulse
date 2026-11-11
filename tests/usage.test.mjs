/**
 * Tests for the OpenRouter token-volume normalizer (weekly usage series).
 *
 * The OpenRouter public chart is weekly (x = Monday). Its newest point is
 * week-to-date, so it is flagged `complete: false` and excluded from the
 * rolling 4-week total / trend line. Only fully elapsed weeks are comparable.
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
  // 2026-11-20: every supplied week has fully elapsed.
  const usage = normalizeOpenRouterUsage(payload, { now: new Date("2026-11-20T00:00:00Z") });
  assert.equal(usage.granularity, "week");
  assert.equal(usage.weeks.length, 5);
  assert.deepEqual(usage.weeks.map((week) => week.tokens), [100, 140, 180, 220, 260]);
  assert.ok(usage.weeks.every((week) => week.complete === true));
  assert.equal(usage.monthlyTokens, 140 + 180 + 220 + 260);
  assert.equal(usage.monthlyDays, 28);
  assert.equal(usage.source, "openrouter-rankings");
});

test("normalizeOpenRouterUsage flags the in-progress week and excludes it from totals", () => {
  // 2026-11-07 (Saturday): the 2026-11-02 week runs 11-02..11-08, so it is
  // still in progress and must not pollute the 4-week total or the trend.
  const usage = normalizeOpenRouterUsage(payload, { now: new Date("2026-11-07T00:00:00Z") });
  assert.deepEqual(
    usage.weeks.map((week) => week.complete),
    [true, true, true, true, false],
  );
  assert.equal(usage.weeks.length, 5, "the partial week is kept for display, just not aggregated");
  assert.equal(usage.monthlyTokens, 100 + 140 + 180 + 220, "only the 4 fully elapsed weeks are summed");
  assert.equal(usage.monthlyDays, 28);
  assert.match(usage.note, /complete=false/);
});

test("normalizeOpenRouterUsage treats a week as complete exactly at its boundary", () => {
  // 11-02 + 7d = 11-09 00:00Z; at that instant the week is fully elapsed.
  const atBoundary = normalizeOpenRouterUsage(payload, { now: new Date("2026-11-09T00:00:00Z") });
  assert.equal(atBoundary.weeks[4].complete, true);
  const justBefore = normalizeOpenRouterUsage(payload, { now: new Date("2026-11-08T23:59:59Z") });
  assert.equal(justBefore.weeks[4].complete, false);
});

test("normalizeOpenRouterUsage sorts weeks and caps at 12", () => {
  const many = Array.from({ length: 20 }, (_, index) => ({
    x: `2026-${String(Math.floor(index / 4) + 1).padStart(2, "0")}-${String((index % 4) * 7 + 1).padStart(2, "0")}`,
    ys: { model: index + 1 },
  }));
  const usage = normalizeOpenRouterUsage({ data: { data: many } }, { now: new Date("2026-11-20T00:00:00Z") });
  assert.equal(usage.weeks.length, 12);
  assert.ok(usage.weeks.every((week, index) => index === 0 || usage.weeks[index - 1].weekStart <= week.weekStart));
  assert.ok(usage.weeks.every((week) => typeof week.complete === "boolean"));
  assert.ok(Number.isFinite(Date.parse(usage.generatedAt)));
});

test("normalizeOpenRouterUsage tolerates missing payloads", () => {
  const usage = normalizeOpenRouterUsage(null);
  assert.deepEqual(usage.weeks, []);
  assert.equal(usage.monthlyTokens, 0);
});
