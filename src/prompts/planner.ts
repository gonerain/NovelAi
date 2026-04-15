import type { PlannerInput, PlannerResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function recommendChapterType(chapterNumber?: number): "setup" | "progress" | "payoff" | "aftermath" {
  if (!chapterNumber || chapterNumber <= 1) {
    return "setup";
  }
  const phase = (chapterNumber - 1) % 4;
  if (phase === 1) {
    return "progress";
  }
  if (phase === 2) {
    return "payoff";
  }
  return "aftermath";
}

export function buildPlannerMessages(input: PlannerInput): ChatMessage[] {
  const isEarlyChapter = typeof input.chapterNumber === "number" && input.chapterNumber <= 3;
  const recommendedType = recommendChapterType(input.chapterNumber);

  const arcLine = input.arcOutline
    ? [
        `Arc outline: name=${input.arcOutline.name}`,
        `goal=${input.arcOutline.arcGoal}`,
        input.arcOutline.arcSellingPoint ? `selling=${input.arcOutline.arcSellingPoint}` : undefined,
        input.arcOutline.arcHook ? `hook=${input.arcOutline.arcHook}` : undefined,
        input.arcOutline.arcPayoff ? `payoff=${input.arcOutline.arcPayoff}` : undefined,
        input.arcOutline.primaryPowerPatternIds?.length
          ? `power patterns=${input.arcOutline.primaryPowerPatternIds.join(" | ")}`
          : undefined,
        input.arcOutline.primaryPayoffPatternIds?.length
          ? `payoff patterns=${input.arcOutline.primaryPayoffPatternIds.join(" | ")}`
          : undefined,
        input.arcOutline.riskNotes?.length
          ? `risks=${input.arcOutline.riskNotes.join(" | ")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("; ")
    : undefined;

  const beatLine = input.beatOutline
    ? [
        `Beat outline: goal=${input.beatOutline.beatGoal}`,
        `conflict=${input.beatOutline.conflict}`,
        `change=${input.beatOutline.expectedChange}`,
        input.beatOutline.payoffPatternIds?.length
          ? `beat payoff patterns=${input.beatOutline.payoffPatternIds.join(" | ")}`
          : undefined,
        input.beatOutline.revealTargets.length > 0
          ? `reveals=${input.beatOutline.revealTargets.join(" | ")}`
          : undefined,
        input.beatOutline.constraints.length > 0
          ? `beat constraints=${input.beatOutline.constraints.join(" | ")}`
          : undefined,
        input.beatOutline.openingAnchor
          ? `opening hook=${input.beatOutline.openingAnchor.hook}`
          : undefined,
      ]
        .filter(Boolean)
        .join("; ")
    : undefined;

  return [
    {
      role: "system",
      content: [
        "Task: produce a structured ChapterPlan for one chapter.",
        "Hard constraints:",
        "- JSON only, no prose writing.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, concise Chinese is preferred; English is allowed when clearer.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- You must output chapterType as one of: setup | progress | payoff | aftermath.",
        "- Use beat conflict/expectedChange as hard anchor when beat is provided.",
        "- Keep payoffPatternIds to 1-2 aligned ids.",
        isEarlyChapter
          ? "- Early-chapter rule (chapter 1-3): chapterGoal/plannedOutcome must explicitly include world-setting delivery (e.g. organization, power system, social risk) and at least one external event that changes investigation or relationship state."
          : "- Progress rule: each chapter must include at least one external event that changes investigation or relationship state.",
        isEarlyChapter
          ? "- Early-chapter rule (chapter 1-3): mustHitConflicts must include one 'setting exposure conflict' item (people or institutions reacting to the world-setting)."
          : undefined,
        "- Rhythm rule: not every chapter needs a big explosion; follow chapterType intent.",
        "- chapterType intent: setup=seed hooks/world context; progress=advance investigation/relationships; payoff=deliver a concrete turn or revelation with cost; aftermath=land consequences and set next target.",
        "Keep sceneTags between 3 and 5 items.",
        "Keep mustHitConflicts between 2 and 4 items.",
        "Keep disallowedMoves between 2 and 4 items.",
        "Keep styleReminders between 3 and 5 items.",
        "Keep plannerNotes between 2 and 3 items.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Premise: ${input.premise}`,
        `Current arc goal: ${input.currentArcGoal}`,
        `Current situation: ${input.currentSituation}`,
        input.chapterNumber ? `Chapter number: ${input.chapterNumber}` : undefined,
        `Recommended chapterType (pace wave): ${recommendedType}`,
        input.beatOutline?.chapterRangeHint
          ? `Beat chapter range: ${input.beatOutline.chapterRangeHint.start}-${input.beatOutline.chapterRangeHint.end}`
          : undefined,
        `Active characters: ${input.activeCharacterIds.join(", ")}`,
        input.beatOutline?.requiredCharacters.length
          ? `Beat required characters: ${input.beatOutline.requiredCharacters.join(", ")}`
          : undefined,
        input.beatOutline?.requiredMemories.length
          ? `Beat required memories: ${input.beatOutline.requiredMemories.join(", ")}`
          : undefined,
        input.beatOutline?.constraints.length
          ? `Beat constraints: ${input.beatOutline.constraints.join(" | ")}`
          : undefined,
        input.recentConsequences.length > 0
          ? `Recent consequences: ${input.recentConsequences.join(" | ")}`
          : undefined,
        `Author summary: ${input.authorPack.summary}`,
        `Author must rules: ${input.authorPack.mustRules.join(" | ")}`,
        `Author global preferences: ${input.authorPack.globalPreferences.join(" | ")}`,
        `Planner-specific preferences: ${input.authorPack.taskSpecificPreferences.join(" | ")}`,
        `Task-specific author rules: ${input.authorPack.taskRules.join(" | ")}`,
        `Theme baseline: core=${input.themeBible.coreTheme}; ending=${input.themeBible.endingTarget}; subthemes=${input.themeBible.subThemes.slice(0, 4).join(" | ")}`,
        `Style baseline: narrative=${input.styleBible.narrativeStyle.slice(0, 3).join(" | ")}; pacing=${input.styleBible.pacingStyle.slice(0, 3).join(" | ")}; avoid=${input.styleBible.antiPatterns.slice(0, 4).join(" | ")}`,
        isEarlyChapter
          ? "Early-chapter directive: explicitly surface core world-setting nouns from premise/outline in this chapter (for this project that includes X局 / 共鸣者 / 连雨异常)."
          : "Continuation directive: keep world-setting active in scene consequences, do not let it fade into background mood only.",
        arcLine,
        beatLine,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export const plannerResultSchema: PlannerResult = {
  chapterPlan: {
    chapterNumber: 1,
    chapterType: "setup",
    arcId: "string",
    beatId: "string",
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
    payoffPatternIds: ["string"],
  },
  plannerNotes: ["string"],
} as unknown as PlannerResult;
