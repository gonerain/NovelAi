import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";

const PORT = Number(process.env.NOVELAI_UI_PORT ?? 3710);
const HOST = process.env.NOVELAI_UI_HOST ?? "127.0.0.1";

function projectRoot(projectId: string): string {
  return path.resolve(process.cwd(), "data", "projects", projectId);
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

function textResponse(res: http.ServerResponse, code: number, payload: string): void {
  res.statusCode = code;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(payload);
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

const UI_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NovelAI 编辑台</title>
  <style>
    body { font-family: -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f4f5f7; color: #111; }
    .top { padding: 12px 16px; background: #0f172a; color: #fff; display: flex; gap: 8px; align-items: center; }
    .top input, .top button, .top select { height: 32px; }
    .layout { display: grid; grid-template-columns: 280px 1fr 360px; gap: 10px; padding: 10px; height: calc(100vh - 56px); }
    .pane { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; overflow: auto; }
    .title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
    textarea { width: 100%; min-height: 68vh; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .small { font-size: 12px; color: #555; }
    .btns { display: flex; gap: 8px; margin-top: 8px; }
    .btn { padding: 6px 10px; border: 1px solid #bbb; background: #f8fafc; border-radius: 6px; cursor: pointer; }
    .btn.primary { background: #2563eb; color: #fff; border-color: #1d4ed8; }
    .field { margin-bottom: 8px; }
    .field input, .field textarea { width: 100%; box-sizing: border-box; }
    .char-card { border: 1px solid #ddd; border-radius: 6px; padding: 8px; margin-bottom: 8px; background: #fafafa; }
    .ok { color: #065f46; }
    .warn { color: #92400e; }
  </style>
</head>
<body>
  <div class="top">
    <strong>NovelAI 编辑台</strong>
    <span>项目:</span>
    <input id="projectId" value="demo-project" />
    <button id="loadProject">加载</button>
    <span id="approveStatus" class="small"></span>
  </div>
  <div class="layout">
    <div class="pane">
      <div class="title">资源</div>
      <select id="resourceSelect" size="20" style="width:100%;"></select>
      <div class="small" style="margin-top:8px;">支持：大纲/细纲/章节/世界观/记忆/角色</div>
    </div>
    <div class="pane">
      <div class="title">编辑器</div>
      <textarea id="editor"></textarea>
      <div class="btns">
        <button class="btn primary" id="saveBtn">保存</button>
        <button class="btn" id="reloadBtn">重载</button>
      </div>
    </div>
    <div class="pane">
      <div class="title">角色编辑（非程序员友好）</div>
      <div id="characterEditor" class="small">加载项目后可编辑角色核心字段。</div>
      <div class="btns">
        <button class="btn primary" id="saveCharacters">保存角色</button>
      </div>
      <hr />
      <div class="title">细纲审批</div>
      <div class="field"><input id="approver" placeholder="审批人" value="manual" /></div>
      <div class="field"><textarea id="approveNote" rows="3" placeholder="审批备注"></textarea></div>
      <button class="btn primary" id="approveBtn">通过细纲（Unlock章节生成）</button>
      <div id="msg" class="small" style="margin-top:8px;"></div>
    </div>
  </div>
<script>
  let currentProject = "demo-project";
  let currentKey = "";
  let characters = [];

  async function api(path, method = "GET", body) {
    const resp = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "request failed");
    return data;
  }

  function setMsg(text, ok = true) {
    const el = document.getElementById("msg");
    el.className = ok ? "small ok" : "small warn";
    el.textContent = text;
  }

  function renderResources(resources) {
    const sel = document.getElementById("resourceSelect");
    sel.innerHTML = "";
    for (const r of resources) {
      const opt = document.createElement("option");
      opt.value = r.key;
      opt.textContent = r.label;
      sel.appendChild(opt);
    }
    if (resources.length > 0) {
      sel.selectedIndex = 0;
      currentKey = resources[0].key;
    }
  }

  function renderCharacters() {
    const root = document.getElementById("characterEditor");
    if (!Array.isArray(characters) || characters.length === 0) {
      root.textContent = "未检测到角色数据。";
      return;
    }
    root.innerHTML = "";
    characters.forEach((c, idx) => {
      const box = document.createElement("div");
      box.className = "char-card";
      box.innerHTML = \`
        <div><strong>\${c.name || "角色"}</strong> (\${c.id || ""})</div>
        <div class="field"><label>原型</label><input data-idx="\${idx}" data-k="archetype" value="\${c.archetype || ""}" /></div>
        <div class="field"><label>当前目标（|分隔）</label><input data-idx="\${idx}" data-k="currentGoals" value="\${(c.currentGoals || []).join(" | ")}" /></div>
        <div class="field"><label>情绪状态（|分隔）</label><input data-idx="\${idx}" data-k="emotionalState" value="\${(c.emotionalState || []).join(" | ")}" /></div>
        <div class="field"><label>语气备注（|分隔）</label><input data-idx="\${idx}" data-k="voiceNotes" value="\${(c.voiceNotes || []).join(" | ")}" /></div>
      \`;
      root.appendChild(box);
    });

    root.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const t = e.target;
        const idx = Number(t.dataset.idx);
        const k = t.dataset.k;
        if (!characters[idx]) return;
        if (k === "currentGoals" || k === "emotionalState" || k === "voiceNotes") {
          characters[idx][k] = t.value.split("|").map(x => x.trim()).filter(Boolean);
        } else {
          characters[idx][k] = t.value;
        }
      });
    });
  }

  async function refreshProject() {
    currentProject = document.getElementById("projectId").value.trim();
    const data = await api(\`/api/project?projectId=\${encodeURIComponent(currentProject)}\`);
    renderResources(data.resources);
    document.getElementById("approveStatus").textContent = data.detailApproved ? "细纲审批: 已通过" : "细纲审批: 未通过";
    await loadCurrentResource();
    const c = await api(\`/api/characters?projectId=\${encodeURIComponent(currentProject)}\`);
    characters = c.characters;
    renderCharacters();
    setMsg("项目已加载");
  }

  async function loadCurrentResource() {
    const sel = document.getElementById("resourceSelect");
    currentKey = sel.value;
    if (!currentKey) return;
    const data = await api(\`/api/resource?projectId=\${encodeURIComponent(currentProject)}&key=\${encodeURIComponent(currentKey)}\`);
    document.getElementById("editor").value = data.content;
  }

  document.getElementById("resourceSelect").addEventListener("change", loadCurrentResource);
  document.getElementById("loadProject").addEventListener("click", () => refreshProject().catch((e) => setMsg(e.message, false)));
  document.getElementById("reloadBtn").addEventListener("click", () => loadCurrentResource().catch((e) => setMsg(e.message, false)));
  document.getElementById("saveBtn").addEventListener("click", async () => {
    try {
      await api("/api/resource", "POST", {
        projectId: currentProject,
        key: currentKey,
        content: document.getElementById("editor").value
      });
      setMsg("保存成功");
    } catch (e) {
      setMsg(e.message, false);
    }
  });
  document.getElementById("saveCharacters").addEventListener("click", async () => {
    try {
      await api("/api/characters", "POST", { projectId: currentProject, characters });
      setMsg("角色保存成功");
    } catch (e) {
      setMsg(e.message, false);
    }
  });
  document.getElementById("approveBtn").addEventListener("click", async () => {
    try {
      await api("/api/approve-detail", "POST", {
        projectId: currentProject,
        approver: document.getElementById("approver").value || "manual",
        note: document.getElementById("approveNote").value || ""
      });
      setMsg("细纲审批已通过");
      await refreshProject();
    } catch (e) {
      setMsg(e.message, false);
    }
  });

  refreshProject().catch((e) => setMsg(e.message, false));
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/") {
      return textResponse(res, 200, UI_HTML);
    }

    if (req.method === "GET" && url.pathname === "/api/project") {
      const projectId = url.searchParams.get("projectId")?.trim() ?? "";
      if (!projectId) {
        return jsonResponse(res, 400, { error: "projectId required" });
      }
      const chapters = await listChapterNumbers(projectId);
      const resources = [
        ...STATIC_RESOURCES.map((item) => ({ key: item.key, label: item.label })),
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
