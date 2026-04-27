import type { TaskAuthorPack } from "./author-profile-packs.js";
import { buildMemoryRetrievalPack } from "./memory-system.js";
import type {
  ContextChapterCardSnapshot,
  ContextLedgerSnapshot,
  MemoryChapterArtifactSnapshot,
  SemanticRetrievalHit,
} from "./memory-system.js";
import type {
  ArcOutline,
  BeatOutline,
  ChapterPlan,
  CharacterState,
  EntityId,
  GenrePayoffPack,
  StoryMemory,
  StyleBible,
  ThemeBible,
  WorldFact,
} from "./types.js";

export interface ContextBuilderInput {
  task: "writer" | "reviewer";
  authorPack: TaskAuthorPack;
  themeBible: ThemeBible;
  styleBible: StyleBible;
  chapterPlan: ChapterPlan;
  genrePayoffPack?: GenrePayoffPack;
  arcOutline?: ArcOutline;
  beatOutline?: BeatOutline;
  chapterArtifacts?: MemoryChapterArtifactSnapshot[];
  semanticOverrideHits?: SemanticRetrievalHit[];
  unresolvedDelayedConsequences?: string[];
  characterStates: CharacterState[];
  storyMemories: StoryMemory[];
  worldFacts: WorldFact[];
}

export interface ContextCharacterSnapshot {
  id: EntityId;
  name: string;
  currentGoals: string[];
  emotionalState: string[];
  wounds: string[];
  voiceNotes: string[];
  decisionProfile?: {
    coreDesire: string;
    coreFear: string;
    falseBelief: string;
    defaultCopingStyle: string;
    controlPattern: string;
    unacceptableCosts: string[];
    likelyCompromises: string[];
    relationshipSoftSpots: string[];
    breakThresholds: string[];
  };
  activeRelationships: Array<{
    targetCharacterId: EntityId;
    publicLabel: string;
    tensionLevel: number;
    trustLevel: number;
  }>;
}

export interface ContextMemorySnapshot {
  id: EntityId;
  title: string;
  summary: string;
  kind: StoryMemory["kind"];
  priority: StoryMemory["priority"];
  triggerConditions: string[];
}

export interface ContextWorldFactSnapshot {
  id: EntityId;
  title: string;
  description: string;
  category: string;
  scope: WorldFact["scope"];
}

