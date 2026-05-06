import type {
  ArcOutline,
  ArcShift,
  ProtagonistArc,
  SupportingCharacterArc,
} from "./types.js";

const MIN_FIELD_CHARS = 4;

const GENERIC_PHRASES = [
  "变得主动",
  "变得勇敢",
  "成长",
  "改变",
  "突破自己",
  "学会面对",
  "意识到",
  "觉醒",
  "更坚定",
  "选择前进",
];

function isTooGeneric(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < MIN_FIELD_CHARS) {
    return true;
  }
  return GENERIC_PHRASES.some((phrase) => trimmed === phrase || trimmed.endsWith(phrase));
}

export type ArcShiftFieldName =
  | "oldDefault"
  | "pressureTrigger"
  | "newChoice"
  | "costPaid";

const SHIFT_FIELDS: ReadonlyArray<ArcShiftFieldName> = [
  "oldDefault",
  "pressureTrigger",
  "newChoice",
  "costPaid",
];

export interface ArcShiftIssue {
  shiftId: string;
  field: ArcShiftFieldName | "id";
  reason: "empty" | "too_short" | "generic" | "missing_id";
}

export function validateArcShift(shift: ArcShift): ArcShiftIssue[] {
  const issues: ArcShiftIssue[] = [];
  if (!shift.id || shift.id.trim().length === 0) {
    issues.push({ shiftId: shift.id ?? "", field: "id", reason: "missing_id" });
  }
  for (const field of SHIFT_FIELDS) {
    const raw = (shift as unknown as Record<string, unknown>)[field];
    if (typeof raw !== "string") {
      issues.push({ shiftId: shift.id ?? "", field, reason: "empty" });
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      issues.push({ shiftId: shift.id ?? "", field, reason: "empty" });
      continue;
    }
    if (trimmed.length < MIN_FIELD_CHARS) {
      issues.push({ shiftId: shift.id ?? "", field, reason: "too_short" });
      continue;
    }
    if (isTooGeneric(trimmed)) {
      issues.push({ shiftId: shift.id ?? "", field, reason: "generic" });
    }
  }
  return issues;
}

export interface ArcArcShiftCoverage {
  arcId: string;
  protagonistShiftIssues: Array<{
    shiftId: string;
    issues: ArcShiftIssue[];
  }>;
  protagonistArcMissing: boolean;
  supportingArcIssues: Array<{
    characterId: string;
    shiftId: string;
    issues: ArcShiftIssue[];
  }>;
}

export function validateArcShiftsForArc(arc: ArcOutline): ArcArcShiftCoverage {
  const protagonistShiftIssues: ArcArcShiftCoverage["protagonistShiftIssues"] = [];
  const supportingArcIssues: ArcArcShiftCoverage["supportingArcIssues"] = [];

  const protagonistArc: ProtagonistArc | undefined = arc.protagonistArc;
  const protagonistArcMissing =
    !protagonistArc ||
    !protagonistArc.startInternalState?.trim() ||
    !protagonistArc.endInternalState?.trim() ||
    !protagonistArc.falseBeliefChallenged?.trim() ||
    !protagonistArc.costAccepted?.trim() ||
    !Array.isArray(protagonistArc.shifts) ||
    protagonistArc.shifts.length === 0;

  if (protagonistArc?.shifts) {
    for (const shift of protagonistArc.shifts) {
      const issues = validateArcShift(shift);
      if (issues.length > 0) {
        protagonistShiftIssues.push({ shiftId: shift.id ?? "", issues });
      }
    }
  }

  const supportingArcs: SupportingCharacterArc[] = arc.supportingCharacterArcs ?? [];
  for (const supportingArc of supportingArcs) {
    if (!Array.isArray(supportingArc.shifts)) {
      continue;
    }
    for (const shift of supportingArc.shifts) {
      const issues = validateArcShift(shift);
      if (issues.length > 0) {
        supportingArcIssues.push({
          characterId: supportingArc.characterId,
          shiftId: shift.id ?? "",
          issues,
        });
      }
    }
  }

  return {
    arcId: arc.id,
    protagonistShiftIssues,
    protagonistArcMissing,
    supportingArcIssues,
  };
}

export function validateArcShiftsForArcs(arcs: ArcOutline[]): ArcArcShiftCoverage[] {
  return arcs
    .map((arc) => validateArcShiftsForArc(arc))
    .filter(
      (coverage) =>
        coverage.protagonistArcMissing ||
        coverage.protagonistShiftIssues.length > 0 ||
        coverage.supportingArcIssues.length > 0,
    );
}
