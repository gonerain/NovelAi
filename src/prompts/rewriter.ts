import type {
  FactConsistencyReviewerResult,
  MissingResourceReviewerResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

interface RewriterInput {
  title?: string;
  draft: string;
  mode: "repair_first" | "hybrid_upgrade" | "quality_boost";
  objective?: string;
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
  const modeInstruction = (() => {
    if (input.mode === "repair_first") {
      return [
        "Mode: repair_first.",
        "Primary objective: fix reviewer findings first, then keep prose readable.",
        "Treat high-severity findings as mandatory fixes.",
        "Do not introduce new lore contradictions.",
      ].join("\n");
    }

    if (input.mode === "hybrid_upgrade") {
      return [
        "Mode: hybrid_upgrade.",
        "Primary objective: fix important reviewer findings and improve excitement/readability together.",
        "Prioritize consistency first, then rhythm, tension, and hook quality.",
        "Do not add new plot events or world facts that break continuity.",
      ].join("\n");
    }

    return [
      "Mode: quality_boost.",
      "Primary objective: improve excitement, rhythm, emotional pressure, and chapter hook.",
      "Keep plot facts, core events, and outcomes unchanged.",
      "Do not add new plot events or world facts.",
    ].join("\n");
  })();

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
        input.objective ? `Execution objective: ${input.objective}` : "",
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
