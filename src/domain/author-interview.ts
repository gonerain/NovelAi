import type {
  AuthorComponentCategory,
  AuthorProfile,
  ConstraintRule,
  EntityId,
  Priority,
} from "./types.js";

export interface InterviewAnswer {
  questionId: string;
  answer: string;
}

export interface InterviewTargetProject {
  title?: string;
  premise?: string;
  themeHint?: string;
}

export interface AuthorInterviewSessionInput {
  userRawAnswers: InterviewAnswer[];
  priorProfile?: Partial<AuthorProfile>;
  targetProject?: InterviewTargetProject;
  smallModel?: boolean;
}

export interface AuthorInterviewQuestion {
  id: string;
  prompt: string;
  intent: string;
}

export interface InterviewConflict {
  description: string;
  priority: Priority;
}

export interface AuthorInterviewDisplayComponent {
  id: EntityId;
  name: string;
  category: AuthorComponentCategory;
  description: string;
  priority: number;
}

export interface AuthorInterviewNormalizedComponent {
  id: EntityId;
  name: string;
  category: AuthorComponentCategory;
  plannerEffects: string[];
  writerEffects: string[];
  reviewerChecks: string[];
  memoryHints: string[];
  priority: number;
}

export interface AuthorInterviewProfileDraft {
  summary: string;
  corePreferences: string[];
  favoriteCharacterTypes: string[];
  favoriteRelationshipPatterns: string[];
  plotBiases: string[];
  endingBiases: string[];
  aestheticMotifs: string[];
}

export interface AuthorInterviewDisplayResult {
  summary: string;
  authorProfile: AuthorInterviewProfileDraft;
  components: AuthorInterviewDisplayComponent[];
  constraints: ConstraintRule[];
  openQuestions: string[];
  conflictsDetected: InterviewConflict[];
}

export interface AuthorInterviewNormalizedResult {
  authorProfile: AuthorInterviewProfileDraft;
  components: AuthorInterviewNormalizedComponent[];
  constraints: ConstraintRule[];
}

export interface AuthorInterviewResult {
  display: AuthorInterviewDisplayResult;
  normalized: AuthorInterviewNormalizedResult;
}

export interface AuthorInterviewDisplayDraftResult {
  display: AuthorInterviewDisplayResult;
}

export interface AuthorInterviewNormalizedDraftResult {
  normalized: AuthorInterviewNormalizedResult;
}
