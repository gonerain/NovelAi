import type { TaskAuthorPack } from "./author-profile-packs.js";
import type {
  ChapterPlan,
  CharacterState,
  EntityId,
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
  authorRules: string[];
  hardConstraints: string[];
  chapterObjective: {
    goal: string;
    emotionalGoal: string;
    plannedOutcome: string;
    sceneType: string;
    sceneTags: string[];
  };
  activeCharacters: ContextCharacterSnapshot[];
  relevantMemories: ContextMemorySnapshot[];
  relevantWorldFacts: ContextWorldFactSnapshot[];
  promptCapsule: string[];
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
    ],
    20,
  ).map((item) => item.toLowerCase());
}

function memoryScore(
  memory: StoryMemory,
  chapterPlan: ChapterPlan,
  triggerKeywords: string[],
): number {
  let score = 0;

  if (chapterPlan.requiredMemories.includes(memory.id)) {
    score += 100;
  }

  score += priorityWeight(memory.priority) * 10;

  const triggerMatches = memory.triggerConditions.filter((condition) =>
    triggerKeywords.some(
      (keyword) =>
        keyword.includes(condition.toLowerCase()) ||
        condition.toLowerCase().includes(keyword),
    ),
  ).length;
  score += triggerMatches * 15;

  const characterMatches = memory.relatedCharacterIds.filter((characterId) =>
    chapterPlan.requiredCharacters.includes(characterId),
  ).length;
  score += characterMatches * 8;

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

  const characterMatches = fact.relatedCharacterIds.filter((characterId) =>
    chapterPlan.requiredCharacters.includes(characterId),
  ).length;
  score += characterMatches * 10;

  const haystack = `${fact.title} ${fact.description} ${fact.category}`.toLowerCase();
  const keywordMatches = triggerKeywords.filter((keyword) =>
    haystack.includes(keyword),
  ).length;
  score += keywordMatches * 6;

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
      score: memoryScore(memory, input.chapterPlan, triggerKeywords),
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

  const authorRules = uniqueTrimmed(
    [
      ...input.authorPack.softPreferences,
      ...input.chapterPlan.styleReminders,
      ...input.themeBible.subThemes,
      ...input.styleBible.antiPatterns.map((item) => `avoid:${item}`),
    ],
    8,
  );

  const promptCapsule = uniqueTrimmed(
    [
      ...input.authorPack.promptCapsule,
      `章节目标：${input.chapterPlan.chapterGoal}`,
      `情绪目标：${input.chapterPlan.emotionalGoal}`,
      `预期结果：${input.chapterPlan.plannedOutcome}`,
    ],
    10,
  );

  return {
    task: input.task,
    authorRules,
    hardConstraints: uniqueTrimmed(
      [...input.authorPack.hardConstraints, ...input.chapterPlan.disallowedMoves],
      6,
    ),
    chapterObjective: {
      goal: input.chapterPlan.chapterGoal,
      emotionalGoal: input.chapterPlan.emotionalGoal,
      plannedOutcome: input.chapterPlan.plannedOutcome,
      sceneType: input.chapterPlan.sceneType,
      sceneTags: input.chapterPlan.sceneTags.slice(0, 5),
    },
    activeCharacters,
    relevantMemories,
    relevantWorldFacts,
    promptCapsule,
  };
}
