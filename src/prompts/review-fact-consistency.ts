import type {
  FactConsistencyReviewerInput,
  FactConsistencyReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function selectRelevantFacts(input: FactConsistencyReviewerInput) {
  const visibleMemoryIds = new Set(input.contextPack.relevantMemories.map((memory) => memory.id));
  const visibleFactIds = new Set(input.contextPack.relevantWorldFacts.map((fact) => fact.id));

  return {
    memories: input.storyMemories
      .filter((memory) => visibleMemoryIds.has(memory.id))
      .map((memory) => ({
        id: memory.id,
        title: memory.title,
        summary: memory.summary,
        kind: memory.kind,
        priority: memory.priority,
        visibility: memory.visibility,
        triggerConditions: memory.triggerConditions,
        notes: memory.notes,
      })),
    facts: input.worldFacts
      .filter((fact) => visibleFactIds.has(fact.id))
      .map((fact) => ({
        id: fact.id,
        title: fact.title,
        description: fact.description,
        category: fact.category,
        scope: fact.scope,
        visibility: fact.visibility,
      })),
  };
}

export function buildFactConsistencyReviewMessages(
  input: FactConsistencyReviewerInput,
): ChatMessage[] {
  const relevant = selectRelevantFacts(input);

  return [
    {
      role: "system",
      content: [
        "You are a fact consistency reviewer.",
        "Check only four issue types: injury conflicts, knowledge-boundary conflicts, world-rule conflicts, and direct fact conflicts.",
        "Do not comment on style, pacing, or literary quality.",
        "Only return a finding when the draft clearly contradicts the provided facts or memories.",
        "Return at most 4 findings. If there are no issues, return an empty findings array.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter goal: ${input.contextPack.chapterObjective.goal}`,
        `Emotional goal: ${input.contextPack.chapterObjective.emotionalGoal}`,
        `Scene tags: ${input.contextPack.chapterObjective.sceneTags.join(" | ")}`,
        `Must rules: ${input.contextPack.mustRules.join(" | ")}`,
        `Reviewer checks: ${input.contextPack.taskRules.join(" | ")}`,
        `Active characters:\n${JSON.stringify(input.contextPack.activeCharacters, null, 2)}`,
        `Relevant memory facts:\n${JSON.stringify(relevant.memories, null, 2)}`,
        `Relevant world facts:\n${JSON.stringify(relevant.facts, null, 2)}`,
        `Draft:\n${input.draft}`,
      ].join("\n\n"),
    },
  ];
}

export const factConsistencyReviewerResultSchema: FactConsistencyReviewerResult = {
  findings: [
    {
      issueType: "fact_conflict",
      severity: "medium",
      title: "string",
      evidence: "string",
      violatedFactIds: ["string"],
      suggestedFix: "string",
    },
  ],
  notes: ["string"],
} as unknown as FactConsistencyReviewerResult;
