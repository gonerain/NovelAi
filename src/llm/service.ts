import { defaultTaskRoutes } from "./config.js";
import { DefaultClientRegistry, type ClientRegistry } from "./registry.js";
import type {
  ChatMessage,
  GenerateTextResult,
  StructuredGenerationResult,
  TaskName,
} from "./types.js";

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 250;

function isPromptDebugEnabled(): boolean {
  const raw = process.env.NOVELAI_DEBUG_PROMPT?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getRetryConfig(): { maxRetries: number; baseDelayMs: number } {
  const maxRetriesRaw = Number(process.env.NOVELAI_LLM_MAX_RETRIES ?? DEFAULT_MAX_RETRIES);
  const baseDelayRaw = Number(process.env.NOVELAI_LLM_RETRY_BASE_MS ?? DEFAULT_BASE_DELAY_MS);
  return {
    maxRetries: Number.isFinite(maxRetriesRaw) ? Math.max(0, Math.floor(maxRetriesRaw)) : DEFAULT_MAX_RETRIES,
    baseDelayMs: Number.isFinite(baseDelayRaw) ? Math.max(0, Math.floor(baseDelayRaw)) : DEFAULT_BASE_DELAY_MS,
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const maybeStatus = (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { status?: unknown; statusCode?: unknown }).statusCode;
  return typeof maybeStatus === "number" ? maybeStatus : undefined;
}

function isRetryableError(error: unknown): boolean {
  const statusCode = extractStatusCode(error);
  if (statusCode === 408 || statusCode === 409 || statusCode === 429) {
    return true;
  }
  if (typeof statusCode === "number" && statusCode >= 500) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("eai_again") ||
    message.includes("socket hang up") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable")
  );
}

async function withRetry<T>(fn: () => Promise<T>, task: TaskName): Promise<T> {
  const retry = getRetryConfig();
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retry.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= retry.maxRetries) {
        throw error;
      }

      const delayMs = retry.baseDelayMs * 2 ** attempt;
      console.warn(
        `[llm] task=${task} attempt=${attempt + 1} failed, retrying in ${delayMs}ms: ${error instanceof Error ? error.message : String(error)}`,
      );
      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function dumpPromptDebug(task: TaskName, messages: ChatMessage[]): void {
  if (!isPromptDebugEnabled()) {
    return;
  }

  console.log(`[debug] prompt task=${task} messages=${messages.length}`);
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    console.log(`[debug] prompt task=${task} #${index + 1} role=${message.role}`);
    console.log(message.content);
  }
  console.log(`[debug] prompt task=${task} end`);
}

interface GenerateForTaskArgs {
  task: TaskName;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface GenerateObjectForTaskArgs<TSchema extends object>
  extends GenerateForTaskArgs {
  schema: TSchema;
}

export class LlmService {
  constructor(
    private readonly registry: ClientRegistry = new DefaultClientRegistry(),
  ) {}

  async generateForTask(args: GenerateForTaskArgs): Promise<GenerateTextResult> {
    const route = defaultTaskRoutes[args.task];
    const client = this.registry.get(route.provider);
    dumpPromptDebug(args.task, args.messages);

    return withRetry(
      () =>
        client.generateText({
          messages: args.messages,
          options: {
            model: route.model,
            temperature: args.temperature,
            maxTokens: args.maxTokens,
          },
        }),
      args.task,
    );
  }

  async generateObjectForTask<TObject extends object>(
    args: GenerateObjectForTaskArgs<TObject>,
  ): Promise<StructuredGenerationResult<TObject>> {
    const route = defaultTaskRoutes[args.task];
    const client = this.registry.get(route.provider);
    dumpPromptDebug(args.task, args.messages);

    return withRetry(
      () =>
        client.generateObject<TObject>({
          messages: args.messages,
          schema: args.schema,
          options: {
            model: route.model,
            temperature: args.temperature,
            maxTokens: args.maxTokens,
          },
        }),
      args.task,
    );
  }
}
