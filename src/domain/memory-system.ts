import type { MemoryUpdaterResult } from "./memory-updater.js";
import type {
  ChapterPlan,
  CharacterState,
  EntityId,
  MemorySearchLedgerType,
  Priority,
  StoryMemory,
} from "./types.js";

type LedgerType =
  | "resource"
  | "promise"
  | "injury"
  | "foreshadow"
  | "relationship";

type LedgerStatus = StoryMemory["status"] | "ongoing";

export interface MemoryChapterArtifactSnapshot {
  chapterNumber: number;
  plan: ChapterPlan;
  writerResult: {
    title?: string;
  };
  memoryUpdate: MemoryUpdaterResult;
}

export interface ChapterCard {
  id: EntityId;
  chapterNumber: number;
  title: string;
  arcId?: EntityId;
  beatId?: EntityId;
  chapterType?: ChapterPlan["chapterType"];
  sceneType: string;
  sceneTags: string[];
  summary: string;
  nextSituation: string;
  characterIds: EntityId[];
  memoryIds: EntityId[];
  keywords: string[];
}

export interface LedgerEntry {
  id: EntityId;
  ledgerType: LedgerType;
  title: string;
  summary: string;
  status: LedgerStatus;
  priority: Priority;
  ownerCharacterId?: EntityId;
  relatedCharacterIds: EntityId[];
  relatedLocationIds: EntityId[];
  sourceMemoryIds: EntityId[];
  sourceChapterNumbers: number[];
  tags: string[];
}

export interface RelationshipLedgerEntry {
  id: EntityId;
  sourceCharacterId: EntityId;
  targetCharacterId: EntityId;
  relationshipType: string;
  publicLabel: string;
  privateTruth: string;
  trustLevel: number;
  tensionLevel: number;
  dependencyLevel: number;
  lastUpdatedInChapter?: number;
}

export interface TimelineLedgerEntry {
  id: EntityId;
  chapterNumber: number;
  title: string;
  summary: string;
  nextSituation: string;
  arcId?: EntityId;
  beatId?: EntityId;
  sceneTags: string[];
  characterIds: EntityId[];
  memoryIds: EntityId[];
}

export interface EntityChapterIndexEntry {
  entityId: EntityId;
  chapterNumbers: number[];
  chapterCardIds: EntityId[];
  memoryIds: EntityId[];
  labels: string[];
}

export interface ActiveThreadDigestEntry {
  id: EntityId;
  title: string;
  ledgerType: "resource" | "promise" | "foreshadow";
  priority: Priority;
  status: LedgerStatus;
  sourceChapterNumbers: number[];
  summary: string;
}

export interface MemorySystemArtifacts {
  chapterCards: ChapterCard[];
  ledgers: {
    resources: LedgerEntry[];
    promises: LedgerEntry[];
    injuries: LedgerEntry[];
    foreshadows: LedgerEntry[];
    relationships: RelationshipLedgerEntry[];
    timeline: TimelineLedgerEntry[];
  };
  entityChapterIndex: EntityChapterIndexEntry[];
  activeThreadDigest: ActiveThreadDigestEntry[];
  semanticIndex: SemanticIndexEntry[];
}

export interface ContextLedgerSnapshot {
  id: EntityId;
  ledgerType: LedgerType;
  title: string;
  summary: string;
  status: LedgerStatus;
  priority: Priority;
  sourceMemoryIds: EntityId[];
  sourceChapterNumbers: number[];
}

export interface ContextChapterCardSnapshot {
  id: EntityId;
  chapterNumber: number;
  title: string;
  summary: string;
  nextSituation: string;
  characterIds: EntityId[];
  memoryIds: EntityId[];
}

export interface MemoryRetrievalPack {
  relevantLedgerEntries: ContextLedgerSnapshot[];
  relevantChapterCards: ContextChapterCardSnapshot[];
  semanticHits: SemanticRetrievalHit[];
  retrievalSignals: string[];
}

export interface SemanticIndexEntry {
  id: EntityId;
  kind: "memory" | "chapter_card";
  sourceId: EntityId;
  label: string;
  topTerms: string[];
}

export interface SemanticRetrievalHit {
  kind: "memory" | "chapter_card";
  sourceId: EntityId;
  label: string;
  score: number;
}

export interface ExactSearchHit {
  kind: "memory" | "ledger" | "chapter_card" | "relationship" | "character";
  targetId: EntityId;
  matchedPhrase: string;
  label: string;
}

export interface ResourceReviewerCandidate {
  id: EntityId;
  ledgerType: "resource" | "promise" | "foreshadow";
  title: string;
  summary: string;
  status: LedgerStatus;
  priority: Priority;
  sourceMemoryIds: EntityId[];
  sourceChapterNumbers: number[];
}

export interface RelationshipReviewerCandidate {
  id: EntityId;
  sourceCharacterId: EntityId;
  targetCharacterId: EntityId;
  relationshipType: string;
  publicLabel: string;
  privateTruth: string;
  trustLevel: number;
  tensionLevel: number;
  dependencyLevel: number;
  lastUpdatedInChapter?: number;
}

export interface SpecializedReviewerViews {
  resourceCandidates: ResourceReviewerCandidate[];
  relationshipCandidates: RelationshipReviewerCandidate[];
}

