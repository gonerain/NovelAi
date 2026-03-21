export interface ProjectMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryProjectRecord {
  metadata: ProjectMetadata;
}
