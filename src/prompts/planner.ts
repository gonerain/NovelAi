import type { PlannerInput, PlannerResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildPlannerMessages(input: PlannerInput): ChatMessage[] {

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
        "- Use beat conflict/expectedChange as hard anchor when beat is provided.",
        "- Keep payoffPatternIds to 1-2 aligned ids.",
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
