import type {
  ArcOutline,
  BeatOutline,
  CastCharacterOutline,
  StoryOutline,
  StoryProject,
} from "./domain/index.js";
import { buildDerivedAuthorProfilePacks } from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import {
  arcOutlineGenerationResultSchema,
  beatOutlineGenerationResultSchema,
  buildArcOutlineMessages,
  buildBeatOutlineMessages,
  buildCastExpansionMessages,
  buildStoryOutlineMessages,
  castExpansionResultSchema,
  storyOutlineGenerationResultSchema,
} from "./prompts/index.js";
import { loadStoryProject } from "./project/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { bootstrapProject } from "./v1-lib.js";

function logStage(stage: string, detail: string): void {
  console.log(`[${stage}] ${detail}`);
}

export interface GenerateOutlineStackOptions {
  projectId: string;
  targetChapterCount?: number;
  targetArcCount?: number;
  desiredLongTermCastSize?: number;
}

export interface GenerateOutlineStackResult {
  projectId: string;
  storyOutline: StoryOutline;
  cast: CastCharacterOutline[];
  arcOutlines: ArcOutline[];
  beatOutlines: BeatOutline[];
}

export interface OutlineValidationResult {
  projectId: string;
  ok: boolean;
  arcCount: number;
  beatCount: number;
  targetChapterCount: number;
  issues: string[];
}

function validateArcCoverage(
  arcOutlines: ArcOutline[],
  targetArcCount: number,
  targetChapterCount: number,
): void {
  if (arcOutlines.length !== targetArcCount) {
    throw new Error(
      `Arc outline generation failed validation: expected ${targetArcCount} arcs, got ${arcOutlines.length}.`,
    );
  }

  const sorted = [...arcOutlines].sort(
    (left, right) => (left.chapterRangeHint?.start ?? 0) - (right.chapterRangeHint?.start ?? 0),
  );

  let expectedStart = 1;
  for (const arc of sorted) {
    if (!arc.chapterRangeHint) {
      throw new Error(`Arc outline ${arc.id} is missing chapterRangeHint.`);
    }

    if (arc.chapterRangeHint.start !== expectedStart) {
      throw new Error(
        `Arc outline generation failed validation: expected arc ${arc.id} to start at chapter ${expectedStart}, got ${arc.chapterRangeHint.start}.`,
      );
    }

    if (arc.chapterRangeHint.end < arc.chapterRangeHint.start) {
      throw new Error(
        `Arc outline generation failed validation: arc ${arc.id} has invalid range ${arc.chapterRangeHint.start}-${arc.chapterRangeHint.end}.`,
      );
    }

    expectedStart = arc.chapterRangeHint.end + 1;
  }

  if (expectedStart - 1 !== targetChapterCount) {
    throw new Error(
      `Arc outline generation failed validation: expected final covered chapter ${targetChapterCount}, got ${expectedStart - 1}.`,
    );
  }
}

function validateCastSize(cast: CastCharacterOutline[], desiredLongTermCastSize: number): void {
  if (cast.length !== desiredLongTermCastSize) {
    throw new Error(
      `Cast generation failed validation: expected ${desiredLongTermCastSize} long-term characters, got ${cast.length}.`,
    );
  }
}

function validateBeatCoverage(beatOutlines: BeatOutline[], arcOutlines: ArcOutline[]): void {
  for (const arc of arcOutlines) {
    if (!arc.chapterRangeHint) {
      throw new Error(`Arc outline ${arc.id} is missing chapterRangeHint.`);
    }

    const beats = beatOutlines
      .filter((beat) => beat.arcId === arc.id)
      .sort((left, right) => left.order - right.order);

    if (beats.length === 0) {
      throw new Error(`Beat outline generation failed validation: arc ${arc.id} has no beats.`);
    }

    let expectedOrder = 1;
    let expectedStart = arc.chapterRangeHint.start;
    for (const beat of beats) {
      if (beat.order !== expectedOrder) {
        throw new Error(
          `Beat outline generation failed validation: arc ${arc.id} expected beat order ${expectedOrder}, got ${beat.order}.`,
        );
      }
      expectedOrder += 1;

      if (!beat.chapterRangeHint) {
        throw new Error(
          `Beat outline generation failed validation: beat ${beat.id} is missing chapterRangeHint.`,
        );
      }

      if (beat.chapterRangeHint.start !== expectedStart) {
        throw new Error(
          `Beat outline generation failed validation: arc ${arc.id} expected beat ${beat.id} to start at chapter ${expectedStart}, got ${beat.chapterRangeHint.start}.`,
        );
      }

      if (beat.chapterRangeHint.end < beat.chapterRangeHint.start) {
        throw new Error(
          `Beat outline generation failed validation: beat ${beat.id} has invalid range ${beat.chapterRangeHint.start}-${beat.chapterRangeHint.end}.`,
        );
      }

      expectedStart = beat.chapterRangeHint.end + 1;
    }

    if (expectedStart - 1 !== arc.chapterRangeHint.end) {
      throw new Error(
        `Beat outline generation failed validation: arc ${arc.id} expected final covered chapter ${arc.chapterRangeHint.end}, got ${expectedStart - 1}.`,
      );
    }
  }
}