export interface ContextPack {
  task: "writer" | "reviewer";
  mustRules: string[];
  authorIdentityRules: string[];
  chapterExecutionReminders: string[];
  themePressure: string[];
  avoidRules: string[];
  taskRules: string[];
  readerValue?: {
    sellingPoint?: string;
    hook?: string;
    payoff?: string;
    genrePackId?: string;
    genrePackSummary?: string;
    genreHookBias: string[];
    genreRewardBias: string[];
    genreAvoidPatterns: string[];
    powerPatterns: string[];
    payoffPatterns: string[];
  };
  chapterObjective: {
    chapterType?: ChapterPlan["chapterType"];
    goal: string;
    emotionalGoal: string;
    plannedOutcome: string;
    sceneType: string;
    sceneTags: string[];
  };
  commercialSignals?: {
    openingMode?: string;
    coreSellPoint?: string;
    visibleProblem?: string;
    externalTurn?: string;
    microPayoff?: string;
    endHook?: string;
    readerPromise?: string;
    paragraphRhythm?: string;
    rewardType?: string;
    rewardTiming?: string;
    rewardTarget?: string;
  };
  activeCharacters: ContextCharacterSnapshot[];
  relevantMemories: ContextMemorySnapshot[];
  relevantLedgerEntries: ContextLedgerSnapshot[];
  relevantChapterCards: ContextChapterCardSnapshot[];
  relevantWorldFacts: ContextWorldFactSnapshot[];
  arcSignals: string[];
  chapterSignals: string[];
  retrievalSignals: string[];
  unresolvedDelayedConsequences: string[];
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

function asForbiddenRule(item: string): string {
  const normalized = item.trim();
  if (!normalized) {
    return normalized;
  }

  if (/^(do not|don't|avoid|never)\b/i.test(normalized)) {
    return normalized;
  }

  return `Do not: ${normalized}`;
}

function priorityWeight(priority: StoryMemory["priority"]): number {
  const weight = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  return weight[priority];
}

function buildTriggerKeywords(chapterPlan: ChapterPlan): string[] {
  return uniqueTrimmed(
    [
      chapterPlan.sceneType,
      chapterPlan.chapterGoal,
      chapterPlan.emotionalGoal,
      chapterPlan.plannedOutcome,
      ...chapterPlan.sceneTags,
      ...chapterPlan.mustHitConflicts,
      ...(chapterPlan.searchIntent?.topicQueries ?? []),
      ...(chapterPlan.searchIntent?.exactPhrases ?? []),
    ],
    20,
  ).map((item) => item.toLowerCase());
}

function memoryScore(
  memory: StoryMemory,
  chapterPlan: ChapterPlan,
  triggerKeywords: string[],
  semanticMemoryIds?: Set<string>,
): number {
  let score = 0;
  const exactTerms = (chapterPlan.searchIntent?.exactPhrases ?? []).map((item) =>
    item.trim().toLowerCase(),
  );

  if (chapterPlan.requiredMemories.includes(memory.id)) {
    score += 100;
  }
  if (chapterPlan.searchIntent?.memoryIds.includes(memory.id)) {
    score += 50;
  }

  score += priorityWeight(memory.priority) * 10;

  const triggerMatches = memory.triggerConditions.filter((condition) =>
    triggerKeywords.some(
      (keyword) =>
        keyword.includes(condition.toLowerCase()) || condition.toLowerCase().includes(keyword),
    ),
  ).length;
  score += triggerMatches * 15;

  const characterMatches = memory.relatedCharacterIds.filter((characterId) =>
    chapterPlan.requiredCharacters.includes(characterId),
  ).length;
  score += characterMatches * 8;
  const searchEntityMatches = memory.relatedCharacterIds.filter((characterId) =>
    chapterPlan.searchIntent?.entityIds.includes(characterId),
  ).length;
  score += searchEntityMatches * 6;
  if (
    exactTerms.some((term) =>
      [memory.id, memory.title, memory.summary].some((value) => value.toLowerCase().includes(term)),
    )
  ) {
    score += 40;
  }
  if (semanticMemoryIds?.has(memory.id)) {
    score += 34;
  }

  if (memory.status === "active" || memory.status === "triggered") {
    score += 5;
  }

  return score;
}

function worldFactScore(
  fact: WorldFact,
  chapterPlan: ChapterPlan,
  triggerKeywords: string[],
): number {
  let score = 0;
  const exactTerms = (chapterPlan.searchIntent?.exactPhrases ?? []).map((item) =>
    item.trim().toLowerCase(),
  );

  const characterMatches = fact.relatedCharacterIds.filter((characterId) =>
    chapterPlan.requiredCharacters.includes(characterId),
  ).length;
  score += characterMatches * 10;
  const searchEntityMatches = fact.relatedCharacterIds.filter((characterId) =>
    chapterPlan.searchIntent?.entityIds.includes(characterId),
  ).length;
  score += searchEntityMatches * 8;

  const haystack = `${fact.title} ${fact.description} ${fact.category}`.toLowerCase();
  const keywordMatches = triggerKeywords.filter((keyword) => haystack.includes(keyword)).length;
  score += keywordMatches * 6;
  if (exactTerms.some((term) => haystack.includes(term))) {
    score += 24;
  }

  if (fact.scope === "local" || fact.scope === "character_specific") {
    score += 3;
  }

  if (fact.visibility !== "hidden") {
    score += 2;
  }

  return score;
}

export function buildContextPack(input: ContextBuilderInput): ContextPack {
  const triggerKeywords = buildTriggerKeywords(input.chapterPlan);
  const retrievalPack = buildMemoryRetrievalPack({
    chapterPlan: input.chapterPlan,
    storyMemories: input.storyMemories,
    characterStates: input.characterStates,
    chapterArtifacts: input.chapterArtifacts ?? [],
    semanticOverrideHits: input.semanticOverrideHits,
  });
  const semanticMemoryIds = new Set(
    retrievalPack.semanticHits
      .filter((item) => item.kind === "memory")
      .map((item) => item.sourceId),
  );

  const activeCharacters = input.characterStates
    .filter((character) => input.chapterPlan.requiredCharacters.includes(character.id))
    .slice(0, 4)
    .map((character) => ({
      id: character.id,
      name: character.name,
      currentGoals: character.currentGoals.slice(0, 3),
      emotionalState: character.emotionalState.slice(0, 3),
      wounds: character.wounds.slice(0, 2),
      voiceNotes: character.voiceNotes.slice(0, 2),
      decisionProfile: character.decisionProfile
        ? {
            coreDesire: character.decisionProfile.coreDesire,
            coreFear: character.decisionProfile.coreFear,
            falseBelief: character.decisionProfile.falseBelief,
            defaultCopingStyle: character.decisionProfile.defaultCopingStyle,
            controlPattern: character.decisionProfile.controlPattern,
            unacceptableCosts: character.decisionProfile.unacceptableCosts.slice(0, 3),
            likelyCompromises: character.decisionProfile.likelyCompromises.slice(0, 3),
            relationshipSoftSpots: character.decisionProfile.relationshipSoftSpots.slice(0, 3),
            breakThresholds: character.decisionProfile.breakThresholds.slice(0, 3),
          }
        : undefined,
      activeRelationships: character.relationships.slice(0, 3).map((relationship) => ({
        targetCharacterId: relationship.targetCharacterId,
        publicLabel: relationship.publicLabel,
        tensionLevel: relationship.tensionLevel,
        trustLevel: relationship.trustLevel,
      })),
    }));

  const relevantMemories = input.storyMemories
    .map((memory) => ({
      memory,
      score: memoryScore(memory, input.chapterPlan, triggerKeywords, semanticMemoryIds),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ memory }) => ({
      id: memory.id,
      title: memory.title,
      summary: memory.summary,
      kind: memory.kind,
      priority: memory.priority,
      triggerConditions: memory.triggerConditions.slice(0, 3),
    }));

  const relevantWorldFacts = input.worldFacts
    .map((fact) => ({
      fact,
      score: worldFactScore(fact, input.chapterPlan, triggerKeywords),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ fact }) => ({
      id: fact.id,
      title: fact.title,
      description: fact.description,
      category: fact.category,
      scope: fact.scope,
    }));

  const arcSignals = uniqueTrimmed(
    [
      input.arcOutline?.arcSellingPoint ? `Arc selling point: ${input.arcOutline.arcSellingPoint}` : "",
      input.arcOutline?.arcHook ? `Arc hook: ${input.arcOutline.arcHook}` : "",
      input.arcOutline?.arcPayoff ? `Arc payoff: ${input.arcOutline.arcPayoff}` : "",
    ],
    8,
  );

  const chapterSignals = uniqueTrimmed(
    [
      input.chapterPlan.chapterNumber
        ? `Chapter number: ${input.chapterPlan.chapterNumber}`
        : "",
      input.chapterPlan.chapterType
        ? `Chapter type: ${input.chapterPlan.chapterType}`
        : "",
      `Chapter goal: ${input.chapterPlan.chapterGoal}`,
      `Emotional goal: ${input.chapterPlan.emotionalGoal}`,
      `Planned outcome: ${input.chapterPlan.plannedOutcome}`,
      input.chapterPlan.commercial?.coreSellPoint
        ? `Commercial sell point: ${input.chapterPlan.commercial.coreSellPoint}`
        : "",
      input.chapterPlan.commercial?.visibleProblem
        ? `Visible problem: ${input.chapterPlan.commercial.visibleProblem}`
        : "",
      input.chapterPlan.commercial?.readerPromise
        ? `Reader promise: ${input.chapterPlan.commercial.readerPromise}`
        : "",
      input.beatOutline?.decisionPressure
        ? `Decision pressure: ${input.beatOutline.decisionPressure}`
        : "",
      input.beatOutline?.likelyChoice
        ? `Likely choice: ${input.beatOutline.likelyChoice}`
        : "",
      input.beatOutline?.immediateConsequence
        ? `Immediate consequence: ${input.beatOutline.immediateConsequence}`
        : "",
      input.beatOutline?.delayedConsequence
        ? `Delayed consequence: ${input.beatOutline.delayedConsequence}`
        : "",
      ...(input.unresolvedDelayedConsequences ?? []).map(
        (item) => `Unresolved delayed consequence: ${item}`,
      ),
    ],
    10,
  );

  return {
    task: input.task,
    mustRules: uniqueTrimmed(
      [
        ...input.authorPack.mustRules,
        ...(input.chapterPlan.beatConstraints ?? []).map(
          (item) => `Honor beat constraint: ${item}`,
        ),
        ...input.chapterPlan.disallowedMoves.map(asForbiddenRule),
      ],
      10,
    ),
    authorIdentityRules: uniqueTrimmed(
      [
        input.authorPack.summary,
        ...input.authorPack.globalPreferences,
        ...input.authorPack.taskSpecificPreferences,
      ],
      12,
    ),
    chapterExecutionReminders: uniqueTrimmed(
      [...input.chapterPlan.styleReminders],
      8,
    ),
    themePressure: uniqueTrimmed(
      [
        input.themeBible.coreTheme,
        ...input.themeBible.subThemes,
        `Ending target: ${input.themeBible.endingTarget}`,
        `Emotional destination: ${input.themeBible.emotionalDestination}`,
      ],
      8,
    ),
    avoidRules: uniqueTrimmed(
      [
        ...input.styleBible.antiPatterns.map((item) => `Avoid: ${item}`),
      ],
      10,
    ),
    taskRules: uniqueTrimmed(
      input.task === "reviewer" ? input.authorPack.reviewChecks : input.authorPack.taskRules,
      12,
    ),
    readerValue: {
      sellingPoint: input.arcOutline?.arcSellingPoint,
      hook: input.arcOutline?.arcHook,
      payoff: input.arcOutline?.arcPayoff,
      genrePackId: input.genrePayoffPack?.id,
      genrePackSummary: input.genrePayoffPack?.summary,
      genreHookBias: uniqueTrimmed(input.genrePayoffPack?.hookBias ?? [], 3),
      genreRewardBias: uniqueTrimmed(input.genrePayoffPack?.microPayoffBias ?? [], 3),
      genreAvoidPatterns: uniqueTrimmed(input.genrePayoffPack?.avoidPatterns ?? [], 3),
      powerPatterns: uniqueTrimmed(input.arcOutline?.primaryPowerPatternIds ?? [], 3),
      payoffPatterns: uniqueTrimmed(
        [
          ...(input.arcOutline?.primaryPayoffPatternIds ?? []),
          ...(input.beatOutline?.payoffPatternIds ?? []),
          ...(input.chapterPlan.payoffPatternIds ?? []),
        ],
        4,
      ),
    },
    chapterObjective: {
      chapterType: input.chapterPlan.chapterType,
      goal: input.chapterPlan.chapterGoal,
      emotionalGoal: input.chapterPlan.emotionalGoal,
      plannedOutcome: input.chapterPlan.plannedOutcome,
      sceneType: input.chapterPlan.sceneType,
      sceneTags: input.chapterPlan.sceneTags.slice(0, 5),
    },
    commercialSignals: input.chapterPlan.commercial
      ? {
          openingMode: input.chapterPlan.commercial.openingMode,
          coreSellPoint: input.chapterPlan.commercial.coreSellPoint,
          visibleProblem: input.chapterPlan.commercial.visibleProblem,
          externalTurn: input.chapterPlan.commercial.externalTurn,
          microPayoff: input.chapterPlan.commercial.microPayoff,
          endHook: input.chapterPlan.commercial.endHook,
          readerPromise: input.chapterPlan.commercial.readerPromise,
          paragraphRhythm: input.chapterPlan.commercial.paragraphRhythm,
          rewardType: input.chapterPlan.commercial.rewardType,
          rewardTiming: input.chapterPlan.commercial.rewardTiming,
          rewardTarget: input.chapterPlan.commercial.rewardTarget,
        }
      : undefined,
    activeCharacters,
    relevantMemories,
    relevantLedgerEntries: retrievalPack.relevantLedgerEntries,
    relevantChapterCards: retrievalPack.relevantChapterCards,
    relevantWorldFacts,
    arcSignals,
    chapterSignals,
    retrievalSignals: uniqueTrimmed(
      [
        ...retrievalPack.retrievalSignals,
        ...(input.unresolvedDelayedConsequences?.length
          ? [
              `Role-driven carryover: ${input.unresolvedDelayedConsequences.length} unresolved delayed consequences are still active.`,
            ]
          : []),
      ],
      12,
    ),
    unresolvedDelayedConsequences: uniqueTrimmed(
      input.unresolvedDelayedConsequences ?? [],
      6,
    ),
  };
}
