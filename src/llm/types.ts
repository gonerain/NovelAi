export type LlmProvider = "openai" | "deepseek" | "anthropic" | "ollama";

export type MessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateTextInput {
  messages: ChatMessage[];
  options?: GenerationOptions;
}

export interface GenerateTextResult {
  provider: LlmProvider;
  model: string;
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export interface StructuredGenerationInput<TSchema extends object> {
  messages: ChatMessage[];
  schema: TSchema;
  options?: GenerationOptions;
}

export interface StructuredGenerationResult<TObject> extends GenerateTextResult {
  object: TObject;
}

export interface LlmClient {
  readonly provider: LlmProvider;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateObject<TObject extends object>(
    input: StructuredGenerationInput<TObject>,
  ): Promise<StructuredGenerationResult<TObject>>;
}

export interface ModelRoute {
  provider: LlmProvider;
  model: string;
}

export type TaskName =
  | "author_interview"
  | "story_outline"
  | "cast_expansion"
  | "arc_outline"
  | "planner"
  | "writer"
  | "review_missing_resource"
  | "review_fact"
  | "review_voice"
  | "memory_updater";
