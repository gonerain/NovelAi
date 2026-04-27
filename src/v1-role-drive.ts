import type {
  BeatOutline,
  ChapterArtifact,
  ChapterPlan,
  CharacterState,
  RoleDrivenReviewerResult,
} from "./domain/index.js";

export interface DecisionLogOwnerRecord {
  id: string;
  name: string;
  coreDesire: string | null;
  coreFear: string | null;
  falseBelief: string | null;
  likelyChoice: string | null;
  immediateConsequence: string | null;
  delayedConsequence: string | null;
  evidenceSnippets: string[];
}

export interface DecisionLogArtifact {
  chapterNumber: number;
  chapterType: ChapterPlan["chapterType"] | null;
  beatId: string | null;
  decisionPressure: string | null;
  availableOptions: string[];
  likelyChoice: string | null;
  immediateConsequence: string | null;
  delayedConsequence: string | null;
  relationshipShift: string | null;
  themeShift: string | null;
  owners: DecisionLogOwnerRecord[];
  reviewerAssessment:
    | {
        findingCount: number;
        findings: RoleDrivenReviewerResult["findings"];
        scoring: RoleDrivenReviewerResult["scoring"];
        notes: string[];
      }
    | null;
}

export interface RelationshipShiftArtifact {
  chapterNumber: number;
  beatId: string | null;
  shift: string | null;
  involvedCharacters: Array<{
    id: string;
    name: string;
  }>;
  evidenceSnippets: string[];
  reviewerRiskNotes: string[];
}

export interface ConsequenceEdgeArtifact {
  chapterNumber: number;
  beatId: string | null;
  edges: Array<{
    sourceType: "character" | "choice" | "relationship";
    sourceId: string;
    targetType: "choice" | "pressure" | "relationship" | "delayed_consequence";
    targetId: string;
    label: string;
    detail: string;
  }>;
}

export interface OutlinePatchSuggestion {
  beatId: string;
  arcId: string;
  chapterRangeHint: BeatOutline["chapterRangeHint"];
  suggestionType:
    | "decision_pressure_alignment"
    | "relationship_shift_alignment"
    | "delayed_consequence_alignment";
  reason: string;
  currentBeatSnapshot: {
    decisionPressure?: string;
    delayedConsequence?: string;
    relationshipShift?: string;
    constraints: string[];
  };
  suggestedPatch: {
    decisionPressure?: string;
    delayedConsequence?: string;
    relationshipShift?: string;
    appendConstraint?: string;
  };
}

function uniqueStrings(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMatchTokens(text: string): string[] {
  return uniqueStrings(
    normalizeForMatching(text)
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4),
    8,
  );
}

