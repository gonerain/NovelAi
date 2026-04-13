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
