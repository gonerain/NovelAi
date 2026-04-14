import type {
  BeatOutlineGenerationInput,
  BeatOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildBeatOutlineMessages(
  input: BeatOutlineGenerationInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a beat architect for long-form web fiction.",
        "Convert arc outlines into beat-level structure that can guide chapter planning.",
        "Every arc must have 3 to 6 beats.",
        "Each beat must include: beatGoal, conflict, expectedChange, constraints, revealTargets.",
        "Every beat must include chapterRangeHint.",
        "For each arc, beat chapter ranges must be contiguous, non-overlapping, and fully cover the arc chapter range.",
        "Beat order must start from 1 inside each arc and increase by 1.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Story outline:\n${JSON.stringify(input.storyOutline, null, 2)}`,
        `Arc outlines:\n${JSON.stringify(input.arcOutlines, null, 2)}`,
        "Generate beat outlines for each arc using the arc ranges as hard boundaries.",
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
