import {
  buildChapterCardSemanticText,
  buildContextPack,
  buildDerivedAuthorProfilePacks,
  buildMemoryRetrievalPack,
  buildMemorySemanticText,
  buildMemorySystemArtifacts,
  buildSemanticQueryText,
  buildSpecializedReviewerViews,
  defaultPayoffPatterns,
  resolveGenrePayoffPack,
  toSemanticRetrievalHits,
  type ArcOutline,
  type BeatOutline,
  type ChapterArtifact,
  type ChapterCommercialPlan,
  type ChapterPlan,
  type CharacterState,
  type CommercialReviewerResult,
  type DerivedAuthorProfilePacks,
  type FactConsistencyReviewerResult,
  type GenrePayoffPack,
  type MemorySearchLedgerType,
  type MissingResourceReviewerResult,
  type PlannerSearchIntent,
  type RoleDrivenReviewerResult,
  type StoryMemory,
  type StoryOutline,
  type StorySetup,
  type StyleBible,
  type ThemeBible,
  type WorldFact,
} from "./domain/index.js";
import { EmbeddingService } from "./embedding/service.js";
import type { EmbeddingCacheSnapshot } from "./embedding/service.js";
import {
  demoArcOutlines,
  demoBeatOutlines,
  demoCharacterStates,
  demoStoryMemories,
  demoStoryOutline,
  demoStorySetup,
  demoStyleBible,
  demoThemeBible,
  demoWorldFacts,
} from "./defaults/demo-project.js";
import { FileProjectRepository } from "./storage/index.js";
import { embeddingCachePath } from "./v1-paths.js";

export interface ProjectBaseState {
  storySetup: StorySetup;
  genrePayoffPack: GenrePayoffPack;
  storyOutline: StoryOutline;
  arcOutlines: ArcOutline[];
  beatOutlines: BeatOutline[];
  authorPacks: DerivedAuthorProfilePacks;
  themeBible: ThemeBible;
  styleBible: StyleBible;
  characterStates: CharacterState[];
  worldFacts: WorldFact[];
  storyMemories: StoryMemory[];
  chapterPlans: ChapterPlan[];
}

export async function loadAllChapterArtifacts(
  repository: FileProjectRepository,
  projectId: string,
): Promise<ChapterArtifact[]> {
  const chapterNumbers = await repository.listChapterArtifactNumbers(projectId);
  const artifacts = await Promise.all(
    chapterNumbers.map((chapterNumber) => repository.loadChapterArtifact(projectId, chapterNumber)),
  );

  return artifacts
    .filter((artifact): artifact is ChapterArtifact => Boolean(artifact))
    .sort((left, right) => left.chapterNumber - right.chapterNumber);
}

const embeddingService = new EmbeddingService();

export async function loadEmbeddingCacheForProject(
  readJsonArtifact: <T>(filepath: string) => Promise<T | null>,
  projectId: string,
): Promise<void> {
  if (!embeddingService.isPersistentCacheEnabled) {
    return;
  }

  const snapshot = await readJsonArtifact<EmbeddingCacheSnapshot>(embeddingCachePath(projectId));
  embeddingService.loadSnapshot(snapshot);
}

export async function saveEmbeddingCacheForProject(
  writeJsonArtifact: (filepath: string, data: unknown) => Promise<void>,
  projectId: string,
): Promise<void> {
  if (!embeddingService.isPersistentCacheEnabled) {
    return;
  }

  const snapshot = embeddingService.exportSnapshot();
  if (!snapshot) {
    return;
  }

  await writeJsonArtifact(embeddingCachePath(projectId), snapshot);
}

export async function resolveSemanticOverrideHits(args: {
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  chapterArtifacts: ChapterArtifact[];
}): Promise<ReturnType<typeof toSemanticRetrievalHits> | undefined> {
  if (embeddingService.mode !== "openai_compatible") {
    return undefined;
  }

  const artifacts = buildMemorySystemArtifacts({
    storyMemories: args.storyMemories,
    characterStates: [],
    chapterArtifacts: args.chapterArtifacts,
  });
  const queryText = buildSemanticQueryText(args.chapterPlan);
  const candidates = [
    ...args.storyMemories.map((memory) => ({
      kind: "memory" as const,
      sourceId: memory.id,
      label: memory.title,
      text: buildMemorySemanticText(memory),
    })),
    ...artifacts.chapterCards.map((card) => ({
      kind: "chapter_card" as const,
      sourceId: card.id,
      label: card.title,
      text: buildChapterCardSemanticText(card),
    })),
  ];
  const ranked = await embeddingService.rankCandidates({
    queryText,
    candidates,
    topK: 8,
    minScore: 0.12,
  });

  return toSemanticRetrievalHits(ranked);
}

