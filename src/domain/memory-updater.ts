import type { ChapterPlan, EntityId, MemoryStatus, StoryMemory } from "./types.js";

export interface MemoryUpdaterInput {
  chapterNumber: number;
  chapterPlan: ChapterPlan;
  draft: string;
  storyMemories: StoryMemory[];
  activeCharacterIds: EntityId[];
}

export interface MemoryUpdatePatch {
  memoryId: EntityId;
  action: Extract<MemoryStatus, "triggered" | "resolved" | "expired" | "consumed" | "hidden">;
  reason: string;
  notes: string[];
}

export interface NewMemoryDraft {
  title: string;
  summary: string;
  kind: StoryMemory["kind"];
  ownerCharacterId?: EntityId;
  relatedCharacterIds: EntityId[];
  relatedLocationIds: EntityId[];
  triggerConditions: string[];
  status: StoryMemory["status"];
  priority: StoryMemory["priority"];
  visibility: StoryMemory["visibility"];
  notes: string[];
}

export interface MemoryUpdaterResult {
  chapterSummary: string;
  nextSituation: string;
  memoryPatches: MemoryUpdatePatch[];
  newMemories: NewMemoryDraft[];
  carryForwardHints: string[];
}

export interface MemoryUpdaterValidationResult {
  sanitized: MemoryUpdaterResult;
  warnings: MemoryWritebackWarning[];
  evidenceChecks: MemoryUpdaterEvidenceCheck[];
  consistencyChecks: MemoryUpdaterConsistencyCheck[];
}

export type MemoryWritebackWarningType =
  | "contradiction"
  | "unsupported"
  | "overgeneralized";

export interface MemoryWritebackWarning {
  type: MemoryWritebackWarningType;
  targetType: "memory_patch" | "new_memory" | "carry_forward_hint" | "summary";
  targetLabel: string;
  detail: string;
}

export interface MemoryUpdaterEvidenceCheck {
  targetType: "chapter_summary" | "next_situation" | "memory_patch" | "new_memory";
  targetLabel: string;
  status: "supported" | "weak" | "missing";
  matchedSnippets: string[];
}

