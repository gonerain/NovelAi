import type { WriterInput, WriterResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildWriterMessages(input: WriterInput): ChatMessage[] {
  const { contextPack } = input;

  return [
    {
      role: "system",
      content: [
        "You are a long-form web-novel drafting assistant.",
        "Write only the chapter draft for the current chapter.",
        "The novel draft itself must be written in Chinese.",
        "Do not explain your reasoning. Do not output planning notes. Do not output bullet points inside the draft.",
        "Honor hardConstraints strictly.",
        "Use chapterObjective, activeCharacters, relevantMemories, and relevantWorldFacts as the current working context.",
        "Use authorRules and promptCapsule to control tone, relationship handling, and emotional delivery.",
        "Use readerValue to make the chapter feel worth reading now: the draft should cash out at least one clear reader reward, not just atmosphere.",
        "Do not turn the chapter into slogan-like hype. Deliver payoff through scene, choice, relationship movement, or pressure shift.",
        `Keep the draft between ${input.minParagraphs ?? 5} and ${input.maxParagraphs ?? 8} paragraphs.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Task: ${contextPack.task}`,
        `Author rules: ${contextPack.authorRules.join(" | ")}`,
        `Hard constraints: ${contextPack.hardConstraints.join(" | ")}`,
        `Chapter goal: ${contextPack.chapterObjective.goal}`,
        `Emotional goal: ${contextPack.chapterObjective.emotionalGoal}`,
        `Planned outcome: ${contextPack.chapterObjective.plannedOutcome}`,
        `Scene type: ${contextPack.chapterObjective.sceneType}`,
        `Scene tags: ${contextPack.chapterObjective.sceneTags.join(" | ")}`,
        contextPack.readerValue?.sellingPoint
          ? `Arc selling point: ${contextPack.readerValue.sellingPoint}`
          : undefined,
        contextPack.readerValue?.hook ? `Arc hook: ${contextPack.readerValue.hook}` : undefined,
        contextPack.readerValue?.payoff
          ? `Arc payoff: ${contextPack.readerValue.payoff}`
          : undefined,
        contextPack.readerValue?.powerPatterns.length
          ? `Power patterns: ${contextPack.readerValue.powerPatterns.join(" | ")}`
          : undefined,
        contextPack.readerValue?.payoffPatterns.length
          ? `Payoff patterns: ${contextPack.readerValue.payoffPatterns.join(" | ")}`
          : undefined,
        `Prompt capsule: ${contextPack.promptCapsule.join(" | ")}`,
        `Active characters:\n${JSON.stringify(contextPack.activeCharacters, null, 2)}`,
        `Relevant memories:\n${JSON.stringify(contextPack.relevantMemories, null, 2)}`,
        `Relevant world facts:\n${JSON.stringify(contextPack.relevantWorldFacts, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export const writerResultSchema: WriterResult = {
  title: "string",
  draft: "string",
  notes: ["string"],
} as unknown as WriterResult;
