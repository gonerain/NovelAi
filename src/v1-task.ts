import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ParseTaskBriefIssue,
  TaskBrief,
  TaskDecomposition,
} from "./domain/index.js";
import { parseTaskBriefMarkdown, validateTaskBrief } from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  taskBriefPath,
  taskDecompositionPath,
  tasksDirPath,
} from "./v1-paths.js";

export interface TaskSubmitRunResult {
  projectId: string;
  taskId: string;
  briefPath: string;
  brief: TaskBrief;
  warnings: string[];
}

export interface TaskListRunResult {
  projectId: string;
  tasksDir: string;
  briefs: TaskBrief[];
  decompositionByTaskId: Record<string, TaskDecomposition | null>;
}

export interface TaskInspectRunResult {
  projectId: string;
  taskId: string;
  briefPath: string;
  decompositionPath: string;
  brief: TaskBrief;
  decomposition: TaskDecomposition | null;
}

function deriveTaskIdFromFilename(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  // Strip a leading "NN-" prefix if present so `briefs/01-foo.md` becomes "task-01-foo".
  const withoutLeading = base.replace(/^[0-9]+-/, (m) => `task-${m}`);
  // Replace whitespace and unsafe characters with hyphens.
  const safe = withoutLeading.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "task";
}

function formatIssues(issues: ParseTaskBriefIssue[]): string[] {
  return issues.map((issue) => `${issue.severity}: ${issue.message}`);
}

export async function submitTaskFromFile(args: {
  projectId: string;
  filePath: string;
  /** Override the auto-derived task id. */
  taskId?: string;
}): Promise<TaskSubmitRunResult> {
  const repository = new FileProjectRepository();
  const absolute = path.isAbsolute(args.filePath)
    ? args.filePath
    : path.resolve(process.cwd(), args.filePath);
  const markdown = await readFile(absolute, "utf-8");
  const defaultId = args.taskId ?? deriveTaskIdFromFilename(absolute);

  // Avoid silently overwriting an existing brief.
  const existing = await repository.loadTaskBrief(args.projectId, defaultId);
  if (existing) {
    throw new Error(
      `Task brief already exists: project=${args.projectId}, taskId=${defaultId}. ` +
        `Pass --task-id <new-id> or delete the existing brief at ${taskBriefPath(args.projectId, defaultId)} first.`,
    );
  }

  const result = parseTaskBriefMarkdown({ markdown, defaultId });
  const errors = result.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0 || !result.brief) {
    throw new Error(
      `Task brief parse failed for ${absolute}:\n${formatIssues(errors).map((line) => `  - ${line}`).join("\n")}`,
    );
  }

  const validationIssues = validateTaskBrief(result.brief);
  const validationErrors = validationIssues.filter((issue) => issue.severity === "error");
  if (validationErrors.length > 0) {
    throw new Error(
      `Task brief validation failed:\n${formatIssues(validationErrors).map((line) => `  - ${line}`).join("\n")}`,
    );
  }

  await repository.saveTaskBrief(args.projectId, result.brief);

  const warnings = result.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);

  return {
    projectId: args.projectId,
    taskId: result.brief.id,
    briefPath: taskBriefPath(args.projectId, result.brief.id),
    brief: result.brief,
    warnings,
  };
}

export async function listTasks(args: {
  projectId: string;
}): Promise<TaskListRunResult> {
  const repository = new FileProjectRepository();
  const briefs = await repository.loadAllTaskBriefs(args.projectId);
  const decompositionByTaskId: Record<string, TaskDecomposition | null> = {};
  for (const brief of briefs) {
    decompositionByTaskId[brief.id] = await repository.loadTaskDecomposition(
      args.projectId,
      brief.id,
    );
  }
  return {
    projectId: args.projectId,
    tasksDir: tasksDirPath(args.projectId),
    briefs,
    decompositionByTaskId,
  };
}

export async function inspectTask(args: {
  projectId: string;
  taskId: string;
}): Promise<TaskInspectRunResult> {
  const repository = new FileProjectRepository();
  const brief = await repository.loadTaskBrief(args.projectId, args.taskId);
  if (!brief) {
    throw new Error(
      `Task brief not found: project=${args.projectId}, taskId=${args.taskId}`,
    );
  }
  const decomposition = await repository.loadTaskDecomposition(
    args.projectId,
    args.taskId,
  );
  return {
    projectId: args.projectId,
    taskId: args.taskId,
    briefPath: taskBriefPath(args.projectId, args.taskId),
    decompositionPath: taskDecompositionPath(args.projectId, args.taskId),
    brief,
    decomposition,
  };
}
