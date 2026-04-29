import type {
  ApplyDraftRewriteRunResult,
  InvalidateResult,
  InspectDraftRewriteRunResult,
  ListDraftRewriteVersionsRunResult,
  RetrievalEvalRunResult,
  RetrievalEvalSeedResult,
  RewriteDraftRunResult,
  V1RunResult,
} from "./v1-lib.js";
import type {
  ChangeImpactRunResult,
  ConsequenceInspectionRunResult,
  OutlinePatchApplyRunResult,
  OutlinePatchSuggestionRunResult,
  RoleDrivenEvalRunResult,
  RewritePlanRunResult,
} from "./v1-impact.js";
import type {
  InvalidateTargetRunResult,
  RegenerateFromTargetRunResult,
  RegenerateWithPatchesRunResult,
  RewriteChapterRunResult,
} from "./v1-lib.js";
import type {
  ThreadEconomyRunResult,
  ThreadEvalRunResult,
  ThreadInspectRunResult,
  ThreadRankRunResult,
  ThreadSeedRunResult,
  ThreadSuggestNextRunResult,
  ThreadUpdateRunResult,
} from "./v1-threads.js";
import type {
  EpisodeEvalRunResult,
  EpisodeInspectRunResult,
  EpisodePlanRunResult,
  EpisodeRevisePacketRunResult,
} from "./v1-episode.js";
import type { StateDeltaInspectRunResult } from "./v1-deltas.js";
import type {
  OffscreenApplyRunResult,
  OffscreenInspectRunResult,
  OffscreenScheduleRunResult,
} from "./v1-offscreen.js";
import type { RuntimeEvalRunResult } from "./v1-runtime-eval.js";
import type {
  TaskInspectRunResult,
  TaskListRunResult,
  TaskSubmitRunResult,
} from "./v1-task.js";

function formatSignedNumber(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
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
  if (result.report.caseTypeSummaries.length > 0) {
    lines.push("Case types:");
    for (const summary of result.report.caseTypeSummaries) {
      lines.push(
        `- ${summary.caseType}: ${summary.passedCases}/${summary.totalCases} passed`,
      );
    }
  }
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

  if (result.report.failureGroups.length > 0) {
    lines.push("");
    lines.push("Failure groups:");
    for (const group of result.report.failureGroups.slice(0, 6)) {
      lines.push(
        `- ${group.caseType}: ${group.failedCases} fails | chapters=${group.chapters.join(", ")} | expected=${group.expectedValues.join(" | ")}`,
      );
    }
  }

  if (result.report.skippedGroups.length > 0) {
    lines.push("");
    lines.push("Skipped groups:");
    for (const group of result.report.skippedGroups.slice(0, 4)) {
      lines.push(`- ${group.skippedCases} | ${group.reason}`);
    }
  }

  return lines.join("\n");
}

export function formatRoleDrivenEvalRunResult(result: RoleDrivenEvalRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Report path: ${result.reportPath}`);
  lines.push(`Passed: ${result.report.passedCases}/${result.report.totalCases}`);
  if (result.report.caseTypeSummaries.length > 0) {
    lines.push("Case types:");
    for (const summary of result.report.caseTypeSummaries) {
      lines.push(`- ${summary.caseType}: ${summary.passedCases}/${summary.totalCases} passed`);
    }
  }
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
    lines.push(`Chapter ${summary.chapterNumber}: ${summary.passedCases}/${summary.totalCases} passed`);
  }

  const failed = result.report.caseResults.filter((item) => !item.passed).slice(0, 8);
  if (failed.length > 0) {
    lines.push("");
    lines.push("Failed cases:");
    for (const item of failed) {
      lines.push(
        `- ch${item.chapterNumber} ${item.caseType} ${item.label} | evidence=${item.evidence.join(" | ") || "none"}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatThreadSeedRunResult(result: ThreadSeedRunResult): string {
  return [
    `Project: ${result.projectId}`,
    `Story contracts: ${result.storyContractsPath}`,
    `Narrative threads: ${result.narrativeThreadsPath}`,
    `Contracts created: ${result.contractsCreated}`,
    `Threads created: ${result.threadsCreated}`,
    `Existing contracts kept: ${result.keptExistingContracts}`,
    `Existing threads kept: ${result.keptExistingThreads}`,
  ].join("\n");
}

export function formatThreadInspectRunResult(result: ThreadInspectRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Story contracts: ${result.storyContractsPath}`);
  lines.push(`Narrative threads: ${result.narrativeThreadsPath}`);
  lines.push(`Contracts: ${result.contractCount}`);
  lines.push(`Threads: ${result.threadCount}`);
  lines.push(`Active threads: ${result.activeThreadCount}`);

  const unresolvedReaderPromises = result.contracts.filter(
    (contract) =>
      contract.status === "active" &&
      (contract.contractType === "reader_promise" || contract.contractType === "genre_contract"),
  );
  const brokenContracts = result.contracts.filter((contract) => contract.status === "broken");
  const topPressureThreads = [...result.threads]
    .filter((thread) => thread.currentStatus !== "resolved" && thread.currentStatus !== "retired")
    .sort(
      (left, right) =>
        (right.scheduler.lastScore ?? right.scheduler.urgency) -
          (left.scheduler.lastScore ?? left.scheduler.urgency) ||
        right.scheduler.heat - left.scheduler.heat,
    )
    .slice(0, 5);

  lines.push(`Unresolved reader promises: ${unresolvedReaderPromises.length}`);
  lines.push(`Contract violations: ${brokenContracts.length}`);

  if (topPressureThreads.length > 0) {
    lines.push("");
    lines.push("Top pressure lines:");
    for (const thread of topPressureThreads) {
      lines.push(
        `- ${thread.id}: urgency=${thread.scheduler.urgency} heat=${thread.scheduler.heat} score=${thread.scheduler.lastScore ?? "?"} | ${thread.pressure}`,
      );
    }
  }

  if (result.contracts.length > 0) {
    lines.push("");
    lines.push("Contracts:");
    for (const contract of result.contracts.slice(0, 12)) {
      lines.push(`- ${contract.id} [${contract.contractType}/${contract.priority}] ${contract.statement}`);
    }
  }

  if (result.threads.length > 0) {
    lines.push("");
    lines.push("Threads:");
    for (const thread of result.threads.slice(0, 12)) {
      lines.push(
        `- ${thread.id} [${thread.threadType}/${thread.currentStatus}] urgency=${thread.scheduler.urgency} heat=${thread.scheduler.heat} stale=${thread.scheduler.staleness} ready=${thread.scheduler.payoffReadiness} score=${thread.scheduler.lastScore ?? "?"}`,
      );
      lines.push(`  question: ${thread.readerQuestion}`);
    }
  }

  return lines.join("\n");
}

export function formatThreadRankRunResult(result: ThreadRankRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Narrative threads: ${result.narrativeThreadsPath}`);
  lines.push(`Ranked active threads: ${result.rankedThreads.length}`);

  for (const item of result.rankedThreads.slice(0, 12)) {
    lines.push("");
    lines.push(
      `${item.score.toString().padStart(3, " ")} | ${item.thread.id} [${item.thread.threadType}/${item.thread.currentStatus}]`,
    );
    lines.push(`Title: ${item.thread.title}`);
    lines.push(`Question: ${item.thread.readerQuestion}`);
    lines.push(`Next moves: ${item.thread.nextUsefulMoves.join(" | ")}`);
    if (item.reasons.length > 0) {
      lines.push(`Reasons: ${item.reasons.join(" | ")}`);
    }
    if (item.warnings.length > 0) {
      lines.push(`Warnings: ${item.warnings.join(" | ")}`);
    }
  }

  return lines.join("\n");
}

