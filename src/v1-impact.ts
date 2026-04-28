import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  applyOutlinePatchSuggestions,
  buildOutlinePatchSuggestions,
  buildDelayedConsequenceStatuses,
  buildUnresolvedDelayedConsequenceList,
  type AppliedOutlinePatchChange,
  type ConsequenceEdgeArtifact,
  type DelayedConsequenceStatus,
  type DecisionLogArtifact,
  type OutlinePatchApplyFilters,
  type OutlinePatchSuggestion,
  type RelationshipShiftArtifact,
  type SkippedOutlinePatchSuggestion,
} from "./v1-role-drive.js";
import {
  changeImpactReportPath,
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterRelationshipShiftPath,
  consequenceInspectionReportPath,
  outlinePatchApplyReportPath,
  outlinePatchSuggestionsPath,
  roleDrivenEvalReportPath,
  rewritePlanReportPath,
} from "./v1-paths.js";

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
  delayedConsequenceStatuses: DelayedConsequenceStatus[];
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
  sourceDelayedConsequenceStatus: DelayedConsequenceStatus | null;
  suggestions: OutlinePatchSuggestion[];
}

export interface OutlinePatchSuggestionRunResult {
  projectId: string;
  fromChapter: number;
  reportPath: string;
  report: OutlinePatchSuggestionReport;
}

export interface OutlinePatchApplyReport {
  fromChapter: number;
  generatedAt: string;
  suggestionReportPath: string;
  applied: AppliedOutlinePatchChange[];
  skipped: SkippedOutlinePatchSuggestion[];
  approver: string;
  note: string | null;
  filters: Required<OutlinePatchApplyFilters>;
}

export interface OutlinePatchApplyRunResult {
  projectId: string;
  fromChapter: number;
  suggestionReportPath: string;
  applyReportPath: string;
  beatOutlinesPath: string;
  report: OutlinePatchApplyReport;
}

export type RoleDrivenEvalCaseType =
  | "decision_log_complete"
  | "consequence_edges_present"
  | "planner_carryover_present";

export interface RoleDrivenEvalCaseResult {
  caseId: string;
  chapterNumber: number;
  caseType: RoleDrivenEvalCaseType;
  label: string;
  passed: boolean;
  evidence: string[];
}

export interface RoleDrivenEvalChapterSummary {
  chapterNumber: number;
  totalCases: number;
  passedCases: number;
  failedCaseIds: string[];
}

export interface RoleDrivenEvalCaseTypeSummary {
  caseType: RoleDrivenEvalCaseType;
  totalCases: number;
  passedCases: number;
  failedCases: number;
}

export interface RoleDrivenEvalReport {
  projectId: string;
  generatedAt: string;
  totalCases: number;
  passedCases: number;
  caseResults: RoleDrivenEvalCaseResult[];
  chapterSummaries: RoleDrivenEvalChapterSummary[];
  caseTypeSummaries: RoleDrivenEvalCaseTypeSummary[];
}

export interface RoleDrivenEvalRegressionSummary {
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

export interface RoleDrivenEvalRunResult {
  projectId: string;
  reportPath: string;
  report: RoleDrivenEvalReport;
  regression?: RoleDrivenEvalRegressionSummary;
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

function compareRoleDrivenEvalReports(
  previousReport: RoleDrivenEvalReport | null,
  currentReport: RoleDrivenEvalReport,
): RoleDrivenEvalRegressionSummary | undefined {
  if (!previousReport) {
    return undefined;
  }

  const previousChapterMap = new Map(
    previousReport.chapterSummaries.map((item) => [item.chapterNumber, item]),
  );
  const regressedChapters: RoleDrivenEvalRegressionSummary["regressedChapters"] = [];
  const improvedChapters: RoleDrivenEvalRegressionSummary["improvedChapters"] = [];

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

function summarizeRoleDrivenEvalCases(args: {
  projectId: string;
  cases: RoleDrivenEvalCaseResult[];
}): RoleDrivenEvalReport {
  const chapterMap = new Map<number, RoleDrivenEvalChapterSummary>();
  const typeMap = new Map<RoleDrivenEvalCaseType, RoleDrivenEvalCaseTypeSummary>();

  for (const item of args.cases) {
    const chapterSummary =
      chapterMap.get(item.chapterNumber) ?? {
        chapterNumber: item.chapterNumber,
        totalCases: 0,
        passedCases: 0,
        failedCaseIds: [],
      };
    chapterSummary.totalCases += 1;
    if (item.passed) {
      chapterSummary.passedCases += 1;
    } else {
      chapterSummary.failedCaseIds.push(item.caseId);
    }
    chapterMap.set(item.chapterNumber, chapterSummary);

    const typeSummary =
      typeMap.get(item.caseType) ?? {
        caseType: item.caseType,
        totalCases: 0,
        passedCases: 0,
        failedCases: 0,
      };
    typeSummary.totalCases += 1;
    if (item.passed) {
      typeSummary.passedCases += 1;
    } else {
      typeSummary.failedCases += 1;
    }
    typeMap.set(item.caseType, typeSummary);
  }

  return {
    projectId: args.projectId,
    generatedAt: new Date().toISOString(),
    totalCases: args.cases.length,
    passedCases: args.cases.filter((item) => item.passed).length,
    caseResults: args.cases,
    chapterSummaries: [...chapterMap.values()].sort((left, right) => left.chapterNumber - right.chapterNumber),
    caseTypeSummaries: [...typeMap.values()].sort((left, right) =>
      left.caseType.localeCompare(right.caseType),
    ),
  };
}

function includesAnyNeedle(texts: string[], needles: string[]): boolean {
  const haystack = texts.join(" ").toLowerCase();
  return needles.some((needle) => needle && haystack.includes(needle.toLowerCase()));
}

export function buildRoleDrivenEvalReport(args: {
  projectId: string;
  chapters: Array<{
    chapterNumber: number;
    plan: ChapterPlan;
    decisionLog: DecisionLogArtifact | null;
    consequenceEdges: ConsequenceEdgeArtifact | null;
  }>;
}): RoleDrivenEvalReport {
  const decisionLogs = args.chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    decisionLog: chapter.decisionLog,
  }));
  const cases: RoleDrivenEvalCaseResult[] = [];

