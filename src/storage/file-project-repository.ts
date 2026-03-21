import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

  async saveChapterPlans(projectId: string, chapterPlans: ChapterPlan[]): Promise<void> {
    await this.writeProjectFile(projectId, "chapter-plans.json", chapterPlans);
  }

  async loadChapterPlans(projectId: string): Promise<ChapterPlan[]> {
    return (await this.readProjectFile<ChapterPlan[]>(projectId, "chapter-plans.json")) ?? [];
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

  private async writeJson(filepath: string, data: unknown): Promise<void> {
    await mkdir(path.dirname(filepath), { recursive: true });
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
