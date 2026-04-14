import type { WriterInput, WriterResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function formatActiveCharacters(input: WriterInput): string {
  return input.contextPack.activeCharacters
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

function formatRelevantWorldFacts(input: WriterInput): string {
  return input.contextPack.relevantWorldFacts
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
        "Honor mustRules strictly.",
        "Use chapterObjective, activeCharacters, relevantMemories, and relevantWorldFacts as the current working context.",
        "Use authorIdentityRules and taskRules to control tone, relationship handling, and emotional delivery.",
        "Use readerValue to make the chapter feel worth reading now: the draft should cash out at least one clear reader reward, not just atmosphere.",
        "Do not turn the chapter into slogan-like hype. Deliver payoff through scene, choice, relationship movement, or pressure shift.",
        "Prefer prose that notices abnormal details instead of explaining themes directly.",
        "Prefer short to medium sentences, clean Chinese punctuation, and sharp paragraph rhythm.",
        "Let tension accumulate through observation, pauses, repeated micro-failures, and what characters choose not to say.",
        "When a key beat lands, you may use very short standalone sentences for emphasis.",
        "Show dangerous competence through precise action, not through bragging or explanation.",
        "Do not narrate like a plan document. Do not restate chapter goals in prose.",
        `Keep the draft between ${input.minParagraphs ?? 5} and ${input.maxParagraphs ?? 8} paragraphs.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Task: ${contextPack.task}`,
        `Must obey: ${contextPack.mustRules.join(" | ")}`,
        `Author identity rules: ${contextPack.authorIdentityRules.join(" | ")}`,
        `Task-specific rules: ${contextPack.taskRules.join(" | ")}`,
        `Chapter execution reminders: ${contextPack.chapterExecutionReminders.join(" | ")}`,
        `Theme pressure: ${contextPack.themePressure.join(" | ")}`,
        `Avoid rules: ${contextPack.avoidRules.join(" | ")}`,
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
        [
          "Style target:",
          "1. Write through observation and deviation: what is too precise, too quiet, too fast, too steady, too clean.",
          "2. Let the narration feel like it is watching cracks appear, not summarizing a beat sheet.",
          "3. Keep subtext heavy. Dialogue should be brief, controlled, and slightly evasive.",
          "4. Use body reactions, breath, gaze, pauses, and tiny movement errors to reveal pain or care.",
          "5. Preserve a dangerous edge: even injured, the protagonist should still feel sharp and potentially lethal.",
        ].join("\n"),
        `Active characters:\n${formatActiveCharacters(input)}`,
        `Relevant memories:\n${formatRelevantMemories(input)}`,
        `Relevant world facts:\n${formatRelevantWorldFacts(input)}`,
      ].join("\n\n"),
    },
  ];
}

export const writerResultSchema: WriterResult = {
  title: "string",
  draft: "string",
  notes: ["string"],
} as unknown as WriterResult;
