import type { MemoryUpdaterInput, MemoryUpdaterResult } from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function selectRelevantExistingMemories(input: MemoryUpdaterInput) {
  const requiredIds = new Set(input.chapterPlan.requiredMemories);

  return input.storyMemories
    .filter((memory) => {
      if (requiredIds.has(memory.id)) {
        return true;
      }

      if (memory.relatedCharacterIds.some((characterId) => input.activeCharacterIds.includes(characterId))) {
        return true;
      }

      return false;
    })
    .slice(0, 8)
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      summary: memory.summary,
      kind: memory.kind,
      status: memory.status,
      priority: memory.priority,
      triggerConditions: memory.triggerConditions,
      notes: memory.notes,
    }));
}

export function buildMemoryUpdaterMessages(input: MemoryUpdaterInput): ChatMessage[] {
  const relevantMemories = selectRelevantExistingMemories(input);

  return [
    {
      role: "system",
      content: [
        "You are a story memory updater.",
        "Your job is to convert a completed chapter draft into structured memory changes.",
        "Summarize what the chapter changed, what situation should carry into the next chapter, which existing memories changed status, and what new memories should be created.",
        "Only create memories that matter for future retrieval, such as resources, promises, injuries, clues, suspense hooks, major events, or long arc threads.",
        "Keep carryForwardHints short and operational.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter number: ${input.chapterNumber}`,
        `Chapter title: ${input.chapterPlan.title ?? ""}`,
        `Chapter goal: ${input.chapterPlan.chapterGoal}`,
        `Planned outcome: ${input.chapterPlan.plannedOutcome}`,
        `Required memories: ${input.chapterPlan.requiredMemories.join(", ")}`,
        `Active character ids: ${input.activeCharacterIds.join(", ")}`,
        `Relevant existing memories:\n${JSON.stringify(relevantMemories, null, 2)}`,
        `Draft:\n${input.draft}`,
      ].join("\n\n"),
    },
  ];
}

export const memoryUpdaterResultSchema: MemoryUpdaterResult = {
  chapterSummary: "string",
  nextSituation: "string",
  memoryPatches: [
    {
      memoryId: "string",
      action: "triggered",
      reason: "string",
      notes: ["string"],
    },
  ],
  newMemories: [
    {
      title: "string",
      summary: "string",
      kind: "event",
      ownerCharacterId: "string",
      relatedCharacterIds: ["string"],
      relatedLocationIds: ["string"],
      triggerConditions: ["string"],
      status: "active",
      priority: "medium",
      visibility: "public",
      notes: ["string"],
    },
  ],
  carryForwardHints: ["string"],
} as unknown as MemoryUpdaterResult;
