import type {
  AgencyEvalReport,
  CommercialVarietySample,
  EpisodePacket,
  NarrativeThread,
  OffscreenEvalReport,
  StateDelta,
  StateDeltaEvalReport,
  StoryContract,
  ThreadEconomyReport,
  ThreadRankResult,
} from "./domain/index.js";
import {
  computeThreadEconomyReport,
  evaluateCommercialVariety,
  evaluateEpisodeAgency,
  evaluateOffscreenMoves,
  evaluateStateDeltas,
  rankNarrativeThreads,
} from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { readJsonArtifact, writeJsonArtifact } from "./v1-artifacts.js";
import {
  chapterEpisodePacketPath,
  chapterStateDeltasPath,
  runtimeEvalRegressionPath,
  runtimeEvalReportPath,
} from "./v1-paths.js";

export interface RuntimeEvalSection {
  name:
    | "thread_scheduler"
    | "thread_economy"
    | "episode_agency"
    | "state_deltas"
    | "offscreen_moves"
    | "commercial_variety";
  passed: boolean;
  errorCount: number;
  warningCount: number;
  notes: string[];
  details: unknown;
}

export interface RuntimeEvalReport {
  projectId: string;
  chapterNumber: number;
  generatedAt: string;
  sections: RuntimeEvalSection[];
  hardFailures: string[];
  softWarnings: string[];
  passed: boolean;
}

export interface RuntimeEvalRegression {
  previousGeneratedAt: string | null;
  previousPassed: boolean | null;
  currentPassed: boolean;
  newlyFailingSections: string[];
  newlyPassingSections: string[];
}

export interface RuntimeEvalRunResult {
  projectId: string;
  chapterNumber: number;
  reportPath: string;
  regressionPath: string;
  report: RuntimeEvalReport;
  regression: RuntimeEvalRegression;
  strict: boolean;
  blocked: boolean;
}

interface BuildSectionInput {
  threads: NarrativeThread[];
  contracts: StoryContract[];
  chapterNumber: number;
  projectId: string;
}

function rankSection(input: BuildSectionInput): RuntimeEvalSection {
  const ranked: ThreadRankResult[] = rankNarrativeThreads(input.threads, input.chapterNumber);
  const blocked = ranked.filter((item) =>
    item.warnings.includes("primary_selection_blocked_until_repaired"),
  );
  const eligible = ranked.filter(
    (item) => !item.warnings.includes("primary_selection_blocked_until_repaired"),
  );
  const errorCount = eligible.length === 0 && ranked.length > 0 ? 1 : 0;
  const notes: string[] = [];
  if (ranked.length === 0) {
    notes.push("No active threads found.");
  }
  if (eligible.length === 0 && ranked.length > 0) {
    notes.push("All eligible primary threads are blocked until repaired.");
  }

  return {
    name: "thread_scheduler",
    passed: errorCount === 0,
    errorCount,
    warningCount: blocked.length,
    notes,
    details: {
      eligibleCount: eligible.length,
      blockedCount: blocked.length,
      top: ranked.slice(0, 5).map((item) => ({
        threadId: item.thread.id,
        score: item.score,
        warnings: item.warnings,
      })),
    },
  };
}

function economySection(input: BuildSectionInput): {
  section: RuntimeEvalSection;
  report: ThreadEconomyReport;
} {
  const report = computeThreadEconomyReport({
    threads: input.threads,
    chapterNumber: input.chapterNumber,
  });
  const errorCount = report.warnings.filter((warning) => warning.severity === "error").length;
  const warningCount = report.warnings.filter((warning) => warning.severity === "warning").length;
  return {
    section: {
      name: "thread_economy",
      passed: errorCount === 0,
      errorCount,
      warningCount,
      notes:
        report.warnings.length === 0
          ? ["No span economy warnings."]
          : report.warnings.slice(0, 8).map((warning) => `${warning.code}: ${warning.message}`),
      details: report,
    },
    report,
  };
}

