import { readFile } from "node:fs/promises";

import { LlmService } from "./llm/service.js";
import type { ChatMessage, TaskName } from "./llm/types.js";
import {
  arcOutlineGenerationResultSchema,
  arcShiftDeriveResultSchema,
  authorInterviewDisplayDraftSchema,
  authorInterviewNormalizedDraftSchema,
  beatOutlineGenerationResultSchema,
  beatPacingAuditResultSchema,
  buildArcOutlineMessages,
  buildArcShiftDeriveMessages,
  buildAuthorInterviewDisplayMessages,
  buildAuthorInterviewNormalizeMessages,
  buildAuthorInterviewSmallModelNormalizeMessages,
  buildBeatOutlineMessages,
  buildBeatPacingAuditMessages,
  buildCastExpansionMessages,
  buildChapterPlanAuditMessages,
  buildCommercialReviewMessages,
  buildDecisionProfileMessages,
  buildFactConsistencyReviewMessages,
  buildMemoryUpdaterMessages,
  buildMissingResourceReviewMessages,
  buildPlannerMessages,
  buildRewriterMessages,
  buildRoleDrivenReviewMessages,
  buildSceneDecomposerMessages,
  buildStoryOutlineMessages,
  buildWriterMessages,
  castExpansionResultSchema,
  commercialReviewerResultSchema,
  decisionProfileGenerationResultSchema,
  factConsistencyReviewerResultSchema,
  memoryUpdaterResultSchema,
  missingResourceReviewerResultSchema,
  plannerResultSchema,
  roleDrivenReviewerResultSchema,
  sceneDecomposerResultSchema,
  storyOutlineGenerationResultSchema,
} from "./prompts/index.js";

/**
 * A fixture captured by `writePromptDebug` when invoked with `module` + `input`.
 * Lives at `data/projects/<id>/debug/fixtures/<scope>/<timestamp>_<label>.json`.
 */
export interface PromptFixture {
  projectId: string;
  scope: "outline" | "chapter";
  label: string;
  module: string;
  generatedAt?: string;
  input: unknown;
}

type StructuredEntry = {
  kind: "structured";
  build: (input: unknown) => ChatMessage[];
  schema: object;
  task: TaskName;
  defaultTemperature: number;
  defaultMaxTokens: number;
};

type TextEntry = {
  kind: "text";
  build: (input: unknown) => ChatMessage[];
  task: TaskName;
  defaultTemperature: number;
  defaultMaxTokens: number;
};

type RegistryEntry = StructuredEntry | TextEntry;

// Type-erased registry — each builder takes its own Input type but we trust
// the fixture matches its `module`. The replay path is for hand-curated
// experimentation, not a contract surface.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = <T extends (input: any) => ChatMessage[]>(fn: T) =>
  fn as (input: unknown) => ChatMessage[];

