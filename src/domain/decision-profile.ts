import type { CharacterDecisionProfile, CharacterState } from "./types.js";

export const DECISION_PROFILE_FIELDS = [
  "coreDesire",
  "coreFear",
  "falseBelief",
  "defaultCopingStyle",
  "controlPattern",
  "unacceptableCosts",
  "likelyCompromises",
  "relationshipSoftSpots",
  "breakThresholds",
] as const;

export type DecisionProfileField = (typeof DECISION_PROFILE_FIELDS)[number];

const STRING_FIELDS: ReadonlyArray<DecisionProfileField> = [
  "coreDesire",
  "coreFear",
  "falseBelief",
  "defaultCopingStyle",
  "controlPattern",
];

const ARRAY_FIELDS: ReadonlyArray<DecisionProfileField> = [
  "unacceptableCosts",
  "likelyCompromises",
  "relationshipSoftSpots",
  "breakThresholds",
];

export function emptyDecisionProfile(): CharacterDecisionProfile {
  return {
    coreDesire: "",
    coreFear: "",
    falseBelief: "",
    defaultCopingStyle: "",
    controlPattern: "",
    unacceptableCosts: [],
    likelyCompromises: [],
    relationshipSoftSpots: [],
    breakThresholds: [],
  };
}

export interface DecisionProfileGap {
  characterId: string;
  characterName: string;
  missingFields: DecisionProfileField[];
}

export function findDecisionProfileGap(state: CharacterState): DecisionProfileGap | null {
  const profile = state.decisionProfile;
  const missing: DecisionProfileField[] = [];

  if (!profile) {
    return {
      characterId: state.id,
      characterName: state.name,
      missingFields: [...DECISION_PROFILE_FIELDS],
    };
  }

  for (const field of STRING_FIELDS) {
    const value = profile[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      missing.push(field);
    }
  }

  for (const field of ARRAY_FIELDS) {
    const value = profile[field];
    if (!Array.isArray(value) || value.filter((item) => typeof item === "string" && item.trim().length > 0).length === 0) {
      missing.push(field);
    }
  }

  if (missing.length === 0) {
    return null;
  }

  return {
    characterId: state.id,
    characterName: state.name,
    missingFields: missing,
  };
}

export function validateCharacterDecisionProfileCoverage(
  states: CharacterState[],
): DecisionProfileGap[] {
  const gaps: DecisionProfileGap[] = [];
  for (const state of states) {
    const gap = findDecisionProfileGap(state);
    if (gap) {
      gaps.push(gap);
    }
  }
  return gaps;
}

export function isDecisionProfileEmpty(profile: CharacterDecisionProfile | undefined): boolean {
  if (!profile) {
    return true;
  }
  for (const field of STRING_FIELDS) {
    const value = profile[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return false;
    }
  }
  for (const field of ARRAY_FIELDS) {
    const value = profile[field];
    if (Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0)) {
      return false;
    }
  }
  return true;
}
