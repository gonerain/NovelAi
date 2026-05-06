import { validateArcShift, type ArcShiftIssue } from "./arc-shift.js";
import type { ChapterScenePlan, SceneMicroShift } from "./types.js";

export type SceneMicroShiftIssue = ArcShiftIssue;

export function validateSceneMicroShift(shift: SceneMicroShift): SceneMicroShiftIssue[] {
  // Reuse the arc-shift validator: same four mandatory fields with
  // identical generic-phrase blocklist. We synthesize a stable id
  // when missing so the validator does not double-report.
  return validateArcShift({
    id: `scene_${shift.characterId}_${shift.arcShiftRef ?? "free"}`,
    oldDefault: shift.oldDefault,
    pressureTrigger: shift.pressureTrigger,
    newChoice: shift.newChoice,
    costPaid: shift.costPaid,
  });
}

export interface SceneScaffoldIssue {
  field:
    | "pov"
    | "location"
    | "openingScene.entryHook"
    | "openingScene.situationOnPage"
    | "midConflict.trigger"
    | "midConflict.escalation"
    | "climax.decisionOwnerId"
    | "climax.decisionUnderPressure"
    | "climax.costPaid"
    | "endHook";
  reason: "empty" | "too_short";
}

const SCENE_FIELD_MIN = 4;

function strField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateSceneScaffold(plan: ChapterScenePlan): SceneScaffoldIssue[] {
  const issues: SceneScaffoldIssue[] = [];
  const checks: Array<[SceneScaffoldIssue["field"], string]> = [
    ["pov", strField(plan.pov)],
    ["location", strField(plan.location)],
    ["openingScene.entryHook", strField(plan.openingScene?.entryHook)],
    ["openingScene.situationOnPage", strField(plan.openingScene?.situationOnPage)],
    ["midConflict.trigger", strField(plan.midConflict?.trigger)],
    ["midConflict.escalation", strField(plan.midConflict?.escalation)],
    ["climax.decisionOwnerId", strField(plan.climax?.decisionOwnerId)],
    ["climax.decisionUnderPressure", strField(plan.climax?.decisionUnderPressure)],
    ["climax.costPaid", strField(plan.climax?.costPaid)],
    ["endHook", strField(plan.endHook)],
  ];
  for (const [field, value] of checks) {
    if (value.length === 0) {
      issues.push({ field, reason: "empty" });
      continue;
    }
    if (value.length < SCENE_FIELD_MIN) {
      issues.push({ field, reason: "too_short" });
    }
  }
  return issues;
}

export interface ScenePlanCoverage {
  chapterNumber: number;
  scaffoldIssues: SceneScaffoldIssue[];
  microShiftIssues: Array<{
    characterId: string;
    issues: SceneMicroShiftIssue[];
  }>;
}

export function validateScenePlan(plan: ChapterScenePlan): ScenePlanCoverage {
  const scaffoldIssues = validateSceneScaffold(plan);
  const microShiftIssues: ScenePlanCoverage["microShiftIssues"] = [];
  for (const shift of plan.characterArcMicroShift ?? []) {
    const issues = validateSceneMicroShift(shift);
    if (issues.length > 0) {
      microShiftIssues.push({ characterId: shift.characterId, issues });
    }
  }
  return {
    chapterNumber: plan.chapterNumber,
    scaffoldIssues,
    microShiftIssues,
  };
}

export function validateScenePlans(plans: ChapterScenePlan[]): ScenePlanCoverage[] {
  return plans
    .map((plan) => validateScenePlan(plan))
    .filter(
      (coverage) =>
        coverage.scaffoldIssues.length > 0 || coverage.microShiftIssues.length > 0,
    );
}

/**
 * Detect the failure mode the old markdown template-fill produced:
 * consecutive scene plans that are byte-identical except for
 * chapterNumber. Returns the offending chapter pairs.
 */
export interface IdenticalScenePlanFinding {
  earlierChapter: number;
  laterChapter: number;
  identicalFields: string[];
}

export function findIdenticalConsecutiveScenes(
  plans: ChapterScenePlan[],
): IdenticalScenePlanFinding[] {
  const sorted = [...plans].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const findings: IdenticalScenePlanFinding[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.chapterNumber - previous.chapterNumber !== 1) {
      continue;
    }
    const identicalFields: string[] = [];
    if (previous.pov === current.pov) identicalFields.push("pov");
    if (previous.location === current.location) identicalFields.push("location");
    if (
      previous.openingScene?.entryHook === current.openingScene?.entryHook
    ) {
      identicalFields.push("openingScene.entryHook");
    }
    if (previous.endHook === current.endHook) identicalFields.push("endHook");
    if (
      previous.climax?.decisionOwnerId === current.climax?.decisionOwnerId &&
      previous.climax?.decisionUnderPressure === current.climax?.decisionUnderPressure
    ) {
      identicalFields.push("climax");
    }
    // Flag only when 3+ structural fields collide — that's the
    // unmistakeable template-fill smell.
    if (identicalFields.length >= 3) {
      findings.push({
        earlierChapter: previous.chapterNumber,
        laterChapter: current.chapterNumber,
        identicalFields,
      });
    }
  }
  return findings;
}