  for (const chapter of args.chapters) {
    const log = chapter.decisionLog;
    const hasCompleteDecisionLog = Boolean(
      log?.beatId &&
        log.decisionPressure?.trim() &&
        log.likelyChoice?.trim() &&
        (log.immediateConsequence?.trim() || log.delayedConsequence?.trim()),
    );
    cases.push({
      caseId: `role-eval-ch${String(chapter.chapterNumber).padStart(3, "0")}-decision-log`,
      chapterNumber: chapter.chapterNumber,
      caseType: "decision_log_complete",
      label: `Chapter ${chapter.chapterNumber} has chooser/pressure/choice/consequence metadata`,
      passed: hasCompleteDecisionLog,
      evidence: [
        log?.decisionPressure ? `pressure=${log.decisionPressure}` : "",
        log?.likelyChoice ? `choice=${log.likelyChoice}` : "",
        log?.immediateConsequence ? `immediate=${log.immediateConsequence}` : "",
        log?.delayedConsequence ? `delayed=${log.delayedConsequence}` : "",
      ].filter(Boolean),
    });

    if (log?.relationshipShift || log?.delayedConsequence) {
      cases.push({
        caseId: `role-eval-ch${String(chapter.chapterNumber).padStart(3, "0")}-edges`,
        chapterNumber: chapter.chapterNumber,
        caseType: "consequence_edges_present",
        label: `Chapter ${chapter.chapterNumber} has consequence edges for delayed/relationship fallout`,
        passed: Boolean(chapter.consequenceEdges?.edges.length),
        evidence: (chapter.consequenceEdges?.edges ?? [])
          .map((edge) => `${edge.label}: ${edge.detail}`)
          .slice(0, 4),
      });
    }

    if (chapter.chapterNumber > 1) {
      const priorUnresolved = buildUnresolvedDelayedConsequenceList({
        decisionLogs,
        fromChapterNumber: chapter.chapterNumber - 1,
      });
      if (priorUnresolved.length > 0) {
        const planTexts = [
          chapter.plan.chapterGoal,
          chapter.plan.plannedOutcome,
          ...(chapter.plan.mustHitConflicts ?? []),
          ...(chapter.plan.disallowedMoves ?? []),
          ...(chapter.plan.styleReminders ?? []),
        ];
        const passed =
          includesAnyNeedle(planTexts, ["Active delayed consequence"]) ||
          includesAnyNeedle(planTexts, priorUnresolved);
        cases.push({
          caseId: `role-eval-ch${String(chapter.chapterNumber).padStart(3, "0")}-carryover`,
          chapterNumber: chapter.chapterNumber,
          caseType: "planner_carryover_present",
          label: `Chapter ${chapter.chapterNumber} planner carries active delayed consequences`,
          passed,
          evidence: priorUnresolved.slice(0, 3),
        });
      }
    }
  }

  return summarizeRoleDrivenEvalCases({
    projectId: args.projectId,
    cases,
  });
}

