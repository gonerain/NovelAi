import type {
  CommercialReviewerInput,
  CommercialReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildCommercialReviewMessages(
  input: CommercialReviewerInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a commercial web-novel chapter reviewer.",
        "Check only five issue types: hook_delay, problem_blur, payoff_weak, hook_weak, scanability_weak.",
        "Focus on whether the chapter quickly communicates concrete trouble, delivers its promised small reward, and creates desire to continue reading.",
        "Do not check fact consistency, world rules, or resource logic here.",
        "Base judgments on the provided commercial signals, chapter objective, and draft only.",
        "Always return scoring with hookClarity, payoffDelivery, and scanability from 0 to 10.",
        "Return at most 4 findings. If there are no clear commercial issues, return an empty findings array.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter goal: ${input.contextPack.chapterObjective.goal}`,
        `Planned outcome: ${input.contextPack.chapterObjective.plannedOutcome}`,
        `Scene tags: ${input.contextPack.chapterObjective.sceneTags.join(" | ")}`,
        `Commercial signals: ${JSON.stringify(input.contextPack.commercialSignals ?? {}, null, 2)}`,
        `Chapter signals: ${input.contextPack.chapterSignals.join(" | ")}`,
        `Reviewer checks: ${input.contextPack.taskRules.join(" | ")}`,
        `Draft:\n${input.draft}`,
      ].join("\n\n"),
    },
  ];
}

export const commercialReviewerResultSchema: CommercialReviewerResult = {
  findings: [
    {
      issueType: "problem_blur",
      severity: "medium",
      title: "string",
      evidence: "string",
      suggestedFix: "string",
    },
  ],
  scoring: {
    hookClarity: 7,
    payoffDelivery: 7,
    scanability: 7,
  },
  notes: ["string"],
} as unknown as CommercialReviewerResult;
