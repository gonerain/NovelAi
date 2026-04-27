let currentProject = "demo_project";
let currentKey = "";
let characters = [];
let resources = [];
let activeActions = 0;
let viewMode = "auto";

async function api(path, method = "GET", body) {
  const resp = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "request failed");
  return data;
}

function setMsg(text, state = "ok") {
  const el = document.getElementById("msg");
  if (state === "warn") {
    el.className = "status warn";
  } else if (state === "info") {
    el.className = "status info";
  } else {
    el.className = "status ok";
  }
  el.textContent = text;
}

function setBusy(disabled) {
  const ids = [
    "createProject",
    "loadProject",
    "friendlyViewBtn",
    "rawViewBtn",
    "saveBtn",
    "reloadBtn",
    "formatBtn",
    "saveCharacters",
    "approveBtn",
  ];
  ids.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = disabled;
    }
  });
}

async function runAction(config, task) {
  const { loadingText, successText, errorText } = config;
  activeActions += 1;
  setBusy(true);
  setMsg(loadingText, "info");
  try {
    await task();
    if (successText) {
      setMsg(successText, "ok");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const prefix = errorText ? `${errorText}: ` : "";
    setMsg(`${prefix}${detail}`, "warn");
  } finally {
    activeActions = Math.max(0, activeActions - 1);
    if (activeActions === 0) {
      setBusy(false);
    }
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitPipe(value) {
  return String(value ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function resourceTypeFromKey(key) {
  const k = String(key || "").toLowerCase();
  if (k.endsWith("-json") || k.endsWith("-result")) return "JSON";
  if (k.includes("draft") || k.endsWith("-md")) return "MARKDOWN";
  return "TEXT";
}

function parseJsonSafe(raw) {
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function primitiveValueToText(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 6).map((item) => String(item)).join(" | ");
  }
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "object") {
    return "[复杂对象]";
  }
  return String(value);
}

function listToText(value) {
  return Array.isArray(value) ? value.join(" | ") : "";
}

function textToList(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createFriendlyField({ label, value, onInput, multiline = false, placeholder = "" }) {
  const field = document.createElement("div");
  field.className = "friendly-field";

  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  field.appendChild(labelEl);

  const control = multiline ? document.createElement("textarea") : document.createElement("input");
  control.className = "friendly-input";
  control.value = value ?? "";
  control.placeholder = placeholder;
  control.addEventListener("input", () => onInput(control.value));
  field.appendChild(control);

  return field;
}

function syncEditorFromStructuredData(data) {
  const editor = document.getElementById("editor");
  editor.value = `${JSON.stringify(data, null, 2)}\n`;
  updateEditorMeta();
}

function renderWorldFactsEditor(root, data) {
  root.innerHTML = "";

  const top = document.createElement("div");
  top.className = "friendly-toolbar";
  top.innerHTML = `<div class="small">世界规则共 ${data.length} 条（友好编辑模式）</div>`;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "新增规则";
  addBtn.addEventListener("click", () => {
    data.push({
      id: "",
      category: "global_rule",
      title: "",
      description: "",
      scope: "global",
      visibility: "hidden",
      relatedCharacterIds: [],
      relatedLocationIds: [],
    });
    syncEditorFromStructuredData(data);
    renderWorldFactsEditor(root, data);
  });
  top.appendChild(addBtn);
  root.appendChild(top);

  data.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "friendly-editor-card";

    const header = document.createElement("div");
    header.className = "friendly-card-header";
    header.innerHTML = `<strong>#${idx + 1} ${escapeHtml(item.title || item.id || "未命名规则")}</strong>`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", () => {
      data.splice(idx, 1);
      syncEditorFromStructuredData(data);
      renderWorldFactsEditor(root, data);
    });
    header.appendChild(removeBtn);
    card.appendChild(header);

    card.appendChild(
      createFriendlyField({
        label: "ID",
        value: item.id,
        onInput: (v) => {
          item.id = v;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "分类",
        value: item.category,
        onInput: (v) => {
          item.category = v;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "标题",
        value: item.title,
        onInput: (v) => {
          item.title = v;
          syncEditorFromStructuredData(data);
          header.querySelector("strong").textContent = `#${idx + 1} ${v || item.id || "未命名规则"}`;
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "描述",
        value: item.description,
        multiline: true,
        onInput: (v) => {
          item.description = v;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "范围（scope）",
        value: item.scope,
        onInput: (v) => {
          item.scope = v;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "可见性（visibility）",
        value: item.visibility,
        onInput: (v) => {
          item.visibility = v;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "关联角色（| 分隔）",
        value: listToText(item.relatedCharacterIds),
        onInput: (v) => {
          item.relatedCharacterIds = textToList(v);
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "关联地点（| 分隔）",
        value: listToText(item.relatedLocationIds),
        onInput: (v) => {
          item.relatedLocationIds = textToList(v);
          syncEditorFromStructuredData(data);
        },
      }),
    );

    root.appendChild(card);
  });
}

function renderStoryMemoriesEditor(root, data) {
  root.innerHTML = "";

  const top = document.createElement("div");
  top.className = "friendly-toolbar";
  top.innerHTML = `<div class="small">记忆条目共 ${data.length} 条（友好编辑模式）</div>`;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "新增记忆";
  addBtn.addEventListener("click", () => {
    data.push({
      id: "",
      kind: "event",
      title: "",
      summary: "",
      ownerCharacterId: "",
      relatedCharacterIds: [],
      relatedLocationIds: [],
      triggerConditions: [],
      introducedIn: 1,
      status: "active",
      priority: "medium",
      visibility: "private",
      notes: [],
    });
    syncEditorFromStructuredData(data);
    renderStoryMemoriesEditor(root, data);
  });
  top.appendChild(addBtn);
  root.appendChild(top);

  data.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "friendly-editor-card";

    const header = document.createElement("div");
    header.className = "friendly-card-header";
    header.innerHTML = `<strong>#${idx + 1} ${escapeHtml(item.title || item.id || "未命名记忆")}</strong>`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", () => {
      data.splice(idx, 1);
      syncEditorFromStructuredData(data);
      renderStoryMemoriesEditor(root, data);
    });
    header.appendChild(removeBtn);
    card.appendChild(header);

    const fields = [
      ["ID", "id"],
      ["类型（kind）", "kind"],
      ["标题", "title"],
      ["归属角色（ownerCharacterId）", "ownerCharacterId"],
      ["状态（status）", "status"],
      ["优先级（priority）", "priority"],
      ["可见性（visibility）", "visibility"],
    ];

    fields.forEach(([label, key]) => {
      card.appendChild(
        createFriendlyField({
          label,
          value: item[key],
          onInput: (v) => {
            item[key] = v;
            if (key === "title") {
              header.querySelector("strong").textContent = `#${idx + 1} ${v || item.id || "未命名记忆"}`;
            }
            syncEditorFromStructuredData(data);
          },
        }),
      );
    });

    card.appendChild(
      createFriendlyField({
        label: "简介（summary）",
        value: item.summary,
        multiline: true,
        onInput: (v) => {
          item.summary = v;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "引入章节（introducedIn）",
        value: String(item.introducedIn ?? 1),
        onInput: (v) => {
          const n = Number(v);
          item.introducedIn = Number.isFinite(n) ? n : 1;
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "关联角色（| 分隔）",
        value: listToText(item.relatedCharacterIds),
        onInput: (v) => {
          item.relatedCharacterIds = textToList(v);
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "关联地点（| 分隔）",
        value: listToText(item.relatedLocationIds),
        onInput: (v) => {
          item.relatedLocationIds = textToList(v);
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "触发条件（| 分隔）",
        value: listToText(item.triggerConditions),
        multiline: true,
        onInput: (v) => {
          item.triggerConditions = textToList(v);
          syncEditorFromStructuredData(data);
        },
      }),
    );
    card.appendChild(
      createFriendlyField({
        label: "备注（| 分隔）",
        value: listToText(item.notes),
        multiline: true,
        onInput: (v) => {
          item.notes = textToList(v);
          syncEditorFromStructuredData(data);
        },
      }),
    );

    root.appendChild(card);
  });
}

function tryRenderStructuredEditor(root, content) {
  const parsed = parseJsonSafe(content);
  if (!parsed.ok) {
    return false;
  }
  if (!Array.isArray(parsed.data)) {
    return false;
  }

  if (currentKey === "world-facts-json") {
    renderWorldFactsEditor(root, parsed.data);
    return true;
  }
  if (currentKey === "story-memories-json") {
    renderStoryMemoriesEditor(root, parsed.data);
    return true;
  }
  return false;
}

function renderFriendlyJsonView(content) {
  const root = document.getElementById("friendlyView");
  if (tryRenderStructuredEditor(root, content)) {
    return;
  }
  const parsed = parseJsonSafe(content);
  if (!parsed.ok) {
    root.innerHTML = `<div class="small warn">JSON 解析失败：${escapeHtml(parsed.message || "unknown")}</div>`;
    return;
  }

  const data = parsed.data;
  if (Array.isArray(data)) {
    const total = data.length;
    const sample = data.slice(0, 12);
    root.innerHTML = `<div class="small">数组资源，共 ${total} 条。当前展示前 ${sample.length} 条摘要。</div>`;
    sample.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "friendly-card";
      card.innerHTML = `<div class="small" style="margin-bottom:6px;">#${idx + 1}</div>`;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const keys = Object.keys(item).slice(0, 8);
        keys.forEach((k) => {
          const row = document.createElement("div");
          row.className = "friendly-kv";
          row.innerHTML = `<span class="friendly-k">${escapeHtml(k)}</span><span>${escapeHtml(primitiveValueToText(item[k]))}</span>`;
          card.appendChild(row);
        });
      } else {
        const row = document.createElement("div");
        row.className = "friendly-kv";
        row.innerHTML = `<span class="friendly-k">value</span><span>${escapeHtml(primitiveValueToText(item))}</span>`;
        card.appendChild(row);
      }
      root.appendChild(card);
    });
    return;
  }

  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    root.innerHTML = `<div class="small">对象资源，共 ${keys.length} 个字段。</div>`;
    keys.slice(0, 20).forEach((k) => {
      const card = document.createElement("div");
      card.className = "friendly-card";
      const row = document.createElement("div");
      row.className = "friendly-kv";
      row.innerHTML = `<span class="friendly-k">${escapeHtml(k)}</span><span>${escapeHtml(primitiveValueToText(data[k]))}</span>`;
      card.appendChild(row);
      root.appendChild(card);
    });
    return;
  }

  root.innerHTML = `<div class="friendly-card"><div class="friendly-kv"><span class="friendly-k">value</span><span>${escapeHtml(primitiveValueToText(data))}</span></div></div>`;
}

function effectiveViewMode() {
  if (viewMode === "raw" || viewMode === "friendly") {
    return viewMode;
  }
  return resourceTypeFromKey(currentKey) === "JSON" ? "friendly" : "raw";
}

function syncViewModeUI() {
  const mode = effectiveViewMode();
  const isRaw = mode === "raw";
  const editor = document.getElementById("editor");
  const friendly = document.getElementById("friendlyView");
  const friendlyBtn = document.getElementById("friendlyViewBtn");
  const rawBtn = document.getElementById("rawViewBtn");

  if (isRaw) {
    editor.classList.remove("hidden");
    friendly.classList.add("hidden");
    rawBtn.classList.add("btn-primary");
    friendlyBtn.classList.remove("btn-primary");
  } else {
    editor.classList.add("hidden");
    friendly.classList.remove("hidden");
    friendlyBtn.classList.add("btn-primary");
    rawBtn.classList.remove("btn-primary");
    renderFriendlyJsonView(editor.value);
  }
}

function updateEditorMeta() {
  const content = document.getElementById("editor").value;
  const lines = content === "" ? 0 : content.split("\n").length;
  document.getElementById("editorMeta").textContent = `${lines} 行 · ${content.length} 字符`;
}

function updateProjectMeta() {
  document.getElementById("currentProjectMeta").textContent = `项目: ${currentProject}`;
}

function renderResources() {
  const keyword = document.getElementById("resourceSearch").value.trim().toLowerCase();
  const list = document.getElementById("resourceList");
  const filtered = resources.filter((item) => {
    if (!keyword) return true;
    return item.label.toLowerCase().includes(keyword) || item.key.toLowerCase().includes(keyword);
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="small">没有匹配资源</div>';
    return;
  }

  list.innerHTML = "";
  filtered.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = `resource-item${item.key === currentKey ? " active" : ""}`;
    btn.type = "button";
    btn.innerHTML =
      `<span class="resource-name">${escapeHtml(item.label)}</span>` +
      `<span class="resource-meta"><span>${escapeHtml(item.key)}</span><span class="tag">${resourceTypeFromKey(item.key)}</span></span>`;
    btn.addEventListener("click", () => {
      if (currentKey !== item.key) {
        currentKey = item.key;
        renderResources();
        loadCurrentResource().catch((e) => setMsg(e.message, false));
      }
    });
    list.appendChild(btn);
  });

  document.getElementById("resourceHint").textContent = `共 ${filtered.length} 个资源`;
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
    box.innerHTML = `
      <div class="char-title">
        <span class="char-name">${escapeHtml(c.name || "角色")}</span>
        <span class="char-id">${escapeHtml(c.id || "")}</span>
      </div>
      <div class="field"><label>原型</label><input data-idx="${idx}" data-k="archetype" value="${escapeHtml(c.archetype || "")}" /></div>
      <div class="field"><label>当前目标（|分隔）</label><input data-idx="${idx}" data-k="currentGoals" value="${escapeHtml((c.currentGoals || []).join(" | "))}" /></div>
      <div class="field"><label>情绪状态（|分隔）</label><input data-idx="${idx}" data-k="emotionalState" value="${escapeHtml((c.emotionalState || []).join(" | "))}" /></div>
      <div class="field"><label>语气备注（|分隔）</label><input data-idx="${idx}" data-k="voiceNotes" value="${escapeHtml((c.voiceNotes || []).join(" | "))}" /></div>
      <div class="field"><label>Decision / Core Desire</label><input data-idx="${idx}" data-k="decisionProfile.coreDesire" value="${escapeHtml(c.decisionProfile?.coreDesire || "")}" /></div>
      <div class="field"><label>Decision / Core Fear</label><input data-idx="${idx}" data-k="decisionProfile.coreFear" value="${escapeHtml(c.decisionProfile?.coreFear || "")}" /></div>
      <div class="field"><label>Decision / False Belief</label><input data-idx="${idx}" data-k="decisionProfile.falseBelief" value="${escapeHtml(c.decisionProfile?.falseBelief || "")}" /></div>
      <div class="field"><label>Decision / Coping Style</label><textarea data-idx="${idx}" data-k="decisionProfile.defaultCopingStyle">${escapeHtml(c.decisionProfile?.defaultCopingStyle || "")}</textarea></div>
      <div class="field"><label>Decision / Control Pattern</label><textarea data-idx="${idx}" data-k="decisionProfile.controlPattern">${escapeHtml(c.decisionProfile?.controlPattern || "")}</textarea></div>
      <div class="field"><label>Decision / Unacceptable Costs（|分隔）</label><textarea data-idx="${idx}" data-k="decisionProfile.unacceptableCosts">${escapeHtml((c.decisionProfile?.unacceptableCosts || []).join(" | "))}</textarea></div>
      <div class="field"><label>Decision / Likely Compromises（|分隔）</label><textarea data-idx="${idx}" data-k="decisionProfile.likelyCompromises">${escapeHtml((c.decisionProfile?.likelyCompromises || []).join(" | "))}</textarea></div>
      <div class="field"><label>Decision / Relationship Soft Spots（|分隔）</label><textarea data-idx="${idx}" data-k="decisionProfile.relationshipSoftSpots">${escapeHtml((c.decisionProfile?.relationshipSoftSpots || []).join(" | "))}</textarea></div>
      <div class="field"><label>Decision / Break Thresholds（|分隔）</label><textarea data-idx="${idx}" data-k="decisionProfile.breakThresholds">${escapeHtml((c.decisionProfile?.breakThresholds || []).join(" | "))}</textarea></div>
    `;
    root.appendChild(box);
  });

  root.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("change", (e) => {
      const t = e.target;
      const idx = Number(t.dataset.idx);
      const k = t.dataset.k;
      if (!characters[idx]) return;
      if (k.startsWith("decisionProfile.")) {
        const nestedKey = k.replace("decisionProfile.", "");
        if (!characters[idx].decisionProfile) {
          characters[idx].decisionProfile = {
            coreDesire: "",
            coreFear: "",
            falseBelief: "",
            defaultCopingStyle: "",
            controlPattern: "",
            unacceptableCosts: [],
            likelyCompromises: [],
            relationshipSoftSpots: [],
            breakThresholds: [],
          };
        }
        if (
          nestedKey === "unacceptableCosts" ||
          nestedKey === "likelyCompromises" ||
          nestedKey === "relationshipSoftSpots" ||
          nestedKey === "breakThresholds"
        ) {
          characters[idx].decisionProfile[nestedKey] = splitPipe(t.value);
        } else {
          characters[idx].decisionProfile[nestedKey] = t.value;
        }
      } else if (k === "currentGoals" || k === "emotionalState" || k === "voiceNotes") {
        characters[idx][k] = splitPipe(t.value);
      } else {
        characters[idx][k] = t.value;
      }
    });
  });
}

