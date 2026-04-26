import type { ContextPack } from "./context-builder.js";
import type {
  RelationshipReviewerCandidate,
  ResourceReviewerCandidate,
} from "./memory-system.js";
import type { StoryMemory, WorldFact } from "./types.js";

export type ReviewerSeverity = "low" | "medium" | "high";

export interface MissingResourceReviewerInput {
  contextPack: ContextPack;
  draft: string;
  storyMemories: StoryMemory[];
  resourceCandidates?: ResourceReviewerCandidate[];
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
  relationshipCandidates?: RelationshipReviewerCandidate[];
}

export interface FactConsistencyFinding {
  issueType:
    | "injury_conflict"
    | "knowledge_boundary_conflict"
    | "world_rule_conflict"
    | "fact_conflict"
    | "role_consistency_conflict";
  severity: ReviewerSeverity;
  title: string;
  evidence: string;
  violatedFactIds: string[];
  suggestedFix: string;
}

export interface FactConsistencyReviewerResult {
  findings: FactConsistencyFinding[];
  scoring: {
    emotion: number;
    pacing: number;
  };
  notes: string[];
}

export interface CommercialReviewerInput {
  contextPack: ContextPack;
  draft: string;
}

export interface CommercialReviewerFinding {
  issueType:
    | "hook_delay"
    | "problem_blur"
    | "payoff_weak"
    | "hook_weak"
    | "scanability_weak";
  severity: ReviewerSeverity;
  title: string;
  evidence: string;
  suggestedFix: string;
}

export interface CommercialReviewerResult {
  findings: CommercialReviewerFinding[];
  scoring: {
    hookClarity: number;
    payoffDelivery: number;
    scanability: number;
  };
  notes: string[];
}
