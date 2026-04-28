import type {
  RoleDrivenReviewerInput,
  RoleDrivenReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildRoleDrivenReviewMessages(
  input: RoleDrivenReviewerInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a role-driven story reviewer.",
        "Check only four issue types: author_pushed_turn, choice_pressure_missing, character_cost_missing, consequence_chain_weak.",
        "Focus on whether the chapter's decisive turn comes from a character making a choice under pressure, and whether that choice creates visible cost or future consequence.",
        "Do not review world facts, resource recall, or commercial hook quality here.",
        "Use the provided chapter signals, active character decision profiles, and draft only.",
        "Always return scoring with choiceClarity, pressureBelievability, and consequenceStrength from 0 to 10.",
        "Return at most 4 findings. If the chapter is role-driven enough, return an empty findings array.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter objective: ${JSON.stringify(input.contextPack.chapterObjective, null, 2)}`,
        `Chapter signals: ${input.contextPack.chapterSignals.join(" | ")}`,
        `Active characters: ${JSON.stringify(input.contextPack.activeCharacters, null, 2)}`,
        `Task rules: ${input.contextPack.taskRules.join(" | ")}`,
        input.previousChapter
          ? `Previous chapter ${input.previousChapter.chapterNumber} role-drive snapshot (must NOT repeat verbatim): ${JSON.stringify(
              {
                decisionPressure: input.previousChapter.decisionPressure,
                likelyChoice: input.previousChapter.likelyChoice,
                immediateConsequence: input.previousChapter.immediateConsequence,
                relationshipShift: input.previousChapter.relationshipShift,
              },
              null,
              2,
            )}\nIf this chapter's decision pressure or relationship shift is essentially identical to the previous chapter, raise a "consequence_chain_weak" finding.`
          : "Previous chapter role-drive snapshot: (none)",
        `Draft:\n${input.draft}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const roleDrivenReviewerResultSchema: RoleDrivenReviewerResult = {
  findings: [
    {
      issueType: "author_pushed_turn",
      severity: "medium",
      title: "string",
      evidence: "string",
      suggestedFix: "string",
    },
  ],
  scoring: {
    choiceClarity: 7,
    pressureBelievability: 7,
    consequenceStrength: 7,
  },
  notes: ["string"],
} as unknown as RoleDrivenReviewerResult;
