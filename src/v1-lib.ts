import {
  applyMemoryUpdaterResult,
  type ArcOutline,
  type BeatOutline,
  type ChapterArtifact,
  type ChapterPlan,
  type CharacterState,
  type DerivedAuthorProfilePacks,
  type GenrePayoffPack,
  type RetrievalEvalReport,
  type RetrievalEvalSet,
  type StoryOutline,
  type StoryMemory,
  type StorySetup,
  type StyleBible,
  type ThemeBible,
  type WorldFact,
} from "./domain/index.js";
import {
  demoPremise,
  demoProjectTitle,
} from "./defaults/demo-project.js";
import {
  formatAuthorPresetCatalog as formatAuthorPresetCatalogText,
} from "./defaults/author-presets.js";
import { LlmService } from "./llm/service.js";
import type { ChatMessage } from "./llm/types.js";
import { parseWriterLikeOutput } from "./soft-output.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  applyDraftRewrite,
  inspectDraftRewrite,
  listDraftRewriteVersions,
} from "./v1-draft-rewrites.js";
import { generateChapterArtifact as runGenerateChapterArtifactWorkflow } from "./v1-chapter-generation.js";
import { rewriteChapterDraft as runRewriteChapterDraftWorkflow } from "./v1-rewrite-draft.js";
import {
  runRetrievalEval as runRetrievalEvalWorkflow,
  runV1 as runV1Workflow,
  seedRetrievalEvalSet as seedRetrievalEvalSetWorkflow,
} from "./v1-runner.js";
import {
  invalidateFromChapter as invalidateFromChapterWorkflow,
  invalidateFromTarget as invalidateFromTargetWorkflow,
  regenerateFromTarget as regenerateFromTargetWorkflow,
  rewriteChapter as rewriteChapterWorkflow,
} from "./v1-mutations.js";
import {
  bootstrapProject as bootstrapProjectWorkflow,
  ensureBootstrappedProject as ensureBootstrappedProjectWorkflow,
  interviewProject as interviewProjectWorkflow,
} from "./v1-bootstrap.js";
import {
  loadRoleDrivenArtifacts,
  readJsonArtifact,
  rebuildMemorySystemOutputsForProject,
  writeJsonArtifact,
  writeMemorySystemOutputs,
  writePromptDebug,
  writeRetrievalDebugReport,
} from "./v1-artifacts.js";
import {
  assertChapterPlanningAnchors,
  buildRecentCommercialHistory,
  buildRecentConsequences,
  buildRewritePlan,
  buildUnresolvedDelayedConsequences,
  hasBlockingReviewerIssues,
  loadAllChapterArtifacts,
  loadEmbeddingCacheForProject,
  loadSeedStoryMemories,
  normalizeCommercialPlan,
  normalizeCommercialReviewerResult,
  normalizePayoffPatternIds,
  normalizeReviewerResults,
  normalizeRoleDrivenReviewerResult,
  normalizeSearchIntent,
  resolveSemanticOverrideHits,
  saveEmbeddingCacheForProject,
  uniqueStrings,
  upsertChapterPlan,
} from "./v1-shared.js";
import {
  applyOutlinePatches,
  runRewritePlan,
  suggestOutlinePatches,
} from "./v1-impact.js";
import type {
  ChangeImpactRunResult,
  ConsequenceInspectionReport,
  ConsequenceInspectionRunResult,
  OutlinePatchApplyRunResult,
  OutlinePatchSuggestionRunResult,
  RoleDrivenEvalRunResult,
  RewritePlanReport,
  RewritePlanRunResult,
} from "./v1-impact.js";
import type { OutlinePatchApplyFilters } from "./v1-role-drive.js";
export {
  applyOutlinePatches,
  inspectConsequences,
  runRoleDrivenEval,
  runChangeImpact,
  runRewritePlan,
  suggestOutlinePatches,
} from "./v1-impact.js";
export {
  applyDraftRewrite,
  inspectDraftRewrite,
  listDraftRewriteVersions,
} from "./v1-draft-rewrites.js";
export {
  computeThreadEconomy,
  inspectNarrativeRuntime,
  rankNarrativeRuntime,
  runThreadEval,
  seedNarrativeRuntime,
  suggestNextThreadMoves,
  updateThreadsFromChapter,
} from "./v1-threads.js";
export {
  evalEpisodePacket,
  inspectEpisodePacket,
  planEpisodePacket,
  reviseEpisodePacket,
} from "./v1-episode.js";
export {
  inspectStateDeltas,
} from "./v1-deltas.js";
export {
  applyOffscreenMovesForChapter,
  inspectOffscreenMoves,
  scheduleOffscreenMoves,
} from "./v1-offscreen.js";
export { runRuntimeEval } from "./v1-runtime-eval.js";
export {
  bindWorldFactsForProject,
  decomposeChapterScenesForProject,
  deriveArcShiftsForProject,
  fillDecisionProfilesForProject,
  formatBindWorldFactsResult,
  formatDecomposeChapterScenesResult,
  formatDeriveArcShiftsResult,
  formatFillDecisionProfilesResult,
  formatInspectFactCoverageResult,
  formatInspectRevealsResult,
  inspectFactCoverageForProject,
  inspectRevealsForProject,
} from "./v1-bible.js";
export type {
  BindWorldFactsOptions,
  BindWorldFactsResult,
  DecomposeChapterScenesOptions,
  DecomposeChapterScenesResult,
  DeriveArcShiftsOptions,
  DeriveArcShiftsResult,
  FillDecisionProfilesOptions,
  FillDecisionProfilesResult,
  InspectFactCoverageOptions,
  InspectFactCoverageResult,
  InspectRevealsOptions,
  InspectRevealsResult,
} from "./v1-bible.js";
export {
  inspectTask,
  listTasks,
  submitTaskFromFile,
} from "./v1-task.js";
import {
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterRelationshipShiftPath,
} from "./v1-paths.js";
import {
  pickArcForChapterDeterministic,
  pickBeatForChapterDeterministic,
} from "./domain/chapter-mapping.js";
import {
  buildPlannerMessages,
  plannerResultSchema,
} from "./prompts/index.js";
import { planEpisodePacket as _planEpisodePacket } from "./v1-episode.js";
import {
  type ConsequenceEdgeArtifact,
  type DecisionLogArtifact,
  type RelationshipShiftArtifact,
} from "./v1-role-drive.js";

