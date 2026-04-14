import type { ModelRoute, TaskName } from "./types.js";

export const defaultTaskRoutes: Record<TaskName, ModelRoute> = {
  author_interview: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  story_outline: {
    provider: "deepseek",
    model: "deepseek-reasoner",
  },
  cast_expansion: {
    provider: "deepseek",
    model: "deepseek-reasoner",
  },
  arc_outline: {
    provider: "deepseek",
    model: "deepseek-reasoner",
  },
  beat_outline: {
    provider: "deepseek",
    model: "deepseek-reasoner",
  },
  planner: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  writer: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  rewriter: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  review_missing_resource: {
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
    provider: "deepseek",
    model: "deepseek-chat",
  },
};