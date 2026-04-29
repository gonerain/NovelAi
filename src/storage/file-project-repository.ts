import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
import type { ProjectRepository } from "./project-repository.js";
import type { ProjectMetadata } from "./types.js";

interface FileProjectRepositoryOptions {
  baseDir?: string;
}

export class FileProjectRepository implements ProjectRepository {
  private readonly baseDir: string;

  constructor(options: FileProjectRepositoryOptions = {}) {
    this.baseDir = options.baseDir ?? path.resolve(process.cwd(), "data", "projects");
  }

  async createProject(input: { id: string; title: string }): Promise<ProjectMetadata> {
    const now = new Date().toISOString();
    const metadata: ProjectMetadata = {
      id: input.id,
      title: input.title,
      createdAt: now,
      updatedAt: now,
    };

    await this.ensureProjectDirs(input.id);
    await this.writeJson(this.metadataPath(input.id), metadata);
    return metadata;
  }

  async getProject(projectId: string): Promise<ProjectMetadata | null> {
    return this.readJsonOrNull<ProjectMetadata>(this.metadataPath(projectId));
  }

  async saveAuthorProfile(projectId: string, profile: AuthorProfile): Promise<void> {
    await this.writeProjectFile(projectId, "author-profile.json", profile);
  }

  async loadAuthorProfile(projectId: string): Promise<AuthorProfile | null> {
    return this.readProjectFile(projectId, "author-profile.json");
  }

  async saveDerivedAuthorProfilePacks(
    projectId: string,
    packs: DerivedAuthorProfilePacks,
  ): Promise<void> {
    await this.writeProjectFile(projectId, path.join("derived", "author-profile-packs.json"), packs);
  }

  async loadDerivedAuthorProfilePacks(
    projectId: string,
  ): Promise<DerivedAuthorProfilePacks | null> {
    return this.readProjectFile(projectId, path.join("derived", "author-profile-packs.json"));
  }

  async saveThemeBible(projectId: string, themeBible: ThemeBible): Promise<void> {
    await this.writeProjectFile(projectId, "theme-bible.json", themeBible);
  }

  async loadThemeBible(projectId: string): Promise<ThemeBible | null> {
    return this.readProjectFile(projectId, "theme-bible.json");
  }

  async saveStyleBible(projectId: string, styleBible: StyleBible): Promise<void> {
    await this.writeProjectFile(projectId, "style-bible.json", styleBible);
  }

  async loadStyleBible(projectId: string): Promise<StyleBible | null> {
    return this.readProjectFile(projectId, "style-bible.json");
  }

  async saveStorySetup(projectId: string, storySetup: StorySetup): Promise<void> {
    await this.writeProjectFile(projectId, "story-setup.json", storySetup);
  }

  async loadStorySetup(projectId: string): Promise<StorySetup | null> {
    return this.readProjectFile(projectId, "story-setup.json");
  }

  async saveStoryOutline(projectId: string, storyOutline: StoryOutline): Promise<void> {
    await this.writeProjectFile(projectId, "story-outline.json", storyOutline);
  }

  async loadStoryOutline(projectId: string): Promise<StoryOutline | null> {
    return this.readProjectFile(projectId, "story-outline.json");
  }

  async saveArcOutlines(projectId: string, arcOutlines: ArcOutline[]): Promise<void> {
    await this.writeProjectFile(projectId, "arc-outlines.json", arcOutlines);
  }

  async loadArcOutlines(projectId: string): Promise<ArcOutline[]> {
    return (await this.readProjectFile<ArcOutline[]>(projectId, "arc-outlines.json")) ?? [];
  }

  async saveBeatOutlines(projectId: string, beatOutlines: BeatOutline[]): Promise<void> {
    await this.writeProjectFile(projectId, "beat-outlines.json", beatOutlines);
  }

  async loadBeatOutlines(projectId: string): Promise<BeatOutline[]> {
    return (await this.readProjectFile<BeatOutline[]>(projectId, "beat-outlines.json")) ?? [];
  }

  async saveCastOutlines(projectId: string, castOutlines: CastCharacterOutline[]): Promise<void> {
    await this.writeProjectFile(projectId, "cast-outlines.json", castOutlines);
  }

  async loadCastOutlines(projectId: string): Promise<CastCharacterOutline[]> {
    return (await this.readProjectFile<CastCharacterOutline[]>(projectId, "cast-outlines.json")) ?? [];
  }

  async saveCharacterStates(projectId: string, characterStates: CharacterState[]): Promise<void> {
    await this.writeProjectFile(projectId, "character-states.json", characterStates);
  }

