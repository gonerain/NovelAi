import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";

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
  { key: "story-outline-md", label: "故事大纲 Markdown", type: "text", relativePath: "story-outline.md" },
  { key: "detailed-outline-md", label: "细纲 Markdown", type: "text", relativePath: "detailed-outline.md" },
];

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