async function refreshProject() {
  currentProject = document.getElementById("projectId").value.trim();
  if (!currentProject) throw new Error("projectId required");

  updateProjectMeta();
  const data = await api(`/api/project?projectId=${encodeURIComponent(currentProject)}`);
  resources = data.resources || [];
  if (!resources.some((item) => item.key === currentKey)) {
    currentKey = resources[0] ? resources[0].key : "";
  }
  renderResources();

  const approveStatus = document.getElementById("approveStatus");
  approveStatus.textContent = data.detailApproved ? "细纲审批: 已通过" : "细纲审批: 未通过";

  await loadCurrentResource();
  const c = await api(`/api/characters?projectId=${encodeURIComponent(currentProject)}`);
  characters = c.characters;
  renderCharacters();
}

async function loadCurrentResource() {
  if (!currentKey) {
    document.getElementById("editor").value = "";
    document.getElementById("editorTitle").textContent = "编辑器";
    document.getElementById("resourceTypeTag").textContent = "TEXT";
    updateEditorMeta();
    return;
  }

  const data = await api(`/api/resource?projectId=${encodeURIComponent(currentProject)}&key=${encodeURIComponent(currentKey)}`);
  const editor = document.getElementById("editor");
  editor.value = data.content;
  const selected = resources.find((item) => item.key === currentKey);
  document.getElementById("editorTitle").textContent = selected ? selected.label : currentKey;
  document.getElementById("resourceTypeTag").textContent = resourceTypeFromKey(currentKey);
  viewMode = "auto";
  syncViewModeUI();
  updateEditorMeta();
}