export interface MemoryUpdaterConsistencyCheck {
  targetType: "memory_patch" | "new_memory" | "carry_forward_hint";
  targetLabel: string;
  severity: "info" | "warning";
  detail: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function uniqueTrimmed(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function uniqueWarnings(
  items: MemoryWritebackWarning[],
  limit: number,
): MemoryWritebackWarning[] {
  const seen = new Set<string>();
  const result: MemoryWritebackWarning[] = [];

  for (const item of items) {
    const key = `${item.type}|${item.targetType}|${item.targetLabel}|${item.detail}`.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function pushWarning(
  warnings: MemoryWritebackWarning[],
  warning: MemoryWritebackWarning,
): void {
  warnings.push({
    ...warning,
    targetLabel: warning.targetLabel.trim(),
    detail: warning.detail.trim(),
  });
}

export function validateMemoryUpdaterResult(args: {
  result: MemoryUpdaterResult;
  existingMemories: StoryMemory[];
  chapterPlan: ChapterPlan;
  activeCharacterIds: EntityId[];
  draft: string;
}): MemoryUpdaterValidationResult {
  const warnings: MemoryWritebackWarning[] = [];
  const evidenceChecks: MemoryUpdaterEvidenceCheck[] = [];
  const consistencyChecks: MemoryUpdaterConsistencyCheck[] = [];
  const existingMemoryIds = new Set(args.existingMemories.map((memory) => memory.id));
  const existingMemoryMap = new Map(args.existingMemories.map((memory) => [memory.id, memory] as const));
  const characterIds = new Set<EntityId>();
  for (const memory of args.existingMemories) {
    if (memory.ownerCharacterId) {
      characterIds.add(memory.ownerCharacterId);
    }
    for (const id of memory.relatedCharacterIds) {
      characterIds.add(id);
    }
  }
  for (const id of args.chapterPlan.requiredCharacters) {
    characterIds.add(id);
  }
  for (const id of args.activeCharacterIds) {
    characterIds.add(id);
  }

  const patchById = new Map<EntityId, MemoryUpdatePatch>();
  for (const patch of args.result.memoryPatches) {
    if (!existingMemoryIds.has(patch.memoryId)) {
      pushWarning(warnings, {
        type: "contradiction",
        targetType: "memory_patch",
        targetLabel: patch.memoryId,
        detail: `Dropped memory patch for unknown memory id: ${patch.memoryId}`,
      });
      continue;
    }
    if (patchById.has(patch.memoryId)) {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "memory_patch",
        targetLabel: patch.memoryId,
        detail: `Collapsed duplicate memory patch for memory id: ${patch.memoryId}`,
      });
    }
    patchById.set(patch.memoryId, {
      memoryId: patch.memoryId,
      action: patch.action,
      reason: patch.reason.trim() || `Chapter ${args.chapterPlan.chapterNumber ?? "?"} update`,
      notes: uniqueTrimmed(patch.notes, 6),
    });
  }

  const newMemories: NewMemoryDraft[] = [];
  const seenNewMemorySignatures = new Set<string>();
  for (const memory of args.result.newMemories) {
    const title = memory.title.trim();
    const summary = memory.summary.trim();
    if (!title || !summary) {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: title || "(untitled memory)",
        detail: "Dropped new memory with empty title or summary.",
      });
      continue;
    }

    const signature = `${memory.kind}|${title.toLowerCase()}|${summary.toLowerCase()}`;
    if (seenNewMemorySignatures.has(signature)) {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: title,
        detail: `Dropped duplicate new memory draft: ${title}`,
      });
      continue;
    }
    seenNewMemorySignatures.add(signature);

    const ownerCharacterId =
      memory.ownerCharacterId && characterIds.has(memory.ownerCharacterId)
        ? memory.ownerCharacterId
        : undefined;
    if (memory.ownerCharacterId && !ownerCharacterId) {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: title,
        detail: `Removed unknown ownerCharacterId from new memory: ${title}`,
      });
    }

    const relatedCharacterIds = uniqueTrimmed(
      memory.relatedCharacterIds.filter((id) => characterIds.has(id)),
      8,
    );
    const droppedCharacterIds = memory.relatedCharacterIds.filter((id) => !characterIds.has(id));
    if (droppedCharacterIds.length > 0) {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: title,
        detail: `Removed unknown relatedCharacterIds from new memory ${title}: ${droppedCharacterIds.join(", ")}`,
      });
    }

    newMemories.push({
      title,
      summary,
      kind: memory.kind,
      ownerCharacterId,
      relatedCharacterIds,
      relatedLocationIds: uniqueTrimmed(memory.relatedLocationIds, 6),
      triggerConditions: uniqueTrimmed(memory.triggerConditions, 4),
      status: memory.status,
      priority: memory.priority,
      visibility: memory.visibility,
      notes: uniqueTrimmed(memory.notes, 8),
    });
  }

  const sanitized: MemoryUpdaterResult = {
    chapterSummary: args.result.chapterSummary.trim(),
    nextSituation: args.result.nextSituation.trim(),
    memoryPatches: [...patchById.values()],
    newMemories,
    carryForwardHints: uniqueTrimmed(args.result.carryForwardHints, 6),
  };

  evidenceChecks.push(
    buildEvidenceCheck({
      draft: args.draft,
      targetType: "chapter_summary",
      targetLabel: "chapterSummary",
      text: sanitized.chapterSummary,
    }),
  );
  evidenceChecks.push(
    buildEvidenceCheck({
      draft: args.draft,
      targetType: "next_situation",
      targetLabel: "nextSituation",
      text: sanitized.nextSituation,
    }),
  );

  for (const patch of sanitized.memoryPatches) {
    const memory = existingMemoryMap.get(patch.memoryId);
    const check = buildEvidenceCheck({
      draft: args.draft,
      targetType: "memory_patch",
      targetLabel: patch.memoryId,
      text: [memory?.title ?? "", memory?.summary ?? "", patch.reason, ...patch.notes].join(" "),
    });
    evidenceChecks.push(check);
    if (check.status === "missing") {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "memory_patch",
        targetLabel: patch.memoryId,
        detail: `Memory patch lacks draft evidence: ${patch.memoryId}`,
      });
    }
    if (memory) {
      const transitionWarning = validateMemoryStatusTransition(memory, patch);
      if (transitionWarning) {
        pushWarning(warnings, {
          type: "contradiction",
          targetType: "memory_patch",
          targetLabel: patch.memoryId,
          detail: transitionWarning,
        });
        consistencyChecks.push({
          targetType: "memory_patch",
          targetLabel: patch.memoryId,
          severity: "warning",
          detail: transitionWarning,
        });
      }
    }
    const overgeneralizedWarning = detectOvergeneralizedPatch({
      patch,
      memory,
      evidenceCheck: check,
    });
    if (overgeneralizedWarning) {
      pushWarning(warnings, overgeneralizedWarning);
      consistencyChecks.push({
        targetType: "memory_patch",
        targetLabel: patch.memoryId,
        severity: "warning",
        detail: overgeneralizedWarning.detail,
      });
    }
    if (check.status === "weak") {
      consistencyChecks.push({
        targetType: "memory_patch",
        targetLabel: patch.memoryId,
        severity: "warning",
        detail: `Patch only has weak draft evidence for ${patch.memoryId}.`,
      });
    }
  }

  for (const memory of sanitized.newMemories) {
    const check = buildEvidenceCheck({
      draft: args.draft,
      targetType: "new_memory",
      targetLabel: memory.title,
      text: [memory.title, memory.summary, ...memory.notes].join(" "),
    });
    evidenceChecks.push(check);
    if (check.status === "missing") {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: memory.title,
        detail: `New memory lacks draft evidence: ${memory.title}`,
      });
    }
    if (check.status === "weak") {
      consistencyChecks.push({
        targetType: "new_memory",
        targetLabel: memory.title,
        severity: "warning",
        detail: `New memory only has weak draft evidence: ${memory.title}`,
      });
    }

    const duplicate = findNearDuplicateMemory(memory, args.existingMemories);
    if (duplicate) {
      const detail = `New memory may duplicate existing memory ${duplicate.id} (${duplicate.title}).`;
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: memory.title,
        detail,
      });
      consistencyChecks.push({
        targetType: "new_memory",
        targetLabel: memory.title,
        severity: "warning",
        detail,
      });
    }

    const overgeneralizedWarning = detectOvergeneralizedNewMemory({
      memory,
      evidenceCheck: check,
    });
    if (overgeneralizedWarning) {
      pushWarning(warnings, overgeneralizedWarning);
      consistencyChecks.push({
        targetType: "new_memory",
        targetLabel: memory.title,
        severity: "warning",
        detail: overgeneralizedWarning.detail,
      });
    }

    const structuralWarnings = validateNewMemoryStructure(memory, args.chapterPlan);
    for (const detail of structuralWarnings) {
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "new_memory",
        targetLabel: memory.title,
        detail,
      });
      consistencyChecks.push({
        targetType: "new_memory",
        targetLabel: memory.title,
        severity: "warning",
        detail,
      });
    }
  }

  for (const hint of sanitized.carryForwardHints) {
    const hintCheck = buildEvidenceCheck({
      draft: args.draft,
      targetType: "next_situation",
      targetLabel: `carryForward:${hint}`,
      text: hint,
    });
    if (hintCheck.status === "missing") {
      consistencyChecks.push({
        targetType: "carry_forward_hint",
        targetLabel: hint,
        severity: "warning",
        detail: `Carry-forward hint is not visibly grounded in the current draft: ${hint}`,
      });
      pushWarning(warnings, {
        type: "unsupported",
        targetType: "carry_forward_hint",
        targetLabel: hint,
        detail: `Carry-forward hint lacks draft evidence: ${hint}`,
      });
    }
  }

  return {
    sanitized,
    warnings: uniqueWarnings(warnings, 16),
    evidenceChecks,
    consistencyChecks,
  };
}

