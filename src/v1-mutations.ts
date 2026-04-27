import { applyMemoryUpdaterResult, type ChapterArtifact, type StoryMemory } from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import type { RewritePlanReport } from "./v1-impact.js";
import type {
  InvalidateResult,
  InvalidateTargetRunResult,
  RegenerateFromTargetRunResult,
  RewriteChapterRunResult,
  V1RunResult,
} from "./v1-lib.js";

export async function invalidateFromChapter(args: {
  projectId: string;
  chapterNumber: number;
  repository: FileProjectRepository;
  loadSeedStoryMemories: (
    repository: FileProjectRepository,
    projectId: string,
    currentMemories: StoryMemory[],
  ) => Promise<StoryMemory[]>;
  loadAllChapterArtifacts: (
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ChapterArtifact[]>;
  rebuildMemorySystemOutputsForProject: (
    repository: FileProjectRepository,
    projectId: string,
    storyMemories?: StoryMemory[],
    characterStates?: Awaited<ReturnType<FileProjectRepository["loadCharacterStates"]>>,
  ) => Promise<void>;
}): Promise<InvalidateResult> {
  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const currentMemories = await args.repository.loadStoryMemories(args.projectId);
  const seedMemories = await args.loadSeedStoryMemories(args.repository, args.projectId, currentMemories);
  const allChapterNumbers = await args.repository.listChapterArtifactNumbers(args.projectId);
  const deletedChapterNumbers = allChapterNumbers.filter((number) => number >= args.chapterNumber);
  const keptChapterNumbers = allChapterNumbers.filter((number) => number < args.chapterNumber);

  let rebuiltMemories = seedMemories.map((memory) => ({
    ...memory,
    notes: [...memory.notes],
  }));

  for (const chapterNumber of keptChapterNumbers) {
    const artifact = await args.repository.loadChapterArtifact(args.projectId, chapterNumber);
    if (!artifact) {
      continue;
    }

    rebuiltMemories = applyMemoryUpdaterResult(
      rebuiltMemories,
      artifact.memoryUpdate,
      artifact.chapterNumber,
    );
  }

  const chapterPlans = await args.repository.loadChapterPlans(args.projectId);
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
        artifact: await args.repository.loadChapterArtifact(args.projectId, chapterNumber),
      })),
    )
  )
    .filter((item): item is { chapterNumber: number; artifact: ChapterArtifact } => Boolean(item.artifact))
    .map((item) => ({ chapterNumber: item.chapterNumber, artifact: item.artifact }));

  try {
    for (const chapterNumber of deletedChapterNumbers) {
      await args.repository.deleteChapterArtifact(args.projectId, chapterNumber);
    }

    await args.repository.saveChapterPlans(args.projectId, remainingPlans);
    await args.repository.saveStoryMemories(args.projectId, rebuiltMemories);
    await args.rebuildMemorySystemOutputsForProject(
      args.repository,
      args.projectId,
      rebuiltMemories,
    );
  } catch (error) {
    await args.repository.saveChapterPlans(args.projectId, previousPlans);
    await args.repository.saveStoryMemories(args.projectId, previousMemories);
    for (const item of deletedArtifactsBackup) {
      await args.repository.saveChapterArtifact(args.projectId, item.artifact);
    }
    await args.rebuildMemorySystemOutputsForProject(
      args.repository,
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

export async function invalidateFromTarget(args: {
  projectId: string;
  targetId: string;
  runRewritePlan: (args: {
    projectId: string;
    targetId: string;
  }) => Promise<{
    impactReportPath: string;
    rewritePlanPath: string;
    plan: RewritePlanReport;
  }>;
  invalidateFromChapter: (args: {
    projectId: string;
    chapterNumber: number;
  }) => Promise<InvalidateResult>;
}): Promise<InvalidateTargetRunResult> {
  const rewritePlan = await args.runRewritePlan(args);

  if (rewritePlan.plan.suggestedInvalidationChapter === null) {
    return {
      projectId: args.projectId,
      targetId: args.targetId,
      impactReportPath: rewritePlan.impactReportPath,
      rewritePlanPath: rewritePlan.rewritePlanPath,
      plan: rewritePlan.plan,
    };
  }

  const invalidation = await args.invalidateFromChapter({
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

export async function regenerateFromTarget(args: {
  projectId: string;
  targetId: string;
  count: number;
  withEval?: boolean;
  strictEval?: boolean;
  invalidateFromTarget: (args: {
    projectId: string;
    targetId: string;
  }) => Promise<InvalidateTargetRunResult>;
  runV1: (args: {
    projectId: string;
    mode: "first-n";
    count: number;
    withEval?: boolean;
    strictEval?: boolean;
  }) => Promise<V1RunResult>;
}): Promise<RegenerateFromTargetRunResult> {
  if (args.count < 1) {
    throw new Error("count must be >= 1");
  }

  const invalidationResult = await args.invalidateFromTarget({
    projectId: args.projectId,
    targetId: args.targetId,
  });

  if (!invalidationResult.invalidation) {
    return {
      projectId: args.projectId,
      targetId: args.targetId,
      requestedCount: args.count,
      impactReportPath: invalidationResult.impactReportPath,
      rewritePlanPath: invalidationResult.rewritePlanPath,
      plan: invalidationResult.plan,
      invalidation: invalidationResult.invalidation,
    };
  }

  const targetChapter = invalidationResult.invalidation.chapterNumber + args.count - 1;
  const generation = await args.runV1({
    projectId: args.projectId,
    mode: "first-n",
    count: targetChapter,
    withEval: args.withEval,
    strictEval: args.strictEval,
  });

  return {
    projectId: args.projectId,
    targetId: args.targetId,
    requestedCount: args.count,
    impactReportPath: invalidationResult.impactReportPath,
    rewritePlanPath: invalidationResult.rewritePlanPath,
    plan: invalidationResult.plan,
    invalidation: invalidationResult.invalidation,
    generation,
  };
}

export async function rewriteChapter(args: {
  projectId: string;
  chapterNumber: number;
  withEval?: boolean;
  strictEval?: boolean;
  repository: FileProjectRepository;
  invalidateFromChapter: (args: {
    projectId: string;
    chapterNumber: number;
  }) => Promise<InvalidateResult>;
  runV1: (args: {
    projectId: string;
    mode: "chapter";
    chapterNumber: number;
    withEval?: boolean;
    strictEval?: boolean;
  }) => Promise<V1RunResult>;
}): Promise<RewriteChapterRunResult> {
  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const existingArtifact = await args.repository.loadChapterArtifact(args.projectId, args.chapterNumber);
  if (!existingArtifact) {
    throw new Error(
      `chapter rewrite requires an existing chapter artifact: project=${args.projectId}, chapter=${args.chapterNumber}`,
    );
  }

  const invalidation = await args.invalidateFromChapter({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });
  const generation = await args.runV1({
    projectId: args.projectId,
    mode: "chapter",
    chapterNumber: args.chapterNumber,
    withEval: args.withEval,
    strictEval: args.strictEval,
  });

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    invalidation,
    generation,
  };
}
