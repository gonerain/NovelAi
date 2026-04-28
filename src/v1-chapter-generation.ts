import {
  applyMemoryUpdaterResult,
  buildContextPack,
  buildSpecializedReviewerViews,
  pickArcForChapterDeterministic,
  pickBeatForChapterDeterministic,
  shouldRewriteForConsistency,
  validateMemoryUpdaterResult,
  type ChapterArtifact,
  type ChapterCommercialPlan,
  type ChapterPlan,
  type CommercialReviewerResult,
  type EpisodePacket,
  type FactConsistencyReviewerResult,
  type MemoryUpdaterResult,
  type MissingResourceReviewerResult,
  type RoleDrivenReviewerResult,
  type SemanticRetrievalHit,
  type StoryMemory,
  type WriterResult,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import type { ChatMessage } from "./llm/types.js";
import {
  buildCommercialReviewMessages,
  buildFactConsistencyReviewMessages,
  buildMemoryUpdaterMessages,
  buildMissingResourceReviewMessages,
  buildPlannerMessages,
  buildRewriterMessages,
  buildRoleDrivenReviewMessages,
  buildWriterMessages,
  commercialReviewerResultSchema,
  factConsistencyReviewerResultSchema,
  memoryUpdaterResultSchema,
  missingResourceReviewerResultSchema,
  plannerResultSchema,
  roleDrivenReviewerResultSchema,
} from "./prompts/index.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterEpisodeEvalPath,
  chapterEpisodePacketPath,
  chapterMemoryValidationPath,
  chapterRelationshipShiftPath,
  chapterStatsPath,
} from "./v1-paths.js";
import {
  buildConsequenceEdgesArtifact,
  buildDecisionLogArtifact,
  buildRelationshipShiftArtifact,
} from "./v1-role-drive.js";
import { buildRoleDrivenPlannerCarryover } from "./v1-shared.js";
import type { ProjectBaseState } from "./v1-lib.js";
import { evalEpisodePacket, planEpisodePacket } from "./v1-episode.js";
import { updateThreadsFromChapter } from "./v1-threads.js";
import { applyOffscreenMovesForChapter } from "./v1-offscreen.js";
import { readJsonArtifact } from "./v1-artifacts.js";
import type { DecisionLogArtifact } from "./v1-role-drive.js";

type GenerateStructuredTaskWithRetry = <TSchema extends object>(args: {
  service: LlmService;
  task:
    | "review_missing_resource"
    | "review_fact"
    | "review_commercial"
    | "review_role_drive"
    | "memory_updater";
  messages: ChatMessage[];
  schema: TSchema;
  temperature: number;
  maxTokens: number;
}) => Promise<{ object: TSchema }>;

type GenerateWriterLikeResult = (args: {
  service: LlmService;
  task: "writer" | "rewriter";
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  fallbackTitle?: string;
}) => Promise<{ title?: string; draft: string; notes: string[] }>;

