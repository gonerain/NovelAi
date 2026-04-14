import type {
  BeatOutlineGenerationInput,
  BeatOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildBeatOutlineMessages(
  input: BeatOutlineGenerationInput,
): ChatMessage[] {
  const compactStoryOutline = {
    id: input.storyOutline.id,
    title: input.storyOutline.title,
    coreTheme: input.storyOutline.coreTheme,
    endingTarget: input.storyOutline.endingTarget,
  };
  const compactArcs = input.arcOutlines.map((arc) => ({
    id: arc.id,
    name: arc.name,
    arcGoal: arc.arcGoal,
    chapterRangeHint: arc.chapterRangeHint,
    memoryRequirements: arc.memoryRequirements.slice(0, 5),
    requiredTurns: arc.requiredTurns.slice(0, 4),
    relationshipChanges: arc.relationshipChanges.slice(0, 4),
  }));

  return [
    {
      role: "system",
      content: [
        "Task: Convert arc outlines into beat outlines.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, concise Chinese is preferred; English is allowed when clearer.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- For each arc generate 3 to 6 beats.",
        "- Beat chapter ranges must fully cover arc range contiguously with no overlap.",
        "- Beat order starts at 1 per arc and increments by 1.",
        "- Each beat must include beatGoal/conflict/expectedChange/constraints/revealTargets.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Story outline (compressed):\n${JSON.stringify(compactStoryOutline, null, 2)}`,
        `Arc outlines (compressed):\n${JSON.stringify(compactArcs, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export const beatOutlineGenerationResultSchema: BeatOutlineGenerationResult = {
  beatOutlines: [
    {
      id: "string",
      arcId: "string",
      order: 1,
      chapterRangeHint: {
        start: 1,
        end: 3,
      },
      beatGoal: "string",
      conflict: "string",
      expectedChange: "string",
      requiredCharacters: ["string"],
      requiredMemories: ["string"],
      payoffPatternIds: ["string"],
      revealTargets: ["string"],
      constraints: ["string"],
      openingAnchor: {
        readerAnchor: ["string"],
        relationshipAnchor: ["string"],
        worldAnchor: ["string"],
        hook: "string",
      },
    },
  ],
  notes: ["string"],
} as unknown as BeatOutlineGenerationResult;
