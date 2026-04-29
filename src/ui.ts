import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";

import {
  applyOutlinePatches,
  inspectConsequences,
  runRoleDrivenEval,
  suggestOutlinePatches,
} from "./v1-impact.js";
import type { OutlinePatchApplyFilters, OutlinePatchSuggestion } from "./v1-role-drive.js";
import {
  computeThreadEconomy,
  inspectNarrativeRuntime,
  rankNarrativeRuntime,
  runThreadEval,
  suggestNextThreadMoves,
} from "./v1-threads.js";
import { inspectOffscreenMoves } from "./v1-offscreen.js";
import { FileProjectRepository } from "./storage/index.js";
import { runV1 } from "./v1-lib.js";
import type { ArcOutline, BeatOutline } from "./domain/index.js";
import { ALL_CHAPTER_SHAPES, isChapterShape } from "./domain/index.js";

const PORT = Number(process.env.NOVELAI_UI_PORT ?? 3710);
const HOST = process.env.NOVELAI_UI_HOST ?? "127.0.0.1";

function projectRoot(projectId: string): string {
  return path.resolve(process.cwd(), "data", "projects", projectId);
}

function validateProjectId(projectId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error("projectId must match [a-zA-Z0-9_-]+");
  }
}

type ResourceType = "json" | "text";

interface ResourceMeta {
  key: string;
  label: string;
  type: ResourceType;
  relativePath: string;
}

const STATIC_RESOURCES: ResourceMeta[] = [
  { key: "story-outline-json", label: "故事大纲 JSON", type: "json", relativePath: "story-outline.json" },
  { key: "arc-outlines-json", label: "分卷大纲 JSON", type: "json", relativePath: "arc-outlines.json" },
  { key: "beat-outlines-json", label: "细纲 JSON", type: "json", relativePath: "beat-outlines.json" },
  { key: "chapter-plans-json", label: "章节计划 JSON", type: "json", relativePath: "chapter-plans.json" },
  { key: "character-states-json", label: "角色状态 JSON", type: "json", relativePath: "character-states.json" },
  { key: "world-facts-json", label: "世界规则 JSON", type: "json", relativePath: "world-facts.json" },
  { key: "story-memories-json", label: "记忆条目 JSON", type: "json", relativePath: "story-memories.json" },
  { key: "story-contracts-json", label: "故事契约 JSON", type: "json", relativePath: "story-contracts.json" },
  { key: "narrative-threads-json", label: "线程 JSON", type: "json", relativePath: "narrative-threads.json" },
  { key: "offscreen-moves-json", label: "幕后行动 JSON", type: "json", relativePath: "offscreen-moves.json" },
  { key: "thread-economy-report-json", label: "线程经济报告 JSON", type: "json", relativePath: "thread-economy-report.json" },
  { key: "story-outline-md", label: "故事大纲 Markdown", type: "text", relativePath: "story-outline.md" },
  { key: "detailed-outline-md", label: "细纲 Markdown", type: "text", relativePath: "detailed-outline.md" },
];

const CHAPTER_RUNTIME_SIDECARS: Array<{
  suffix: string;
  fileName: string;
  label: string;
}> = [
  { suffix: "decision-log", fileName: "decision_log.json", label: "决策日志" },
  { suffix: "relationship-shift", fileName: "relationship_shift.json", label: "关系位移" },
  { suffix: "consequence-edges", fileName: "consequence_edges.json", label: "后果边" },
  { suffix: "episode-packet", fileName: "episode_packet.json", label: "Episode Packet" },
  { suffix: "episode-eval", fileName: "episode_eval.json", label: "Episode Eval" },
  { suffix: "state-deltas", fileName: "state_deltas.json", label: "State Deltas" },
  { suffix: "state-deltas-eval", fileName: "state_deltas_eval.json", label: "State Delta Eval" },
  { suffix: "thread-update-report", fileName: "thread_update_report.json", label: "Thread Update Report" },
  { suffix: "threads-suggest-next", fileName: "threads_suggest_next.json", label: "下一步线程建议" },
];

const CHAPTER_SIDECAR_FILE_BY_KEY: Record<string, string> = Object.fromEntries(
  CHAPTER_RUNTIME_SIDECARS.map((item) => [item.suffix, item.fileName]),
);

function jsonResponse(res: http.ServerResponse, code: number, payload: unknown): void {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw);
}

