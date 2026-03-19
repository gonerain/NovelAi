import type {
  AuthorInterviewDisplayComponent,
  AuthorInterviewNormalizedComponent,
  AuthorInterviewResult,
} from "./author-interview.js";
import type { AuthorComponentCategory, ConstraintRule } from "./types.js";

const allowedCategories: AuthorComponentCategory[] = [
  "theme",
  "style",
  "character",
  "plot",
  "conflict",
  "ending",
  "aesthetic",
  "constraint",
];

function uniqueTrimmed(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function normalizeCategory(category: string): AuthorComponentCategory {
  if (allowedCategories.includes(category as AuthorComponentCategory)) {
    return category as AuthorComponentCategory;
  }

  switch (category) {
    case "relationship":
      return "conflict";
    case "pacing":
      return "plot";
    default:
      return "style";
  }
}

function normalizeDisplayComponent(
  component: AuthorInterviewDisplayComponent,
): AuthorInterviewDisplayComponent {
  return {
    ...component,
    category: normalizeCategory(component.category),
    strengthens: uniqueTrimmed(component.strengthens, 2),
    suppresses: uniqueTrimmed(component.suppresses, 2),
    validationHints: uniqueTrimmed(component.validationHints, 2),
    effects: {
      planner: uniqueTrimmed(component.effects.planner ?? [], 2),
      writer: uniqueTrimmed(component.effects.writer ?? [], 2),
      reviewer: uniqueTrimmed(component.effects.reviewer ?? [], 2),
      memory: uniqueTrimmed(component.effects.memory ?? [], 2),
    },
  };
}

function normalizeNormalizedComponent(
  component: AuthorInterviewNormalizedComponent,
): AuthorInterviewNormalizedComponent {
  return {
    ...component,
    category: normalizeCategory(component.category),
    strengthens: uniqueTrimmed(component.strengthens, 2),
    suppresses: uniqueTrimmed(component.suppresses, 2),
    plannerEffects: uniqueTrimmed(component.plannerEffects, 2),
    writerEffects: uniqueTrimmed(component.writerEffects, 2),
    reviewerChecks: uniqueTrimmed(component.reviewerChecks, 2),
    memoryHints: uniqueTrimmed(component.memoryHints, 2),
  };
}

function normalizeConstraints(constraints: ConstraintRule[]): ConstraintRule[] {
  return constraints.slice(0, 3).map((constraint) => ({
    ...constraint,
    name: constraint.name.trim(),
    description: constraint.description.trim(),
  }));
}

export function normalizeAuthorInterviewResult(
  result: AuthorInterviewResult,
): AuthorInterviewResult {
  return {
    display: {
      ...result.display,
      openQuestions: uniqueTrimmed(result.display.openQuestions, 2),
      conflictsDetected: result.display.conflictsDetected.slice(0, 2),
      constraints: normalizeConstraints(result.display.constraints),
      authorProfile: {
        ...result.display.authorProfile,
        corePreferences: uniqueTrimmed(result.display.authorProfile.corePreferences, 3),
        favoriteCharacterTypes: uniqueTrimmed(
          result.display.authorProfile.favoriteCharacterTypes,
          3,
        ),
        favoriteRelationshipPatterns: uniqueTrimmed(
          result.display.authorProfile.favoriteRelationshipPatterns,
          3,
        ),
        plotBiases: uniqueTrimmed(result.display.authorProfile.plotBiases, 3),
        endingBiases: uniqueTrimmed(result.display.authorProfile.endingBiases, 3),
        aestheticMotifs: uniqueTrimmed(
          result.display.authorProfile.aestheticMotifs,
          4,
        ),
      },
      components: result.display.components
        .slice(0, 5)
        .map(normalizeDisplayComponent),
    },
    normalized: {
      ...result.normalized,
      constraints: normalizeConstraints(result.normalized.constraints),
      authorProfile: {
        ...result.normalized.authorProfile,
        corePreferences: uniqueTrimmed(
          result.normalized.authorProfile.corePreferences,
          3,
        ),
        favoriteCharacterTypes: uniqueTrimmed(
          result.normalized.authorProfile.favoriteCharacterTypes,
          3,
        ),
        favoriteRelationshipPatterns: uniqueTrimmed(
          result.normalized.authorProfile.favoriteRelationshipPatterns,
          3,
        ),
        plotBiases: uniqueTrimmed(result.normalized.authorProfile.plotBiases, 3),
        endingBiases: uniqueTrimmed(result.normalized.authorProfile.endingBiases, 3),
        aestheticMotifs: uniqueTrimmed(
          result.normalized.authorProfile.aestheticMotifs,
          3,
        ),
      },
      components: result.normalized.components
        .slice(0, 5)
        .map(normalizeNormalizedComponent),
    },
  };
}