export async function generateChapterArtifact(args: {
  service: LlmService;
  base: ProjectBaseState;
  repository: FileProjectRepository;
  projectId: string;
  chapterNumber: number;
  currentSituation: string;
  recentConsequences: string[];
  availableChapterArtifacts: ChapterArtifact[];
  assertChapterPlanningAnchors: (args: {
    projectId: string;
    chapterNumber: number;
    beatOutlines: ProjectBaseState["beatOutlines"];
    currentArc: ProjectBaseState["arcOutlines"][number] | undefined;
    currentBeat: ProjectBaseState["beatOutlines"][number] | undefined;
  }) => void;
  buildUnresolvedDelayedConsequences: (args: {
    chapterArtifacts: ChapterArtifact[];
    beatOutlines: ProjectBaseState["beatOutlines"];
    currentChapterNumber: number;
  }) => string[];
  resolveSemanticOverrideHits: (args: {
    chapterPlan: ChapterPlan;
    storyMemories: StoryMemory[];
    chapterArtifacts: ChapterArtifact[];
  }) => Promise<SemanticRetrievalHit[] | undefined>;
  normalizeReviewerResults: (args: {
    missing: MissingResourceReviewerResult;
    fact: FactConsistencyReviewerResult;
  }) => {
    missing: MissingResourceReviewerResult;
    fact: FactConsistencyReviewerResult;
  };
  normalizeCommercialReviewerResult: (
    review: CommercialReviewerResult,
  ) => CommercialReviewerResult;
  normalizeRoleDrivenReviewerResult: (
    review: RoleDrivenReviewerResult,
  ) => RoleDrivenReviewerResult;
  buildRewritePlan: (args: {
    missing: MissingResourceReviewerResult;
    fact: FactConsistencyReviewerResult;
    commercial?: CommercialReviewerResult;
    roleDriven?: RoleDrivenReviewerResult;
  }) => { mode: "repair_first" | "hybrid_upgrade" | "commercial_tune" | "quality_boost"; objective: string };
  generateStructuredTaskWithRetry: GenerateStructuredTaskWithRetry;
  generateWriterLikeResult: GenerateWriterLikeResult;
  writePromptDebug: (args: {
    projectId: string;
    scope: "chapter" | "outline";
    label: string;
    messages: ChatMessage[];
  }) => Promise<void>;
  writeJsonArtifact: (filepath: string, data: unknown) => Promise<void>;
  writeRetrievalDebugReport: (args: {
    projectId: string;
    chapterNumber: number;
    chapterPlan: ChapterPlan;
    storyMemories: StoryMemory[];
    characterStates: ProjectBaseState["characterStates"];
    chapterArtifacts: ChapterArtifact[];
    semanticOverrideHits: SemanticRetrievalHit[] | undefined;
    writerContextPack: ReturnType<typeof buildContextPack>;
    reviewerContextPack: ReturnType<typeof buildContextPack>;
    specializedViews: ReturnType<typeof buildSpecializedReviewerViews>;
  }) => Promise<void>;
  writeMemorySystemOutputs: (args: {
    projectId: string;
    storyMemories: StoryMemory[];
    characterStates: ProjectBaseState["characterStates"];
    chapterArtifacts: ChapterArtifact[];
  }) => Promise<void>;
  logStage: (stage: string, detail: string) => void;
  normalizeSearchIntent: (args: {
    planned: ChapterPlan["searchIntent"];
    requiredCharacterIds: string[];
    requiredMemoryIds: string[];
    characterStates: ProjectBaseState["characterStates"];
    storyMemories: StoryMemory[];
  }) => ChapterPlan["searchIntent"];
  normalizeCommercialPlan: (args: {
    planned: ChapterCommercialPlan | undefined;
    genrePayoffPack: ProjectBaseState["genrePayoffPack"];
    chapterNumber: number;
    chapterType: ChapterPlan["chapterType"];
    chapterGoal: string;
    plannedOutcome: string;
    emotionalGoal: string;
    currentSituation: string;
  }) => ChapterCommercialPlan;
  normalizePayoffPatternIds: (args: {
    plannerIds: string[] | undefined;
    currentArc: ProjectBaseState["arcOutlines"][number] | undefined;
    currentBeat: ProjectBaseState["beatOutlines"][number] | undefined;
  }) => string[];
  uniqueStrings: (values: string[], limit: number) => string[];
  buildRecentCommercialHistory: (
    chapterPlans: ChapterPlan[],
    chapterNumber: number,
  ) => string[];
  hasBlockingReviewerIssues: (args: {
    missing: MissingResourceReviewerResult;
    fact: FactConsistencyReviewerResult;
  }) => boolean;
  upsertChapterPlan: (chapterPlans: ChapterPlan[], chapterPlan: ChapterPlan) => ChapterPlan[];
}): Promise<{
  artifact: ChapterArtifact;
  updatedStoryMemories: StoryMemory[];
  updatedChapterPlans: ChapterPlan[];
}> {
  args.logStage("chapter", `start chapter=${args.chapterNumber}`);
  const currentArc = pickArcForChapterDeterministic(args.base.arcOutlines, args.chapterNumber);
  const currentBeat = pickBeatForChapterDeterministic(
    args.base.beatOutlines,
    currentArc,
    args.chapterNumber,
  );
  args.assertChapterPlanningAnchors({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    beatOutlines: args.base.beatOutlines,
    currentArc,
    currentBeat,
  });
  const unresolvedDelayedConsequences = args.buildUnresolvedDelayedConsequences({
    chapterArtifacts: args.availableChapterArtifacts,
    beatOutlines: args.base.beatOutlines,
    currentChapterNumber: args.chapterNumber,
  });
  const roleDrivenCarryover = buildRoleDrivenPlannerCarryover({
    unresolvedDelayedConsequences,
  });
  try {
    const offscreenApply = await applyOffscreenMovesForChapter({
      projectId: args.projectId,
      chapterNumber: args.chapterNumber,
    });
    if (offscreenApply.applyReport.appliedCount > 0 || offscreenApply.applyReport.skippedCount > 0) {
      args.logStage(
        "chapter",
        `offscreen applied chapter=${args.chapterNumber} applied=${offscreenApply.applyReport.appliedCount} skipped=${offscreenApply.applyReport.skippedCount}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    args.logStage("chapter", `WARN: offscreen apply skipped chapter=${args.chapterNumber}: ${message}`);
  }

  args.logStage("chapter", `episode: plan chapter=${args.chapterNumber}`);
  const episodePlan = await planEpisodePacket({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });
  args.logStage("chapter", `episode: eval chapter=${args.chapterNumber}`);
  const episodeEval = await evalEpisodePacket({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });
  if (!episodeEval.report.passed) {
    throw new Error(
      [
        `Episode agency gate failed: project=${args.projectId}, chapter=${args.chapterNumber}`,
        `Agency score: ${episodeEval.report.agencyScore}`,
        `Eval path: ${episodeEval.evalPath}`,
        ...episodeEval.report.failureReasons.map((reason) => `- ${reason}`),
      ].join("\n"),
    );
  }
  const episodePacket: EpisodePacket = episodePlan.packet;

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
    activeCharacters: args.base.characterStates.filter((character) =>
      (
        currentBeat?.requiredCharacters.length
          ? currentBeat.requiredCharacters
          : args.base.storySetup.defaultActiveCharacterIds
      ).includes(character.id),
    ),
    candidateMemoryIds: args.base.storyMemories
      .filter((memory) => memory.status === "active" || memory.status === "triggered")
      .map((memory) => memory.id)
      .slice(0, 12),
    recentConsequences: args.recentConsequences,
    unresolvedDelayedConsequences,
    recentCommercialHistory: args.buildRecentCommercialHistory(
      args.base.chapterPlans,
      args.chapterNumber,
    ),
    episodePacket,
  });

  args.logStage("chapter", `llm: planner chapter=${args.chapterNumber}`);
  await args.writePromptDebug({
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
  const requiredCharacters = args.uniqueStrings(
    [...planned.requiredCharacters, ...(currentBeat?.requiredCharacters ?? [])],
    8,
  );
  const requiredMemories = args.uniqueStrings(
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
    searchIntent: args.normalizeSearchIntent({
      planned: planned.searchIntent,
      requiredCharacterIds: requiredCharacters,
      requiredMemoryIds: requiredMemories,
      characterStates: args.base.characterStates,
      storyMemories: args.base.storyMemories,
    }),
    commercial: args.normalizeCommercialPlan({
      planned: planned.commercial,
      genrePayoffPack: args.base.genrePayoffPack,
      chapterNumber: args.chapterNumber,
      chapterType: planned.chapterType,
      chapterGoal: planned.chapterGoal,
      plannedOutcome: planned.plannedOutcome,
      emotionalGoal: planned.emotionalGoal,
      currentSituation: args.currentSituation,
    }),
    beatConstraints: args.uniqueStrings([...(currentBeat?.constraints ?? [])], 6),
    mustHitConflicts: args.uniqueStrings(
      [
        ...roleDrivenCarryover.mustHitConflicts,
        ...planned.mustHitConflicts,
        episodePacket.nonTransferableChoice,
        episodePacket.protagonistConsequence,
        planned.chapterGoal,
        planned.emotionalGoal,
        planned.plannedOutcome,
        currentBeat?.conflict ?? "",
      ],
      6,
    ),
    disallowedMoves: args.uniqueStrings(
      [
        ...episodePacket.doNotResolve,
        ...roleDrivenCarryover.disallowedMoves,
        ...planned.disallowedMoves,
      ],
      6,
    ),
    styleReminders: args.uniqueStrings(
      [
        `Episode mode=${episodePacket.chapterMode}; payoffType=${episodePacket.payoffType}`,
        `Agency gate passed score=${episodeEval.report.agencyScore}`,
        ...roleDrivenCarryover.styleReminders,
        ...planned.styleReminders,
      ],
      6,
    ),
    payoffPatternIds: args.normalizePayoffPatternIds({
      plannerIds: planned.payoffPatternIds,
      currentArc,
      currentBeat,
    }),
  } satisfies ChapterPlan;
  const semanticOverrideHits = await args.resolveSemanticOverrideHits({
    chapterPlan,
    storyMemories: args.base.storyMemories,
    chapterArtifacts: args.availableChapterArtifacts,
  });

  args.logStage("chapter", `build context chapter=${args.chapterNumber}`);
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
    unresolvedDelayedConsequences,
    characterStates: args.base.characterStates,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
    episodePacket,
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
    unresolvedDelayedConsequences,
    characterStates: args.base.characterStates,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
    episodePacket,
  });
  const specializedReviewerViews = buildSpecializedReviewerViews({
    chapterPlan,
    storyMemories: args.base.storyMemories,
    characterStates: args.base.characterStates,
    chapterArtifacts: args.availableChapterArtifacts,
  });

  args.logStage("chapter", `llm: writer chapter=${args.chapterNumber}`);
  const writerMessages = buildWriterMessages({
    contextPack: writerContextPack,
    minParagraphs: 8,
    maxParagraphs: 14,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_writer`,
    messages: writerMessages,
  });
  const writerOutput = await args.generateWriterLikeResult({
    service: args.service,
    task: "writer",
    messages: writerMessages,
    temperature: 0.6,
    maxTokens: 4500,
  });
  const writerResult = {
    object: {
      title: writerOutput.title,
      draft: writerOutput.draft,
      notes: writerOutput.notes,
    } satisfies WriterResult,
  };

  args.logStage("chapter", `llm: review_missing_resource chapter=${args.chapterNumber}`);
  const missingReviewMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    storyMemories: args.base.storyMemories,
    resourceCandidates: specializedReviewerViews.resourceCandidates,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_missing_resource`,
    messages: missingReviewMessages,
  });
  const missingResourceReview = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_missing_resource",
    messages: missingReviewMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_fact chapter=${args.chapterNumber}`);
  const factReviewMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
    relationshipCandidates: specializedReviewerViews.relationshipCandidates,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_fact`,
    messages: factReviewMessages,
  });
  const factConsistencyReview = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_fact",
    messages: factReviewMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_commercial chapter=${args.chapterNumber}`);
  const commercialReviewMessages = buildCommercialReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_commercial`,
    messages: commercialReviewMessages,
  });
  const commercialReview = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_commercial",
    messages: commercialReviewMessages,
    schema: commercialReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  args.logStage("chapter", `llm: review_role_drive chapter=${args.chapterNumber}`);
  const previousChapterDecisionLog =
    args.chapterNumber > 1
      ? await readJsonArtifact<DecisionLogArtifact>(
          chapterDecisionLogPath(args.projectId, args.chapterNumber - 1),
        )
      : null;
  const previousChapterRoleSnapshot = previousChapterDecisionLog
    ? {
        chapterNumber: previousChapterDecisionLog.chapterNumber,
        decisionPressure: previousChapterDecisionLog.decisionPressure,
        likelyChoice: previousChapterDecisionLog.likelyChoice,
        immediateConsequence: previousChapterDecisionLog.immediateConsequence,
        relationshipShift: previousChapterDecisionLog.relationshipShift,
      }
    : undefined;
  const roleDrivenReviewMessages = buildRoleDrivenReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    previousChapter: previousChapterRoleSnapshot,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_role_drive`,
    messages: roleDrivenReviewMessages,
  });
  const roleDrivenReview = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_role_drive",
    messages: roleDrivenReviewMessages,
    schema: roleDrivenReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  const initialNormalized = args.normalizeReviewerResults({
    missing: missingResourceReview.object as MissingResourceReviewerResult,
    fact: factConsistencyReview.object as FactConsistencyReviewerResult,
  });
  const initialMissing = initialNormalized.missing;
  const initialFact = initialNormalized.fact;
  const initialCommercial = args.normalizeCommercialReviewerResult(
    commercialReview.object as CommercialReviewerResult,
  );
  const initialRoleDriven = args.normalizeRoleDrivenReviewerResult(
    roleDrivenReview.object as RoleDrivenReviewerResult,
  );
  const rewritePlan = args.buildRewritePlan({
    missing: initialMissing,
    fact: initialFact,
    commercial: initialCommercial,
    roleDriven: initialRoleDriven,
  });
  const originalDraft = writerResult.object.draft;
  const originalTitle = writerResult.object.title;
  let rewrittenDraft = writerResult.object.draft;
  let rewrittenTitle = writerResult.object.title;
  let activeMissing = initialMissing;
  let activeFact = initialFact;
  let activeCommercial = initialCommercial;
  let activeRoleDriven = initialRoleDriven;
  const shouldRewriteNow =
    shouldRewriteForConsistency(activeFact) || rewritePlan.mode !== "quality_boost";
  if (shouldRewriteNow) {
    const rewriteTemp = rewritePlan.mode === "repair_first" ? 0.35 : 0.5;
    args.logStage("chapter", `llm: rewriter chapter=${args.chapterNumber} mode=${rewritePlan.mode} pass=1`);
    const rewriterMessages = buildRewriterMessages({
      title: rewrittenTitle,
      draft: rewrittenDraft,
      mode: rewritePlan.mode,
      objective: rewritePlan.objective,
      missingResourceReview: activeMissing,
      factConsistencyReview: activeFact,
      commercialReview: activeCommercial,
      roleDrivenReview: activeRoleDriven,
    });
    await args.writePromptDebug({
      projectId: args.projectId,
      scope: "chapter",
      label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_rewriter_${rewritePlan.mode}`,
      messages: rewriterMessages,
    });
    const rewrittenOutput = await args.generateWriterLikeResult({
      service: args.service,
      task: "rewriter",
      messages: rewriterMessages,
      temperature: rewriteTemp,
      maxTokens: 4500,
      fallbackTitle: rewrittenTitle,
    });
    rewrittenDraft = rewrittenOutput.draft;
    rewrittenTitle = rewrittenOutput.title ?? rewrittenTitle;
  }

  args.logStage("chapter", `llm: review_missing_resource_final chapter=${args.chapterNumber} pass=1`);
  const missingFinalMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    resourceCandidates: specializedReviewerViews.resourceCandidates,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_missing_resource_final`,
    messages: missingFinalMessages,
  });
  const missingResourceReviewFinal = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_missing_resource",
    messages: missingFinalMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_fact_final chapter=${args.chapterNumber} pass=1`);
  const factFinalMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
    relationshipCandidates: specializedReviewerViews.relationshipCandidates,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_fact_final`,
    messages: factFinalMessages,
  });
  const factConsistencyReviewFinal = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_fact",
    messages: factFinalMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_commercial_final chapter=${args.chapterNumber} pass=1`);
  const commercialFinalMessages = buildCommercialReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_commercial_final`,
    messages: commercialFinalMessages,
  });
  const commercialReviewFinal = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_commercial",
    messages: commercialFinalMessages,
    schema: commercialReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  args.logStage("chapter", `llm: review_role_drive_final chapter=${args.chapterNumber} pass=1`);
  const roleDrivenFinalMessages = buildRoleDrivenReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    previousChapter: previousChapterRoleSnapshot,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_role_drive_final`,
    messages: roleDrivenFinalMessages,
  });
  const roleDrivenReviewFinal = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "review_role_drive",
    messages: roleDrivenFinalMessages,
    schema: roleDrivenReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  const normalizedFinal = args.normalizeReviewerResults({
    missing: missingResourceReviewFinal.object as MissingResourceReviewerResult,
    fact: factConsistencyReviewFinal.object as FactConsistencyReviewerResult,
  });
  activeMissing = normalizedFinal.missing;
  activeFact = normalizedFinal.fact;
  activeCommercial = args.normalizeCommercialReviewerResult(
    commercialReviewFinal.object as CommercialReviewerResult,
  );
  activeRoleDriven = args.normalizeRoleDrivenReviewerResult(
    roleDrivenReviewFinal.object as RoleDrivenReviewerResult,
  );

  if (
    rewritePlan.mode === "quality_boost" &&
    args.hasBlockingReviewerIssues({ missing: activeMissing, fact: activeFact })
  ) {
    rewrittenDraft = originalDraft;
    rewrittenTitle = originalTitle;
    activeMissing = initialMissing;
    activeFact = initialFact;
    activeCommercial = initialCommercial;
    activeRoleDriven = initialRoleDriven;
  }

  args.logStage("chapter", `llm: memory_updater chapter=${args.chapterNumber}`);
  const memoryMessages = buildMemoryUpdaterMessages({
    chapterNumber: args.chapterNumber,
    chapterPlan,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    activeCharacterIds: chapterPlan.requiredCharacters,
  });
  await args.writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_memory_updater`,
    messages: memoryMessages,
  });
  const memoryUpdate = await args.generateStructuredTaskWithRetry({
    service: args.service,
    task: "memory_updater",
    messages: memoryMessages,
    schema: memoryUpdaterResultSchema,
    temperature: 0.2,
    maxTokens: 2200,
  });
  const validatedMemoryUpdate = validateMemoryUpdaterResult({
    result: memoryUpdate.object as MemoryUpdaterResult,
    existingMemories: args.base.storyMemories,
    chapterPlan,
    activeCharacterIds: chapterPlan.requiredCharacters,
    draft: rewrittenDraft,
  });

  const updatedStoryMemories = applyMemoryUpdaterResult(
    args.base.storyMemories,
    validatedMemoryUpdate.sanitized,
    args.chapterNumber,
  );
  const updatedChapterPlans = args.upsertChapterPlan(args.base.chapterPlans, chapterPlan);

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
    roleDrivenReview: activeRoleDriven,
    memoryUpdate: validatedMemoryUpdate.sanitized,
    generatedAt: new Date().toISOString(),
  };
  const decisionLog = buildDecisionLogArtifact({
    chapterNumber: args.chapterNumber,
    chapterPlan,
    beatOutline: currentBeat,
    draft: rewrittenDraft,
    characterStates: args.base.characterStates,
    roleDrivenReview: activeRoleDriven,
    episodePacket,
    recentConsequences: args.recentConsequences,
  });
  const relationshipShift = buildRelationshipShiftArtifact({
    decisionLog,
    draft: rewrittenDraft,
  });
  const consequenceEdges = buildConsequenceEdgesArtifact({
    decisionLog,
  });

  const chineseCharCount = (rewrittenDraft.match(/[一-鿿]/gu) ?? []).length;
  const totalCharCount = Array.from(rewrittenDraft).length;
  const paragraphCount = rewrittenDraft
    .split(/\n\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
  const draftLengthWarning =
    chineseCharCount < 2500
      ? "below_target"
      : chineseCharCount > 6000
        ? "above_target"
        : "ok";
  args.logStage(
    "chapter",
    `draft length chapter=${args.chapterNumber} cn_chars=${chineseCharCount} chars=${totalCharCount} paragraphs=${paragraphCount} status=${draftLengthWarning}`,
  );

  args.logStage("chapter", `save artifacts chapter=${args.chapterNumber}`);
  await args.repository.saveChapterPlans(args.projectId, updatedChapterPlans);
  await args.repository.saveStoryMemories(args.projectId, updatedStoryMemories);
  await args.repository.saveChapterArtifact(args.projectId, artifact);
  await args.writeJsonArtifact(chapterMemoryValidationPath(args.projectId, args.chapterNumber), {
    chapterNumber: args.chapterNumber,
    generatedAt: new Date().toISOString(),
    warningCount: validatedMemoryUpdate.warnings.length,
    warningTypeCounts: {
      contradiction: validatedMemoryUpdate.warnings.filter((item) => item.type === "contradiction")
        .length,
      unsupported: validatedMemoryUpdate.warnings.filter((item) => item.type === "unsupported").length,
      overgeneralized: validatedMemoryUpdate.warnings.filter(
        (item) => item.type === "overgeneralized",
      ).length,
    },
    warnings: validatedMemoryUpdate.warnings,
    evidenceChecks: validatedMemoryUpdate.evidenceChecks,
    consistencyChecks: validatedMemoryUpdate.consistencyChecks,
    sanitizedMemoryUpdate: validatedMemoryUpdate.sanitized,
  });
  await args.writeJsonArtifact(
    chapterDecisionLogPath(args.projectId, args.chapterNumber),
    decisionLog,
  );
  await args.writeJsonArtifact(
    chapterRelationshipShiftPath(args.projectId, args.chapterNumber),
    relationshipShift,
  );
  await args.writeJsonArtifact(
    chapterConsequenceEdgesPath(args.projectId, args.chapterNumber),
    consequenceEdges,
  );
  await args.writeJsonArtifact(
    chapterEpisodePacketPath(args.projectId, args.chapterNumber),
    episodePacket,
  );
  await args.writeJsonArtifact(
    chapterEpisodeEvalPath(args.projectId, args.chapterNumber),
    episodeEval.report,
  );
  await args.writeJsonArtifact(
    chapterStatsPath(args.projectId, args.chapterNumber),
    {
      chapterNumber: args.chapterNumber,
      generatedAt: new Date().toISOString(),
      chineseCharCount,
      totalCharCount,
      paragraphCount,
      draftLengthStatus: draftLengthWarning,
      title: rewrittenTitle ?? null,
      chapterMode: episodePacket.chapterMode,
      payoffType: episodePacket.payoffType,
      primaryThreadId: episodePacket.primaryThreadId,
      agencyScore: episodeEval.report.agencyScore,
      missingResourceFindingCount: activeMissing.findings.length,
      factFindingCount: activeFact.findings.length,
      commercialFindingCount: activeCommercial.findings.length,
      roleDrivenFindingCount: activeRoleDriven.findings.length,
    },
  );
  await args.writeRetrievalDebugReport({
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
  await args.writeMemorySystemOutputs({
    projectId: args.projectId,
    storyMemories: updatedStoryMemories,
    characterStates: args.base.characterStates,
    chapterArtifacts: [...args.availableChapterArtifacts, artifact],
  });

  try {
    const update = await updateThreadsFromChapter({
      projectId: args.projectId,
      chapterNumber: args.chapterNumber,
    });
    args.logStage(
      "chapter",
      `threads updated chapter=${args.chapterNumber} touched=${update.threadsTouched} applied=${update.appliedDeltaCount} conflicts=${update.conflictCount}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    args.logStage("chapter", `WARN: threads update skipped chapter=${args.chapterNumber}: ${message}`);
  }

  args.logStage("chapter", `done chapter=${args.chapterNumber}`);
  return {
    artifact,
    updatedStoryMemories,
    updatedChapterPlans,
  };
}
