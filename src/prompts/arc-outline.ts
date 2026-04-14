import type {
  ArcOutlineGenerationInput,
  ArcOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildArcOutlineMessages(
  input: ArcOutlineGenerationInput,
): ChatMessage[] {
  const compactStoryOutline = {
    id: input.storyOutline.id,
    title: input.storyOutline.title,
    coreTheme: input.storyOutline.coreTheme,
    endingTarget: input.storyOutline.endingTarget,
  };
  const compactCast = input.cast.map((item) => ({
    id: item.id,
    role: item.role,
    storyFunction: item.storyFunction,
    coreTension: item.coreTension,
  }));

  return [
    {
      role: "system",
      content: [
        "Task: Convert arc blueprints into arc outlines.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, concise Chinese is preferred; English is allowed when clearer.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- Exactly targetArcCount arc outlines.",
        "- Preserve blueprint ids and chapter ranges.",
        "- Distinct arc functions and relationship pressure per arc.",
        "- Do not write chapter prose.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target arc count: ${input.targetArcCount}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Story outline (compressed):\n${JSON.stringify(compactStoryOutline, null, 2)}`,
        `Arc blueprints:\n${JSON.stringify(input.arcBlueprints, null, 2)}`,
        `Cast skeleton (compressed):\n${JSON.stringify(compactCast, null, 2)}`,
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
