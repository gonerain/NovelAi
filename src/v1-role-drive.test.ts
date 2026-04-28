import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOutlinePatchSuggestions,
  buildDelayedConsequenceStatuses,
  buildOutlinePatchSuggestions,
  buildUnresolvedDelayedConsequenceList,
  type DecisionLogArtifact,
} from "./v1-role-drive.js";
import { buildRoleDrivenPlannerCarryover } from "./v1-shared.js";
import { buildRoleDrivenEvalReport } from "./v1-impact.js";
import type { BeatOutline } from "./domain/index.js";
import type { ChapterPlan } from "./domain/index.js";

function decisionLog(
  chapterNumber: number,
  overrides: Partial<DecisionLogArtifact>,
): DecisionLogArtifact {
  return {
    chapterNumber,
    chapterType: "progress",
    beatId: `beat-${chapterNumber}`,
    decisionPressure: null,
    availableOptions: [],
    likelyChoice: null,
    immediateConsequence: null,
    delayedConsequence: null,
    relationshipShift: null,
    themeShift: null,
    owners: [],
    reviewerAssessment: null,
    ...overrides,
  };
}

function chapterPlan(chapterNumber: number, overrides: Partial<ChapterPlan> = {}): ChapterPlan {
  return {
    chapterNumber,
    chapterGoal: "推进调查",
    emotionalGoal: "承受关系压力",
    plannedOutcome: "调查进入下一步",
    sceneType: "investigation",
    sceneTags: [],
    requiredCharacters: [],
    requiredMemories: [],
    mustHitConflicts: [],
    disallowedMoves: [],
    styleReminders: [],
    authorComponentIds: [],
    ...overrides,
  };
}

test("delayed consequence statuses separate active from resolved", () => {
  const logs = [
    {
      chapterNumber: 1,
      decisionLog: decisionLog(1, {
        delayedConsequence: "雨璃会在后续调查中被迫暴露真实动机",
      }),
    },
    {
      chapterNumber: 2,
      decisionLog: decisionLog(2, {
        decisionPressure: "雨璃真实动机继续压迫她的调查选择",
      }),
    },
    {
      chapterNumber: 3,
      decisionLog: decisionLog(3, {
        immediateConsequence: "雨璃真实动机已经暴露，调查同盟关系发生转向",
      }),
    },
  ];

  assert.deepEqual(buildDelayedConsequenceStatuses({ decisionLogs: logs, fromChapterNumber: 2 }), [
    {
      sourceChapterNumber: 1,
      sourceBeatId: "beat-1",
      consequence: "雨璃会在后续调查中被迫暴露真实动机",
      status: "active",
      evidenceChapterNumber: 2,
      evidence: ["雨璃真实动机继续压迫她的调查选择"],
    },
  ]);

  assert.deepEqual(buildDelayedConsequenceStatuses({ decisionLogs: logs, fromChapterNumber: 3 }), [
    {
      sourceChapterNumber: 1,
      sourceBeatId: "beat-1",
      consequence: "雨璃会在后续调查中被迫暴露真实动机",
      status: "resolved",
      evidenceChapterNumber: 3,
      evidence: ["雨璃真实动机已经暴露，调查同盟关系发生转向"],
    },
  ]);
  assert.deepEqual(buildUnresolvedDelayedConsequenceList({ decisionLogs: logs, fromChapterNumber: 3 }), []);
});

test("resolved source delayed consequence does not produce delayed patch suggestion", () => {
  const source = decisionLog(1, {
    delayedConsequence: "雨璃会在后续调查中被迫暴露真实动机",
    decisionPressure: "雨璃必须决定是否隐瞒动机",
  });
  const futureBeat: BeatOutline = {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    chapterRangeHint: { start: 2, end: 2 },
    beatGoal: "调查继续推进",
    conflict: "真实动机造成信任裂痕",
    expectedChange: "同盟关系被重新定义",
    requiredCharacters: [],
    requiredMemories: [],
    revealTargets: [],
    constraints: [],
  };

  const suggestions = buildOutlinePatchSuggestions({
    fromChapter: 1,
    beatOutlines: [futureBeat],
    sourceDecisionLog: source,
    sourceDelayedConsequenceStatus: {
      sourceChapterNumber: 1,
      sourceBeatId: "beat-1",
      consequence: "雨璃会在后续调查中被迫暴露真实动机",
      status: "resolved",
      evidenceChapterNumber: 2,
      evidence: ["雨璃真实动机已经暴露"],
    },
  });

  assert.equal(
    suggestions.some((item) => item.suggestionType === "delayed_consequence_alignment"),
    false,
  );
});

