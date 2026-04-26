import { LlmRequestError } from "./errors.js";
import type { ChatMessage } from "./types.js";

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function parseJsonResponse(
  response: Response,
  provider: string,
): Promise<unknown> {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new LlmRequestError({
      provider,
      message: `Invalid JSON response from ${provider}`,
      status: response.status,
      details: text,
    });
  }
}

export async function ensureOk(
  response: Response,
  provider: string,
): Promise<void> {
  if (response.ok) {
    return;
  }

  const details = await parseJsonResponse(response, provider).catch(() => undefined);
  throw new LlmRequestError({
    provider,
    message: `${provider} request failed with status ${response.status}`,
    status: response.status,
    details,
  });
}

export function buildJsonInstruction(schema: object): string {
  return [
    "You are in JSON mode. Return one valid JSON object only.",
    "Do not wrap the response in markdown fences.",
    "Do not include explanations, comments, or any text before or after the JSON object.",
    "Use double quotes for all JSON object keys and string values.",
    "Follow this JSON shape exactly. Example JSON output:",
    JSON.stringify(schema, null, 2),
  ].join("\n");
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

function extractBalancedJson(text: string): string | undefined {
  const startCandidates = ["{", "["];
  let startIndex = -1;

  for (const token of startCandidates) {
    const index = text.indexOf(token);
    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
    }
  }

  if (startIndex === -1) {
    return undefined;
  }

  const opening = text[startIndex];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return undefined;
}

export function parseStructuredOutput<TObject>(
  text: string,
  provider = "unknown",
): TObject {
  const cleaned = stripMarkdownCodeFence(text);

  try {
    return JSON.parse(cleaned) as TObject;
  } catch {
    const extracted = extractBalancedJson(cleaned);
    if (extracted) {
      try {
        return JSON.parse(extracted) as TObject;
      } catch {
        // Fall through to provider-specific error below.
      }
    }
  }

  throw new LlmRequestError({
    provider,
    message: `Invalid structured JSON output from ${provider}`,
    details: cleaned.slice(0, 4000),
  });
}

export function splitSystemMessage(messages: ChatMessage[]): {
  system?: string;
  rest: ChatMessage[];
} {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    rest.push(message);
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    rest,
  };
}
