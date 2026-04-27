import {
  buildRetrievalEvalChapterViews,
  buildRetrievalEvalSeed,
  evaluateRetrievalCases,
  normalizeRetrievalEvalSetAgainstChapterViews,
  type ChapterArtifact,
  type RetrievalEvalReport,
  type RetrievalEvalSet,
  type SemanticRetrievalHit,
  type StoryMemory,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  retrievalEvalReportPath,
  retrievalEvalSetPath,
} from "./v1-paths.js";
import type {
  ProjectBaseState,
  RetrievalEvalRegressionSummary,
  RetrievalEvalRunResult,
  RetrievalEvalSeedResult,
  V1RunOptions,
  V1RunResult,
} from "./v1-lib.js";

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

export async function seedRetrievalEvalSet(args: {
  projectId: string;
  repository: FileProjectRepository;
  loadEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  saveEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  loadAllChapterArtifacts: (
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ChapterArtifact[]>;
  loadSeedStoryMemories: (
    repository: FileProjectRepository,
    projectId: string,
    currentMemories: StoryMemory[],
  ) => Promise<StoryMemory[]>;
  resolveSemanticOverrideHits: (args: {
    chapterPlan: ChapterArtifact["plan"];
    storyMemories: StoryMemory[];
    chapterArtifacts: ChapterArtifact[];
  }) => Promise<SemanticRetrievalHit[] | undefined>;
  writeJsonArtifact: (filepath: string, data: unknown) => Promise<void>;
}): Promise<RetrievalEvalSeedResult> {
  await args.loadEmbeddingCacheForProject(args.projectId);
  const [characterStates, currentMemories, chapterArtifacts] = await Promise.all([
    args.repository.loadCharacterStates(args.projectId),
    args.repository.loadStoryMemories(args.projectId),
    args.loadAllChapterArtifacts(args.repository, args.projectId),
  ]);
  const seedStoryMemories = await args.loadSeedStoryMemories(
    args.repository,
    args.projectId,
    currentMemories,
  );
  const chapterViews = await buildRetrievalEvalChapterViews({
    chapterArtifacts,
    characterStates,
    seedStoryMemories,
    resolveSemanticHits: async (input) =>
      args.resolveSemanticOverrideHits({
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
  await args.writeJsonArtifact(evalSetPath, evalSet);
  await args.saveEmbeddingCacheForProject(args.projectId);

  return {
    projectId: args.projectId,
    evalSetPath,
    totalCases: evalSet.cases.length,
  };
}

export async function runRetrievalEval(args: {
  projectId: string;
  repository: FileProjectRepository;
  loadEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  saveEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  loadAllChapterArtifacts: (
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ChapterArtifact[]>;
  loadSeedStoryMemories: (
    repository: FileProjectRepository,
    projectId: string,
    currentMemories: StoryMemory[],
  ) => Promise<StoryMemory[]>;
  resolveSemanticOverrideHits: (args: {
    chapterPlan: ChapterArtifact["plan"];
    storyMemories: StoryMemory[];
    chapterArtifacts: ChapterArtifact[];
  }) => Promise<SemanticRetrievalHit[] | undefined>;
  writeMemorySystemOutputs: (args: {
    projectId: string;
    storyMemories: StoryMemory[];
    characterStates: ProjectBaseState["characterStates"];
    chapterArtifacts: ChapterArtifact[];
  }) => Promise<void>;
  writeJsonArtifact: (filepath: string, data: unknown) => Promise<void>;
  readJsonArtifact: <T>(filepath: string) => Promise<T | null>;
}): Promise<RetrievalEvalRunResult> {
  await args.loadEmbeddingCacheForProject(args.projectId);
  const [characterStates, currentMemories, chapterArtifacts] = await Promise.all([
    args.repository.loadCharacterStates(args.projectId),
    args.repository.loadStoryMemories(args.projectId),
    args.loadAllChapterArtifacts(args.repository, args.projectId),
  ]);

  const seedStoryMemories = await args.loadSeedStoryMemories(
    args.repository,
    args.projectId,
    currentMemories,
  );
  await args.writeMemorySystemOutputs({
    projectId: args.projectId,
    storyMemories: currentMemories,
    characterStates,
    chapterArtifacts,
  });
  const evalSetPath = retrievalEvalSetPath(args.projectId);
  const reportPath = retrievalEvalReportPath(args.projectId);
  const previousReport = await args.readJsonArtifact<RetrievalEvalReport>(reportPath);
  let evalSet = await args.readJsonArtifact<RetrievalEvalSet>(evalSetPath);

  if (!evalSet) {
    evalSet = buildRetrievalEvalSeed({
      projectId: args.projectId,
      chapterArtifacts,
    });
  }

  const chapterViews = await buildRetrievalEvalChapterViews({
    chapterArtifacts,
    characterStates,
    seedStoryMemories,
    resolveSemanticHits: async (input) =>
      args.resolveSemanticOverrideHits({
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
  await args.writeJsonArtifact(evalSetPath, evalSet);
  const report = evaluateRetrievalCases({
    projectId: args.projectId,
    evalSet,
    chapterViews,
  });
  await args.writeJsonArtifact(reportPath, report);
  await args.saveEmbeddingCacheForProject(args.projectId);

  return {
    projectId: args.projectId,
    evalSetPath,
    reportPath,
    report,
    regression: compareRetrievalEvalReports(previousReport, report),
  };
}

export async function runV1(args: {
  options: V1RunOptions;
  serviceFactory: () => LlmService;
  repository: FileProjectRepository;
  loadEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  saveEmbeddingCacheForProject: (projectId: string) => Promise<void>;
  ensureBootstrappedProject: (
    service: LlmService,
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ProjectBaseState & { validationIssues: string[] }>;
  runRetrievalEval: (args: { projectId: string }) => Promise<RetrievalEvalRunResult>;
  generateChapterArtifact: (args: {
    service: LlmService;
    base: ProjectBaseState;
    repository: FileProjectRepository;
    projectId: string;
    chapterNumber: number;
    currentSituation: string;
    recentConsequences: string[];
    availableChapterArtifacts: ChapterArtifact[];
  }) => Promise<{
    artifact: ChapterArtifact;
    updatedStoryMemories: StoryMemory[];
    updatedChapterPlans: ProjectBaseState["chapterPlans"];
  }>;
  buildRecentConsequences: (
    artifact: ChapterArtifact | null,
    currentArcGoal: string,
  ) => string[];
  logStage: (stage: string, detail: string) => void;
}): Promise<V1RunResult> {
  const { options } = args;
  args.logStage("run", `start mode=${options.mode} project=${options.projectId}`);
  const service = args.serviceFactory();
  await args.loadEmbeddingCacheForProject(options.projectId);
  const targetChapter = parseTargetChapter(options);

  const base = await args.ensureBootstrappedProject(service, args.repository, options.projectId);
  const existingArtifacts: ChapterArtifact[] = [];
  let maxExistingChapter = 0;
  for (let chapterNumber = 1; chapterNumber <= targetChapter; chapterNumber += 1) {
    const artifact = await args.repository.loadChapterArtifact(options.projectId, chapterNumber);
    if (!artifact) {
      break;
    }
    existingArtifacts.push(artifact);
    maxExistingChapter = chapterNumber;
  }

  if (maxExistingChapter >= targetChapter) {
    const retrievalEval = options.withEval
      ? await args.runRetrievalEval({ projectId: options.projectId })
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
  let recentConsequences = args.buildRecentConsequences(
    previousArtifact,
    base.storySetup.currentArcGoal,
  );

  for (let chapterNumber = maxExistingChapter + 1; chapterNumber <= targetChapter; chapterNumber += 1) {
    args.logStage("run", `generate chapter=${chapterNumber}/${targetChapter}`);
    const generation = await args.generateChapterArtifact({
      service,
      repository: args.repository,
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
    recentConsequences = args.buildRecentConsequences(
      generation.artifact,
      base.storySetup.currentArcGoal,
    );
  }

  args.logStage("run", "completed");
  const retrievalEval = options.withEval
    ? await args.runRetrievalEval({ projectId: options.projectId })
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
  await args.saveEmbeddingCacheForProject(options.projectId);
  return {
    projectId: options.projectId,
    targetChapter,
    generatedChapterNumbers: generatedArtifacts.map((artifact) => artifact.chapterNumber),
    artifacts: generatedArtifacts,
    validationIssues: base.validationIssues,
    retrievalEval,
  };
}