export function findDecisionEvidenceSnippets(args: {
  draft: string;
  characterName: string;
  likelyChoice?: string;
  immediateConsequence?: string;
}): string[] {
  const sentences = args.draft
    .split(/[\r\n]+|(?<=[。！？!?])/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6);
  const tokens = [
    args.characterName,
    ...(args.likelyChoice ? args.likelyChoice.split(/\s+/) : []),
    ...(args.immediateConsequence ? args.immediateConsequence.split(/\s+/) : []),
  ]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const scored = sentences
    .map((sentence) => ({
      sentence,
      score: tokens.filter((token) => sentence.includes(token)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.sentence.length - right.sentence.length)
    .slice(0, 3)
    .map((item) => item.sentence);

  return uniqueStrings(scored, 3);
}

export function buildDecisionLogArtifact(args: {
  chapterNumber: number;
  chapterPlan: ChapterPlan;
  beatOutline?: BeatOutline;
  draft: string;
  characterStates: CharacterState[];
  roleDrivenReview?: RoleDrivenReviewerResult;
}): DecisionLogArtifact {
  const ownerIds = args.beatOutline?.decisionOwnerIds ?? args.chapterPlan.requiredCharacters.slice(0, 2);
  const owners: DecisionLogOwnerRecord[] = ownerIds
    .map((id) => args.characterStates.find((character) => character.id === id))
    .filter((item): item is CharacterState => Boolean(item))
    .map((character) => ({
      id: character.id,
      name: character.name,
      coreDesire: character.decisionProfile?.coreDesire ?? null,
      coreFear: character.decisionProfile?.coreFear ?? null,
      falseBelief: character.decisionProfile?.falseBelief ?? null,
      likelyChoice: args.beatOutline?.likelyChoice ?? null,
      immediateConsequence: args.beatOutline?.immediateConsequence ?? null,
      delayedConsequence: args.beatOutline?.delayedConsequence ?? null,
      evidenceSnippets: findDecisionEvidenceSnippets({
        draft: args.draft,
        characterName: character.name,
        likelyChoice: args.beatOutline?.likelyChoice,
        immediateConsequence: args.beatOutline?.immediateConsequence,
      }),
    }));

  return {
    chapterNumber: args.chapterNumber,
    chapterType: args.chapterPlan.chapterType ?? null,
    beatId: args.beatOutline?.id ?? args.chapterPlan.beatId ?? null,
    decisionPressure: args.beatOutline?.decisionPressure ?? null,
    availableOptions: args.beatOutline?.availableOptions ?? [],
    likelyChoice: args.beatOutline?.likelyChoice ?? null,
    immediateConsequence: args.beatOutline?.immediateConsequence ?? null,
    delayedConsequence: args.beatOutline?.delayedConsequence ?? null,
    relationshipShift: args.beatOutline?.relationshipShift ?? null,
    themeShift: args.beatOutline?.themeShift ?? null,
    owners,
    reviewerAssessment: args.roleDrivenReview
      ? {
          findingCount: args.roleDrivenReview.findings.length,
          findings: args.roleDrivenReview.findings,
          scoring: args.roleDrivenReview.scoring,
          notes: args.roleDrivenReview.notes,
        }
      : null,
  };
}

export function buildRelationshipShiftArtifact(args: {
  decisionLog: DecisionLogArtifact;
  draft: string;
}): RelationshipShiftArtifact {
  return {
    chapterNumber: args.decisionLog.chapterNumber,
    beatId: args.decisionLog.beatId,
    shift: args.decisionLog.relationshipShift,
    involvedCharacters: args.decisionLog.owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
    })),
    evidenceSnippets: args.decisionLog.relationshipShift
      ? findDecisionEvidenceSnippets({
          draft: args.draft,
          characterName: args.decisionLog.owners[0]?.name ?? "",
          likelyChoice: args.decisionLog.relationshipShift,
          immediateConsequence: args.decisionLog.immediateConsequence ?? undefined,
        })
      : [],
    reviewerRiskNotes:
      args.decisionLog.reviewerAssessment?.findings
        .filter((finding) =>
          finding.issueType === "consequence_chain_weak" ||
          finding.issueType === "character_cost_missing",
        )
        .map((finding) => finding.suggestedFix)
        .slice(0, 3) ?? [],
  };
}

