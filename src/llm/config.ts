import type { ModelRoute, TaskName } from "./types.js";

export const defaultTaskRoutes: Record<TaskName, ModelRoute> = {
  author_interview: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  story_outline: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  cast_expansion: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  cast_decision_profile: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  arc_shift_derive: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  scene_decomposer: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  arc_outline: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  beat_outline: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  episode_plan_lab: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
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
  review_commercial: {
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
  review_role_drive: {
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
  chapter_plan_audit: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  beat_pacing_audit: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
};
