import path from "node:path";
import { writeFile } from "node:fs/promises";

import {
  buildContextPack,
  buildSpecializedReviewerViews,
  pickArcForChapterDeterministic,
  pickBeatForChapterDeterministic,
  type ArcOutline,
  type BeatOutline,
  type ChapterArtifact,
  type CommercialReviewerResult,
  type FactConsistencyReviewerResult,
  type MissingResourceReviewerResult,
  type RoleDrivenReviewerResult,
  type SemanticRetrievalHit,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import type { ChatMessage } from "./llm/types.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  buildCommercialReviewMessages,
  buildFactConsistencyReviewMessages,
  buildMissingResourceReviewMessages,
  buildRewriterMessages,
  buildRoleDrivenReviewMessages,
  commercialReviewerResultSchema,
  factConsistencyReviewerResultSchema,
  missingResourceReviewerResultSchema,
  roleDrivenReviewerResultSchema,
} from "./prompts/index.js";
import {
  chapterDraftRewriteMetadataPath,
  chapterDraftRewritePath,
  chapterDraftRewriteVersionDraftPath,
  chapterDraftRewriteVersionMetadataPath,
} from "./v1-paths.js";
import type { ProjectBaseState, RetrievalEvalRunResult, RewriteDraftRunResult } from "./v1-lib.js";

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