document.getElementById("resourceSearch").addEventListener("input", renderResources);
document.getElementById("editor").addEventListener("input", updateEditorMeta);
document.getElementById("friendlyViewBtn").addEventListener("click", () => {
  viewMode = "friendly";
  syncViewModeUI();
});
document.getElementById("rawViewBtn").addEventListener("click", () => {
  viewMode = "raw";
  syncViewModeUI();
});

document.getElementById("createProject").addEventListener("click", () => {
  const projectId = document.getElementById("projectId").value.trim();
  const templateProjectId = document.getElementById("templateProjectId").value.trim() || "demo_project";
  runAction(
    {
      loadingText: "正在创建项目...",
      successText: "项目创建成功并已加载",
      errorText: "创建失败",
    },
    async () => {
      if (!projectId) {
        throw new Error("projectId required");
      }
      await api("/api/project/create", "POST", { projectId, templateProjectId });
      await refreshProject();
    },
  );
});

document.getElementById("loadProject").addEventListener("click", () => {
  runAction(
    {
      loadingText: "正在加载项目...",
      successText: "项目已加载",
      errorText: "加载失败",
    },
    async () => {
      await refreshProject();
    },
  );
});

document.getElementById("reloadBtn").addEventListener("click", () => {
  if (!currentKey) {
    setMsg("请先选择资源再重载", "warn");
    return;
  }
  runAction(
    {
      loadingText: "正在重载资源...",
      successText: "内容已重载",
      errorText: "重载失败",
    },
    async () => {
      await loadCurrentResource();
    },
  );
});

