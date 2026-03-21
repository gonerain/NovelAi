import type { PlannerInput, PlannerResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildPlannerMessages(input: PlannerInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是一个长篇网文章节规划器。",
        "你的任务是根据作者偏好、主题、风格和当前剧情状态，产出结构化的 ChapterPlan。",
        "不要写正文，只做章节规划。",
        "chapterPlan 必须聚焦单章，不要规划整卷。",
        "sceneTags 控制在 3 到 5 个。",
        "mustHitConflicts 控制在 2 到 4 条。",
        "disallowedMoves 控制在 2 到 4 条。",
        "styleReminders 控制在 3 到 5 条。",
        "plannerNotes 控制在 2 到 4 条。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `作品前提：${input.premise}`,
        `当前卷目标：${input.currentArcGoal}`,
        `当前局势：${input.currentSituation}`,
        input.chapterNumber ? `章节序号：${input.chapterNumber}` : undefined,
        input.arcId ? `卷标识：${input.arcId}` : undefined,
        `激活角色：${input.activeCharacterIds.join(", ")}`,
        input.candidateMemoryIds.length > 0
          ? `候选记忆：${input.candidateMemoryIds.join(", ")}`
          : undefined,
        input.recentConsequences.length > 0
          ? `近期后果：${input.recentConsequences.join("；")}`
          : undefined,
        `作者规则：${input.authorPack.promptCapsule.join(" | ")}`,
        `主题基线：核心主题=${input.themeBible.coreTheme}；子主题=${input.themeBible.subThemes.join("、")}；结局目标=${input.themeBible.endingTarget}；情绪终点=${input.themeBible.emotionalDestination}`,
        `风格基线：叙事=${input.styleBible.narrativeStyle.join("、")}；情绪=${input.styleBible.emotionalStyle.join("、")}；节奏=${input.styleBible.pacingStyle.join("、")}；反模式=${input.styleBible.antiPatterns.join("、")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export const plannerResultSchema: PlannerResult = {
  chapterPlan: {
    chapterNumber: 1,
    arcId: "string",
    title: "string",
    chapterGoal: "string",
    emotionalGoal: "string",
    plannedOutcome: "string",
    sceneType: "string",
    sceneTags: ["string"],
    requiredCharacters: ["string"],
    requiredMemories: ["string"],
    mustHitConflicts: ["string"],
    disallowedMoves: ["string"],
    styleReminders: ["string"],
    authorComponentIds: ["string"],
  },
  plannerNotes: ["string"],
} as unknown as PlannerResult;
