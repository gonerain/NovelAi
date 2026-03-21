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
  hardConstraints: string[];
  softPreferences: string[];
  activeComponents: AuthorPackComponent[];
  promptCapsule: string[];
}

export interface DerivedAuthorProfilePacks {
  compact: CompactAuthorProfile;
  planner: TaskAuthorPack;
  writer: TaskAuthorPack;
  reviewer: TaskAuthorPack;
}

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

function componentApply(profile: AuthorProfile, limit = 4): AuthorPackComponent[] {
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

function buildPromptCapsule(task: AuthorPackTask, pack: TaskAuthorPack): string[] {
  const label =
    task === "planner" ? "规划规则" : task === "writer" ? "写作规则" : "审校规则";

  return [
    `${label}：${pack.summary}`,
    ...pack.hardConstraints.map((item) => `硬约束：${item}`),
    ...pack.softPreferences.map((item) => `软偏好：${item}`),
  ].slice(0, 8);
}

function buildTaskPack(task: AuthorPackTask, profile: AuthorProfile): TaskAuthorPack {
  const activeComponents = componentApply(profile, 3).map((component) => ({
    ...component,
    planner: task === "planner" ? component.planner : undefined,
    writer: task === "writer" ? component.writer : undefined,
    reviewer: task === "reviewer" ? component.reviewer : undefined,
  }));

  const hardConstraints = uniqueTrimmed(
    topConstraints(profile, 3).map((constraint) => constraint.description),
    3,
  );

  const softPreferences =
    task === "planner"
      ? uniqueTrimmed(
          [...profile.corePreferences, ...profile.plotBiases, ...profile.endingBiases],
          5,
        )
      : task === "writer"
        ? uniqueTrimmed(
            [
              ...profile.favoriteCharacterTypes,
              ...profile.favoriteRelationshipPatterns,
              ...profile.aestheticMotifs,
            ],
            5,
          )
        : uniqueTrimmed(
            [...profile.constraints.map((constraint) => constraint.name), ...profile.endingBiases],
            5,
          );

  const pack: TaskAuthorPack = {
    task,
    profileId: profile.id,
    summary: profile.summary,
    hardConstraints,
    softPreferences,
    activeComponents,
    promptCapsule: [],
  };

  return {
    ...pack,
    promptCapsule: buildPromptCapsule(task, pack),
  };
}

export function buildDerivedAuthorProfilePacks(
  profile: AuthorProfile,
): DerivedAuthorProfilePacks {
  return {
    compact: {
      profileId: profile.id,
      summary: profile.summary,
      corePreferences: uniqueTrimmed(profile.corePreferences, 3),
      favoriteCharacterTypes: uniqueTrimmed(profile.favoriteCharacterTypes, 3),
      favoriteRelationshipPatterns: uniqueTrimmed(
        profile.favoriteRelationshipPatterns,
        3,
      ),
      plotBiases: uniqueTrimmed(profile.plotBiases, 3),
      endingBiases: uniqueTrimmed(profile.endingBiases, 3),
      aestheticMotifs: uniqueTrimmed(profile.aestheticMotifs, 3),
      topConstraints: topConstraints(profile, 3),
      activeComponents: componentApply(profile),
    },
    planner: buildTaskPack("planner", profile),
    writer: buildTaskPack("writer", profile),
    reviewer: buildTaskPack("reviewer", profile),
  };
}