export async function rewriteChapterDraft(args: {
  projectId: string;
  chapterNumber: number;
  withEval?: boolean;
  strictEval?: boolean;
  serviceFactory: () => LlmService;
  repository: FileProjectRepository;
  ensureBootstrappedProject: (
    service: LlmService,
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ProjectBaseState & { validationIssues: string[] }>;
  loadAllChapterArtifacts: (
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ChapterArtifact[]>;
  loadEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  saveEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  resolveSemanticOverrideHits: (args: {
    chapterPlan: ChapterArtifact["plan"];
    storyMemories: ProjectBaseState["storyMemories"];
    chapterArtifacts: ChapterArtifact[];
  }) => Promise<SemanticRetrievalHit[] | undefined>;
  buildUnresolvedDelayedConsequences: (args: {
    chapterArtifacts: ChapterArtifact[];
    beatOutlines: ProjectBaseState["beatOutlines"];
    currentChapterNumber: number;
  }) => string[];
  assertChapterPlanningAnchors: (args: {
    projectId: string;
    chapterNumber: number;
    beatOutlines: ProjectBaseState["beatOutlines"];
    currentArc: ArcOutline | undefined;
    currentBeat: BeatOutline | undefined;
  }) => void;
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
  writeJsonArtifact: (filepath: string, data: unknown) => Promise<void>;
  runRetrievalEval: (args: { projectId: string }) => Promise<RetrievalEvalRunResult>;
  logStage: (stage: string, detail: string) => void;
}): Promise<RewriteDraftRunResult> {
  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const service = args.serviceFactory();
  await args.loadEmbeddingCacheForProject(args.projectId);

  const existingArtifact = await args.repository.loadChapterArtifact(args.projectId, args.chapterNumber);
  if (!existingArtifact) {
    throw new Error(
      `chapter rewrite-draft requires an existing chapter artifact: project=${args.projectId}, chapter=${args.chapterNumber}`,
    );
  }

  const base = await args.ensureBootstrappedProject(service, args.repository, args.projectId);
  const allArtifacts = await args.loadAllChapterArtifacts(args.repository, args.projectId);
  const priorArtifacts = allArtifacts.filter((artifact) => artifact.chapterNumber < args.chapterNumber);
  const currentArc =
    base.arcOutlines.find((item) => item.id === existingArtifact.plan.arcId) ??
    pickArcForChapterDeterministic(base.arcOutlines, args.chapterNumber);
  const currentBeat =
    base.beatOutlines.find((item) => item.id === existingArtifact.plan.beatId) ??
    pickBeatForChapterDeterministic(base.beatOutlines, currentArc, args.chapterNumber);
  args.assertChapterPlanningAnchors({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    beatOutlines: base.beatOutlines,
    currentArc,
    currentBeat,
  });
  const unresolvedDelayedConsequences = args.buildUnresolvedDelayedConsequences({
    chapterArtifacts: priorArtifacts,
    beatOutlines: base.beatOutlines,
    currentChapterNumber: args.chapterNumber,
  });

  const semanticOverrideHits = await args.resolveSemanticOverrideHits({
    chapterPlan: existingArtifact.plan,
    storyMemories: base.storyMemories,
    chapterArtifacts: priorArtifacts,
  });
  const writerContextPack = buildContextPack({
    task: "writer",
    authorPack: base.authorPacks.writer,
    themeBible: base.themeBible,
    styleBible: base.styleBible,
    genrePayoffPack: base.genrePayoffPack,
    chapterPlan: existingArtifact.plan,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    chapterArtifacts: priorArtifacts,
    semanticOverrideHits,
    unresolvedDelayedConsequences,
    characterStates: base.characterStates,
    storyMemories: base.storyMemories,
    worldFacts: base.worldFacts,
  });
  const reviewerContextPack = buildContextPack({
    task: "reviewer",
    authorPack: base.authorPacks.reviewer,
    themeBible: base.themeBible,
    styleBible: base.styleBible,
    genrePayoffPack: base.genrePayoffPack,
    chapterPlan: existingArtifact.plan,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    chapterArtifacts: priorArtifacts,
    semanticOverrideHits,
    unresolvedDelayedConsequences,
    characterStates: base.characterStates,
    storyMemories: base.storyMemories,
    worldFacts: base.worldFacts,
  });
  const specializedReviewerViews = buildSpecializedReviewerViews({
    chapterPlan: existingArtifact.plan,
    storyMemories: base.storyMemories,
    characterStates: base.characterStates,
    chapterArtifacts: priorArtifacts,
  });

  args.logStage("chapter", `llm: review_missing_resource_draft chapter=${args.chapterNumber}`);
  const missingReviewMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: existingArtifact.writerResult.draft,
    storyMemories: base.storyMemories,
    resourceCandidates: specializedReviewerViews.resourceCandidates,
  });
  const missingResourceReview = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_missing_resource",
    messages: missingReviewMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_fact_draft chapter=${args.chapterNumber}`);
  const factReviewMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: existingArtifact.writerResult.draft,
    storyMemories: base.storyMemories,
    worldFacts: base.worldFacts,
    relationshipCandidates: specializedReviewerViews.relationshipCandidates,
  });
  const factConsistencyReview = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_fact",
    messages: factReviewMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_commercial_draft chapter=${args.chapterNumber}`);
  const commercialReviewMessages = buildCommercialReviewMessages({
    contextPack: reviewerContextPack,
    draft: existingArtifact.writerResult.draft,
  });
  const commercialReview = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_commercial",
    messages: commercialReviewMessages,
    schema: commercialReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  args.logStage("chapter", `llm: review_role_drive_draft chapter=${args.chapterNumber}`);
  const roleDrivenReviewMessages = buildRoleDrivenReviewMessages({
    contextPack: reviewerContextPack,
    draft: existingArtifact.writerResult.draft,
  });
  const roleDrivenReview = await args.generateStructuredTaskWithRetry({
    service,
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
  const draftRewritePlan = args.buildRewritePlan({
    missing: initialMissing,
    fact: initialFact,
    commercial: initialCommercial,
    roleDriven: initialRoleDriven,
  });
  const forcedObjective =
    draftRewritePlan.mode === "quality_boost"
      ? "Rewrite for readability, scene clarity, hook strength, and smoother paragraph flow while preserving all established facts, outcomes, and chapter role assignments."
      : draftRewritePlan.objective;

  args.logStage("chapter", `llm: rewrite_draft chapter=${args.chapterNumber} mode=${draftRewritePlan.mode}`);
  const rewriterMessages = buildRewriterMessages({
    title: existingArtifact.writerResult.title,
    draft: existingArtifact.writerResult.draft,
    mode: draftRewritePlan.mode,
    objective: forcedObjective,
    missingResourceReview: initialMissing,
    factConsistencyReview: initialFact,
    commercialReview: initialCommercial,
    roleDrivenReview: initialRoleDriven,
  });
  const rewrittenOutput = await args.generateWriterLikeResult({
    service,
    task: "rewriter",
    messages: rewriterMessages,
    temperature: draftRewritePlan.mode === "repair_first" ? 0.35 : 0.5,
    maxTokens: 4500,
    fallbackTitle: existingArtifact.writerResult.title,
  });

  args.logStage("chapter", `llm: review_missing_resource_draft_final chapter=${args.chapterNumber}`);
  const missingResourceReviewFinal = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_missing_resource",
    messages: buildMissingResourceReviewMessages({
      contextPack: reviewerContextPack,
      draft: rewrittenOutput.draft,
      storyMemories: base.storyMemories,
      resourceCandidates: specializedReviewerViews.resourceCandidates,
    }),
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_fact_draft_final chapter=${args.chapterNumber}`);
  const factConsistencyReviewFinal = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_fact",
    messages: buildFactConsistencyReviewMessages({
      contextPack: reviewerContextPack,
      draft: rewrittenOutput.draft,
      storyMemories: base.storyMemories,
      worldFacts: base.worldFacts,
      relationshipCandidates: specializedReviewerViews.relationshipCandidates,
    }),
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  args.logStage("chapter", `llm: review_commercial_draft_final chapter=${args.chapterNumber}`);
  const commercialReviewFinal = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_commercial",
    messages: buildCommercialReviewMessages({
      contextPack: reviewerContextPack,
      draft: rewrittenOutput.draft,
    }),
    schema: commercialReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  args.logStage("chapter", `llm: review_role_drive_draft_final chapter=${args.chapterNumber}`);
  const roleDrivenReviewFinal = await args.generateStructuredTaskWithRetry({
    service,
    task: "review_role_drive",
    messages: buildRoleDrivenReviewMessages({
      contextPack: reviewerContextPack,
      draft: rewrittenOutput.draft,
    }),
    schema: roleDrivenReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });

  const draftPath = chapterDraftRewritePath(args.projectId, args.chapterNumber);
  const metadataPath = chapterDraftRewriteMetadataPath(args.projectId, args.chapterNumber);
  const versionId = new Date().toISOString().replace(/[:.]/g, "-");
  const versionDraftPath = chapterDraftRewriteVersionDraftPath(
    args.projectId,
    args.chapterNumber,
    versionId,
  );
  const versionMetadataPath = chapterDraftRewriteVersionMetadataPath(
    args.projectId,
    args.chapterNumber,
    versionId,
  );
  const metadataPayload = {
    versionId,
    chapterNumber: args.chapterNumber,
    generatedAt: new Date().toISOString(),
    sourceResultPath: path.relative(
      process.cwd(),
      path.resolve(
        process.cwd(),
        "data",
        "projects",
        args.projectId,
        "chapters",
        `chapter-${String(args.chapterNumber).padStart(3, "0")}`,
        "result.json",
      ),
    ),
    mode: draftRewritePlan.mode,
    objective: forcedObjective,
    title: rewrittenOutput.title ?? existingArtifact.writerResult.title,
    contextSummary: {
      chapterGoal: existingArtifact.plan.chapterGoal,
      plannedOutcome: existingArtifact.plan.plannedOutcome,
      emotionalGoal: existingArtifact.plan.emotionalGoal,
    },
    initialReviews: {
      missingResource: initialMissing,
      factConsistency: initialFact,
      commercial: initialCommercial,
      roleDriven: initialRoleDriven,
    },
    finalReviews: {
      missingResource: missingResourceReviewFinal.object,
      factConsistency: factConsistencyReviewFinal.object,
      commercial: commercialReviewFinal.object,
      roleDriven: roleDrivenReviewFinal.object,
    },
  };
  await args.writeJsonArtifact(metadataPath, metadataPayload);
  await writeFile(draftPath, rewrittenOutput.draft, "utf-8");
  await args.writeJsonArtifact(versionMetadataPath, metadataPayload);
  await writeFile(versionDraftPath, rewrittenOutput.draft, "utf-8");
  await args.saveEmbeddingCacheForProject(args.projectId);

  const retrievalEval = args.withEval
    ? await args.runRetrievalEval({ projectId: args.projectId })
    : undefined;
  if (
    args.strictEval &&
    retrievalEval &&
    retrievalEval.report.passedCases < retrievalEval.report.totalCases
  ) {
    throw new Error(
      `Retrieval eval failed under --strict-eval: ${retrievalEval.report.passedCases}/${retrievalEval.report.totalCases} passed.`,
    );
  }

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    draftPath,
    metadataPath,
    versionId,
    versionDraftPath,
    versionMetadataPath,
    mode: draftRewritePlan.mode,
    title: rewrittenOutput.title ?? existingArtifact.writerResult.title,
    retrievalEval,
  };
}
