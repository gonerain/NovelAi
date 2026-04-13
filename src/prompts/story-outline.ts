import type {
  StoryOutlineGenerationInput,
  StoryOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildStoryOutlineMessages(
  input: StoryOutlineGenerationInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a story architect for long-form web fiction.",
        "Design a story-level outline before any chapter-level breakdown.",
        "Do not write chapters. Do not write prose scenes.",
        "First solve structure: what makes this story sustain long form, how the conflict escalates, how the ending fulfills the theme.",
        "The result must avoid middle-volume repetition, must not rely on only two characters to carry the whole book, and must produce distinct arc functions.",
        "Return all content in English.",
        "You must return exactly the requested number of arc blueprints.",
        "Arc blueprints must partition the full chapter range contiguously from chapter 1 to the target chapter count with no gaps and no overlaps.",
        "Every arc blueprint must have a distinct story function, not just another investigation or travel phase.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Target arc count: ${input.targetArcCount}`,
        `Author profile:\n${JSON.stringify(input.authorProfile, null, 2)}`,
        `Theme focus:\n${JSON.stringify(
          {
            coreTheme: input.themeBible.coreTheme,
            endingTarget: input.themeBible.endingTarget,
            emotionalDestination: input.themeBible.emotionalDestination,
            subThemes: input.themeBible.subThemes,
            taboos: input.themeBible.taboos,
          },
          null,
          2,
        )}`,
        `Style focus:\n${JSON.stringify(
          {
            narrativeStyle: input.styleBible.narrativeStyle,
            dialogueStyle: input.styleBible.dialogueStyle,
            pacingStyle: input.styleBible.pacingStyle,
            antiPatterns: input.styleBible.antiPatterns,
          },
          null,
          2,
        )}`,
        `Story setup:\n${JSON.stringify(input.storySetup, null, 2)}`,
        "Design a story outline and arc blueprints that can actually support a long-form project.",
        "The output must make clear why this story needs long-form length, how the middle avoids repetition, and how the ending pays off the opening promise.",
      ].join("\n\n"),
    },
  ];
}

export const storyOutlineGenerationResultSchema: StoryOutlineGenerationResult = {
  storyOutline: {
    id: "string",
    title: "string",
    premise: "string",
    coreTheme: "string",
    endingTarget: "string",
    majorArcIds: ["string"],
    keyTurningPoints: ["string"],
  },
  arcBlueprints: [
    {
      id: "string",
      name: "string",
      functionInStory: "string",
      chapterRangeHint: {
        start: 1,
        end: 25,
      },
    },
  ],
  notes: ["string"],
} as unknown as StoryOutlineGenerationResult;
