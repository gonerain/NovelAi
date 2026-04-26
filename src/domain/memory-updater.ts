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
  warnings: string[];
  evidenceChecks: MemoryUpdaterEvidenceCheck[];
}

export interface MemoryUpdaterEvidenceCheck {
  targetType: "chapter_summary" | "next_situation" | "memory_patch" | "new_memory";
  targetLabel: string;
  status: "supported" | "weak" | "missing";
  matchedSnippets: string[];
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

export function validateMemoryUpdaterResult(args: {
  result: MemoryUpdaterResult;
  existingMemories: StoryMemory[];
  chapterPlan: ChapterPlan;
  activeCharacterIds: EntityId[];
  draft: string;
}): MemoryUpdaterValidationResult {
  const warnings: string[] = [];
  const evidenceChecks: MemoryUpdaterEvidenceCheck[] = [];
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
      warnings.push(`Dropped memory patch for unknown memory id: ${patch.memoryId}`);
      continue;
    }
    if (patchById.has(patch.memoryId)) {
      warnings.push(`Collapsed duplicate memory patch for memory id: ${patch.memoryId}`);
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
      warnings.push("Dropped new memory with empty title or summary.");
      continue;
    }

    const signature = `${memory.kind}|${title.toLowerCase()}|${summary.toLowerCase()}`;
    if (seenNewMemorySignatures.has(signature)) {
      warnings.push(`Dropped duplicate new memory draft: ${title}`);
      continue;
    }
    seenNewMemorySignatures.add(signature);

    const ownerCharacterId =
      memory.ownerCharacterId && characterIds.has(memory.ownerCharacterId)
        ? memory.ownerCharacterId
        : undefined;
    if (memory.ownerCharacterId && !ownerCharacterId) {
      warnings.push(`Removed unknown ownerCharacterId from new memory: ${title}`);
    }

    const relatedCharacterIds = uniqueTrimmed(
      memory.relatedCharacterIds.filter((id) => characterIds.has(id)),
      8,
    );
    const droppedCharacterIds = memory.relatedCharacterIds.filter((id) => !characterIds.has(id));
    if (droppedCharacterIds.length > 0) {
      warnings.push(
        `Removed unknown relatedCharacterIds from new memory ${title}: ${droppedCharacterIds.join(", ")}`,
      );
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
      warnings.push(`Memory patch lacks draft evidence: ${patch.memoryId}`);
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
      warnings.push(`New memory lacks draft evidence: ${memory.title}`);
    }
  }

  return {
    sanitized,
    warnings: uniqueTrimmed(warnings, 12),
    evidenceChecks,
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
