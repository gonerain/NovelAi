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
    "inspectConsequencesBtn",
    "suggestPatchesBtn",
    "applyPatchesBtn",
    "roleEvalBtn",
    "loadThreadBoardBtn",
    "loadOutlineBtn",
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
  if (k === "role-driven-eval-report") return "JSON";
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

function csvToList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function rolePatchPayload() {
  const fromChapter = Number(document.getElementById("roleFromChapter").value);
  return {
    projectId: currentProject,
    fromChapter,
    chapterNumber: fromChapter,
    approver: document.getElementById("approver").value.trim() || "manual",
    note: document.getElementById("approveNote").value.trim(),
    filters: {
      onlyBeatIds: csvToList(document.getElementById("roleOnlyBeat").value),
      skipBeatIds: csvToList(document.getElementById("roleSkipBeat").value),
      onlySuggestionTypes: csvToList(document.getElementById("roleOnlyType").value),
      skipSuggestionTypes: csvToList(document.getElementById("roleSkipType").value),
    },
  };
}

async function refreshAndOpenResource(resourceKey) {
  await refreshProject();
  if (resourceKey && resources.some((item) => item.key === resourceKey)) {
    currentKey = resourceKey;
    renderResources();
    await loadCurrentResource();
  }
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

function addKv(card, key, value) {
  const row = document.createElement("div");
  row.className = "friendly-kv";
  row.innerHTML = `<span class="friendly-k">${escapeHtml(key)}</span><span>${escapeHtml(primitiveValueToText(value))}</span>`;
  card.appendChild(row);
}

function addFriendlyCard(root, title, entries) {
  const card = document.createElement("div");
  card.className = "friendly-card";
  card.innerHTML = `<div class="small" style="margin-bottom:6px;"><strong>${escapeHtml(title)}</strong></div>`;
  entries.forEach(([key, value]) => addKv(card, key, value));
  root.appendChild(card);
  return card;
}

function renderRoleDrivenDecisionLog(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, `Chapter ${data.chapterNumber ?? "?"} Decision`, [
    ["beat", data.beatId ?? "-"],
    ["pressure", data.decisionPressure ?? "-"],
    ["choice", data.likelyChoice ?? "-"],
    ["immediate", data.immediateConsequence ?? "-"],
    ["delayed", data.delayedConsequence ?? "-"],
    ["relationship", data.relationshipShift ?? "-"],
    ["theme", data.themeShift ?? "-"],
  ]);
  (data.owners || []).forEach((owner) => {
    addFriendlyCard(root, `Owner: ${owner.name || owner.id}`, [
      ["desire", owner.coreDesire ?? "-"],
      ["fear", owner.coreFear ?? "-"],
      ["false belief", owner.falseBelief ?? "-"],
      ["evidence", (owner.evidenceSnippets || []).join(" | ") || "-"],
    ]);
  });
  if (data.reviewerAssessment) {
    addFriendlyCard(root, "Role Review", [
      ["findings", data.reviewerAssessment.findingCount ?? 0],
      ["notes", (data.reviewerAssessment.notes || []).join(" | ") || "-"],
    ]);
  }
}

function renderRoleDrivenConsequenceEdges(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, `Chapter ${data.chapterNumber ?? "?"} Consequence Graph`, [
    ["beat", data.beatId ?? "-"],
    ["edges", (data.edges || []).length],
  ]);
  (data.edges || []).forEach((edge, idx) => {
    addFriendlyCard(root, `Edge #${idx + 1}: ${edge.label || "edge"}`, [
      ["source", `${edge.sourceType || "?"}:${edge.sourceId || "?"}`],
      ["target", `${edge.targetType || "?"}:${edge.targetId || "?"}`],
      ["detail", edge.detail ?? "-"],
    ]);
  });
}

function renderRelationshipShift(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, `Chapter ${data.chapterNumber ?? "?"} Relationship Shift`, [
    ["beat", data.beatId ?? "-"],
    ["shift", data.shift ?? "-"],
    ["characters", (data.involvedCharacters || []).map((item) => item.name || item.id).join(" | ") || "-"],
    ["evidence", (data.evidenceSnippets || []).join(" | ") || "-"],
    ["risks", (data.reviewerRiskNotes || []).join(" | ") || "-"],
  ]);
}

