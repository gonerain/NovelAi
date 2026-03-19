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
      "你最想反复写的主题是什么？角色最终最应该明白、失去或救回什么？",
    intent: "Capture the author's core themes and emotional destination.",
  },
  {
    id: "character_bias",
    prompt:
      "你最容易偏爱的角色通常是什么样？他们通常带着什么伤口、欲望、缺点或执念？",
    intent: "Capture preferred character archetypes and wounds.",
  },
  {
    id: "relationship_pattern",
    prompt:
      "你最喜欢角色之间怎么拉扯、靠近、伤害和修复？你偏爱的关系张力是什么？",
    intent: "Capture relationship dynamics and repair rules.",
  },
  {
    id: "plot_bias",
    prompt:
      "你喜欢故事怎么推进？更偏慢熬、爆发、密集转折、强情绪驱动，还是别的方式？",
    intent: "Capture plotting and pacing preferences.",
  },
  {
    id: "ending_bias",
    prompt:
      "你理想中的结局是什么感觉？你能接受怎样的失去、代价、遗憾或圆满？",
    intent: "Capture ending shape and acceptable cost.",
  },
  {
    id: "aesthetic_private_goods",
    prompt:
      "你总会忍不住塞进作品里的私货、意象、场景、桥段或禁忌是什么？",
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
        input.targetProject.title
          ? `项目标题：${input.targetProject.title}`
          : undefined,
        input.targetProject.premise
          ? `项目前提：${input.targetProject.premise}`
          : undefined,
        input.targetProject.themeHint
          ? `主题提示：${input.targetProject.themeHint}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const priorProfile = input.priorProfile
    ? `已有作者信息参考：${JSON.stringify(input.priorProfile, null, 2)}`
    : "";

  const answers = input.userRawAnswers
    .map((item) => {
      const question =
        authorInterviewQuestions.find((question) => question.id === item.questionId)
          ?.prompt ?? item.questionId;

      return `问题：${question}\n回答：${item.answer}`;
    })
    .join("\n\n");

  return [
    {
      role: "system",
      content: [
        "你是一个作者采访建模器。",
        "你的任务不是写小说，而是从作者的自然语言回答中抽取作者偏好。",
        "输出必须同时包含 display 和 normalized 两层结果。",
        "display 用于给作者确认，允许简短解释，但要克制，不要写成长篇分析。",
        "display.summary 最多 60 个汉字。",
        "display.authorProfile.summary 最多 80 个汉字。",
        "display.components 的 description 控制在 35 个汉字以内。",
        "display.components 的 validationHints 最多 2 条，每条尽量短。",
        "normalized 用于程序消费，必须更短、更硬、更稳定。",
        "normalized.authorProfile 的每个数组最多 3 项。",
        "normalized.components 每个数组字段最多 2 项，且每项控制在短语级别。",
        `component.category 只能从以下枚举中选择：${allowedCategories.join(", ")}。`,
        "不要发明新的 category，例如 relationship、pacing。",
        "组件数量控制在 3 到 5 个之间，只保留高信号偏好。",
        "每个 normalized component 只保留短字段，不要写成长句说明。",
        "constraints 最多 3 条，openQuestions 最多 2 条，conflictsDetected 最多 2 条。",
        "如果某类信息不确定，放进 openQuestions 或 conflictsDetected，而不是瞎补。",
        "禁止输出 schema 说明、注释或额外解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        projectContext,
        priorProfile,
        "以下是作者采访回答，请据此建模：",
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
