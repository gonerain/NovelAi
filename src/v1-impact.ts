import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildChangeImpactReport,
  type ArcOutline,
  type BeatOutline,
  type ChapterArtifact,
  type ChangeImpactReport,
  type ChapterPlan,
  type CharacterState,
  type StoryMemory,
} from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  buildOutlinePatchSuggestions,
  buildUnresolvedDelayedConsequenceList,
  type ConsequenceEdgeArtifact,
  type DecisionLogArtifact,
  type OutlinePatchSuggestion,
  type RelationshipShiftArtifact,
} from "./v1-role-drive.js";
import {
  changeImpactReportPath,
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterRelationshipShiftPath,
  consequenceInspectionReportPath,
  outlinePatchSuggestionsPath,
  rewritePlanReportPath,
} from "./v1-paths.js";

async function writeJsonArtifact(filepath: string, data: unknown): Promise<void> {
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

function uniqueSortedNumbers(items: number[]): number[] {
  return [...new Set(items)].sort((left, right) => left - right);
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

async function loadRoleDrivenArtifacts(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<{
  decisionLog: DecisionLogArtifact | null;
  relationshipShift: RelationshipShiftArtifact | null;
  consequenceEdges: ConsequenceEdgeArtifact | null;
}> {
  const [decisionLog, relationshipShift, consequenceEdges] = await Promise.all([
    readJsonArtifact<DecisionLogArtifact>(
      chapterDecisionLogPath(args.projectId, args.chapterNumber),
    ),
    readJsonArtifact<RelationshipShiftArtifact>(
      chapterRelationshipShiftPath(args.projectId, args.chapterNumber),
    ),
    readJsonArtifact<ConsequenceEdgeArtifact>(
      chapterConsequenceEdgesPath(args.projectId, args.chapterNumber),
    ),
  ]);

  return {
    decisionLog,
    relationshipShift,
    consequenceEdges,
  };
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

export interface ConsequenceInspectionReport {
  chapterNumber: number;
  decisionLog: DecisionLogArtifact | null;
  relationshipShift: RelationshipShiftArtifact | null;
  consequenceEdges: ConsequenceEdgeArtifact | null;
  unresolvedDelayedConsequences: string[];
}

export interface ConsequenceInspectionRunResult {
  projectId: string;
  chapterNumber: number;
  reportPath: string;
  report: ConsequenceInspectionReport;
}

export interface OutlinePatchSuggestionReport {
  fromChapter: number;
  generatedAt: string;
  sourceDecisionLog: DecisionLogArtifact | null;
  sourceRelationshipShift: RelationshipShiftArtifact | null;
  sourceConsequenceEdges: ConsequenceEdgeArtifact | null;
  suggestions: OutlinePatchSuggestion[];
}

export interface OutlinePatchSuggestionRunResult {
  projectId: string;
  fromChapter: number;
  reportPath: string;
  report: OutlinePatchSuggestionReport;
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

export async function inspectConsequences(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<ConsequenceInspectionRunResult> {
  const repository = new FileProjectRepository();
  const chapterArtifacts = await loadAllChapterArtifacts(repository, args.projectId);
  const decisionLogRecords = await Promise.all(
    uniqueSortedNumbers(chapterArtifacts.map((artifact) => artifact.chapterNumber)).map(
      async (chapterNumber) => ({
        chapterNumber,
        roleDriven: await loadRoleDrivenArtifacts({
          projectId: args.projectId,
          chapterNumber,
        }),
      }),
    ),
  );
  const roleDrivenArtifacts = await loadRoleDrivenArtifacts(args);
  const report: ConsequenceInspectionReport = {
    chapterNumber: args.chapterNumber,
    decisionLog: roleDrivenArtifacts.decisionLog,
    relationshipShift: roleDrivenArtifacts.relationshipShift,
    consequenceEdges: roleDrivenArtifacts.consequenceEdges,
    unresolvedDelayedConsequences: buildUnresolvedDelayedConsequenceList({
      decisionLogs: decisionLogRecords.map((item) => ({
        chapterNumber: item.chapterNumber,
        decisionLog: item.roleDriven.decisionLog,
      })),
      fromChapterNumber: args.chapterNumber,
    }),
  };
  const reportPath = consequenceInspectionReportPath(args.projectId, args.chapterNumber);
  await writeJsonArtifact(reportPath, report);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    reportPath,
    report,
  };
}

export async function suggestOutlinePatches(args: {
  projectId: string;
  fromChapter: number;
}): Promise<OutlinePatchSuggestionRunResult> {
  const repository = new FileProjectRepository();
  const [beatOutlines, roleDrivenArtifacts] = await Promise.all([
    repository.loadBeatOutlines(args.projectId),
    loadRoleDrivenArtifacts({
      projectId: args.projectId,
      chapterNumber: args.fromChapter,
    }),
  ]);

  const report: OutlinePatchSuggestionReport = {
    fromChapter: args.fromChapter,
    generatedAt: new Date().toISOString(),
    sourceDecisionLog: roleDrivenArtifacts.decisionLog,
    sourceRelationshipShift: roleDrivenArtifacts.relationshipShift,
    sourceConsequenceEdges: roleDrivenArtifacts.consequenceEdges,
    suggestions: buildOutlinePatchSuggestions({
      fromChapter: args.fromChapter,
      beatOutlines,
      sourceDecisionLog: roleDrivenArtifacts.decisionLog,
    }),
  };
  const reportPath = outlinePatchSuggestionsPath(args.projectId, args.fromChapter);
  await writeJsonArtifact(reportPath, report);

  return {
    projectId: args.projectId,
    fromChapter: args.fromChapter,
    reportPath,
    report,
  };
}
