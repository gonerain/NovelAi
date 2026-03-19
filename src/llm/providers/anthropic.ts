import { LlmConfigError } from "../errors.js";
import {
  buildJsonInstruction,
  ensureOk,
  parseJsonResponse,
  parseStructuredOutput,
  splitSystemMessage,
} from "../utils.js";
import type {
  GenerateTextInput,
  GenerateTextResult,
  LlmClient,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from "../types.js";

interface AnthropicClientOptions {
  apiKey?: string;
  baseUrl?: string;
  version?: string;
  defaultModel?: string;
}

export class AnthropicClient implements LlmClient {
  readonly provider = "anthropic" as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly defaultModel: string;

  constructor(options: AnthropicClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.version = options.version ?? process.env.ANTHROPIC_VERSION ?? "2023-06-01";
    this.defaultModel = options.defaultModel ?? "claude-3-5-haiku-latest";

    if (!this.apiKey) {
      throw new LlmConfigError("ANTHROPIC_API_KEY is required for Anthropic provider");
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = input.options?.model ?? this.defaultModel;
    const { system, rest } = splitSystemMessage(input.messages);
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.version,
      },
      body: JSON.stringify({
        model,
        system,
        messages: rest,
        temperature: input.options?.temperature,
        max_tokens: input.options?.maxTokens ?? 1_024,
      }),
      signal: input.options?.signal,
    });

    await ensureOk(response, this.provider);
    const data = await parseJsonResponse(response, this.provider) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    const text = (data.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");

    return {
      provider: this.provider,
      model,
      text,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        totalTokens:
          (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      raw: data,
    };
  }

  async generateObject<TObject extends object>(
    input: StructuredGenerationInput<TObject>,
  ): Promise<StructuredGenerationResult<TObject>> {
    const result = await this.generateText({
      messages: [
        {
          role: "system",
          content: buildJsonInstruction(input.schema),
        },
        ...input.messages,
      ],
      options: input.options,
    });

    return {
      ...result,
      object: parseStructuredOutput<TObject>(result.text, this.provider),
    };
  }
}