function renderConsequenceInspection(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, `Chapter ${data.chapterNumber ?? "?"} Consequence Inspection`, [
    ["decision beat", data.decisionLog?.beatId ?? "-"],
    ["pressure", data.decisionLog?.decisionPressure ?? "-"],
    ["choice", data.decisionLog?.likelyChoice ?? "-"],
    ["unresolved", (data.unresolvedDelayedConsequences || []).join(" | ") || "-"],
  ]);
  (data.delayedConsequenceStatuses || []).forEach((item) => {
    addFriendlyCard(root, `Delayed Consequence: ${item.status}`, [
      ["source chapter", item.sourceChapterNumber],
      ["beat", item.sourceBeatId ?? "-"],
      ["consequence", item.consequence],
      ["evidence chapter", item.evidenceChapterNumber ?? "-"],
      ["evidence", (item.evidence || []).join(" | ") || "-"],
    ]);
  });
}

function renderOutlinePatchReport(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, `Outline Patch Suggestions from Chapter ${data.fromChapter ?? "?"}`, [
    ["generated", data.generatedAt ?? "-"],
    ["source status", data.sourceDelayedConsequenceStatus?.status ?? "-"],
    ["suggestions", (data.suggestions || []).length],
  ]);
  (data.suggestions || []).forEach((suggestion, idx) => {
    addFriendlyCard(root, `Suggestion #${idx + 1}: ${suggestion.beatId}`, [
      ["type", suggestion.suggestionType],
      ["reason", suggestion.reason],
      ["pressure", suggestion.suggestedPatch?.decisionPressure ?? "-"],
      ["delayed", suggestion.suggestedPatch?.delayedConsequence ?? "-"],
      ["relationship", suggestion.suggestedPatch?.relationshipShift ?? "-"],
      ["constraint", suggestion.suggestedPatch?.appendConstraint ?? "-"],
    ]);
  });
}

function renderPatchApplyReport(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, `Applied Outline Patches from Chapter ${data.fromChapter ?? "?"}`, [
    ["generated", data.generatedAt ?? "-"],
    ["approver", data.approver ?? "-"],
    ["note", data.note ?? "-"],
    ["applied", (data.applied || []).length],
    ["skipped", (data.skipped || []).length],
  ]);
  (data.applied || []).forEach((item, idx) => {
    addFriendlyCard(root, `Applied #${idx + 1}: ${item.beatId}`, [
      ["type", item.suggestionType],
      ["fields", (item.changedFields || []).join(" | ") || "-"],
      ["constraint", item.appendedConstraint ?? "-"],
    ]);
  });
  (data.skipped || []).forEach((item, idx) => {
    addFriendlyCard(root, `Skipped #${idx + 1}: ${item.beatId}`, [
      ["type", item.suggestionType],
      ["reason", item.reason],
    ]);
  });
}

function renderRoleDrivenEvalReport(root, data) {
  root.innerHTML = "";
  addFriendlyCard(root, "Role-Driven Eval", [
    ["generated", data.generatedAt ?? "-"],
    ["passed", `${data.passedCases ?? 0}/${data.totalCases ?? 0}`],
  ]);
  (data.caseTypeSummaries || []).forEach((summary) => {
    addFriendlyCard(root, `Case Type: ${summary.caseType}`, [
      ["passed", `${summary.passedCases}/${summary.totalCases}`],
      ["failed", summary.failedCases],
    ]);
  });
  (data.caseResults || [])
    .filter((item) => !item.passed)
    .slice(0, 12)
    .forEach((item) => {
      addFriendlyCard(root, `Failed: ch${item.chapterNumber} ${item.caseType}`, [
        ["label", item.label],
        ["evidence", (item.evidence || []).join(" | ") || "-"],
      ]);
    });
}

