import type {
  AuthorInterviewQuestion,
  AuthorInterviewResult,
  AuthorInterviewSessionInput,
} from "../domain/author-interview.js";
import type { ChatMessage } from "../llm/types.js";

export const authorInterviewQuestions: AuthorInterviewQuestion[] = [
  {
    id: "theme_core",
    prompt:
      "What themes do you most want to write again and again? What should the characters finally understand, lose, protect, or redeem?",
    intent: "Capture the author's core themes and emotional destination.",
  },
  {
    id: "character_bias",
    prompt:
      "What kinds of characters do you instinctively favor? What wounds, flaws, obsessions, desires, or masks do they usually carry?",
    intent: "Capture preferred character archetypes and wounds.",
  },
  {
    id: "relationship_pattern",
    prompt:
      "How do you prefer characters to pull, hurt, avoid, approach, and repair each other? What kind of relationship tension do you like most?",
    intent: "Capture relationship dynamics and repair rules.",
  },
  {
    id: "plot_bias",
    prompt:
      "How do you like stories to move? Slow burn, explosive turns, dense plotting, emotional causality, or something else?",
    intent: "Capture plotting and pacing preferences.",
  },
  {
    id: "ending_bias",
    prompt:
      "What kind of ending feels right to you? What kinds of loss, cost, regret, fulfillment, or closure can you accept?",
    intent: "Capture ending shape and acceptable cost.",
  },
  {
    id: "aesthetic_private_goods",
    prompt:
      "What motifs, scenes, images, dynamics, private obsessions, or hard dislikes do you always sneak into your stories?",
    intent: "Capture motifs, aesthetic patterns, and hard dislikes.",
  },
];

const allowedCategories = [
  "theme",
  "style",
  "character",
  "plot",
  "conflict",
  "ending",
  "aesthetic",
  "constraint",
] as const;

export function buildAuthorInterviewMessages(
  input: AuthorInterviewSessionInput,
): ChatMessage[] {
  const projectContext = input.targetProject
    ? [
        input.targetProject.title ? `Project title: ${input.targetProject.title}` : undefined,
        input.targetProject.premise ? `Premise: ${input.targetProject.premise}` : undefined,
        input.targetProject.themeHint ? `Theme hint: ${input.targetProject.themeHint}` : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const priorProfile = input.priorProfile
    ? `Existing author profile for reference:\n${JSON.stringify(input.priorProfile, null, 2)}`
    : "";

  const answers = input.userRawAnswers
    .map((item) => {
      const question =
        authorInterviewQuestions.find((question) => question.id === item.questionId)?.prompt ??
        item.questionId;

      return `Question: ${question}\nAnswer: ${item.answer}`;
    })
    .join("\n\n");

  return [
    {
      role: "system",
      content: [
        "You are an author preference modeler.",
        "Your task is not to write fiction. Your task is to convert the author's natural-language answers into a compact, structured author profile.",
        "Output must contain both display and normalized sections.",
        "display is for a human author to confirm. Keep it short and readable, not essay-like.",
        "normalized is for programmatic use. It must be shorter, harder, and more stable.",
        "Each normalized authorProfile array should contain at most 3 items.",
        "Generate between 3 and 5 components only.",
        `component.category must be one of: ${allowedCategories.join(", ")}.`,
        "Do not invent categories such as relationship or pacing.",
        "For normalized components, keep each string brief and operational.",
        "Constraints: at most 3. Open questions: at most 2. Conflicts detected: at most 2.",
        "If something is unclear, put it in openQuestions or conflictsDetected instead of inventing certainty.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        projectContext,
        priorProfile,
        "Build the author model from the following interview answers:",
        answers,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const authorInterviewResultSchema: AuthorInterviewResult = {
  display: {
    summary: "string",
    authorProfile: {
      summary: "string",
      corePreferences: ["string"],
      favoriteCharacterTypes: ["string"],
      favoriteRelationshipPatterns: ["string"],
      plotBiases: ["string"],
      endingBiases: ["string"],
      aestheticMotifs: ["string"],
    },
    components: [
      {
        id: "string",
        name: "string",
        category: "theme",
        description: "string",
        strengthens: ["string"],
        suppresses: ["string"],
        effects: {
          planner: ["string"],
          writer: ["string"],
          reviewer: ["string"],
          memory: ["string"],
        },
        validationHints: ["string"],
        priority: 1,
      },
    ],
    constraints: [
      {
        id: "string",
        name: "string",
        description: "string",
        severity: "medium",
      },
    ],
    openQuestions: ["string"],
    conflictsDetected: [
      {
        description: "string",
        priority: "medium",
      },
    ],
  },
  normalized: {
    authorProfile: {
      summary: "string",
      corePreferences: ["string"],
      favoriteCharacterTypes: ["string"],
      favoriteRelationshipPatterns: ["string"],
      plotBiases: ["string"],
      endingBiases: ["string"],
      aestheticMotifs: ["string"],
    },
    components: [
      {
        id: "string",
        name: "string",
        category: "theme",
        strengthens: ["string"],
        suppresses: ["string"],
        plannerEffects: ["string"],
        writerEffects: ["string"],
        reviewerChecks: ["string"],
        memoryHints: ["string"],
        priority: 1,
      },
    ],
    constraints: [
      {
        id: "string",
        name: "string",
        description: "string",
        severity: "medium",
      },
    ],
  },
} as unknown as AuthorInterviewResult;
