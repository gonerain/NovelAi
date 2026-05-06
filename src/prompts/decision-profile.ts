import type {
  CharacterDecisionProfile,
  CharacterState,
  StoryOutline,
  ThemeBible,
} from "../domain/index.js";
import type { DerivedAuthorProfilePacks } from "../domain/author-profile-packs.js";
import type { ChatMessage } from "../llm/types.js";

export interface DecisionProfileGenerationInput {
  character: CharacterState;
  authorPack: DerivedAuthorProfilePacks["planner"];
  themeBible: ThemeBible;
  storyOutline: StoryOutline | undefined;
  premise: string;
}

export interface DecisionProfileGenerationResult {
  decisionProfile: CharacterDecisionProfile;
  notes: string[];
}

export function buildDecisionProfileMessages(
  input: DecisionProfileGenerationInput,
): ChatMessage[] {
  const character = input.character;

  const characterSnapshot = {
    id: character.id,
    name: character.name,
    archetype: character.archetype ?? null,
    coreTraits: character.coreTraits.slice(0, 6),
    desires: character.desires.slice(0, 5),
    fears: character.fears.slice(0, 5),
    wounds: character.wounds.slice(0, 5),
    voiceNotes: character.voiceNotes.slice(0, 5),
    currentGoals: character.currentGoals.slice(0, 5),
    knowledgeBoundary: character.knowledgeBoundary.slice(0, 4),
    secretsKept: character.secretsKept.slice(0, 4),
    relationships: character.relationships.slice(0, 4).map((relationship) => ({
      targetCharacterId: relationship.targetCharacterId,
      type: relationship.type,
      publicLabel: relationship.publicLabel,
      privateTruth: relationship.privateTruth,
      trustLevel: relationship.trustLevel,
      tensionLevel: relationship.tensionLevel,
      dependencyLevel: relationship.dependencyLevel,
    })),
  };

  return [
    {
      role: "system",
      content: [
        "Task: produce one CharacterDecisionProfile object for the given character.",
        "A decision profile is the rule-set that explains why this character chooses what they choose under pressure. It is NOT a personality summary.",
        "Hard constraints:",
        "- Output JSON only, no prose.",
        "- Keep JSON keys in English exactly. Field values can be Chinese for semantic content.",
        "- Every string field must be a single concise sentence (no lists in a string).",
        "- Every array field must contain 2-4 distinct items. No empty arrays.",
        "- Items must be specific to THIS character. Do not produce generic life advice.",
        "- Items must be operationally useful: the writer should be able to read one and decide what the character refuses, accepts, or breaks under right now.",
        "Field semantics:",
        "- coreDesire: the deep want this character keeps even when scared.",
        "- coreFear: the loss they would do almost anything to avoid.",
        "- falseBelief: the wrong rule they keep applying to themselves or others.",
        "- defaultCopingStyle: how they behave when overwhelmed (withdraw / control / attack / mask / negotiate / dissociate / overcommit / mock).",
        "- controlPattern: the kind of leverage they reach for first (information / proximity / silence / threat / favor / labor / status).",
        "- unacceptableCosts: 2-4 prices they refuse to pay even for their goal. These should differ from generic morals.",
        "- likelyCompromises: 2-4 prices they secretly will pay, with self-justification.",
        "- relationshipSoftSpots: 2-4 specific named or labelled relationships where their boundaries crack.",
        "- breakThresholds: 2-4 concrete pressure levels where their default coping fails and behaviour changes.",
        "Style rules:",
        "- Reference the character's known wounds, secretsKept, fears, and current goals. Do not contradict them.",
        "- Reference their relationships when relevant. relationshipSoftSpots should usually point at real targetCharacterIds.",
        "- Do not narrate plot events; describe internal decision rules.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Premise: ${input.premise}`,
        input.storyOutline
          ? `Story core theme: ${input.storyOutline.coreTheme}\nEnding target: ${input.storyOutline.endingTarget}`
          : undefined,
        `Theme baseline: core=${input.themeBible.coreTheme}; ending=${input.themeBible.endingTarget}; subthemes=${input.themeBible.subThemes.slice(0, 4).join(" | ")}`,
        `Author summary: ${input.authorPack.summary}`,
        `Author must rules: ${input.authorPack.mustRules.join(" | ")}`,
        `Character snapshot:\n${JSON.stringify(characterSnapshot, null, 2)}`,
        "Produce the decisionProfile for this character only.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const decisionProfileGenerationResultSchema: DecisionProfileGenerationResult = {
  decisionProfile: {
    coreDesire: "string",
    coreFear: "string",
    falseBelief: "string",
    defaultCopingStyle: "string",
    controlPattern: "string",
    unacceptableCosts: ["string"],
    likelyCompromises: ["string"],
    relationshipSoftSpots: ["string"],
    breakThresholds: ["string"],
  },
  notes: ["string"],
} as unknown as DecisionProfileGenerationResult;
