import type {
  BeatOutline,
  ChapterArtifact,
  ChapterPlan,
  CharacterState,
  EpisodePacket,
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

export interface DelayedConsequenceStatus {
  sourceChapterNumber: number;
  sourceBeatId: string | null;
  consequence: string;
  status: "active" | "resolved" | "indeterminate";
  evidenceChapterNumber: number | null;
  evidence: string[];
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

export interface AppliedOutlinePatchChange {
  beatId: string;
  suggestionType: OutlinePatchSuggestion["suggestionType"];
  changedFields: string[];
  appendedConstraint: string | null;
}

export interface SkippedOutlinePatchSuggestion {
  beatId: string;
  suggestionType: OutlinePatchSuggestion["suggestionType"];
  reason: string;
}

export interface ApplyOutlinePatchSuggestionsResult {
  beatOutlines: BeatOutline[];
  applied: AppliedOutlinePatchChange[];
  skipped: SkippedOutlinePatchSuggestion[];
}

export interface OutlinePatchApplyFilters {
  onlyBeatIds?: string[];
  skipBeatIds?: string[];
  onlySuggestionTypes?: Array<OutlinePatchSuggestion["suggestionType"]>;
  skipSuggestionTypes?: Array<OutlinePatchSuggestion["suggestionType"]>;
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
  const normalized = normalizeForMatching(text);
  const baseTokens = normalized
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
  const cjkTokens = Array.from(text.matchAll(/[\p{Script=Han}]{4,}/gu)).flatMap((match) => {
    const chunk = match[0];
    const grams: string[] = [];
    for (let index = 0; index < chunk.length - 1; index += 2) {
      grams.push(chunk.slice(index, index + 2));
    }
    return grams;
  });

  return uniqueStrings(
    [...baseTokens, ...cjkTokens],
    16,
  );
}

function countTokenMatches(source: string, target: string): number {
  const tokens = extractMatchTokens(source);
  if (tokens.length === 0) {
    return 0;
  }
  const normalizedTarget = normalizeForMatching(target);
  return tokens.filter((token) => normalizedTarget.includes(token)).length;
}

function hasMeaningfulMatch(source: string, target: string): boolean {
  const tokens = extractMatchTokens(source);
  if (tokens.length === 0) {
    return false;
  }
  return countTokenMatches(source, target) >= Math.min(2, tokens.length);
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

function combineFromBeatAndPacket(
  beatValue: string | null | undefined,
  packetValue: string | null | undefined,
  carryover?: string,
): string | null {
  const beatTrim = beatValue?.trim();
  const packetTrim = packetValue?.trim();
  const carryoverTrim = carryover?.trim();
  const segments: string[] = [];
  if (packetTrim) {
    segments.push(packetTrim);
  } else if (beatTrim) {
    segments.push(beatTrim);
  }
  if (carryoverTrim && !segments.some((segment) => segment.includes(carryoverTrim))) {
    segments.push(`承接：${carryoverTrim}`);
  }
  if (segments.length === 0 && beatTrim) {
    segments.push(beatTrim);
  }
  return segments.length > 0 ? segments.join(" ｜ ") : null;
}

function deriveRelationshipShift(args: {
  beatOutline?: BeatOutline;
  episodePacket?: EpisodePacket;
}): string | null {
  const beatShift = args.beatOutline?.relationshipShift?.trim();
  if (!args.episodePacket) {
    return beatShift ?? null;
  }
  if (args.episodePacket.payoffType === "relationship_shift") {
    const supportingRelationship = args.episodePacket.activeThreadsUsed.find(
      (item) => item.threadId.includes("relationship"),
    );
    if (supportingRelationship) {
      const detail = `${args.episodePacket.payoffType} 推动关系状态变化（线程 ${supportingRelationship.threadId}）`;
      return beatShift ? `${beatShift} ｜ ${detail}` : detail;
    }
  }
  const relationshipDelta = args.episodePacket.stateDeltasExpected.find(
    (delta) => delta.targetType === "relationship",
  );
  if (relationshipDelta) {
    const detail = relationshipDelta.description;
    return beatShift ? `${beatShift} ｜ ${detail}` : detail;
  }
  return beatShift ?? null;
}

export function buildDecisionLogArtifact(args: {
  chapterNumber: number;
  chapterPlan: ChapterPlan;
  beatOutline?: BeatOutline;
  draft: string;
  characterStates: CharacterState[];
  roleDrivenReview?: RoleDrivenReviewerResult;
  episodePacket?: EpisodePacket;
  recentConsequences?: string[];
}): DecisionLogArtifact {
  const recentConsequence = args.recentConsequences?.[0];
  const ownerIds = (() => {
    if (args.episodePacket?.agencyOwnerId) {
      const ids = [args.episodePacket.agencyOwnerId];
      if (args.beatOutline?.decisionOwnerIds) {
        for (const id of args.beatOutline.decisionOwnerIds) {
          if (!ids.includes(id)) {
            ids.push(id);
          }
        }
      }
      return ids.slice(0, 2);
    }
    return args.beatOutline?.decisionOwnerIds ?? args.chapterPlan.requiredCharacters.slice(0, 2);
  })();
  const decisionPressure = combineFromBeatAndPacket(
    args.beatOutline?.decisionPressure ?? null,
    args.episodePacket?.nonTransferableChoice ?? null,
    recentConsequence,
  );
  const likelyChoice = combineFromBeatAndPacket(
    args.beatOutline?.likelyChoice ?? null,
    args.episodePacket?.tolerableOptions[0] ?? null,
  );
  const immediateConsequence = combineFromBeatAndPacket(
    args.beatOutline?.immediateConsequence ?? null,
    args.episodePacket?.protagonistConsequence ?? null,
  );
  const availableOptions = (() => {
    const beatOptions = args.beatOutline?.availableOptions ?? [];
    const packetOptions = args.episodePacket?.tolerableOptions ?? [];
    const merged: string[] = [];
    for (const value of [...beatOptions, ...packetOptions]) {
      const trimmed = value?.trim();
      if (trimmed && !merged.includes(trimmed)) {
        merged.push(trimmed);
      }
    }
    return merged;
  })();
  const relationshipShift = deriveRelationshipShift({
    beatOutline: args.beatOutline,
    episodePacket: args.episodePacket,
  });

  const owners: DecisionLogOwnerRecord[] = ownerIds
    .map((id) => args.characterStates.find((character) => character.id === id))
    .filter((item): item is CharacterState => Boolean(item))
    .map((character) => ({
      id: character.id,
      name: character.name,
      coreDesire: character.decisionProfile?.coreDesire ?? null,
      coreFear: character.decisionProfile?.coreFear ?? null,
      falseBelief: character.decisionProfile?.falseBelief ?? null,
      likelyChoice,
      immediateConsequence,
      delayedConsequence: args.beatOutline?.delayedConsequence ?? null,
      evidenceSnippets: findDecisionEvidenceSnippets({
        draft: args.draft,
        characterName: character.name,
        likelyChoice: likelyChoice ?? args.beatOutline?.likelyChoice,
        immediateConsequence: immediateConsequence ?? args.beatOutline?.immediateConsequence,
      }),
    }));

  return {
    chapterNumber: args.chapterNumber,
    chapterType: args.chapterPlan.chapterType ?? null,
    beatId: args.beatOutline?.id ?? args.chapterPlan.beatId ?? null,
    decisionPressure,
    availableOptions,
    likelyChoice,
    immediateConsequence,
    delayedConsequence: args.beatOutline?.delayedConsequence ?? null,
    relationshipShift,
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
  return buildDelayedConsequenceStatuses(args)
    .filter((item) => item.status !== "resolved")
    .map((item) => item.consequence)
    .slice(0, args.limit ?? 6);
}

export function buildDelayedConsequenceStatuses(args: {
  decisionLogs: Array<{ chapterNumber: number; decisionLog: DecisionLogArtifact | null }>;
  fromChapterNumber: number;
  limit?: number;
}): DelayedConsequenceStatus[] {
  const statuses: DelayedConsequenceStatus[] = [];
  const sortedLogs = [...args.decisionLogs].sort(
    (left, right) => left.chapterNumber - right.chapterNumber,
  );

  const consequenceSeen = new Set<string>();
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
    if (consequenceSeen.has(normalized)) {
      continue;
    }
    consequenceSeen.add(normalized);

    const laterLogs = sortedLogs.filter(
      (candidate) =>
        candidate.chapterNumber > item.chapterNumber &&
        candidate.chapterNumber <= args.fromChapterNumber,
    );
    let activeEvidence: DelayedConsequenceStatus | null = null;
    let resolvedEvidence: DelayedConsequenceStatus | null = null;

    for (const later of laterLogs) {
      const decisionLog = later.decisionLog;
      if (!decisionLog) {
        continue;
      }

      const activeFields = [
        decisionLog.decisionPressure,
        decisionLog.delayedConsequence,
        ...decisionLog.availableOptions,
      ].filter((value): value is string => Boolean(value?.trim()));
      const resolvedFields = [
        decisionLog.likelyChoice,
        decisionLog.immediateConsequence,
        decisionLog.relationshipShift,
        decisionLog.themeShift,
      ].filter((value): value is string => Boolean(value?.trim()));

      const activeMatches = activeFields.filter((field) => hasMeaningfulMatch(consequence, field));
      const resolvedMatches = resolvedFields.filter((field) => hasMeaningfulMatch(consequence, field));

      if (activeMatches.length > 0) {
        activeEvidence = {
          sourceChapterNumber: item.chapterNumber,
          sourceBeatId: item.decisionLog?.beatId ?? null,
          consequence,
          status: "active",
          evidenceChapterNumber: later.chapterNumber,
          evidence: activeMatches.slice(0, 3),
        };
      }
      if (resolvedMatches.length > 0) {
        resolvedEvidence = {
          sourceChapterNumber: item.chapterNumber,
          sourceBeatId: item.decisionLog?.beatId ?? null,
          consequence,
          status: "resolved",
          evidenceChapterNumber: later.chapterNumber,
          evidence: resolvedMatches.slice(0, 3),
        };
      }
    }

    statuses.push(
      resolvedEvidence ??
        activeEvidence ?? {
          sourceChapterNumber: item.chapterNumber,
          sourceBeatId: item.decisionLog?.beatId ?? null,
          consequence,
          status: "indeterminate",
          evidenceChapterNumber: null,
          evidence: [],
        },
    );
  }

  return statuses.slice(0, args.limit ?? 6);
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
  sourceDelayedConsequenceStatus?: DelayedConsequenceStatus | null;
}): OutlinePatchSuggestion[] {
  if (!args.sourceDecisionLog) {
    return [];
  }

  const ownerIds = args.sourceDecisionLog.owners.map((owner) => owner.id);
  const delayedConsequence =
    args.sourceDelayedConsequenceStatus?.status === "resolved"
      ? null
      : args.sourceDecisionLog.delayedConsequence;
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

function appendUniqueConstraint(constraints: string[], constraint: string): {
  constraints: string[];
  appended: boolean;
} {
  const normalized = constraint.trim();
  if (!normalized) {
    return { constraints, appended: false };
  }
  if (constraints.some((item) => normalizeForMatching(item) === normalizeForMatching(normalized))) {
    return { constraints, appended: false };
  }
  return {
    constraints: [...constraints, normalized],
    appended: true,
  };
}

export function applyOutlinePatchSuggestions(args: {
  beatOutlines: BeatOutline[];
  suggestions: OutlinePatchSuggestion[];
  filters?: OutlinePatchApplyFilters;
}): ApplyOutlinePatchSuggestionsResult {
  const applied: AppliedOutlinePatchChange[] = [];
  const skipped: SkippedOutlinePatchSuggestion[] = [];
  const beatMap = new Map(args.beatOutlines.map((beat) => [beat.id, beat]));
  const onlyBeatIds = new Set(args.filters?.onlyBeatIds ?? []);
  const skipBeatIds = new Set(args.filters?.skipBeatIds ?? []);
  const onlySuggestionTypes = new Set(args.filters?.onlySuggestionTypes ?? []);
  const skipSuggestionTypes = new Set(args.filters?.skipSuggestionTypes ?? []);

  for (const suggestion of args.suggestions) {
    if (onlyBeatIds.size > 0 && !onlyBeatIds.has(suggestion.beatId)) {
      skipped.push({
        beatId: suggestion.beatId,
        suggestionType: suggestion.suggestionType,
        reason: "Filtered out by onlyBeatIds.",
      });
      continue;
    }
    if (skipBeatIds.has(suggestion.beatId)) {
      skipped.push({
        beatId: suggestion.beatId,
        suggestionType: suggestion.suggestionType,
        reason: "Filtered out by skipBeatIds.",
      });
      continue;
    }
    if (onlySuggestionTypes.size > 0 && !onlySuggestionTypes.has(suggestion.suggestionType)) {
      skipped.push({
        beatId: suggestion.beatId,
        suggestionType: suggestion.suggestionType,
        reason: "Filtered out by onlySuggestionTypes.",
      });
      continue;
    }
    if (skipSuggestionTypes.has(suggestion.suggestionType)) {
      skipped.push({
        beatId: suggestion.beatId,
        suggestionType: suggestion.suggestionType,
        reason: "Filtered out by skipSuggestionTypes.",
      });
      continue;
    }

    const currentBeat = beatMap.get(suggestion.beatId);
    if (!currentBeat) {
      skipped.push({
        beatId: suggestion.beatId,
        suggestionType: suggestion.suggestionType,
        reason: "Beat not found in current beat outlines.",
      });
      continue;
    }

    const changedFields: string[] = [];
    let nextBeat: BeatOutline = { ...currentBeat };

    const patch = suggestion.suggestedPatch;
    if (
      patch.decisionPressure &&
      normalizeForMatching(nextBeat.decisionPressure ?? "") !== normalizeForMatching(patch.decisionPressure)
    ) {
      nextBeat = { ...nextBeat, decisionPressure: patch.decisionPressure };
      changedFields.push("decisionPressure");
    }
    if (
      patch.delayedConsequence &&
      normalizeForMatching(nextBeat.delayedConsequence ?? "") !== normalizeForMatching(patch.delayedConsequence)
    ) {
      nextBeat = { ...nextBeat, delayedConsequence: patch.delayedConsequence };
      changedFields.push("delayedConsequence");
    }
    if (
      patch.relationshipShift &&
      normalizeForMatching(nextBeat.relationshipShift ?? "") !== normalizeForMatching(patch.relationshipShift)
    ) {
      nextBeat = { ...nextBeat, relationshipShift: patch.relationshipShift };
      changedFields.push("relationshipShift");
    }

    const constraintResult = patch.appendConstraint
      ? appendUniqueConstraint(nextBeat.constraints ?? [], patch.appendConstraint)
      : { constraints: nextBeat.constraints ?? [], appended: false };
    if (constraintResult.appended) {
      nextBeat = { ...nextBeat, constraints: constraintResult.constraints };
    }

    if (changedFields.length === 0 && !constraintResult.appended) {
      skipped.push({
        beatId: suggestion.beatId,
        suggestionType: suggestion.suggestionType,
        reason: "Patch is already present.",
      });
      continue;
    }

    beatMap.set(suggestion.beatId, nextBeat);
    applied.push({
      beatId: suggestion.beatId,
      suggestionType: suggestion.suggestionType,
      changedFields,
      appendedConstraint: constraintResult.appended ? patch.appendConstraint ?? null : null,
    });
  }

  return {
    beatOutlines: args.beatOutlines.map((beat) => beatMap.get(beat.id) ?? beat),
    applied,
    skipped,
  };
}
