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

interface GlmClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

interface GlmMessagePart {
  type?: string;
  text?: string;
}

interface GlmResponseShape {
  choices?: Array<{
    message?: {
      content?: string | GlmMessagePart[] | Record<string, unknown>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: string[] = [];
    if (typeof obj.text === "string") {
      result.push(obj.text);
    }
    if (typeof obj.content === "string") {
      result.push(obj.content);
    } else if (obj.content != null) {
      result.push(...collectText(obj.content));
    }
    return result;
  }

  return [];
}

function extractTextContent(data: GlmResponseShape): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object") {
    const recovered = collectText(content).filter(Boolean).join("\n").trim();
    return recovered || JSON.stringify(content);
  }

  const fallback = collectText(data).filter(Boolean).join("\n").trim();
  return fallback;
}

export class GlmClient implements LlmClient {
  readonly provider = "glm" as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: GlmClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GLM_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "glm-4.5";

    if (!this.apiKey) {
      throw new LlmConfigError("GLM_API_KEY is required for GLM provider");
    }
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
      }),
      signal: input.options?.signal,
    });

    await ensureOk(response, this.provider);
    const data = (await parseJsonResponse(response, this.provider)) as GlmResponseShape;

    return {
      provider: this.provider,
      model,
      text: extractTextContent(data),
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
          { role: "system", content: buildJsonInstruction(input.schema) },
        ],
        temperature: input.options?.temperature,
        max_tokens: input.options?.maxTokens,
        response_format: {
          type: "json_object",
        },
      }),
      signal: input.options?.signal,
    });

    await ensureOk(response, this.provider);
    const data = (await parseJsonResponse(response, this.provider)) as GlmResponseShape;

    const text = extractTextContent(data);
    let object: TObject;
    try {
      object = parseStructuredOutput<TObject>(text, this.provider);
    } catch {
      // Repair pass: ask model to reformat prior output into strict JSON schema.
      const repairResponse = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: input.options?.maxTokens,
          messages: [
            {
              role: "system",
              content: [
                "You are a JSON repairer.",
                "Output valid JSON only.",
                "Do not wrap in markdown.",
                "Follow this JSON shape exactly:",
                JSON.stringify(input.schema, null, 2),
              ].join("\n"),
            },
            {
              role: "user",
              content: `Reformat the following model output into valid JSON:\n\n${text}`,
            },
          ],
          response_format: {
            type: "json_object",
          },
        }),
        signal: input.options?.signal,
      });
      await ensureOk(repairResponse, this.provider);
      const repairData = (await parseJsonResponse(
        repairResponse,
        this.provider,
      )) as GlmResponseShape;
      const repairedText = extractTextContent(repairData);
      object = parseStructuredOutput<TObject>(repairedText, this.provider);
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
      object,
    };
  }
}
