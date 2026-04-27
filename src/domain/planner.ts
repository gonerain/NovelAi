import type { TaskAuthorPack } from "./author-profile-packs.js";
import type {
  ArcOutline,
  BeatOutline,
  ChapterPlan,
  CharacterState,
  EntityId,
  GenrePayoffPack,
  StoryOutline,
  StyleBible,
  ThemeBible,
} from "./types.js";

export interface PlannerInput {
  authorPack: TaskAuthorPack;
  themeBible: ThemeBible;
  styleBible: StyleBible;
  storyOutline?: StoryOutline;
  arcOutline?: ArcOutline;
  beatOutline?: BeatOutline;
  mode?: "opening" | "continuation";
  arcId?: EntityId;
  chapterNumber?: number;
  premise: string;
  currentArcGoal: string;
  currentSituation: string;
  genrePayoffPack?: GenrePayoffPack;
  activeCharacterIds: EntityId[];
  activeCharacters?: CharacterState[];
  candidateMemoryIds: EntityId[];
  recentConsequences: string[];
  unresolvedDelayedConsequences?: string[];
  recentCommercialHistory?: string[];
}

export interface PlannerResult {
  chapterPlan: ChapterPlan;
  plannerNotes: string[];
}
