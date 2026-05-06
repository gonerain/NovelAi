import type {
  ArcOutline,
  CharacterState,
  ProtagonistArc,
  StoryOutline,
  SupportingCharacterArc,
  ThemeBible,
} from "../domain/index.js";
import type { DerivedAuthorProfilePacks } from "../domain/author-profile-packs.js";
import type { ChatMessage } from "../llm/types.js";

export interface ArcShiftDeriveInput {
  arc: ArcOutline;
  protagonist: CharacterState;
  supportingCharacters: CharacterState[];
  authorPack: DerivedAuthorProfilePacks["planner"];
  themeBible: ThemeBible;
  storyOutline: StoryOutline | undefined;
}

export interface ArcShiftDeriveResult {
  protagonistArc: ProtagonistArc;
  supportingCharacterArcs: SupportingCharacterArc[];
  notes: string[];
}

function snapshotCharacter(character: CharacterState) {
  return {
    id: character.id,
    name: character.name,
    archetype: character.archetype ?? null,
    coreTraits: character.coreTraits.slice(0, 5),
    desires: character.desires.slice(0, 4),
    fears: character.fears.slice(0, 4),
    wounds: character.wounds.slice(0, 4),
    voiceNotes: character.voiceNotes.slice(0, 4),
    decisionProfile: character.decisionProfile,
  };
}

export function buildArcShiftDeriveMessages(input: ArcShiftDeriveInput): ChatMessage[] {
  const arcSnapshot = {
    id: input.arc.id,
    name: input.arc.name,
    arcGoal: input.arc.arcGoal,
    startState: input.arc.startState,
    endState: input.arc.endState,
    requiredTurns: input.arc.requiredTurns,
    relationshipChanges: input.arc.relationshipChanges,
    chapterRangeHint: input.arc.chapterRangeHint ?? null,
  };

  const supportingSnapshots = input.supportingCharacters
    .filter((character) => character.id !== input.protagonist.id)
    .slice(0, 5)
    .map(snapshotCharacter);

  return [
    {
      role: "system",
      content: [
        "Task: derive ProtagonistArc + SupportingCharacterArc[] for ONE arc.",
        "An ArcShift is NOT a description. It is a structured object that binds an internal change to a concrete on-page choice.",
        "Hard constraints:",
        "- JSON only.",
        "- Keep JSON keys in English. Field values can be Chinese.",
        "- Each ArcShift must populate ALL FOUR fields, with no placeholders:",
        "  - oldDefault: what this character would have done given their decisionProfile (their natural fallback under pressure).",
        "  - pressureTrigger: a specific on-page event (a scene, a confrontation, a piece of evidence) that forces a different call.",
        "  - newChoice: the concrete action they actually take instead — must be observable behaviour, not an emotion.",
        "  - costPaid: the visible price they pay for that choice — exposed information, leverage given up, relationship damage, identity revealed, future obligation taken on.",
        "- Forbidden output shapes (will be rejected):",
        "  - generic phrases like \"她变得主动\" / \"成长\" / \"突破自己\" / \"觉醒\".",
        "  - duplicated content across the four fields.",
        "  - cost stated as an emotion only (e.g. \"心痛\") with no observable consequence.",
        "- Produce 2-4 protagonistArc shifts; aim for one shift per major required turn.",
        "- supportingCharacterArcs: include only characters who actually grow or break in this arc. Skip pure observers.",
        "- expectedChapterRange must fall within the arc's chapter range hint when provided.",
        "- Each shift's id must be unique (e.g. \"shift_arc-id_01\").",
        "ProtagonistArc top-level fields:",
        "  - startInternalState: their default operating mode at arc start, expressed as behaviour rules they live by.",
        "  - endInternalState: their default operating mode at arc end.",
        "  - falseBeliefChallenged: the wrong rule from their decisionProfile.falseBelief that this arc breaks.",
        "  - costAccepted: the irreversible price they accept by arc end (concrete, not feeling-shaped).",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        input.storyOutline
          ? `Story core theme: ${input.storyOutline.coreTheme}\nEnding target: ${input.storyOutline.endingTarget}`
          : undefined,
        `Theme baseline: core=${input.themeBible.coreTheme}; ending=${input.themeBible.endingTarget}`,
        `Author summary: ${input.authorPack.summary}`,
        `Author must rules: ${input.authorPack.mustRules.join(" | ")}`,
        `Arc to derive shifts for:\n${JSON.stringify(arcSnapshot, null, 2)}`,
        `Protagonist (full decisionProfile must be respected):\n${JSON.stringify(snapshotCharacter(input.protagonist), null, 2)}`,
        supportingSnapshots.length > 0
          ? `Supporting cast (only include those who actually grow in this arc):\n${JSON.stringify(supportingSnapshots, null, 2)}`
          : undefined,
        "Produce protagonistArc.shifts and supportingCharacterArcs only for this arc. Do not write chapter prose.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const arcShiftDeriveResultSchema: ArcShiftDeriveResult = {
  protagonistArc: {
    startInternalState: "string",
    endInternalState: "string",
    falseBeliefChallenged: "string",
    costAccepted: "string",
    shifts: [
      {
        id: "string",
        oldDefault: "string",
        pressureTrigger: "string",
        newChoice: "string",
        costPaid: "string",
        expectedChapterRange: { start: 1, end: 1 },
      },
    ],
  },
  supportingCharacterArcs: [
    {
      characterId: "string",
      startState: "string",
      endState: "string",
      shifts: [
        {
          id: "string",
          oldDefault: "string",
          pressureTrigger: "string",
          newChoice: "string",
          costPaid: "string",
          expectedChapterRange: { start: 1, end: 1 },
        },
      ],
    },
  ],
  notes: ["string"],
} as unknown as ArcShiftDeriveResult;
