import type { WriterInput, WriterResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function formatActiveCharacters(input: WriterInput): string {
  return input.contextPack.activeCharacters
    .slice(0, 2)
    .map((character) =>
      [
        `${character.name}(${character.id})`,
        `goals=${character.currentGoals.join(" / ") || "none"}`,
        `emotion=${character.emotionalState.join(" / ") || "none"}`,
        `wounds=${character.wounds.join(" / ") || "none"}`,
        `voice=${character.voiceNotes.join(" / ") || "none"}`,
      ].join("; "),
    )
    .join("\n");
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
        isEarlyChapter
          ? "Use chapterObjective + key memories as primary context. In chapter 1-3, world-setting must be explicit (not only implicit mood): include concrete mentions of institutions, procedures, labels, or social consequences."
          : "Use chapterObjective + key memories as primary context. Keep world facts tied to concrete scene consequences, not abstract lore blocks.",
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
