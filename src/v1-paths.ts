import path from "node:path";

export function retrievalEvalSetPath(projectId: string): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "memory",
    "eval",
    "retrieval-eval-set.json",
  );
}

export function retrievalEvalReportPath(projectId: string): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "memory",
    "eval",
    "retrieval-eval-report.json",
  );
}

export function embeddingCachePath(projectId: string): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "memory",
    "retrieval",
    "embedding-cache.json",
  );
}

export function changeImpactReportPath(projectId: string, targetId: string): string {
  const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "impact",
    `${safeTarget}.json`,
  );
}

export function rewritePlanReportPath(projectId: string, targetId: string): string {
  const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "impact",
    `${safeTarget}.rewrite-plan.json`,
  );
}

export function consequenceInspectionReportPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "impact",
    `chapter-${String(chapterNumber).padStart(3, "0")}.consequences.json`,
  );
}

export function outlinePatchSuggestionsPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "impact",
    `chapter-${String(chapterNumber).padStart(3, "0")}.outline-patches.json`,
  );
}

export function chapterDraftRewritePath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "draft_rewrite.md",
  );
}

export function chapterDraftRewriteMetadataPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "draft_rewrite.json",
  );
}

export function chapterDraftRewriteVersionsDir(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "draft_rewrite_versions",
  );
}

export function chapterDraftRewriteVersionDraftPath(
  projectId: string,
  chapterNumber: number,
  versionId: string,
): string {
  return path.join(
    chapterDraftRewriteVersionsDir(projectId, chapterNumber),
    `${versionId}.md`,
  );
}

export function chapterDraftRewriteVersionMetadataPath(
  projectId: string,
  chapterNumber: number,
  versionId: string,
): string {
  return path.join(
    chapterDraftRewriteVersionsDir(projectId, chapterNumber),
    `${versionId}.json`,
  );
}

export function chapterMemoryValidationPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "memory_update_validation.json",
  );
}

export function chapterDecisionLogPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "decision_log.json",
  );
}

export function chapterRelationshipShiftPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "relationship_shift.json",
  );
}

export function chapterConsequenceEdgesPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "consequence_edges.json",
  );
}

export function chapterCanonicalDraftPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "draft.md",
  );
}

export function chapterCanonicalResultPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "result.json",
  );
}

export function chapterBackupDraftPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "draft_before_promote.md",
  );
}

export function chapterBackupResultPath(projectId: string, chapterNumber: number): string {
  return path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "result_before_promote.json",
  );
}
