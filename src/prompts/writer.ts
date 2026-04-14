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

export function buildWriterMessages(input: WriterInput): ChatMessage[] {
  const { contextPack } = input;
  const mustRules = contextPack.mustRules.slice(0, 4);
  const avoidRules = contextPack.avoidRules.slice(0, 2);
  const chapterExecutionReminders = contextPack.chapterExecutionReminders.slice(0, 3);
  const taskRules = contextPack.taskRules.slice(0, 3);
  const themePressure = contextPack.themePressure.slice(0, 2);
  const sceneTags = contextPack.chapterObjective.sceneTags.slice(0, 3);
  const payoffPatterns = contextPack.readerValue?.payoffPatterns.slice(0, 1) ?? [];
  const powerPatterns = contextPack.readerValue?.powerPatterns.slice(0, 1) ?? [];

  return [
    {
      role: "system",
      content: [
        "You are a long-form web-novel drafting assistant.",
        "Write only the chapter draft for the current chapter.",
        "The novel draft itself must be written in Chinese.",
        "Do not explain your reasoning. Do not output planning notes. Do not output bullet points inside the draft.",
        "Honor mustRules strictly. Treat avoidRules as hard negatives.",
        "Use chapterObjective + key memories as primary context. Keep world facts minimal and implicit.",
        "Prefer short to medium sentences, clean Chinese punctuation, and sharp paragraph rhythm.",
        "Do not narrate like a plan document.",
        `Keep the draft between ${input.minParagraphs ?? 5} and ${input.maxParagraphs ?? 8} paragraphs.`,
      ].join("\n"),
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
        `Emotional goal: ${contextPack.chapterObjective.emotionalGoal}`,
        `Planned outcome: ${contextPack.chapterObjective.plannedOutcome}`,
        `Scene type: ${contextPack.chapterObjective.sceneType}`,
        `Scene tags: ${sceneTags.join(" | ")}`,
        payoffPatterns.length
          ? `Payoff pattern: ${payoffPatterns.join(" | ")}`
          : undefined,
        powerPatterns.length
          ? `Power pattern: ${powerPatterns.join(" | ")}`
          : undefined,
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
