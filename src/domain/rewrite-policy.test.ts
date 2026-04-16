import test from "node:test";
import assert from "node:assert/strict";

import { shouldRewriteForConsistency } from "./rewrite-policy.js";
import type { FactConsistencyReviewerResult } from "./reviewer.js";

function buildReview(findingsCount: number): FactConsistencyReviewerResult {
  return {
    findings: Array.from({ length: findingsCount }).map(() => ({
      issueType: "fact_conflict",
      severity: "medium",
      title: "conflict",
      evidence: "evidence",
      violatedFactIds: ["fact-1"],
      suggestedFix: "fix",
    })),
    scoring: {
      emotion: 8,
      pacing: 7,
    },
    notes: [],
  };
}

test("rewrite is triggered when fact/role consistency findings exist", () => {
  assert.equal(shouldRewriteForConsistency(buildReview(1)), true);
});

test("rewrite is skipped when no fact/role consistency findings exist", () => {
  assert.equal(shouldRewriteForConsistency(buildReview(0)), false);
});
