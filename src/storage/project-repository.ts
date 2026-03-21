import type {
  AuthorProfile,
  ChapterPlan,
  CharacterState,
  DerivedAuthorProfilePacks,
  StoryMemory,
  StyleBible,
  ThemeBible,
  WorldFact,
} from "../domain/index.js";
import type { ProjectMetadata } from "./types.js";

export interface ProjectRepository {
  createProject(input: { id: string; title: string }): Promise<ProjectMetadata>;
  getProject(projectId: string): Promise<ProjectMetadata | null>;

  saveAuthorProfile(projectId: string, profile: AuthorProfile): Promise<void>;
  loadAuthorProfile(projectId: string): Promise<AuthorProfile | null>;
  saveDerivedAuthorProfilePacks(projectId: string, packs: DerivedAuthorProfilePacks): Promise<void>;
  loadDerivedAuthorProfilePacks(projectId: string): Promise<DerivedAuthorProfilePacks | null>;

  saveThemeBible(projectId: string, themeBible: ThemeBible): Promise<void>;
  loadThemeBible(projectId: string): Promise<ThemeBible | null>;

  saveStyleBible(projectId: string, styleBible: StyleBible): Promise<void>;
  loadStyleBible(projectId: string): Promise<StyleBible | null>;

  saveCharacterStates(projectId: string, characterStates: CharacterState[]): Promise<void>;
  loadCharacterStates(projectId: string): Promise<CharacterState[]>;

  saveWorldFacts(projectId: string, worldFacts: WorldFact[]): Promise<void>;
  loadWorldFacts(projectId: string): Promise<WorldFact[]>;

  saveStoryMemories(projectId: string, memories: StoryMemory[]): Promise<void>;
  loadStoryMemories(projectId: string): Promise<StoryMemory[]>;

  saveChapterPlans(projectId: string, chapterPlans: ChapterPlan[]): Promise<void>;
  loadChapterPlans(projectId: string): Promise<ChapterPlan[]>;
}
