import type { ModelRoute, TaskName } from "./types.js";

export const defaultTaskRoutes: Record<TaskName, ModelRoute> = {
  author_interview: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  planner: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  writer: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  review_fact: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  review_voice: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  memory_updater: {
    provider: "ollama",
    model: "qwen3:8b",
  },
};
