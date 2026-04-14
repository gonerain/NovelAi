import type {
  AuthorComponentCategory,
  AuthorProfile,
  ConstraintRule,
  EntityId,
} from "./types.js";

export type AuthorPackTask = "planner" | "writer" | "reviewer";

export interface AuthorPackComponent {
  id: EntityId;
  name: string;
  category: AuthorComponentCategory;
  planner?: string[];
  writer?: string[];
  reviewer?: string[];
}

export interface CompactAuthorProfile {
  profileId: EntityId;
  summary: string;
  corePreferences: string[];
  favoriteCharacterTypes: string[];
  favoriteRelationshipPatterns: string[];
  plotBiases: string[];
  endingBiases: string[];
  aestheticMotifs: string[];
  topConstraints: ConstraintRule[];
  activeComponents: AuthorPackComponent[];
}

export interface TaskAuthorPack {
  task: AuthorPackTask;
  profileId: EntityId;
  summary: string;
  globalPreferences: string[];
  taskSpecificPreferences: string[];
  mustRules: string[];
  taskRules: string[];
  reviewChecks: string[];
  activeComponents: AuthorPackComponent[];
}

export interface DerivedAuthorProfilePacks {
  compact: CompactAuthorProfile;
  planner: TaskAuthorPack;
  writer: TaskAuthorPack;
  reviewer: TaskAuthorPack;
}

const ACTIVE_COMPONENT_LIMIT = 6;

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

function topConstraints(profile: AuthorProfile, limit: number): ConstraintRule[] {
  const weight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  } as const;

  return [...profile.constraints]
    .sort((left, right) => weight[right.severity] - weight[left.severity])
    .slice(0, limit);
}

function componentApply(profile: AuthorProfile, limit = ACTIVE_COMPONENT_LIMIT): AuthorPackComponent[] {
  return profile.components
    .filter((component) => component.enabled)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, limit)
    .map((component) => ({
      id: component.id,
      name: component.name,
      category: component.category,
      planner:
        component.effects.find((effect) => effect.target === "planner")?.apply.slice(0, 2) ?? [],
      writer:
        component.effects.find((effect) => effect.target === "writer")?.apply.slice(0, 2) ?? [],
      reviewer:
        component.effects.find((effect) => effect.target === "reviewer")?.apply.slice(0, 2) ?? [],
    }));
}

function asExecutableReviewCheck(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }
  if (/^check whether\b/i.test(normalized)) {
    return normalized;
  }
  if (/reconcil|repair|forgiv|trust/i.test(normalized)) {
    return "Check whether reconciliation is earned through prior fracture, visible cost, and changed behavior.";
  }
  if (/side character|supporting|配角/i.test(normalized)) {
    return "Check whether side characters have independent motive, pressure, and consequence.";
  }
  if (/ending|closure|payoff/i.test(normalized)) {
    return `Check whether the chapter progression supports ending pressure: ${normalized}`;
  }
  return `Check whether this requirement is concretely evidenced in scene-level behavior: ${normalized}`;
}

function componentTaskRules(task: AuthorPackTask, components: AuthorPackComponent[]): string[] {
  return uniqueTrimmed(
    components.flatMap((component) =>
      task === "planner"
        ? component.planner ?? []
        : task === "writer"
          ? component.writer ?? []
          : component.reviewer ?? [],
    ),
    10,
  );
}

function buildTaskPack(task: AuthorPackTask, profile: AuthorProfile): TaskAuthorPack {
  const activeComponents = componentApply(profile, ACTIVE_COMPONENT_LIMIT).map((component) => ({
    ...component,
    planner: task === "planner" ? component.planner : undefined,
    writer: task === "writer" ? component.writer : undefined,
    reviewer: task === "reviewer" ? component.reviewer : undefined,
  }));

  const mustRules = uniqueTrimmed(
    topConstraints(profile, 5).map((constraint) => constraint.description),
    8,
  );
  const globalPreferences = uniqueTrimmed(
    [...profile.corePreferences, ...profile.endingBiases],
    10,
  );

  const taskSpecificPreferences =
    task === "planner"
      ? uniqueTrimmed(
          [...profile.plotBiases, ...profile.favoriteRelationshipPatterns],
          8,
        )
      : task === "writer"
        ? uniqueTrimmed(
            [
              ...profile.favoriteCharacterTypes,
              ...profile.favoriteRelationshipPatterns,
              ...profile.aestheticMotifs,
              ...profile.plotBiases,
            ],
            10,
          )
        : uniqueTrimmed(
            [
              ...profile.constraints.map((constraint) => constraint.description),
              ...profile.endingBiases.map((bias) => `Check ending alignment: ${bias}`),
            ],
            10,
          );

  const taskRules = componentTaskRules(task, activeComponents);
  const reviewChecks =
    task === "reviewer"
      ? uniqueTrimmed(
          [
            ...taskRules.map(asExecutableReviewCheck),
            ...profile.constraints.map((constraint) => asExecutableReviewCheck(constraint.description)),
            ...profile.endingBiases.map((bias) => asExecutableReviewCheck(`ending tendency: ${bias}`)),
          ],
          12,
        )
      : [];

  return {
    task,
    profileId: profile.id,
    summary: profile.summary,
    globalPreferences,
    taskSpecificPreferences,
    mustRules,
    taskRules,
    reviewChecks,
    activeComponents,
  };
}

export function buildDerivedAuthorProfilePacks(
  profile: AuthorProfile,
): DerivedAuthorProfilePacks {
  return {
    compact: {
      profileId: profile.id,
      summary: profile.summary,
      corePreferences: uniqueTrimmed(profile.corePreferences, 8),
      favoriteCharacterTypes: uniqueTrimmed(profile.favoriteCharacterTypes, 8),
      favoriteRelationshipPatterns: uniqueTrimmed(profile.favoriteRelationshipPatterns, 8),
      plotBiases: uniqueTrimmed(profile.plotBiases, 8),
      endingBiases: uniqueTrimmed(profile.endingBiases, 8),
      aestheticMotifs: uniqueTrimmed(profile.aestheticMotifs, 8),
      topConstraints: topConstraints(profile, 5),
      activeComponents: componentApply(profile, ACTIVE_COMPONENT_LIMIT),
    },
    planner: buildTaskPack("planner", profile),
    writer: buildTaskPack("writer", profile),
    reviewer: buildTaskPack("reviewer", profile),
  };
}