export function buildMemorySystemArtifacts(input: {
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: MemoryChapterArtifactSnapshot[];
}): MemorySystemArtifacts {
  const chapterCards = buildChapterCards(input.storyMemories, input.chapterArtifacts);
  const resourceLedger = buildMemoryLedger(input.storyMemories, "resource", ["resource"]);
  const promiseLedger = buildMemoryLedger(input.storyMemories, "promise", ["promise"]);
  const injuryLedger = buildInjuryLedger(input.storyMemories, input.characterStates);
  const foreshadowLedger = buildMemoryLedger(input.storyMemories, "foreshadow", [
    "clue",
    "suspense_hook",
    "long_arc_thread",
  ]);
  const relationshipLedger = buildRelationshipLedger(input.characterStates);
  const timelineLedger = chapterCards.map((card) => ({
    id: `timeline-${String(card.chapterNumber).padStart(3, "0")}`,
    chapterNumber: card.chapterNumber,
    title: card.title,
    summary: card.summary,
    nextSituation: card.nextSituation,
    arcId: card.arcId,
    beatId: card.beatId,
    sceneTags: [...card.sceneTags],
    characterIds: [...card.characterIds],
    memoryIds: [...card.memoryIds],
  }));
  const entityChapterIndex = buildEntityChapterIndex(chapterCards);
  const activeThreadDigest = buildActiveThreadDigest(
    resourceLedger,
    promiseLedger,
    foreshadowLedger,
  );

  return {
    chapterCards,
    ledgers: {
      resources: resourceLedger,
      promises: promiseLedger,
      injuries: injuryLedger,
      foreshadows: foreshadowLedger,
      relationships: relationshipLedger,
      timeline: timelineLedger,
    },
    entityChapterIndex,
    activeThreadDigest,
    semanticIndex: buildSemanticIndex(input.storyMemories, chapterCards),
  };
}

export function buildMemoryRetrievalPack(input: {
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: MemoryChapterArtifactSnapshot[];
  semanticOverrideHits?: SemanticRetrievalHit[];
}): MemoryRetrievalPack {
  const artifacts = buildMemorySystemArtifacts({
    storyMemories: input.storyMemories,
    characterStates: input.characterStates,
    chapterArtifacts: input.chapterArtifacts,
  });
  const triggerKeywords = buildTriggerKeywords(input.chapterPlan);
  const exactSearchHits = buildExactSearchHits({
    chapterPlan: input.chapterPlan,
    storyMemories: input.storyMemories,
    characterStates: input.characterStates,
    artifacts,
  });
  const exactLookup = buildExactLookup(exactSearchHits);
  const semanticHits =
    input.semanticOverrideHits ??
    buildSemanticRetrievalHits({
      chapterPlan: input.chapterPlan,
      storyMemories: input.storyMemories,
      artifacts,
    });
  const semanticLookup = buildSemanticLookup(semanticHits);

  const scoredLedgerEntries = [
    ...artifacts.ledgers.resources,
    ...artifacts.ledgers.promises,
    ...artifacts.ledgers.injuries,
    ...artifacts.ledgers.foreshadows,
    ...artifacts.ledgers.relationships.map((entry) => ({
      id: entry.id,
      ledgerType: "relationship" as const,
      title:
        entry.publicLabel ||
        `${entry.sourceCharacterId}->${entry.targetCharacterId}`,
      summary: entry.privateTruth || entry.relationshipType,
      status: "ongoing" as const,
      priority: relationshipPriority(entry),
      sourceMemoryIds: [],
      sourceChapterNumbers:
        typeof entry.lastUpdatedInChapter === "number" ? [entry.lastUpdatedInChapter] : [],
      relatedCharacterIds: [entry.sourceCharacterId, entry.targetCharacterId],
      relatedLocationIds: [],
      ownerCharacterId: entry.sourceCharacterId,
      tags: uniqueStrings([entry.relationshipType, entry.publicLabel], 4),
    })),
  ]
    .map((entry) => ({
      entry,
      score: scoreLedgerEntry(
        entry,
        input.chapterPlan,
        triggerKeywords,
        exactLookup,
        semanticLookup,
      ),
    }))
    .filter(
      (item) =>
        item.score > 0 ||
        Boolean(input.chapterPlan.searchIntent?.ledgerTypes.includes(item.entry.ledgerType)),
    )
    .sort((left, right) => right.score - left.score)
  const relevantLedgerEntries = ensureRequestedLedgerCoverage(
    scoredLedgerEntries,
    input.chapterPlan.searchIntent?.ledgerTypes ?? [],
  )
    .slice(0, 6)
    .map(({ entry }) => ({
      id: entry.id,
      ledgerType: entry.ledgerType,
      title: entry.title,
      summary: entry.summary,
      status: entry.status,
      priority: entry.priority,
      sourceMemoryIds: [...entry.sourceMemoryIds],
      sourceChapterNumbers: [...entry.sourceChapterNumbers],
    }));

  const currentChapterNumber = input.chapterPlan.chapterNumber ?? Number.MAX_SAFE_INTEGER;
  const relevantChapterCards = artifacts.chapterCards
    .map((card) => ({
        card,
        score: scoreChapterCard(
          card,
          input.chapterPlan,
          triggerKeywords,
          currentChapterNumber,
          exactLookup,
          semanticLookup,
        ),
      }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ card }) => ({
      id: card.id,
      chapterNumber: card.chapterNumber,
      title: card.title,
      summary: card.summary,
      nextSituation: card.nextSituation,
      characterIds: [...card.characterIds],
      memoryIds: [...card.memoryIds],
    }));

  const retrievalSignals = uniqueStrings(
    [
      input.chapterPlan.requiredMemories.length
        ? `Required memory anchors: ${input.chapterPlan.requiredMemories.join(" | ")}`
        : "",
      input.chapterPlan.searchIntent?.memoryIds.length
        ? `Search memory ids: ${input.chapterPlan.searchIntent.memoryIds.join(" | ")}`
        : "",
      input.chapterPlan.requiredCharacters.length
        ? `Required character anchors: ${input.chapterPlan.requiredCharacters.join(" | ")}`
        : "",
      input.chapterPlan.searchIntent?.entityIds.length
        ? `Search entity ids: ${input.chapterPlan.searchIntent.entityIds.join(" | ")}`
        : "",
      input.chapterPlan.searchIntent?.ledgerTypes.length
        ? `Search ledger types: ${input.chapterPlan.searchIntent.ledgerTypes.join(" | ")}`
        : "",
      input.chapterPlan.searchIntent?.topicQueries.length
        ? `Search topics: ${input.chapterPlan.searchIntent.topicQueries.join(" | ")}`
        : "",
      input.chapterPlan.searchIntent?.exactPhrases.length
        ? `Search exact phrases: ${input.chapterPlan.searchIntent.exactPhrases.join(" | ")}`
        : "",
      exactSearchHits.length
        ? `Exact hits: ${exactSearchHits
            .slice(0, 4)
            .map((item) => `${item.kind}:${item.label}`)
            .join(" | ")}`
        : "",
      semanticHits.length
        ? `Semantic recall: ${semanticHits
            .slice(0, 4)
            .map((item) => `${item.kind}:${item.label}`)
            .join(" | ")}`
        : "",
      relevantLedgerEntries.length
        ? `Ledger recall: ${relevantLedgerEntries
            .slice(0, 3)
            .map((entry) => `${entry.ledgerType}:${entry.title}`)
            .join(" | ")}`
        : "",
      relevantChapterCards.length
        ? `Chapter recall: ${relevantChapterCards
            .map((card) => `ch${card.chapterNumber}:${card.title}`)
            .join(" | ")}`
        : "",
      artifacts.activeThreadDigest.length
        ? `Active threads: ${artifacts.activeThreadDigest
            .slice(0, 3)
            .map((entry) => `${entry.ledgerType}:${entry.title}`)
            .join(" | ")}`
        : "",
    ],
    6,
  );

  return {
    relevantLedgerEntries,
    relevantChapterCards,
    semanticHits,
    retrievalSignals,
  };
}

