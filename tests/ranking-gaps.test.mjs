/**
 * Tests for the leaderboard coverage-gap helper (ranking-gaps.js).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { findGapModels, matchesModelNames, modelKey } from "../site/assets/js/ranking-gaps.js";

const boards = [
  {
    id: "epoch-eci",
    entries: [
      { rank: 1, model: "GPT-6 Astra", org: "OpenAI", score: 169.06, scoreDisplay: "169.1" },
      { rank: 2, model: "Claude Opus 5.5", org: "Anthropic", score: 168.4, scoreDisplay: "168.4" },
      { rank: 3, model: "Claude Opus 4.7", org: "Anthropic", score: 160.1, scoreDisplay: "160.1" },
      { rank: 4, model: "Gemini 4 Argon", org: "Google DeepMind", score: 166.07, scoreDisplay: "166.1" },
    ],
  },
  {
    id: "epoch-swe-bench-verified",
    entries: [
      { rank: 1, model: "Claude Opus 4.7 (Max)", org: "Anthropic", score: 0.8347, scoreDisplay: "83.5" },
      { rank: 2, model: "Gemini-3.5 Flash", org: "Google DeepMind", score: 0.7934, scoreDisplay: "79.3" },
    ],
  },
  { id: "unrelated-board", entries: [{ rank: 1, model: "Claude Opus 5.5" }] },
];

test("matchesModelNames ignores parenthetical variants and date suffixes", () => {
  assert.equal(matchesModelNames("Claude Opus 4.7 (Max)", "Claude Opus 4.7"), true);
  assert.equal(matchesModelNames("Claude Opus 4.5.20251101", "Claude Opus 4.5"), true);
  assert.equal(matchesModelNames("Claude Opus 4.7", "Claude Opus 4.6"), false);
  assert.equal(matchesModelNames("Claude Opus 4", "Claude Opus 4.7"), false);
});

test("modelKey strips variant tokens but keeps versions", () => {
  assert.equal(modelKey("Claude Opus 4.7 (Max)"), modelKey("Claude Opus 4.7"));
  assert.notEqual(modelKey("Claude Opus 4.7"), modelKey("Claude Opus 4.8"));
});

test("findGapModels lists reference models missing from the benchmark, by reference rank", () => {
  const board = boards.find((item) => item.id === "epoch-swe-bench-verified");
  const gaps = findGapModels(board, boards);
  assert.deepEqual(gaps.map((gap) => gap.model), ["GPT-6 Astra", "Claude Opus 5.5", "Gemini 4 Argon"]);
  assert.equal(gaps[1].org, "Anthropic");
  assert.equal(gaps[1].rank, 2);
  assert.equal(gaps[1].referenceId, "epoch-eci");
});

test("findGapModels respects the limit and ignores boards without a reference", () => {
  const board = boards.find((item) => item.id === "epoch-swe-bench-verified");
  assert.equal(findGapModels(board, boards, { limit: 2 }).length, 2);
  assert.deepEqual(findGapModels({ id: "unrelated-board", entries: [] }, boards), []);
  assert.deepEqual(findGapModels(board, []), []);
});

test("findGapModels does not duplicate the same model appearing with variants in the reference", () => {
  const reference = {
    id: "epoch-eci",
    entries: [
      { rank: 1, model: "Claude Opus 5.5", org: "Anthropic", score: 168.4 },
      { rank: 2, model: "Claude Opus 5.5 (High)", org: "Anthropic", score: 167.9 },
    ],
  };
  const board = { id: "epoch-swe-bench-verified", entries: [] };
  const gaps = findGapModels(board, [reference, board]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].model, "Claude Opus 5.5");
});
