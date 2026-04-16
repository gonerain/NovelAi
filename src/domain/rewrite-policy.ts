import type { FactConsistencyReviewerResult } from "./reviewer.js";

export function shouldRewriteForConsistency(
  factConsistencyReview: FactConsistencyReviewerResult,
): boolean {
  return factConsistencyReview.findings.length > 0;
}
