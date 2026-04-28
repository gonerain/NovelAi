import type { StateDelta, StoryContract } from "./types.js";

export interface StateDeltaEvalFinding {
  deltaId: string;
  severity: "info" | "warning" | "error";
  code:
    | "missing_evidence"
    | "hidden_reader_payoff"
    | "irreversible_contract_risk"
    | "low_confidence"
    | "unsupported_contract_id";
  message: string;
}

export interface StateDeltaEvalReport {
  chapterNumber: number;
  totalDeltas: number;
  materialDeltas: number;
  readerVisibleDeltas: number;
  hiddenDeltas: number;
  passed: boolean;
  findings: StateDeltaEvalFinding[];
}

function hasEvidence(delta: StateDelta): boolean {
  return delta.evidenceSnippet.trim().length >= 8;
}

export function evaluateStateDeltas(args: {
  chapterNumber: number;
  deltas: StateDelta[];
  contracts: StoryContract[];
}): StateDeltaEvalReport {
  const findings: StateDeltaEvalFinding[] = [];
  const contractIds = new Set(args.contracts.map((contract) => contract.id));

  for (const delta of args.deltas) {
    if ((delta.causalWeight === "major" || delta.causalWeight === "irreversible") && !hasEvidence(delta)) {
      findings.push({
        deltaId: delta.id,
        severity: "error",
        code: "missing_evidence",
        message: "Major or irreversible delta requires an evidence snippet.",
      });
    }
    if (delta.visibility === "offscreen" && delta.contractImpact.some((impact) => impact.impact === "fulfills")) {
      findings.push({
        deltaId: delta.id,
        severity: "error",
        code: "hidden_reader_payoff",
        message: "Hidden/offscreen delta cannot fulfill a reader-facing payoff.",
      });
    }
    if (
      delta.causalWeight === "irreversible" &&
      delta.contractImpact.some((impact) => impact.impact === "risks" || impact.impact === "violates")
    ) {
      findings.push({
        deltaId: delta.id,
        severity: "error",
        code: "irreversible_contract_risk",
        message: "Irreversible delta risks or violates a contract.",
      });
    }
    if (delta.confidence < 0.5) {
      findings.push({
        deltaId: delta.id,
        severity: "warning",
        code: "low_confidence",
        message: "Delta confidence is below 0.5.",
      });
    }
    for (const impact of delta.contractImpact) {
      if (!contractIds.has(impact.contractId)) {
        findings.push({
          deltaId: delta.id,
          severity: "warning",
          code: "unsupported_contract_id",
          message: `Delta references unknown contract id: ${impact.contractId}`,
        });
      }
    }
  }

  return {
    chapterNumber: args.chapterNumber,
    totalDeltas: args.deltas.length,
    materialDeltas: args.deltas.filter(
      (delta) => delta.causalWeight === "major" || delta.causalWeight === "irreversible",
    ).length,
    readerVisibleDeltas: args.deltas.filter((delta) => delta.visibility === "reader_visible").length,
    hiddenDeltas: args.deltas.filter((delta) => delta.visibility === "offscreen").length,
    passed: findings.every((finding) => finding.severity !== "error"),
    findings,
  };
}

