import type { PlannerInput, PlannerResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildPlannerMessages(input: PlannerInput): ChatMessage[] {
  const storyLine = input.storyOutline
    ? `Story outline: theme=${input.storyOutline.coreTheme}; ending=${input.storyOutline.endingTarget}; turns=${input.storyOutline.keyTurningPoints.join(" | ")}`
    : undefined;

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
        "You are a long-form web-novel chapter planner.",
        "Produce a structured ChapterPlan for exactly one chapter.",
        "Do not write prose. Do not explain your reasoning.",
        "The chapter plan must inherit the current arc's selling point, hook, and payoff pressure rather than drifting into generic continuation.",
        "When beat outline is provided, treat it as a hard anchor for this chapter's conflict and expected change.",
        "Prefer 1 or 2 payoffPatternIds that match the current arc and beat. Do not output a long list.",
        "Keep sceneTags between 3 and 5 items.",
        "Keep mustHitConflicts between 2 and 4 items.",
        "Keep disallowedMoves between 2 and 4 items.",
        "Keep styleReminders between 3 and 5 items.",
        "Keep plannerNotes between 2 and 4 items.",
        "Prioritize current chapter utility over broad arc summary.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Premise: ${input.premise}`,
        `Current arc goal: ${input.currentArcGoal}`,
        `Current situation: ${input.currentSituation}`,
        input.chapterNumber ? `Chapter number: ${input.chapterNumber}` : undefined,
        input.arcId ? `Arc id: ${input.arcId}` : undefined,
        input.beatOutline ? `Beat id: ${input.beatOutline.id}` : undefined,
        input.beatOutline?.chapterRangeHint
          ? `Beat chapter range: ${input.beatOutline.chapterRangeHint.start}-${input.beatOutline.chapterRangeHint.end}`
          : undefined,
        `Active characters: ${input.activeCharacterIds.join(", ")}`,
        input.beatOutline?.requiredCharacters.length
          ? `Beat required characters: ${input.beatOutline.requiredCharacters.join(", ")}`
          : undefined,
        input.candidateMemoryIds.length > 0
          ? `Candidate memory ids: ${input.candidateMemoryIds.join(", ")}`
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
        `Theme baseline: core=${input.themeBible.coreTheme}; subthemes=${input.themeBible.subThemes.join(" | ")}; ending=${input.themeBible.endingTarget}; emotion=${input.themeBible.emotionalDestination}`,
        `Style baseline: narrative=${input.styleBible.narrativeStyle.join(" | ")}; emotion=${input.styleBible.emotionalStyle.join(" | ")}; pacing=${input.styleBible.pacingStyle.join(" | ")}; avoid=${input.styleBible.antiPatterns.join(" | ")}`,
        storyLine,
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
