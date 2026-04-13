import type { ContextPack } from "./context-builder.js";
import type { StoryMemory, WorldFact } from "./types.js";

export type ReviewerSeverity = "low" | "medium" | "high";

export interface MissingResourceReviewerInput {
  contextPack: ContextPack;
  draft: string;
  storyMemories: StoryMemory[];
}

export interface MissingResourceFinding {
  issueType: "missing_critical_resource";
  severity: ReviewerSeverity;
  memoryId: string;
  title: string;
  evidence: string;
  expectedHandling: string;
  suggestedFix: string;
}

export interface MissingResourceReviewerResult {
  findings: MissingResourceFinding[];
  notes: string[];
}

export interface FactConsistencyReviewerInput {
  contextPack: ContextPack;
  draft: string;
  storyMemories: StoryMemory[];
  worldFacts: WorldFact[];
}

export interface FactConsistencyFinding {
  issueType:
    | "injury_conflict"
    | "knowledge_boundary_conflict"
    | "world_rule_conflict"
    | "fact_conflict";
  severity: ReviewerSeverity;
  title: string;
  evidence: string;
  violatedFactIds: string[];
  suggestedFix: string;
}

export interface FactConsistencyReviewerResult {
  findings: FactConsistencyFinding[];
  notes: string[];
}