export const PROMPT_MODULE_REGISTRY: Record<string, RegistryEntry> = {
  // Bootstrap / interview
  author_interview_display: {
    kind: "structured",
    build: cast(buildAuthorInterviewDisplayMessages),
    schema: authorInterviewDisplayDraftSchema,
    task: "author_interview",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2200,
  },
  author_interview_normalize: {
    kind: "structured",
    build: cast(buildAuthorInterviewNormalizeMessages),
    schema: authorInterviewNormalizedDraftSchema,
    task: "author_interview",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2600,
  },
  author_interview_small_model_normalize: {
    kind: "structured",
    build: cast(buildAuthorInterviewSmallModelNormalizeMessages),
    schema: authorInterviewNormalizedDraftSchema,
    task: "author_interview",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2200,
  },

  // Outline / planning stack
  story_outline: {
    kind: "structured",
    build: cast(buildStoryOutlineMessages),
    schema: storyOutlineGenerationResultSchema,
    task: "story_outline",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2600,
  },
  cast_expansion: {
    kind: "structured",
    build: cast(buildCastExpansionMessages),
    schema: castExpansionResultSchema,
    task: "cast_expansion",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2600,
  },
  arc_outline: {
    kind: "structured",
    build: cast(buildArcOutlineMessages),
    schema: arcOutlineGenerationResultSchema,
    task: "arc_outline",
    defaultTemperature: 0.2,
    defaultMaxTokens: 3200,
  },
  beat_outline: {
    kind: "structured",
    build: cast(buildBeatOutlineMessages),
    schema: beatOutlineGenerationResultSchema,
    task: "beat_outline",
    defaultTemperature: 0.2,
    defaultMaxTokens: 5500,
  },

  // Bible enrichment
  cast_decision_profile: {
    kind: "structured",
    build: cast(buildDecisionProfileMessages),
    schema: decisionProfileGenerationResultSchema,
    task: "cast_decision_profile",
    defaultTemperature: 0.3,
    defaultMaxTokens: 2400,
  },
  arc_shift_derive: {
    kind: "structured",
    build: cast(buildArcShiftDeriveMessages),
    schema: arcShiftDeriveResultSchema,
    task: "arc_shift_derive",
    defaultTemperature: 0.3,
    defaultMaxTokens: 2400,
  },
  scene_decomposer: {
    kind: "structured",
    build: cast(buildSceneDecomposerMessages),
    schema: sceneDecomposerResultSchema,
    task: "scene_decomposer",
    defaultTemperature: 0.4,
    defaultMaxTokens: 6000,
  },

  // Per-chapter pipeline
  planner: {
    kind: "structured",
    build: cast(buildPlannerMessages),
    schema: plannerResultSchema,
    task: "planner",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2800,
  },
  writer: {
    kind: "text",
    build: cast(buildWriterMessages),
    task: "writer",
    defaultTemperature: 0.6,
    defaultMaxTokens: 4500,
  },
  rewriter: {
    kind: "text",
    build: cast(buildRewriterMessages),
    task: "rewriter",
    defaultTemperature: 0.5,
    defaultMaxTokens: 4500,
  },
  review_missing_resource: {
    kind: "structured",
    build: cast(buildMissingResourceReviewMessages),
    schema: missingResourceReviewerResultSchema,
    task: "review_missing_resource",
    defaultTemperature: 0.2,
    defaultMaxTokens: 1800,
  },
  review_fact: {
    kind: "structured",
    build: cast(buildFactConsistencyReviewMessages),
    schema: factConsistencyReviewerResultSchema,
    task: "review_fact",
    defaultTemperature: 0.2,
    defaultMaxTokens: 1800,
  },
  review_commercial: {
    kind: "structured",
    build: cast(buildCommercialReviewMessages),
    schema: commercialReviewerResultSchema,
    task: "review_commercial",
    defaultTemperature: 0.2,
    defaultMaxTokens: 1600,
  },
  review_role_drive: {
    kind: "structured",
    build: cast(buildRoleDrivenReviewMessages),
    schema: roleDrivenReviewerResultSchema,
    task: "review_role_drive",
    defaultTemperature: 0.2,
    defaultMaxTokens: 1600,
  },
  memory_updater: {
    kind: "structured",
    build: cast(buildMemoryUpdaterMessages),
    schema: memoryUpdaterResultSchema,
    task: "memory_updater",
    defaultTemperature: 0.2,
    defaultMaxTokens: 2200,
  },

  // Audit
  chapter_plan_audit: {
    kind: "text",
    build: cast(buildChapterPlanAuditMessages),
    task: "chapter_plan_audit",
    defaultTemperature: 0.3,
    defaultMaxTokens: 6400,
  },
  beat_pacing_audit: {
    kind: "structured",
    build: cast(buildBeatPacingAuditMessages),
    schema: beatPacingAuditResultSchema,
    task: "beat_pacing_audit",
    defaultTemperature: 0.3,
    defaultMaxTokens: 4000,
  },
};

export function listAvailableModules(): string[] {
  return Object.keys(PROMPT_MODULE_REGISTRY).sort();
}

export interface ReplayPromptOptions {
  fixturePath: string;
  temperature?: number;
  maxTokens?: number;
  /** If true, build the messages and print them; skip the LLM call. */
  dryRun?: boolean;
}

export interface ReplayPromptResult {
  module: string;
  label: string;
  scope: "outline" | "chapter";
  projectId: string;
  task: TaskName;
  kind: "structured" | "text";
  messages: ChatMessage[];
  output?: unknown;
}

export async function replayPrompt(options: ReplayPromptOptions): Promise<ReplayPromptResult> {
  const raw = await readFile(options.fixturePath, "utf-8");
  const fixture = JSON.parse(raw) as PromptFixture;
  if (!fixture.module) {
    throw new Error(`Fixture missing 'module' field: ${options.fixturePath}`);
  }
  const entry = PROMPT_MODULE_REGISTRY[fixture.module];
  if (!entry) {
    const known = listAvailableModules().join(", ");
    throw new Error(
      `Unknown prompt module '${fixture.module}' in fixture; known modules: ${known}`,
    );
  }

  const messages = entry.build(fixture.input);
  if (options.dryRun) {
    return {
      module: fixture.module,
      label: fixture.label,
      scope: fixture.scope,
      projectId: fixture.projectId,
      task: entry.task,
      kind: entry.kind,
      messages,
    };
  }

  const service = new LlmService();
  const temperature = options.temperature ?? entry.defaultTemperature;
  const maxTokens = options.maxTokens ?? entry.defaultMaxTokens;

  if (entry.kind === "structured") {
    const result = await service.generateObjectForTask({
      task: entry.task,
      messages,
      schema: entry.schema,
      temperature,
      maxTokens,
    });
    return {
      module: fixture.module,
      label: fixture.label,
      scope: fixture.scope,
      projectId: fixture.projectId,
      task: entry.task,
      kind: "structured",
      messages,
      output: result.object,
    };
  }

  const result = await service.generateForTask({
    task: entry.task,
    messages,
    temperature,
    maxTokens,
  });
  return {
    module: fixture.module,
    label: fixture.label,
    scope: fixture.scope,
    projectId: fixture.projectId,
    task: entry.task,
    kind: "text",
    messages,
    output: result.text,
  };
}
