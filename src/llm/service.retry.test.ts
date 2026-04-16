import test from "node:test";
import assert from "node:assert/strict";

import { LlmService } from "./service.js";
import type {
  ChatMessage,
  GenerateTextResult,
  LlmClient,
  LlmProvider,
  StructuredGenerationResult,
} from "./types.js";
import type { ClientRegistry } from "./registry.js";

class FakeClient implements LlmClient {
  readonly provider: LlmProvider = "deepseek";
  public textCalls = 0;

  constructor(private readonly behavior: "retryable_then_ok" | "fatal") {}

  async generateText(_input: { messages: ChatMessage[] }): Promise<GenerateTextResult> {
    this.textCalls += 1;
    if (this.behavior === "retryable_then_ok" && this.textCalls === 1) {
      const error = new Error("timeout while calling provider");
      throw error;
    }
    if (this.behavior === "fatal") {
      const error = new Error("invalid api key");
      throw error;
    }
    return {
      provider: this.provider,
      model: "deepseek-chat",
      text: "ok",
    };
  }

  async generateObject<TObject extends object>(
    _input: { messages: ChatMessage[]; schema: TObject },
  ): Promise<StructuredGenerationResult<TObject>> {
    return {
      provider: this.provider,
      model: "deepseek-chat",
      text: "{}",
      object: {} as TObject,
    };
  }
}

class FakeRegistry implements ClientRegistry {
  constructor(private readonly client: LlmClient) {}
  get(_provider: LlmProvider): LlmClient {
    return this.client;
  }
}

test("retries once on retryable error and then succeeds", async () => {
  process.env.NOVELAI_LLM_MAX_RETRIES = "1";
  process.env.NOVELAI_LLM_RETRY_BASE_MS = "0";

  const client = new FakeClient("retryable_then_ok");
  const service = new LlmService(new FakeRegistry(client));
  const result = await service.generateForTask({
    task: "writer",
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(result.text, "ok");
  assert.equal(client.textCalls, 2);
});

test("does not retry non-retryable error", async () => {
  process.env.NOVELAI_LLM_MAX_RETRIES = "3";
  process.env.NOVELAI_LLM_RETRY_BASE_MS = "0";

  const client = new FakeClient("fatal");
  const service = new LlmService(new FakeRegistry(client));

  await assert.rejects(
    () =>
      service.generateForTask({
        task: "writer",
        messages: [{ role: "user", content: "hi" }],
      }),
    /invalid api key/i,
  );
  assert.equal(client.textCalls, 1);
});
