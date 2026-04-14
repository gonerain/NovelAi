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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
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
    id: typeof component.id === "string" ? component.id : "component",
    name: typeof component.name === "string" ? component.name : "Unnamed component",
    category: normalizeCategory(component.category),
    description: typeof component.description === "string" ? component.description : "",
    priority: typeof component.priority === "number" ? component.priority : 2,
  };
}

function normalizeNormalizedComponent(
  component: AuthorInterviewNormalizedComponent,
): AuthorInterviewNormalizedComponent {
  return {
    ...component,
    id: typeof component.id === "string" ? component.id : "component",
    name: typeof component.name === "string" ? component.name : "Unnamed component",
    category: normalizeCategory(component.category),
    plannerEffects: uniqueTrimmed(asStringArray(component.plannerEffects), 4),
    writerEffects: uniqueTrimmed(asStringArray(component.writerEffects), 4),
    reviewerChecks: uniqueTrimmed(asStringArray(component.reviewerChecks), 4),
    memoryHints: uniqueTrimmed(asStringArray(component.memoryHints), 4),
    priority: typeof component.priority === "number" ? component.priority : 2,
  };
}

function normalizeConstraints(constraints: ConstraintRule[]): ConstraintRule[] {
  const source = Array.isArray(constraints) ? constraints : [];
  return source.slice(0, 6).map((constraint) => ({
    ...constraint,
    id: typeof constraint.id === "string" ? constraint.id : "constraint",
    name: typeof constraint.name === "string" ? constraint.name.trim() : "",
    description:
      typeof constraint.description === "string"
        ? constraint.description.trim()
        : "",
    severity: constraint.severity,
  }));
}

export function normalizeAuthorInterviewResult(
  result: AuthorInterviewResult,
): AuthorInterviewResult {
  return {
    display: {
      ...result.display,
      openQuestions: uniqueTrimmed(asStringArray(result.display.openQuestions), 2),
      conflictsDetected: Array.isArray(result.display.conflictsDetected)
        ? result.display.conflictsDetected.slice(0, 4)
        : [],
      constraints: normalizeConstraints(result.display.constraints),
      authorProfile: {
        ...result.display.authorProfile,
        summary:
          typeof result.display.authorProfile.summary === "string"
            ? result.display.authorProfile.summary
            : "",
        corePreferences: uniqueTrimmed(
          asStringArray(result.display.authorProfile.corePreferences),
          5,
        ),
        favoriteCharacterTypes: uniqueTrimmed(
          asStringArray(result.display.authorProfile.favoriteCharacterTypes),
          5,
        ),
        favoriteRelationshipPatterns: uniqueTrimmed(
          asStringArray(result.display.authorProfile.favoriteRelationshipPatterns),
          5,
        ),
        plotBiases: uniqueTrimmed(asStringArray(result.display.authorProfile.plotBiases), 5),
        endingBiases: uniqueTrimmed(
          asStringArray(result.display.authorProfile.endingBiases),
          5,
        ),
        aestheticMotifs: uniqueTrimmed(
          asStringArray(result.display.authorProfile.aestheticMotifs),
          6,
        ),
      },
      components: (Array.isArray(result.display.components) ? result.display.components : [])
        .slice(0, 8)
        .map(normalizeDisplayComponent),
    },
    normalized: {
      ...result.normalized,
      constraints: normalizeConstraints(result.normalized.constraints),
      authorProfile: {
        ...result.normalized.authorProfile,
        summary:
          typeof result.normalized.authorProfile.summary === "string"
            ? result.normalized.authorProfile.summary
            : "",
        corePreferences: uniqueTrimmed(
          asStringArray(result.normalized.authorProfile.corePreferences),
          8,
        ),
        favoriteCharacterTypes: uniqueTrimmed(
          asStringArray(result.normalized.authorProfile.favoriteCharacterTypes),
          8,
        ),
        favoriteRelationshipPatterns: uniqueTrimmed(
          asStringArray(result.normalized.authorProfile.favoriteRelationshipPatterns),
          8,
        ),
        plotBiases: uniqueTrimmed(
          asStringArray(result.normalized.authorProfile.plotBiases),
          8,
        ),
        endingBiases: uniqueTrimmed(
          asStringArray(result.normalized.authorProfile.endingBiases),
          8,
        ),
        aestheticMotifs: uniqueTrimmed(
          asStringArray(result.normalized.authorProfile.aestheticMotifs),
          8,
        ),
      },
      components: (Array.isArray(result.normalized.components)
        ? result.normalized.components
        : [])
        .slice(0, 8)
        .map(normalizeNormalizedComponent),
    },
  };
}