  async loadCharacterStates(projectId: string): Promise<CharacterState[]> {
    return (await this.readProjectFile<CharacterState[]>(projectId, "character-states.json")) ?? [];
  }

  async saveWorldFacts(projectId: string, worldFacts: WorldFact[]): Promise<void> {
    await this.writeProjectFile(projectId, "world-facts.json", worldFacts);
  }

  async loadWorldFacts(projectId: string): Promise<WorldFact[]> {
    return (await this.readProjectFile<WorldFact[]>(projectId, "world-facts.json")) ?? [];
  }

  async saveStoryMemories(projectId: string, memories: StoryMemory[]): Promise<void> {
    await this.writeProjectFile(projectId, "story-memories.json", memories);
  }

  async loadStoryMemories(projectId: string): Promise<StoryMemory[]> {
    return (await this.readProjectFile<StoryMemory[]>(projectId, "story-memories.json")) ?? [];
  }

  async saveSeedStoryMemories(projectId: string, memories: StoryMemory[]): Promise<void> {
    await this.writeProjectFile(projectId, "seed-story-memories.json", memories);
  }

  async loadSeedStoryMemories(projectId: string): Promise<StoryMemory[]> {
    return (
      (await this.readProjectFile<StoryMemory[]>(projectId, "seed-story-memories.json")) ?? []
    );
  }

  async saveStoryContracts(projectId: string, contracts: StoryContract[]): Promise<void> {
    await this.writeProjectFile(projectId, "story-contracts.json", contracts);
  }

  async loadStoryContracts(projectId: string): Promise<StoryContract[]> {
    return (await this.readProjectFile<StoryContract[]>(projectId, "story-contracts.json")) ?? [];
  }

  async saveNarrativeThreads(projectId: string, threads: NarrativeThread[]): Promise<void> {
    await this.writeProjectFile(projectId, "narrative-threads.json", threads);
  }

  async loadNarrativeThreads(projectId: string): Promise<NarrativeThread[]> {
    return (await this.readProjectFile<NarrativeThread[]>(projectId, "narrative-threads.json")) ?? [];
  }

  async saveOffscreenMoves(projectId: string, moves: OffscreenMove[]): Promise<void> {
    await this.writeProjectFile(projectId, "offscreen-moves.json", moves);
  }

  async loadOffscreenMoves(projectId: string): Promise<OffscreenMove[]> {
    return (await this.readProjectFile<OffscreenMove[]>(projectId, "offscreen-moves.json")) ?? [];
  }

  async saveTaskBrief(projectId: string, brief: TaskBrief): Promise<void> {
    await this.writeProjectFile(projectId, path.join("tasks", `${brief.id}.json`), brief);
  }

  async loadTaskBrief(projectId: string, taskId: string): Promise<TaskBrief | null> {
    return this.readProjectFile<TaskBrief>(projectId, path.join("tasks", `${taskId}.json`));
  }

  async loadAllTaskBriefs(projectId: string): Promise<TaskBrief[]> {
    const dir = path.join(this.projectDir(projectId), "tasks");
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
    const briefs: TaskBrief[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      if (entry.name.endsWith(".decomposition.json")) {
        continue;
      }
      const taskId = entry.name.replace(/\.json$/, "");
      const brief = await this.loadTaskBrief(projectId, taskId);
      if (brief) {
        briefs.push(brief);
      }
    }
    briefs.sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
    return briefs;
  }

  async saveTaskDecomposition(
    projectId: string,
    decomposition: TaskDecomposition,
  ): Promise<void> {
    await this.writeProjectFile(
      projectId,
      path.join("tasks", `${decomposition.taskId}.decomposition.json`),
      decomposition,
    );
  }

  async loadTaskDecomposition(
    projectId: string,
    taskId: string,
  ): Promise<TaskDecomposition | null> {
    return this.readProjectFile<TaskDecomposition>(
      projectId,
      path.join("tasks", `${taskId}.decomposition.json`),
    );
  }

  async saveChapterPlans(projectId: string, chapterPlans: ChapterPlan[]): Promise<void> {
    await this.writeProjectFile(projectId, "chapter-plans.json", chapterPlans);
  }

  async loadChapterPlans(projectId: string): Promise<ChapterPlan[]> {
    return (await this.readProjectFile<ChapterPlan[]>(projectId, "chapter-plans.json")) ?? [];
  }

  async saveChapterArtifact(projectId: string, artifact: ChapterArtifact): Promise<void> {
    const chapterDir = path.join("chapters", this.chapterFolderName(artifact.chapterNumber));
    await this.writeProjectFile(projectId, path.join(chapterDir, "result.json"), artifact);
    await this.writeProjectFile(
      projectId,
      path.join(chapterDir, "draft.md"),
      artifact.writerResult.draft,
    );
  }