function formatEpisodePacketLines(result: EpisodePlanRunResult | EpisodeInspectRunResult): string[] {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Episode packet: ${result.packetPath}`);

  if (!result.packet) {
    lines.push("Packet: missing");
    return lines;
  }

  const packet = result.packet;
  lines.push(`Mode: ${packet.chapterMode}`);
  lines.push(`Payoff type: ${packet.payoffType}`);
  lines.push(`Primary thread: ${packet.primaryThreadId}`);
  lines.push(`Agency owner: ${packet.agencyOwnerId}`);
  lines.push(`Choice: ${packet.nonTransferableChoice}`);
  lines.push(`Options: ${packet.tolerableOptions.join(" | ") || "none"}`);
  lines.push(`Cost: ${packet.choiceCost}`);
  lines.push(`Consequence: ${packet.protagonistConsequence}`);
  lines.push(`Reader payoff: ${packet.readerPayoff}`);
  lines.push(`End hook: ${packet.endHook}`);

  if (packet.activeThreadsUsed.length > 0) {
    lines.push("");
    lines.push("Threads used:");
    for (const thread of packet.activeThreadsUsed) {
      lines.push(
        `- ${thread.threadId} [${thread.role}] score=${thread.score} reasons=${thread.reasons.join(" | ") || "none"} warnings=${thread.warnings.join(" | ") || "none"}`,
      );
    }
  }

  if (packet.stateDeltasExpected.length > 0) {
    lines.push("");
    lines.push("Expected state deltas:");
    for (const delta of packet.stateDeltasExpected) {
      lines.push(
        `- ${delta.targetType}${delta.targetId ? `:${delta.targetId}` : ""} [${delta.causalWeight}/${delta.visibility}] ${delta.description}`,
      );
    }
  }

  if (packet.doNotResolve.length > 0) {
    lines.push("");
    lines.push("Do not resolve:");
    for (const item of packet.doNotResolve.slice(0, 8)) {
      lines.push(`- ${item}`);
    }
  }

  if (packet.schedulerWarnings.length > 0) {
    lines.push("");
    lines.push(`Scheduler warnings: ${packet.schedulerWarnings.join(" | ")}`);
  }

  return lines;
}

export function formatEpisodePlanRunResult(result: EpisodePlanRunResult): string {
  return formatEpisodePacketLines(result).join("\n");
}

export function formatEpisodeInspectRunResult(result: EpisodeInspectRunResult): string {
  return formatEpisodePacketLines(result).join("\n");
}

export function formatEpisodeEvalRunResult(result: EpisodeEvalRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Episode packet: ${result.packetPath}`);
  lines.push(`Episode eval: ${result.evalPath}`);
  lines.push(`Agency score: ${result.report.agencyScore}`);
  lines.push(`Passed: ${result.report.passed ? "yes" : "no"}`);
  lines.push(`Agency owner: ${result.report.agencyOwnerId}`);

  if (result.report.failureReasons.length > 0) {
    lines.push("");
    lines.push("Failure reasons:");
    for (const reason of result.report.failureReasons) {
      lines.push(`- ${reason}`);
    }
  }

  lines.push("");
  lines.push("Checks:");
  for (const check of result.report.checks) {
    lines.push(
      `- ${check.id}: ${check.passed ? "pass" : "fail"} score=${check.score} | ${check.reason}`,
    );
  }

  return lines.join("\n");
}

