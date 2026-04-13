import type {
  ArcOutlineGenerationInput,
  ArcOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildArcOutlineMessages(
  input: ArcOutlineGenerationInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an arc architect for long-form web fiction.",
        "Convert the story-level outline into arc-level structure.",
        "Each arc must have a distinct function, a different start and end state, and clear required turns.",
        "Do not produce chapter lists here. Stay at arc level.",
        "Arc outlines must be usable later for beat breakdown.",
        "Return all content in English.",
        "You must return exactly the requested number of arc outlines.",
        "You must preserve the arc blueprint ids and chapter ranges.",
        "The final arc outlines must cover the entire chapter range from chapter 1 to the target chapter count with no gaps and no overlaps.",
        "Every arc must feature different relationship pressure and different plot function. Do not repeat 'investigate more' or 'travel to another place' as the main shape.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target arc count: ${input.targetArcCount}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Story outline:\n${JSON.stringify(input.storyOutline, null, 2)}`,
        `Arc blueprints:\n${JSON.stringify(input.arcBlueprints, null, 2)}`,
        `Cast skeleton:\n${JSON.stringify(input.cast, null, 2)}`,
        "Generate arc outlines that distribute plot pressure, character change, and relationship development across the project.",
        "Use the provided arc blueprints as the structural skeleton rather than inventing new chapter ranges.",
      ].join("\n\n"),
    },
  ];
}

export const arcOutlineGenerationResultSchema: ArcOutlineGenerationResult = {
  arcOutlines: [
    {
      id: "string",
      storyOutlineId: "string",
      name: "string",
      arcGoal: "string",
      startState: "string",
      endState: "string",
      requiredTurns: ["string"],
      relationshipChanges: ["string"],
      memoryRequirements: ["string"],
      beatIds: ["string"],
      chapterRangeHint: {
        start: 1,
        end: 25,
      },
    },
  ],
  notes: ["string"],
} as unknown as ArcOutlineGenerationResult;
