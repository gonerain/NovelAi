import type {
  FactConsistencyReviewerResult,
  MissingResourceReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

interface RewriterInput {
  title?: string;
  draft: string;
  mode: "repair_first" | "literary_polish";
  missingResourceReview: MissingResourceReviewerResult;
  factConsistencyReview: FactConsistencyReviewerResult;
}

function summarizeFindings(args: RewriterInput): string {
  const missing = args.missingResourceReview.findings.map(
    (item, index) =>
      `${index + 1}. [${item.severity}] ${item.title} | memory=${item.memoryId} | fix=${item.suggestedFix}`,
  );
  const facts = args.factConsistencyReview.findings.map(
    (item, index) =>
      `${index + 1}. [${item.severity}] ${item.title} | violated=${item.violatedFactIds.join(", ") || "none"} | fix=${item.suggestedFix}`,
  );

  return [
    "Missing resource findings:",
    ...(missing.length > 0 ? missing : ["none"]),
    "",
    "Fact consistency findings:",
    ...(facts.length > 0 ? facts : ["none"]),
  ].join("\n");
}

export function buildRewriterMessages(input: RewriterInput): ChatMessage[] {
  const modeInstruction =
    input.mode === "repair_first"
      ? [
          "Mode: repair_first.",
          "First priority: resolve reviewer findings while preserving chapter intent.",
          "Treat every finding in Review summary as hard constraints to fix.",
          "List each fixed finding briefly in fixedFindings.",
          "Do not introduce new lore contradictions.",
          "After repairs, keep prose readable and controlled.",
        ].join("\n")
      : [
          "Mode: literary_polish.",
          "Reviewer issues are minor. Keep plot facts unchanged and focus on readability + literary quality.",
          "Improve rhythm, sentence variety, image precision, and emotional subtext.",
          "Do not add new plot events or world facts.",
        ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You are a chapter rewriter for long-form Chinese web novel drafting.",
        "Rewrite the chapter draft in Chinese only.",
        "Keep core events, chapter intent, and outcome unchanged.",
        "Do not output analysis or bullet points.",
        "Return valid JSON only.",
        modeInstruction,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        input.title ? `Current title: ${input.title}` : undefined,
        `Review summary:\n${summarizeFindings(input)}`,
        `Original draft:\n${input.draft}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export const rewriterResultSchema = {
  title: "string",
  draft: "string",
  notes: ["string"],
  fixedFindings: ["string"],
} as unknown as {
  title: string;
  draft: string;
  notes: string[];
  fixedFindings: string[];
};
