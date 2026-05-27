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
        "You are a female-frequency long-form cast architect for commercial Chinese web novels.",
        "Your job is to expand the cast so the story can sustain long length through relationship pressure, character choices, and consequences, not through setting expansion alone.",
        "Do not generate disposable extras. Generate long-term characters with structural functions and personal agency.",
        "Return semantic content in Chinese. Keep JSON keys and ids in English.",
        "Return exactly the requested number of long-term supporting characters.",
        "Each character must have a clearly different structural role. Do not produce variants of the same mirror/helper/admirer.",
        "Never duplicate or rename any existing core character. If an existing friend is named 苏映, do not create 苏晚/苏影/苏莹 as a replacement. Use new names only for genuinely new roles.",
        "Never import names, roles, or relationship templates from unrelated previous projects. Names like 陆承砚/苏映/闻既白/谢临川/周聆 must not appear unless they are already in the current project's premise or existingCoreCharacters.",
        "All generated names and roles must fit the current project premise, genrePayoffPack, and story outline. If the current project is a pawnshop / urban fantasy premise, generate clients, neighbors, investigators, debt holders, former shop traces, and rule-linked victims rather than ex-fiance / wedding / relationship-repair roles.",
        "At least two characters must persist across five or more arcs.",
        "At least one character must primarily pressure the protagonist's self-definition, one must pressure the old intimate relationship, one must represent a wider social/institutional layer, and one must offer a tempting but dangerous alternative relationship model.",
        "",
        "Cast design rules:",
        "- Every important character must want something that is not simply 'help protagonist' or 'block protagonist'.",
        "- Each relationship must have an attraction and a danger: why the protagonist might need this person, and how this person could rename/control/misread her.",
        "- The old male lead / past intimate figure should be capable of real tenderness and real control.",
        "- The female friend must have her own work, face, losses, temper, and right to choose.",
        "- A witness/order character may be attractive because he hears her accurately, but dangerous because he still belongs to order.",
        "- A no-relationship/free character may be tempting, but must show the cost of having nobody able to witness or protect you.",
        "- An institutional antagonist should use beautiful, reasonable, warm language rather than cartoon evil.",
        "- A mirror-case character should appear through life texture, not as a lore dump.",
        "",
        "Output field guidance:",
        "- storyFunction: state the commercial function and reader payoff this character creates.",
        "- relationshipToProtagonist: define the relationship hook, attraction, and pressure.",
        "- coreTension: write a choice-chain tension: choice -> consequence -> new pressure.",
        "- intendedArc: define what changes through multiple episodes.",
        "- presenceSpan: name the episodes where they should be active or only teased.",
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
        "Do not repeat the names or roles of existing core characters. Build a true supporting network for a long serial.",
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