export function buildConsequenceEdgesArtifact(args: {
  decisionLog: DecisionLogArtifact;
}): ConsequenceEdgeArtifact {
  const choiceId = `chapter-${String(args.decisionLog.chapterNumber).padStart(3, "0")}-choice`;
  const delayedId =
    args.decisionLog.delayedConsequence
      ? `chapter-${String(args.decisionLog.chapterNumber).padStart(3, "0")}-delayed`
      : "";
  const relationshipId =
    args.decisionLog.relationshipShift
      ? `chapter-${String(args.decisionLog.chapterNumber).padStart(3, "0")}-relationship`
      : "";
  const edges: ConsequenceEdgeArtifact["edges"] = [];

  for (const owner of args.decisionLog.owners) {
    edges.push({
      sourceType: "character",
      sourceId: owner.id,
      targetType: "choice",
      targetId: choiceId,
      label: "made_choice_under_pressure",
      detail: args.decisionLog.likelyChoice ?? "choice under pressure",
    });
  }

  if (args.decisionLog.relationshipShift && relationshipId) {
    edges.push({
      sourceType: "choice",
      sourceId: choiceId,
      targetType: "relationship",
      targetId: relationshipId,
      label: "reshapes_relationship",
      detail: args.decisionLog.relationshipShift,
    });
  }

  if (args.decisionLog.delayedConsequence && delayedId) {
    edges.push({
      sourceType: "choice",
      sourceId: choiceId,
      targetType: "delayed_consequence",
      targetId: delayedId,
      label: "creates_delayed_consequence",
      detail: args.decisionLog.delayedConsequence,
    });
  }

  if (args.decisionLog.delayedConsequence && args.decisionLog.relationshipShift && delayedId && relationshipId) {
    edges.push({
      sourceType: "relationship",
      sourceId: relationshipId,
      targetType: "delayed_consequence",
      targetId: delayedId,
      label: "amplifies_future_pressure",
      detail: args.decisionLog.delayedConsequence,
    });
  }

  return {
    chapterNumber: args.decisionLog.chapterNumber,
    beatId: args.decisionLog.beatId,
    edges,
  };
}

export function buildUnresolvedDelayedConsequenceList(args: {
  decisionLogs: Array<{ chapterNumber: number; decisionLog: DecisionLogArtifact | null }>;
  fromChapterNumber: number;
  limit?: number;
}): string[] {
  const laterTexts = new Set(
    args.decisionLogs
      .filter((item) => item.chapterNumber > args.fromChapterNumber)
      .flatMap((item) => {
        const decisionLog = item.decisionLog;
        return [
          decisionLog?.decisionPressure ?? "",
          decisionLog?.immediateConsequence ?? "",
          decisionLog?.delayedConsequence ?? "",
          decisionLog?.relationshipShift ?? "",
        ].map((value) => normalizeForMatching(value));
      })
      .filter(Boolean),
  );

  const unresolved: string[] = [];
  for (const item of args.decisionLogs) {
    if (item.chapterNumber > args.fromChapterNumber) {
      continue;
    }
    const consequence = item.decisionLog?.delayedConsequence?.trim();
    if (!consequence) {
      continue;
    }
    const normalized = normalizeForMatching(consequence);
    if (!normalized) {
      continue;
    }
    const resolvedLater = [...laterTexts].some(
      (text) => text.includes(normalized) || normalized.includes(text),
    );
    if (!resolvedLater) {
      unresolved.push(consequence);
    }
  }

  return uniqueStrings(unresolved, args.limit ?? 6);
}

function scoreBeatPatchMatch(args: {
  beat: BeatOutline;
  ownerIds: string[];
  delayedConsequence?: string | null;
  relationshipShift?: string | null;
  decisionPressure?: string | null;
}): number {
  let score = 0;
  const ownerIdSet = new Set(args.ownerIds);
  if (args.beat.requiredCharacters.some((id) => ownerIdSet.has(id))) {
    score += 3;
  }
  if ((args.beat.decisionOwnerIds ?? []).some((id) => ownerIdSet.has(id))) {
    score += 3;
  }

  const haystack = normalizeForMatching(
    [
      args.beat.beatGoal,
      args.beat.conflict,
      args.beat.expectedChange,
      ...(args.beat.constraints ?? []),
      ...(args.beat.revealTargets ?? []),
      args.beat.decisionPressure ?? "",
      args.beat.delayedConsequence ?? "",
      args.beat.relationshipShift ?? "",
    ].join(" "),
  );

  const sources = [args.delayedConsequence, args.relationshipShift, args.decisionPressure].filter(
    (item): item is string => Boolean(item?.trim()),
  );
  for (const source of sources) {
    const tokens = extractMatchTokens(source);
    const matched = tokens.filter((token) => haystack.includes(token)).length;
    score += matched;
  }

  return score;
}

