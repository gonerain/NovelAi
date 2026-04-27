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
  OutlinePatchSuggestionRunResult,
  RewritePlanRunResult,
} from "./v1-impact.js";
import type {
  InvalidateTargetRunResult,
  RegenerateFromTargetRunResult,
  RewriteChapterRunResult,
} from "./v1-lib.js";

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
