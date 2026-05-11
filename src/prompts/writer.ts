import type { WriterInput, WriterResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function formatActiveCharacters(input: WriterInput): string {
  return input.contextPack.activeCharacters
    .slice(0, 4)
    .map((character) => {
      const profile = character.decisionProfile;
      const lines: string[] = [];
      lines.push(`【${character.name}】(${character.id})`);
      if (character.currentGoals.length) {
        lines.push(`  当前目标: ${character.currentGoals.join(" / ")}`);
      }
      if (character.emotionalState.length) {
        lines.push(`  情绪状态: ${character.emotionalState.join(" / ")}`);
      }
      if (character.wounds.length) {
        lines.push(`  创伤→行为表现: ${character.wounds.slice(0, 2).join("；")} ← 写成具体行为细节，不用心理独白道出`);
      }
      if (character.voiceNotes.length) {
        lines.push(`  声音节奏: ${character.voiceNotes.slice(0, 2).join("；")} ← 落实到实际句式和句长，不止写"他语气平静"`);
      }
      if (profile) {
        if (profile.controlPattern) lines.push(`  控制模式: ${profile.controlPattern}`);
        if (profile.falseBelief) lines.push(`  错误信念: ${profile.falseBelief} ← 让这个信念在行动中显形，不要说破`);
        if (profile.coreDesire) lines.push(`  核心欲望: ${profile.coreDesire}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatRelevantMemories(input: WriterInput): string {
  return input.contextPack.relevantMemories
    .slice(0, 3)
    .map((memory) =>
      [
        `${memory.title}(${memory.id})`,
        `kind=${memory.kind}`,
        `priority=${memory.priority}`,
        `summary=${memory.summary}`,
      ].join("; "),
    )
    .join("\n");
}

function formatRelevantLedgers(input: WriterInput): string {
  return input.contextPack.relevantLedgerEntries
    .slice(0, 4)
    .map((entry) =>
      [
        `${entry.title}(${entry.id})`,
        `ledger=${entry.ledgerType}`,
        `priority=${entry.priority}`,
        `status=${entry.status}`,
        `summary=${entry.summary}`,
      ].join("; "),
    )
    .join("\n");
}

function formatRelevantChapterCards(input: WriterInput): string {
  return input.contextPack.relevantChapterCards
    .slice(0, 2)
    .map((card) =>
      [
        `Chapter ${card.chapterNumber}: ${card.title}`,
        `summary=${card.summary}`,
        `next=${card.nextSituation}`,
      ].join("; "),
    )
    .join("\n");
}

function formatRelevantWorldFacts(input: WriterInput): string {
  return input.contextPack.relevantWorldFacts
    .slice(0, 2)
    .map((fact) =>
      [
        `${fact.title}(${fact.id})`,
        `category=${fact.category}`,
        `scope=${fact.scope}`,
        `description=${fact.description}`,
      ].join("; "),
    )
    .join("\n");
}

function formatCommercialSignals(input: WriterInput): string {
  const signals = input.contextPack.commercialSignals;
  if (!signals) {
    return "none";
  }

  return [
    signals.openingMode ? `openingMode=${signals.openingMode}` : undefined,
    signals.coreSellPoint ? `coreSellPoint=${signals.coreSellPoint}` : undefined,
    signals.visibleProblem ? `visibleProblem=${signals.visibleProblem}` : undefined,
    signals.externalTurn ? `externalTurn=${signals.externalTurn}` : undefined,
    signals.microPayoff ? `microPayoff=${signals.microPayoff}` : undefined,
    signals.rewardType ? `rewardType=${signals.rewardType}` : undefined,
    signals.rewardTiming ? `rewardTiming=${signals.rewardTiming}` : undefined,
    signals.rewardTarget ? `rewardTarget=${signals.rewardTarget}` : undefined,
    signals.endHook ? `endHook=${signals.endHook}` : undefined,
    signals.readerPromise ? `readerPromise=${signals.readerPromise}` : undefined,
    signals.paragraphRhythm ? `paragraphRhythm=${signals.paragraphRhythm}` : undefined,
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildWriterMessages(input: WriterInput): ChatMessage[] {
  const { contextPack } = input;
  const chapterNumberSignal =
    contextPack.chapterSignals.find((item) => item.startsWith("Chapter number:")) ?? "";
  const chapterTypeSignal =
    contextPack.chapterSignals.find((item) => item.startsWith("Chapter type:")) ?? "";
  const chapterNumber = Number(chapterNumberSignal.replace("Chapter number:", "").trim());
  const chapterType = chapterTypeSignal.replace("Chapter type:", "").trim() || "progress";
  const isEarlyChapter = Number.isFinite(chapterNumber) && chapterNumber > 0 && chapterNumber <= 3;
  const mustRules = contextPack.mustRules.slice(0, 4);
  const avoidRules = contextPack.avoidRules.slice(0, 2);
  const chapterExecutionReminders = contextPack.chapterExecutionReminders.slice(0, 3);
  const taskRules = contextPack.taskRules.slice(0, 3);
  const themePressure = contextPack.themePressure.slice(0, 2);
  const sceneTags = contextPack.chapterObjective.sceneTags.slice(0, 3);
  const payoffPatterns = contextPack.readerValue?.payoffPatterns.slice(0, 1) ?? [];
  const powerPatterns = contextPack.readerValue?.powerPatterns.slice(0, 1) ?? [];
  const genreHookBias = contextPack.readerValue?.genreHookBias.slice(0, 2) ?? [];
  const genreRewardBias = contextPack.readerValue?.genreRewardBias.slice(0, 2) ?? [];
  const genreAvoidPatterns = contextPack.readerValue?.genreAvoidPatterns.slice(0, 2) ?? [];
  const commercialSignals = contextPack.commercialSignals;
  const paragraphRhythm = commercialSignals?.paragraphRhythm ?? "balanced";
  const episode = contextPack.episodePacket;

  return [
    {
      role: "system",
      content: [
        "You are a long-form web-novel drafting assistant.",
        "Write only the chapter draft for the current chapter.",
        "The novel draft itself must be written in Chinese.",
        "Do not explain your reasoning. Do not output planning notes. Do not output bullet points inside the draft.",
        "Honor mustRules strictly. Treat avoidRules as hard negatives.",
        "Scene plan contract rule: when a 'Scene plan contract' block is present, it is authoritative for this chapter's core task, midConflict, climax, and endHook. Use those as the literal scene structure. However, openingScene.entryHook is subordinate to the Canon Bridge — if a '【Canon Bridge】' block appears in the user message, the chapter MUST open from the state described there, not from the scene plan's openingScene.entryHook. When the Canon Bridge provides actual previous-chapter prose, treat it as the immediate predecessor text and continue the narrative directly; do not skip events left unresolved at the end of that prose. When they conflict, write a transition that completes any unfinished business from the prior chapter before entering the scene plan's core content; do not hard-cut.",
        "Reveal contract rule: every entry in 'Reveal contracts due THIS chapter' must show up on-page. HARD reveals are mandatory: surface the concrete fact / truth / setup directly through scene action, dialogue, or observable consequence. Do not gesture at it as mood. SOFT reveals are preferred but may be deferred if the chapter logically cannot carry them.",
        "Knowledge boundary rule (CRITICAL): a reveal's `revealMode` controls how the POV character may articulate it.",
        "  - experienced_as_anomaly: the POV character DOES NOT yet know the world-builder's name for this rule. Surface the reveal through specific evidence the character can only read through their existing frame: family pressure, social conspiracy, gaslighting, coincidence, the character's own perception failing. The bound `factTitle` and `factDescription` are reference for YOU; they are NOT lines the character may speak or think. The `forbiddenVocabulary` listed for this reveal must NOT appear in the POV character's dialogue or interior monologue, not even with quotation marks (e.g. 戏称为, 心里默念). Engineer evidence; never let the character articulate the rule.",
        "  - suspected_as_pattern: the POV character may have noticed a pattern and may invent a private placeholder name in their own head. The `forbiddenVocabulary` (canonical world-builder terms) is still off-limits.",
        "  - named_explicitly: the canonical vocabulary is now allowed in dialogue and monologue.",
        "Voice constraint (HARD): for any active character whose `controlPattern` includes 'information' / 'silence' / 'leverage' / 'observation' (e.g. 闻既白), enforce: (a) per scene they reveal at MOST one concrete fragment; (b) they never explain a system, mechanism, rule, or motive in plain expository sentences — they hint via half-questions, ambiguous remarks, or a single specific observation; (c) they answer questions with another question or a redirect at least half the time; (d) any line that sounds like teaching the POV (含'其实是'/'你不知道吗'/'这就是…的原因'/'因为…所以…') is forbidden. If you find yourself writing a paragraph of their explanation, cut it to one fragment and let the POV be left guessing.",
        "Character translation rule: wounds and voiceNotes must become observable on the page — not labels, not interior monologue announcing them. A wound shows as a behavioral tell: if a character's wound is '把承担和控制混淆', he frames commands as consideration for her (他说'我让司机在终点站等你' — said as if doing her a favor). A voice note shows as sentence shape: if a character's voice is '句子短，常以反问截断'，her lines end in questions she doesn't want answered, rarely exceed 15 characters, and her longest speech comes when she's most unsure.",
        "Female-oriented magnetism rule: readers track magnetic characters through involuntary attention, not description. (1) Write what the POV notices about him without meaning to — a specific physical detail, a small misfire in his control — then let her immediately redirect. Write the noticing; cut the explanation. (2) Each chapter: find the one moment his composure cracks by exactly one degree. Do not announce this. Write the evidence: a shorter sentence than usual, a pause before answering, something he picks up and puts down. (3) Do not describe him as attractive. Let the protagonist's attention pattern reveal it.",
        "Ambiguous tension rule: write at least one double-readable beat per chapter — an action or line that the reader can interpret as threat OR protection, without resolving it in the same paragraph. Spatial movement encodes power: who steps closer first, who doesn't step back. The character who doesn't step back holds the power in that moment — write this without explaining it.",
        "Protagonist contradiction rule: the female lead rejects the relationship but cannot be indifferent — these are not contradictory, they are the tension source. Her wound (拒绝被解释为任性) means: under emotional pressure she goes extra-rational, extra-procedural. When most threatened, she becomes more precise, not more emotional. Her secret attention surfaces as: noticing something she immediately wants to un-notice, or having a clear exit and not taking it immediately — and she tells herself it is tactical. CRITICAL: Write the moment she catches herself suppressing — not the suppressed feeling itself, but the catching: she notices her hand has been still for too long, her breath adjusted before she meant it to, she chose a word and then registered she chose it deliberately. This self-catching is what makes her feel like a person rather than a function.",
        isEarlyChapter
          ? "Use chapterObjective + key memories as primary context. In chapter 1-3, world-setting must be explicit (not only implicit mood): include concrete mentions of institutions, procedures, labels, or social consequences."
          : "Use chapterObjective + key memories as primary context. Keep world facts tied to concrete scene consequences, not abstract lore blocks.",
        "Sensory anchor rule (女频): use physical sensation and object texture as emotional anchors — not decorative description but the body's read of a situation. (1) When a character is under threat or pressure, give the POV one involuntary physical response: breath timing, finger tension, temperature shift, a sound that arrives a beat too early. (2) When two characters share physical proximity, write the space between them: who is still, who adjusts, what the POV's hands do. (3) Objects carry emotional weight — the fax paper still warm from the machine, the key with peeling number tape, the dress hem catching oil from the parking lot. Use one object per high-stakes scene as a tactile anchor. Do NOT describe feelings; describe what the body does instead.",
        "Commercial rhythm rule: chapters should be easy to enter, easy to scan, and still carry concrete progression.",
        "Put concrete trouble on page early. Let readers quickly see who is blocked, by what, and why it matters now.",
        "Do not front-load abstract theme explanation. Embed emotion into actions, dialogue, objects, and consequences.",
        contextPack.readerValue?.genrePackSummary
          ? `Genre pack priority: ${contextPack.readerValue.genrePackSummary}`
          : undefined,
        genreHookBias.length
          ? `Genre hook bias: ${genreHookBias.join(" | ")}`
          : undefined,
        genreRewardBias.length
          ? `Genre reward bias: ${genreRewardBias.join(" | ")}`
          : undefined,
        genreAvoidPatterns.length
          ? `Genre avoid patterns: ${genreAvoidPatterns.join(" | ")}`
          : undefined,
        "Each chapter must contain at least one external event that changes investigation status, relationship state, or risk level.",
        `Current chapterType=${chapterType}. Type intent: setup=seed hooks/world context; progress=advance investigation/relationships; payoff=deliver concrete turn/revelation with cost; aftermath=land consequences and set next target.`,
        episode
          ? `Episode runtime control: chapterMode=${episode.chapterMode}; payoffType=${episode.payoffType}; primaryThread=${episode.primaryThreadId}.`
          : undefined,
        episode
          ? `Agency gate: ${episode.agencyOwnerId} must make this non-transferable choice on-page: ${episode.nonTransferableChoice}`
          : undefined,
        episode
          ? `Choice options: ${episode.tolerableOptions.join(" | ")}. Explicit cost: ${episode.choiceCost}. Consequence: ${episode.protagonistConsequence}.`
          : undefined,
        episode
          ? `Reader payoff: ${episode.readerPayoff}. End hook target: ${episode.endHook}.`
          : undefined,
        episode?.doNotResolve.length
          ? `Do not resolve in this chapter: ${episode.doNotResolve.join(" | ")}`
          : undefined,
        "Do not force a big climax in every chapter; follow chapterType pacing.",
        commercialSignals?.coreSellPoint
          ? `Commercial priority: surface this chapter's core sell point clearly on-page: ${commercialSignals.coreSellPoint}`
          : undefined,
        commercialSignals?.visibleProblem
          ? `Visible problem: make this specific trouble legible within the first part of the chapter: ${commercialSignals.visibleProblem}`
          : undefined,
        commercialSignals?.externalTurn
          ? `External turn: this on-page event must happen and change the chapter situation: ${commercialSignals.externalTurn}`
          : undefined,
        commercialSignals?.microPayoff
          ? `Micro payoff: ensure the reader gets this reward inside the chapter: ${commercialSignals.microPayoff}`
          : undefined,
        commercialSignals?.rewardType
          ? `Reward type: ${commercialSignals.rewardType}. Do not blur it into vague atmosphere; the reader should feel what kind of gain happened.`
          : undefined,
        commercialSignals?.rewardTiming
          ? `Reward timing: land the chapter's main reader reward in the ${commercialSignals.rewardTiming} part of the chapter.`
          : undefined,
        commercialSignals?.rewardTarget
          ? `Reward target: make the reward change this concrete thing: ${commercialSignals.rewardTarget}`
          : undefined,
        commercialSignals?.endHook
          ? `End hook: close on this unresolved pull without sounding synthetic: ${commercialSignals.endHook}`
          : undefined,
        commercialSignals?.readerPromise
          ? `Near-term promise: the next 1-3 chapters should keep selling this line: ${commercialSignals.readerPromise}`
          : undefined,
        commercialSignals?.openingMode === "daily_abnormal"
          ? "Opening mode=daily_abnormal: begin from a normal small task or social exchange, then reveal a concrete abnormal rule or consequence within the first few paragraphs."
          : undefined,
        commercialSignals?.openingMode === "relationship_pressure"
          ? "Opening mode=relationship_pressure: begin from relationship friction, but let that friction immediately affect a real-world decision or cost."
          : undefined,
        commercialSignals?.openingMode === "hard_hook"
          ? "Opening mode=hard_hook: open with immediate pressure, danger, or irreversible trouble."
          : undefined,
        commercialSignals?.openingMode === "aftermath_hook"
          ? "Opening mode=aftermath_hook: start from the consequence already in motion, then reveal what it means."
          : undefined,
        paragraphRhythm === "tight"
          ? "Paragraph rhythm=tight: keep paragraphs short, one main beat per paragraph, let readers scan quickly."
          : paragraphRhythm === "slow_burn"
            ? "Paragraph rhythm=slow_burn: still keep paragraphs readable, but allow slightly more scene texture before each turn."
            : "Paragraph rhythm=balanced: favor short paragraphs, but allow medium paragraphs when a beat needs accumulation.",
        "Prefer short to medium sentences, clean Chinese punctuation, and sharp paragraph rhythm.",
        "Do not narrate like a plan document.",
        "Soft format preference: output chapter正文 first, then optionally append [[META]] JSON [[/META]] with fields like title and notes.",
        `Keep the draft between ${input.minParagraphs ?? 8} and ${input.maxParagraphs ?? 14} paragraphs.`,
        `Target draft length: 3000–4500 中文字符 (Chinese characters). Web-novel chapters under 2500 characters feel undercooked; expand sensory detail, dialogue, and beat texture before stopping.`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      role: "user",
      content: [
        `Task: ${contextPack.task}`,
        `Must obey: ${mustRules.join(" | ")}`,
        `Avoid rules: ${avoidRules.join(" | ")}`,
        `Task-specific rules: ${taskRules.join(" | ")}`,
        `Chapter execution reminders: ${chapterExecutionReminders.join(" | ")}`,
        `Theme pressure: ${themePressure.join(" | ")}`,
        `Chapter goal: ${contextPack.chapterObjective.goal}`,
        `Chapter type: ${contextPack.chapterObjective.chapterType ?? "progress"}`,
        `Emotional goal: ${contextPack.chapterObjective.emotionalGoal}`,
        `Planned outcome: ${contextPack.chapterObjective.plannedOutcome}`,
        `Scene type: ${contextPack.chapterObjective.sceneType}`,
        `Scene tags: ${sceneTags.join(" | ")}`,
        `Commercial signals: ${formatCommercialSignals(input)}`,
        episode
          ? `Episode packet: mode=${episode.chapterMode}; payoffType=${episode.payoffType}; choice=${episode.nonTransferableChoice}; cost=${episode.choiceCost}; consequence=${episode.protagonistConsequence}; readerPayoff=${episode.readerPayoff}; endHook=${episode.endHook}`
          : undefined,
        `Chapter signals: ${contextPack.chapterSignals.join(" | ")}`,
        input.previousChapterTailProse
          ? `【Canon Bridge — AUTHORITATIVE for chapter opening】\n上一章实际结尾原文（直接续写，不要跳过其中未写完的事件）：\n${input.previousChapterTailProse}\n\n本章必须从上方原文的末尾状态自然衔接，像同一个故事的下一段。如果scene plan的openingScene.entryHook与此矛盾，以Canon Bridge为准：先把上一章结尾未写完的事件交代清楚，再过渡到scene plan的核心任务。禁止硬切。`
          : input.previousChapterNextSituation
            ? `【Canon Bridge — AUTHORITATIVE for chapter opening】\n上一章实际结尾状态（高于scene plan的openingScene.entryHook）：\n${input.previousChapterNextSituation}\n\n本章必须从这个状态衔接开场。如果scene plan的openingScene.entryHook与此矛盾，以Canon Bridge为准，写一段短暂的过渡把实际结尾状态接入scene plan的核心任务。不要硬切到scene plan的开场设定。`
            : undefined,
        contextPack.scenePlanSignals?.length
          ? `Scene plan contract for THIS chapter (authoritative for core task / midConflict / climax / endHook; openingScene.entryHook subordinate to Canon Bridge above if present):\n${contextPack.scenePlanSignals.join("\n")}`
          : undefined,
        contextPack.dueRevealContracts?.length
          ? `Reveal contracts due THIS chapter (each must surface on-page; HARD reveals are mandatory):\n${contextPack.dueRevealContracts
              .map((item) => {
                const head = `- ${item.id} [${item.severity}] kind=${item.kind} mode=${item.revealMode}${
                  item.refId ? ` ref=${item.refId}` : ""
                }: ${item.text}`;
                const lines = [head];
                if (item.factTitle && item.factDescription) {
                  lines.push(`    bound world fact: ${item.factTitle}`);
                  lines.push(`    description: ${item.factDescription}`);
                }
                if (item.forbiddenVocabulary.length > 0) {
                  lines.push(
                    `    FORBIDDEN VOCABULARY for POV (mode=${item.revealMode}): ${item.forbiddenVocabulary.join(" / ")}`,
                  );
                }
                return lines.join("\n");
              })
              .join("\n")}`
          : undefined,
        (() => {
          const kb = contextPack.knowledgeBoundary;
          if (!kb) return undefined;
          const blocks: string[] = [];
          if (kb.experiencedAsAnomaly.length > 0) {
            const list = kb.experiencedAsAnomaly
              .map((entry) => `${entry.factId}: forbidden=${entry.vocab.join(" / ") || "(none)"}`)
              .join("\n  ");
            blocks.push(`Knowledge boundary — experienced_as_anomaly facts (POV must not name these):\n  ${list}`);
          }
          if (kb.suspectedAsPattern.length > 0) {
            const list = kb.suspectedAsPattern
              .map((entry) => `${entry.factId}: forbidden=${entry.vocab.join(" / ") || "(none)"}`)
              .join("\n  ");
            blocks.push(`Knowledge boundary — suspected_as_pattern facts (POV may use private placeholder, never canonical labels):\n  ${list}`);
          }
          if (kb.namedExplicitly.length > 0) {
            const list = kb.namedExplicitly
              .map((entry) => `${entry.factId}: allowed=${entry.vocab.join(" / ") || "(none)"}`)
              .join("\n  ");
            blocks.push(`Knowledge boundary — named_explicitly facts (canonical labels allowed):\n  ${list}`);
          }
          return blocks.length > 0 ? blocks.join("\n\n") : undefined;
        })(),
        contextPack.arcShiftSignals?.length
          ? `Arc shift contract this chapter (must enact the listed pressureTrigger -> newChoice -> costPaid on-page; do not paraphrase as theme):\n${contextPack.arcShiftSignals.join("\n")}`
          : undefined,
        `Retrieval signals: ${contextPack.retrievalSignals.join(" | ")}`,
        payoffPatterns.length
          ? `Payoff pattern: ${payoffPatterns.join(" | ")}`
          : undefined,
        contextPack.readerValue?.genrePackId
          ? `Genre payoff pack: ${contextPack.readerValue.genrePackId}`
          : undefined,
        powerPatterns.length
          ? `Power pattern: ${powerPatterns.join(" | ")}`
          : undefined,
        `Active characters:\n${formatActiveCharacters(input)}`,
        `Relevant memories:\n${formatRelevantMemories(input)}`,
        `Relevant ledger entries:\n${formatRelevantLedgers(input)}`,
        `Relevant chapter cards:\n${formatRelevantChapterCards(input)}`,
        `Relevant world facts:\n${formatRelevantWorldFacts(input)}`,
        // Re-stated at the tail because earlier system-prompt length directives lose
        // weight as retrieval/memory context grows over later chapters.
        `Length contract (HARD): produce 3000–4500 Chinese characters. If you finish below 2500 characters, expand sensory detail, beat texture, dialogue, and reaction shots before stopping. Do NOT pad with summary or restate prior chapters; expand the current scene.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const writerResultSchema: WriterResult = {
  title: "string",
  draft: "string",
  notes: ["string"],
} as unknown as WriterResult;