function logStage(stage: string, detail: string): void {
  console.log(`[${stage}] ${detail}`);
}

async function generateWriterLikeResult(args: {
  service: LlmService;
  task: "writer" | "rewriter";
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  fallbackTitle?: string;
}): Promise<ReturnType<typeof parseWriterLikeOutput>> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const textResult = await args.service.generateForTask({
        task: args.task,
        messages: args.messages,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
      });
      return parseWriterLikeOutput({
        provider: textResult.provider,
        rawText: textResult.text,
        fallbackTitle: args.fallbackTitle,
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryableParseFailure =
        message.includes("Empty writer output") || message.includes("Failed to parse");
      if (!retryableParseFailure || attempt >= 1) {
        throw error;
      }
      console.warn(`[llm] task=${args.task} parse failure, retrying once: ${message}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateStructuredTaskWithRetry<TSchema extends object>(args: {
  service: LlmService;
  task:
    | "planner"
    | "review_missing_resource"
    | "review_fact"
    | "review_commercial"
    | "review_role_drive"
    | "memory_updater";
  messages: ChatMessage[];
  schema: TSchema;
  temperature: number;
  maxTokens: number;
}): Promise<{ object: TSchema }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await args.service.generateObjectForTask({
        task: args.task,
        messages: args.messages,
        schema: args.schema,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
      });
      return { object: result.object as TSchema };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("truncated before valid JSON completed") ||
        message.includes("Invalid structured JSON output") ||
        message.includes("Unterminated string in JSON");
      if (!retryable || attempt >= 2) {
        throw error;
      }
      console.warn(`[llm] task=${args.task} structured parse failure, retrying once: ${message}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function findDecisionEvidenceSnippets(args: {
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

export interface InvalidateResult {
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

export interface RegenerateFromTargetRunResult {
  projectId: string;
  targetId: string;
  requestedCount: number;
  impactReportPath: string;
  rewritePlanPath: string;
  plan: RewritePlanReport;
  invalidation?: InvalidateResult;
  generation?: V1RunResult;
}

export interface RegenerateWithPatchesRunResult {
  projectId: string;
  targetId: string;
  requestedCount: number;
  patchSourceChapter: number | null;
  rewritePlan: RewritePlanRunResult;
  patchSuggestions: OutlinePatchSuggestionRunResult | null;
  patchApply: OutlinePatchApplyRunResult | null;
  regeneration: RegenerateFromTargetRunResult | null;
  skippedReason: string | null;
}

export interface RewriteChapterRunResult {
  projectId: string;
  chapterNumber: number;
  invalidation: InvalidateResult;
  generation: V1RunResult;
}

export interface RewriteDraftRunResult {
  projectId: string;
  chapterNumber: number;
  draftPath: string;
  metadataPath: string;
  versionId: string;
  versionDraftPath: string;
  versionMetadataPath: string;
  mode: "repair_first" | "hybrid_upgrade" | "commercial_tune" | "quality_boost";
  title: string | undefined;
  retrievalEval?: RetrievalEvalRunResult;
}

export interface ApplyDraftRewriteRunResult {
  projectId: string;
  chapterNumber: number;
  versionId: string;
  draftRewritePath: string;
  metadataPath: string;
  backupDraftPath: string;
  backupResultPath: string;
  canonicalDraftPath: string;
  canonicalResultPath: string;
  title: string | undefined;
}

export interface DraftRewriteVersionSummary {
  versionId: string;
  generatedAt?: string;
  mode?: string;
  title?: string;
  draftPath: string;
  metadataPath: string;
  isLatest: boolean;
}

export interface ListDraftRewriteVersionsRunResult {
  projectId: string;
  chapterNumber: number;
  versions: DraftRewriteVersionSummary[];
}

export interface InspectDraftRewriteRunResult {
  projectId: string;
  chapterNumber: number;
  versionId: string;
  draftPath: string;
  metadataPath: string;
  title?: string;
  mode?: string;
  generatedAt?: string;
  objective?: string;
  compareAgainst: "canonical" | "latest";
  comparison: {
    selectedLines: number;
    baselineLines: number;
    lineDelta: number;
    selectedChars: number;
    baselineChars: number;
    charDelta: number;
    firstDifferenceLine: number | null;
    exactMatch: boolean;
  };
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

async function ensureBootstrappedProject(
  service: LlmService,
  repository: FileProjectRepository,
  projectId: string,
  authorPresetId?: string,
): Promise<ProjectBaseState & { validationIssues: string[] }> {
  return ensureBootstrappedProjectWorkflow({
    service,
    repository,
    projectId,
    authorPresetId,
    logStage,
    rebuildMemorySystemOutputsForProject: (
      repo,
      targetProjectId,
      storyMemories,
      characterStates,
    ) =>
      rebuildMemorySystemOutputsForProject(
        repo,
        loadAllChapterArtifacts,
        targetProjectId,
        storyMemories,
        characterStates,
      ),
  });
}

export async function invalidateFromChapter(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<InvalidateResult> {
  return invalidateFromChapterWorkflow({
    ...args,
    repository: new FileProjectRepository(),
    loadSeedStoryMemories,
    loadAllChapterArtifacts,
    rebuildMemorySystemOutputsForProject: (repository, projectId, storyMemories, characterStates) =>
      rebuildMemorySystemOutputsForProject(
        repository,
        loadAllChapterArtifacts,
        projectId,
        storyMemories,
        characterStates,
      ),
  });
}

export async function interviewProject(args: {
  projectId: string;
  answersRaw: string;
}): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  return interviewProjectWorkflow({
    ...args,
    serviceFactory: () => new LlmService(),
    repository: new FileProjectRepository(),
  });
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
  return seedRetrievalEvalSetWorkflow({
    ...args,
    repository: new FileProjectRepository(),
    loadEmbeddingCacheForProject: (projectId) =>
      loadEmbeddingCacheForProject(readJsonArtifact, projectId),
    saveEmbeddingCacheForProject: (projectId) =>
      saveEmbeddingCacheForProject(writeJsonArtifact, projectId),
    loadAllChapterArtifacts,
    loadSeedStoryMemories,
    resolveSemanticOverrideHits,
    writeJsonArtifact,
  });
}

export async function runRetrievalEval(args: {
  projectId: string;
}): Promise<RetrievalEvalRunResult> {
  return runRetrievalEvalWorkflow({
    ...args,
    repository: new FileProjectRepository(),
    loadEmbeddingCacheForProject: (projectId) =>
      loadEmbeddingCacheForProject(readJsonArtifact, projectId),
    saveEmbeddingCacheForProject: (projectId) =>
      saveEmbeddingCacheForProject(writeJsonArtifact, projectId),
    loadAllChapterArtifacts,
    loadSeedStoryMemories,
    resolveSemanticOverrideHits,
    writeMemorySystemOutputs,
    writeJsonArtifact,
    readJsonArtifact,
  });
}

export async function invalidateFromTarget(args: {
  projectId: string;
  targetId: string;
}): Promise<InvalidateTargetRunResult> {
  return invalidateFromTargetWorkflow({
    ...args,
    runRewritePlan,
    invalidateFromChapter,
  });
}

export async function regenerateFromTarget(args: {
  projectId: string;
  targetId: string;
  count: number;
  withEval?: boolean;
  strictEval?: boolean;
}): Promise<RegenerateFromTargetRunResult> {
  return regenerateFromTargetWorkflow({
    ...args,
    invalidateFromTarget,
    runV1: (input) => runV1(input),
  });
}

export async function regenerateWithPatches(args: {
  projectId: string;
  targetId: string;
  count?: number;
  approver?: string;
  note?: string;
  filters?: OutlinePatchApplyFilters;
  withEval?: boolean;
  strictEval?: boolean;
}): Promise<RegenerateWithPatchesRunResult> {
  const count = args.count ?? 1;
  if (count < 1) {
    throw new Error("count must be >= 1");
  }

  const rewritePlan = await runRewritePlan({
    projectId: args.projectId,
    targetId: args.targetId,
  });
  const patchSourceChapter = rewritePlan.plan.suggestedInvalidationChapter;
  if (patchSourceChapter === null) {
    return {
      projectId: args.projectId,
      targetId: args.targetId,
      requestedCount: count,
      patchSourceChapter,
      rewritePlan,
      patchSuggestions: null,
      patchApply: null,
      regeneration: null,
      skippedReason: "No impacted chapter could be mapped to a patch/regeneration source.",
    };
  }

  const patchSuggestions = await suggestOutlinePatches({
    projectId: args.projectId,
    fromChapter: patchSourceChapter,
  });
  const patchApply = await applyOutlinePatches({
    projectId: args.projectId,
    fromChapter: patchSourceChapter,
    approver: args.approver,
    note: args.note,
    filters: args.filters,
  });
  const regeneration = await regenerateFromTarget({
    projectId: args.projectId,
    targetId: args.targetId,
    count,
    withEval: args.withEval,
    strictEval: args.strictEval,
  });

  return {
    projectId: args.projectId,
    targetId: args.targetId,
    requestedCount: count,
    patchSourceChapter,
    rewritePlan,
    patchSuggestions,
    patchApply,
    regeneration,
    skippedReason: null,
  };
}

export async function rewriteChapter(args: {
  projectId: string;
  chapterNumber: number;
  withEval?: boolean;
  strictEval?: boolean;
}): Promise<RewriteChapterRunResult> {
  return rewriteChapterWorkflow({
    ...args,
    repository: new FileProjectRepository(),
    invalidateFromChapter,
    runV1: (input) => runV1(input),
  });
}

export async function rewriteChapterDraft(args: {
  projectId: string;
  chapterNumber: number;
  withEval?: boolean;
  strictEval?: boolean;
}): Promise<RewriteDraftRunResult> {
  const repository = new FileProjectRepository();
  return runRewriteChapterDraftWorkflow({
    ...args,
    serviceFactory: () => new LlmService(),
    repository,
    ensureBootstrappedProject,
    loadAllChapterArtifacts,
    loadEmbeddingCacheForProject: (projectId) =>
      loadEmbeddingCacheForProject(readJsonArtifact, projectId),
    saveEmbeddingCacheForProject: (projectId) =>
      saveEmbeddingCacheForProject(writeJsonArtifact, projectId),
    resolveSemanticOverrideHits,
    buildUnresolvedDelayedConsequences,
    assertChapterPlanningAnchors,
    normalizeReviewerResults,
    normalizeCommercialReviewerResult,
    normalizeRoleDrivenReviewerResult,
    buildRewritePlan,
    generateStructuredTaskWithRetry,
    generateWriterLikeResult,
    writeJsonArtifact,
    runRetrievalEval,
    logStage,
  });
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
  return runGenerateChapterArtifactWorkflow({
    ...args,
    assertChapterPlanningAnchors,
    buildUnresolvedDelayedConsequences,
    resolveSemanticOverrideHits,
    normalizeReviewerResults,
    normalizeCommercialReviewerResult,
    normalizeRoleDrivenReviewerResult,
    buildRewritePlan,
    generateStructuredTaskWithRetry,
    generateWriterLikeResult,
    writePromptDebug,
    writeJsonArtifact,
    writeRetrievalDebugReport,
    writeMemorySystemOutputs,
    logStage,
    normalizeSearchIntent,
    normalizeCommercialPlan,
    normalizePayoffPatternIds,
    uniqueStrings,
    buildRecentCommercialHistory,
    hasBlockingReviewerIssues,
    upsertChapterPlan,
  });
}

export async function runV1(options: V1RunOptions): Promise<V1RunResult> {
  return runV1Workflow({
    options,
    serviceFactory: () => new LlmService(),
    repository: new FileProjectRepository(),
    loadEmbeddingCacheForProject: (projectId) =>
      loadEmbeddingCacheForProject(readJsonArtifact, projectId),
    saveEmbeddingCacheForProject: (projectId) =>
      saveEmbeddingCacheForProject(writeJsonArtifact, projectId),
    ensureBootstrappedProject,
    runRetrievalEval,
    generateChapterArtifact,
    buildRecentConsequences,
    logStage,
  });
}

export interface PlanChapterOnlyResult {
  projectId: string;
  chapterNumber: number;
  chapterPlan: ChapterPlan;
  plannerNotes: string[];
}

export async function planChapterOnly(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<PlanChapterOnlyResult> {
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const base = await ensureBootstrappedProject(service, repository, args.projectId);

  const allArtifacts = await loadAllChapterArtifacts(repository, args.projectId);
  const previousArtifact = allArtifacts
    .filter((a) => a.chapterNumber < args.chapterNumber)
    .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];

  const currentSituation =
    previousArtifact?.memoryUpdate.nextSituation ?? base.storySetup.openingSituation;

  const recentConsequences = buildRecentConsequences(
    previousArtifact ?? null,
    base.storySetup.currentArcGoal,
  );

  const unresolvedDelayedConsequences = buildUnresolvedDelayedConsequences({
    chapterArtifacts: allArtifacts,
    beatOutlines: base.beatOutlines,
    currentChapterNumber: args.chapterNumber,
  });

  const currentArc = pickArcForChapterDeterministic(base.arcOutlines, args.chapterNumber);
  const currentBeat = pickBeatForChapterDeterministic(
    base.beatOutlines,
    currentArc,
    args.chapterNumber,
  );

  const episodePlan = await _planEpisodePacket({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });

  const allScenePlans = await repository.loadChapterScenePlans(args.projectId);
  const scenePlan = allScenePlans.find((p) => p.chapterNumber === args.chapterNumber);

  const allArcShifts = [
    ...(currentArc?.protagonistArc?.shifts ?? []),
    ...(currentArc?.supportingCharacterArcs?.flatMap((a) => a.shifts) ?? []),
  ];
  const activeShifts = allArcShifts.filter(
    (shift) =>
      shift.expectedChapterRange &&
      args.chapterNumber >= shift.expectedChapterRange.start &&
      args.chapterNumber <= shift.expectedChapterRange.end,
  );

  const activeCharacterIds = currentBeat?.requiredCharacters.length
    ? currentBeat.requiredCharacters
    : base.storySetup.defaultActiveCharacterIds;

  const plannerMessages = buildPlannerMessages({
    authorPack: base.authorPacks.planner,
    themeBible: base.themeBible,
    styleBible: base.styleBible,
    genrePayoffPack: base.genrePayoffPack,
    storyOutline: base.storyOutline,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    arcId: currentArc?.id,
    chapterNumber: args.chapterNumber,
    mode: args.chapterNumber === 1 ? "opening" : "continuation",
    premise: base.storySetup.premise,
    currentArcGoal: currentArc?.arcGoal ?? base.storySetup.currentArcGoal,
    currentSituation,
    activeCharacterIds,
    activeCharacters: base.characterStates.filter((c) => activeCharacterIds.includes(c.id)),
    candidateMemoryIds: base.storyMemories
      .filter((m) => m.status === "active" || m.status === "triggered")
      .map((m) => m.id)
      .slice(0, 12),
    recentConsequences,
    unresolvedDelayedConsequences,
    recentCommercialHistory: buildRecentCommercialHistory(base.chapterPlans, args.chapterNumber),
    episodePacket: episodePlan.packet,
    scenePlan,
    activeShifts: activeShifts.length > 0 ? activeShifts : undefined,
  });

  const plannerResult = await generateStructuredTaskWithRetry({
    service,
    task: "planner",
    messages: plannerMessages,
    schema: plannerResultSchema,
    temperature: 0.2,
    maxTokens: 2800,
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
  const chapterPlan: ChapterPlan = {
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
      characterStates: base.characterStates,
      storyMemories: base.storyMemories,
    }),
    commercial: normalizeCommercialPlan({
      planned: planned.commercial,
      genrePayoffPack: base.genrePayoffPack,
      chapterNumber: args.chapterNumber,
      chapterType: planned.chapterType,
      chapterGoal: planned.chapterGoal,
      plannedOutcome: planned.plannedOutcome,
      emotionalGoal: planned.emotionalGoal,
      currentSituation,
    }),
    payoffPatternIds: normalizePayoffPatternIds({
      plannerIds: planned.payoffPatternIds,
      currentArc,
      currentBeat,
    }),
  };

  const updatedPlans = upsertChapterPlan(base.chapterPlans, chapterPlan);
  await repository.saveChapterPlans(args.projectId, updatedPlans);

  logStage("plan-only", `saved chapter=${args.chapterNumber} goal=${chapterPlan.chapterGoal.slice(0, 60)}`);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    chapterPlan,
    plannerNotes: plannerResult.object.plannerNotes ?? [],
  };
}

export const defaultDemoProjectId = "demo-project";

export function formatAuthorPresetCatalog(): string {
  return formatAuthorPresetCatalogText();
}
export const defaultDemoPremise = demoPremise;
