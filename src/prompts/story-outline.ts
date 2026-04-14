import type {
  StoryOutlineGenerationInput,
  StoryOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildStoryOutlineMessages(
  input: StoryOutlineGenerationInput,
): ChatMessage[] {
  const compactAuthorProfile = {
    summary: input.authorProfile.summary,
    corePreferences: input.authorProfile.corePreferences.slice(0, 6),
    plotBiases: input.authorProfile.plotBiases.slice(0, 6),
    endingBiases: input.authorProfile.endingBiases.slice(0, 6),
    topConstraints: input.authorProfile.topConstraints.slice(0, 4).map((item) => item.description),
  };

  const compactTheme = {
    coreTheme: input.themeBible.coreTheme,
    endingTarget: input.themeBible.endingTarget,
    emotionalDestination: input.themeBible.emotionalDestination,
    subThemes: input.themeBible.subThemes.slice(0, 5),
    taboos: input.themeBible.taboos.slice(0, 4),
  };

  const compactStyle = {
    narrativeStyle: input.styleBible.narrativeStyle.slice(0, 4),
    pacingStyle: input.styleBible.pacingStyle.slice(0, 4),
    antiPatterns: input.styleBible.antiPatterns.slice(0, 5),
  };

  const compactSetup = {
    premise: input.storySetup.premise,
    currentArcGoal: input.storySetup.currentArcGoal,
    openingSituation: input.storySetup.openingSituation,
    defaultActiveCharacterIds: input.storySetup.defaultActiveCharacterIds.slice(0, 4),
  };

  return [
    {
      role: "system",
      content: [
        "Task: Generate story-level outline and arc blueprints only.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, concise Chinese is preferred; English is allowed when clearer.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- Exactly targetArcCount arc blueprints.",
        "- Arc blueprints must fully cover chapter 1..targetChapterCount, contiguous, no gaps, no overlaps.",
        "- Arc functions must be distinct; avoid repeated generic arc shapes.",
        "- Do not write chapter prose.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Target arc count: ${input.targetArcCount}`,
        `Author profile (compressed):\n${JSON.stringify(compactAuthorProfile, null, 2)}`,
        `Theme (compressed):\n${JSON.stringify(compactTheme, null, 2)}`,
        `Style (compressed):\n${JSON.stringify(compactStyle, null, 2)}`,
        `Story setup (compressed):\n${JSON.stringify(compactSetup, null, 2)}`,
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
