import type {
  ArcOutline,
  CastCharacterOutline,
  StoryOutline,
  StoryProject,
} from "./domain/index.js";
import { buildDerivedAuthorProfilePacks } from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import {
  arcOutlineGenerationResultSchema,
  buildArcOutlineMessages,
  buildCastExpansionMessages,
  buildStoryOutlineMessages,
  castExpansionResultSchema,
  storyOutlineGenerationResultSchema,
} from "./prompts/index.js";
import { loadStoryProject } from "./project/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { bootstrapProject } from "./v1-lib.js";

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

function coreCharacters(project: StoryProject): Array<{ id: string; name: string; role: string }> {
  return project.characters.slice(0, 2).map((character, index) => ({
    id: character.id,
    name: character.name,
    role: index === 0 ? "protagonist" : "core counterpart",
  }));
}

export async function generateOutlineStack(
  options: GenerateOutlineStackOptions,
): Promise<GenerateOutlineStackResult> {
  await bootstrapProject(options.projectId);

  const repository = new FileProjectRepository();
  const project = await loadStoryProject(repository, options.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${options.projectId}`);
  }

  const service = new LlmService();
  const authorPacks = buildDerivedAuthorProfilePacks(project.authorProfile);

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

  const castResult = await service.generateObjectForTask({
    task: "cast_expansion",
    messages: buildCastExpansionMessages({
      projectTitle: project.title,
      authorProfile: authorPacks.compact,
      storyOutline,
      arcBlueprints,
      existingCoreCharacters: coreCharacters(project),
      desiredLongTermCastSize: options.desiredLongTermCastSize ?? 6,
    }),
    schema: castExpansionResultSchema,
    temperature: 0.2,
    maxTokens: 2600,
  });

  const arcResult = await service.generateObjectForTask({
    task: "arc_outline",
    messages: buildArcOutlineMessages({
      projectTitle: project.title,
      storyOutline,
      arcBlueprints,
      cast: castResult.object.cast,
      targetArcCount: options.targetArcCount ?? 10,
      targetChapterCount: options.targetChapterCount ?? 250,
    }),
    schema: arcOutlineGenerationResultSchema,
    temperature: 0.2,
    maxTokens: 3200,
  });

  validateCastSize(castResult.object.cast, options.desiredLongTermCastSize ?? 6);
  validateArcCoverage(
    arcResult.object.arcOutlines,
    options.targetArcCount ?? 10,
    options.targetChapterCount ?? 250,
  );

  await repository.saveStoryOutline(options.projectId, storyOutline);
  await repository.saveCastOutlines(options.projectId, castResult.object.cast);
  await repository.saveArcOutlines(options.projectId, arcResult.object.arcOutlines);

  return {
    projectId: options.projectId,
    storyOutline,
    cast: castResult.object.cast,
    arcOutlines: arcResult.object.arcOutlines,
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
