import type {
  ArcOutline,
  BeatOutline,
  CastCharacterOutline,
  StoryOutline,
  StorySetup,
  StyleBible,
  ThemeBible,
} from "./types.js";
import type { CompactAuthorProfile } from "./author-profile-packs.js";

export interface StoryOutlineGenerationInput {
  projectTitle: string;
  authorProfile: CompactAuthorProfile;
  themeBible: ThemeBible;
  styleBible: StyleBible;
  storySetup: StorySetup;
  targetChapterCount: number;
  targetArcCount: number;
}

export interface StoryOutlineGenerationResult {
  storyOutline: StoryOutline;
  arcBlueprints: Array<{
    id: string;
    name: string;
    functionInStory: string;
    chapterRangeHint: {
      start: number;
      end: number;
    };
  }>;
  notes: string[];
}

export interface CastExpansionInput {
  projectTitle: string;
  authorProfile: CompactAuthorProfile;
  storyOutline: StoryOutline;
  arcBlueprints: Array<{
    id: string;
    name: string;
    functionInStory: string;
    chapterRangeHint: {
      start: number;
      end: number;
    };
  }>;
  existingCoreCharacters: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  desiredLongTermCastSize: number;
}

export interface CastExpansionResult {
  cast: CastCharacterOutline[];
  notes: string[];
}

export interface ArcOutlineGenerationInput {
  projectTitle: string;
  storyOutline: StoryOutline;
  arcBlueprints: Array<{
    id: string;
    name: string;
    functionInStory: string;
    chapterRangeHint: {
      start: number;
      end: number;
    };
  }>;
  cast: CastCharacterOutline[];
  targetArcCount: number;
  targetChapterCount: number;
}

export interface ArcOutlineGenerationResult {
  arcOutlines: ArcOutline[];
  notes: string[];
}

export interface BeatOutlineGenerationInput {
  projectTitle: string;
  storyOutline: StoryOutline;
  arcOutlines: ArcOutline[];
  targetChapterCount: number;
  /**
   * All arc outlines in story order. Used together with worldFacts to derive
   * which fact labels are forbidden in each arc's beats (minRevealArc guard).
   * When omitted, no vocabulary restriction is applied.
   */
  allArcOutlines?: ArcOutline[];
  /** World facts carrying minRevealArc constraints. Optional. */
  worldFacts?: import("./types.js").WorldFact[];
}

export interface BeatOutlineGenerationResult {
  beatOutlines: BeatOutline[];
  notes: string[];
}
