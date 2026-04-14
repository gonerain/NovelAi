import type {
  AuthorInterviewDisplayDraftResult,
  AuthorInterviewNormalizedDraftResult,
  AuthorInterviewQuestion,
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
  "relationship",
  "pacing",
  "conflict",
  "ending",
  "aesthetic",
  "constraint",
] as const;

function buildInterviewSharedContext(input: AuthorInterviewSessionInput): string {
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

  return [projectContext, priorProfile, "Interview answers:", answers].filter(Boolean).join("\n\n");
}

export function buildAuthorInterviewDisplayMessages(
  input: AuthorInterviewSessionInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an author preference modeler.",
        "Stage 1: Build only the display section for human confirmation.",
        "Do not output normalized.",
        "Keep display concise, readable, and stable.",
        "Generate between 4 and 6 components.",
        `component.category must be one of: ${allowedCategories.join(", ")}.`,
        "Component fields must stay minimal: id, name, category, description, priority.",
        "Keep constraints/openQuestions/conflictsDetected short and prioritized.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: buildInterviewSharedContext(input),
    },
  ];
}

export function buildAuthorInterviewNormalizeMessages(args: {
  input: AuthorInterviewSessionInput;
  display: AuthorInterviewDisplayDraftResult["display"];
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an author preference normalizer.",
        "Stage 2: Convert display model into normalized model for programmatic use.",
        "Keep normalized authorProfile arrays at medium-high resolution (5 to 8 items when possible).",
        "Keep component fields minimal and operational.",
        "component.category must stay within the allowed category list.",
        "Prefer concrete operational checks in reviewerChecks.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        buildInterviewSharedContext(args.input),
        `Display model:\n${JSON.stringify(args.display, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export const authorInterviewDisplayDraftSchema: AuthorInterviewDisplayDraftResult = {
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
} as unknown as AuthorInterviewDisplayDraftResult;

export const authorInterviewNormalizedDraftSchema: AuthorInterviewNormalizedDraftResult = {
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
} as unknown as AuthorInterviewNormalizedDraftResult;
