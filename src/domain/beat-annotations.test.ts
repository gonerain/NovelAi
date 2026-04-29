import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_CHAPTER_SHAPES,
  computePacingBudget,
  isChapterShape,
  isPlotPressureShape,
  PLOT_PRESSURE_SHAPES,
  type ChapterShape,
} from "./beat-annotations.js";

test("ALL_CHAPTER_SHAPES contains exactly 10 shapes", () => {
  assert.equal(ALL_CHAPTER_SHAPES.length, 10);
});

test("PLOT_PRESSURE_SHAPES is the 4 plot shapes", () => {
  assert.equal(PLOT_PRESSURE_SHAPES.size, 4);
  for (const shape of ["plot_advance", "pressure_buildup", "confrontation", "payoff"] as const) {
    assert.ok(PLOT_PRESSURE_SHAPES.has(shape));
  }
});

test("isChapterShape recognises canonical shapes and rejects garbage", () => {
  assert.equal(isChapterShape("relationship_beat"), true);
  assert.equal(isChapterShape("payoff"), true);
  assert.equal(isChapterShape("PAYOFF"), false);
  assert.equal(isChapterShape("not_a_shape"), false);
  assert.equal(isChapterShape(42), false);
  assert.equal(isChapterShape(null), false);
});

test("isPlotPressureShape distinguishes plot from non-plot", () => {
  assert.equal(isPlotPressureShape("confrontation"), true);
  assert.equal(isPlotPressureShape("payoff"), true);
  assert.equal(isPlotPressureShape("relationship_beat"), false);
  assert.equal(isPlotPressureShape("aftermath"), false);
  assert.equal(isPlotPressureShape("interlude"), false);
});

test("computePacingBudget passes when window has 2+ non-plot and ≤3 consecutive plot", () => {
  const recent: ChapterShape[] = [
    "plot_advance",
    "pressure_buildup",
    "relationship_beat",
    "confrontation",
    "aftermath",
    "plot_advance",
    "world_texture",
  ];
  const budget = computePacingBudget({ recentShapes: recent });
  assert.equal(budget.windowSize, 7);
  assert.equal(budget.nonPlotChapterCount, 3);
  assert.equal(budget.passes, true);
});

test("computePacingBudget flags expand_breathing when 4 consecutive plot shapes", () => {
  const recent: ChapterShape[] = [
    "relationship_beat",
    "confrontation",
    "plot_advance",
    "pressure_buildup",
    "payoff",
  ];
  const budget = computePacingBudget({ recentShapes: recent });
  assert.equal(budget.consecutivePlotPressure, 4);
  assert.equal(budget.passes, false);
  assert.equal(budget.pacingNudge, "expand_breathing");
});

test("computePacingBudget flags expand_breathing when fewer than 2 non-plot in window", () => {
  const recent: ChapterShape[] = [
    "plot_advance",
    "pressure_buildup",
    "confrontation",
    "world_texture",
    "plot_advance",
    "payoff",
    "pressure_buildup",
  ];
  const budget = computePacingBudget({ recentShapes: recent });
  assert.equal(budget.nonPlotChapterCount, 1);
  assert.equal(budget.passes, false);
  assert.equal(budget.pacingNudge, "expand_breathing");
});

test("computePacingBudget allows plot when last two chapters were non-plot", () => {
  const recent: ChapterShape[] = [
    "plot_advance",
    "pressure_buildup",
    "confrontation",
    "aftermath",
    "relationship_beat",
  ];
  const budget = computePacingBudget({ recentShapes: recent });
  assert.equal(budget.consecutivePlotPressure, 0);
  assert.equal(budget.pacingNudge, "allow_plot");
});

test("computePacingBudget returns neutral mid-window", () => {
  const recent: ChapterShape[] = [
    "plot_advance",
    "relationship_beat",
    "pressure_buildup",
    "world_texture",
    "confrontation",
  ];
  const budget = computePacingBudget({ recentShapes: recent });
  assert.equal(budget.consecutivePlotPressure, 1);
  assert.equal(budget.pacingNudge, "neutral");
});

test("computePacingBudget honours custom window size and slices most-recent only", () => {
  const recent: ChapterShape[] = [
    "plot_advance",
    "plot_advance",
    "plot_advance",
    "plot_advance",
    "relationship_beat",
    "world_texture",
    "aftermath",
  ];
  const budget = computePacingBudget({ recentShapes: recent, windowSize: 3 });
  assert.equal(budget.windowSize, 3);
  assert.deepEqual(budget.shapesInWindow, ["relationship_beat", "world_texture", "aftermath"]);
  assert.equal(budget.nonPlotChapterCount, 3);
  assert.equal(budget.consecutivePlotPressure, 0);
});
