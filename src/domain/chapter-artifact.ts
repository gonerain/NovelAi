import type { ContextPack } from "./context-builder.js";
import type { MemoryUpdaterResult } from "./memory-updater.js";
import type { ChapterPlan } from "./types.js";
import type {
  CommercialReviewerResult,
  FactConsistencyReviewerResult,
  MissingResourceReviewerResult,
  RoleDrivenReviewerResult,
} from "./reviewer.js";
import type { WriterResult } from "./writer.js";

export interface ChapterArtifact {
  chapterNumber: number;
  plan: ChapterPlan;
  contextPack: ContextPack;
  writerResult: WriterResult;
  missingResourceReview: MissingResourceReviewerResult;
  factConsistencyReview: FactConsistencyReviewerResult;
  commercialReview?: CommercialReviewerResult;
  roleDrivenReview?: RoleDrivenReviewerResult;
  memoryUpdate: MemoryUpdaterResult;
  generatedAt: string;
}