  async loadChapterArtifact(projectId: string, chapterNumber: number): Promise<ChapterArtifact | null> {
    return this.readProjectFile<ChapterArtifact>(
      projectId,
      path.join("chapters", this.chapterFolderName(chapterNumber), "result.json"),
    );
  }

  async listChapterArtifactNumbers(projectId: string): Promise<number[]> {
    const chaptersDir = path.join(this.projectDir(projectId), "chapters");

    try {
      const entries = await readdir(chaptersDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const match = /^chapter-(\d+)$/.exec(entry.name);
          return match ? Number(match[1]) : null;
        })
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right);
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }

      throw error;
    }
  }

  async deleteChapterArtifact(projectId: string, chapterNumber: number): Promise<void> {
    const target = this.projectFilePath(
      projectId,
      path.join("chapters", this.chapterFolderName(chapterNumber)),
    );

    try {
      await rm(target, { recursive: true, force: true });
      await this.touchMetadata(projectId);
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }

      throw error;
    }
  }

  async loadStoryProject(projectId: string): Promise<StoryProject | null> {
    const metadata = await this.getProject(projectId);
    if (!metadata) {
      return null;
    }

    const [
      authorProfile,
      themeBible,
      styleBible,
      storySetup,
      storyOutline,
      arcOutlines,
      beatOutlines,
      castOutlines,
      characters,
      worldFacts,
      memories,
      storyContracts,
      narrativeThreads,
      chapterPlans,
    ] = await Promise.all([
      this.loadAuthorProfile(projectId),
      this.loadThemeBible(projectId),
      this.loadStyleBible(projectId),
      this.loadStorySetup(projectId),
      this.loadStoryOutline(projectId),
      this.loadArcOutlines(projectId),
      this.loadBeatOutlines(projectId),
      this.loadCastOutlines(projectId),
      this.loadCharacterStates(projectId),
      this.loadWorldFacts(projectId),
      this.loadStoryMemories(projectId),
      this.loadStoryContracts(projectId),
      this.loadNarrativeThreads(projectId),
      this.loadChapterPlans(projectId),
    ]);

    if (!authorProfile || !themeBible || !styleBible || !storySetup) {
      return null;
    }

    return {
      id: metadata.id,
      title: metadata.title,
      premise: storySetup.premise,
      description: undefined,
      status: "active",
      authorProfile,
      themeBible,
      styleBible,
      storySetup,
      storyOutline: storyOutline ?? undefined,
      arcOutlines,
      beatOutlines,
      castOutlines,
      characters,
      worldFacts,
      memories,
      storyContracts,
      narrativeThreads,
      chapterPlans,
    };
  }

  private async writeProjectFile<T>(projectId: string, filename: string, data: T): Promise<void> {
    await this.ensureProjectDirs(projectId);
    await this.writeJson(this.projectFilePath(projectId, filename), data);
    await this.touchMetadata(projectId);
  }

  private async readProjectFile<T>(projectId: string, filename: string): Promise<T | null> {
    return this.readJsonOrNull<T>(this.projectFilePath(projectId, filename));
  }

  private async ensureProjectDirs(projectId: string): Promise<void> {
    await mkdir(this.projectDir(projectId), { recursive: true });
    await mkdir(path.join(this.projectDir(projectId), "chapters"), { recursive: true });
  }

  private async touchMetadata(projectId: string): Promise<void> {
    const metadata = await this.getProject(projectId);
    if (!metadata) {
      return;
    }

    await this.writeJson(this.metadataPath(projectId), {
      ...metadata,
      updatedAt: new Date().toISOString(),
    });
  }

  private projectDir(projectId: string): string {
    return path.join(this.baseDir, projectId);
  }

  private metadataPath(projectId: string): string {
    return this.projectFilePath(projectId, "project.json");
  }

  private projectFilePath(projectId: string, filename: string): string {
    return path.join(this.projectDir(projectId), filename);
  }

  private chapterFolderName(chapterNumber: number): string {
    return `chapter-${String(chapterNumber).padStart(3, "0")}`;
  }

  private async writeJson(filepath: string, data: unknown): Promise<void> {
    await mkdir(path.dirname(filepath), { recursive: true });
    if (typeof data === "string") {
      await writeFile(filepath, data.endsWith("\n") ? data : `${data}\n`, "utf8");
      return;
    }

    await writeFile(filepath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  private async readJsonOrNull<T>(filepath: string): Promise<T | null> {
    try {
      const content = await readFile(filepath, "utf8");
      return JSON.parse(content) as T;
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
