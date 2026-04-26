import { LlmConfigError, LlmRequestError } from "../errors.js";
import {
  buildJsonInstruction,
  ensureOk,
  parseStructuredOutput,
  parseJsonResponse,
} from "../utils.js";
import type {
  GenerateTextInput,
  GenerateTextResult,
  LlmClient,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from "../types.js";

interface DeepSeekClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class DeepSeekClient implements LlmClient {
  readonly provider = "deepseek" as const;
  private readonly maxAttempts = 3;
  private readonly baseRetryDelayMs = 800;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: DeepSeekClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "deepseek-chat";

    if (!this.apiKey) {
      throw new LlmConfigError("DEEPSEEK_API_KEY is required for DeepSeek provider");
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = input.options?.model ?? this.defaultModel;
    const data = (await this.requestChatCompletionWithRetry({
      model,
      messages: input.messages,
      temperature: input.options?.temperature,
      maxTokens: input.options?.maxTokens,
      signal: input.options?.signal,
      stage: "generateText",
    })) as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    return {
      provider: this.provider,
      model,
      text: data.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      raw: data,
    };
  }

  async generateObject<TObject extends object>(
    input: StructuredGenerationInput<TObject>,
  ): Promise<StructuredGenerationResult<TObject>> {
    const model = input.options?.model ?? this.defaultModel;
    const initialMaxTokens = input.options?.maxTokens;
    let data = await this.requestStructuredCompletion({
      model,
      messages: input.messages,
      schema: input.schema,
      temperature: input.options?.temperature,
      maxTokens: initialMaxTokens,
      signal: input.options?.signal,
    });

    if (this.isLengthTruncated(data)) {
      const retryMaxTokens = this.getRetryMaxTokens(initialMaxTokens);
      if (retryMaxTokens !== initialMaxTokens) {
        data = await this.requestStructuredCompletion({
          model,
          messages: input.messages,
          schema: input.schema,
          temperature: input.options?.temperature,
          maxTokens: retryMaxTokens,
          signal: input.options?.signal,
        });
      }
    }

    const text = data.choices[0]?.message?.content ?? "";
    if (this.isLengthTruncated(data)) {
      throw new LlmRequestError({
        provider: this.provider,
        message: `DeepSeek output was truncated before valid JSON completed. Increase maxTokens or reduce schema/output size.`,
        details: text.slice(0, 4000),
      });
    }

    return {
      provider: this.provider,
      model,
      text,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      raw: data,
      object: parseStructuredOutput<TObject>(text, this.provider),
    };
  }

  private async requestStructuredCompletion(args: {
    model: string;
    messages: StructuredGenerationInput<object>["messages"];
    schema: object;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<{
    choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  }> {
    const messages = this.withJsonInstruction(args.messages, args.schema);
    return (await this.requestChatCompletionWithRetry({
      model: args.model,
      messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      responseFormat: {
        type: "json_object",
      },
      signal: args.signal,
      stage: "generateObject",
    })) as {
      choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
  }

  private withJsonInstruction(
    messages: StructuredGenerationInput<object>["messages"],
    schema: object,
  ): StructuredGenerationInput<object>["messages"] {
    const jsonInstruction = buildJsonInstruction(schema);
    const [first, ...rest] = messages;
    if (first?.role === "system") {
      return [
        {
          role: "system",
          content: `${first.content}\n\n${jsonInstruction}`,
        },
        ...rest,
      ];
    }

    return [
      {
        role: "system",
        content: jsonInstruction,
      },
      ...messages,
    ];
  }

  private isLengthTruncated(data: {
    choices?: Array<{ finish_reason?: string }>;
  }): boolean {
    return data.choices?.[0]?.finish_reason === "length";
  }

  private getRetryMaxTokens(maxTokens?: number): number | undefined {
    if (maxTokens == null) {
      return 3200;
    }
    return Math.min(Math.max(maxTokens * 2, 3200), 6400);
  }

  private async requestChatCompletionWithRetry(args: {
    model: string;
    messages: StructuredGenerationInput<object>["messages"];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" };
    signal?: AbortSignal;
    stage: "generateText" | "generateObject";
  }): Promise<unknown> {
    const url = `${this.baseUrl}/chat/completions`;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: args.model,
            messages: args.messages,
            temperature: args.temperature,
            max_tokens: args.maxTokens ?? (args.responseFormat ? 4096 : undefined),
            response_format: args.responseFormat,
          }),
          signal: args.signal,
        });
      } catch (error) {
        if (args.signal?.aborted) {
          throw error;
        }

        if (attempt < this.maxAttempts) {
          await this.sleep(this.baseRetryDelayMs * attempt);
          continue;
        }

        throw new LlmRequestError({
          provider: this.provider,
          message: `Network error from ${this.provider} at ${args.stage} after ${attempt} attempts`,
          details: {
            url,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      if (this.isRetryableStatus(response.status) && attempt < this.maxAttempts) {
        await this.sleep(this.baseRetryDelayMs * attempt);
        continue;
      }

      await ensureOk(response, this.provider);
      return await parseJsonResponse(response, this.provider);
    }

    throw new LlmRequestError({
      provider: this.provider,
      message: `Unknown request failure from ${this.provider}`,
      details: { url, stage: args.stage },
    });
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status < 600);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