async function agencySection(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<RuntimeEvalSection> {
  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  const packet = await readJsonArtifact<EpisodePacket>(
    chapterEpisodePacketPath(args.projectId, args.chapterNumber),
  );
  if (!packet) {
    return {
      name: "episode_agency",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      notes: ["No episode packet found for chapter; agency eval skipped."],
      details: null,
    };
  }
  const owner = project?.characters.find((character) => character.id === packet.agencyOwnerId);
  const report: AgencyEvalReport = evaluateEpisodeAgency({ packet, agencyOwner: owner });
  const failed = report.checks.filter((check) => !check.passed);
  return {
    name: "episode_agency",
    passed: report.passed,
    errorCount: report.passed ? 0 : 1,
    warningCount: failed.length,
    notes: report.failureReasons.slice(0, 8),
    details: report,
  };
}

async function deltasSection(args: {
  projectId: string;
  chapterNumber: number;
  contracts: StoryContract[];
}): Promise<RuntimeEvalSection> {
  const deltas = await readJsonArtifact<StateDelta[]>(
    chapterStateDeltasPath(args.projectId, args.chapterNumber),
  );
  if (!deltas) {
    return {
      name: "state_deltas",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      notes: ["No state_deltas.json for chapter; section skipped."],
      details: null,
    };
  }
  const report: StateDeltaEvalReport = evaluateStateDeltas({
    chapterNumber: args.chapterNumber,
    deltas,
    contracts: args.contracts,
  });
  const errorCount = report.findings.filter((finding) => finding.severity === "error").length;
  const warningCount = report.findings.filter((finding) => finding.severity === "warning").length;
  return {
    name: "state_deltas",
    passed: report.passed,
    errorCount,
    warningCount,
    notes: report.findings.slice(0, 8).map((finding) => `${finding.code}: ${finding.message}`),
    details: report,
  };
}

async function commercialVarietySection(args: {
  projectId: string;
  chapterNumber: number;
  windowSize?: number;
}): Promise<RuntimeEvalSection> {
  const window = Math.max(1, args.windowSize ?? 5);
  const start = Math.max(1, args.chapterNumber - window + 1);
  const samples: CommercialVarietySample[] = [];
  for (let chapter = start; chapter <= args.chapterNumber; chapter += 1) {
    const packet = await readJsonArtifact<EpisodePacket>(
      chapterEpisodePacketPath(args.projectId, chapter),
    );
    if (!packet) {
      continue;
    }
    samples.push({
      chapterNumber: packet.chapterNumber,
      chapterMode: packet.chapterMode,
      payoffType: packet.payoffType,
      endHook: packet.endHook,
    });
  }
  if (samples.length === 0) {
    return {
      name: "commercial_variety",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      notes: ["No episode packets in window; commercial variety section skipped."],
      details: null,
    };
  }
  const report = evaluateCommercialVariety({ samples, windowSize: window });
  const errorCount = report.findings.filter((finding) => finding.severity === "error").length;
  const warningCount = report.findings.filter((finding) => finding.severity === "warning").length;
  return {
    name: "commercial_variety",
    passed: report.passed,
    errorCount,
    warningCount,
    notes: report.findings.slice(0, 6).map((finding) => `${finding.code}: ${finding.detail}`),
    details: report,
  };
}

async function offscreenSection(args: {
  projectId: string;
  chapterNumber: number;
  threads: NarrativeThread[];
}): Promise<RuntimeEvalSection> {
  const repository = new FileProjectRepository();
  const moves = await repository.loadOffscreenMoves(args.projectId);
  if (moves.length === 0) {
    return {
      name: "offscreen_moves",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      notes: ["No offscreen moves scheduled; section skipped."],
      details: null,
    };
  }
  const report: OffscreenEvalReport = evaluateOffscreenMoves({
    chapterNumber: args.chapterNumber,
    moves,
    threads: args.threads,
  });
  const errorCount = report.findings.filter((finding) => finding.severity === "error").length;
  const warningCount = report.findings.filter((finding) => finding.severity === "warning").length;
  return {
    name: "offscreen_moves",
    passed: report.passed,
    errorCount,
    warningCount,
    notes: report.findings.slice(0, 8).map((finding) => `${finding.code}: ${finding.message}`),
    details: report,
  };
}

export function compareRuntimeEvalReports(args: {
  previous: RuntimeEvalReport | null;
  current: RuntimeEvalReport;
}): RuntimeEvalRegression {
  return compareReports(args);
}

function compareReports(args: {
  previous: RuntimeEvalReport | null;
  current: RuntimeEvalReport;
}): RuntimeEvalRegression {
  const previous = args.previous;
  const previousFailing = new Set(previous?.hardFailures ?? []);
  const currentFailing = new Set(args.current.hardFailures);

  const newlyFailingSections = [...currentFailing].filter((name) => !previousFailing.has(name));
  const newlyPassingSections = [...previousFailing].filter((name) => !currentFailing.has(name));

  return {
    previousGeneratedAt: previous?.generatedAt ?? null,
    previousPassed: previous?.passed ?? null,
    currentPassed: args.current.passed,
    newlyFailingSections,
    newlyPassingSections,
  };
}

export async function runRuntimeEval(args: {
  projectId: string;
  chapterNumber?: number;
  strict?: boolean;
}): Promise<RuntimeEvalRunResult> {
  const repository = new FileProjectRepository();
  const [threads, contracts] = await Promise.all([
    repository.loadNarrativeThreads(args.projectId),
    repository.loadStoryContracts(args.projectId),
  ]);
  if (threads.length === 0) {
    throw new Error(
      `Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`,
    );
  }

  const chapterNumber = args.chapterNumber && args.chapterNumber >= 1 ? args.chapterNumber : Math.max(
    1,
    threads.reduce(
      (max, thread) => Math.max(max, thread.lastTouchedChapter, thread.introducedChapter),
      1,
    ),
  );

  const baseInput: BuildSectionInput = {
    threads,
    contracts,
    chapterNumber,
    projectId: args.projectId,
  };

  const sections: RuntimeEvalSection[] = [];
  sections.push(rankSection(baseInput));
  sections.push(economySection(baseInput).section);
  sections.push(await agencySection({ projectId: args.projectId, chapterNumber }));
  sections.push(
    await deltasSection({
      projectId: args.projectId,
      chapterNumber,
      contracts,
    }),
  );
  sections.push(
    await offscreenSection({
      projectId: args.projectId,
      chapterNumber,
      threads,
    }),
  );
  sections.push(
    await commercialVarietySection({
      projectId: args.projectId,
      chapterNumber,
    }),
  );

  const hardFailures = sections.filter((section) => !section.passed).map((section) => section.name);
  const softWarnings = sections.filter((section) => section.warningCount > 0).map((section) => section.name);
  const report: RuntimeEvalReport = {
    projectId: args.projectId,
    chapterNumber,
    generatedAt: new Date().toISOString(),
    sections,
    hardFailures,
    softWarnings,
    passed: hardFailures.length === 0,
  };

  const reportPath = runtimeEvalReportPath(args.projectId);
  const previousReport = await readJsonArtifact<RuntimeEvalReport>(reportPath);
  await writeJsonArtifact(reportPath, report);

  const regression = compareReports({ previous: previousReport, current: report });
  const regressionPath = runtimeEvalRegressionPath(args.projectId);
  await writeJsonArtifact(regressionPath, regression);

  const strict = Boolean(args.strict);
  const blocked = strict && !report.passed;

  return {
    projectId: args.projectId,
    chapterNumber,
    reportPath,
    regressionPath,
    report,
    regression,
    strict,
    blocked,
  };
}
