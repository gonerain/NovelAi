import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildChapterCardSemanticText,
  buildChangeImpactReport,
  pickArcForChapterDeterministic,
  pickBeatForChapterDeterministic,
  applyMemoryUpdaterResult,
  buildContextPack,
  buildExactSearchHits,
  buildMemorySemanticText,
  buildMemoryRetrievalPack,
  buildMemorySystemArtifacts,
  buildSemanticQueryText,
  buildSpecializedReviewerViews,
  buildDerivedAuthorProfilePacks,
  defaultPayoffPatterns,
  mapAuthorInterviewToProfile,
  normalizeAuthorInterviewResult,
  buildRetrievalEvalChapterViews,
  buildRetrievalEvalSeed,
  evaluateRetrievalCases,
  normalizeRetrievalEvalSetAgainstChapterViews,
  resolveGenrePayoffPack,
  toSemanticRetrievalHits,
  type ArcOutline,
  type AuthorInterviewSessionInput,
  type BeatOutline,
  type ChapterCommercialPlan,
  type ChapterArtifact,
  type ChapterPlan,
  type ChangeImpactReport,
  type CharacterState,
  type CommercialReviewerResult,
  type DerivedAuthorProfilePacks,
  type FactConsistencyReviewerResult,
  type GenrePayoffPack,
  type MemorySearchLedgerType,
  type MemoryUpdaterResult,
  type MissingResourceReviewerResult,
  type PlannerSearchIntent,
  type RetrievalEvalReport,
  type RetrievalEvalSet,
  type StoryOutline,
  type StoryMemory,
  type StorySetup,
  type StyleBible,
  type ThemeBible,
  type WorldFact,
  type WriterResult,
  shouldRewriteForConsistency,
  validateAuthorInterviewResult,
} from "./domain/index.js";
import { EmbeddingService } from "./embedding/service.js";
import type { EmbeddingCacheSnapshot } from "./embedding/service.js";
import {
  demoArcOutlines,
  demoBeatOutlines,
  demoCharacterStates,
  demoPremise,
  demoProjectTitle,
  demoStoryOutline,
  demoStoryMemories,
  demoStorySetup,
  demoStyleBible,
  demoThemeBible,
  demoWorldFacts,
} from "./defaults/demo-project.js";
import {
  buildInterviewInputFromQuizAnswers,
  formatAuthorPresetCatalog as formatAuthorPresetCatalogText,
  getAuthorInterviewPresetById,
} from "./defaults/author-presets.js";
import { LlmService } from "./llm/service.js";
import type { ChatMessage } from "./llm/types.js";
import {
  authorInterviewDisplayDraftSchema,
  authorInterviewNormalizedDraftSchema,
  buildAuthorInterviewDisplayMessages,
  buildAuthorInterviewNormalizeMessages,
  buildAuthorInterviewSmallModelNormalizeMessages,
  buildCommercialReviewMessages,
  buildFactConsistencyReviewMessages,
  buildMemoryUpdaterMessages,
  buildMissingResourceReviewMessages,
  buildRewriterMessages,
  buildPlannerMessages,
  buildWriterMessages,
  commercialReviewerResultSchema,
  factConsistencyReviewerResultSchema,
  memoryUpdaterResultSchema,
  missingResourceReviewerResultSchema,
  plannerResultSchema,
} from "./prompts/index.js";
import { parseWriterLikeOutput } from "./soft-output.js";
import { FileProjectRepository } from "./storage/index.js";

function logStage(stage: string, detail: string): void {
  console.log(`[${stage}] ${detail}`);
}

