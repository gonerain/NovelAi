import type { TaskAuthorPack } from "./author-profile-packs.js";
import type {
  ChapterPlan,
  EntityId,
  StoryMemory,
  StyleBible,
  ThemeBible,
} from "./types.js";

export interface PlannerInput {
  authorPack: TaskAuthorPack;
  themeBible: ThemeBible;
  styleBible: StyleBible;
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