const GENERALIZATION_MARKERS = [
  "always",
  "usually",
  "never",
  "habitually",
  "habitual",
  "tends to",
  "tendency",
  "consistently",
  "invariably",
  "instinctively",
  "习惯",
  "总是",
  "一向",
  "从不",
  "本能地",
  "向来",
  "惯于",
  "习惯性",
];

function containsGeneralizationLanguage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return GENERALIZATION_MARKERS.some((marker) => normalized.includes(marker));
}

function detectOvergeneralizedNewMemory(args: {
  memory: NewMemoryDraft;
  evidenceCheck: MemoryUpdaterEvidenceCheck;
}): MemoryWritebackWarning | null {
  const sourceText = [args.memory.title, args.memory.summary, ...args.memory.notes].join(" ");
  if (!containsGeneralizationLanguage(sourceText)) {
    return null;
  }
  if (args.evidenceCheck.status === "supported" && args.evidenceCheck.matchedSnippets.length >= 2) {
    return null;
  }
  return {
    type: "overgeneralized",
    targetType: "new_memory",
    targetLabel: args.memory.title,
    detail: `New memory appears to generalize a one-off event into a stable trait or pattern: ${args.memory.title}`,
  };
}

function detectOvergeneralizedPatch(args: {
  patch: MemoryUpdatePatch;
  memory?: StoryMemory;
  evidenceCheck: MemoryUpdaterEvidenceCheck;
}): MemoryWritebackWarning | null {
  const sourceText = [args.memory?.title ?? "", args.patch.reason, ...args.patch.notes].join(" ");
  if (!containsGeneralizationLanguage(sourceText)) {
    return null;
  }
  if (args.evidenceCheck.status === "supported" && args.evidenceCheck.matchedSnippets.length >= 2) {
    return null;
  }
  return {
    type: "overgeneralized",
    targetType: "memory_patch",
    targetLabel: args.patch.memoryId,
    detail: `Memory patch appears to overgeneralize beyond chapter evidence: ${args.patch.memoryId}`,
  };
}

