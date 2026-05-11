import type { TaskAuthorPack } from "./author-profile-packs.js";
import type {
  ArcOutline,
  ArcShift,
  BeatOutline,
  ChapterPlan,
  ChapterScenePlan,
  CharacterState,
  EpisodePacket,
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
  episodePacket?: EpisodePacket;
  /**
   * Optional per-chapter scene plan. When present, the planner must
   * align chapterGoal/plannedOutcome/mustHitConflicts with the
   * scene plan's pov, climax, and end hook.
   */
  scenePlan?: ChapterScenePlan;
  /**
   * Arc shifts whose expectedChapterRange includes the current chapter.
   * Pre-filtered at call site so the planner doesn't need to infer which
   * shifts are relevant. When present, rendered as a dedicated section
   * above the full arc shift list.
   */
  activeShifts?: ArcShift[];
  /**
   * Exact endHook text from the previous chapter's scene plan.
   * Injected at call site so the planner can copy it verbatim into
   * readerContract.priorEndHook without having to recall or infer it.
   */
  priorChapterEndHook?: string;
}

export interface PlannerResult {
  chapterPlan: ChapterPlan;
  plannerNotes: string[];
}
