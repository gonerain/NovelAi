import test from "node:test";
import assert from "node:assert/strict";

import {
  compareRuntimeEvalReports,
  type RuntimeEvalReport,
} from "./v1-runtime-eval.js";

function makeReport(overrides: Partial<RuntimeEvalReport>): RuntimeEvalReport {
  return {
    projectId: "demo",
    chapterNumber: 1,
    generatedAt: "2026-04-28T00:00:00Z",
    sections: [],
    hardFailures: [],
    softWarnings: [],
    passed: true,
    ...overrides,
  };
}

test("compareRuntimeEvalReports flags newly failing sections", () => {
  const previous = makeReport({ hardFailures: ["thread_economy"], passed: false });
  const current = makeReport({
    hardFailures: ["thread_economy", "state_deltas"],
    passed: false,
    generatedAt: "2026-04-28T01:00:00Z",
  });

  const regression = compareRuntimeEvalReports({ previous, current });
  assert.deepEqual(regression.newlyFailingSections, ["state_deltas"]);
  assert.deepEqual(regression.newlyPassingSections, []);
  assert.equal(regression.previousPassed, false);
  assert.equal(regression.currentPassed, false);
});

test("compareRuntimeEvalReports flags newly passing sections", () => {
  const previous = makeReport({
    hardFailures: ["thread_economy", "offscreen_moves"],
    passed: false,
  });
  const current = makeReport({ hardFailures: ["thread_economy"], passed: false });

  const regression = compareRuntimeEvalReports({ previous, current });
  assert.deepEqual(regression.newlyPassingSections, ["offscreen_moves"]);
  assert.deepEqual(regression.newlyFailingSections, []);
});

test("compareRuntimeEvalReports handles missing previous report", () => {
  const current = makeReport({ hardFailures: [], passed: true });
  const regression = compareRuntimeEvalReports({ previous: null, current });
  assert.equal(regression.previousGeneratedAt, null);
  assert.equal(regression.previousPassed, null);
  assert.equal(regression.currentPassed, true);
  assert.deepEqual(regression.newlyFailingSections, []);
  assert.deepEqual(regression.newlyPassingSections, []);
});
