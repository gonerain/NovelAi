import { LlmConfigError } from "../errors.js";
import {
  buildJsonInstruction,
  ensureOk,
  parseJsonResponse,
  parseStructuredOutput,
} from "../utils.js";
import type {
  GenerateTextInput,
  GenerateTextResult,
  LlmClient,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from "../types.js";

interface OpenAiClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class OpenAiClient implements LlmClient {
  readonly provider = "openai" as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: OpenAiClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "gpt-4.1-mini";

    if (!this.apiKey) {
      throw new LlmConfigError("OPENAI_API_KEY is required for OpenAI provider");
    }
  }

  private compatibilityExtraBody(): Record<string, unknown> {
    const base = this.baseUrl.toLowerCase();
    if (base.includes("bigmodel.cn") || base.includes("z.ai") || base.includes("zhipu")) {
      return {
        // Z.AI hosted APIs use `thinking`; vLLM/OpenAI-compatible GLM
        // adapters commonly use `chat_template_kwargs`.
        thinking: { type: "disabled" },
        chat_template_kwargs: { enable_thinking: false },
      };
    }
    return {};
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = input.options?.model ?? this.defaultModel;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.options?.temperature,
        max_tokens: input.options?.maxTokens,
        ...this.compatibilityExtraBody(),
      }),
      signal: input.options?.signal,
    });

    await ensureOk(response, this.provider);
    const data = await parseJsonResponse(response, this.provider) as {
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
    const systemInstruction = buildJsonInstruction(input.schema);
    const model = input.options?.model ?? this.defaultModel;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...input.messages,
          { role: "system", content: systemInstruction },
        ],
        temperature: input.options?.temperature,
        max_tokens: input.options?.maxTokens,
        response_format: { type: "json_object" },
        ...this.compatibilityExtraBody(),
      }),
      signal: input.options?.signal,
    });
    await ensureOk(response, this.provider);
    const data = await parseJsonResponse(response, this.provider) as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const text = data.choices[0]?.message?.content ?? "";

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
}
