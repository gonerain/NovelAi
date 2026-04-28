import test from "node:test";
import assert from "node:assert/strict";

import { evaluateStateDeltas } from "./state-delta-eval.js";
import type { StateDelta, StoryContract } from "./types.js";

const contract: StoryContract = {
  id: "contract-reader",
  contractType: "reader_promise",
  statement: "Reader promise",
  readerVisible: true,
  createdAtChapter: 1,
  priority: "high",
  evidence: [],
  forbiddenMoves: [],
  payoffSignals: [],
  status: "active",
};

function delta(overrides: Partial<StateDelta> = {}): StateDelta {
  return {
    id: overrides.id ?? "delta-1",
    chapterNumber: overrides.chapterNumber ?? 1,
    deltaType: overrides.deltaType ?? "thread_progress",
    targetType: overrides.targetType ?? "thread",
    targetId: overrides.targetId ?? "thread-a",
    before: overrides.before ?? "before",
    after: overrides.after ?? "after",
    causalWeight: overrides.causalWeight ?? "major",
    visibility: overrides.visibility ?? "reader_visible",
    evidenceSnippet: overrides.evidenceSnippet ?? "clear evidence snippet",
    confidence: overrides.confidence ?? 0.8,
    contractImpact: overrides.contractImpact ?? [],
    source: overrides.source ?? "episode_packet",
  };
}

test("major delta without evidence fails", () => {
  const report = evaluateStateDeltas({
    chapterNumber: 1,
    deltas: [delta({ evidenceSnippet: "" })],
    contracts: [contract],
  });

  assert.equal(report.passed, false);
  assert.equal(report.findings[0]?.code, "missing_evidence");
});

test("hidden delta cannot fulfill reader payoff", () => {
  const report = evaluateStateDeltas({
    chapterNumber: 1,
    deltas: [
      delta({
        visibility: "offscreen",
        contractImpact: [
          {
            contractId: "contract-reader",
            impact: "fulfills",
            note: "hidden payoff",
          },
        ],
      }),
    ],
    contracts: [contract],
  });

  assert.equal(report.passed, false);
  assert.equal(report.findings[0]?.code, "hidden_reader_payoff");
});

test("irreversible contract risk fails", () => {
  const report = evaluateStateDeltas({
    chapterNumber: 1,
    deltas: [
      delta({
        causalWeight: "irreversible",
        contractImpact: [
          {
            contractId: "contract-reader",
            impact: "risks",
            note: "risk",
          },
        ],
      }),
    ],
    contracts: [contract],
  });

  assert.equal(report.passed, false);
  assert.equal(report.findings[0]?.code, "irreversible_contract_risk");
});

