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
  "relationship",
  "pacing",
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
  return "style";
}

function normalizeDisplayComponent(
  component: AuthorInterviewDisplayComponent,
): AuthorInterviewDisplayComponent {
  return {
    ...component,
    category: normalizeCategory(component.category),
    strengthens: uniqueTrimmed(component.strengthens, 4),
    suppresses: uniqueTrimmed(component.suppresses, 4),
    validationHints: uniqueTrimmed(component.validationHints, 4),
    effects: {
      planner: uniqueTrimmed(component.effects.planner ?? [], 4),
      writer: uniqueTrimmed(component.effects.writer ?? [], 4),
      reviewer: uniqueTrimmed(component.effects.reviewer ?? [], 4),
      memory: uniqueTrimmed(component.effects.memory ?? [], 4),
    },
  };
}

function normalizeNormalizedComponent(
  component: AuthorInterviewNormalizedComponent,
): AuthorInterviewNormalizedComponent {
  return {
    ...component,
    category: normalizeCategory(component.category),
    strengthens: uniqueTrimmed(component.strengthens, 4),
    suppresses: uniqueTrimmed(component.suppresses, 4),
    plannerEffects: uniqueTrimmed(component.plannerEffects, 4),
    writerEffects: uniqueTrimmed(component.writerEffects, 4),
    reviewerChecks: uniqueTrimmed(component.reviewerChecks, 4),
    memoryHints: uniqueTrimmed(component.memoryHints, 4),
  };
}

function normalizeConstraints(constraints: ConstraintRule[]): ConstraintRule[] {
  return constraints.slice(0, 6).map((constraint) => ({
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
      conflictsDetected: result.display.conflictsDetected.slice(0, 4),
      constraints: normalizeConstraints(result.display.constraints),
      authorProfile: {
        ...result.display.authorProfile,
        corePreferences: uniqueTrimmed(result.display.authorProfile.corePreferences, 5),
        favoriteCharacterTypes: uniqueTrimmed(
          result.display.authorProfile.favoriteCharacterTypes,
          5,
        ),
        favoriteRelationshipPatterns: uniqueTrimmed(
          result.display.authorProfile.favoriteRelationshipPatterns,
          5,
        ),
        plotBiases: uniqueTrimmed(result.display.authorProfile.plotBiases, 5),
        endingBiases: uniqueTrimmed(result.display.authorProfile.endingBiases, 5),
        aestheticMotifs: uniqueTrimmed(
          result.display.authorProfile.aestheticMotifs,
          6,
        ),
      },
      components: result.display.components
        .slice(0, 8)
        .map(normalizeDisplayComponent),
    },
    normalized: {
      ...result.normalized,
      constraints: normalizeConstraints(result.normalized.constraints),
      authorProfile: {
        ...result.normalized.authorProfile,
        corePreferences: uniqueTrimmed(
          result.normalized.authorProfile.corePreferences,
          8,
        ),
        favoriteCharacterTypes: uniqueTrimmed(
          result.normalized.authorProfile.favoriteCharacterTypes,
          8,
        ),
        favoriteRelationshipPatterns: uniqueTrimmed(
          result.normalized.authorProfile.favoriteRelationshipPatterns,
          8,
        ),
        plotBiases: uniqueTrimmed(result.normalized.authorProfile.plotBiases, 8),
        endingBiases: uniqueTrimmed(result.normalized.authorProfile.endingBiases, 8),
        aestheticMotifs: uniqueTrimmed(
          result.normalized.authorProfile.aestheticMotifs,
          8,
        ),
      },
      components: result.normalized.components
        .slice(0, 8)
        .map(normalizeNormalizedComponent),
    },
  };
}
