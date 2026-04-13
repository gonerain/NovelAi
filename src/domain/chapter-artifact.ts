import type { ContextPack } from "./context-builder.js";
import type { MemoryUpdaterResult } from "./memory-updater.js";
import type { ChapterPlan } from "./types.js";
import type {
  FactConsistencyReviewerResult,
  MissingResourceReviewerResult,
} from "./reviewer.js";
import type { WriterResult } from "./writer.js";

export interface ChapterArtifact {
  chapterNumber: number;
  plan: ChapterPlan;
  contextPack: ContextPack;
  writerResult: WriterResult;
  missingResourceReview: MissingResourceReviewerResult;
  factConsistencyReview: FactConsistencyReviewerResult;
  memoryUpdate: MemoryUpdaterResult;
  generatedAt: string;
}
