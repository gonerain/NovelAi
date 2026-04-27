import { readdir, readFile, writeFile } from "node:fs/promises";

import { FileProjectRepository } from "./storage/index.js";
import type {
  ApplyDraftRewriteRunResult,
  DraftRewriteVersionSummary,
  InspectDraftRewriteRunResult,
  ListDraftRewriteVersionsRunResult,
} from "./v1-lib.js";
import {
  chapterBackupDraftPath,
  chapterBackupResultPath,
  chapterCanonicalDraftPath,
  chapterCanonicalResultPath,
  chapterDraftRewriteMetadataPath,
  chapterDraftRewritePath,
  chapterDraftRewriteVersionDraftPath,
  chapterDraftRewriteVersionMetadataPath,
  chapterDraftRewriteVersionsDir,
} from "./v1-paths.js";

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

async function loadDraftRewriteVersionMetadata(args: {
  projectId: string;
  chapterNumber: number;
  versionId: string;
}): Promise<{
  versionId?: string;
  generatedAt?: string;
  mode?: string;
  title?: string;
  objective?: string;
} | null> {
  return readJsonArtifact<{
    versionId?: string;
    generatedAt?: string;
    mode?: string;
    title?: string;
    objective?: string;
  }>(chapterDraftRewriteVersionMetadataPath(args.projectId, args.chapterNumber, args.versionId));
}

function lineComparison(selected: string, baseline: string): InspectDraftRewriteRunResult["comparison"] {
  const normalizedSelected = selected.replace(/\s+$/g, "");
  const normalizedBaseline = baseline.replace(/\s+$/g, "");
  const selectedLines = normalizedSelected.split(/\r?\n/);
  const baselineLines = normalizedBaseline.split(/\r?\n/);
  const maxLength = Math.max(selectedLines.length, baselineLines.length);
  let firstDifferenceLine: number | null = null;

  for (let index = 0; index < maxLength; index += 1) {
    if ((selectedLines[index] ?? "") !== (baselineLines[index] ?? "")) {
      firstDifferenceLine = index + 1;
      break;
    }
  }

  return {
    selectedLines: selectedLines.length,
    baselineLines: baselineLines.length,
    lineDelta: selectedLines.length - baselineLines.length,
    selectedChars: normalizedSelected.length,
    baselineChars: normalizedBaseline.length,
    charDelta: normalizedSelected.length - normalizedBaseline.length,
    firstDifferenceLine,
    exactMatch: normalizedSelected === normalizedBaseline,
  };
}

export async function applyDraftRewrite(args: {
  projectId: string;
  chapterNumber: number;
  versionId?: string;
}): Promise<ApplyDraftRewriteRunResult> {
  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const repository = new FileProjectRepository();
  const existingArtifact = await repository.loadChapterArtifact(args.projectId, args.chapterNumber);
  if (!existingArtifact) {
    throw new Error(
      `chapter apply-draft-rewrite requires an existing chapter artifact: project=${args.projectId}, chapter=${args.chapterNumber}`,
    );
  }

  const metadataPath = args.versionId
    ? chapterDraftRewriteVersionMetadataPath(args.projectId, args.chapterNumber, args.versionId)
    : chapterDraftRewriteMetadataPath(args.projectId, args.chapterNumber);
  const draftRewritePath = args.versionId
    ? chapterDraftRewriteVersionDraftPath(args.projectId, args.chapterNumber, args.versionId)
    : chapterDraftRewritePath(args.projectId, args.chapterNumber);
  const metadata = await readJsonArtifact<{
    versionId?: string;
    title?: string;
  }>(metadataPath);
  if (!metadata) {
    throw new Error(
      `chapter apply-draft-rewrite requires rewrite metadata: ${metadataPath}`,
    );
  }

  const rewrittenDraft = await readFile(draftRewritePath, "utf-8").catch(() => null);
  if (!rewrittenDraft?.trim()) {
    throw new Error(
      `chapter apply-draft-rewrite requires rewrite draft content: ${draftRewritePath}`,
    );
  }

  const backupDraftPath = chapterBackupDraftPath(args.projectId, args.chapterNumber);
  const backupResultPath = chapterBackupResultPath(args.projectId, args.chapterNumber);
  const canonicalDraftPath = chapterCanonicalDraftPath(args.projectId, args.chapterNumber);
  const canonicalResultPath = chapterCanonicalResultPath(args.projectId, args.chapterNumber);

  await writeFile(backupDraftPath, existingArtifact.writerResult.draft, "utf-8");
  await writeFile(backupResultPath, `${JSON.stringify(existingArtifact, null, 2)}\n`, "utf-8");

  const promotedArtifact = {
    ...existingArtifact,
    writerResult: {
      ...existingArtifact.writerResult,
      title: metadata.title ?? existingArtifact.writerResult.title,
      draft: rewrittenDraft.trim(),
    },
    generatedAt: new Date().toISOString(),
  };

  await writeFile(canonicalDraftPath, `${promotedArtifact.writerResult.draft}\n`, "utf-8");
  await writeFile(canonicalResultPath, `${JSON.stringify(promotedArtifact, null, 2)}\n`, "utf-8");
  await repository.saveChapterArtifact(args.projectId, promotedArtifact);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    versionId: args.versionId ?? metadata.versionId ?? "latest",
    draftRewritePath,
    metadataPath,
    backupDraftPath,
    backupResultPath,
    canonicalDraftPath,
    canonicalResultPath,
    title: promotedArtifact.writerResult.title,
  };
}