function tryRenderRoleDrivenView(root, data) {
  if (/decision-log$/.test(currentKey)) {
    renderRoleDrivenDecisionLog(root, data);
    return true;
  }
  if (/relationship-shift$/.test(currentKey)) {
    renderRelationshipShift(root, data);
    return true;
  }
  if (/consequence-edges$/.test(currentKey)) {
    renderRoleDrivenConsequenceEdges(root, data);
    return true;
  }
  if (/consequences\.json$/.test(currentKey)) {
    renderConsequenceInspection(root, data);
    return true;
  }
  if (/outline-patches\.json$/.test(currentKey)) {
    renderOutlinePatchReport(root, data);
    return true;
  }
  if (/outline-patches\.applied\.json$/.test(currentKey)) {
    renderPatchApplyReport(root, data);
    return true;
  }
  if (/role-driven-eval-report(?:\.json)?$/.test(currentKey)) {
    renderRoleDrivenEvalReport(root, data);
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
  if (tryRenderRoleDrivenView(root, data)) {
    return;
  }

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

document.getElementById("inspectConsequencesBtn").addEventListener("click", async () => {
  runAction(
    {
      loadingText: "正在检查角色驱动后果...",
      errorText: "检查失败",
    },
    async () => {
      const payload = rolePatchPayload();
      const result = await api("/api/role/inspect-consequences", "POST", payload);
      await refreshAndOpenResource(result.resourceKey);
      setMsg(`后果检查完成：unresolved=${result.unresolvedDelayedConsequences}`, "ok");
    },
  );
});

document.getElementById("suggestPatchesBtn").addEventListener("click", async () => {
  runAction(
    {
      loadingText: "正在生成补丁建议...",
      errorText: "生成补丁建议失败",
    },
    async () => {
      const result = await api("/api/role/suggest-patches", "POST", rolePatchPayload());
      await refreshAndOpenResource(result.resourceKey);
      setMsg(`补丁建议已生成：${result.suggestions} 条`, "ok");
    },
  );
});

document.getElementById("applyPatchesBtn").addEventListener("click", async () => {
  runAction(
    {
      loadingText: "正在应用补丁...",
      errorText: "应用补丁失败",
    },
    async () => {
      const result = await api("/api/role/apply-patches", "POST", rolePatchPayload());
      await refreshAndOpenResource(result.resourceKey);
      setMsg(`补丁应用完成：applied=${result.applied}, skipped=${result.skipped}`, "ok");
    },
  );
});

document.getElementById("roleEvalBtn").addEventListener("click", async () => {
  runAction(
    {
      loadingText: "正在运行 Role Eval...",
      errorText: "Role Eval 失败",
    },
    async () => {
      const result = await api("/api/role/eval", "POST", { projectId: currentProject });
      await refreshAndOpenResource(result.resourceKey);
      setMsg(`Role Eval 完成：${result.passedCases}/${result.totalCases} passed`, "ok");
    },
  );
});

function renderThreadBoardWarning(label, items) {
  if (!items || items.length === 0) {
    return "";
  }
  const lis = items
    .map(
      (item) =>
        `<li><span class="tag">${escapeHtml(item.code)}</span> <strong>${escapeHtml(item.threadId ?? "(global)")}</strong> — ${escapeHtml(item.message ?? "")}</li>`,
    )
    .join("");
  return `<div class="thread-board-block"><h4>${escapeHtml(label)}</h4><ul>${lis}</ul></div>`;
}

function renderThreadBoardRanking(ranking) {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return "";
  }
  const rows = ranking
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.threadId)}</td><td>${escapeHtml(item.threadType)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(String(item.score))}</td><td>${escapeHtml((item.warnings ?? []).join(" / "))}</td></tr>`,
    )
    .join("");
  return `<div class="thread-board-block"><h4>线程排名</h4><table class="thread-board-table"><thead><tr><th>id</th><th>type</th><th>status</th><th>score</th><th>warnings</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderThreadBoardEconomy(economy) {
  if (!economy || !Array.isArray(economy.entries)) {
    return "";
  }
  const rows = economy.entries
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.threadId)}</td><td>${escapeHtml(entry.status)}</td><td>${entry.currentAgeChapters}/${entry.expectedSpanChapters}</td><td>${entry.dormantChapters}/${entry.maxDormantChapters}</td><td>${entry.payoffWindowStart}-${entry.payoffWindowEnd}</td><td>${entry.payoffReadiness}</td><td>${entry.readerDebt}</td><td>${escapeHtml((entry.warnings ?? []).join(" / "))}</td></tr>`,
    )
    .join("");
  return `<div class="thread-board-block"><h4>线程经济报告（chapter ${economy.chapterNumber}）</h4><table class="thread-board-table"><thead><tr><th>id</th><th>status</th><th>age</th><th>dormant</th><th>payoff window</th><th>payoffReadiness</th><th>readerDebt</th><th>warnings</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderThreadBoardSuggestion(suggest) {
  if (!suggest) {
    return "";
  }
  const primary = suggest.primarySuggestion;
  const blockedItems = (suggest.blockedSuggestions ?? []).map(
    (item) =>
      `<li>${escapeHtml(item.threadId)} [${escapeHtml(item.status)}] — ${escapeHtml((item.warnings ?? []).join(" / "))}</li>`,
  );
  const supportingItems = (suggest.supportingSuggestions ?? []).map(
    (item) =>
      `<li>${escapeHtml(item.threadId)} → ${escapeHtml(item.suggestedMode)} / ${escapeHtml(item.suggestedPayoffType)}: ${escapeHtml(item.suggestedMove)}</li>`,
  );
  return `<div class="thread-board-block"><h4>下一步建议</h4>${
    primary
      ? `<p><strong>主线建议：</strong>${escapeHtml(primary.threadId)} → 模式 <em>${escapeHtml(primary.suggestedMode)}</em>，回报 <em>${escapeHtml(primary.suggestedPayoffType)}</em>；动作：${escapeHtml(primary.suggestedMove)}${primary.agencyRepairNeeded ? `<br/><span class="tag">agency repair</span> ${escapeHtml(primary.agencyRepairNote ?? "")}` : ""}</p>`
      : "<p>没有可用的主线建议（所有可选线程都被锁定）。</p>"
  }${supportingItems.length ? `<p><strong>支线建议：</strong></p><ul>${supportingItems.join("")}</ul>` : ""}${blockedItems.length ? `<p><strong>锁定线程：</strong></p><ul>${blockedItems.join("")}</ul>` : ""}${(suggest.notes ?? []).length ? `<p><strong>备注：</strong></p><ul>${suggest.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}</div>`;
}

function renderThreadBoardOffscreen(offscreen) {
  if (!offscreen) {
    return "";
  }
  const findings = offscreen.evalReport?.findings ?? [];
  const moves = offscreen.moves ?? [];
  const findingsBlock = findings.length
    ? `<ul>${findings
        .map(
          (finding) =>
            `<li><span class="tag">${escapeHtml(finding.code)}</span> <strong>${escapeHtml(finding.moveId)}</strong> — ${escapeHtml(finding.message)}</li>`,
        )
        .join("")}</ul>`
    : "<p>没有 findings。</p>";
  const movesBlock = moves.length
    ? `<table class="thread-board-table"><thead><tr><th>id</th><th>actor</th><th>type</th><th>visibility</th><th>scheduled</th><th>status</th></tr></thead><tbody>${moves
        .map(
          (move) =>
            `<tr><td>${escapeHtml(move.id)}</td><td>${escapeHtml(move.actorName)} (${escapeHtml(move.actorType)})</td><td>${escapeHtml(move.moveType)}</td><td>${escapeHtml(move.visibility)}</td><td>${move.scheduledChapter}</td><td>${escapeHtml(move.status)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  return `<div class="thread-board-block"><h4>幕后行动（offscreen）</h4>${findingsBlock}${movesBlock}</div>`;
}

function renderThreadBoardContracts(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return "";
  }
  const rows = contracts
    .map(
      (contract) =>
        `<tr><td>${escapeHtml(contract.id)}</td><td>${escapeHtml(contract.contractType)}</td><td>${escapeHtml(contract.priority)}</td><td>${escapeHtml(contract.status)}</td><td>${escapeHtml(contract.statement ?? "")}</td></tr>`,
    )
    .join("");
  return `<div class="thread-board-block"><h4>故事契约</h4><table class="thread-board-table"><thead><tr><th>id</th><th>type</th><th>priority</th><th>status</th><th>statement</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderThreadBoard(board) {
  const target = document.getElementById("threadBoardView");
  if (!board) {
    target.innerHTML = "";
    return;
  }
  const errorBanners = [];
  if (board.rankingError) {
    errorBanners.push(`<p class="status warn">排名失败：${escapeHtml(board.rankingError)}</p>`);
  }
  if (board.economyError) {
    errorBanners.push(`<p class="status warn">经济报告失败：${escapeHtml(board.economyError)}</p>`);
  }
  if (board.evalError) {
    errorBanners.push(`<p class="status warn">线程 Eval 失败：${escapeHtml(board.evalError)}</p>`);
  }
  if (board.suggestNextError) {
    errorBanners.push(`<p class="status warn">下一步建议失败：${escapeHtml(board.suggestNextError)}</p>`);
  }
  if (board.offscreenError) {
    errorBanners.push(`<p class="status warn">幕后行动失败：${escapeHtml(board.offscreenError)}</p>`);
  }
  const evalBlock = board.eval
    ? `<div class="thread-board-block"><h4>Thread Eval</h4><p>passed: <strong>${board.eval.passed ? "yes" : "no"}</strong></p>${renderThreadBoardWarning("Scheduler 警告", (board.eval.schedulerWarnings ?? []).map((entry) => ({ code: entry.warnings.join(" | "), threadId: entry.threadId, message: entry.reasons.join(" | ") })))}${renderThreadBoardWarning("Economy 警告", board.eval.economyWarnings ?? [])}</div>`
    : "";
  target.innerHTML = `
    <div class="thread-board-summary">
      <p>项目：<strong>${escapeHtml(board.projectId)}</strong> · 章节：<strong>${board.chapterNumber}</strong> · 线程总数：<strong>${(board.threads ?? []).length}</strong> · 契约总数：<strong>${(board.contracts ?? []).length}</strong></p>
    </div>
    ${errorBanners.join("")}
    ${renderThreadBoardRanking(board.ranking)}
    ${renderThreadBoardEconomy(board.economy)}
    ${evalBlock}
    ${renderThreadBoardSuggestion(board.suggestNext)}
    ${renderThreadBoardOffscreen(board.offscreen)}
    ${renderThreadBoardContracts(board.contracts)}
  `;
}

document.getElementById("loadThreadBoardBtn").addEventListener("click", () => {
  const chapter = Number(document.getElementById("threadBoardChapter").value);
  if (!Number.isFinite(chapter) || chapter < 1) {
    setMsg("Thread Board 需要 chapter >= 1", "warn");
    return;
  }
  runAction(
    {
      loadingText: "正在加载线程看板...",
      successText: "线程看板已加载",
      errorText: "加载线程看板失败",
    },
    async () => {
      const board = await api(
        `/api/thread-board?projectId=${encodeURIComponent(currentProject)}&chapterNumber=${chapter}`,
      );
      renderThreadBoard(board);
    },
  );
});

// ============================================================
// Outline Workbench
// ============================================================

let outlineState = null;
let outlineArcFilter = "";

function setOutlineStatus(text) {
  const el = document.getElementById("outlineStatus");
  if (el) {
    el.textContent = text;
  }
}

function renderOutlineArcFilter(arcs) {
  const select = document.getElementById("outlineArcFilter");
  if (!select) return;
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = `全部分卷（${arcs.length}）`;
  select.appendChild(allOption);
  for (const arc of arcs) {
    const option = document.createElement("option");
    option.value = arc.id;
    const range = arc.chapterRangeHint
      ? `ch${arc.chapterRangeHint.start}-${arc.chapterRangeHint.end}`
      : "";
    option.textContent = `${arc.name || arc.id}${range ? " · " + range : ""}`;
    select.appendChild(option);
  }
  select.value = outlineArcFilter;
  document.getElementById("outlineFilterRow").style.display = "";
}

function statusChip(beat) {
  if (beat.allGenerated) return `<span class="chip ok">已生成 ${beat.generatedChapters.join(",")}</span>`;
  if (beat.partiallyGenerated) {
    return `<span class="chip warn">部分生成 ${beat.generatedChapters.join(",")}/${beat.expectedChapters.join(",")}</span>`;
  }
  if (beat.expectedChapters.length > 0) {
    return `<span class="chip info">未生成 ch${beat.expectedChapters.join(",")}</span>`;
  }
  return `<span class="chip">无章节范围</span>`;
}

function shapeOptionsHtml(currentShape, allShapes) {
  const shapes = ["", ...allShapes];
  return shapes
    .map((shape) => {
      const label = shape || "(未设置)";
      const selected = (currentShape ?? "") === shape ? " selected" : "";
      return `<option value="${escapeHtml(shape)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderBeatCard(beat, allShapes) {
  const ann = beat.annotations || {};
  const annTextureMust = (ann.textureMust || []).join("\n");
  const annForbidden = (ann.forbiddenInBeat || []).join("\n");
  const annVoiceCues = (ann.voiceCues || [])
    .map((vc) => `${vc.characterId}: ${vc.cue}`)
    .join("\n");
  const range = beat.chapterRangeHint
    ? `ch${beat.chapterRangeHint.start}-${beat.chapterRangeHint.end}`
    : "无范围";
  const ungenChapters = beat.expectedChapters.filter(
    (n) => !beat.generatedChapters.includes(n),
  );
  const generateButtons = ungenChapters.length
    ? ungenChapters
        .map(
          (n) =>
            `<button class="generate-chapter-btn" data-chapter="${n}">生成 ch${n}</button>`,
        )
        .join("")
    : `<span class="small">所有章节已生成</span>`;
  return `
    <div class="beat-card" data-beat-id="${escapeHtml(beat.beatId)}" data-arc-id="${escapeHtml(beat.arcId)}">
      <div class="beat-card-head">
        <div>
          <strong>#${beat.order} · ${escapeHtml(beat.beatId)}</strong>
          <span class="small">${escapeHtml(range)}</span>
        </div>
        <div class="beat-card-status">${statusChip(beat)}</div>
      </div>
      <details>
        <summary>${escapeHtml((beat.beatGoal || "(no goal)").slice(0, 100))}</summary>
        <div class="beat-card-body">
          <div class="field">
            <label>Beat goal</label>
            <textarea class="bf bf-beatGoal" rows="2">${escapeHtml(beat.beatGoal || "")}</textarea>
          </div>
          <div class="field">
            <label>Conflict</label>
            <textarea class="bf bf-conflict" rows="2">${escapeHtml(beat.conflict || "")}</textarea>
          </div>
          <div class="field">
            <label>Expected change</label>
            <textarea class="bf bf-expectedChange" rows="2">${escapeHtml(beat.expectedChange || "")}</textarea>
          </div>
          <div class="field">
            <label>Decision pressure</label>
            <textarea class="bf bf-decisionPressure" rows="2">${escapeHtml(beat.decisionPressure || "")}</textarea>
          </div>
          <div class="field">
            <label>Relationship shift</label>
            <textarea class="bf bf-relationshipShift" rows="2">${escapeHtml(beat.relationshipShift || "")}</textarea>
          </div>
          <hr/>
          <p class="small"><strong>Humanistic 注解</strong>（写作时会被优先注入到 writer prompt）</p>
          <div class="field">
            <label>Shape</label>
            <select class="bf bf-shape">
              ${shapeOptionsHtml(ann.shape, allShapes)}
            </select>
          </div>
          <div class="field">
            <label>Subtext（POV 角色在这一段隐藏的东西）</label>
            <textarea class="bf bf-subtext" rows="2">${escapeHtml(ann.subtext || "")}</textarea>
          </div>
          <div class="field">
            <label>Texture must include（一行一项；具体感官/动作锚点）</label>
            <textarea class="bf bf-textureMust" rows="3" placeholder="例: 雨夜地铁广播&#10;她注意到他换了衣领">${escapeHtml(annTextureMust)}</textarea>
          </div>
          <div class="field">
            <label>Forbidden in beat（一行一项）</label>
            <textarea class="bf bf-forbiddenInBeat" rows="2">${escapeHtml(annForbidden)}</textarea>
          </div>
          <div class="field">
            <label>Voice cues（每行：characterId: cue）</label>
            <textarea class="bf bf-voiceCues" rows="2" placeholder="yejin: 回答关于自己的问题前总停两秒">${escapeHtml(annVoiceCues)}</textarea>
          </div>
          <div class="field">
            <label>Relationship moment（这一 beat 应留下的具体记忆）</label>
            <textarea class="bf bf-relationshipMoment" rows="2">${escapeHtml(ann.relationshipMoment || "")}</textarea>
          </div>
          <div class="field">
            <label>Continuation hook（带读者进下一章的钩子；可以很安静）</label>
            <textarea class="bf bf-continuationHook" rows="2">${escapeHtml(ann.continuationHook || "")}</textarea>
          </div>
          <div class="field">
            <label>Texture target chars（章节中文字符目标，可空）</label>
            <input type="number" min="0" class="bf bf-textureTargetChars" value="${ann.textureTargetChars ?? ""}" />
          </div>
          <div class="btn-row">
            <button class="save-beat-btn btn-primary">保存 beat</button>
            ${generateButtons}
          </div>
          <div class="beat-generation-output small" style="margin-top: 6px;"></div>
        </div>
      </details>
    </div>
  `;
}

function renderOutline() {
  const target = document.getElementById("outlineWorkbench");
  if (!target) return;
  if (!outlineState) {
    target.innerHTML = "";
    return;
  }
  const { arcs, beats, allChapterShapes, detailApproved } = outlineState;
  const filteredBeats = outlineArcFilter
    ? beats.filter((b) => b.arcId === outlineArcFilter)
    : beats;
  filteredBeats.sort((a, b) => a.order - b.order);
  const grouped = new Map();
  for (const beat of filteredBeats) {
    if (!grouped.has(beat.arcId)) grouped.set(beat.arcId, []);
    grouped.get(beat.arcId).push(beat);
  }
  const arcById = new Map(arcs.map((a) => [a.id, a]));
  const totalGenerated = beats.filter((b) => b.allGenerated).length;
  const partial = beats.filter((b) => b.partiallyGenerated).length;
  const ungen = beats.filter((b) => b.ungenerated).length;
  const summary = `<div class="outline-summary small">细纲审批: <strong>${detailApproved ? "已通过" : "未通过"}</strong> · 共 ${beats.length} beats（已生成 ${totalGenerated} · 部分 ${partial} · 未生成 ${ungen}）</div>`;
  const blocks = [];
  for (const [arcId, beatList] of grouped) {
    const arc = arcById.get(arcId);
    const arcLabel = arc ? `${arc.name || arc.id}（${arc.arcGoal || ""}）` : arcId;
    blocks.push(
      `<div class="arc-block"><h4>${escapeHtml(arcLabel)}</h4>${beatList.map((b) => renderBeatCard(b, allChapterShapes)).join("")}</div>`,
    );
  }
  target.innerHTML = summary + blocks.join("");
}

function readBeatCardFields(card) {
  const get = (cls) => {
    const el = card.querySelector("." + cls);
    if (!el) return undefined;
    return el.value;
  };
  const lines = (cls) =>
    String(get(cls) || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  const voiceCueLines = lines("bf-voiceCues").map((line) => {
    const [cid, ...rest] = line.split(":");
    return { characterId: (cid || "").trim(), cue: rest.join(":").trim() };
  }).filter((vc) => vc.characterId && vc.cue);
  const targetCharsRaw = get("bf-textureTargetChars");
  const targetChars = targetCharsRaw && Number(targetCharsRaw) > 0 ? Number(targetCharsRaw) : undefined;
  const annotations = {};
  const shape = get("bf-shape");
  if (shape) annotations.shape = shape;
  const subtext = (get("bf-subtext") || "").trim();
  if (subtext) annotations.subtext = subtext;
  const textureMust = lines("bf-textureMust");
  if (textureMust.length) annotations.textureMust = textureMust;
  const forbiddenInBeat = lines("bf-forbiddenInBeat");
  if (forbiddenInBeat.length) annotations.forbiddenInBeat = forbiddenInBeat;
  if (voiceCueLines.length) annotations.voiceCues = voiceCueLines;
  const relationshipMoment = (get("bf-relationshipMoment") || "").trim();
  if (relationshipMoment) annotations.relationshipMoment = relationshipMoment;
  const continuationHook = (get("bf-continuationHook") || "").trim();
  if (continuationHook) annotations.continuationHook = continuationHook;
  if (targetChars !== undefined) annotations.textureTargetChars = targetChars;
  const updates = {
    beatGoal: (get("bf-beatGoal") || "").trim(),
    conflict: (get("bf-conflict") || "").trim(),
    expectedChange: (get("bf-expectedChange") || "").trim(),
  };
  const decisionPressure = (get("bf-decisionPressure") || "").trim();
  if (decisionPressure) updates.decisionPressure = decisionPressure;
  const relationshipShift = (get("bf-relationshipShift") || "").trim();
  if (relationshipShift) updates.relationshipShift = relationshipShift;
  if (Object.keys(annotations).length > 0) {
    updates.annotations = annotations;
  }
  return updates;
}

async function saveBeat(beatId, card) {
  const updates = readBeatCardFields(card);
  await api("/api/outline/beats", "POST", {
    projectId: currentProject,
    beatId,
    updates,
  });
}

async function generateChapterFromBeat(card, chapterNumber) {
  const out = card.querySelector(".beat-generation-output");
  if (out) out.textContent = `正在生成 ch${chapterNumber}（可能需要 2-5 分钟）...`;
  const result = await api("/api/outline/generate-chapter", "POST", {
    projectId: currentProject,
    chapterNumber,
  });
  if (out) {
    const lines = [];
    lines.push(`✓ ch${chapterNumber} 生成完成 — ${result.title || "(无标题)"}`);
    if (result.chapterSummary) lines.push(`摘要: ${result.chapterSummary.slice(0, 200)}`);
    if (result.nextSituation) lines.push(`下一章准备: ${result.nextSituation.slice(0, 200)}`);
    out.textContent = lines.join("\n");
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.classList.contains("save-beat-btn")) {
    const card = target.closest(".beat-card");
    if (!card) return;
    const beatId = card.getAttribute("data-beat-id") || "";
    runAction(
      {
        loadingText: `正在保存 beat ${beatId}...`,
        successText: `Beat ${beatId} 已保存`,
        errorText: "保存 beat 失败",
      },
      async () => {
        await saveBeat(beatId, card);
        await loadOutline();
      },
    );
    return;
  }
  if (target.classList.contains("generate-chapter-btn")) {
    const card = target.closest(".beat-card");
    if (!card) return;
    const chapter = Number(target.getAttribute("data-chapter") || "0");
    if (!chapter) return;
    runAction(
      {
        loadingText: `正在生成章节 ${chapter}（这可能需要几分钟，请保持页面打开）...`,
        successText: `章节 ${chapter} 已生成`,
        errorText: "章节生成失败",
      },
      async () => {
        await generateChapterFromBeat(card, chapter);
        await loadOutline();
        await refreshProject();
      },
    );
    return;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "outlineArcFilter") {
    outlineArcFilter = target.value;
    renderOutline();
  }
});

async function loadOutline() {
  const data = await api(
    `/api/outline/beats?projectId=${encodeURIComponent(currentProject)}`,
  );
  outlineState = data;
  setOutlineStatus(`${data.beats.length} beats · ${data.detailApproved ? "已审批" : "未审批"}`);
  renderOutlineArcFilter(data.arcs);
  renderOutline();
}

document.getElementById("loadOutlineBtn").addEventListener("click", () => {
  runAction(
    {
      loadingText: "正在加载细纲...",
      successText: "细纲已加载",
      errorText: "加载细纲失败",
    },
    async () => {
      await loadOutline();
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