export function buildSpecializedReviewerViews(input: {
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: MemoryChapterArtifactSnapshot[];
}): SpecializedReviewerViews {
  const artifacts = buildMemorySystemArtifacts({
    storyMemories: input.storyMemories,
    characterStates: input.characterStates,
    chapterArtifacts: input.chapterArtifacts,
  });
  const triggerKeywords = buildTriggerKeywords(input.chapterPlan);
  const exactLookup = buildExactLookup(
    buildExactSearchHits({
      chapterPlan: input.chapterPlan,
      storyMemories: input.storyMemories,
      characterStates: input.characterStates,
      artifacts,
    }),
  );

  const resourceCandidates = [
    ...artifacts.ledgers.resources,
    ...artifacts.ledgers.promises,
    ...artifacts.ledgers.foreshadows,
  ]
    .map((entry) => ({
      entry,
      score: scoreLedgerEntry(entry, input.chapterPlan, triggerKeywords, exactLookup),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ entry }) => ({
      id: entry.id,
      ledgerType: entry.ledgerType as "resource" | "promise" | "foreshadow",
      title: entry.title,
      summary: entry.summary,
      status: entry.status,
      priority: entry.priority,
      sourceMemoryIds: [...entry.sourceMemoryIds],
      sourceChapterNumbers: [...entry.sourceChapterNumbers],
    }));

  const focusCharacterIds = new Set([
    ...input.chapterPlan.requiredCharacters,
    ...(input.chapterPlan.searchIntent?.entityIds ?? []),
  ]);
  const relationshipCandidates = artifacts.ledgers.relationships
    .map((entry) => ({
      entry,
      score: scoreRelationshipEntry(entry, focusCharacterIds, triggerKeywords, exactLookup),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ entry }) => ({
      id: entry.id,
      sourceCharacterId: entry.sourceCharacterId,
      targetCharacterId: entry.targetCharacterId,
      relationshipType: entry.relationshipType,
      publicLabel: entry.publicLabel,
      privateTruth: entry.privateTruth,
      trustLevel: entry.trustLevel,
      tensionLevel: entry.tensionLevel,
      dependencyLevel: entry.dependencyLevel,
      lastUpdatedInChapter: entry.lastUpdatedInChapter,
    }));

  return {
    resourceCandidates,
    relationshipCandidates,
  };
}