document.getElementById("formatBtn").addEventListener("click", () => {
  const editor = document.getElementById("editor");
  try {
    const parsed = JSON.parse(editor.value);
    editor.value = `${JSON.stringify(parsed, null, 2)}\n`;
    updateEditorMeta();
    if (effectiveViewMode() === "friendly") {
      renderFriendlyJsonView(editor.value);
    }
    setMsg("JSON 格式化完成", "ok");
  } catch {
    setMsg("当前内容不是合法 JSON，无法格式化", "warn");
  }
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!currentKey) {
    setMsg("请先选择要保存的资源", "warn");
    return;
  }
  runAction(
    {
      loadingText: "正在保存资源...",
      successText: "资源保存成功",
      errorText: "保存失败",
    },
    async () => {
      await api("/api/resource", "POST", {
        projectId: currentProject,
        key: currentKey,
        content: document.getElementById("editor").value,
      });
      if (effectiveViewMode() === "friendly") {
        renderFriendlyJsonView(document.getElementById("editor").value);
      }
    },
  );
});

document.getElementById("saveCharacters").addEventListener("click", async () => {
  runAction(
    {
      loadingText: "正在保存角色...",
      successText: "角色保存成功",
      errorText: "角色保存失败",
    },
    async () => {
      await api("/api/characters", "POST", { projectId: currentProject, characters });
    },
  );
});

document.getElementById("approveBtn").addEventListener("click", async () => {
  runAction(
    {
      loadingText: "正在提交细纲审批...",
      successText: "细纲审批已通过",
      errorText: "审批失败",
    },
    async () => {
      await api("/api/approve-detail", "POST", {
        projectId: currentProject,
        approver: document.getElementById("approver").value || "manual",
        note: document.getElementById("approveNote").value || "",
      });
      await refreshProject();
    },
  );
});

runAction(
  {
    loadingText: "正在初始化项目...",
    successText: "项目已加载",
    errorText: "初始化失败",
  },
  async () => {
    await refreshProject();
  },
);
