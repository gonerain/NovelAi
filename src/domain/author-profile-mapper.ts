import type { AuthorInterviewResult } from "./author-interview.js";
import type {
  AuthorComponent,
  AuthorComponentEffect,
  AuthorEffectTarget,
  AuthorProfile,
  EntityId,
} from "./types.js";

export interface MapAuthorProfileOptions {
  profileId?: EntityId;
  profileName?: string;
}

function buildEffects(component: {
  plannerEffects: string[];
  writerEffects: string[];
  reviewerChecks: string[];
  memoryHints: string[];
}): AuthorComponentEffect[] {
  const effects: Array<{
    target: AuthorEffectTarget;
    apply: string[];
    avoid: string[];
  }> = [
    {
      target: "planner",
      apply: component.plannerEffects,
      avoid: [],
    },
    {
      target: "writer",
      apply: component.writerEffects,
      avoid: [],
    },
    {
      target: "reviewer",
      apply: component.reviewerChecks,
      avoid: [],
    },
    {
      target: "memory",
      apply: component.memoryHints,
      avoid: [],
    },
  ];

  return effects.filter((effect) => effect.apply.length > 0);
}

function mapComponent(component: AuthorInterviewResult["normalized"]["components"][number]): AuthorComponent {
  return {
    id: component.id,
    name: component.name,
    category: component.category,
    description: `${component.name} component`,
    strengthens: component.strengthens,
    suppresses: component.suppresses,
    effects: buildEffects(component),
    validationHints: component.reviewerChecks,
    priority: component.priority,
    enabled: true,
  };
}

export function mapAuthorInterviewToProfile(
  result: AuthorInterviewResult,
  options: MapAuthorProfileOptions = {},
): AuthorProfile {
  const normalized = result.normalized;
  const components = normalized.components.map(mapComponent);

  return {
    id: options.profileId ?? "author-profile-default",
    name: options.profileName ?? "Default Author Profile",
    summary: normalized.authorProfile.summary,
    corePreferences: normalized.authorProfile.corePreferences,
    aestheticMotifs: normalized.authorProfile.aestheticMotifs,
    favoriteCharacterTypes: normalized.authorProfile.favoriteCharacterTypes,
    favoriteRelationshipPatterns:
      normalized.authorProfile.favoriteRelationshipPatterns,
    plotBiases: normalized.authorProfile.plotBiases,
    endingBiases: normalized.authorProfile.endingBiases,
    components,
    constraints: normalized.constraints,
  };
}