export function formatThreadUpdateRunResult(result: ThreadUpdateRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Narrative threads: ${result.narrativeThreadsPath}`);
  lines.push(`Thread update report: ${result.reportPath}`);
  lines.push(`Threads considered: ${result.threadsConsidered}`);
  lines.push(`Threads touched: ${result.threadsTouched}`);
  lines.push(`Applied delta count: ${result.appliedDeltaCount}`);
  lines.push(`Conflicts: ${result.conflictCount}`);
  lines.push(`Unmatched deltas: ${result.unmatchedDeltaIds.length}`);

  if (result.report.changes.length > 0) {
    lines.push("");
    lines.push("Thread changes:");
    for (const change of result.report.changes.slice(0, 12)) {
      const before = change.before.scheduler;
      const after = change.after.scheduler;
      lines.push(
        `- ${change.threadId}: ${change.before.status} -> ${change.after.status} (touched=${change.after.lastTouchedChapter})`,
      );
      lines.push(
        `  scheduler: urgency ${before.urgency}->${after.urgency} | heat ${before.heat}->${after.heat} | readerDebt ${before.readerDebt}->${after.readerDebt} | payoffReadiness ${before.payoffReadiness}->${after.payoffReadiness} | offscreenPressure ${before.offscreenPressure}->${after.offscreenPressure}`,
      );
      if (change.statusChangeReasons.length > 0) {
        lines.push(`  status reasons: ${change.statusChangeReasons.join(" | ")}`);
      }
      if (change.appliedDeltas.length > 0) {
        const deltaSummary = change.appliedDeltas
          .map(
            (entry) =>
              `${entry.deltaId}[${entry.causalWeight}/${entry.visibility}]<${entry.matchReason}>`,
          )
          .join(" ; ");
        lines.push(`  applied: ${deltaSummary}`);
      }
    }
  }

  if (result.report.conflicts.length > 0) {
    lines.push("");
    lines.push("Contract conflicts:");
    for (const conflict of result.report.conflicts.slice(0, 12)) {
      lines.push(
        `- ${conflict.threadId} :: ${conflict.contractId} [${conflict.impact}] from ${conflict.deltaId}: ${conflict.note}`,
      );
    }
  }

  if (result.unmatchedDeltaIds.length > 0) {
    lines.push("");
    lines.push(`Unmatched delta ids: ${result.unmatchedDeltaIds.slice(0, 16).join(", ")}`);
  }

  return lines.join("\n");
}

export function formatThreadSuggestNextRunResult(result: ThreadSuggestNextRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Report: ${result.reportPath}`);
  lines.push(`Recent deltas (chapter ${Math.max(1, result.chapterNumber - 1)}): ${result.recentDeltaCount}`);

  if (result.primarySuggestion) {
    const item = result.primarySuggestion;
    lines.push("");
    lines.push("Primary suggestion:");
    lines.push(
      `- ${item.threadId} [${item.threadType}/${item.status}] score=${item.score}`,
    );
    lines.push(`  mode: ${item.suggestedMode} | payoff: ${item.suggestedPayoffType}`);
    lines.push(`  next move: ${item.suggestedMove}`);
    if (item.reasons.length > 0) {
      lines.push(`  reasons: ${item.reasons.join(" | ")}`);
    }
    if (item.warnings.length > 0) {
      lines.push(`  warnings: ${item.warnings.join(" | ")}`);
    }
    if (item.agencyRepairNeeded) {
      lines.push(`  agency repair: ${item.agencyRepairNote ?? "yes"}`);
    }
  } else {
    lines.push("Primary suggestion: none (all eligible threads blocked)");
  }

  if (result.supportingSuggestions.length > 0) {
    lines.push("");
    lines.push("Supporting suggestions:");
    for (const item of result.supportingSuggestions) {
      lines.push(
        `- ${item.threadId} [${item.threadType}/${item.status}] score=${item.score} mode=${item.suggestedMode} payoff=${item.suggestedPayoffType}`,
      );
    }
  }

  if (result.blockedSuggestions.length > 0) {
    lines.push("");
    lines.push("Blocked suggestions (need repair before primary):");
    for (const item of result.blockedSuggestions) {
      lines.push(
        `- ${item.threadId} [${item.threadType}/${item.status}] score=${item.score} warnings=${item.warnings.join(" | ")}`,
      );
      if (item.agencyRepairNote) {
        lines.push(`  agency repair: ${item.agencyRepairNote}`);
      }
    }
  }

  if (result.notes.length > 0) {
    lines.push("");
    lines.push("Notes:");
    for (const note of result.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}

export function formatEpisodeRevisePacketRunResult(result: EpisodeRevisePacketRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Episode packet: ${result.packetPath}`);
  lines.push(`Episode eval: ${result.evalPath}`);
  if (result.revisionPath) {
    lines.push(`Previous packet snapshot: ${result.revisionPath}`);
  } else {
    lines.push("Previous packet snapshot: none (no prior packet existed)");
  }
  lines.push(`Agency score: ${result.report.agencyScore}`);
  lines.push(`Eval passed: ${result.report.passed ? "yes" : "no"}`);

  lines.push("");
  lines.push("Change summary:");
  for (const change of result.changeSummary) {
    lines.push(`- ${change}`);
  }

  if (result.report.failureReasons.length > 0) {
    lines.push("");
    lines.push("Eval failure reasons:");
    for (const reason of result.report.failureReasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join("\n");
}

export function formatThreadEconomyRunResult(result: ThreadEconomyRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Narrative threads: ${result.narrativeThreadsPath}`);
  lines.push(`Thread economy report: ${result.reportPath}`);
  lines.push(`Total threads: ${result.report.totalThreads}`);
  lines.push(`Active: ${result.report.activeThreads}`);
  lines.push(`Resolved: ${result.report.resolvedThreads}`);
  lines.push(`Retired: ${result.report.retiredThreads}`);
  lines.push(`Seed-only: ${result.report.seedOnlyThreads}`);
  lines.push(`Passed: ${result.report.passed ? "yes" : "no"}`);

  if (result.report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.report.warnings.slice(0, 16)) {
      const target = warning.threadId ?? "(global)";
      lines.push(`- ${warning.severity} ${warning.code} ${target}: ${warning.message}`);
    }
  }

  if (result.report.entries.length > 0) {
    lines.push("");
    lines.push("Entries:");
    for (const entry of result.report.entries.slice(0, 16)) {
      lines.push(
        `- ${entry.threadId} [${entry.threadType}/${entry.status}] age=${entry.currentAgeChapters}/${entry.expectedSpanChapters} dormant=${entry.dormantChapters}/${entry.maxDormantChapters} payoffWindow=${entry.payoffWindowStart}-${entry.payoffWindowEnd} setupDebt=${entry.setupDebt} payoffReadiness=${entry.payoffReadiness} readerDebt=${entry.readerDebt}`,
      );
      if (entry.warnings.length > 0) {
        lines.push(`  warnings: ${entry.warnings.join(" | ")}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatThreadEvalRunResult(result: ThreadEvalRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Narrative threads: ${result.narrativeThreadsPath}`);
  lines.push(`Thread economy report: ${result.economyReportPath}`);
  lines.push(`Passed: ${result.passed ? "yes" : "no"}`);
  lines.push(`Economy warnings: ${result.economy.warnings.length}`);
  lines.push(`Scheduler warnings: ${result.schedulerWarnings.length}`);

  if (result.economy.warnings.length > 0) {
    lines.push("");
    lines.push("Economy warnings:");
    for (const warning of result.economy.warnings.slice(0, 16)) {
      const target = warning.threadId ?? "(global)";
      lines.push(`- ${warning.severity} ${warning.code} ${target}: ${warning.message}`);
    }
  }

  if (result.schedulerWarnings.length > 0) {
    lines.push("");
    lines.push("Scheduler warnings:");
    for (const entry of result.schedulerWarnings.slice(0, 16)) {
      lines.push(
        `- ${entry.threadId} score=${entry.score} warnings=${entry.warnings.join(" | ")} reasons=${entry.reasons.join(" | ") || "none"}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatOffscreenScheduleRunResult(result: OffscreenScheduleRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Offscreen moves: ${result.offscreenMovesPath}`);
  lines.push(`Moves created: ${result.movesCreated}`);
  lines.push(`Moves kept: ${result.movesKept}`);
  lines.push(`Total moves: ${result.totalMoves}`);

  if (result.moves.length > 0) {
    lines.push("");
    lines.push("Moves:");
    for (const move of result.moves.slice(0, 16)) {
      lines.push(
        `- ${move.id} [${move.actorType}/${move.moveType}/${move.visibility}] target=${move.targetThreadId} ch=${move.scheduledChapter} pressure=${move.pressureAdded} status=${move.status}`,
      );
      lines.push(`  actor: ${move.actorName}`);
      lines.push(`  ${move.description}`);
      lines.push(`  counterplay: ${move.counterplayOpportunity}`);
    }
  }
  return lines.join("\n");
}

export function formatOffscreenInspectRunResult(result: OffscreenInspectRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Offscreen moves: ${result.offscreenMovesPath}`);
  lines.push(`Total moves: ${result.totalMoves}`);
  lines.push(`Pending moves: ${result.pendingMoves}`);
  lines.push(`Applied moves: ${result.appliedMoves}`);
  lines.push(`Hidden moves: ${result.hiddenMoves}`);
  lines.push(`Eval chapter: ${result.evalReport.chapterNumber}`);
  lines.push(`Passed: ${result.evalReport.passed ? "yes" : "no"}`);

  if (result.evalReport.findings.length > 0) {
    lines.push("");
    lines.push("Findings:");
    for (const finding of result.evalReport.findings.slice(0, 12)) {
      lines.push(`- ${finding.severity} ${finding.code} ${finding.moveId}: ${finding.message}`);
    }
  }

  if (result.moves.length > 0) {
    lines.push("");
    lines.push("Moves:");
    for (const move of result.moves.slice(0, 16)) {
      lines.push(
        `- ${move.id} [${move.actorType}/${move.moveType}/${move.visibility}] target=${move.targetThreadId} ch=${move.scheduledChapter} status=${move.status}${move.appliedAtChapter ? ` applied@${move.appliedAtChapter}` : ""}`,
      );
      lines.push(`  ${move.description}`);
    }
  }
  return lines.join("\n");
}

export function formatRuntimeEvalRunResult(result: RuntimeEvalRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Runtime eval report: ${result.reportPath}`);
  lines.push(`Regression report: ${result.regressionPath}`);
  lines.push(`Strict mode: ${result.strict ? "yes" : "no"}`);
  lines.push(`Passed: ${result.report.passed ? "yes" : "no"}`);
  lines.push(`Blocked: ${result.blocked ? "yes" : "no"}`);
  lines.push(`Hard failures: ${result.report.hardFailures.join(", ") || "none"}`);
  lines.push(`Soft warnings: ${result.report.softWarnings.join(", ") || "none"}`);

  lines.push("");
  lines.push("Sections:");
  for (const section of result.report.sections) {
    lines.push(
      `- ${section.name}: ${section.passed ? "pass" : "fail"} errors=${section.errorCount} warnings=${section.warningCount}`,
    );
    if (section.notes.length > 0) {
      for (const note of section.notes.slice(0, 4)) {
        lines.push(`    ${note}`);
      }
    }
  }

  if (
    result.regression.previousGeneratedAt ||
    result.regression.newlyFailingSections.length > 0 ||
    result.regression.newlyPassingSections.length > 0
  ) {
    lines.push("");
    lines.push("Regression:");
    if (result.regression.previousGeneratedAt) {
      lines.push(`- previous: ${result.regression.previousGeneratedAt} (passed=${result.regression.previousPassed ?? "unknown"})`);
    }
    if (result.regression.newlyFailingSections.length > 0) {
      lines.push(`- newly failing: ${result.regression.newlyFailingSections.join(", ")}`);
    }
    if (result.regression.newlyPassingSections.length > 0) {
      lines.push(`- newly passing: ${result.regression.newlyPassingSections.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function formatOffscreenApplyRunResult(result: OffscreenApplyRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Offscreen moves: ${result.offscreenMovesPath}`);
  lines.push(`Narrative threads: ${result.narrativeThreadsPath}`);
  lines.push(`Applied: ${result.applyReport.appliedCount}`);
  lines.push(`Skipped (no target): ${result.applyReport.skippedCount}`);

  if (result.applyReport.applied.length > 0) {
    lines.push("");
    lines.push("Applications:");
    for (const application of result.applyReport.applied.slice(0, 16)) {
      lines.push(
        `- ${application.moveId} [${application.actorType}/${application.moveType}/${application.visibilityAtApply}] target=${application.targetThreadId} pressure=${application.pressureAdded} (scheduled ch=${application.scheduledChapter})`,
      );
      lines.push(`  actor: ${application.actorName}`);
    }
  }
  return lines.join("\n");
}

export function formatStateDeltaInspectRunResult(result: StateDeltaInspectRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`State deltas: ${result.deltasPath}`);
  lines.push(`State delta eval: ${result.evalPath}`);
  lines.push(`Deltas: ${result.report.totalDeltas}`);
  lines.push(`Material deltas: ${result.report.materialDeltas}`);
  lines.push(`Reader-visible deltas: ${result.report.readerVisibleDeltas}`);
  lines.push(`Hidden/offscreen deltas: ${result.report.hiddenDeltas}`);
  lines.push(`Passed: ${result.report.passed ? "yes" : "no"}`);

  if (result.report.findings.length > 0) {
    lines.push("");
    lines.push("Findings:");
    for (const finding of result.report.findings.slice(0, 12)) {
      lines.push(`- ${finding.severity} ${finding.code} ${finding.deltaId}: ${finding.message}`);
    }
  }

  if (result.deltas.length > 0) {
    lines.push("");
    lines.push("Deltas:");
    for (const delta of result.deltas.slice(0, 12)) {
      lines.push(
        `- ${delta.id} [${delta.deltaType}/${delta.causalWeight}/${delta.visibility}] ${delta.targetType}${delta.targetId ? `:${delta.targetId}` : ""}`,
      );
      lines.push(`  after: ${delta.after}`);
      lines.push(`  evidence: ${delta.evidenceSnippet || "none"}`);
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

export function formatConsequenceInspectionRunResult(
  result: ConsequenceInspectionRunResult,
): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Report path: ${result.reportPath}`);
  lines.push(`Decision beat: ${result.report.decisionLog?.beatId ?? "none"}`);
  lines.push(`Decision pressure: ${result.report.decisionLog?.decisionPressure ?? "none"}`);
  lines.push(`Likely choice: ${result.report.decisionLog?.likelyChoice ?? "none"}`);
  lines.push(`Immediate consequence: ${result.report.decisionLog?.immediateConsequence ?? "none"}`);
  lines.push(`Delayed consequence: ${result.report.decisionLog?.delayedConsequence ?? "none"}`);
  lines.push(`Relationship shift: ${result.report.relationshipShift?.shift ?? "none"}`);
  lines.push(`Consequence edges: ${result.report.consequenceEdges?.edges.length ?? 0}`);
  lines.push(
    `Unresolved delayed consequences: ${result.report.unresolvedDelayedConsequences.length > 0 ? result.report.unresolvedDelayedConsequences.join(" | ") : "none"}`,
  );

  if (result.report.delayedConsequenceStatuses.length > 0) {
    lines.push("");
    lines.push("Delayed consequence status:");
    for (const item of result.report.delayedConsequenceStatuses) {
      lines.push(
        `- ch${item.sourceChapterNumber} ${item.status}: ${item.consequence}${
          item.evidenceChapterNumber ? ` | evidence=ch${item.evidenceChapterNumber}` : ""
        }`,
      );
    }
  }

  const owners = result.report.decisionLog?.owners ?? [];
  if (owners.length > 0) {
    lines.push("");
    lines.push("Decision owners:");
    for (const owner of owners) {
      lines.push(
        `- ${owner.name} | desire=${owner.coreDesire ?? "?"} | fear=${owner.coreFear ?? "?"}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatOutlinePatchSuggestionRunResult(
  result: OutlinePatchSuggestionRunResult,
): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`From chapter: ${result.fromChapter}`);
  lines.push(`Report path: ${result.reportPath}`);
  lines.push(
    `Source delayed consequence status: ${result.report.sourceDelayedConsequenceStatus?.status ?? "none"}`,
  );
  lines.push(`Suggestions: ${result.report.suggestions.length}`);

  if (result.report.suggestions.length > 0) {
    lines.push("");
    lines.push("Top suggestions:");
    for (const suggestion of result.report.suggestions.slice(0, 6)) {
      lines.push(
        `- ${suggestion.beatId} [${suggestion.suggestionType}] | ${suggestion.reason}`,
      );
      lines.push(
        `  patch: ${[
          suggestion.suggestedPatch.decisionPressure
            ? `decisionPressure=${suggestion.suggestedPatch.decisionPressure}`
            : null,
          suggestion.suggestedPatch.delayedConsequence
            ? `delayedConsequence=${suggestion.suggestedPatch.delayedConsequence}`
            : null,
          suggestion.suggestedPatch.relationshipShift
            ? `relationshipShift=${suggestion.suggestedPatch.relationshipShift}`
            : null,
          suggestion.suggestedPatch.appendConstraint
            ? `constraint+=${suggestion.suggestedPatch.appendConstraint}`
            : null,
        ]
          .filter(Boolean)
          .join(" ; ")}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatOutlinePatchApplyRunResult(
  result: OutlinePatchApplyRunResult,
): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`From chapter: ${result.fromChapter}`);
  lines.push(`Suggestion report: ${result.suggestionReportPath}`);
  lines.push(`Apply report: ${result.applyReportPath}`);
  lines.push(`Beat outlines: ${result.beatOutlinesPath}`);
  lines.push(
    `Filters: onlyBeat=${result.report.filters.onlyBeatIds.join(",") || "none"} skipBeat=${result.report.filters.skipBeatIds.join(",") || "none"} onlyType=${result.report.filters.onlySuggestionTypes.join(",") || "none"} skipType=${result.report.filters.skipSuggestionTypes.join(",") || "none"}`,
  );
  lines.push(`Applied: ${result.report.applied.length}`);
  lines.push(`Skipped: ${result.report.skipped.length}`);

  if (result.report.applied.length > 0) {
    lines.push("");
    lines.push("Applied patches:");
    for (const item of result.report.applied.slice(0, 10)) {
      lines.push(
        `- ${item.beatId} [${item.suggestionType}] fields=${item.changedFields.join(", ") || "none"}${
          item.appendedConstraint ? " constraint=appended" : ""
        }`,
      );
    }
  }

  if (result.report.skipped.length > 0) {
    lines.push("");
    lines.push("Skipped patches:");
    for (const item of result.report.skipped.slice(0, 6)) {
      lines.push(`- ${item.beatId} [${item.suggestionType}] ${item.reason}`);
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

export function formatRegenerateFromTargetRunResult(result: RegenerateFromTargetRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target: ${result.targetId}`);
  lines.push(`Requested regenerate count: ${result.requestedCount}`);
  lines.push(`Impact report: ${result.impactReportPath}`);
  lines.push(`Rewrite plan: ${result.rewritePlanPath}`);
  lines.push(
    `Suggested invalidation chapter: ${result.plan.suggestedInvalidationChapter ?? "none"}`,
  );

  if (!result.invalidation) {
    lines.push("Invalidation: skipped");
    lines.push("Generation: skipped");
    lines.push("Reason: no impacted chapter could be mapped to a concrete invalidation point.");
    return lines.join("\n");
  }

  lines.push(`Invalidated from chapter: ${result.invalidation.chapterNumber}`);
  lines.push(
    `Deleted chapter artifacts: ${result.invalidation.deletedChapterNumbers.length > 0 ? result.invalidation.deletedChapterNumbers.join(", ") : "none"}`,
  );

  if (result.generation) {
    lines.push(`Regenerated target chapter: ${result.generation.targetChapter}`);
    lines.push(
      `Generated now: ${result.generation.generatedChapterNumbers.length > 0 ? result.generation.generatedChapterNumbers.join(", ") : "none"}`,
    );
    if (result.generation.retrievalEval) {
      lines.push(
        `Retrieval eval: ${result.generation.retrievalEval.report.passedCases}/${result.generation.retrievalEval.report.totalCases} passed`,
      );
    }
  }

  return lines.join("\n");
}

export function formatRegenerateWithPatchesRunResult(
  result: RegenerateWithPatchesRunResult,
): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target: ${result.targetId}`);
  lines.push(`Requested regenerate count: ${result.requestedCount}`);
  lines.push(`Patch source chapter: ${result.patchSourceChapter ?? "none"}`);
  lines.push(`Impact report: ${result.rewritePlan.impactReportPath}`);
  lines.push(`Rewrite plan: ${result.rewritePlan.rewritePlanPath}`);

  if (result.skippedReason) {
    lines.push("Patch/regeneration: skipped");
    lines.push(`Reason: ${result.skippedReason}`);
    return lines.join("\n");
  }

  if (result.patchSuggestions) {
    lines.push(`Patch suggestions: ${result.patchSuggestions.reportPath}`);
    lines.push(`Suggested patches: ${result.patchSuggestions.report.suggestions.length}`);
  }
  if (result.patchApply) {
    lines.push(`Patch apply report: ${result.patchApply.applyReportPath}`);
    lines.push(`Applied patches: ${result.patchApply.report.applied.length}`);
    lines.push(`Skipped patches: ${result.patchApply.report.skipped.length}`);
  }
  if (result.regeneration?.invalidation) {
    lines.push(`Invalidated from chapter: ${result.regeneration.invalidation.chapterNumber}`);
  }
  if (result.regeneration?.generation) {
    lines.push(
      `Generated now: ${result.regeneration.generation.generatedChapterNumbers.length > 0 ? result.regeneration.generation.generatedChapterNumbers.join(", ") : "none"}`,
    );
    if (result.regeneration.generation.retrievalEval) {
      lines.push(
        `Retrieval eval: ${result.regeneration.generation.retrievalEval.report.passedCases}/${result.regeneration.generation.retrievalEval.report.totalCases} passed`,
      );
    }
  }

  return lines.join("\n");
}

export function formatRewriteChapterRunResult(result: RewriteChapterRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Invalidated from chapter: ${result.invalidation.chapterNumber}`);
  lines.push(
    `Deleted chapter artifacts: ${result.invalidation.deletedChapterNumbers.length > 0 ? result.invalidation.deletedChapterNumbers.join(", ") : "none"}`,
  );
  lines.push(`Regenerated target chapter: ${result.generation.targetChapter}`);
  lines.push(
    `Generated now: ${result.generation.generatedChapterNumbers.length > 0 ? result.generation.generatedChapterNumbers.join(", ") : "none"}`,
  );

  if (result.generation.retrievalEval) {
    lines.push(
      `Retrieval eval: ${result.generation.retrievalEval.report.passedCases}/${result.generation.retrievalEval.report.totalCases} passed`,
    );
  }

  return lines.join("\n");
}

export function formatRewriteDraftRunResult(result: RewriteDraftRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Version: ${result.versionId}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Title: ${result.title ?? "(untitled)"}`);
  lines.push(`Draft path: ${result.draftPath}`);
  lines.push(`Metadata path: ${result.metadataPath}`);
  lines.push(`Version draft: ${result.versionDraftPath}`);
  lines.push(`Version metadata: ${result.versionMetadataPath}`);

  if (result.retrievalEval) {
    lines.push(
      `Retrieval eval: ${result.retrievalEval.report.passedCases}/${result.retrievalEval.report.totalCases} passed`,
    );
  }

  return lines.join("\n");
}

export function formatApplyDraftRewriteRunResult(result: ApplyDraftRewriteRunResult): string {
  return [
    `Project: ${result.projectId}`,
    `Chapter: ${result.chapterNumber}`,
    `Version: ${result.versionId}`,
    `Title: ${result.title ?? "(untitled)"}`,
    `Applied rewrite draft: ${result.draftRewritePath}`,
    `Applied metadata: ${result.metadataPath}`,
    `Backup draft: ${result.backupDraftPath}`,
    `Backup result: ${result.backupResultPath}`,
    `Canonical draft: ${result.canonicalDraftPath}`,
    `Canonical result: ${result.canonicalResultPath}`,
  ].join("\n");
}

export function formatListDraftRewriteVersionsRunResult(
  result: ListDraftRewriteVersionsRunResult,
): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Chapter: ${result.chapterNumber}`);
  lines.push(`Versions: ${result.versions.length}`);
  if (result.versions.length === 0) {
    return lines.join("\n");
  }

  lines.push("");
  for (const version of result.versions) {
    lines.push(
      `- ${version.versionId}${version.isLatest ? " [latest]" : ""} | mode=${version.mode ?? "?"} | title=${version.title ?? "(untitled)"}`,
    );
  }

  return lines.join("\n");
}

export function formatInspectDraftRewriteRunResult(
  result: InspectDraftRewriteRunResult,
): string {
  return [
    `Project: ${result.projectId}`,
    `Chapter: ${result.chapterNumber}`,
    `Version: ${result.versionId}`,
    `Title: ${result.title ?? "(untitled)"}`,
    `Mode: ${result.mode ?? "?"}`,
    `Generated at: ${result.generatedAt ?? "?"}`,
    `Draft path: ${result.draftPath}`,
    `Metadata path: ${result.metadataPath}`,
    `Compare against: ${result.compareAgainst}`,
    `Exact match: ${result.comparison.exactMatch ? "yes" : "no"}`,
    `First difference line: ${result.comparison.firstDifferenceLine ?? "none"}`,
    `Line delta: ${formatSignedNumber(result.comparison.lineDelta)}`,
    `Char delta: ${formatSignedNumber(result.comparison.charDelta)}`,
    `Objective: ${result.objective ?? ""}`,
  ].join("\n");
}


export function formatTaskSubmitRunResult(result: TaskSubmitRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Task id: ${result.taskId}`);
  lines.push(`Brief path: ${result.briefPath}`);
  lines.push(`Title: ${result.brief.title}`);
  lines.push(`Status: ${result.brief.status}`);
  lines.push(`Characters: ${result.brief.characters.map((c) => `${c.id}${c.pov ? " (POV)" : ""}`).join(", ")}`);
  lines.push(`Chapter budget: ${formatChapterBudget(result.brief.chapterBudget)}`);
  if (result.brief.preferredShapes.length > 0) {
    lines.push(`Preferred shapes: ${result.brief.preferredShapes.join(", ")}`);
  }
  if (result.brief.forbiddenShapes.length > 0) {
    lines.push(`Forbidden shapes: ${result.brief.forbiddenShapes.join(", ")}`);
  }
  lines.push("");
  lines.push("Intent:");
  lines.push(`  ${result.brief.intent}`);
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of result.warnings) {
      lines.push(`- ${w}`);
    }
  }
  return lines.join("\n");
}

export function formatTaskListRunResult(result: TaskListRunResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Tasks dir: ${result.tasksDir}`);
  lines.push(`Total tasks: ${result.briefs.length}`);
  if (result.briefs.length === 0) {
    lines.push("");
    lines.push("(no tasks submitted yet)");
    return lines.join("\n");
  }
  lines.push("");
  for (const brief of result.briefs) {
    const decomp = result.decompositionByTaskId[brief.id];
    const decomposed = decomp ? `decomposed (${decomp.chapterCount} chapters)` : "pending";
    lines.push(`- ${brief.id} [${brief.status}] ${decomposed}`);
    lines.push(`    title: ${brief.title}`);
    lines.push(`    submitted: ${brief.submittedAt}`);
    lines.push(`    characters: ${brief.characters.map((c) => c.id).join(", ")}`);
  }
  return lines.join("\n");
}

export function formatTaskInspectRunResult(result: TaskInspectRunResult): string {
  const lines: string[] = [];
  const b = result.brief;
  lines.push(`Project: ${result.projectId}`);
  lines.push(`Task id: ${result.taskId}`);
  lines.push(`Brief path: ${result.briefPath}`);
  lines.push(`Decomposition path: ${result.decompositionPath}`);
  lines.push(`Title: ${b.title}`);
  lines.push(`Status: ${b.status}`);
  lines.push(`Submitted at: ${b.submittedAt}`);
  lines.push(`Characters: ${b.characters.map((c) => `${c.id}${c.pov ? " (POV)" : ""}${c.role ? ` - ${c.role}` : ""}`).join(", ")}`);
  lines.push(`Chapter budget: ${formatChapterBudget(b.chapterBudget)}`);
  lines.push("");
  lines.push("Intent:");
  lines.push(`  ${b.intent}`);
  if (b.emotionalTarget) {
    lines.push("");
    lines.push("Emotional target:");
    lines.push(`  ${b.emotionalTarget}`);
  }
  if (b.constraints.length > 0) {
    lines.push("");
    lines.push("Constraints:");
    for (const c of b.constraints) lines.push(`- ${c}`);
  }
  if (b.textureMust.length > 0) {
    lines.push("");
    lines.push("Texture must include:");
    for (const t of b.textureMust) lines.push(`- ${t}`);
  }
  if (b.preferredShapes.length > 0) {
    lines.push("");
    lines.push(`Preferred shapes: ${b.preferredShapes.join(", ")}`);
  }
  if (b.forbiddenShapes.length > 0) {
    lines.push(`Forbidden shapes: ${b.forbiddenShapes.join(", ")}`);
  }
  if (b.pacingHint) {
    lines.push("");
    lines.push(`Pacing hint: ${b.pacingHint}`);
  }
  if (result.decomposition) {
    const d = result.decomposition;
    lines.push("");
    lines.push("Decomposition:");
    lines.push(`  Generated at: ${d.generatedAt}`);
    lines.push(`  Chapter count: ${d.chapterCount}`);
    lines.push(`  Beats: ${d.beats.length}`);
    lines.push(`  Reasoning: ${d.reasoning}`);
  } else {
    lines.push("");
    lines.push("Decomposition: (not yet generated)");
  }
  return lines.join("\n");
}

function formatChapterBudget(budget: TaskSubmitRunResult["brief"]["chapterBudget"]): string {
  if (budget.kind === "exact") {
    return `${budget.value} chapter${budget.value === 1 ? "" : "s"}`;
  }
  if (budget.min !== undefined || budget.max !== undefined) {
    return `auto (${budget.min ?? "?"}-${budget.max ?? "?"})`;
  }
  return "auto";
}

