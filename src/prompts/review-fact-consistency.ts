import type {
  FactConsistencyReviewerInput,
  FactConsistencyReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function selectRelevantFacts(input: FactConsistencyReviewerInput) {
  const visibleMemoryIds = new Set([
    ...input.contextPack.relevantMemories.map((memory) => memory.id),
    ...input.contextPack.relevantLedgerEntries.flatMap((entry) => entry.sourceMemoryIds),
    ...input.contextPack.relevantChapterCards.flatMap((card) => card.memoryIds),
  ]);
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
        "Check only five issue types: injury conflicts, knowledge-boundary conflicts, world-rule conflicts, direct fact conflicts, and role consistency conflicts.",
        "World-rule conflict includes transaction semantics drift: if a draft changes the subject, object, beneficiary, loss target, payer, or received benefit of a rule/bargain/cost/exchange/debt/contract from the provided facts, return a `world_rule_conflict` finding.",
        "World-rule conflict includes protagonist-centering drift: if a cost that should remove a relationship route from one character is rewritten as the protagonist becoming the new chosen target/rescuer/owner/beneficiary, return a `world_rule_conflict` finding unless the provided facts explicitly state that transfer.",
        "World-rule conflict includes trivial-workaround failure: if the draft treats a symbolic loss as serious but a plain workaround would solve it and no provided fact explains why the workaround fails, return a `world_rule_conflict` finding.",
        "Knowledge-boundary conflict means a POV uses information they cannot access. Do not flag terminology that appears in an object the POV can directly see in the scene, such as a ticket, ledger, sign, text message, contract, screen, or printed note.",
        "Do not flag concrete visible props as knowledge leaks merely because they also appear in world facts. A pink backpack, printed ticket wording, or ledger label is allowed if the draft shows it on page.",
        "Role consistency means a character's established identity/boundary/stance should not be contradicted without explicit transition evidence in this chapter.",
        "Do not comment on style, pacing, or literary quality.",
        "Always score emotion and pacing from 0 to 10 in `scoring`, but never turn emotion/pacing feedback into findings.",
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
        `Retrieval signals: ${input.contextPack.retrievalSignals.join(" | ")}`,
        `Active characters:\n${JSON.stringify(input.contextPack.activeCharacters, null, 2)}`,
        `Relationship candidates:\n${JSON.stringify(input.relationshipCandidates ?? [], null, 2)}`,
        `Relevant ledger entries:\n${JSON.stringify(input.contextPack.relevantLedgerEntries, null, 2)}`,
        `Recent chapter cards:\n${JSON.stringify(input.contextPack.relevantChapterCards, null, 2)}`,
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
  scoring: {
    emotion: 7,
    pacing: 7,
  },
  notes: ["string"],
} as unknown as FactConsistencyReviewerResult;
