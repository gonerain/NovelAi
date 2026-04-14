import type { AuthorInterviewResult } from "./author-interview.js";
import type { AuthorComponentCategory } from "./types.js";

const allowedCategories = new Set<AuthorComponentCategory>([
  "theme",
  "style",
  "character",
  "plot",
  "relationship",
  "pacing",
  "conflict",
  "ending",
  "aesthetic",
  "constraint",
]);

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateAuthorInterviewResult(
  result: AuthorInterviewResult,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [index, component] of result.display.components.entries()) {
    if (!allowedCategories.has(component.category)) {
      issues.push({
        path: `display.components[${index}].category`,
        message: `Invalid category: ${component.category}`,
      });
    }
  }

  for (const [index, component] of result.normalized.components.entries()) {
    if (!allowedCategories.has(component.category)) {
      issues.push({
        path: `normalized.components[${index}].category`,
        message: `Invalid category: ${component.category}`,
      });
    }
  }

  if (result.display.components.length > 8) {
    issues.push({
      path: "display.components",
      message: "Too many display components; expected at most 8.",
    });
  }

  if (result.normalized.components.length > 8) {
    issues.push({
      path: "normalized.components",
      message: "Too many normalized components; expected at most 8.",
    });
  }

  if (result.display.constraints.length > 6) {
    issues.push({
      path: "display.constraints",
      message: "Too many constraints; expected at most 6.",
    });
  }

  if (result.display.openQuestions.length > 4) {
    issues.push({
      path: "display.openQuestions",
      message: "Too many open questions; expected at most 4.",
    });
  }

  if (result.display.conflictsDetected.length > 4) {
    issues.push({
      path: "display.conflictsDetected",
      message: "Too many conflicts; expected at most 4.",
    });
  }

  return issues;
}
