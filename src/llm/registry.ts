import { AnthropicClient } from "./providers/anthropic.js";
import { DeepSeekClient } from "./providers/deepseek.js";
import { OllamaClient } from "./providers/ollama.js";
import { OpenAiClient } from "./providers/openai.js";
import type { LlmClient, LlmProvider } from "./types.js";
import { loadProjectEnv } from "../env.js";

export interface ClientRegistry {
  get(provider: LlmProvider): LlmClient;
}

export class DefaultClientRegistry implements ClientRegistry {
  private readonly clients = new Map<LlmProvider, LlmClient>();

  get(provider: LlmProvider): LlmClient {
    loadProjectEnv();

    const existing = this.clients.get(provider);
    if (existing) {
      return existing;
    }

    const client = this.createClient(provider);
    this.clients.set(provider, client);
    return client;
  }

  private createClient(provider: LlmProvider): LlmClient {
    switch (provider) {
      case "openai":
        return new OpenAiClient();
      case "deepseek":
        return new DeepSeekClient();
      case "anthropic":
        return new AnthropicClient();
      case "ollama":
        return new OllamaClient();
      default:
        throw new Error(`No client registered for provider: ${String(provider)}`);
    }
  }
}