async function writePromptDebug(args: {
  projectId: string;
  scope: "outline" | "chapter";
  label: string;
  messages: ChatMessage[];
}): Promise<void> {
  const dir = path.resolve(
    process.cwd(),
    "data",
    "projects",
    args.projectId,
    "debug",
    "prompts",
    args.scope,
  );
  await mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_${args.label}.json`;
  await writeFile(
    path.join(dir, filename),
    JSON.stringify(
      {
        projectId: args.projectId,
        scope: args.scope,
        label: args.label,
        generatedAt: new Date().toISOString(),
        messages: args.messages,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

async function writeJsonArtifact(filepath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function readJsonArtifact<T>(filepath: string): Promise<T | null> {
  try {
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function loadAllChapterArtifacts(
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

async function writeMemorySystemOutputs(args: {
  projectId: string;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: ChapterArtifact[];
}): Promise<void> {
  const memoryArtifacts = buildMemorySystemArtifacts({
    storyMemories: args.storyMemories,
    characterStates: args.characterStates,
    chapterArtifacts: args.chapterArtifacts,
  });
  const root = path.resolve(process.cwd(), "data", "projects", args.projectId, "memory");

  await Promise.all([
    writeJsonArtifact(path.join(root, "chapter-cards.json"), memoryArtifacts.chapterCards),
    writeJsonArtifact(path.join(root, "ledgers", "resources.json"), memoryArtifacts.ledgers.resources),
    writeJsonArtifact(path.join(root, "ledgers", "promises.json"), memoryArtifacts.ledgers.promises),
    writeJsonArtifact(path.join(root, "ledgers", "injuries.json"), memoryArtifacts.ledgers.injuries),
    writeJsonArtifact(
      path.join(root, "ledgers", "foreshadows.json"),
      memoryArtifacts.ledgers.foreshadows,
    ),
    writeJsonArtifact(
      path.join(root, "ledgers", "relationships.json"),
      memoryArtifacts.ledgers.relationships,
    ),
    writeJsonArtifact(path.join(root, "ledgers", "timeline.json"), memoryArtifacts.ledgers.timeline),
    writeJsonArtifact(
      path.join(root, "retrieval", "entity-chapter-map.json"),
      memoryArtifacts.entityChapterIndex,
    ),
    writeJsonArtifact(
      path.join(root, "retrieval", "semantic-index.json"),
      memoryArtifacts.semanticIndex,
    ),
    writeJsonArtifact(
      path.join(root, "graph", "story-graph.json"),
      memoryArtifacts.storyGraph,
    ),
    writeJsonArtifact(
      path.join(root, "digests", "active-threads.json"),
      memoryArtifacts.activeThreadDigest,
    ),
  ]);
}

async function writeRetrievalDebugReport(args: {
  projectId: string;
  chapterNumber: number;
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: ChapterArtifact[];
  semanticOverrideHits?: ReturnType<typeof toSemanticRetrievalHits>;
  writerContextPack: ReturnType<typeof buildContextPack>;
  reviewerContextPack: ReturnType<typeof buildContextPack>;
  specializedViews: ReturnType<typeof buildSpecializedReviewerViews>;
}): Promise<void> {
  const root = path.resolve(
    process.cwd(),
    "data",
    "projects",
    args.projectId,
    "memory",
    "retrieval",
  );

  await writeJsonArtifact(
    path.join(root, `chapter-${String(args.chapterNumber).padStart(3, "0")}.json`),
    {
      chapterNumber: args.chapterNumber,
      searchIntent: args.chapterPlan.searchIntent ?? null,
      commercial: args.chapterPlan.commercial ?? null,
      exactSearchHits: buildExactSearchHits({
        chapterPlan: args.chapterPlan,
        storyMemories: args.storyMemories,
        characterStates: args.characterStates,
        artifacts: buildMemorySystemArtifacts({
          storyMemories: args.storyMemories,
          characterStates: args.characterStates,
          chapterArtifacts: args.chapterArtifacts,
        }),
      }),
      writerRetrievalSignals: args.writerContextPack.retrievalSignals,
      reviewerRetrievalSignals: args.reviewerContextPack.retrievalSignals,
      semanticHits: buildMemoryRetrievalPack({
        chapterPlan: args.chapterPlan,
        storyMemories: args.storyMemories,
        characterStates: args.characterStates,
        chapterArtifacts: args.chapterArtifacts,
        semanticOverrideHits: args.semanticOverrideHits,
      }).semanticHits,
      graphHits: buildMemoryRetrievalPack({
        chapterPlan: args.chapterPlan,
        storyMemories: args.storyMemories,
        characterStates: args.characterStates,
        chapterArtifacts: args.chapterArtifacts,
        semanticOverrideHits: args.semanticOverrideHits,
      }).graphHits,
      relevantLedgerEntries: args.writerContextPack.relevantLedgerEntries,
      relevantChapterCards: args.writerContextPack.relevantChapterCards,
      relevantWorldFacts: args.writerContextPack.relevantWorldFacts,
      resourceCandidates: args.specializedViews.resourceCandidates,
      relationshipCandidates: args.specializedViews.relationshipCandidates,
    },
  );
}

async function rebuildMemorySystemOutputsForProject(
  repository: FileProjectRepository,
  projectId: string,
  storyMemories?: StoryMemory[],
  characterStates?: CharacterState[],
): Promise<void> {
  const [loadedMemories, loadedCharacters, chapterArtifacts] = await Promise.all([
    storyMemories ? Promise.resolve(storyMemories) : repository.loadStoryMemories(projectId),
    characterStates ? Promise.resolve(characterStates) : repository.loadCharacterStates(projectId),
    loadAllChapterArtifacts(repository, projectId),
  ]);

  await writeMemorySystemOutputs({
    projectId,
    storyMemories: loadedMemories,
    characterStates: loadedCharacters,
    chapterArtifacts,
  });
}

function retrievalEvalSetPath(projectId: string): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "memory",
    "eval",
    "retrieval-eval-set.json",
  );
}

const embeddingService = new EmbeddingService();

async function loadEmbeddingCacheForProject(projectId: string): Promise<void> {
  if (!embeddingService.isPersistentCacheEnabled) {
    return;
  }

  const snapshot = await readJsonArtifact<EmbeddingCacheSnapshot>(embeddingCachePath(projectId));
  embeddingService.loadSnapshot(snapshot);
}

async function saveEmbeddingCacheForProject(projectId: string): Promise<void> {
  if (!embeddingService.isPersistentCacheEnabled) {
    return;
  }

  const snapshot = embeddingService.exportSnapshot();
  if (!snapshot) {
    return;
  }

  await writeJsonArtifact(embeddingCachePath(projectId), snapshot);
}

async function resolveSemanticOverrideHits(args: {
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

function retrievalEvalReportPath(projectId: string): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "memory",
    "eval",
    "retrieval-eval-report.json",
  );
}

function embeddingCachePath(projectId: string): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "memory",
    "retrieval",
    "embedding-cache.json",
  );
}

function changeImpactReportPath(projectId: string, targetId: string): string {
  const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "impact",
    `${safeTarget}.json`,
  );
}

function rewritePlanReportPath(projectId: string, targetId: string): string {
  const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "impact",
    `${safeTarget}.rewrite-plan.json`,
  );
}

export interface V1RunOptions {
  projectId: string;
  mode: "first-n" | "chapter";
  count?: number;
  chapterNumber?: number;
  withEval?: boolean;
  strictEval?: boolean;
}

export interface V1RunResult {
  projectId: string;
  targetChapter: number;
  generatedChapterNumbers: number[];
  artifacts: ChapterArtifact[];
  validationIssues: string[];
  retrievalEval?: RetrievalEvalRunResult;
}

interface ProjectBaseState {
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

interface InvalidateResult {
  projectId: string;
  chapterNumber: number;
  deletedChapterNumbers: number[];
  remainingChapterPlans: number;
  remainingMemories: number;
}

export interface InvalidateTargetRunResult {
  projectId: string;
  targetId: string;
  impactReportPath: string;
  rewritePlanPath: string;
  plan: RewritePlanReport;
  invalidation?: InvalidateResult;
}

export interface RetrievalEvalSeedResult {
  projectId: string;
  evalSetPath: string;
  totalCases: number;
}

export interface RetrievalEvalRunResult {
  projectId: string;
  evalSetPath: string;
  reportPath: string;
  report: RetrievalEvalReport;
  regression?: RetrievalEvalRegressionSummary;
}

export interface ChangeImpactRunResult {
  projectId: string;
  targetId: string;
  reportPath: string;
  report: ChangeImpactReport;
}

export interface RewritePlanReport {
  targetId: string;
  generatedAt: string;
  targetType: ChangeImpactReport["targetType"];
  suggestedInvalidationChapter: number | null;
  impactedChapterNumbers: number[];
  impactedArtifactChapterNumbers: number[];
  impactedPlannedChapterNumbers: number[];
  recommendedCommand: string | null;
  reasons: string[];
}

export interface RewritePlanRunResult {
  projectId: string;
  targetId: string;
  impactReportPath: string;
  rewritePlanPath: string;
  impactReport: ChangeImpactReport;
  plan: RewritePlanReport;
}

export interface RetrievalEvalRegressionSummary {
  previousPassedCases: number;
  currentPassedCases: number;
  previousTotalCases: number;
  currentTotalCases: number;
  deltaPassedCases: number;
  deltaFailedCases: number;
  regressedChapters: Array<{
    chapterNumber: number;
    previousPassedCases: number;
    currentPassedCases: number;
  }>;
  improvedChapters: Array<{
    chapterNumber: number;
    previousPassedCases: number;
    currentPassedCases: number;
  }>;
}

function assertChapterPlanningAnchors(args: {
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

function normalizeSearchIntent(args: {
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
    entityIds: uniqueStrings(
      [...normalizedEntityIds, ...args.requiredCharacterIds],
      8,
    ),
    memoryIds: uniqueStrings(
      [...normalizedMemoryIds, ...args.requiredMemoryIds],
      12,
    ),
    ledgerTypes: uniqueStrings(ledgerTypes, 4) as MemorySearchLedgerType[],
    topicQueries: uniqueStrings(args.planned?.topicQueries ?? [], 6),
    exactPhrases: uniqueStrings(
      [...(args.planned?.exactPhrases ?? []), ...fallbackExactPhrases],
      8,
    ),
  };
}

function normalizeCommercialPlan(args: {
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
      `让读者看到${args.plannedOutcome.trim() || args.emotionalGoal.trim() || "局面发生明确变化"}`,
    endHook:
      args.planned?.endHook?.trim() ||
      `把下一步问题钉死：${args.plannedOutcome.trim() || args.chapterGoal.trim()}`,
    readerPromise:
      args.planned?.readerPromise?.trim() ||
      `接下来围绕“${args.chapterGoal.trim() || args.plannedOutcome.trim()}”继续推进`,
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

function deriveFallbackSeedMemories(memories: StoryMemory[]): StoryMemory[] {
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

async function loadSeedStoryMemories(
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

function normalizePayoffPatternIds(args: {
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

function upsertChapterPlan(chapterPlans: ChapterPlan[], chapterPlan: ChapterPlan): ChapterPlan[] {
  const chapterNumber = chapterPlan.chapterNumber;
  if (!chapterNumber) {
    return [...chapterPlans, chapterPlan];
  }

  const filtered = chapterPlans.filter((item) => item.chapterNumber !== chapterNumber);
  return [...filtered, chapterPlan].sort(
    (left, right) => (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0),
  );
}

function buildRecentConsequences(
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

function buildRecentCommercialHistory(
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

function hasBlockingReviewerIssues(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): boolean {
  const hasHighFact = args.fact.findings.some((item) => item.severity === "high");
  return hasHighFact;
}

function normalizeReviewerResults(args: {
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

function normalizeCommercialReviewerResult(
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

function countReviewerFindingsBySeverity(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
  commercial?: CommercialReviewerResult;
}): { high: number; medium: number; low: number } {
  const allFindings = [...args.fact.findings, ...(args.commercial?.findings ?? [])];
  return {
    high: allFindings.filter((item) => item.severity === "high").length,
    medium: allFindings.filter((item) => item.severity === "medium").length,
    low: allFindings.filter((item) => item.severity === "low").length,
  };
}

function buildRewritePlan(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
  commercial?: CommercialReviewerResult;
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

async function ensureBootstrappedProject(
  service: LlmService,
  repository: FileProjectRepository,
  projectId: string,
  authorPresetId?: string,
): Promise<ProjectBaseState & { validationIssues: string[] }> {
  logStage("bootstrap", `ensure project=${projectId}`);
  const existingProject = await repository.getProject(projectId);
  if (!existingProject) {
    await repository.createProject({
      id: projectId,
      title: demoProjectTitle,
    });
  }

  let authorProfile = await repository.loadAuthorProfile(projectId);
  let authorPacks = await repository.loadDerivedAuthorProfilePacks(projectId);
  const validationIssues: string[] = [];

  if (!authorProfile) {
    logStage("bootstrap", "author profile missing -> run interview");
    const selectedPreset = getAuthorInterviewPresetById(authorPresetId);
    const interviewInput = {
      ...selectedPreset.interviewInput,
      targetProject: {
        title: demoProjectTitle,
        premise: demoPremise,
        themeHint: "power, betrayal, and costly redemption",
      },
    };
    const generated = await generateAuthorProfileFromInterviewInput({
      service,
      interviewInput,
      projectId,
    });
    validationIssues.push(...generated.validationIssues);
    authorProfile = generated.authorProfile;
    authorPacks = generated.authorPacks;

    await repository.saveAuthorProfile(projectId, authorProfile);
    await repository.saveDerivedAuthorProfilePacks(projectId, authorPacks);
    logStage("bootstrap", "saved author profile + packs");
  } else if (!authorPacks) {
    authorPacks = buildDerivedAuthorProfilePacks(authorProfile);
    await repository.saveDerivedAuthorProfilePacks(projectId, authorPacks);
    logStage("bootstrap", "rebuilt missing author packs");
  }

  const themeBible = (await repository.loadThemeBible(projectId)) ?? demoThemeBible;
  const styleBible = (await repository.loadStyleBible(projectId)) ?? demoStyleBible;
  const storySetup = (await repository.loadStorySetup(projectId)) ?? demoStorySetup;
  const genrePayoffPack = resolveGenrePayoffPack(storySetup.genrePayoffPackId);
  const loadedStoryOutline = await repository.loadStoryOutline(projectId);
  const loadedArcOutlines = await repository.loadArcOutlines(projectId);
  const loadedBeatOutlines = await repository.loadBeatOutlines(projectId);
  const loadedCharacterStates = await repository.loadCharacterStates(projectId);
  const loadedWorldFacts = await repository.loadWorldFacts(projectId);
  const loadedStoryMemories = await repository.loadStoryMemories(projectId);
  const storyOutline = loadedStoryOutline ?? demoStoryOutline;
  const arcOutlines = loadedArcOutlines.length ? loadedArcOutlines : demoArcOutlines;
  const beatOutlines = loadedBeatOutlines.length ? loadedBeatOutlines : demoBeatOutlines;
  const characterStates = loadedCharacterStates.length ? loadedCharacterStates : demoCharacterStates;
  const worldFacts = loadedWorldFacts.length ? loadedWorldFacts : demoWorldFacts;
  const storyMemories = loadedStoryMemories.length ? loadedStoryMemories : demoStoryMemories;
  const chapterPlans = await repository.loadChapterPlans(projectId);

  await repository.saveThemeBible(projectId, themeBible);
  await repository.saveStyleBible(projectId, styleBible);
  await repository.saveStorySetup(projectId, storySetup);
  await repository.saveStoryOutline(projectId, storyOutline);
  await repository.saveArcOutlines(projectId, arcOutlines);
  await repository.saveBeatOutlines(projectId, beatOutlines);
  await repository.saveCharacterStates(projectId, characterStates);
  await repository.saveWorldFacts(projectId, worldFacts);
  await repository.saveStoryMemories(projectId, storyMemories);
  if ((await repository.loadSeedStoryMemories(projectId)).length === 0) {
    await repository.saveSeedStoryMemories(
      projectId,
      loadedStoryMemories.length ? deriveFallbackSeedMemories(storyMemories) : demoStoryMemories,
    );
  }
  await rebuildMemorySystemOutputsForProject(
    repository,
    projectId,
    storyMemories,
    characterStates,
  );

  logStage("bootstrap", "base files ready");

  return {
    storySetup,
    genrePayoffPack,
    storyOutline,
    arcOutlines,
    beatOutlines,
    authorPacks,
    themeBible,
    styleBible,
    characterStates,
    worldFacts,
    storyMemories,
    chapterPlans,
    validationIssues,
  };
}

export async function invalidateFromChapter(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<InvalidateResult> {
  const repository = new FileProjectRepository();

  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const currentMemories = await repository.loadStoryMemories(args.projectId);
  const seedMemories = await loadSeedStoryMemories(repository, args.projectId, currentMemories);
  const allChapterNumbers = await repository.listChapterArtifactNumbers(args.projectId);
  const deletedChapterNumbers = allChapterNumbers.filter((number) => number >= args.chapterNumber);
  const keptChapterNumbers = allChapterNumbers.filter((number) => number < args.chapterNumber);

  let rebuiltMemories = seedMemories.map((memory) => ({
    ...memory,
    notes: [...memory.notes],
  }));

  for (const chapterNumber of keptChapterNumbers) {
    const artifact = await repository.loadChapterArtifact(args.projectId, chapterNumber);
    if (!artifact) {
      continue;
    }

    rebuiltMemories = applyMemoryUpdaterResult(
      rebuiltMemories,
      artifact.memoryUpdate,
      artifact.chapterNumber,
    );
  }

  const chapterPlans = await repository.loadChapterPlans(args.projectId);
  const previousMemories = currentMemories.map((memory) => ({
    ...memory,
    notes: [...memory.notes],
  }));
  const previousPlans = chapterPlans.map((plan) => ({ ...plan }));
  const remainingPlans = chapterPlans.filter(
    (plan) => (plan.chapterNumber ?? Number.MAX_SAFE_INTEGER) < args.chapterNumber,
  );
  const deletedArtifactsBackup = (
    await Promise.all(
      deletedChapterNumbers.map(async (chapterNumber) => ({
        chapterNumber,
        artifact: await repository.loadChapterArtifact(args.projectId, chapterNumber),
      })),
    )
  )
    .filter((item): item is { chapterNumber: number; artifact: ChapterArtifact } => Boolean(item.artifact))
    .map((item) => ({ chapterNumber: item.chapterNumber, artifact: item.artifact }));

  try {
    for (const chapterNumber of deletedChapterNumbers) {
      await repository.deleteChapterArtifact(args.projectId, chapterNumber);
    }

    await repository.saveChapterPlans(args.projectId, remainingPlans);
    await repository.saveStoryMemories(args.projectId, rebuiltMemories);
    await rebuildMemorySystemOutputsForProject(
      repository,
      args.projectId,
      rebuiltMemories,
    );
  } catch (error) {
    // Best-effort rollback to avoid partial invalidation state.
    await repository.saveChapterPlans(args.projectId, previousPlans);
    await repository.saveStoryMemories(args.projectId, previousMemories);
    for (const item of deletedArtifactsBackup) {
      await repository.saveChapterArtifact(args.projectId, item.artifact);
    }
    await rebuildMemorySystemOutputsForProject(
      repository,
      args.projectId,
      previousMemories,
    );
    throw error;
  }

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    deletedChapterNumbers,
    remainingChapterPlans: remainingPlans.length,
    remainingMemories: rebuiltMemories.length,
  };
}

async function generateAuthorProfileFromInterviewInput(args: {
  service: LlmService;
  interviewInput: AuthorInterviewSessionInput;
  projectId: string;
}): Promise<{
  authorProfile: ReturnType<typeof mapAuthorInterviewToProfile>;
  authorPacks: DerivedAuthorProfilePacks;
  validationIssues: string[];
}> {
  const interviewCombined = args.interviewInput.smallModel
    ? await (async () => {
        logStage("bootstrap", "llm: author_interview normalized-only");
        const normalizedOnlyMessages =
          buildAuthorInterviewSmallModelNormalizeMessages(args.interviewInput);
        const normalizedOnlyResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: normalizedOnlyMessages,
          schema: authorInterviewNormalizedDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });

        return {
          display: {
            summary: normalizedOnlyResult.object.normalized.authorProfile.summary,
            authorProfile: normalizedOnlyResult.object.normalized.authorProfile,
            components: normalizedOnlyResult.object.normalized.components.map((component) => ({
              id: component.id,
              name: component.name,
              category: component.category,
              description: component.name,
              priority: component.priority,
            })),
            constraints: normalizedOnlyResult.object.normalized.constraints,
            openQuestions: [],
            conflictsDetected: [],
          },
          normalized: normalizedOnlyResult.object.normalized,
        };
      })()
    : await (async () => {
        logStage("bootstrap", "llm: author_interview display");
        const displayMessages = buildAuthorInterviewDisplayMessages(args.interviewInput);
        const displayResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: displayMessages,
          schema: authorInterviewDisplayDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });
        logStage("bootstrap", "llm: author_interview normalized");
        const normalizedMessages = buildAuthorInterviewNormalizeMessages({
          input: args.interviewInput,
          display: displayResult.object.display,
        });
        const normalizedResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: normalizedMessages,
          schema: authorInterviewNormalizedDraftSchema,
          temperature: 0.2,
          maxTokens: 2600,
        });

        return {
          display: displayResult.object.display,
          normalized: normalizedResult.object.normalized,
        };
      })();

  const normalizedInterview = normalizeAuthorInterviewResult(interviewCombined);
  const validationIssues = validateAuthorInterviewResult(normalizedInterview).map(
    (issue) => `${issue.path}: ${issue.message}`,
  );
  const authorProfile = mapAuthorInterviewToProfile(normalizedInterview, {
    profileId: `${args.projectId}-author-profile`,
    profileName: "Default Author Profile",
  });
  const authorPacks = buildDerivedAuthorProfilePacks(authorProfile);
  return {
    authorProfile,
    authorPacks,
    validationIssues,
  };
}

export async function interviewProject(args: {
  projectId: string;
  answersRaw: string;
}): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const existingProject = await repository.getProject(args.projectId);
  if (!existingProject) {
    await repository.createProject({
      id: args.projectId,
      title: demoProjectTitle,
    });
  }

  const interviewInput = buildInterviewInputFromQuizAnswers(args.answersRaw, {
    title: demoProjectTitle,
    premise: demoPremise,
    themeHint: "custom quiz generated author profile",
  });
  const generated = await generateAuthorProfileFromInterviewInput({
    service,
    interviewInput,
    projectId: args.projectId,
  });

  await repository.saveAuthorProfile(args.projectId, generated.authorProfile);
  await repository.saveDerivedAuthorProfilePacks(args.projectId, generated.authorPacks);
  return {
    projectId: args.projectId,
    validationIssues: generated.validationIssues,
  };
}

export async function bootstrapProject(
  projectId: string,
  options?: { authorPresetId?: string },
): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const base = await ensureBootstrappedProject(
    service,
    repository,
    projectId,
    options?.authorPresetId,
  );

  return {
    projectId,
    validationIssues: base.validationIssues,
  };
}

export async function seedRetrievalEvalSet(args: {
  projectId: string;
}): Promise<RetrievalEvalSeedResult> {
  const repository = new FileProjectRepository();
  await loadEmbeddingCacheForProject(args.projectId);
  const [characterStates, currentMemories, chapterArtifacts] = await Promise.all([
    repository.loadCharacterStates(args.projectId),
    repository.loadStoryMemories(args.projectId),
    loadAllChapterArtifacts(repository, args.projectId),
  ]);
  const seedStoryMemories = await loadSeedStoryMemories(
    repository,
    args.projectId,
    currentMemories,
  );
  const chapterViews = await buildRetrievalEvalChapterViews({
    chapterArtifacts,
    characterStates,
    seedStoryMemories,
    resolveSemanticHits: async (input) =>
      resolveSemanticOverrideHits({
        chapterPlan: input.chapterPlan,
        storyMemories: input.storyMemories,
        chapterArtifacts: chapterArtifacts.filter(
          (artifact) => artifact.chapterNumber < (input.chapterPlan.chapterNumber ?? Number.MAX_SAFE_INTEGER),
        ),
      }),
  });
  const rawEvalSet = buildRetrievalEvalSeed({
    projectId: args.projectId,
    chapterArtifacts,
  });
  const evalSet = normalizeRetrievalEvalSetAgainstChapterViews({
    evalSet: rawEvalSet,
    chapterViews,
  });
  const evalSetPath = retrievalEvalSetPath(args.projectId);
  await writeJsonArtifact(evalSetPath, evalSet);
  await saveEmbeddingCacheForProject(args.projectId);

  return {
    projectId: args.projectId,
    evalSetPath,
    totalCases: evalSet.cases.length,
  };
}

export async function runRetrievalEval(args: {
  projectId: string;
}): Promise<RetrievalEvalRunResult> {
  const repository = new FileProjectRepository();
  await loadEmbeddingCacheForProject(args.projectId);
  const [characterStates, currentMemories, chapterArtifacts] = await Promise.all([
    repository.loadCharacterStates(args.projectId),
    repository.loadStoryMemories(args.projectId),
    loadAllChapterArtifacts(repository, args.projectId),
  ]);

  const seedStoryMemories = await loadSeedStoryMemories(
    repository,
    args.projectId,
    currentMemories,
  );
  await writeMemorySystemOutputs({
    projectId: args.projectId,
    storyMemories: currentMemories,
    characterStates,
    chapterArtifacts,
  });
  const evalSetPath = retrievalEvalSetPath(args.projectId);
  const reportPath = retrievalEvalReportPath(args.projectId);
  const previousReport = await readJsonArtifact<RetrievalEvalReport>(reportPath);
  let evalSet = await readJsonArtifact<RetrievalEvalSet>(evalSetPath);

  if (!evalSet) {
    const seeded = buildRetrievalEvalSeed({
      projectId: args.projectId,
      chapterArtifacts,
    });
    evalSet = seeded;
  }

  const chapterViews = await buildRetrievalEvalChapterViews({
    chapterArtifacts,
    characterStates,
    seedStoryMemories,
    resolveSemanticHits: async (input) =>
      resolveSemanticOverrideHits({
        chapterPlan: input.chapterPlan,
        storyMemories: input.storyMemories,
        chapterArtifacts: chapterArtifacts.filter(
          (artifact) => artifact.chapterNumber < (input.chapterPlan.chapterNumber ?? Number.MAX_SAFE_INTEGER),
        ),
      }),
  });
  evalSet = normalizeRetrievalEvalSetAgainstChapterViews({
    evalSet,
    chapterViews,
  });
  await writeJsonArtifact(evalSetPath, evalSet);
  const report = evaluateRetrievalCases({
    projectId: args.projectId,
    evalSet,
    chapterViews,
  });
  await writeJsonArtifact(reportPath, report);
  await saveEmbeddingCacheForProject(args.projectId);

  return {
    projectId: args.projectId,
    evalSetPath,
    reportPath,
    report,
    regression: compareRetrievalEvalReports(previousReport, report),
  };
}

export async function runChangeImpact(args: {
  projectId: string;
  targetId: string;
}): Promise<ChangeImpactRunResult> {
  const repository = new FileProjectRepository();
  const [characterStates, storyMemories, chapterPlans, arcOutlines, beatOutlines, chapterArtifacts] =
    await Promise.all([
      repository.loadCharacterStates(args.projectId),
      repository.loadStoryMemories(args.projectId),
      repository.loadChapterPlans(args.projectId),
      repository.loadArcOutlines(args.projectId),
      repository.loadBeatOutlines(args.projectId),
      loadAllChapterArtifacts(repository, args.projectId),
    ]);

  const report = buildChangeImpactReport({
    targetId: args.targetId,
    characterStates,
    storyMemories,
    chapterPlans,
    arcOutlines,
    beatOutlines,
    chapterArtifacts,
  });
  const reportPath = changeImpactReportPath(args.projectId, args.targetId);
  await writeJsonArtifact(reportPath, report);

  return {
    projectId: args.projectId,
    targetId: args.targetId,
    reportPath,
    report,
  };
}

function extractChapterNumberFromImpactId(id: string): number | null {
  const chapterArtifactCardMatch = /^chapter-card-(\d+)$/.exec(id);
  if (chapterArtifactCardMatch) {
    return Number(chapterArtifactCardMatch[1]);
  }

  const chapterCardMatch = /^chapter-(\d+)$/.exec(id);
  if (chapterCardMatch) {
    return Number(chapterCardMatch[1]);
  }

  const chapterPlanMatch = /^chapter-plan-(\d+)$/.exec(id);
  if (chapterPlanMatch) {
    return Number(chapterPlanMatch[1]);
  }

  return null;
}

function uniqueSortedNumbers(items: number[]): number[] {
  return [...new Set(items)].sort((left, right) => left - right);
}

function buildRewritePlanFromImpact(args: {
  projectId: string;
  targetId: string;
  report: ChangeImpactReport;
}): RewritePlanReport {
  const impactedArtifactChapterNumbers = uniqueSortedNumbers(
    args.report.impactedChapters
      .filter(
        (item) =>
          item.id.startsWith("chapter-card-") ||
          (item.id.startsWith("chapter-") && !item.id.startsWith("chapter-plan-")),
      )
      .map((item) => extractChapterNumberFromImpactId(item.id))
      .filter((item): item is number => item !== null),
  );
  const impactedPlannedChapterNumbers = uniqueSortedNumbers(
    args.report.impactedChapters
      .filter((item) => item.id.startsWith("chapter-plan-"))
      .map((item) => extractChapterNumberFromImpactId(item.id))
      .filter((item): item is number => item !== null),
  );
  const impactedChapterNumbers = uniqueSortedNumbers([
    ...impactedArtifactChapterNumbers,
    ...impactedPlannedChapterNumbers,
  ]);
  const plannedOnlyChapterNumbers = impactedPlannedChapterNumbers.filter(
    (chapterNumber) => !impactedArtifactChapterNumbers.includes(chapterNumber),
  );
  const suggestedInvalidationChapter =
    impactedChapterNumbers.length > 0 ? impactedChapterNumbers[0] : null;

  return {
    targetId: args.targetId,
    generatedAt: new Date().toISOString(),
    targetType: args.report.targetType,
    suggestedInvalidationChapter,
    impactedChapterNumbers,
    impactedArtifactChapterNumbers,
    impactedPlannedChapterNumbers: plannedOnlyChapterNumbers,
    recommendedCommand:
      suggestedInvalidationChapter !== null
        ? `./run-v1.sh chapter invalidate-from --project ${args.projectId} --chapter ${suggestedInvalidationChapter}`
        : null,
    reasons: uniqueStrings(
      args.report.impactedChapters.flatMap((item) => item.reasons.map((reason) => reason.detail)),
      8,
    ),
  };
}

export async function runRewritePlan(args: {
  projectId: string;
  targetId: string;
}): Promise<RewritePlanRunResult> {
  const impact = await runChangeImpact(args);
  const plan = buildRewritePlanFromImpact({
    projectId: args.projectId,
    targetId: args.targetId,
    report: impact.report,
  });
  const rewritePlanPath = rewritePlanReportPath(args.projectId, args.targetId);
  await writeJsonArtifact(rewritePlanPath, plan);

  return {
    projectId: args.projectId,
    targetId: args.targetId,
    impactReportPath: impact.reportPath,
    rewritePlanPath,
    impactReport: impact.report,
    plan,
  };
}

export async function invalidateFromTarget(args: {
  projectId: string;
  targetId: string;
}): Promise<InvalidateTargetRunResult> {
  const rewritePlan = await runRewritePlan(args);

  if (rewritePlan.plan.suggestedInvalidationChapter === null) {
    return {
      projectId: args.projectId,
      targetId: args.targetId,
      impactReportPath: rewritePlan.impactReportPath,
      rewritePlanPath: rewritePlan.rewritePlanPath,
      plan: rewritePlan.plan,
    };
  }

  const invalidation = await invalidateFromChapter({
    projectId: args.projectId,
    chapterNumber: rewritePlan.plan.suggestedInvalidationChapter,
  });

  return {
    projectId: args.projectId,
    targetId: args.targetId,
    impactReportPath: rewritePlan.impactReportPath,
    rewritePlanPath: rewritePlan.rewritePlanPath,
    plan: rewritePlan.plan,
    invalidation,
  };
}

function compareRetrievalEvalReports(
  previousReport: RetrievalEvalReport | null,
  currentReport: RetrievalEvalReport,
): RetrievalEvalRegressionSummary | undefined {
  if (!previousReport) {
    return undefined;
  }

  const previousChapterMap = new Map(
    previousReport.chapterSummaries.map((item) => [item.chapterNumber, item]),
  );
  const regressedChapters: RetrievalEvalRegressionSummary["regressedChapters"] = [];
  const improvedChapters: RetrievalEvalRegressionSummary["improvedChapters"] = [];

  for (const current of currentReport.chapterSummaries) {
    const previous = previousChapterMap.get(current.chapterNumber);
    if (!previous) {
      continue;
    }

    if (current.passedCases < previous.passedCases) {
      regressedChapters.push({
        chapterNumber: current.chapterNumber,
        previousPassedCases: previous.passedCases,
        currentPassedCases: current.passedCases,
      });
    } else if (current.passedCases > previous.passedCases) {
      improvedChapters.push({
        chapterNumber: current.chapterNumber,
        previousPassedCases: previous.passedCases,
        currentPassedCases: current.passedCases,
      });
    }
  }

  return {
    previousPassedCases: previousReport.passedCases,
    currentPassedCases: currentReport.passedCases,
    previousTotalCases: previousReport.totalCases,
    currentTotalCases: currentReport.totalCases,
    deltaPassedCases: currentReport.passedCases - previousReport.passedCases,
    deltaFailedCases:
      (currentReport.totalCases - currentReport.passedCases) -
      (previousReport.totalCases - previousReport.passedCases),
    regressedChapters,
    improvedChapters,
  };
}

async function generateChapterArtifact(args: {
  service: LlmService;
  base: ProjectBaseState;
  repository: FileProjectRepository;
  projectId: string;
  chapterNumber: number;
  currentSituation: string;
  recentConsequences: string[];
  availableChapterArtifacts: ChapterArtifact[];
}): Promise<{
  artifact: ChapterArtifact;
  updatedStoryMemories: StoryMemory[];
  updatedChapterPlans: ChapterPlan[];
}> {
  logStage("chapter", `start chapter=${args.chapterNumber}`);
  const currentArc = pickArcForChapterDeterministic(args.base.arcOutlines, args.chapterNumber);
  const currentBeat = pickBeatForChapterDeterministic(
    args.base.beatOutlines,
    currentArc,
    args.chapterNumber,
  );
  assertChapterPlanningAnchors({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    beatOutlines: args.base.beatOutlines,
    currentArc,
    currentBeat,
  });

  const plannerMessages = buildPlannerMessages({
    authorPack: args.base.authorPacks.planner,
    themeBible: args.base.themeBible,
    styleBible: args.base.styleBible,
    genrePayoffPack: args.base.genrePayoffPack,
    storyOutline: args.base.storyOutline,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    arcId: currentArc?.id,
    chapterNumber: args.chapterNumber,
    mode: args.chapterNumber === 1 ? "opening" : "continuation",
    premise: args.base.storySetup.premise,
    currentArcGoal: currentArc?.arcGoal ?? args.base.storySetup.currentArcGoal,
    currentSituation: args.currentSituation,
    activeCharacterIds:
      currentBeat?.requiredCharacters.length
        ? currentBeat.requiredCharacters
        : args.base.storySetup.defaultActiveCharacterIds,
    candidateMemoryIds: args.base.storyMemories
      .filter((memory) => memory.status === "active" || memory.status === "triggered")
      .map((memory) => memory.id)
      .slice(0, 12),
    recentConsequences: args.recentConsequences,
    recentCommercialHistory: buildRecentCommercialHistory(
      args.base.chapterPlans,
      args.chapterNumber,
    ),
  });

  logStage("chapter", `llm: planner chapter=${args.chapterNumber}`);
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_planner`,
    messages: plannerMessages,
  });
  const plannerResult = await args.service.generateObjectForTask({
    task: "planner",
    messages: plannerMessages,
    schema: plannerResultSchema,
    temperature: 0.2,
    maxTokens: 2200,
  });

  const planned = plannerResult.object.chapterPlan;
  const requiredCharacters = uniqueStrings(
    [...planned.requiredCharacters, ...(currentBeat?.requiredCharacters ?? [])],
    8,
  );
  const requiredMemories = uniqueStrings(
    [...planned.requiredMemories, ...(currentBeat?.requiredMemories ?? [])],
    12,
  );
  const chapterPlan = {
    ...planned,
    chapterNumber: args.chapterNumber,
    arcId: currentArc?.id ?? planned.arcId ?? "arc-1",
    beatId: currentBeat?.id ?? planned.beatId,
    requiredCharacters,
    requiredMemories,
    searchIntent: normalizeSearchIntent({
      planned: planned.searchIntent,
      requiredCharacterIds: requiredCharacters,
      requiredMemoryIds: requiredMemories,
      characterStates: args.base.characterStates,
      storyMemories: args.base.storyMemories,
    }),
    commercial: normalizeCommercialPlan({
      planned: planned.commercial,
      genrePayoffPack: args.base.genrePayoffPack,
      chapterNumber: args.chapterNumber,
      chapterType: planned.chapterType,
      chapterGoal: planned.chapterGoal,
      plannedOutcome: planned.plannedOutcome,
      emotionalGoal: planned.emotionalGoal,
      currentSituation: args.currentSituation,
    }),
    beatConstraints: uniqueStrings([...(currentBeat?.constraints ?? [])], 6),
    mustHitConflicts: uniqueStrings(
      [
        ...planned.mustHitConflicts,
        planned.chapterGoal,
        planned.emotionalGoal,
        planned.plannedOutcome,
        currentBeat?.conflict ?? "",
      ],
      6,
    ),
    disallowedMoves: uniqueStrings([...planned.disallowedMoves], 6),
    payoffPatternIds: normalizePayoffPatternIds({
      plannerIds: planned.payoffPatternIds,
      currentArc,
      currentBeat,
    }),
  };
  const semanticOverrideHits = await resolveSemanticOverrideHits({
    chapterPlan,
    storyMemories: args.base.storyMemories,
    chapterArtifacts: args.availableChapterArtifacts,
  });

  logStage("chapter", `build context chapter=${args.chapterNumber}`);
  const writerContextPack = buildContextPack({
    task: "writer",
    authorPack: args.base.authorPacks.writer,
    themeBible: args.base.themeBible,
    styleBible: args.base.styleBible,
    genrePayoffPack: args.base.genrePayoffPack,
    chapterPlan,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    chapterArtifacts: args.availableChapterArtifacts,
    semanticOverrideHits,
    characterStates: args.base.characterStates,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
  });
  const reviewerContextPack = buildContextPack({
    task: "reviewer",
    authorPack: args.base.authorPacks.reviewer,
    themeBible: args.base.themeBible,
    styleBible: args.base.styleBible,
    genrePayoffPack: args.base.genrePayoffPack,
    chapterPlan,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    chapterArtifacts: args.availableChapterArtifacts,
    semanticOverrideHits,
    characterStates: args.base.characterStates,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
  });
  const specializedReviewerViews = buildSpecializedReviewerViews({
    chapterPlan,
    storyMemories: args.base.storyMemories,
    characterStates: args.base.characterStates,
    chapterArtifacts: args.availableChapterArtifacts,
  });

  logStage("chapter", `llm: writer chapter=${args.chapterNumber}`);
  const writerMessages = buildWriterMessages({
    contextPack: writerContextPack,
    minParagraphs: 5,
    maxParagraphs: 8,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_writer`,
    messages: writerMessages,
  });
  const writerTextResult = await args.service.generateForTask({
    task: "writer",
    messages: writerMessages,
    temperature: 0.6,
    maxTokens: 2800,
  });
  const writerOutput = parseWriterLikeOutput({
    provider: writerTextResult.provider,
    rawText: writerTextResult.text,
  });
  const writerResult = {
    object: {
      title: writerOutput.title,
      draft: writerOutput.draft,
      notes: writerOutput.notes,
    } satisfies WriterResult,
  };

  logStage("chapter", `llm: review_missing_resource chapter=${args.chapterNumber}`);
  const missingReviewMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    storyMemories: args.base.storyMemories,
    resourceCandidates: specializedReviewerViews.resourceCandidates,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_missing_resource`,
    messages: missingReviewMessages,
  });
  const missingResourceReview = await args.service.generateObjectForTask({
    task: "review_missing_resource",
    messages: missingReviewMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  logStage("chapter", `llm: review_fact chapter=${args.chapterNumber}`);
  const factReviewMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
    relationshipCandidates: specializedReviewerViews.relationshipCandidates,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_fact`,
    messages: factReviewMessages,
  });
  const factConsistencyReview = await args.service.generateObjectForTask({
    task: "review_fact",
    messages: factReviewMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  logStage("chapter", `llm: review_commercial chapter=${args.chapterNumber}`);
  const commercialReviewMessages = buildCommercialReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_commercial`,
    messages: commercialReviewMessages,
  });
  const commercialReview = await args.service.generateObjectForTask({
    task: "review_commercial",
    messages: commercialReviewMessages,
    schema: commercialReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  const initialNormalized = normalizeReviewerResults({
    missing: missingResourceReview.object as MissingResourceReviewerResult,
    fact: factConsistencyReview.object as FactConsistencyReviewerResult,
  });
  const initialMissing = initialNormalized.missing;
  const initialFact = initialNormalized.fact;
  const initialCommercial = normalizeCommercialReviewerResult(
    commercialReview.object as CommercialReviewerResult,
  );
  const rewritePlan = buildRewritePlan({
    missing: initialMissing,
    fact: initialFact,
    commercial: initialCommercial,
  });
  const originalDraft = writerResult.object.draft;
  const originalTitle = writerResult.object.title;
  let rewrittenDraft = writerResult.object.draft;
  let rewrittenTitle = writerResult.object.title;
  let activeMissing = initialMissing;
  let activeFact = initialFact;
  let activeCommercial = initialCommercial;
  const shouldRewriteNow =
    shouldRewriteForConsistency(activeFact) || rewritePlan.mode === "commercial_tune";
  if (shouldRewriteNow) {
    const rewriteTemp = rewritePlan.mode === "repair_first" ? 0.35 : 0.5;
    logStage("chapter", `llm: rewriter chapter=${args.chapterNumber} mode=${rewritePlan.mode} pass=1`);
    const rewriterMessages = buildRewriterMessages({
      title: rewrittenTitle,
      draft: rewrittenDraft,
      mode: rewritePlan.mode,
      objective: rewritePlan.objective,
      missingResourceReview: activeMissing,
      factConsistencyReview: activeFact,
      commercialReview: activeCommercial,
    });
    await writePromptDebug({
      projectId: args.projectId,
      scope: "chapter",
      label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_rewriter_${rewritePlan.mode}`,
      messages: rewriterMessages,
    });
    const rewrittenTextResult = await args.service.generateForTask({
      task: "rewriter",
      messages: rewriterMessages,
      temperature: rewriteTemp,
      maxTokens: 3000,
    });
    const rewrittenOutput = parseWriterLikeOutput({
      provider: rewrittenTextResult.provider,
      rawText: rewrittenTextResult.text,
      fallbackTitle: rewrittenTitle,
    });
    rewrittenDraft = rewrittenOutput.draft;
    rewrittenTitle = rewrittenOutput.title ?? rewrittenTitle;
  }

  logStage("chapter", `llm: review_missing_resource_final chapter=${args.chapterNumber} pass=1`);
  const missingFinalMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    resourceCandidates: specializedReviewerViews.resourceCandidates,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_missing_resource_final`,
    messages: missingFinalMessages,
  });
  const missingResourceReviewFinal = await args.service.generateObjectForTask({
    task: "review_missing_resource",
    messages: missingFinalMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  logStage("chapter", `llm: review_fact_final chapter=${args.chapterNumber} pass=1`);
  const factFinalMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
    relationshipCandidates: specializedReviewerViews.relationshipCandidates,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_fact_final`,
    messages: factFinalMessages,
  });
  const factConsistencyReviewFinal = await args.service.generateObjectForTask({
    task: "review_fact",
    messages: factFinalMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  logStage("chapter", `llm: review_commercial_final chapter=${args.chapterNumber} pass=1`);
  const commercialFinalMessages = buildCommercialReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_commercial_final`,
    messages: commercialFinalMessages,
  });
  const commercialReviewFinal = await args.service.generateObjectForTask({
    task: "review_commercial",
    messages: commercialFinalMessages,
    schema: commercialReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  const normalizedFinal = normalizeReviewerResults({
    missing: missingResourceReviewFinal.object as MissingResourceReviewerResult,
    fact: factConsistencyReviewFinal.object as FactConsistencyReviewerResult,
  });
  activeMissing = normalizedFinal.missing;
  activeFact = normalizedFinal.fact;
  activeCommercial = normalizeCommercialReviewerResult(
    commercialReviewFinal.object as CommercialReviewerResult,
  );

  if (
    rewritePlan.mode === "quality_boost" &&
    hasBlockingReviewerIssues({ missing: activeMissing, fact: activeFact })
  ) {
    rewrittenDraft = originalDraft;
    rewrittenTitle = originalTitle;
    activeMissing = initialMissing;
    activeFact = initialFact;
    activeCommercial = initialCommercial;
  }

  logStage("chapter", `llm: memory_updater chapter=${args.chapterNumber}`);
  const memoryMessages = buildMemoryUpdaterMessages({
    chapterNumber: args.chapterNumber,
    chapterPlan,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    activeCharacterIds: chapterPlan.requiredCharacters,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_memory_updater`,
    messages: memoryMessages,
  });
  const memoryUpdate = await args.service.generateObjectForTask({
    task: "memory_updater",
    messages: memoryMessages,
    schema: memoryUpdaterResultSchema,
    temperature: 0.2,
    maxTokens: 2200,
  });

  const updatedStoryMemories = applyMemoryUpdaterResult(
    args.base.storyMemories,
    memoryUpdate.object,
    args.chapterNumber,
  );
  const updatedChapterPlans = upsertChapterPlan(args.base.chapterPlans, chapterPlan);

  const artifact: ChapterArtifact = {
    chapterNumber: args.chapterNumber,
    plan: chapterPlan,
    contextPack: writerContextPack,
    writerResult: {
      ...(writerResult.object as WriterResult),
      title: rewrittenTitle,
      draft: rewrittenDraft,
    },
    missingResourceReview: activeMissing,
    factConsistencyReview: activeFact,
    commercialReview: activeCommercial,
    memoryUpdate: memoryUpdate.object as MemoryUpdaterResult,
    generatedAt: new Date().toISOString(),
  };

  logStage("chapter", `save artifacts chapter=${args.chapterNumber}`);
  await args.repository.saveChapterPlans(args.projectId, updatedChapterPlans);
  await args.repository.saveStoryMemories(args.projectId, updatedStoryMemories);
  await args.repository.saveChapterArtifact(args.projectId, artifact);
  await writeRetrievalDebugReport({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    chapterPlan,
    storyMemories: updatedStoryMemories,
    characterStates: args.base.characterStates,
    chapterArtifacts: [...args.availableChapterArtifacts, artifact],
    semanticOverrideHits,
    writerContextPack,
    reviewerContextPack,
    specializedViews: specializedReviewerViews,
  });
  await writeMemorySystemOutputs({
    projectId: args.projectId,
    storyMemories: updatedStoryMemories,
    characterStates: args.base.characterStates,
    chapterArtifacts: [...args.availableChapterArtifacts, artifact],
  });

  logStage("chapter", `done chapter=${args.chapterNumber}`);
  return {
    artifact,
    updatedStoryMemories,
    updatedChapterPlans,
  };
}

function parseTargetChapter(options: V1RunOptions): number {
  if (options.mode === "first-n") {
    if (!options.count || options.count < 1) {
      throw new Error("count must be >= 1 when mode is first-n");
    }
    return options.count;
  }

  if (!options.chapterNumber || options.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1 when mode is chapter");
  }

  return options.chapterNumber;
}

export async function runV1(options: V1RunOptions): Promise<V1RunResult> {
  logStage("run", `start mode=${options.mode} project=${options.projectId}`);
  const service = new LlmService();
  const repository = new FileProjectRepository();
  await loadEmbeddingCacheForProject(options.projectId);
  const targetChapter = parseTargetChapter(options);

  const base = await ensureBootstrappedProject(service, repository, options.projectId);
  const existingArtifacts: ChapterArtifact[] = [];
  let maxExistingChapter = 0;
  for (let chapterNumber = 1; chapterNumber <= targetChapter; chapterNumber += 1) {
    const artifact = await repository.loadChapterArtifact(options.projectId, chapterNumber);
    if (!artifact) {
      break;
    }
    existingArtifacts.push(artifact);
    maxExistingChapter = chapterNumber;
  }

  if (maxExistingChapter >= targetChapter) {
    const retrievalEval = options.withEval
      ? await runRetrievalEval({ projectId: options.projectId })
      : undefined;
    if (
      options.strictEval &&
      retrievalEval &&
      retrievalEval.report.passedCases < retrievalEval.report.totalCases
    ) {
      throw new Error(
        `Retrieval eval failed under --strict-eval: ${retrievalEval.report.passedCases}/${retrievalEval.report.totalCases} passed.`,
      );
    }
    return {
      projectId: options.projectId,
      targetChapter,
      generatedChapterNumbers: [],
      artifacts: existingArtifacts,
      validationIssues: base.validationIssues,
      retrievalEval,
    };
  }

  let storyMemories = base.storyMemories;
  let chapterPlans = base.chapterPlans;
  const generatedArtifacts: ChapterArtifact[] = [];

  const previousArtifact = maxExistingChapter > 0 ? existingArtifacts[existingArtifacts.length - 1] : null;

  let currentSituation = previousArtifact?.memoryUpdate.nextSituation ?? base.storySetup.openingSituation;
  let recentConsequences = buildRecentConsequences(previousArtifact, base.storySetup.currentArcGoal);

  for (let chapterNumber = maxExistingChapter + 1; chapterNumber <= targetChapter; chapterNumber += 1) {
    logStage("run", `generate chapter=${chapterNumber}/${targetChapter}`);
    const generation = await generateChapterArtifact({
      service,
      repository,
      projectId: options.projectId,
      chapterNumber,
      currentSituation,
      recentConsequences,
      availableChapterArtifacts: [...existingArtifacts, ...generatedArtifacts],
      base: {
        ...base,
        storyMemories,
        chapterPlans,
      },
    });

    generatedArtifacts.push(generation.artifact);
    storyMemories = generation.updatedStoryMemories;
    chapterPlans = generation.updatedChapterPlans;
    currentSituation = generation.artifact.memoryUpdate.nextSituation;
    recentConsequences = buildRecentConsequences(
      generation.artifact,
      base.storySetup.currentArcGoal,
    );
  }

  logStage("run", "completed");
  const retrievalEval = options.withEval
    ? await runRetrievalEval({ projectId: options.projectId })
    : undefined;
  if (
    options.strictEval &&
    retrievalEval &&
    retrievalEval.report.passedCases < retrievalEval.report.totalCases
  ) {
    throw new Error(
      `Retrieval eval failed under --strict-eval: ${retrievalEval.report.passedCases}/${retrievalEval.report.totalCases} passed.`,
    );
  }
  await saveEmbeddingCacheForProject(options.projectId);
  return {
    projectId: options.projectId,
    targetChapter,
    generatedChapterNumbers: generatedArtifacts.map((artifact) => artifact.chapterNumber),
    artifacts: generatedArtifacts,
    validationIssues: base.validationIssues,
    retrievalEval,
  };
}

export function formatV1RunResult(result: V1RunResult): string {
  const lines: string[] = [];

  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target chapter: ${result.targetChapter}`);
  lines.push(
    `Generated now: ${result.generatedChapterNumbers.length > 0 ? result.generatedChapterNumbers.join(", ") : "none"}`,
  );

  for (const artifact of result.artifacts) {
    lines.push("");
    lines.push(`=== Chapter ${artifact.chapterNumber} ===`);
    lines.push(`Title: ${artifact.writerResult.title ?? artifact.plan.title ?? "(untitled)"}`);
    lines.push(`Goal: ${artifact.plan.chapterGoal}`);
    lines.push(`Draft path: data/projects/${result.projectId}/chapters/chapter-${String(artifact.chapterNumber).padStart(3, "0")}/draft.md`);
    lines.push(`Summary: ${artifact.memoryUpdate.chapterSummary}`);
    lines.push(`Next: ${artifact.memoryUpdate.nextSituation}`);
    lines.push(
      `Missing resource findings: ${artifact.missingResourceReview.findings.length}`,
    );
    lines.push(`Fact findings: ${artifact.factConsistencyReview.findings.length}`);
  }

  if (result.validationIssues.length > 0) {
    lines.push("");
    lines.push("Validation issues:");
    for (const issue of result.validationIssues) {
      lines.push(`- ${issue}`);
    }
  }

  if (result.retrievalEval) {
    lines.push("");
    lines.push("Retrieval eval:");
    lines.push(
      `Passed: ${result.retrievalEval.report.passedCases}/${result.retrievalEval.report.totalCases}`,
    );
    lines.push(`Skipped: ${result.retrievalEval.report.skippedCases}`);
    if (result.retrievalEval.regression) {
      lines.push(
        `Delta passed: ${formatSignedNumber(result.retrievalEval.regression.deltaPassedCases)}`,
      );
      lines.push(
        `Delta failed: ${formatSignedNumber(result.retrievalEval.regression.deltaFailedCases)}`,
      );
      if (result.retrievalEval.regression.regressedChapters.length > 0) {
        lines.push(
          `Regressed chapters: ${result.retrievalEval.regression.regressedChapters
            .map((item) => `ch${item.chapterNumber} ${item.previousPassedCases}->${item.currentPassedCases}`)
            .join(", ")}`,
        );
      }
      if (result.retrievalEval.regression.improvedChapters.length > 0) {
        lines.push(
          `Improved chapters: ${result.retrievalEval.regression.improvedChapters
            .map((item) => `ch${item.chapterNumber} ${item.previousPassedCases}->${item.currentPassedCases}`)
            .join(", ")}`,
        );
      }
    }
  }

  return lines.join("\n");
}

export function formatInvalidateResult(result: InvalidateResult): string {
  return [
    `Project: ${result.projectId}`,
    `Invalidated from chapter: ${result.chapterNumber}`,
    `Deleted chapter artifacts: ${result.deletedChapterNumbers.length > 0 ? result.deletedChapterNumbers.join(", ") : "none"}`,
    `Remaining chapter plans: ${result.remainingChapterPlans}`,
    `Remaining memories: ${result.remainingMemories}`,
  ].join("\n");
}

export function formatRetrievalEvalSeedResult(result: RetrievalEvalSeedResult): string {
  return [
    `Project: ${result.projectId}`,
    `Eval set path: ${result.evalSetPath}`,
    `Cases: ${result.totalCases}`,
  ].join("\n");
}

export function formatRetrievalEvalRunResult(result: RetrievalEvalRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Eval set path: ${result.evalSetPath}`);
  lines.push(`Report path: ${result.reportPath}`);
  lines.push(`Passed: ${result.report.passedCases}/${result.report.totalCases}`);
  lines.push(`Skipped: ${result.report.skippedCases}`);
  if (result.regression) {
    lines.push(`Delta passed: ${formatSignedNumber(result.regression.deltaPassedCases)}`);
    lines.push(`Delta failed: ${formatSignedNumber(result.regression.deltaFailedCases)}`);
    if (result.regression.regressedChapters.length > 0) {
      lines.push(
        `Regressed chapters: ${result.regression.regressedChapters
          .map((item) => `ch${item.chapterNumber} ${item.previousPassedCases}->${item.currentPassedCases}`)
          .join(", ")}`,
      );
    }
    if (result.regression.improvedChapters.length > 0) {
      lines.push(
        `Improved chapters: ${result.regression.improvedChapters
          .map((item) => `ch${item.chapterNumber} ${item.previousPassedCases}->${item.currentPassedCases}`)
          .join(", ")}`,
      );
    }
  }

  for (const summary of result.report.chapterSummaries.slice(0, 12)) {
    lines.push(
      `Chapter ${summary.chapterNumber}: ${summary.passedCases}/${summary.totalCases} passed`,
    );
  }

  const failed = result.report.caseResults.filter((item) => !item.passed).slice(0, 8);
  if (failed.length > 0) {
    lines.push("");
    lines.push("Failed cases:");
    for (const item of failed) {
      lines.push(
        `- ch${item.chapterNumber} ${item.caseType} ${item.expectedValue} | evidence=${item.evidence.join(" | ") || "none"}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatChangeImpactRunResult(result: ChangeImpactRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target: ${result.targetId}`);
  lines.push(`Target type: ${result.report.targetType}`);
  lines.push(`Report path: ${result.reportPath}`);
  lines.push(`Impacted characters: ${result.report.impactedCharacters.length}`);
  lines.push(`Impacted memories: ${result.report.impactedMemories.length}`);
  lines.push(`Impacted chapters: ${result.report.impactedChapters.length}`);
  lines.push(`Impacted arcs: ${result.report.impactedArcs.length}`);
  lines.push(`Impacted beats: ${result.report.impactedBeats.length}`);

  const topChapter = result.report.impactedChapters.slice(0, 5);
  if (topChapter.length > 0) {
    lines.push("");
    lines.push("Top impacted chapters:");
    for (const item of topChapter) {
      lines.push(`- ${item.label} | ${item.reasons.map((reason) => reason.detail).join(" ; ")}`);
    }
  }

  return lines.join("\n");
}

export function formatRewritePlanRunResult(result: RewritePlanRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target: ${result.targetId}`);
  lines.push(`Target type: ${result.plan.targetType}`);
  lines.push(`Impact report: ${result.impactReportPath}`);
  lines.push(`Rewrite plan: ${result.rewritePlanPath}`);
  lines.push(
    `Suggested invalidation chapter: ${result.plan.suggestedInvalidationChapter ?? "none"}`,
  );
  lines.push(
    `Impacted chapters: ${result.plan.impactedChapterNumbers.length > 0 ? result.plan.impactedChapterNumbers.join(", ") : "none"}`,
  );
  lines.push(
    `Chapters with saved artifacts: ${result.plan.impactedArtifactChapterNumbers.length > 0 ? result.plan.impactedArtifactChapterNumbers.join(", ") : "none"}`,
  );
  lines.push(
    `Chapters with only plans: ${result.plan.impactedPlannedChapterNumbers.length > 0 ? result.plan.impactedPlannedChapterNumbers.join(", ") : "none"}`,
  );

  if (result.plan.recommendedCommand) {
    lines.push(`Recommended command: ${result.plan.recommendedCommand}`);
  }

  if (result.plan.reasons.length > 0) {
    lines.push("");
    lines.push("Key reasons:");
    for (const reason of result.plan.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join("\n");
}

export function formatInvalidateTargetRunResult(result: InvalidateTargetRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target: ${result.targetId}`);
  lines.push(`Impact report: ${result.impactReportPath}`);
  lines.push(`Rewrite plan: ${result.rewritePlanPath}`);
  lines.push(
    `Suggested invalidation chapter: ${result.plan.suggestedInvalidationChapter ?? "none"}`,
  );

  if (!result.invalidation) {
    lines.push("Invalidation: skipped");
    lines.push("Reason: no impacted chapter could be mapped to a concrete invalidation point.");
    return lines.join("\n");
  }

  lines.push(`Invalidated from chapter: ${result.invalidation.chapterNumber}`);
  lines.push(
    `Deleted chapter artifacts: ${result.invalidation.deletedChapterNumbers.length > 0 ? result.invalidation.deletedChapterNumbers.join(", ") : "none"}`,
  );
  lines.push(`Remaining chapter plans: ${result.invalidation.remainingChapterPlans}`);
  lines.push(`Remaining memories: ${result.invalidation.remainingMemories}`);

  return lines.join("\n");
}

function formatSignedNumber(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

export const defaultDemoProjectId = "demo-project";

export function formatAuthorPresetCatalog(): string {
  return formatAuthorPresetCatalogText();
}
export const defaultDemoPremise = demoPremise;
