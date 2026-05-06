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
  const chapterNumber = typeof input.chapterNumber === "number" ? input.chapterNumber : 0;
  const isEarlyChapter = chapterNumber > 0 && chapterNumber <= 3;
  const isOpeningArcChapter = chapterNumber > 0 && chapterNumber <= 6;
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

  const protagonistArcBlock = input.arcOutline?.protagonistArc
    ? [
        `Protagonist arc start state: ${input.arcOutline.protagonistArc.startInternalState}`,
        `Protagonist arc end state: ${input.arcOutline.protagonistArc.endInternalState}`,
        `Protagonist false belief challenged this arc: ${input.arcOutline.protagonistArc.falseBeliefChallenged}`,
        `Protagonist cost accepted by arc end: ${input.arcOutline.protagonistArc.costAccepted}`,
        ...input.arcOutline.protagonistArc.shifts.map((shift, index) => {
          const range = shift.expectedChapterRange
            ? ` chapters=${shift.expectedChapterRange.start}-${shift.expectedChapterRange.end}`
            : "";
          return [
            `Protagonist shift ${index + 1} (${shift.id})${range}:`,
            `  oldDefault=${shift.oldDefault}`,
            `  pressureTrigger=${shift.pressureTrigger}`,
            `  newChoice=${shift.newChoice}`,
            `  costPaid=${shift.costPaid}`,
          ].join("\n");
        }),
      ].join("\n")
    : undefined;

  const scenePlanBlock = input.scenePlan
    ? [
        `Scene plan for chapter ${input.scenePlan.chapterNumber}:`,
        `  pov=${input.scenePlan.pov}`,
        `  location=${input.scenePlan.location}`,
        input.scenePlan.propsAndAnchors?.length
          ? `  props=${input.scenePlan.propsAndAnchors.join(" | ")}`
          : "",
        input.scenePlan.openingScene?.entryHook
          ? `  opening.entryHook=${input.scenePlan.openingScene.entryHook}`
          : "",
        input.scenePlan.midConflict?.trigger
          ? `  midConflict.trigger=${input.scenePlan.midConflict.trigger}`
          : "",
        input.scenePlan.climax?.decisionOwnerId
          ? `  climax.owner=${input.scenePlan.climax.decisionOwnerId}`
          : "",
        input.scenePlan.climax?.decisionUnderPressure
          ? `  climax.decision=${input.scenePlan.climax.decisionUnderPressure}`
          : "",
        input.scenePlan.climax?.costPaid
          ? `  climax.costPaid=${input.scenePlan.climax.costPaid}`
          : "",
        input.scenePlan.endHook ? `  endHook=${input.scenePlan.endHook}` : "",
        input.scenePlan.protagonistGain !== undefined
          ? `  protagonistGain=${input.scenePlan.protagonistGain ?? "null (cost chapter)"}`
          : "",
        input.scenePlan.dueRevealIds?.length
          ? `  dueRevealIds=${input.scenePlan.dueRevealIds.join(" | ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  const supportingArcsBlock = input.arcOutline?.supportingCharacterArcs?.length
    ? input.arcOutline.supportingCharacterArcs
        .filter((supportingArc) =>
          input.activeCharacterIds.includes(supportingArc.characterId),
        )
        .map((supportingArc) => {
          const shifts = supportingArc.shifts.map((shift, index) => {
            const range = shift.expectedChapterRange
              ? ` chapters=${shift.expectedChapterRange.start}-${shift.expectedChapterRange.end}`
              : "";
            return [
              `  shift ${index + 1} (${shift.id})${range}:`,
              `    oldDefault=${shift.oldDefault}`,
              `    pressureTrigger=${shift.pressureTrigger}`,
              `    newChoice=${shift.newChoice}`,
              `    costPaid=${shift.costPaid}`,
            ].join("\n");
          });
          return [
            `Supporting arc character=${supportingArc.characterId}: ${supportingArc.startState} -> ${supportingArc.endState}`,
            ...shifts,
          ].join("\n");
        })
        .join("\n") || undefined
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
        input.beatOutline.decisionOwnerIds?.length
          ? `decision owners=${input.beatOutline.decisionOwnerIds.join(" | ")}`
          : undefined,
        input.beatOutline.decisionPressure
          ? `decision pressure=${input.beatOutline.decisionPressure}`
          : undefined,
        input.beatOutline.availableOptions?.length
          ? `decision options=${input.beatOutline.availableOptions.join(" | ")}`
          : undefined,
        input.beatOutline.likelyChoice
          ? `likely choice=${input.beatOutline.likelyChoice}`
          : undefined,
        input.beatOutline.immediateConsequence
          ? `immediate consequence=${input.beatOutline.immediateConsequence}`
          : undefined,
        input.beatOutline.delayedConsequence
          ? `delayed consequence=${input.beatOutline.delayedConsequence}`
          : undefined,
        input.beatOutline.relationshipShift
          ? `relationship shift=${input.beatOutline.relationshipShift}`
          : undefined,
        input.beatOutline.themeShift
          ? `theme shift=${input.beatOutline.themeShift}`
          : undefined,
        input.beatOutline.openingAnchor
          ? `opening hook=${input.beatOutline.openingAnchor.hook}`
          : undefined,
      ]
        .filter(Boolean)
        .join("; ")
    : undefined;
  const episodePacketLine = input.episodePacket
    ? [
        `Episode packet: mode=${input.episodePacket.chapterMode}`,
        `payoffType=${input.episodePacket.payoffType}`,
        `primaryThread=${input.episodePacket.primaryThreadId}`,
        `agencyOwner=${input.episodePacket.agencyOwnerId}`,
        `choice=${input.episodePacket.nonTransferableChoice}`,
        input.episodePacket.tolerableOptions.length
          ? `options=${input.episodePacket.tolerableOptions.join(" | ")}`
          : undefined,
        `cost=${input.episodePacket.choiceCost}`,
        `consequence=${input.episodePacket.protagonistConsequence}`,
        `readerPayoff=${input.episodePacket.readerPayoff}`,
        `endHook=${input.episodePacket.endHook}`,
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
        "- Treat beat conflict/expectedChange as soft scaffolding when beat is provided; current causal state outranks stale beat wording.",
        "- Treat currentSituation and recentConsequences as already happened facts. Do not rewind, replay, or replace them.",
        "- Each new chapter must advance from the current situation, not restage the same cancellation attempt or obstacle in the same form unless the escalation is materially different.",
        "- Role-driven rule: every major turn should be caused by a character choosing under pressure, not by author convenience alone.",
        "- Arc-shift rule: when this chapter falls inside the expectedChapterRange of an ArcShift, the chapter must enact that shift's pressureTrigger -> newChoice -> costPaid on-page. Do not paraphrase it as theme.",
        "- Arc-shift rule: chapterGoal/plannedOutcome/mustHitConflicts must reference the active ArcShift when one is in range. Do not let the chapter drift back into the protagonist's oldDefault behaviour without an explicit reason.",
        "- Scene plan rule: when a 'Scene plan for chapter N' block is present, it is authoritative for this chapter's pov, climax owner, climax decision, and end hook. chapterGoal and plannedOutcome must align with the scene plan; mustHitConflicts must include the scene plan's climax as a literal beat. Do not invent a different scene.",
        "- If beat decision fields are present, treat them as proposed causal scaffolding. Preserve hard constraints and irreversible obligations, but adapt stale local wording to current pressure.",
        "- If unresolved delayed consequences conflict with stale beat wording, the active consequence chain wins. Adapt the local execution while preserving story truth, reader promises, hard arc obligations, and ending obligations.",
        "- Do not plan a chapter that ignores active consequence pressure just because the original beat goal is broader or older.",
        "- chapterGoal and plannedOutcome should reflect who makes the decisive choice and what new pressure that choice creates.",
        "- If an Episode Packet is provided, it outranks beat wording for chapter mode, payoff type, primary thread, agency owner, non-transferable choice, reader payoff, and do-not-resolve constraints.",
        "- If an Episode Packet is provided, chapterGoal/plannedOutcome/mustHitConflicts must preserve its agency requirement and protagonist consequence.",
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
        // ────────────────────────────────────────────────────────────────────
        // Opening-arc planning constraints. These were derived from the audit
        // checklist (P15). They guard against the 5 failure modes a planner
        // tends to fall into in chapters 1-6: POV drift to supporting cast,
        // info dump, mechanism explanation, cost-less proactive moves, and
        // endHook-as-external-news.
        // ────────────────────────────────────────────────────────────────────
        isOpeningArcChapter
          ? "- Opening-arc POV anchor (chapter <= 6): unless the scene plan explicitly names a supporting-character POV with both a non-transferable choice AND a visible cost for that character, the chapter's POV MUST be the protagonist. Do not let chapterGoal/plannedOutcome describe what a supporting character thinks or remembers as the chapter's central content."
          : undefined,
        isOpeningArcChapter
          ? "- Opening-arc info-release ceiling (chapter <= 6): release AT MOST 1-3 NEW world-rule signals per chapter, where 'new signal' means a reveal that is on dueRevealIds OR a beat-level worldFact being introduced for the first time. Soft anomaly hints — atmospheric details / POV's private mis-readings / off-hand sensory weirdness that are NOT on the reveal contract list — DO NOT count against this cap and SHOULD be planted (one per chapter is good) to keep mid-arc texture varied. If beat reveals suggest 4+ hard reveals, defer the surplus into disallowedMoves with reason 'reserve for later chapter'."
          : undefined,
        isOpeningArcChapter
          ? "- Opening-arc mechanism-explanation ban (chapter <= 6): chapterGoal/plannedOutcome MUST NOT include 'explain the mechanism', 'reveal how X works', 'show the system architecture', 'walk the reader through the rules', or any phrase that frames a chapter as system exposition. Show anomalies as the protagonist's concrete on-page experiences instead. Mechanism description belongs to chapter 7+."
          : undefined,
        isOpeningArcChapter
          ? "- Opening-arc supporting-POV gate (chapter <= 6): if you do plan a supporting-character POV chapter, mustHitConflicts MUST contain (a) a non-transferable choice that supporting character makes under pressure and (b) a visible cost that character pays on-page. A supporting POV chapter that is purely 'information display / observation / recall' is forbidden."
          : undefined,
        isOpeningArcChapter
          ? "- Opening-arc endHook rule (chapter <= 6): commercial.endHook MUST be a new problem produced by the protagonist's own action or choice within the chapter — NOT 'a new character arrives', 'a new message comes in', 'a new clue is dropped on her', or any externally-injected hook. Good shapes: 她做了切断动作但被现实判定无效；她刚获得一点主动权却付出代价；她以为是某人在控制结果发现规则更大；某角色做出违背默认立场的选择。"
          : undefined,
        isEarlyChapter
          ? "- Early-arc cost anchor (chapter <= 3): chapterGoal/plannedOutcome MUST include a visible cost the protagonist pays for her first proactive verification action. A cost-less proactive move in chapter 1-3 is forbidden — if she acts, the world has to push back materially."
          : undefined,
        isOpeningArcChapter
          ? "- Opening-arc late-suspense protection (chapter <= 6): if a dueRevealId for this chapter has revealMode != 'named_explicitly' (i.e. anomaly or suspected_as_pattern), chapterGoal/plannedOutcome MUST frame it as the protagonist's experienced anomaly or private suspicion — NEVER as the canonical rule statement. mustHitConflicts must reference the on-page evidence, not the world-builder's terminology."
          : undefined,
        isOpeningArcChapter
          ? "- Opening-arc partial-win rhythm (chapter <= 6): if the scene plan has a non-null protagonistGain, mustHitConflicts MUST include a beat that delivers that gain on-page — the protagonist observes a loophole, keeps a piece of leverage, extracts a concrete fact, or protects an ally. The gain must be real and observable, not emotional. If protagonistGain is null, this chapter is the 'cost' half of its pair; plannedOutcome must not accidentally grant her an unmarked win."
          : undefined,
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
        input.unresolvedDelayedConsequences?.length
          ? `Unresolved delayed consequences: ${input.unresolvedDelayedConsequences.join(" | ")}`
          : undefined,
        input.unresolvedDelayedConsequences?.length
          ? "Role-driven continuity directive: at least one unresolved delayed consequence above should either intensify, complicate a relationship, or constrain the next choice."
          : undefined,
        input.unresolvedDelayedConsequences?.length
          ? "Priority directive: when the beat outline and unresolved delayed consequences pull in different directions, keep hard constraints and irreversible obligations, but make the active consequence chain drive chapterGoal, mustHitConflicts, and endHook."
          : undefined,
        input.recentCommercialHistory?.length
          ? `Recent commercial history: ${input.recentCommercialHistory.join(" | ")}`
          : undefined,
        input.recentCommercialHistory?.length
          ? "Commercial rotation directive: avoid repeating the same rewardType and the same small-payoff shape from recent chapters unless escalation is materially different."
          : undefined,
        episodePacketLine,
        input.episodePacket
          ? `Episode do-not-resolve: ${input.episodePacket.doNotResolve.slice(0, 8).join(" | ")}`
          : undefined,
        input.episodePacket
          ? "Episode directive: build this ChapterPlan around the Episode Packet. Do not replace the primary agency choice with a transferable event."
          : undefined,
        input.activeCharacters?.length
          ? `Active character decision profiles:\n${JSON.stringify(
              input.activeCharacters.map((character) => ({
                id: character.id,
                name: character.name,
                currentGoals: character.currentGoals,
                emotionalState: character.emotionalState,
                decisionProfile: character.decisionProfile ?? null,
              })),
              null,
              2,
            )}`
          : undefined,
        input.activeCharacters?.length
          ? "Decision directive: for each major scene turn, ask which active character is under pressure, what choice they can tolerate, and what cost they refuse."
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
        protagonistArcBlock,
        supportingArcsBlock,
        scenePlanBlock,
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
