import type { StoryProject } from "../domain/index.js";
import type { ProjectRepository } from "../storage/index.js";

export async function loadStoryProject(
  repository: ProjectRepository,
  projectId: string,
): Promise<StoryProject | null> {
  return repository.loadStoryProject(projectId);
}
