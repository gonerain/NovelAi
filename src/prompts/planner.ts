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
        "- Treat currentSituation and recentConsequences as already happened facts. Do not rewind, replay, or replace them.",
        "- Each new chapter must advance from the current situation, not restage the same cancellation attempt or obstacle in the same form unless the escalation is materially different.",
        "- Keep payoffPatternIds to 1-2 aligned ids.",
        "- Output searchIntent for retrieval. searchIntent should point to entities, memories, ledger types, and phrases that must be searched before writing.",
        "- Output commercial controls. commercial must describe how this chapter sells itself to web-novel readers without forcing the same rhythm every time.",
        "- commercial.coreSellPoint must be a concrete reader-facing point, not abstract theme language.",
        "- commercial.visibleProblem must describe the chapter's most immediate and specific trouble in plain terms.",
        "- commercial.externalTurn must name one external event that changes the situation on-page.",
        "- commercial.microPayoff must name one small but real reward for the reader in this chapter.",
        "- commercial.rewardType must classify that reward. Rotate rewardType across nearby chapters when possible instead of repeating the same kind of payoff.",
        "- commercial.rewardTiming must say whether the reward lands in the early, mid, or late part of the chapter.",
        "- commercial.rewardTarget must name what the reward changes: evidence, route, leverage, relationship, identity, or risk.",
        "- commercial.endHook must create next-chapter pull with a concrete unresolved point.",
        "- commercial.readerPromise must describe what the next 1-3 chapters are selling.",
        "- searchIntent.memoryIds should prefer ids from beat required memories or candidate active memory ids when relevant.",
        "- searchIntent.entityIds should use character ids for known characters. Non-character objects or labels should be short searchable phrases.",
        isEarlyChapter
          ? "- Early-chapter rule (chapter 1-3): chapterGoal/plannedOutcome must explicitly include world-setting delivery (e.g. organization, power system, social risk) and at least one external event that changes investigation or relationship state."
          : "- Progress rule: each chapter must include at least one external event that changes investigation or relationship state.",
        isEarlyChapter
          ? "- Early-chapter rule (chapter 1-3): mustHitConflicts must include one 'setting exposure conflict' item (people or institutions reacting to the world-setting)."
          : undefined,
        isEarlyChapter
          ? "- Early-chapter commercial rule (chapter 1-3): prefer daily_abnormal or relationship_pressure unless the beat clearly requires hard_hook."
          : "- Commercial rhythm rule: use the lightest effective openingMode; do not fake cliffhangers when aftermath or slow pressure is stronger.",
        "- Rhythm rule: not every chapter needs a big explosion; follow chapterType intent.",
        "- chapterType intent: setup=seed hooks/world context; progress=advance investigation/relationships; payoff=deliver a concrete turn or revelation with cost; aftermath=land consequences and set next target.",
        "Keep sceneTags between 3 and 5 items.",
        "Keep mustHitConflicts between 2 and 4 items.",
        "Keep disallowedMoves between 2 and 4 items.",
        "Keep styleReminders between 3 and 5 items.",
        "Keep searchIntent.entityIds between 2 and 6 items.",
        "Keep searchIntent.memoryIds between 0 and 4 items.",
        "Keep searchIntent.ledgerTypes between 1 and 3 items.",
        "Keep searchIntent.topicQueries between 2 and 4 items.",
        "Keep searchIntent.exactPhrases between 1 and 3 items.",
        "Keep commercial.coreSellPoint / visibleProblem / externalTurn / microPayoff / endHook / readerPromise concise, each as one short Chinese sentence.",
        "commercial.rewardType must be one of: proof_win | countermove | relationship_pull | rule_reveal | status_shift.",
        "commercial.rewardTiming must be one of: early | mid | late.",
        "Keep plannerNotes between 2 and 3 items.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Premise: ${input.premise}`,
        `Current arc goal: ${input.currentArcGoal}`,
        `Current situation: ${input.currentSituation}`,
        input.genrePayoffPack
          ? `Genre payoff pack: ${input.genrePayoffPack.name}; summary=${input.genrePayoffPack.summary}; openingModes=${input.genrePayoffPack.openingModes.join(" | ")}; hookBias=${input.genrePayoffPack.hookBias.join(" | ")}; microPayoffBias=${input.genrePayoffPack.microPayoffBias.join(" | ")}; rewardTargets=${input.genrePayoffPack.rewardTargetBias.join(" | ")}; avoid=${input.genrePayoffPack.avoidPatterns.join(" | ")}`
          : undefined,
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
        input.candidateMemoryIds.length
          ? `Candidate active memory ids: ${input.candidateMemoryIds.join(", ")}`
          : undefined,
        input.beatOutline?.constraints.length
          ? `Beat constraints: ${input.beatOutline.constraints.join(" | ")}`
          : undefined,
        input.recentConsequences.length > 0
          ? `Recent consequences: ${input.recentConsequences.join(" | ")}`
          : undefined,
        input.recentConsequences.length > 0
          ? "Continuity directive: all recent consequences above are already true at chapter start. Build the next turn from them."
          : undefined,
        input.recentCommercialHistory?.length
          ? `Recent commercial history: ${input.recentCommercialHistory.join(" | ")}`
          : undefined,
        input.recentCommercialHistory?.length
          ? "Commercial rotation directive: avoid repeating the same rewardType and the same small-payoff shape from recent chapters unless escalation is materially different."
          : undefined,
        `Author summary: ${input.authorPack.summary}`,
        `Author must rules: ${input.authorPack.mustRules.join(" | ")}`,
        `Author global preferences: ${input.authorPack.globalPreferences.join(" | ")}`,
        `Planner-specific preferences: ${input.authorPack.taskSpecificPreferences.join(" | ")}`,
        `Task-specific author rules: ${input.authorPack.taskRules.join(" | ")}`,
        `Theme baseline: core=${input.themeBible.coreTheme}; ending=${input.themeBible.endingTarget}; subthemes=${input.themeBible.subThemes.slice(0, 4).join(" | ")}`,
        `Style baseline: narrative=${input.styleBible.narrativeStyle.slice(0, 3).join(" | ")}; pacing=${input.styleBible.pacingStyle.slice(0, 3).join(" | ")}; avoid=${input.styleBible.antiPatterns.slice(0, 4).join(" | ")}`,
        isEarlyChapter
          ? "Early-chapter directive: explicitly surface concrete nouns from the premise/outline in this chapter, such as institutions, locations, objects, public procedures, and relationship labels."
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
    searchIntent: {
      entityIds: ["string"],
      memoryIds: ["string"],
      ledgerTypes: ["resource"],
      topicQueries: ["string"],
      exactPhrases: ["string"],
    },
    commercial: {
      openingMode: "daily_abnormal",
      coreSellPoint: "string",
      visibleProblem: "string",
      externalTurn: "string",
      microPayoff: "string",
      rewardType: "proof_win",
      rewardTiming: "mid",
      rewardTarget: "string",
      endHook: "string",
      readerPromise: "string",
      paragraphRhythm: "tight",
    },
    mustHitConflicts: ["string"],
    disallowedMoves: ["string"],
    styleReminders: ["string"],
    authorComponentIds: ["string"],
    payoffPatternIds: ["string"],
  },
  plannerNotes: ["string"],
} as unknown as PlannerResult;
