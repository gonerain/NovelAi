import type { ChapterArtifact } from "./chapter-artifact.js";
import { buildMemorySystemArtifacts } from "./memory-system.js";
import type {
  ArcOutline,
  BeatOutline,
  ChapterPlan,
  CharacterState,
  EntityId,
  StoryMemory,
} from "./types.js";

export interface ChangeImpactReason {
  scope: "character" | "memory" | "chapter" | "arc" | "beat" | "graph";
  detail: string;
}

export interface ChangeImpactItem {
  id: EntityId;
  label: string;
  reasons: ChangeImpactReason[];
}

export interface ChangeImpactReport {
  targetId: EntityId;
  generatedAt: string;
  targetType:
    | "character"
    | "memory"
    | "chapter"
    | "arc"
    | "beat"
    | "chapter_card"
    | "unknown";
  impactedCharacters: ChangeImpactItem[];
  impactedMemories: ChangeImpactItem[];
  impactedChapters: ChangeImpactItem[];
  impactedArcs: ChangeImpactItem[];
  impactedBeats: ChangeImpactItem[];
}

export function buildChangeImpactReport(input: {
  targetId: EntityId;
  characterStates: CharacterState[];
  storyMemories: StoryMemory[];
  chapterPlans: ChapterPlan[];
  arcOutlines: ArcOutline[];
  beatOutlines: BeatOutline[];
  chapterArtifacts: ChapterArtifact[];
}): ChangeImpactReport {
  const memoryArtifacts = buildMemorySystemArtifacts({
    storyMemories: input.storyMemories,
    characterStates: input.characterStates,
    chapterArtifacts: input.chapterArtifacts,
  });

  const characterMap = new Map(input.characterStates.map((item) => [item.id, item]));
  const memoryMap = new Map(input.storyMemories.map((item) => [item.id, item]));
  const chapterPlanMap = new Map(
    input.chapterPlans
      .filter((item): item is ChapterPlan & { chapterNumber: number } => typeof item.chapterNumber === "number")
      .map((item) => [item.chapterNumber, item]),
  );
  const chapterCardMap = new Map(memoryArtifacts.chapterCards.map((item) => [item.id, item]));
  const arcMap = new Map(input.arcOutlines.map((item) => [item.id, item]));
  const beatMap = new Map(input.beatOutlines.map((item) => [item.id, item]));

  const impactedCharacters = new Map<EntityId, ChangeImpactItem>();
  const impactedMemories = new Map<EntityId, ChangeImpactItem>();
  const impactedChapters = new Map<EntityId, ChangeImpactItem>();
  const impactedArcs = new Map<EntityId, ChangeImpactItem>();
  const impactedBeats = new Map<EntityId, ChangeImpactItem>();

  const addImpact = (
    map: Map<EntityId, ChangeImpactItem>,
    id: EntityId,
    label: string,
    reason: ChangeImpactReason,
  ) => {
    const existing = map.get(id);
    if (existing) {
      if (!existing.reasons.some((item) => item.scope === reason.scope && item.detail === reason.detail)) {
        existing.reasons.push(reason);
      }
      return;
    }
    map.set(id, {
      id,
      label,
      reasons: [reason],
    });
  };

  for (const character of input.characterStates) {
    if (character.id === input.targetId) {
      addImpact(impactedCharacters, character.id, character.name, {
        scope: "character",
        detail: "Target character itself.",
      });
    }

    for (const relationship of character.relationships) {
      if (relationship.targetCharacterId === input.targetId || character.id === input.targetId) {
        addImpact(impactedCharacters, character.id, character.name, {
          scope: "character",
          detail: `Relationship link to ${input.targetId}.`,
        });
        addImpact(impactedCharacters, relationship.targetCharacterId, relationship.publicLabel || relationship.targetCharacterId, {
          scope: "character",
          detail: `Relationship link to ${character.id}.`,
        });
      }
    }
  }

  for (const memory of input.storyMemories) {
    if (
      memory.id === input.targetId ||
      memory.ownerCharacterId === input.targetId ||
      memory.relatedCharacterIds.includes(input.targetId) ||
      memory.notes.includes(input.targetId)
    ) {
      addImpact(impactedMemories, memory.id, memory.title, {
        scope: "memory",
        detail: `Memory directly references ${input.targetId}.`,
      });
    }
  }

  for (const card of memoryArtifacts.chapterCards) {
    if (
      card.id === input.targetId ||
      card.characterIds.includes(input.targetId) ||
      card.memoryIds.includes(input.targetId)
    ) {
      addImpact(impactedChapters, card.id, `Chapter ${card.chapterNumber}: ${card.title}`, {
        scope: "chapter",
        detail: `Chapter card directly references ${input.targetId}.`,
      });
    }
  }

  for (const entry of memoryArtifacts.entityChapterIndex) {
    if (entry.entityId !== input.targetId) {
      continue;
    }
    for (const chapterCardId of entry.chapterCardIds) {
      const card = chapterCardMap.get(chapterCardId);
      if (card) {
        addImpact(impactedChapters, card.id, `Chapter ${card.chapterNumber}: ${card.title}`, {
          scope: "chapter",
          detail: `Entity-chapter index links ${input.targetId} to this chapter.`,
        });
      }
    }
  }

  for (const edge of memoryArtifacts.storyGraph) {
    if (edge.fromId !== input.targetId && edge.toId !== input.targetId) {
      continue;
    }

    const otherId = edge.fromId === input.targetId ? edge.toId : edge.fromId;
    if (characterMap.has(otherId)) {
      const character = characterMap.get(otherId);
      addImpact(impactedCharacters, otherId, character?.name ?? otherId, {
        scope: "graph",
        detail: `Graph edge ${edge.relation} connects ${input.targetId} and ${otherId}.`,
      });
    }
    if (memoryMap.has(otherId)) {
      const memory = memoryMap.get(otherId);
      addImpact(impactedMemories, otherId, memory?.title ?? otherId, {
        scope: "graph",
        detail: `Graph edge ${edge.relation} connects ${input.targetId} and ${otherId}.`,
      });
    }
    if (chapterCardMap.has(otherId)) {
      const card = chapterCardMap.get(otherId);
      if (card) {
        addImpact(impactedChapters, otherId, `Chapter ${card.chapterNumber}: ${card.title}`, {
          scope: "graph",
          detail: `Graph edge ${edge.relation} connects ${input.targetId} and ${otherId}.`,
        });
      }
    }
  }

  for (const plan of input.chapterPlans) {
    const chapterNumber = plan.chapterNumber;
    if (typeof chapterNumber !== "number") {
      continue;
    }
    if (
      plan.arcId === input.targetId ||
      plan.beatId === input.targetId ||
      plan.requiredCharacters.includes(input.targetId) ||
      plan.requiredMemories.includes(input.targetId) ||
      plan.searchIntent?.entityIds.includes(input.targetId) ||
      plan.searchIntent?.memoryIds.includes(input.targetId)
    ) {
      addImpact(impactedChapters, `chapter-plan-${String(chapterNumber).padStart(3, "0")}`, `Chapter ${chapterNumber}`, {
        scope: "chapter",
        detail: `Chapter plan directly references ${input.targetId}.`,
      });
    }
  }

  for (const arc of input.arcOutlines) {
    if (
      arc.id === input.targetId ||
      arc.memoryRequirements.includes(input.targetId) ||
      arc.beatIds.includes(input.targetId)
    ) {
      addImpact(impactedArcs, arc.id, arc.name, {
        scope: "arc",
        detail: `Arc directly references ${input.targetId}.`,
      });
    }
  }

  for (const beat of input.beatOutlines) {
    if (
      beat.id === input.targetId ||
      beat.arcId === input.targetId ||
      beat.requiredCharacters.includes(input.targetId) ||
      beat.requiredMemories.includes(input.targetId)
    ) {
      addImpact(impactedBeats, beat.id, `Beat ${beat.order}: ${beat.id}`, {
        scope: "beat",
        detail: `Beat directly references ${input.targetId}.`,
      });
    }
  }

  for (const beat of input.beatOutlines) {
    if (impactedBeats.has(beat.id) || impactedArcs.has(beat.arcId)) {
      const arc = arcMap.get(beat.arcId);
      if (arc) {
        addImpact(impactedArcs, arc.id, arc.name, {
          scope: "arc",
          detail: `Arc contains impacted beat ${beat.id}.`,
        });
      }
    }
  }

  for (const plan of input.chapterPlans) {
    const chapterNumber = plan.chapterNumber;
    if (typeof chapterNumber !== "number") {
      continue;
    }
    if (
      (plan.arcId && impactedArcs.has(plan.arcId)) ||
      (plan.beatId && impactedBeats.has(plan.beatId))
    ) {
      addImpact(
        impactedChapters,
        `chapter-plan-${String(chapterNumber).padStart(3, "0")}`,
        `Chapter ${chapterNumber}`,
        {
          scope: "chapter",
          detail: `Chapter plan belongs to impacted arc/beat.`,
        },
      );
    }
  }

  const targetType = detectTargetType({
    targetId: input.targetId,
    characterMap,
    memoryMap,
    chapterCardMap,
    arcMap,
    beatMap,
  });

  return {
    targetId: input.targetId,
    generatedAt: new Date().toISOString(),
    targetType,
    impactedCharacters: sortImpactItems(impactedCharacters),
    impactedMemories: sortImpactItems(impactedMemories),
    impactedChapters: sortImpactItems(impactedChapters),
    impactedArcs: sortImpactItems(impactedArcs),
    impactedBeats: sortImpactItems(impactedBeats),
  };
}

function detectTargetType(args: {
  targetId: string;
  characterMap: Map<string, CharacterState>;
  memoryMap: Map<string, StoryMemory>;
  chapterCardMap: Map<string, { id: string }>;
  arcMap: Map<string, ArcOutline>;
  beatMap: Map<string, BeatOutline>;
}): ChangeImpactReport["targetType"] {
  if (args.characterMap.has(args.targetId)) {
    return "character";
  }
  if (args.memoryMap.has(args.targetId)) {
    return "memory";
  }
  if (args.chapterCardMap.has(args.targetId)) {
    return "chapter_card";
  }
  if (args.arcMap.has(args.targetId)) {
    return "arc";
  }
  if (args.beatMap.has(args.targetId)) {
    return "beat";
  }
  if (/^chapter-plan-\d+$/.test(args.targetId)) {
    return "chapter";
  }
  return "unknown";
}

function sortImpactItems(map: Map<string, ChangeImpactItem>): ChangeImpactItem[] {
  return [...map.values()].sort((left, right) => {
    const reasonDiff = right.reasons.length - left.reasons.length;
    if (reasonDiff !== 0) {
      return reasonDiff;
    }
    return left.id.localeCompare(right.id);
  });
}