export function buildExactSearchHits(input: {
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  artifacts: MemorySystemArtifacts;
}): ExactSearchHit[] {
  const terms = uniqueStrings(
    [
      ...(input.chapterPlan.searchIntent?.exactPhrases ?? []),
      ...(input.chapterPlan.searchIntent?.memoryIds ?? []),
      ...(input.chapterPlan.searchIntent?.entityIds ?? []),
    ],
    20,
  );
  if (terms.length === 0) {
    return [];
  }

  const hits: ExactSearchHit[] = [];
  const seen = new Set<string>();
  const pushHit = (hit: ExactSearchHit) => {
    const key = `${hit.kind}|${hit.targetId}|${hit.matchedPhrase}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    hits.push(hit);
  };

  for (const term of terms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) {
      continue;
    }

    for (const memory of input.storyMemories) {
      if (
        matchesExactTerm(normalizedTerm, [
          memory.id,
          memory.title,
          memory.summary,
          ...memory.triggerConditions,
          ...memory.notes,
        ])
      ) {
        pushHit({
          kind: "memory",
          targetId: memory.id,
          matchedPhrase: term,
          label: memory.title,
        });
      }
    }

    for (const entry of [
      ...input.artifacts.ledgers.resources,
      ...input.artifacts.ledgers.promises,
      ...input.artifacts.ledgers.injuries,
      ...input.artifacts.ledgers.foreshadows,
    ]) {
      if (
        matchesExactTerm(normalizedTerm, [
          entry.id,
          entry.title,
          entry.summary,
          ...entry.tags,
          ...entry.sourceMemoryIds,
        ])
      ) {
        pushHit({
          kind: "ledger",
          targetId: entry.id,
          matchedPhrase: term,
          label: entry.title,
        });
      }
    }

    for (const card of input.artifacts.chapterCards) {
      if (
        matchesExactTerm(normalizedTerm, [
          card.id,
          card.title,
          card.summary,
          card.nextSituation,
          card.sceneType,
          ...card.sceneTags,
          ...card.keywords,
          ...card.memoryIds,
          ...card.characterIds,
        ])
      ) {
        pushHit({
          kind: "chapter_card",
          targetId: card.id,
          matchedPhrase: term,
          label: card.title,
        });
      }
    }

    for (const character of input.characterStates) {
      if (
        matchesExactTerm(normalizedTerm, [
          character.id,
          character.name,
          ...character.currentGoals,
          ...character.emotionalState,
          ...character.wounds,
          ...character.voiceNotes,
        ])
      ) {
        pushHit({
          kind: "character",
          targetId: character.id,
          matchedPhrase: term,
          label: character.name,
        });
      }
    }

    for (const relationship of input.artifacts.ledgers.relationships) {
      if (
        matchesExactTerm(normalizedTerm, [
          relationship.id,
          relationship.publicLabel,
          relationship.relationshipType,
          relationship.privateTruth,
          relationship.sourceCharacterId,
          relationship.targetCharacterId,
        ])
      ) {
        pushHit({
          kind: "relationship",
          targetId: relationship.id,
          matchedPhrase: term,
          label: relationship.publicLabel || relationship.relationshipType,
        });
      }
    }
  }

  return hits.slice(0, 24);
}

function buildChapterCards(
  storyMemories: StoryMemory[],
  chapterArtifacts: MemoryChapterArtifactSnapshot[],
): ChapterCard[] {
  return [...chapterArtifacts]
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
    .map((artifact) => {
      const relatedMemoryIds = storyMemories
        .filter(
          (memory) =>
            artifact.plan.requiredMemories.includes(memory.id) ||
            memory.introducedIn === artifact.chapterNumber ||
            memory.lastReferencedIn === artifact.chapterNumber,
        )
        .map((memory) => memory.id);
      const title =
        artifact.writerResult.title?.trim() || artifact.plan.title?.trim() || `Chapter ${artifact.chapterNumber}`;

      return {
        id: `chapter-card-${String(artifact.chapterNumber).padStart(3, "0")}`,
        chapterNumber: artifact.chapterNumber,
        title,
        arcId: artifact.plan.arcId,
        beatId: artifact.plan.beatId,
        chapterType: artifact.plan.chapterType,
        sceneType: artifact.plan.sceneType,
        sceneTags: artifact.plan.sceneTags.slice(0, 5),
        summary: artifact.memoryUpdate.chapterSummary,
        nextSituation: artifact.memoryUpdate.nextSituation,
        characterIds: artifact.plan.requiredCharacters.slice(0, 8),
        memoryIds: uniqueStrings(relatedMemoryIds, 12),
        keywords: uniqueStrings(
          [
            artifact.plan.sceneType,
            artifact.plan.chapterGoal,
            artifact.plan.emotionalGoal,
            artifact.plan.plannedOutcome,
            ...artifact.plan.sceneTags,
            ...artifact.plan.mustHitConflicts,
            ...(artifact.plan.searchIntent?.topicQueries ?? []),
            ...(artifact.plan.searchIntent?.exactPhrases ?? []),
            ...artifact.memoryUpdate.carryForwardHints,
          ],
          10,
        ),
      };
    });
}

function buildSemanticIndex(
  storyMemories: StoryMemory[],
  chapterCards: ChapterCard[],
): SemanticIndexEntry[] {
  const memoryEntries = storyMemories.map((memory) => ({
    id: `semantic-memory-${memory.id}`,
    kind: "memory" as const,
    sourceId: memory.id,
    label: memory.title,
    topTerms: extractTopSemanticTerms(buildMemorySemanticText(memory), 12),
  }));
  const chapterEntries = chapterCards.map((card) => ({
    id: `semantic-chapter-${card.id}`,
    kind: "chapter_card" as const,
    sourceId: card.id,
    label: card.title,
    topTerms: extractTopSemanticTerms(buildChapterCardSemanticText(card), 12),
  }));

  return [...memoryEntries, ...chapterEntries];
}

export function buildMemorySemanticText(memory: StoryMemory): string {
  return [
    memory.id,
    memory.title,
    memory.summary,
    ...memory.relatedCharacterIds,
    ...memory.triggerConditions,
    ...memory.notes,
  ].join(" ");
}

export function buildChapterCardSemanticText(card: ChapterCard): string {
  return [
    card.id,
    card.title,
    card.sceneType,
    card.summary,
    card.nextSituation,
    ...card.sceneTags,
    ...card.keywords,
    ...card.characterIds,
    ...card.memoryIds,
  ].join(" ");
}

function buildMemoryLedger(
  storyMemories: StoryMemory[],
  ledgerType: "resource" | "promise" | "foreshadow",
  kinds: StoryMemory["kind"][],
): LedgerEntry[] {
  return storyMemories
    .filter((memory) => kinds.includes(memory.kind))
    .map((memory) => ({
      id: `${ledgerType}-${memory.id}`,
      ledgerType,
      title: memory.title,
      summary: memory.summary,
      status: memory.status,
      priority: memory.priority,
      ownerCharacterId: memory.ownerCharacterId,
      relatedCharacterIds: [...memory.relatedCharacterIds],
      relatedLocationIds: [...memory.relatedLocationIds],
      sourceMemoryIds: [memory.id],
      sourceChapterNumbers: buildSourceChapterNumbers(memory),
      tags: uniqueStrings([memory.kind, ...memory.triggerConditions], 6),
    }))
    .sort(compareLedgerEntries);
}

function buildInjuryLedger(
  storyMemories: StoryMemory[],
  characterStates: CharacterState[],
): LedgerEntry[] {
  const injuryMemories = storyMemories
    .filter((memory) => memory.kind === "injury")
    .map((memory) => ({
      id: `injury-${memory.id}`,
      ledgerType: "injury" as const,
      title: memory.title,
      summary: memory.summary,
      status: memory.status,
      priority: memory.priority,
      ownerCharacterId: memory.ownerCharacterId,
      relatedCharacterIds: [...memory.relatedCharacterIds],
      relatedLocationIds: [...memory.relatedLocationIds],
      sourceMemoryIds: [memory.id],
      sourceChapterNumbers: buildSourceChapterNumbers(memory),
      tags: uniqueStrings([memory.kind, ...memory.triggerConditions], 6),
    }));

  const woundEntries = characterStates.flatMap((character, index) =>
    character.wounds.map((wound, woundIndex) => ({
      id: `injury-${character.id}-${index + 1}-${woundIndex + 1}`,
      ledgerType: "injury" as const,
      title: `${character.name}的伤口状态`,
      summary: wound,
      status: "ongoing" as const,
      priority: "high" as const,
      ownerCharacterId: character.id,
      relatedCharacterIds: [character.id],
      relatedLocationIds: [],
      sourceMemoryIds: [],
      sourceChapterNumbers: [],
      tags: ["wound", "character_state"],
    })),
  );

  return [...injuryMemories, ...woundEntries].sort(compareLedgerEntries);
}

function buildRelationshipLedger(
  characterStates: CharacterState[],
): RelationshipLedgerEntry[] {
  return characterStates
    .flatMap((character) =>
      character.relationships.map((relationship) => ({
        id: `relationship-${character.id}-${relationship.targetCharacterId}`,
        sourceCharacterId: character.id,
        targetCharacterId: relationship.targetCharacterId,
        relationshipType: relationship.type,
        publicLabel: relationship.publicLabel,
        privateTruth: relationship.privateTruth,
        trustLevel: relationship.trustLevel,
        tensionLevel: relationship.tensionLevel,
        dependencyLevel: relationship.dependencyLevel,
        lastUpdatedInChapter: relationship.lastUpdatedInChapter,
      })),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildEntityChapterIndex(
  chapterCards: ChapterCard[],
): EntityChapterIndexEntry[] {
  const index = new Map<EntityId, EntityChapterIndexEntry>();

  for (const card of chapterCards) {
    for (const entityId of uniqueStrings([...card.characterIds, ...card.memoryIds], 20)) {
      const current =
        index.get(entityId) ??
        {
          entityId,
          chapterNumbers: [],
          chapterCardIds: [],
          memoryIds: [],
          labels: [],
        };
      current.chapterNumbers = uniqueNumbers([...current.chapterNumbers, card.chapterNumber], 20);
      current.chapterCardIds = uniqueStrings([...current.chapterCardIds, card.id], 20);
      current.memoryIds = uniqueStrings([...current.memoryIds, ...card.memoryIds], 20);
      current.labels = uniqueStrings([...current.labels, card.title, ...card.sceneTags], 8);
      index.set(entityId, current);
    }
  }

  return [...index.values()].sort((left, right) => left.entityId.localeCompare(right.entityId));
}

function buildActiveThreadDigest(
  resourceLedger: LedgerEntry[],
  promiseLedger: LedgerEntry[],
  foreshadowLedger: LedgerEntry[],
): ActiveThreadDigestEntry[] {
  return [...resourceLedger, ...promiseLedger, ...foreshadowLedger]
    .filter((entry) => {
      if (entry.status === "resolved" || entry.status === "expired" || entry.status === "consumed") {
        return false;
      }
      return entry.priority === "critical" || entry.priority === "high";
    })
    .sort(compareLedgerEntries)
    .slice(0, 12)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      ledgerType: entry.ledgerType as "resource" | "promise" | "foreshadow",
      priority: entry.priority,
      status: entry.status,
      sourceChapterNumbers: [...entry.sourceChapterNumbers],
      summary: entry.summary,
    }));
}

function buildTriggerKeywords(chapterPlan: ChapterPlan): string[] {
  return uniqueStrings(
    [
      chapterPlan.sceneType,
      chapterPlan.chapterGoal,
      chapterPlan.emotionalGoal,
      chapterPlan.plannedOutcome,
      ...chapterPlan.sceneTags,
      ...chapterPlan.mustHitConflicts,
      ...(chapterPlan.beatConstraints ?? []),
      ...(chapterPlan.searchIntent?.topicQueries ?? []),
      ...(chapterPlan.searchIntent?.exactPhrases ?? []),
    ],
    20,
  ).map(normalizeText);
}

function scoreLedgerEntry(
  entry: LedgerEntry,
  chapterPlan: ChapterPlan,
  triggerKeywords: string[],
  exactLookup?: ReturnType<typeof buildExactLookup>,
  semanticLookup?: ReturnType<typeof buildSemanticLookup>,
): number {
  let score = 0;

  if (entry.sourceMemoryIds.some((id) => chapterPlan.requiredMemories.includes(id))) {
    score += 100;
  }
  if (entry.sourceMemoryIds.some((id) => chapterPlan.searchIntent?.memoryIds.includes(id))) {
    score += 60;
  }

  const relatedCharacterMatches = entry.relatedCharacterIds.filter((id) =>
    chapterPlan.requiredCharacters.includes(id),
  ).length;
  score += relatedCharacterMatches * 18;
  const searchEntityMatches = entry.relatedCharacterIds.filter((id) =>
    chapterPlan.searchIntent?.entityIds.includes(id),
  ).length;
  score += searchEntityMatches * 12;

  if (entry.ownerCharacterId && chapterPlan.requiredCharacters.includes(entry.ownerCharacterId)) {
    score += 20;
  }
  if (entry.ownerCharacterId && chapterPlan.searchIntent?.entityIds.includes(entry.ownerCharacterId)) {
    score += 12;
  }
  if (chapterPlan.searchIntent?.ledgerTypes.includes(entry.ledgerType)) {
    score += 18;
  }
  if (exactLookup?.ledgerIds.has(entry.id)) {
    score += 90;
  }
  if (entry.sourceMemoryIds.some((id) => exactLookup?.memoryIds.has(id))) {
    score += 40;
  }
  if (entry.relatedCharacterIds.some((id) => exactLookup?.characterIds.has(id))) {
    score += 24;
  }
  if (entry.ownerCharacterId && exactLookup?.characterIds.has(entry.ownerCharacterId)) {
    score += 20;
  }
  if (entry.sourceMemoryIds.some((id) => semanticLookup?.memoryIds.has(id))) {
    score += 26;
  }
  if (semanticLookup?.chapterCardIds.size && entry.sourceChapterNumbers.some((n) => semanticLookup.chapterNumbers.has(n))) {
    score += 12;
  }

  score += priorityWeight(entry.priority) * 10;
  score += keywordMatchCount(
    [entry.title, entry.summary, ...entry.tags].join(" "),
    triggerKeywords,
  ) * 8;

  if (entry.status === "active" || entry.status === "triggered" || entry.status === "ongoing") {
    score += 6;
  }

  return score;
}

function scoreChapterCard(
  card: ChapterCard,
  chapterPlan: ChapterPlan,
  triggerKeywords: string[],
  currentChapterNumber: number,
  exactLookup?: ReturnType<typeof buildExactLookup>,
  semanticLookup?: ReturnType<typeof buildSemanticLookup>,
): number {
  let score = 0;

  const characterMatches = card.characterIds.filter((id) =>
    chapterPlan.requiredCharacters.includes(id),
  ).length;
  score += characterMatches * 14;

  const memoryMatches = card.memoryIds.filter((id) => chapterPlan.requiredMemories.includes(id)).length;
  score += memoryMatches * 30;
  const searchMemoryMatches = card.memoryIds.filter((id) =>
    chapterPlan.searchIntent?.memoryIds.includes(id),
  ).length;
  score += searchMemoryMatches * 18;
  const searchEntityMatches = card.characterIds.filter((id) =>
    chapterPlan.searchIntent?.entityIds.includes(id),
  ).length;
  score += searchEntityMatches * 10;

  if (chapterPlan.arcId && card.arcId === chapterPlan.arcId) {
    score += 8;
  }
  if (exactLookup?.chapterCardIds.has(card.id)) {
    score += 70;
  }
  if (card.memoryIds.some((id) => exactLookup?.memoryIds.has(id))) {
    score += 36;
  }
  if (card.characterIds.some((id) => exactLookup?.characterIds.has(id))) {
    score += 20;
  }
  if (semanticLookup?.chapterCardIds.has(card.id)) {
    score += 48;
  }
  if (card.memoryIds.some((id) => semanticLookup?.memoryIds.has(id))) {
    score += 24;
  }

  score += keywordMatchCount(
    [card.title, card.summary, card.nextSituation, ...card.keywords].join(" "),
    triggerKeywords,
  ) * 6;

  if (Number.isFinite(currentChapterNumber)) {
    const distance = Math.max(0, currentChapterNumber - card.chapterNumber);
    score += Math.max(0, 12 - distance * 3);
  }

  return score;
}

function scoreRelationshipEntry(
  entry: RelationshipLedgerEntry,
  focusCharacterIds: Set<string>,
  triggerKeywords: string[],
  exactLookup?: ReturnType<typeof buildExactLookup>,
): number {
  let score = 0;

  if (focusCharacterIds.has(entry.sourceCharacterId)) {
    score += 30;
  }
  if (focusCharacterIds.has(entry.targetCharacterId)) {
    score += 24;
  }

  score += Math.max(0, entry.tensionLevel) * 2;
  score += Math.max(0, entry.dependencyLevel);

  score += keywordMatchCount(
    [entry.relationshipType, entry.publicLabel, entry.privateTruth].join(" "),
    triggerKeywords,
  ) * 8;

  if (typeof entry.lastUpdatedInChapter === "number") {
    score += 6;
  }
  if (exactLookup?.relationshipIds.has(entry.id)) {
    score += 80;
  }
  if (exactLookup?.characterIds.has(entry.sourceCharacterId)) {
    score += 20;
  }
  if (exactLookup?.characterIds.has(entry.targetCharacterId)) {
    score += 16;
  }

  return score;
}

function buildSemanticRetrievalHits(input: {
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  artifacts: MemorySystemArtifacts;
}): SemanticRetrievalHit[] {
  const queryText = buildSemanticQueryText(input.chapterPlan);
  const queryVector = buildSemanticVector(queryText);
  if (queryVector.size === 0) {
    return [];
  }

  const hits: SemanticRetrievalHit[] = [];
  const tryPush = (hit: SemanticRetrievalHit) => {
    if (hit.score < 0.12) {
      return;
    }
    hits.push(hit);
  };

  for (const memory of input.storyMemories) {
    const score = cosineSimilarity(
      queryVector,
      buildSemanticVector(buildMemorySemanticText(memory)),
    );
    tryPush({
      kind: "memory",
      sourceId: memory.id,
      label: memory.title,
      score,
    });
  }

  for (const card of input.artifacts.chapterCards) {
    const score = cosineSimilarity(
      queryVector,
      buildSemanticVector(buildChapterCardSemanticText(card)),
    );
    tryPush({
      kind: "chapter_card",
      sourceId: card.id,
      label: card.title,
      score,
    });
  }

  return hits.sort((left, right) => right.score - left.score).slice(0, 8);
}

export function toSemanticRetrievalHits(
  rankedCandidates: Array<{
    kind: "memory" | "chapter_card";
    sourceId: string;
    label: string;
    score: number;
  }>,
): SemanticRetrievalHit[] {
  return rankedCandidates.map((candidate) => ({
    kind: candidate.kind,
    sourceId: candidate.sourceId,
    label: candidate.label,
    score: candidate.score,
  }));
}

function buildSemanticLookup(hits: SemanticRetrievalHit[]): {
  memoryIds: Set<string>;
  chapterCardIds: Set<string>;
  chapterNumbers: Set<number>;
} {
  const memoryIds = new Set<string>();
  const chapterCardIds = new Set<string>();
  const chapterNumbers = new Set<number>();

  for (const hit of hits) {
    if (hit.kind === "memory") {
      memoryIds.add(hit.sourceId);
      continue;
    }

    if (hit.kind === "chapter_card") {
      chapterCardIds.add(hit.sourceId);
      const match = /^chapter-card-(\d+)$/.exec(hit.sourceId);
      if (match) {
        chapterNumbers.add(Number(match[1]));
      }
    }
  }

  return { memoryIds, chapterCardIds, chapterNumbers };
}

function buildExactLookup(hits: ExactSearchHit[]): {
  memoryIds: Set<string>;
  ledgerIds: Set<string>;
  chapterCardIds: Set<string>;
  relationshipIds: Set<string>;
  characterIds: Set<string>;
} {
  const memoryIds = new Set<string>();
  const ledgerIds = new Set<string>();
  const chapterCardIds = new Set<string>();
  const relationshipIds = new Set<string>();
  const characterIds = new Set<string>();

  for (const hit of hits) {
    if (hit.kind === "memory") {
      memoryIds.add(hit.targetId);
    } else if (hit.kind === "ledger") {
      ledgerIds.add(hit.targetId);
    } else if (hit.kind === "chapter_card") {
      chapterCardIds.add(hit.targetId);
    } else if (hit.kind === "relationship") {
      relationshipIds.add(hit.targetId);
    } else if (hit.kind === "character") {
      characterIds.add(hit.targetId);
    }
  }

  return {
    memoryIds,
    ledgerIds,
    chapterCardIds,
    relationshipIds,
    characterIds,
  };
}

function buildSourceChapterNumbers(memory: StoryMemory): number[] {
  return uniqueNumbers(
    [
      memory.introducedIn,
      typeof memory.lastReferencedIn === "number" ? memory.lastReferencedIn : undefined,
    ].filter((value): value is number => typeof value === "number"),
    4,
  );
}

function priorityWeight(priority: Priority): number {
  const weight = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  return weight[priority];
}

function relationshipPriority(entry: RelationshipLedgerEntry): Priority {
  if (entry.tensionLevel >= 85 || entry.dependencyLevel >= 85) {
    return "critical";
  }
  if (entry.tensionLevel >= 65 || entry.dependencyLevel >= 65) {
    return "high";
  }
  if (entry.tensionLevel >= 35 || entry.dependencyLevel >= 35) {
    return "medium";
  }
  return "low";
}

function ensureRequestedLedgerCoverage<T extends { entry: { ledgerType: LedgerType } }>(
  scoredEntries: Array<T & { score: number }>,
  requestedLedgerTypes: MemorySearchLedgerType[],
): Array<T & { score: number }> {
  if (requestedLedgerTypes.length === 0) {
    return scoredEntries;
  }

  const selected: Array<T & { score: number }> = [];
  const seenIds = new Set<string>();
  const push = (item: T & { score: number }) => {
    const id = "id" in item.entry ? String((item.entry as { id: string }).id) : "";
    if (id && seenIds.has(id)) {
      return;
    }
    if (id) {
      seenIds.add(id);
    }
    selected.push(item);
  };

  for (const requestedType of requestedLedgerTypes) {
    const match = scoredEntries.find((item) => item.entry.ledgerType === requestedType);
    if (match) {
      push(match);
    }
  }

  for (const item of scoredEntries) {
    push(item);
  }

  return selected;
}


function keywordMatchCount(text: string, keywords: string[]): number {
  const haystack = normalizeText(text);
  return keywords.filter((keyword) => keyword && haystack.includes(keyword)).length;
}

function matchesExactTerm(term: string, candidates: string[]): boolean {
  return candidates.some((candidate) => {
    const normalized = normalizeText(candidate);
    if (!normalized) {
      return false;
    }

    return normalized === term || normalized.includes(term) || term.includes(normalized);
  });
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function buildSemanticQueryText(chapterPlan: ChapterPlan): string {
  return [
    chapterPlan.chapterGoal,
    chapterPlan.emotionalGoal,
    chapterPlan.plannedOutcome,
    chapterPlan.sceneType,
    ...chapterPlan.sceneTags,
    ...chapterPlan.mustHitConflicts,
    ...(chapterPlan.beatConstraints ?? []),
    ...(chapterPlan.searchIntent?.topicQueries ?? []),
    ...(chapterPlan.searchIntent?.exactPhrases ?? []),
    ...(chapterPlan.commercial
      ? [
          chapterPlan.commercial.coreSellPoint,
          chapterPlan.commercial.visibleProblem,
          chapterPlan.commercial.externalTurn,
          chapterPlan.commercial.microPayoff,
          chapterPlan.commercial.readerPromise,
          chapterPlan.commercial.rewardTarget ?? "",
        ]
      : []),
  ].join(" ");
}

function buildSemanticVector(text: string): Map<string, number> {
  const tokens = tokenizeSemanticText(text);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const vector = new Map<string, number>();
  const length = Math.max(1, tokens.length);
  for (const [token, count] of counts.entries()) {
    vector.set(token, count / Math.sqrt(length));
  }

  return vector;
}

function cosineSimilarity(
  left: Map<string, number>,
  right: Map<string, number>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const value of left.values()) {
    leftNorm += value * value;
  }
  for (const value of right.values()) {
    rightNorm += value * value;
  }
  for (const [token, value] of left.entries()) {
    dot += value * (right.get(token) ?? 0);
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}

function tokenizeSemanticText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const tokens: string[] = [];
  const latinWords = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  tokens.push(...latinWords);

  const cjkGroups = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const group of cjkGroups) {
    const chars = [...group];
    for (const char of chars) {
      tokens.push(char);
    }
    for (let index = 0; index < chars.length - 1; index += 1) {
      tokens.push(`${chars[index]}${chars[index + 1]}`);
    }
    for (let index = 0; index < chars.length - 2; index += 1) {
      tokens.push(`${chars[index]}${chars[index + 1]}${chars[index + 2]}`);
    }
  }

  return tokens.filter(Boolean).slice(0, 160);
}

function extractTopSemanticTerms(text: string, limit: number): string[] {
  const tokens = tokenizeSemanticText(text);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function compareLedgerEntries(left: LedgerEntry, right: LedgerEntry): number {
  const priorityDiff = priorityWeight(right.priority) - priorityWeight(left.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const rightChapter = right.sourceChapterNumbers[right.sourceChapterNumbers.length - 1] ?? 0;
  const leftChapter = left.sourceChapterNumbers[left.sourceChapterNumbers.length - 1] ?? 0;
  if (rightChapter !== leftChapter) {
    return rightChapter - leftChapter;
  }

  return left.id.localeCompare(right.id);
}

function uniqueStrings(items: string[], limit: number): string[] {
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

function uniqueNumbers(items: number[], limit: number): number[] {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const item of items) {
    if (!Number.isFinite(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result.sort((left, right) => left - right);
}
