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

interface OllamaClientOptions {
  baseUrl?: string;
  defaultModel?: string;
}

export class OllamaClient implements LlmClient {
  readonly provider = "ollama" as const;

  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "qwen3:8b";
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = input.options?.model ?? this.defaultModel;
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        stream: false,
        options: {
          temperature: input.options?.temperature,
          num_predict: input.options?.maxTokens,
        },
      }),
      signal: input.options?.signal,
    });

    await ensureOk(response, this.provider);
    const data = await parseJsonResponse(response, this.provider) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      provider: this.provider,
      model,
      text: data.message?.content ?? "",
      usage: {
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        totalTokens:
          (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
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