export async function runRoleDrivenEval(args: {
  projectId: string;
}): Promise<RoleDrivenEvalRunResult> {
  const repository = new FileProjectRepository();
  const chapterArtifacts = await loadAllChapterArtifacts(repository, args.projectId);
  const chapters = await Promise.all(
    chapterArtifacts.map(async (artifact) => {
      const roleDriven = await loadRoleDrivenArtifacts({
        projectId: args.projectId,
        chapterNumber: artifact.chapterNumber,
      });
      return {
        chapterNumber: artifact.chapterNumber,
        plan: artifact.plan,
        decisionLog: roleDriven.decisionLog,
        consequenceEdges: roleDriven.consequenceEdges,
      };
    }),
  );
  const reportPath = roleDrivenEvalReportPath(args.projectId);
  const previousReport = await readJsonArtifact<RoleDrivenEvalReport>(reportPath);
  const report = buildRoleDrivenEvalReport({
    projectId: args.projectId,
    chapters,
  });
  await writeJsonArtifact(reportPath, report);

  return {
    projectId: args.projectId,
    reportPath,
    report,
    regression: compareRoleDrivenEvalReports(previousReport, report),
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
    delayedConsequenceStatuses: buildDelayedConsequenceStatuses({
      decisionLogs: decisionLogRecords.map((item) => ({
        chapterNumber: item.chapterNumber,
        decisionLog: item.roleDriven.decisionLog,
      })),
      fromChapterNumber: args.chapterNumber,
    }),
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
  const [beatOutlines, chapterArtifacts, roleDrivenArtifacts] = await Promise.all([
    repository.loadBeatOutlines(args.projectId),
    loadAllChapterArtifacts(repository, args.projectId),
    loadRoleDrivenArtifacts({
      projectId: args.projectId,
      chapterNumber: args.fromChapter,
    }),
  ]);
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
  const delayedConsequenceStatuses = buildDelayedConsequenceStatuses({
    decisionLogs: decisionLogRecords.map((item) => ({
      chapterNumber: item.chapterNumber,
      decisionLog: item.roleDriven.decisionLog,
    })),
    fromChapterNumber: Math.max(args.fromChapter, ...chapterArtifacts.map((item) => item.chapterNumber)),
  });
  const sourceDelayedConsequenceStatus =
    delayedConsequenceStatuses.find((item) => item.sourceChapterNumber === args.fromChapter) ?? null;

  const report: OutlinePatchSuggestionReport = {
    fromChapter: args.fromChapter,
    generatedAt: new Date().toISOString(),
    sourceDecisionLog: roleDrivenArtifacts.decisionLog,
    sourceRelationshipShift: roleDrivenArtifacts.relationshipShift,
    sourceConsequenceEdges: roleDrivenArtifacts.consequenceEdges,
    sourceDelayedConsequenceStatus,
    suggestions: buildOutlinePatchSuggestions({
      fromChapter: args.fromChapter,
      beatOutlines,
      sourceDecisionLog: roleDrivenArtifacts.decisionLog,
      sourceDelayedConsequenceStatus,
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

export async function applyOutlinePatches(args: {
  projectId: string;
  fromChapter: number;
  approver?: string;
  note?: string;
  filters?: OutlinePatchApplyFilters;
}): Promise<OutlinePatchApplyRunResult> {
  const repository = new FileProjectRepository();
  const suggestionReportPath = outlinePatchSuggestionsPath(args.projectId, args.fromChapter);
  const suggestionReport = await readJsonArtifact<OutlinePatchSuggestionReport>(suggestionReportPath);
  if (!suggestionReport) {
    throw new Error(
      `Outline patch suggestions not found. Run: ./run-v1.sh outline suggest-patches --project ${args.projectId} --from-chapter ${args.fromChapter}`,
    );
  }

  const beatOutlines = await repository.loadBeatOutlines(args.projectId);
  const applyResult = applyOutlinePatchSuggestions({
    beatOutlines,
    suggestions: suggestionReport.suggestions,
    filters: args.filters,
  });

  if (applyResult.applied.length > 0) {
    await repository.saveBeatOutlines(args.projectId, applyResult.beatOutlines);
  }

  const report: OutlinePatchApplyReport = {
    fromChapter: args.fromChapter,
    generatedAt: new Date().toISOString(),
    suggestionReportPath,
    applied: applyResult.applied,
    skipped: applyResult.skipped,
    approver: args.approver ?? "manual",
    note: args.note?.trim() || null,
    filters: {
      onlyBeatIds: args.filters?.onlyBeatIds ?? [],
      skipBeatIds: args.filters?.skipBeatIds ?? [],
      onlySuggestionTypes: args.filters?.onlySuggestionTypes ?? [],
      skipSuggestionTypes: args.filters?.skipSuggestionTypes ?? [],
    },
  };
  const applyReportPath = outlinePatchApplyReportPath(args.projectId, args.fromChapter);
  await writeJsonArtifact(applyReportPath, report);

  return {
    projectId: args.projectId,
    fromChapter: args.fromChapter,
    suggestionReportPath,
    applyReportPath,
    beatOutlinesPath: path.resolve(
      process.cwd(),
      "data",
      "projects",
      args.projectId,
      "beat-outlines.json",
    ),
    report,
  };
}