test("apply outline patch suggestions updates beats and skips missing beat", () => {
  const beat: BeatOutline = {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    chapterRangeHint: { start: 2, end: 2 },
    beatGoal: "调查继续推进",
    conflict: "信任裂痕",
    expectedChange: "同盟关系被重新定义",
    requiredCharacters: [],
    requiredMemories: [],
    revealTargets: [],
    constraints: ["保留原有硬约束"],
  };

  const result = applyOutlinePatchSuggestions({
    beatOutlines: [beat],
    suggestions: [
      {
        beatId: "beat-2",
        arcId: "arc-1",
        chapterRangeHint: { start: 2, end: 2 },
        suggestionType: "decision_pressure_alignment",
        reason: "inherit pressure",
        currentBeatSnapshot: {
          constraints: beat.constraints,
        },
        suggestedPatch: {
          decisionPressure: "雨璃必须决定是否公开真实动机",
          appendConstraint: "延续第一章选择造成的信任压力",
        },
      },
      {
        beatId: "missing-beat",
        arcId: "arc-1",
        chapterRangeHint: { start: 3, end: 3 },
        suggestionType: "relationship_shift_alignment",
        reason: "missing beat",
        currentBeatSnapshot: {
          constraints: [],
        },
        suggestedPatch: {
          relationshipShift: "关系转冷",
        },
      },
    ],
  });

  assert.equal(result.applied.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.beatOutlines[0]?.decisionPressure, "雨璃必须决定是否公开真实动机");
  assert.deepEqual(result.beatOutlines[0]?.constraints, [
    "保留原有硬约束",
    "延续第一章选择造成的信任压力",
  ]);
  assert.equal(result.skipped[0]?.reason, "Beat not found in current beat outlines.");
});

test("apply outline patch suggestions records filtered skips", () => {
  const beat: BeatOutline = {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    chapterRangeHint: { start: 2, end: 2 },
    beatGoal: "调查继续推进",
    conflict: "信任裂痕",
    expectedChange: "同盟关系被重新定义",
    requiredCharacters: [],
    requiredMemories: [],
    revealTargets: [],
    constraints: [],
  };

  const result = applyOutlinePatchSuggestions({
    beatOutlines: [beat],
    filters: {
      onlySuggestionTypes: ["relationship_shift_alignment"],
    },
    suggestions: [
      {
        beatId: "beat-2",
        arcId: "arc-1",
        chapterRangeHint: { start: 2, end: 2 },
        suggestionType: "decision_pressure_alignment",
        reason: "inherit pressure",
        currentBeatSnapshot: {
          constraints: [],
        },
        suggestedPatch: {
          decisionPressure: "雨璃必须决定是否公开真实动机",
        },
      },
      {
        beatId: "beat-2",
        arcId: "arc-1",
        chapterRangeHint: { start: 2, end: 2 },
        suggestionType: "relationship_shift_alignment",
        reason: "inherit relationship",
        currentBeatSnapshot: {
          constraints: [],
        },
        suggestedPatch: {
          relationshipShift: "雨璃与同盟之间出现新的不信任",
        },
      },
    ],
  });

  assert.equal(result.applied.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0]?.reason, "Filtered out by onlySuggestionTypes.");
  assert.equal(result.beatOutlines[0]?.decisionPressure, undefined);
  assert.equal(result.beatOutlines[0]?.relationshipShift, "雨璃与同盟之间出现新的不信任");
});

test("role-driven planner carryover makes active consequences mandatory", () => {
  const result = buildRoleDrivenPlannerCarryover({
    unresolvedDelayedConsequences: [
      "雨璃真实动机继续压迫她的调查选择",
      "同盟关系因此出现新的不信任",
    ],
  });

  assert.equal(result.mustHitConflicts.length, 2);
  assert.match(result.mustHitConflicts[0] ?? "", /Active delayed consequence/);
  assert.equal(
    result.disallowedMoves.includes(
      "Do not ignore active delayed consequences in favor of stale beat wording.",
    ),
    true,
  );
});

test("role-driven eval catches missing planner carryover", () => {
  const report = buildRoleDrivenEvalReport({
    projectId: "test",
    chapters: [
      {
        chapterNumber: 1,
        plan: chapterPlan(1),
        decisionLog: decisionLog(1, {
          decisionPressure: "雨璃必须决定是否隐瞒动机",
          likelyChoice: "她暂时隐瞒",
          delayedConsequence: "雨璃真实动机继续压迫她的调查选择",
        }),
        consequenceEdges: {
          chapterNumber: 1,
          beatId: "beat-1",
          edges: [
            {
              sourceType: "choice",
              sourceId: "choice-1",
              targetType: "delayed_consequence",
              targetId: "delayed-1",
              label: "creates_delayed_consequence",
              detail: "雨璃真实动机继续压迫她的调查选择",
            },
          ],
        },
      },
      {
        chapterNumber: 2,
        plan: chapterPlan(2),
        decisionLog: decisionLog(2, {
          decisionPressure: "调查压力升级",
          likelyChoice: "她继续推进",
          immediateConsequence: "获得新线索",
        }),
        consequenceEdges: null,
      },
    ],
  });

  const carryoverCase = report.caseResults.find(
    (item) => item.caseType === "planner_carryover_present",
  );
  assert.equal(carryoverCase?.passed, false);
});