function buildEvidenceCheck(args: {
  draft: string;
  targetType: MemoryUpdaterEvidenceCheck["targetType"];
  targetLabel: string;
  text: string;
}): MemoryUpdaterEvidenceCheck {
  const snippets = findEvidenceSnippets(args.draft, args.text);
  const status: MemoryUpdaterEvidenceCheck["status"] =
    snippets.length >= 2 ? "supported" : snippets.length === 1 ? "weak" : "missing";

  return {
    targetType: args.targetType,
    targetLabel: args.targetLabel,
    status,
    matchedSnippets: snippets,
  };
}

function findEvidenceSnippets(draft: string, text: string): string[] {
  const queryTokens = extractEvidenceTokens(text);
  if (queryTokens.length === 0) {
    return [];
  }

  const sentences = splitDraftSentences(draft);
  const scored = sentences
    .map((sentence) => ({
      sentence,
      score: queryTokens.filter((token) => sentence.includes(token)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.sentence.length - right.sentence.length)
    .slice(0, 2)
    .map((item) => item.sentence);

  return uniqueTrimmed(scored, 2);
}

function extractEvidenceTokens(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }

  const tokens: string[] = [];
  const latin = normalized.match(/[a-z0-9]{3,}/g) ?? [];
  tokens.push(...latin);

  const cjkGroups = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const group of cjkGroups) {
    const chars = [...group];
    for (let index = 0; index < chars.length - 1; index += 1) {
      const token = `${chars[index]}${chars[index + 1]}`;
      if (token.length >= 2) {
        tokens.push(token);
      }
    }
    for (let index = 0; index < chars.length - 2; index += 1) {
      const token = `${chars[index]}${chars[index + 1]}${chars[index + 2]}`;
      if (token.length >= 3) {
        tokens.push(token);
      }
    }
  }

  return uniqueTrimmed(tokens, 16);
}

function splitDraftSentences(draft: string): string[] {
  return uniqueTrimmed(
    draft
      .split(/[\r\n]+|(?<=[。！？!?])|(?<=[；;])/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 6),
    200,
  );
}

function validateMemoryStatusTransition(
  memory: StoryMemory,
  patch: MemoryUpdatePatch,
): string | null {
  const current = memory.status;
  const next = patch.action;

  if (current === next) {
    return `Memory patch repeats current status without a visible change: ${patch.memoryId} remains ${current}.`;
  }

  if ((current === "resolved" || current === "expired" || current === "consumed") && next === "triggered") {
    return `Memory patch reopens a closed memory as triggered without an explicit new anchor: ${patch.memoryId}.`;
  }

  if (current === "consumed" && next === "resolved") {
    return `Memory patch downgrades a consumed memory back to resolved: ${patch.memoryId}.`;
  }

  if (current === "expired" && next !== "hidden") {
    return `Memory patch mutates an expired memory in a suspicious way: ${patch.memoryId} -> ${next}.`;
  }

  return null;
}

function findNearDuplicateMemory(
  memory: NewMemoryDraft,
  existingMemories: StoryMemory[],
): StoryMemory | null {
  const normalizedTitle = normalizeLooseText(memory.title);
  const normalizedSummary = normalizeLooseText(memory.summary);

  for (const existing of existingMemories) {
    if (existing.kind !== memory.kind) {
      continue;
    }

    const titleOverlap = overlapScore(normalizedTitle, normalizeLooseText(existing.title));
    const summaryOverlap = overlapScore(normalizedSummary, normalizeLooseText(existing.summary));
    if (titleOverlap >= 0.78 || (titleOverlap >= 0.58 && summaryOverlap >= 0.58)) {
      return existing;
    }
  }

  return null;
}

function validateNewMemoryStructure(
  memory: NewMemoryDraft,
  chapterPlan: ChapterPlan,
): string[] {
  const warnings: string[] = [];
  const activeCharacterSet = new Set(chapterPlan.requiredCharacters);

  if (
    (memory.kind === "resource" || memory.kind === "promise" || memory.kind === "injury") &&
    !memory.ownerCharacterId &&
    memory.relatedCharacterIds.length === 0
  ) {
    warnings.push(`Structured memory ${memory.title} is missing character ownership or related characters.`);
  }

  if (
    memory.kind === "clue" ||
    memory.kind === "suspense_hook" ||
    memory.kind === "long_arc_thread"
  ) {
    if (memory.triggerConditions.length === 0) {
      warnings.push(`Long-tail memory ${memory.title} has no trigger conditions.`);
    }
  }

  if (
    activeCharacterSet.size > 0 &&
    memory.relatedCharacterIds.length > 0 &&
    !memory.relatedCharacterIds.some((id) => activeCharacterSet.has(id)) &&
    memory.ownerCharacterId &&
    !activeCharacterSet.has(memory.ownerCharacterId)
  ) {
    warnings.push(
      `New memory ${memory.title} is detached from current required characters and may be over-extracted.`,
    );
  }

  return warnings;
}

function normalizeLooseText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function overlapScore(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function applyMemoryUpdaterResult(
  existing: StoryMemory[],
  result: MemoryUpdaterResult,
  chapterNumber: number,
): StoryMemory[] {
  const byId = new Map(existing.map((memory) => [memory.id, memory] as const));

  for (const patch of result.memoryPatches) {
    const current = byId.get(patch.memoryId);
    if (!current) {
      continue;
    }

    byId.set(patch.memoryId, {
      ...current,
      status: patch.action,
      lastReferencedIn: chapterNumber,
      notes: uniqueTrimmed(
        [...current.notes, `Chapter ${chapterNumber}: ${patch.reason}`, ...patch.notes],
        12,
      ),
    });
  }

  result.newMemories.forEach((memory, index) => {
    const idBase = slugify(memory.title) || `memory-${index + 1}`;
    const id = `chapter-${String(chapterNumber).padStart(3, "0")}-${idBase}`;

    byId.set(id, {
      id,
      title: memory.title,
      summary: memory.summary,
      kind: memory.kind,
      ownerCharacterId: memory.ownerCharacterId,
      relatedCharacterIds: memory.relatedCharacterIds,
      relatedLocationIds: memory.relatedLocationIds,
      triggerConditions: uniqueTrimmed(memory.triggerConditions, 4),
      introducedIn: chapterNumber,
      lastReferencedIn: chapterNumber,
      status: memory.status,
      priority: memory.priority,
      visibility: memory.visibility,
      notes: uniqueTrimmed(memory.notes, 8),
    });
  });

  return [...byId.values()];
}
