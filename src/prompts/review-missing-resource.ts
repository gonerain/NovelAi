import type {
  MissingResourceReviewerInput,
  MissingResourceReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function selectCriticalResources(input: MissingResourceReviewerInput) {
  const visibleMemoryIds = new Set(input.contextPack.relevantMemories.map((memory) => memory.id));

  return input.storyMemories
    .filter((memory) => {
      if (!visibleMemoryIds.has(memory.id)) {
        return false;
      }

      if (memory.status !== "active" && memory.status !== "triggered") {
        return false;
      }

      if (memory.priority !== "critical" && memory.priority !== "high") {
        return false;
      }

      return (
        memory.kind === "resource" ||
        memory.kind === "promise" ||
        memory.kind === "suspense_hook" ||
        memory.kind === "long_arc_thread"
      );
    })
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      summary: memory.summary,
      kind: memory.kind,
      priority: memory.priority,
      triggerConditions: memory.triggerConditions,
      notes: memory.notes,
    }));
}

export function buildMissingResourceReviewMessages(
  input: MissingResourceReviewerInput,
): ChatMessage[] {
  const candidateResources = selectCriticalResources(input);

  return [
    {
      role: "system",
      content: [
        "You are a missing critical resource reviewer.",
        "Check only one failure mode: whether the draft ignores a critical resource, promise, suspense hook, or long-arc thread that should have been considered in this scene.",
        "Do not review prose quality, pacing, or style.",
        "If the draft does not use a resource but clearly explains why it is not used, do not report it.",
        "Only report a finding when the resource should have been considered and the draft neither handles nor explains it.",
        "Return at most 3 findings. If there are no issues, return an empty findings array.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter goal: ${input.contextPack.chapterObjective.goal}`,
        `Emotional goal: ${input.contextPack.chapterObjective.emotionalGoal}`,
        `Planned outcome: ${input.contextPack.chapterObjective.plannedOutcome}`,
        `Scene tags: ${input.contextPack.chapterObjective.sceneTags.join(" | ")}`,
        `Hard constraints: ${input.contextPack.hardConstraints.join(" | ")}`,
        `Active characters:\n${JSON.stringify(input.contextPack.activeCharacters, null, 2)}`,
        `Candidate critical resources:\n${JSON.stringify(candidateResources, null, 2)}`,
        `Draft:\n${input.draft}`,
      ].join("\n\n"),
    },
  ];
}

export const missingResourceReviewerResultSchema: MissingResourceReviewerResult = {
  findings: [
    {
      issueType: "missing_critical_resource",
      severity: "high",
      memoryId: "string",
      title: "string",
      evidence: "string",
      expectedHandling: "string",
      suggestedFix: "string",
    },
  ],
  notes: ["string"],
} as unknown as MissingResourceReviewerResult;
