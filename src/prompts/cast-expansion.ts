import type {
  CastExpansionInput,
  CastExpansionResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildCastExpansionMessages(input: CastExpansionInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a long-form cast architect.",
        "Your job is to expand the cast so the story can sustain long length without collapsing into a two-character loop.",
        "Do not generate disposable extras. Generate long-term characters with structural functions.",
        "At least some characters must persist across multiple arcs and provide distinct tension for both protagonist and senior brother.",
        "Return all content in English.",
        "Return exactly the requested number of long-term supporting characters.",
        "Each character must have a clearly different structural role. Do not produce variants of the same mirror or helper.",
        "At least two characters must persist across five or more arcs.",
        "At least one character must primarily pressure the protagonist, one must pressure the senior brother, one must represent a wider faction or social layer, and one must destabilize the core relationship from outside.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Desired long-term cast size: ${input.desiredLongTermCastSize}`,
        `Author profile:\n${JSON.stringify(input.authorProfile, null, 2)}`,
        `Story outline:\n${JSON.stringify(input.storyOutline, null, 2)}`,
        `Arc blueprints:\n${JSON.stringify(input.arcBlueprints, null, 2)}`,
        `Existing core characters:\n${JSON.stringify(input.existingCoreCharacters, null, 2)}`,
        "Generate the long-term supporting cast needed to sustain the project.",
        "Do not repeat the roles of the protagonist or senior brother. Build a true supporting network for a long serial.",
      ].join("\n\n"),
    },
  ];
}

export const castExpansionResultSchema: CastExpansionResult = {
  cast: [
    {
      id: "string",
      name: "string",
      role: "string",
      storyFunction: "string",
      relationshipToProtagonist: "string",
      relationshipToSeniorBrother: "string",
      coreTension: "string",
      intendedArc: "string",
      presenceSpan: "string",
    },
  ],
  notes: ["string"],
} as unknown as CastExpansionResult;
