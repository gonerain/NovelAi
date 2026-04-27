import type { ModelRoute, TaskName } from "./types.js";

export const defaultTaskRoutes: Record<TaskName, ModelRoute> = {
  author_interview: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  story_outline: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  cast_expansion: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  arc_outline: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  beat_outline: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  planner: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  writer: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  rewriter: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  review_commercial: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  review_missing_resource: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  review_fact: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  review_role_drive: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  review_voice: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
  memory_updater: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
  },
};
