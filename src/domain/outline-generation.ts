import type {
  ArcOutline,
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
