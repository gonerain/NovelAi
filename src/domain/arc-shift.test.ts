import test from "node:test";
import assert from "node:assert/strict";

import { validateArcShift, validateArcShiftsForArc } from "./arc-shift.js";
import type { ArcOutline, ArcShift } from "./types.js";

function makeShift(overrides: Partial<ArcShift> = {}): ArcShift {
  return {
    id: "shift_a",
    oldDefault: "她原本会冷处理避开陆承砚的逼问",
    pressureTrigger: "陆承砚替她在家族面前承担了责任",
    newChoice: "她第一次主动撒谎承认婚约关系来掩护他",
    costPaid: "暴露了自己研究命名漏洞的事实给闻既白",
    ...overrides,
  };
}

test("validateArcShift accepts a fully populated, specific shift", () => {
  const issues = validateArcShift(makeShift());
  assert.deepEqual(issues, []);
});

test("validateArcShift flags empty mandatory string fields", () => {
  const shift = makeShift({ oldDefault: "" });
  const issues = validateArcShift(shift);
  assert.ok(issues.some((i) => i.field === "oldDefault" && i.reason === "empty"));
});

test("validateArcShift flags too-short fields", () => {
  const shift = makeShift({ pressureTrigger: "嗯" });
  const issues = validateArcShift(shift);
  assert.ok(
    issues.some((i) => i.field === "pressureTrigger" && i.reason === "too_short"),
  );
});

test("validateArcShift flags generic-shaped fields", () => {
  const shift = makeShift({ newChoice: "突破自己" });
  const issues = validateArcShift(shift);
  assert.ok(issues.some((i) => i.field === "newChoice" && i.reason === "generic"));
});

test("validateArcShift flags missing id", () => {
  const shift = makeShift({ id: "" });
  const issues = validateArcShift(shift);
  assert.ok(issues.some((i) => i.field === "id" && i.reason === "missing_id"));
});

function makeArc(overrides: Partial<ArcOutline> = {}): ArcOutline {
  return {
    id: "arc_a",
    name: "测试 arc",
    arcGoal: "推动主角第一次主动选择",
    startState: "she avoids commitment",
    endState: "she names her stance in public",
    requiredTurns: [],
    relationshipChanges: [],
    memoryRequirements: [],
    beatIds: [],
    ...overrides,
  };
}

test("validateArcShiftsForArc reports missing protagonistArc", () => {
  const coverage = validateArcShiftsForArc(makeArc());
  assert.equal(coverage.protagonistArcMissing, true);
  assert.equal(coverage.protagonistShiftIssues.length, 0);
});

test("validateArcShiftsForArc accepts a fully populated protagonistArc", () => {
  const arc = makeArc({
    protagonistArc: {
      startInternalState: "she suppresses her own boundary",
      endInternalState: "she actively names her stance",
      falseBeliefChallenged: "leaving silently is enough to end a relationship",
      costAccepted: "having to publicly own her dissent",
      shifts: [makeShift()],
    },
  });
  const coverage = validateArcShiftsForArc(arc);
  assert.equal(coverage.protagonistArcMissing, false);
  assert.deepEqual(coverage.protagonistShiftIssues, []);
});

test("validateArcShiftsForArc surfaces issues per shift", () => {
  const arc = makeArc({
    protagonistArc: {
      startInternalState: "x",
      endInternalState: "y",
      falseBeliefChallenged: "z",
      costAccepted: "c",
      shifts: [makeShift({ id: "bad", costPaid: "" })],
    },
  });
  const coverage = validateArcShiftsForArc(arc);
  assert.equal(coverage.protagonistShiftIssues.length, 1);
  assert.equal(coverage.protagonistShiftIssues[0]!.shiftId, "bad");
  assert.ok(
    coverage.protagonistShiftIssues[0]!.issues.some(
      (i) => i.field === "costPaid",
    ),
  );
});
