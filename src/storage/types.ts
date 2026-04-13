export interface ProjectMetadata {
  id: string;
  title: string;
  description?: string;
  status?: "draft" | "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryProjectRecord {
  metadata: ProjectMetadata;
}