export async function listDraftRewriteVersions(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<ListDraftRewriteVersionsRunResult> {
  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const versionsDir = chapterDraftRewriteVersionsDir(args.projectId, args.chapterNumber);
  let versionIds: string[] = [];
  try {
    const entries = await readdir(versionsDir, { withFileTypes: true });
    versionIds = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/i, ""))
      .sort()
      .reverse();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {
        projectId: args.projectId,
        chapterNumber: args.chapterNumber,
        versions: [],
      };
    }
    throw error;
  }

  const latestMetadata = await readJsonArtifact<{ versionId?: string }>(
    chapterDraftRewriteMetadataPath(args.projectId, args.chapterNumber),
  );
  const latestVersionId = latestMetadata?.versionId;

  const versions = await Promise.all(
    versionIds.map(async (versionId) => {
      const metadata = await loadDraftRewriteVersionMetadata({
        projectId: args.projectId,
        chapterNumber: args.chapterNumber,
        versionId,
      });
      return {
        versionId,
        generatedAt: metadata?.generatedAt,
        mode: metadata?.mode,
        title: metadata?.title,
        draftPath: chapterDraftRewriteVersionDraftPath(args.projectId, args.chapterNumber, versionId),
        metadataPath: chapterDraftRewriteVersionMetadataPath(
          args.projectId,
          args.chapterNumber,
          versionId,
        ),
        isLatest: versionId === latestVersionId,
      } satisfies DraftRewriteVersionSummary;
    }),
  );

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    versions,
  };
}

export async function inspectDraftRewrite(args: {
  projectId: string;
  chapterNumber: number;
  versionId?: string;
}): Promise<InspectDraftRewriteRunResult> {
  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const list = await listDraftRewriteVersions({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });
  if (list.versions.length === 0) {
    throw new Error(
      `chapter inspect-draft-rewrite requires at least one rewrite version: project=${args.projectId}, chapter=${args.chapterNumber}`,
    );
  }

  const selectedVersion =
    (args.versionId
      ? list.versions.find((item) => item.versionId === args.versionId)
      : list.versions.find((item) => item.isLatest) ?? list.versions[0]) ?? null;
  if (!selectedVersion) {
    throw new Error(
      `chapter inspect-draft-rewrite could not find version ${args.versionId} for chapter ${args.chapterNumber}`,
    );
  }

  const selectedDraft = await readFile(selectedVersion.draftPath, "utf-8");
  const canonicalDraft = await readFile(
    chapterCanonicalDraftPath(args.projectId, args.chapterNumber),
    "utf-8",
  );
  const latestDraft = await readFile(
    chapterDraftRewritePath(args.projectId, args.chapterNumber),
    "utf-8",
  ).catch(() => canonicalDraft);
  const compareAgainst: "canonical" | "latest" = selectedVersion.isLatest ? "canonical" : "latest";
  const baselineDraft = compareAgainst === "canonical" ? canonicalDraft : latestDraft;
  const metadata = await loadDraftRewriteVersionMetadata({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    versionId: selectedVersion.versionId,
  });

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    versionId: selectedVersion.versionId,
    draftPath: selectedVersion.draftPath,
    metadataPath: selectedVersion.metadataPath,
    title: metadata?.title,
    mode: metadata?.mode,
    generatedAt: metadata?.generatedAt,
    objective: metadata?.objective,
    compareAgainst,
    comparison: lineComparison(selectedDraft, baselineDraft),
  };
}