export function assertChapterPlanningAnchors(args: {
  projectId: string;
  chapterNumber: number;
  beatOutlines: BeatOutline[];
  currentArc: ArcOutline | undefined;
  currentBeat: BeatOutline | undefined;
}): void {
  if (!args.currentArc) {
    throw new Error(
      [
        `No arc outline found for project=${args.projectId}, chapter=${args.chapterNumber}.`,
        `Run: ./run-v1.sh outline generate-stack --project ${args.projectId} --count 250`,
        `or:  .\\run-v1.ps1 outline generate-stack --project ${args.projectId} --count 250`,
      ].join("\n"),
    );
  }

  const beatsInArc = args.beatOutlines.filter((beat) => beat.arcId === args.currentArc?.id);
  if (beatsInArc.length === 0 || !args.currentBeat) {
    throw new Error(
      [
        `No beat outline found for project=${args.projectId}, arc=${args.currentArc.id}, chapter=${args.chapterNumber}.`,
        `Run: ./run-v1.sh outline generate-stack --project ${args.projectId} --count 250`,
        `or:  .\\run-v1.ps1 outline generate-stack --project ${args.projectId} --count 250`,
      ].join("\n"),
    );
  }
}

export function uniqueStrings(items: string[], limit: number): string[] {
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

export function buildRoleDrivenPlannerCarryover(args: {
  unresolvedDelayedConsequences: string[];
  limit?: number;
}): {
  mustHitConflicts: string[];
  disallowedMoves: string[];
  styleReminders: string[];
} {
  const activeConsequences = uniqueStrings(args.unresolvedDelayedConsequences, args.limit ?? 2);
  if (activeConsequences.length === 0) {
    return {
      mustHitConflicts: [],
      disallowedMoves: [],
      styleReminders: [],
    };
  }

  return {
    mustHitConflicts: activeConsequences.map(
      (item) => `Active delayed consequence must shape an on-page choice: ${item}`,
    ),
    disallowedMoves: [
      "Do not ignore active delayed consequences in favor of stale beat wording.",
      "Do not resolve delayed consequence pressure off-page or without a visible character choice.",
    ],
    styleReminders: [
      "Let active consequence pressure constrain the next choice before adding new plot machinery.",
    ],
  };
}

function normalizeLooseMatcher(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLooseMatcherTokens(text: string): string[] {
  return uniqueStrings(
    normalizeLooseMatcher(text)
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4),
    8,
  );
}

export function normalizeSearchIntent(args: {
  planned?: PlannerSearchIntent;
  requiredCharacterIds: string[];
  requiredMemoryIds: string[];
  characterStates: CharacterState[];
  storyMemories: StoryMemory[];
}): PlannerSearchIntent {
  const validLedgerTypes = new Set<MemorySearchLedgerType>([
    "resource",
    "promise",
    "injury",
    "foreshadow",
    "relationship",
  ]);
  const ledgerTypes = (args.planned?.ledgerTypes ?? []).filter(
    (item): item is MemorySearchLedgerType => validLedgerTypes.has(item as MemorySearchLedgerType),
  );
  const characterIdSet = new Set(args.characterStates.map((character) => character.id));
  const characterNameMap = new Map(
    args.characterStates.map((character) => [character.name.trim().toLowerCase(), character.id] as const),
  );
  const memoryIdSet = new Set(args.storyMemories.map((memory) => memory.id));
  const memoryTitleMap = new Map(
    args.storyMemories.map((memory) => [memory.title.trim().toLowerCase(), memory.id] as const),
  );

  const normalizedEntityIds: string[] = [];
  const fallbackExactPhrases: string[] = [];
  for (const raw of args.planned?.entityIds ?? []) {
    const normalized = raw.trim();
    if (!normalized) {
      continue;
    }
    const lowered = normalized.toLowerCase();
    const parenStripped = normalized.replace(/\s*\(.+?\)\s*$/g, "").trim();
    const mappedCharacterId =
      characterIdSet.has(normalized)
        ? normalized
        : characterNameMap.get(lowered) ??
          characterNameMap.get(parenStripped.toLowerCase());
    if (mappedCharacterId) {
      normalizedEntityIds.push(mappedCharacterId);
      continue;
    }
    fallbackExactPhrases.push(normalized);
  }

  const normalizedMemoryIds: string[] = [];
  for (const raw of args.planned?.memoryIds ?? []) {
    const normalized = raw.trim();
    if (!normalized) {
      continue;
    }
    const mappedMemoryId =
      memoryIdSet.has(normalized)
        ? normalized
        : memoryTitleMap.get(normalized.toLowerCase());
    if (mappedMemoryId) {
      normalizedMemoryIds.push(mappedMemoryId);
      continue;
    }
    fallbackExactPhrases.push(normalized);
  }

  return {
    entityIds: uniqueStrings([...normalizedEntityIds, ...args.requiredCharacterIds], 8),
    memoryIds: uniqueStrings([...normalizedMemoryIds, ...args.requiredMemoryIds], 12),
    ledgerTypes: uniqueStrings(ledgerTypes, 4) as MemorySearchLedgerType[],
    topicQueries: uniqueStrings(args.planned?.topicQueries ?? [], 6),
    exactPhrases: uniqueStrings(
      [...(args.planned?.exactPhrases ?? []), ...fallbackExactPhrases],
      8,
    ),
  };
}

export function normalizeCommercialPlan(args: {
  planned?: ChapterCommercialPlan;
  genrePayoffPack: GenrePayoffPack;
  chapterNumber: number;
  chapterType?: ChapterPlan["chapterType"];
  chapterGoal: string;
  plannedOutcome: string;
  emotionalGoal: string;
  currentSituation: string;
}): ChapterCommercialPlan {
  const validOpeningModes = new Set<NonNullable<ChapterCommercialPlan["openingMode"]>>([
    "hard_hook",
    "daily_abnormal",
    "relationship_pressure",
    "aftermath_hook",
  ]);
  const validParagraphRhythms = new Set<ChapterCommercialPlan["paragraphRhythm"]>([
    "tight",
    "balanced",
    "slow_burn",
  ]);
  const validRewardTypes = new Set<NonNullable<ChapterCommercialPlan["rewardType"]>>([
    "proof_win",
    "countermove",
    "relationship_pull",
    "rule_reveal",
    "status_shift",
  ]);
  const validRewardTimings = new Set<NonNullable<ChapterCommercialPlan["rewardTiming"]>>([
    "early",
    "mid",
    "late",
  ]);
  const chapterTypeKey = (args.chapterType ?? "progress") as keyof GenrePayoffPack["preferredRewardTypes"];
  const packOpeningModes = args.genrePayoffPack.openingModes;
  const packRewardTypes = args.genrePayoffPack.preferredRewardTypes[chapterTypeKey] ?? [];

  const fallbackOpeningMode: NonNullable<ChapterCommercialPlan["openingMode"]> =
    (args.chapterNumber <= 3 ? packOpeningModes[0] : undefined) ??
    (args.chapterType === "aftermath" && packOpeningModes.includes("aftermath_hook")
      ? "aftermath_hook"
      : undefined) ??
    packOpeningModes[0] ??
    "daily_abnormal";

  const fallbackParagraphRhythm: ChapterCommercialPlan["paragraphRhythm"] =
    args.chapterNumber <= 3 ? "tight" : args.chapterType === "aftermath" ? "balanced" : "balanced";
  const fallbackRewardType: NonNullable<ChapterCommercialPlan["rewardType"]> =
    (args.chapterNumber === 1 ? packRewardTypes[0] : undefined) ??
    packRewardTypes[0] ??
    (args.chapterType === "payoff"
      ? "proof_win"
      : args.chapterType === "aftermath"
        ? "status_shift"
        : "countermove");
  const fallbackRewardTiming: NonNullable<ChapterCommercialPlan["rewardTiming"]> =
    args.chapterType === "setup" ? "mid" : args.chapterType === "payoff" ? "late" : "mid";

  return {
    openingMode:
      args.planned?.openingMode && validOpeningModes.has(args.planned.openingMode)
        ? args.planned.openingMode
        : fallbackOpeningMode,
    coreSellPoint:
      args.planned?.coreSellPoint?.trim() || args.chapterGoal.trim() || args.currentSituation.trim(),
    visibleProblem:
      args.planned?.visibleProblem?.trim() ||
      args.currentSituation.trim() ||
      args.chapterGoal.trim(),
    externalTurn:
      args.planned?.externalTurn?.trim() || args.plannedOutcome.trim() || args.chapterGoal.trim(),
    microPayoff:
      args.planned?.microPayoff?.trim() ||
      `Let the reader see a concrete gain: ${args.plannedOutcome.trim() || args.emotionalGoal.trim() || "the situation changes in a visible way"}`,
    endHook:
      args.planned?.endHook?.trim() ||
      `Leave the next problem hanging: ${args.plannedOutcome.trim() || args.chapterGoal.trim()}`,
    readerPromise:
      args.planned?.readerPromise?.trim() ||
      `Keep pushing toward: ${args.chapterGoal.trim() || args.plannedOutcome.trim()}`,
    paragraphRhythm:
      args.planned?.paragraphRhythm && validParagraphRhythms.has(args.planned.paragraphRhythm)
        ? args.planned.paragraphRhythm
        : fallbackParagraphRhythm,
    rewardType:
      args.planned?.rewardType && validRewardTypes.has(args.planned.rewardType)
        ? args.planned.rewardType
        : fallbackRewardType,
    rewardTiming:
      args.planned?.rewardTiming && validRewardTimings.has(args.planned.rewardTiming)
        ? args.planned.rewardTiming
        : fallbackRewardTiming,
    rewardTarget:
      args.planned?.rewardTarget?.trim() ||
      args.genrePayoffPack.rewardTargetBias[0] ||
      args.plannedOutcome.trim() ||
      args.chapterGoal.trim(),
  };
}

function stripGeneratedChapterNotes(notes: string[]): string[] {
  return uniqueStrings(
    notes.filter((note) => !/^Chapter\s+\d+:/i.test(note.trim())),
    12,
  );
}

export function deriveFallbackSeedMemories(memories: StoryMemory[]): StoryMemory[] {
  const nongenerated = memories.filter((memory) => !memory.id.startsWith("chapter-"));
  const nongeneratedIds = new Set(nongenerated.map((memory) => memory.id));
  const demoIds = new Set(demoStoryMemories.map((memory) => memory.id));

  if (
    nongenerated.length > 0 &&
    nongenerated.every((memory) => demoIds.has(memory.id))
  ) {
    return demoStoryMemories
      .filter((memory) => nongeneratedIds.has(memory.id))
      .map((memory) => ({ ...memory, notes: [...memory.notes] }));
  }

  return nongenerated.map((memory) => ({
    ...memory,
    status: "active",
    lastReferencedIn: memory.introducedIn,
    notes: stripGeneratedChapterNotes(memory.notes),
  }));
}

export async function loadSeedStoryMemories(
  repository: FileProjectRepository,
  projectId: string,
  currentMemories: StoryMemory[],
): Promise<StoryMemory[]> {
  const existingSeed = await repository.loadSeedStoryMemories(projectId);
  if (existingSeed.length > 0) {
    return existingSeed;
  }

  const fallbackSeed = deriveFallbackSeedMemories(currentMemories);
  await repository.saveSeedStoryMemories(projectId, fallbackSeed);
  return fallbackSeed;
}

export function normalizePayoffPatternIds(args: {
  plannerIds?: string[];
  currentArc?: ArcOutline;
  currentBeat?: BeatOutline;
}): string[] {
  const validIds = new Set(defaultPayoffPatterns.map((pattern) => pattern.id));
  const preferredIds = [
    ...(args.currentBeat?.payoffPatternIds ?? []),
    ...(args.currentArc?.primaryPayoffPatternIds ?? []),
  ].filter((id, index, items) => Boolean(id) && items.indexOf(id) === index);

  const filteredPlannerIds = (args.plannerIds ?? []).filter((id) => validIds.has(id));

  if (filteredPlannerIds.length > 0) {
    const allowedPreferred = new Set(preferredIds);
    const aligned = filteredPlannerIds.filter((id) => allowedPreferred.has(id));
    return aligned.length > 0 ? aligned.slice(0, 2) : filteredPlannerIds.slice(0, 2);
  }

  return preferredIds.filter((id) => validIds.has(id)).slice(0, 2);
}

export function upsertChapterPlan(chapterPlans: ChapterPlan[], chapterPlan: ChapterPlan): ChapterPlan[] {
  const chapterNumber = chapterPlan.chapterNumber;
  if (!chapterNumber) {
    return [...chapterPlans, chapterPlan];
  }

  const filtered = chapterPlans.filter((item) => item.chapterNumber !== chapterNumber);
  return [...filtered, chapterPlan].sort(
    (left, right) => (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0),
  );
}

export function buildRecentConsequences(
  artifact: ChapterArtifact | null,
  fallbackGoal: string,
): string[] {
  if (!artifact) {
    return [];
  }

  return uniqueStrings(
    [
      artifact.memoryUpdate.chapterSummary,
      ...artifact.memoryUpdate.carryForwardHints,
      artifact.plan.plannedOutcome,
      fallbackGoal,
    ],
    4,
  );
}

function isDelayedConsequenceResolved(args: {
  delayedConsequence: string;
  laterArtifacts: ChapterArtifact[];
}): boolean {
  const tokens = extractLooseMatcherTokens(args.delayedConsequence);
  if (tokens.length === 0) {
    return false;
  }

  return args.laterArtifacts.some((artifact) => {
    const haystack = normalizeLooseMatcher(
      [
        artifact.memoryUpdate.chapterSummary,
        artifact.memoryUpdate.nextSituation,
        artifact.plan.plannedOutcome,
        ...artifact.memoryUpdate.carryForwardHints,
      ].join(" "),
    );
    const matchedCount = tokens.filter((token) => haystack.includes(token)).length;
    return matchedCount >= Math.min(2, tokens.length);
  });
}

export function buildUnresolvedDelayedConsequences(args: {
  chapterArtifacts: ChapterArtifact[];
  beatOutlines: BeatOutline[];
  currentChapterNumber: number;
}): string[] {
  const unresolvedByRisk = new Map<string, string>();

  const priorArtifacts = args.chapterArtifacts
    .filter((artifact) => artifact.chapterNumber < args.currentChapterNumber)
    .sort((left, right) => left.chapterNumber - right.chapterNumber);

  for (const artifact of priorArtifacts) {
    const beat = args.beatOutlines.find((item) => item.id === artifact.plan.beatId);
    const delayedConsequence = beat?.delayedConsequence?.trim();
    if (!delayedConsequence) {
      continue;
    }

    const laterArtifacts = priorArtifacts.filter(
      (candidate) => candidate.chapterNumber > artifact.chapterNumber,
    );
    if (isDelayedConsequenceResolved({ delayedConsequence, laterArtifacts })) {
      continue;
    }

    unresolvedByRisk.set(
      normalizeLooseMatcher(delayedConsequence),
      [
        `chapter=${artifact.chapterNumber}`,
        `risk=${delayedConsequence}`,
        beat?.relationshipShift ? `relationship=${beat.relationshipShift}` : undefined,
      ]
        .filter(Boolean)
        .join(", "),
    );
  }

  return uniqueStrings(Array.from(unresolvedByRisk.values()).reverse(), 4);
}

export function buildRecentCommercialHistory(
  chapterPlans: ChapterPlan[],
  currentChapterNumber: number,
): string[] {
  return chapterPlans
    .filter(
      (plan) =>
        typeof plan.chapterNumber === "number" &&
        plan.chapterNumber < currentChapterNumber &&
        plan.commercial,
    )
    .sort((left, right) => (right.chapterNumber ?? 0) - (left.chapterNumber ?? 0))
    .slice(0, 3)
    .map((plan) =>
      [
        `chapter=${plan.chapterNumber}`,
        plan.commercial?.rewardType ? `rewardType=${plan.commercial.rewardType}` : undefined,
        plan.commercial?.rewardTiming ? `rewardTiming=${plan.commercial.rewardTiming}` : undefined,
        plan.commercial?.microPayoff ? `microPayoff=${plan.commercial.microPayoff}` : undefined,
        plan.commercial?.endHook ? `endHook=${plan.commercial.endHook}` : undefined,
      ]
        .filter(Boolean)
        .join(", "),
    );
}

export function hasBlockingReviewerIssues(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): boolean {
  const hasHighFact = args.fact.findings.some((item) => item.severity === "high");
  return hasHighFact;
}

export function normalizeReviewerResults(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
} {
  const missingSeen = new Set<string>();
  const missingCandidates = args.missing.findings
    .filter((item) => {
      const key = `${item.issueType}|${item.memoryId}|${item.title}|${item.suggestedFix}`.trim();
      if (!key || missingSeen.has(key)) {
        return false;
      }
      missingSeen.add(key);
      return true;
    });
  const missingHigh = missingCandidates.filter((item) => item.severity === "high").slice(0, 1);
  const missingOthers = missingCandidates
    .filter((item) => item.severity !== "high")
    .slice(0, 2);
  const missingFindings = [...missingHigh, ...missingOthers].slice(0, 3);

  const factSeen = new Set<string>();
  const factFindings = args.fact.findings
    .filter((item) => {
      const key = `${item.issueType}|${item.title}|${item.violatedFactIds.join(",")}|${item.suggestedFix}`.trim();
      if (!key || factSeen.has(key)) {
        return false;
      }
      factSeen.add(key);
      return true;
    })
    .slice(0, 3);

  return {
    missing: { ...args.missing, findings: missingFindings },
    fact: { ...args.fact, findings: factFindings },
  };
}

export function normalizeCommercialReviewerResult(
  review: CommercialReviewerResult,
): CommercialReviewerResult {
  const seen = new Set<string>();
  const findings = review.findings
    .filter((item) => {
      const key = `${item.issueType}|${item.title}|${item.suggestedFix}`.trim();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  return {
    ...review,
    findings,
  };
}

export function normalizeRoleDrivenReviewerResult(
  review: RoleDrivenReviewerResult,
): RoleDrivenReviewerResult {
  const seen = new Set<string>();
  const findings = review.findings
    .filter((item) => {
      const key = `${item.issueType}|${item.title}|${item.suggestedFix}`.trim();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  return {
    ...review,
    findings,
  };
}

function countReviewerFindingsBySeverity(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
  commercial?: CommercialReviewerResult;
  roleDriven?: RoleDrivenReviewerResult;
}): { high: number; medium: number; low: number } {
  const allFindings = [
    ...args.fact.findings,
    ...(args.commercial?.findings ?? []),
    ...(args.roleDriven?.findings ?? []),
  ];
  return {
    high: allFindings.filter((item) => item.severity === "high").length,
    medium: allFindings.filter((item) => item.severity === "medium").length,
    low: allFindings.filter((item) => item.severity === "low").length,
  };
}

export function buildRewritePlan(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
  commercial?: CommercialReviewerResult;
  roleDriven?: RoleDrivenReviewerResult;
}): {
  mode: "repair_first" | "hybrid_upgrade" | "commercial_tune" | "quality_boost";
  objective: string;
} {
  const severity = countReviewerFindingsBySeverity(args);

  if (severity.high > 0) {
    return {
      mode: "repair_first",
      objective:
        "Fix all high-severity consistency issues first; keep chapter events and outcomes unchanged.",
    };
  }

  if (severity.medium > 0 || severity.low >= 2) {
    return {
      mode: "hybrid_upgrade",
      objective:
        "Resolve fact and role consistency findings while keeping chapter events and outcomes unchanged.",
    };
  }

  if ((args.commercial?.findings.length ?? 0) > 0) {
    return {
      mode: "commercial_tune",
      objective:
        "Improve hook clarity, concrete trouble visibility, micro-payoff delivery, and end-hook pull without changing chapter facts or outcomes.",
    };
  }

  return {
    mode: "quality_boost",
    objective:
      "No fact/role consistency findings detected. Keep the draft unchanged unless minor clarity touch-ups are necessary.",
  };
}
