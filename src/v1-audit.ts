import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArcOutline,
  BeatOutline,
  ChapterPlan,
  ChapterScenePlan,
  EpisodePacket,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import {
  beatOutlineGenerationResultSchema,
  beatPacingAuditResultSchema,
  buildBeatOutlineMessages,
  buildBeatPacingAuditMessages,
  buildChapterPlanAuditMessages,
  type BeatPacingRewrite,
  type ChapterPlanAuditChapterInput,
} from "./prompts/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { chapterEpisodePacketPath } from "./v1-paths.js";
import { readJsonArtifact } from "./v1-artifacts.js";

export interface AuditChapterPlanArgs {
  projectId: string;
  fromChapter: number;
  toChapter: number;
  /** When true (default), include drafts for chapters that already have one. */
  includeDrafts?: boolean;
}

export interface AuditChapterPlanResult {
  projectId: string;
  fromChapter: number;
  toChapter: number;
  reportPath: string;
  generatedAt: string;
  cnCharCount: number;
}

const CN_CHAR_RE = /[一-鿿]/gu;
function cnCharCount(text: string): number {
  return (text.match(CN_CHAR_RE) ?? []).length;
}

export async function auditChapterPlan(
  args: AuditChapterPlanArgs,
): Promise<AuditChapterPlanResult> {
  if (args.fromChapter < 1) throw new Error("fromChapter must be >= 1");
  if (args.toChapter < args.fromChapter) {
    throw new Error("toChapter must be >= fromChapter");
  }

  const repository = new FileProjectRepository();
  const projectId = args.projectId;
  const includeDrafts = args.includeDrafts ?? true;

  const [
    storyOutline,
    themeBible,
    arcOutlines,
    beatOutlines,
    worldFacts,
    chapterPlansAll,
    scenePlansAll,
  ] = await Promise.all([
    repository.loadStoryOutline(projectId),
    repository.loadThemeBible(projectId),
    repository.loadArcOutlines(projectId),
    repository.loadBeatOutlines(projectId),
    repository.loadWorldFacts(projectId),
    repository.loadChapterPlans(projectId),
    repository.loadChapterScenePlans(projectId),
  ]);

  const planByChapter = new Map<number, ChapterPlan>();
  for (const plan of chapterPlansAll) {
    if (typeof plan.chapterNumber === "number") {
      planByChapter.set(plan.chapterNumber, plan);
    }
  }
  const sceneByChapter = new Map<number, ChapterScenePlan>();
  for (const scene of scenePlansAll) {
    sceneByChapter.set(scene.chapterNumber, scene);
  }

  const chapters: ChapterPlanAuditChapterInput[] = [];
  for (let n = args.fromChapter; n <= args.toChapter; n += 1) {
    const chapterPlan = planByChapter.get(n);
    const scenePlan = sceneByChapter.get(n);
    const episodePacket = await readJsonArtifact<EpisodePacket>(
      chapterEpisodePacketPath(projectId, n),
    );
    let draft: string | undefined;
    let draftCnCharCount: number | undefined;
    if (includeDrafts) {
      const artifact = await repository.loadChapterArtifact(projectId, n);
      if (artifact?.writerResult?.draft) {
        draft = artifact.writerResult.draft;
        draftCnCharCount = cnCharCount(draft);
      }
    }
    chapters.push({
      chapterNumber: n,
      chapterPlan,
      scenePlan,
      episodePacket: episodePacket ?? undefined,
      draft,
      draftCnCharCount,
    });
  }

  const messages = buildChapterPlanAuditMessages({
    projectId,
    fromChapter: args.fromChapter,
    toChapter: args.toChapter,
    storyOutline: storyOutline ?? undefined,
    themeBible: themeBible ?? undefined,
    arcOutlines,
    beatOutlines,
    worldFacts,
    chapters,
  });

  const service = new LlmService();
  const result = await service.generateForTask({
    task: "chapter_plan_audit",
    messages,
    temperature: 0.3,
    maxTokens: 6400,
  });

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const auditDir = path.resolve(
    process.cwd(),
    "data",
    "projects",
    projectId,
    "audits",
  );
  await mkdir(auditDir, { recursive: true });
  const reportPath = path.join(
    auditDir,
    `chapter-plan-audit_ch${String(args.fromChapter).padStart(3, "0")}-${String(args.toChapter).padStart(3, "0")}_${stamp}.md`,
  );
  const reportBody = [
    `<!-- chapter-plan-audit project=${projectId} chapters=${args.fromChapter}-${args.toChapter} generatedAt=${generatedAt} -->`,
    "",
    result.text.trim(),
    "",
  ].join("\n");
  await writeFile(reportPath, reportBody, "utf-8");

  return {
    projectId,
    fromChapter: args.fromChapter,
    toChapter: args.toChapter,
    reportPath,
    generatedAt,
    cnCharCount: cnCharCount(result.text),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Beat pacing audit (B)
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditBeatPacingArgs {
  projectId: string;
  /** Audit beats for this arc only. If omitted, audits all arcs. */
  arcId?: string;
  /** When true, auto-apply rewrittenBeats patches to beat-outlines.json. */
  applyFixes?: boolean;
}

export interface AuditBeatPacingResult {
  projectId: string;
  arcsAudited: string[];
  reportPaths: string[];
  appliedFixes: number;
}

export async function auditBeatPacing(
  args: AuditBeatPacingArgs,
): Promise<AuditBeatPacingResult> {
  const repository = new FileProjectRepository();
  const projectId = args.projectId;

  const [arcOutlines, beatOutlines, worldFacts] = await Promise.all([
    repository.loadArcOutlines(projectId),
    repository.loadBeatOutlines(projectId),
    repository.loadWorldFacts(projectId),
  ]);

  const targetArcs = args.arcId
    ? arcOutlines.filter((a) => a.id === args.arcId)
    : arcOutlines;

  if (targetArcs.length === 0) {
    throw new Error(
      `No arcs found${args.arcId ? ` matching arcId=${args.arcId}` : ""} in project=${projectId}`,
    );
  }

  const service = new LlmService();
  const auditDir = path.resolve("data", "projects", projectId, "audits");
  await mkdir(auditDir, { recursive: true });

  const reportPaths: string[] = [];
  const arcsAudited: string[] = [];
  let appliedFixes = 0;

  const allPatches: BeatPacingRewrite[] = [];

  for (const arc of targetArcs) {
    const arcBeats = beatOutlines.filter((b) => b.arcId === arc.id);
    if (arcBeats.length === 0) continue;

    const messages = buildBeatPacingAuditMessages({
      arc,
      beats: arcBeats,
      worldFacts,
      allArcOutlines: arcOutlines,
    });

    const result = await service.generateObjectForTask({
      task: "beat_pacing_audit",
      messages,
      schema: beatPacingAuditResultSchema,
      temperature: 0.3,
      maxTokens: 4000,
    });

    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.replace(/[:.]/g, "-");
    const reportPath = path.join(
      auditDir,
      `beat-pacing-audit_${arc.id}_${stamp}.md`,
    );

    const report = result.object as { reportMarkdown?: string; rewrittenBeats?: BeatPacingRewrite[] | null };
    const reportMarkdown = report.reportMarkdown ?? "(no report)";
    const rewrittenBeats = report.rewrittenBeats ?? null;

    const reportBody = [
      `<!-- beat-pacing-audit project=${projectId} arc=${arc.id} generatedAt=${generatedAt} -->`,
      "",
      reportMarkdown.trim(),
      "",
      rewrittenBeats && rewrittenBeats.length > 0
        ? ["## Proposed beat rewrites (JSON)", "```json", JSON.stringify(rewrittenBeats, null, 2), "```"].join("\n")
        : "## No beat rewrites proposed.",
      "",
    ].join("\n");

    await writeFile(reportPath, reportBody, "utf-8");
    reportPaths.push(reportPath);
    arcsAudited.push(arc.id);

    if (args.applyFixes && rewrittenBeats && rewrittenBeats.length > 0) {
      allPatches.push(...rewrittenBeats);
    }
  }

  if (allPatches.length > 0) {
    const patchMap = new Map<string, BeatPacingRewrite>();
    for (const patch of allPatches) {
      patchMap.set(patch.beatId, patch);
    }
    const updatedBeats: BeatOutline[] = beatOutlines.map((beat) => {
      const patch = patchMap.get(beat.id);
      if (!patch) return beat;
      appliedFixes += 1;
      return {
        ...beat,
        ...(patch.beatGoal ? { beatGoal: patch.beatGoal } : {}),
        revealTargets: patch.revealTargets,
        constraints: patch.constraints,
      };
    });
    await repository.saveBeatOutlines(projectId, updatedBeats);
  }

  return { projectId, arcsAudited, reportPaths, appliedFixes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Beat regeneration with minRevealArc constraint
// ─────────────────────────────────────────────────────────────────────────────

export interface RegenerateBeatsArgs {
  projectId: string;
  arcId: string;
  targetChapterCount?: number;
}

export interface RegenerateBeatsResult {
  projectId: string;
  arcId: string;
  beatsProduced: number;
  warnings: string[];
}

export async function regenerateBeatsForArc(
  args: RegenerateBeatsArgs,
): Promise<RegenerateBeatsResult> {
  const repository = new FileProjectRepository();
  const projectId = args.projectId;

  const [arcOutlines, existingBeats, worldFacts, storyOutline] = await Promise.all([
    repository.loadArcOutlines(projectId),
    repository.loadBeatOutlines(projectId),
    repository.loadWorldFacts(projectId),
    repository.loadStoryOutline(projectId),
  ]);

  const arc = arcOutlines.find((a) => a.id === args.arcId) as ArcOutline | undefined;
  if (!arc) throw new Error(`Arc not found: ${args.arcId} in project=${projectId}`);
  if (!storyOutline) throw new Error(`Story outline missing for project=${projectId}`);

  const messages = buildBeatOutlineMessages({
    projectTitle: storyOutline.title,
    storyOutline,
    arcOutlines: [arc],
    allArcOutlines: arcOutlines,
    worldFacts,
    targetChapterCount: args.targetChapterCount ?? 250,
  });

  const service = new LlmService();
  const result = await service.generateObjectForTask({
    task: "beat_outline",
    messages,
    schema: beatOutlineGenerationResultSchema,
    temperature: 0.2,
    maxTokens: 3200,
  });

  const newBeats: BeatOutline[] = result.object.beatOutlines ?? [];
  const warnings: string[] = [];

  if (newBeats.length === 0) {
    warnings.push("LLM returned no beats; existing beats preserved.");
    return { projectId, arcId: args.arcId, beatsProduced: 0, warnings };
  }

  // Merge: keep beats for other arcs, replace beats for target arc.
  const otherBeats = existingBeats.filter((b) => b.arcId !== args.arcId);
  const merged = [...otherBeats, ...newBeats].sort(
    (a, b) => (a.chapterRangeHint?.start ?? 0) - (b.chapterRangeHint?.start ?? 0),
  );
  await repository.saveBeatOutlines(projectId, merged);

  // Sync arc.beatIds to match new beat IDs so arc-outlines stay consistent.
  const updatedArcOutlines = arcOutlines.map((a) => {
    if (a.id !== args.arcId) return a;
    return { ...a, beatIds: newBeats.map((b) => b.id) };
  });
  await repository.saveArcOutlines(projectId, updatedArcOutlines);

  return { projectId, arcId: args.arcId, beatsProduced: newBeats.length, warnings };
}