export function buildOutlinePatchSuggestions(args: {
  fromChapter: number;
  beatOutlines: BeatOutline[];
  sourceDecisionLog: DecisionLogArtifact | null;
}): OutlinePatchSuggestion[] {
  if (!args.sourceDecisionLog) {
    return [];
  }

  const ownerIds = args.sourceDecisionLog.owners.map((owner) => owner.id);
  const delayedConsequence = args.sourceDecisionLog.delayedConsequence;
  const relationshipShift = args.sourceDecisionLog.relationshipShift;
  const decisionPressure = args.sourceDecisionLog.decisionPressure;

  const futureBeats = args.beatOutlines.filter((beat) => {
    const start = beat.chapterRangeHint?.start;
    return typeof start !== "number" || start > args.fromChapter;
  });

  const ranked = futureBeats
    .map((beat) => ({
      beat,
      score: scoreBeatPatchMatch({
        beat,
        ownerIds,
        delayedConsequence,
        relationshipShift,
        decisionPressure,
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.beat.order - right.beat.order)
    .slice(0, 6);

  const suggestions: OutlinePatchSuggestion[] = [];

  for (const item of ranked) {
    const beat = item.beat;
    if (
      delayedConsequence &&
      normalizeForMatching(beat.delayedConsequence ?? "") !== normalizeForMatching(delayedConsequence)
    ) {
      suggestions.push({
        beatId: beat.id,
        arcId: beat.arcId,
        chapterRangeHint: beat.chapterRangeHint,
        suggestionType: "delayed_consequence_alignment",
        reason: `Future beat should acknowledge the unresolved delayed consequence from chapter ${args.fromChapter}.`,
        currentBeatSnapshot: {
          decisionPressure: beat.decisionPressure,
          delayedConsequence: beat.delayedConsequence,
          relationshipShift: beat.relationshipShift,
          constraints: beat.constraints,
        },
        suggestedPatch: {
          delayedConsequence,
          appendConstraint: `Carry forward delayed consequence from chapter ${args.fromChapter}: ${delayedConsequence}`,
        },
      });
    }

    if (
      relationshipShift &&
      normalizeForMatching(beat.relationshipShift ?? "") !== normalizeForMatching(relationshipShift)
    ) {
      suggestions.push({
        beatId: beat.id,
        arcId: beat.arcId,
        chapterRangeHint: beat.chapterRangeHint,
        suggestionType: "relationship_shift_alignment",
        reason: `Future beat should reflect the relationship shift created in chapter ${args.fromChapter}.`,
        currentBeatSnapshot: {
          decisionPressure: beat.decisionPressure,
          delayedConsequence: beat.delayedConsequence,
          relationshipShift: beat.relationshipShift,
          constraints: beat.constraints,
        },
        suggestedPatch: {
          relationshipShift,
          appendConstraint: `Preserve relationship fallout from chapter ${args.fromChapter}: ${relationshipShift}`,
        },
      });
    }

    if (
      decisionPressure &&
      normalizeForMatching(beat.decisionPressure ?? "") !== normalizeForMatching(decisionPressure)
    ) {
      suggestions.push({
        beatId: beat.id,
        arcId: beat.arcId,
        chapterRangeHint: beat.chapterRangeHint,
        suggestionType: "decision_pressure_alignment",
        reason: `Future beat should inherit or answer the active pressure chain from chapter ${args.fromChapter}.`,
        currentBeatSnapshot: {
          decisionPressure: beat.decisionPressure,
          delayedConsequence: beat.delayedConsequence,
          relationshipShift: beat.relationshipShift,
          constraints: beat.constraints,
        },
        suggestedPatch: {
          decisionPressure,
          appendConstraint: `Active pressure chain from chapter ${args.fromChapter}: ${decisionPressure}`,
        },
      });
    }
  }

  return suggestions.slice(0, 10);
}