async function listChapterNumbers(projectId: string): Promise<number[]> {
  const chaptersDir = path.join(projectRoot(projectId), "chapters");
  try {
    const entries = await readdir(chaptersDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const match = /^chapter-(\d+)$/.exec(entry.name);
        return match ? Number(match[1]) : NaN;
      })
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

async function listImpactReportNames(projectId: string): Promise<string[]> {
  const impactDir = path.join(projectRoot(projectId), "impact");
  try {
    const entries = await readdir(impactDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function listChapterReviewResources(projectId: string, chapters: number[]): Promise<Array<{
  key: string;
  label: string;
}>> {
  const candidates = chapters.flatMap((chapterNumber) =>
    CHAPTER_RUNTIME_SIDECARS.map((sidecar) => ({
      chapterNumber,
      ...sidecar,
      filePath: chapterSidecarPath(projectId, chapterNumber, sidecar.fileName),
    })),
  );
  const existing = await Promise.all(
    candidates.map(async (item) => ({
      item,
      exists: await pathExists(item.filePath),
    })),
  );
  return existing
    .filter((entry) => entry.exists)
    .map(({ item }) => ({
      key: `chapter-${String(item.chapterNumber).padStart(3, "0")}-${item.suffix}`,
      label: `章节 ${item.chapterNumber} ${item.label} JSON`,
    }));
}

function chapterDraftPath(projectId: string, chapterNumber: number): string {
  return path.join(
    projectRoot(projectId),
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "draft.md",
  );
}

function chapterResultPath(projectId: string, chapterNumber: number): string {
  return path.join(
    projectRoot(projectId),
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    "result.json",
  );
}

function chapterSidecarPath(projectId: string, chapterNumber: number, fileName: string): string {
  return path.join(
    projectRoot(projectId),
    "chapters",
    `chapter-${String(chapterNumber).padStart(3, "0")}`,
    fileName,
  );
}

function roleDrivenEvalUiPath(projectId: string): string {
  return path.join(projectRoot(projectId), "memory", "eval", "role-driven-eval-report.json");
}

function resourcePath(projectId: string, key: string): { type: ResourceType; filePath: string } | null {
  const base = STATIC_RESOURCES.find((item) => item.key === key);
  if (base) {
    return {
      type: base.type,
      filePath: path.join(projectRoot(projectId), base.relativePath),
    };
  }

  const draftMatch = /^chapter-(\d+)-draft$/.exec(key);
  if (draftMatch) {
    return {
      type: "text",
      filePath: chapterDraftPath(projectId, Number(draftMatch[1])),
    };
  }

  const resultMatch = /^chapter-(\d+)-result$/.exec(key);
  if (resultMatch) {
    return {
      type: "json",
      filePath: chapterResultPath(projectId, Number(resultMatch[1])),
    };
  }

  const sidecarMatch = /^chapter-(\d+)-([a-z-]+)$/.exec(key);
  if (sidecarMatch) {
    const sidecarKey = sidecarMatch[2];
    const fileName = sidecarKey ? CHAPTER_SIDECAR_FILE_BY_KEY[sidecarKey] : undefined;
    if (fileName) {
      return {
        type: "json",
        filePath: chapterSidecarPath(projectId, Number(sidecarMatch[1]), fileName),
      };
    }
  }

  const impactMatch = /^impact-(.+\.json)$/.exec(key);
  if (impactMatch) {
    const fileName = impactMatch[1];
    if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
      throw new Error("Invalid impact report key");
    }
    return {
      type: "json",
      filePath: path.join(projectRoot(projectId), "impact", fileName),
    };
  }

  if (key === "role-driven-eval-report") {
    return {
      type: "json",
      filePath: roleDrivenEvalUiPath(projectId),
    };
  }

  return null;
}

async function loadResource(projectId: string, key: string): Promise<{ type: ResourceType; content: string }> {
  const meta = resourcePath(projectId, key);
  if (!meta) {
    throw new Error(`Unknown resource key: ${key}`);
  }
  const content = await readFile(meta.filePath, "utf-8");
  return { type: meta.type, content };
}

async function saveResource(projectId: string, key: string, content: string): Promise<void> {
  const meta = resourcePath(projectId, key);
  if (!meta) {
    throw new Error(`Unknown resource key: ${key}`);
  }
  if (meta.type === "json") {
    const parsed = JSON.parse(content);
    await writeFile(meta.filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
    return;
  }
  await writeFile(meta.filePath, content, "utf-8");
}

async function loadCharacters(projectId: string): Promise<unknown[]> {
  const file = path.join(projectRoot(projectId), "character-states.json");
  const raw = await readFile(file, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("character-states.json is not array");
  }
  return parsed;
}

async function saveCharacters(projectId: string, characters: unknown[]): Promise<void> {
  const file = path.join(projectRoot(projectId), "character-states.json");
  await writeFile(file, `${JSON.stringify(characters, null, 2)}\n`, "utf-8");
}

async function approveDetailedOutline(projectId: string, approver: string, note: string): Promise<string> {
  const root = projectRoot(projectId);
  await mkdir(root, { recursive: true });
  const file = path.join(root, "detailed-outline-approved.json");
  const payload = {
    projectId,
    approvedAt: new Date().toISOString(),
    approver,
    note,
  };
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return file;
}

function normalizePatchFilters(input: unknown): OutlinePatchApplyFilters {
  if (!input || typeof input !== "object") {
    return {};
  }
  const record = input as Record<string, unknown>;
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  const suggestionTypeArray = (value: unknown): Array<OutlinePatchSuggestion["suggestionType"]> => {
    const allowed = new Set<OutlinePatchSuggestion["suggestionType"]>([
      "decision_pressure_alignment",
      "relationship_shift_alignment",
      "delayed_consequence_alignment",
    ]);
    return stringArray(value).map((item) => {
      if (!allowed.has(item as OutlinePatchSuggestion["suggestionType"])) {
        throw new Error(`Unsupported patch suggestion type: ${item}`);
      }
      return item as OutlinePatchSuggestion["suggestionType"];
    });
  };

  return {
    onlyBeatIds: stringArray(record.onlyBeatIds),
    skipBeatIds: stringArray(record.skipBeatIds),
    onlySuggestionTypes: suggestionTypeArray(record.onlySuggestionTypes),
    skipSuggestionTypes: suggestionTypeArray(record.skipSuggestionTypes),
  };
}

async function isDetailApproved(projectId: string): Promise<boolean> {
  try {
    await readFile(path.join(projectRoot(projectId), "detailed-outline-approved.json"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function pathExists(filepath: string): Promise<boolean> {
  try {
    await readFile(filepath, "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function copyDirectoryRecursive(sourceDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function ensureTextFile(filePath: string, fallbackContent: string): Promise<void> {
  if (!(await pathExists(filePath))) {
    await writeFile(filePath, fallbackContent, "utf-8");
  }
}

async function ensureJsonFile(filePath: string, fallbackData: unknown): Promise<void> {
  if (!(await pathExists(filePath))) {
    await writeFile(filePath, `${JSON.stringify(fallbackData, null, 2)}\n`, "utf-8");
  }
}

async function createProjectFromTemplate(projectId: string, templateProjectId = "demo_project"): Promise<void> {
  validateProjectId(projectId);
  validateProjectId(templateProjectId);

  const source = projectRoot(templateProjectId);
  const target = projectRoot(projectId);
  if (source === target) {
    throw new Error("projectId cannot be same as templateProjectId");
  }

  try {
    await readdir(target);
    throw new Error(`project already exists: ${projectId}`);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }

  await readdir(source);
  await copyDirectoryRecursive(source, target);

  await ensureJsonFile(path.join(target, "chapter-plans.json"), []);
  await ensureTextFile(path.join(target, "story-outline.md"), "# Story Outline\n\n");
  await ensureTextFile(path.join(target, "detailed-outline.md"), "# Detailed Outline\n\n");
}

const UI_ASSET_DIR = path.resolve(process.cwd(), "src", "ui");
const UI_ASSET_MAP: Record<string, { fileName: string; contentType: string }> = {
  "/": { fileName: "index.html", contentType: "text/html; charset=utf-8" },
  "/ui/styles.css": { fileName: "styles.css", contentType: "text/css; charset=utf-8" },
  "/ui/app.js": { fileName: "app.js", contentType: "application/javascript; charset=utf-8" },
};

function rawResponse(
  res: http.ServerResponse,
  code: number,
  contentType: string,
  payload: string,
): void {
  res.statusCode = code;
  res.setHeader("Content-Type", contentType);
  res.end(payload);
}

async function serveUiAsset(
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  const mapped = UI_ASSET_MAP[pathname];
  if (!mapped) {
    return false;
  }
  const content = await readFile(path.join(UI_ASSET_DIR, mapped.fileName), "utf-8");
  rawResponse(res, 200, mapped.contentType, content);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && (await serveUiAsset(res, url.pathname))) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/project") {
      const projectId = url.searchParams.get("projectId")?.trim() ?? "";
      if (!projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const chapters = await listChapterNumbers(projectId);
      const impactReports = await listImpactReportNames(projectId);
      const chapterReviewResources = await listChapterReviewResources(projectId, chapters);
      const roleEvalExists = await pathExists(roleDrivenEvalUiPath(projectId));
      const resources = [
        ...STATIC_RESOURCES.filter((item) => item.type === "text").map((item) => ({
          key: item.key,
          label: item.label,
        })),
        ...STATIC_RESOURCES.filter((item) => item.type === "json").map((item) => ({
          key: item.key,
          label: item.label,
        })),
        ...chapters.flatMap((chapterNumber) => [
          {
            key: `chapter-${String(chapterNumber).padStart(3, "0")}-draft`,
            label: `章节 ${chapterNumber} 草稿 Markdown`,
          },
          {
            key: `chapter-${String(chapterNumber).padStart(3, "0")}-result`,
            label: `章节 ${chapterNumber} 结果 JSON`,
          },
        ]),
        ...chapterReviewResources,
        ...impactReports.map((fileName) => ({
          key: `impact-${fileName}`,
          label: `影响/补丁报告 ${fileName}`,
        })),
        ...(roleEvalExists
          ? [
              {
                key: "role-driven-eval-report",
                label: "角色驱动 Eval 报告 JSON",
              },
            ]
          : []),
      ];
      return jsonResponse(res, 200, {
        projectId,
        detailApproved: await isDetailApproved(projectId),
        resources,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/project/create") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        templateProjectId?: string;
      };
      if (!body.projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      await createProjectFromTemplate(body.projectId, body.templateProjectId ?? "demo_project");
      return jsonResponse(res, 200, { ok: true, projectId: body.projectId });
    }

    if (req.method === "GET" && url.pathname === "/api/resource") {
      const projectId = url.searchParams.get("projectId")?.trim() ?? "";
      const key = url.searchParams.get("key")?.trim() ?? "";
      if (!projectId || !key) {
        return jsonResponse(res, 400, { error: "projectId and key required" });
      }
      const loaded = await loadResource(projectId, key);
      return jsonResponse(res, 200, loaded);
    }

    if (req.method === "POST" && url.pathname === "/api/resource") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        key?: string;
        content?: string;
      };
      if (!body.projectId || !body.key || typeof body.content !== "string") {
        return jsonResponse(res, 400, { error: "projectId,key,content required" });
      }
      await saveResource(body.projectId, body.key, body.content);
      return jsonResponse(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/characters") {
      const projectId = url.searchParams.get("projectId")?.trim() ?? "";
      if (!projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const characters = await loadCharacters(projectId);
      return jsonResponse(res, 200, { characters });
    }

    if (req.method === "POST" && url.pathname === "/api/characters") {
      const body = (await parseBody(req)) as { projectId?: string; characters?: unknown[] };
      if (!body.projectId || !Array.isArray(body.characters)) {
        return jsonResponse(res, 400, { error: "projectId and characters[] required" });
      }
      await saveCharacters(body.projectId, body.characters);
      return jsonResponse(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/approve-detail") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        approver?: string;
        note?: string;
      };
      if (!body.projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const file = await approveDetailedOutline(
        body.projectId,
        body.approver ?? "manual",
        body.note ?? "",
      );
      return jsonResponse(res, 200, { ok: true, file });
    }

    if (req.method === "POST" && url.pathname === "/api/role/inspect-consequences") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        chapterNumber?: number;
      };
      if (!body.projectId || !body.chapterNumber || body.chapterNumber < 1) {
        return jsonResponse(res, 400, { error: "projectId and chapterNumber required" });
      }
      const result = await inspectConsequences({
        projectId: body.projectId,
        chapterNumber: body.chapterNumber,
      });
      return jsonResponse(res, 200, {
        ok: true,
        reportPath: result.reportPath,
        resourceKey: `impact-chapter-${String(body.chapterNumber).padStart(3, "0")}.consequences.json`,
        consequenceEdges: result.report.consequenceEdges?.edges.length ?? 0,
        unresolvedDelayedConsequences: result.report.unresolvedDelayedConsequences.length,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/role/suggest-patches") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        fromChapter?: number;
      };
      if (!body.projectId || !body.fromChapter || body.fromChapter < 1) {
        return jsonResponse(res, 400, { error: "projectId and fromChapter required" });
      }
      const result = await suggestOutlinePatches({
        projectId: body.projectId,
        fromChapter: body.fromChapter,
      });
      return jsonResponse(res, 200, {
        ok: true,
        reportPath: result.reportPath,
        resourceKey: `impact-chapter-${String(body.fromChapter).padStart(3, "0")}.outline-patches.json`,
        suggestions: result.report.suggestions.length,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/role/apply-patches") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        fromChapter?: number;
        approver?: string;
        note?: string;
        filters?: unknown;
      };
      if (!body.projectId || !body.fromChapter || body.fromChapter < 1) {
        return jsonResponse(res, 400, { error: "projectId and fromChapter required" });
      }
      const result = await applyOutlinePatches({
        projectId: body.projectId,
        fromChapter: body.fromChapter,
        approver: body.approver,
        note: body.note,
        filters: normalizePatchFilters(body.filters),
      });
      return jsonResponse(res, 200, {
        ok: true,
        reportPath: result.applyReportPath,
        resourceKey: `impact-chapter-${String(body.fromChapter).padStart(3, "0")}.outline-patches.applied.json`,
        applied: result.report.applied.length,
        skipped: result.report.skipped.length,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/role/eval") {
      const body = (await parseBody(req)) as {
        projectId?: string;
      };
      if (!body.projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const result = await runRoleDrivenEval({
        projectId: body.projectId,
      });
      return jsonResponse(res, 200, {
        ok: true,
        reportPath: result.reportPath,
        resourceKey: "role-driven-eval-report",
        passedCases: result.report.passedCases,
        totalCases: result.report.totalCases,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/thread-board") {
      const projectId = url.searchParams.get("projectId")?.trim() ?? "";
      const chapterParam = url.searchParams.get("chapterNumber")?.trim() ?? "";
      if (!projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const chapterNumber = chapterParam ? Number(chapterParam) : 1;
      if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
        return jsonResponse(res, 400, { error: "chapterNumber must be >= 1" });
      }

      const inspect = await inspectNarrativeRuntime({ projectId });
      let board: Record<string, unknown> = {
        projectId,
        chapterNumber,
        contracts: inspect.contracts,
        threads: inspect.threads,
      };
      try {
        const ranking = await rankNarrativeRuntime({ projectId, chapterNumber });
        board.ranking = ranking.rankedThreads.map((item) => ({
          threadId: item.thread.id,
          threadType: item.thread.threadType,
          status: item.thread.currentStatus,
          score: item.score,
          reasons: item.reasons,
          warnings: item.warnings,
          breakdown: item.breakdown,
        }));
      } catch (error) {
        board.rankingError = error instanceof Error ? error.message : String(error);
      }
      try {
        const economy = await computeThreadEconomy({ projectId, chapterNumber });
        board.economy = economy.report;
      } catch (error) {
        board.economyError = error instanceof Error ? error.message : String(error);
      }
      try {
        const evalReport = await runThreadEval({ projectId, chapterNumber });
        board.eval = {
          passed: evalReport.passed,
          schedulerWarnings: evalReport.schedulerWarnings,
          economyWarnings: evalReport.economy.warnings,
        };
      } catch (error) {
        board.evalError = error instanceof Error ? error.message : String(error);
      }
      try {
        const suggest = await suggestNextThreadMoves({ projectId, chapterNumber });
        board.suggestNext = suggest;
      } catch (error) {
        board.suggestNextError = error instanceof Error ? error.message : String(error);
      }
      try {
        const offscreen = await inspectOffscreenMoves({ projectId, chapterNumber });
        board.offscreen = offscreen;
      } catch (error) {
        board.offscreenError = error instanceof Error ? error.message : String(error);
      }
      return jsonResponse(res, 200, board);
    }

    if (req.method === "GET" && url.pathname === "/api/outline/beats") {
      const projectId = url.searchParams.get("projectId")?.trim() ?? "";
      if (!projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const repository = new FileProjectRepository();
      const [arcs, beats] = await Promise.all([
        repository.loadArcOutlines(projectId),
        repository.loadBeatOutlines(projectId),
      ]);
      const generatedChapters = await listChapterNumbers(projectId);
      const generatedSet = new Set(generatedChapters);
      const beatStatus = beats.map((beat) => {
        const range = beat.chapterRangeHint;
        const expected = range
          ? Array.from(
              { length: Math.max(0, range.end - range.start + 1) },
              (_, i) => range.start + i,
            )
          : [];
        const generated = expected.filter((n) => generatedSet.has(n));
        return {
          beatId: beat.id,
          arcId: beat.arcId,
          order: beat.order,
          chapterRangeHint: range ?? null,
          expectedChapters: expected,
          generatedChapters: generated,
          allGenerated: expected.length > 0 && generated.length === expected.length,
          partiallyGenerated: generated.length > 0 && generated.length < expected.length,
          ungenerated: generated.length === 0,
          beatGoal: beat.beatGoal,
          conflict: beat.conflict,
          expectedChange: beat.expectedChange,
          decisionPressure: beat.decisionPressure ?? null,
          relationshipShift: beat.relationshipShift ?? null,
          requiredCharacters: beat.requiredCharacters,
          annotations: beat.annotations ?? null,
        };
      });
      return jsonResponse(res, 200, {
        ok: true,
        projectId,
        detailApproved: await isDetailApproved(projectId),
        arcs: arcs.map((arc: ArcOutline) => ({
          id: arc.id,
          name: arc.name,
          arcGoal: arc.arcGoal,
          beatIds: arc.beatIds,
          chapterRangeHint: arc.chapterRangeHint ?? null,
        })),
        beats: beatStatus,
        generatedChapters,
        allChapterShapes: ALL_CHAPTER_SHAPES,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/outline/beats") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        beatId?: string;
        updates?: Partial<BeatOutline>;
      };
      if (!body.projectId || !body.beatId || !body.updates) {
        return jsonResponse(res, 400, { error: "projectId, beatId, updates required" });
      }
      const repository = new FileProjectRepository();
      const beats = await repository.loadBeatOutlines(body.projectId);
      const idx = beats.findIndex((b) => b.id === body.beatId);
      if (idx < 0) {
        return jsonResponse(res, 404, { error: `beat not found: ${body.beatId}` });
      }
      // Validate annotation shape if present.
      if (body.updates.annotations?.shape && !isChapterShape(body.updates.annotations.shape)) {
        return jsonResponse(res, 400, {
          error: `Invalid annotations.shape "${body.updates.annotations.shape}". Allowed: ${ALL_CHAPTER_SHAPES.join(", ")}.`,
        });
      }
      const updated: BeatOutline = {
        ...beats[idx]!,
        ...body.updates,
        // preserve identity and arc binding regardless of payload
        id: beats[idx]!.id,
        arcId: beats[idx]!.arcId,
      };
      const next = beats.slice();
      next[idx] = updated;
      await repository.saveBeatOutlines(body.projectId, next);
      return jsonResponse(res, 200, { ok: true, beat: updated });
    }

    if (req.method === "POST" && url.pathname === "/api/outline/generate-chapter") {
      const body = (await parseBody(req)) as {
        projectId?: string;
        chapterNumber?: number;
      };
      if (!body.projectId || !body.chapterNumber || body.chapterNumber < 1) {
        return jsonResponse(res, 400, {
          error: "projectId and chapterNumber (>= 1) required",
        });
      }
      // Synchronous; the browser must keep the connection open.
      // Chapter generation typically takes 2-5 minutes per chapter.
      const result = await runV1({
        projectId: body.projectId,
        mode: "chapter",
        chapterNumber: body.chapterNumber,
      });
      const artifact = result.artifacts.find((a) => a.chapterNumber === body.chapterNumber);
      return jsonResponse(res, 200, {
        ok: true,
        projectId: body.projectId,
        chapterNumber: body.chapterNumber,
        generated: result.generatedChapterNumbers,
        title: artifact?.writerResult.title ?? null,
        chapterSummary: artifact?.memoryUpdate.chapterSummary ?? null,
        nextSituation: artifact?.memoryUpdate.nextSituation ?? null,
        validationIssues: result.validationIssues,
      });
    }

    return jsonResponse(res, 404, { error: "Not found" });
  } catch (error) {
    return jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[ui] running at http://${HOST}:${PORT}`);
});
