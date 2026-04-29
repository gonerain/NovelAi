import type {
  ArcOutline,
  AuthorProfile,
  BeatOutline,
  CastCharacterOutline,
  ChapterArtifact,
  ChapterPlan,
  CharacterState,
  DerivedAuthorProfilePacks,
  StoryOutline,
  StoryProject,
  StorySetup,
  StoryContract,
  StoryMemory,
  StyleBible,
  TaskBrief,
  TaskDecomposition,
  ThemeBible,
  NarrativeThread,
  OffscreenMove,
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

  saveStorySetup(projectId: string, storySetup: StorySetup): Promise<void>;
  loadStorySetup(projectId: string): Promise<StorySetup | null>;

  saveStoryOutline(projectId: string, storyOutline: StoryOutline): Promise<void>;
  loadStoryOutline(projectId: string): Promise<StoryOutline | null>;

  saveArcOutlines(projectId: string, arcOutlines: ArcOutline[]): Promise<void>;
  loadArcOutlines(projectId: string): Promise<ArcOutline[]>;

  saveBeatOutlines(projectId: string, beatOutlines: BeatOutline[]): Promise<void>;
  loadBeatOutlines(projectId: string): Promise<BeatOutline[]>;

  saveCastOutlines(projectId: string, castOutlines: CastCharacterOutline[]): Promise<void>;
  loadCastOutlines(projectId: string): Promise<CastCharacterOutline[]>;

  saveCharacterStates(projectId: string, characterStates: CharacterState[]): Promise<void>;
  loadCharacterStates(projectId: string): Promise<CharacterState[]>;

  saveWorldFacts(projectId: string, worldFacts: WorldFact[]): Promise<void>;
  loadWorldFacts(projectId: string): Promise<WorldFact[]>;

  saveStoryMemories(projectId: string, memories: StoryMemory[]): Promise<void>;
  loadStoryMemories(projectId: string): Promise<StoryMemory[]>;
  saveSeedStoryMemories(projectId: string, memories: StoryMemory[]): Promise<void>;
  loadSeedStoryMemories(projectId: string): Promise<StoryMemory[]>;

  saveStoryContracts(projectId: string, contracts: StoryContract[]): Promise<void>;
  loadStoryContracts(projectId: string): Promise<StoryContract[]>;

  saveNarrativeThreads(projectId: string, threads: NarrativeThread[]): Promise<void>;
  loadNarrativeThreads(projectId: string): Promise<NarrativeThread[]>;

  saveOffscreenMoves(projectId: string, moves: OffscreenMove[]): Promise<void>;
  loadOffscreenMoves(projectId: string): Promise<OffscreenMove[]>;

  saveTaskBrief(projectId: string, brief: TaskBrief): Promise<void>;
  loadTaskBrief(projectId: string, taskId: string): Promise<TaskBrief | null>;
  loadAllTaskBriefs(projectId: string): Promise<TaskBrief[]>;
  saveTaskDecomposition(projectId: string, decomposition: TaskDecomposition): Promise<void>;
  loadTaskDecomposition(projectId: string, taskId: string): Promise<TaskDecomposition | null>;

  saveChapterPlans(projectId: string, chapterPlans: ChapterPlan[]): Promise<void>;
  loadChapterPlans(projectId: string): Promise<ChapterPlan[]>;

  saveChapterArtifact(projectId: string, artifact: ChapterArtifact): Promise<void>;
  loadChapterArtifact(projectId: string, chapterNumber: number): Promise<ChapterArtifact | null>;
  listChapterArtifactNumbers(projectId: string): Promise<number[]>;
  deleteChapterArtifact(projectId: string, chapterNumber: number): Promise<void>;

  loadStoryProject(projectId: string): Promise<StoryProject | null>;
}