function attachBeatIdsToArcs(
  arcOutlines: ArcOutline[],
  beatOutlines: BeatOutline[],
): ArcOutline[] {
  return arcOutlines.map((arc) => {
    const beatIds = beatOutlines
      .filter((beat) => beat.arcId === arc.id)
      .sort((left, right) => left.order - right.order)
      .map((beat) => beat.id);

    return {
      ...arc,
      beatIds,
    };
  });
}

function coreCharacters(project: StoryProject): Array<{ id: string; name: string; role: string }> {
  return project.characters.slice(0, 2).map((character, index) => ({
    id: character.id,
    name: character.name,
    role: index === 0 ? "protagonist" : "core counterpart",
  }));
}

function dedupeCast(cast: CastCharacterOutline[]): CastCharacterOutline[] {
  const seen = new Set<string>();
  const result: CastCharacterOutline[] = [];
  for (const item of cast) {
    const key = `${item.id}::${item.name}`.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export async function generateOutlineStack(
  options: GenerateOutlineStackOptions,
): Promise<GenerateOutlineStackResult> {
  logStage("outline", `bootstrap project=${options.projectId}`);
  await bootstrapProject(options.projectId);

  const repository = new FileProjectRepository();
  const project = await loadStoryProject(repository, options.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${options.projectId}`);
  }

  const service = new LlmService();
  const authorPacks = buildDerivedAuthorProfilePacks(project.authorProfile);

  logStage("outline", "llm: story_outline");
  const storyOutlineResult = await service.generateObjectForTask({
    task: "story_outline",
    messages: buildStoryOutlineMessages({
      projectTitle: project.title,
      authorProfile: authorPacks.compact,
      themeBible: project.themeBible,
      styleBible: project.styleBible,
      storySetup: project.storySetup,
      targetChapterCount: options.targetChapterCount ?? 250,
      targetArcCount: options.targetArcCount ?? 10,
    }),
    schema: storyOutlineGenerationResultSchema,
    temperature: 0.2,
    maxTokens: 2600,
  });

  const storyOutline = storyOutlineResult.object.storyOutline;
  const arcBlueprints = storyOutlineResult.object.arcBlueprints;

  logStage("outline", "llm: cast_expansion");
  const desiredLongTermCastSize = options.desiredLongTermCastSize ?? 6;
  const firstCastResult = await service.generateObjectForTask({
    task: "cast_expansion",
    messages: buildCastExpansionMessages({
      projectTitle: project.title,
      authorProfile: authorPacks.compact,
      storyOutline,
      arcBlueprints,
      existingCoreCharacters: coreCharacters(project),
      desiredLongTermCastSize,
    }),
    schema: castExpansionResultSchema,
    temperature: 0.2,
    maxTokens: 2600,
  });
  let cast = dedupeCast(firstCastResult.object.cast);
  if (cast.length < desiredLongTermCastSize) {
    const missing = desiredLongTermCastSize - cast.length;
    logStage("outline", `llm: cast_expansion topup missing=${missing}`);
    const topupResult = await service.generateObjectForTask({
      task: "cast_expansion",
      messages: buildCastExpansionMessages({
        projectTitle: project.title,
        authorProfile: authorPacks.compact,
        storyOutline,
        arcBlueprints,
        existingCoreCharacters: [
          ...coreCharacters(project),
          ...cast.map((item) => ({
            id: item.id,
            name: item.name,
            role: item.role,
          })),
        ],
        desiredLongTermCastSize: missing,
      }),
      schema: castExpansionResultSchema,
      temperature: 0.2,
      maxTokens: 2200,
    });
    cast = dedupeCast([...cast, ...topupResult.object.cast]).slice(0, desiredLongTermCastSize);
  }

  logStage("outline", "llm: arc_outline");
  const arcResult = await service.generateObjectForTask({
    task: "arc_outline",
    messages: buildArcOutlineMessages({
      projectTitle: project.title,
      storyOutline,
      arcBlueprints,
      cast,
      targetArcCount: options.targetArcCount ?? 10,
      targetChapterCount: options.targetChapterCount ?? 250,
    }),
    schema: arcOutlineGenerationResultSchema,
    temperature: 0.2,
    maxTokens: 3200,
  });
  logStage("outline", "llm: beat_outline");
  const allBeatOutlines = [];
  for (const arc of arcResult.object.arcOutlines) {
    logStage("outline", `llm: beat_outline arc=${arc.id}`);
    const beatResult = await service.generateObjectForTask({
      task: "beat_outline",
      messages: buildBeatOutlineMessages({
        projectTitle: project.title,
        storyOutline,
        arcOutlines: [arc],
        targetChapterCount: options.targetChapterCount ?? 250,
      }),
      schema: beatOutlineGenerationResultSchema,
      temperature: 0.2,
      maxTokens: 3200,
    });
    allBeatOutlines.push(...beatResult.object.beatOutlines);
  }

  logStage("outline", "validate: cast/arc/beat coverage");
  validateCastSize(cast, desiredLongTermCastSize);
  validateArcCoverage(
    arcResult.object.arcOutlines,
    options.targetArcCount ?? 10,
    options.targetChapterCount ?? 250,
  );
  validateBeatCoverage(allBeatOutlines, arcResult.object.arcOutlines);
  const arcOutlinesWithBeatIds = attachBeatIdsToArcs(
    arcResult.object.arcOutlines,
    allBeatOutlines,
  );

  logStage("outline", "save: story/cast/arc/beat files");
  await repository.saveStoryOutline(options.projectId, storyOutline);
  await repository.saveCastOutlines(options.projectId, cast);
  await repository.saveArcOutlines(options.projectId, arcOutlinesWithBeatIds);
  await repository.saveBeatOutlines(options.projectId, allBeatOutlines);

  logStage("outline", "done");
  return {
    projectId: options.projectId,
    storyOutline,
    cast,
    arcOutlines: arcOutlinesWithBeatIds,
    beatOutlines: allBeatOutlines,
  };
}

export function formatOutlineStackResult(result: GenerateOutlineStackResult): string {
  const lines: string[] = [];

  lines.push(`Project: ${result.projectId}`);
  lines.push(`Story outline: ${result.storyOutline.title}`);
  lines.push(`Theme: ${result.storyOutline.coreTheme}`);
  lines.push(`Ending target: ${result.storyOutline.endingTarget}`);
  lines.push(`Cast generated: ${result.cast.length}`);
  lines.push(`Arc outlines generated: ${result.arcOutlines.length}`);
  lines.push(`Beat outlines generated: ${result.beatOutlines.length}`);

  lines.push("");
  lines.push("Long-term cast:");
  for (const item of result.cast) {
    lines.push(`- ${item.name}: ${item.storyFunction}`);
  }

  lines.push("");
  lines.push("Arcs:");
  for (const arc of result.arcOutlines) {
    const range = arc.chapterRangeHint
      ? `${arc.chapterRangeHint.start}-${arc.chapterRangeHint.end}`
      : "unspecified";
    lines.push(`- ${arc.id} (${range}): ${arc.name}`);
    lines.push(`  Goal: ${arc.arcGoal}`);
  }

  return lines.join("\n");
}

export async function validateOutlineStack(options: {
  projectId: string;
}): Promise<OutlineValidationResult> {
  const repository = new FileProjectRepository();
  const project = await loadStoryProject(repository, options.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${options.projectId}`);
  }

  const issues: string[] = [];
  const arcOutlines = project.arcOutlines;
  const beatOutlines = project.beatOutlines;
  const sortedArcs = [...arcOutlines].sort(
    (left, right) => (left.chapterRangeHint?.start ?? 0) - (right.chapterRangeHint?.start ?? 0),
  );
  const targetChapterCount = sortedArcs[sortedArcs.length - 1]?.chapterRangeHint?.end ?? 0;

  if (!project.storyOutline) {
    issues.push("story-outline.json is missing.");
  }
  if (arcOutlines.length === 0) {
    issues.push("arc-outlines.json is empty.");
  }
  if (beatOutlines.length === 0) {
    issues.push("beat-outlines.json is empty.");
  }
  if (targetChapterCount < 1) {
    issues.push("Cannot infer target chapter count from arc outlines.");
  }

  if (arcOutlines.length > 0 && targetChapterCount > 0) {
    try {
      validateArcCoverage(arcOutlines, arcOutlines.length, targetChapterCount);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (arcOutlines.length > 0 && beatOutlines.length > 0) {
    try {
      validateBeatCoverage(beatOutlines, arcOutlines);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    projectId: options.projectId,
    ok: issues.length === 0,
    arcCount: arcOutlines.length,
    beatCount: beatOutlines.length,
    targetChapterCount,
    issues,
  };
}

export function formatOutlineValidationResult(result: OutlineValidationResult): string {
  const lines: string[] = [];

  lines.push(`Project: ${result.projectId}`);
  lines.push(`Outline valid: ${result.ok ? "yes" : "no"}`);
  lines.push(`Arcs: ${result.arcCount}`);
  lines.push(`Beats: ${result.beatCount}`);
  lines.push(`Target chapters: ${result.targetChapterCount}`);

  if (result.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of result.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join("\n");
}
