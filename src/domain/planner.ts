import type { TaskAuthorPack } from "./author-profile-packs.js";
import type {
  ArcOutline,
  BeatOutline,
  ChapterPlan,
  EntityId,
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
  activeCharacterIds: EntityId[];
  candidateMemoryIds: EntityId[];
  recentConsequences: string[];
}

export interface PlannerResult {
  chapterPlan: ChapterPlan;
  plannerNotes: string[];
}
