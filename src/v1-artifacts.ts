import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildContextPack,
  buildExactSearchHits,
  buildMemoryRetrievalPack,
  buildMemorySystemArtifacts,
  buildSpecializedReviewerViews,
  toSemanticRetrievalHits,
  type ChapterArtifact,
  type ChapterPlan,
  type CharacterState,
  type StoryMemory,
} from "./domain/index.js";
import type { ChatMessage } from "./llm/types.js";
import { FileProjectRepository } from "./storage/index.js";
import {
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterRelationshipShiftPath,
} from "./v1-paths.js";
import type {
  ConsequenceEdgeArtifact,
  DecisionLogArtifact,
  RelationshipShiftArtifact,
} from "./v1-role-drive.js";

export async function writePromptDebug(args: {
  projectId: string;
  scope: "outline" | "chapter";
  label: string;
  messages: ChatMessage[];
}): Promise<void> {
  const dir = path.resolve(
    process.cwd(),
    "data",
    "projects",
    args.projectId,
    "debug",
    "prompts",
    args.scope,
  );
  await mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_${args.label}.json`;
  await writeFile(
    path.join(dir, filename),
    JSON.stringify(
      {
        projectId: args.projectId,
        scope: args.scope,
        label: args.label,
        generatedAt: new Date().toISOString(),
        messages: args.messages,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

export async function writeJsonArtifact(filepath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readJsonArtifact<T>(filepath: string): Promise<T | null> {
  try {
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function loadRoleDrivenArtifacts(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<{
  decisionLog: DecisionLogArtifact | null;
  relationshipShift: RelationshipShiftArtifact | null;
  consequenceEdges: ConsequenceEdgeArtifact | null;
}> {
  const [decisionLog, relationshipShift, consequenceEdges] = await Promise.all([
    readJsonArtifact<DecisionLogArtifact>(
      chapterDecisionLogPath(args.projectId, args.chapterNumber),
    ),
    readJsonArtifact<RelationshipShiftArtifact>(
      chapterRelationshipShiftPath(args.projectId, args.chapterNumber),
    ),
    readJsonArtifact<ConsequenceEdgeArtifact>(
      chapterConsequenceEdgesPath(args.projectId, args.chapterNumber),
    ),
  ]);

  return {
    decisionLog,
    relationshipShift,
    consequenceEdges,
  };
}

export async function writeMemorySystemOutputs(args: {
  projectId: string;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: ChapterArtifact[];
}): Promise<void> {
  const memoryArtifacts = buildMemorySystemArtifacts({
    storyMemories: args.storyMemories,
    characterStates: args.characterStates,
    chapterArtifacts: args.chapterArtifacts,
  });
  const root = path.resolve(process.cwd(), "data", "projects", args.projectId, "memory");

  await Promise.all([
    writeJsonArtifact(path.join(root, "chapter-cards.json"), memoryArtifacts.chapterCards),
    writeJsonArtifact(path.join(root, "ledgers", "resources.json"), memoryArtifacts.ledgers.resources),
    writeJsonArtifact(path.join(root, "ledgers", "promises.json"), memoryArtifacts.ledgers.promises),
    writeJsonArtifact(path.join(root, "ledgers", "injuries.json"), memoryArtifacts.ledgers.injuries),
    writeJsonArtifact(
      path.join(root, "ledgers", "foreshadows.json"),
      memoryArtifacts.ledgers.foreshadows,
    ),
    writeJsonArtifact(
      path.join(root, "ledgers", "relationships.json"),
      memoryArtifacts.ledgers.relationships,
    ),
    writeJsonArtifact(path.join(root, "ledgers", "timeline.json"), memoryArtifacts.ledgers.timeline),
    writeJsonArtifact(
      path.join(root, "retrieval", "entity-chapter-map.json"),
      memoryArtifacts.entityChapterIndex,
    ),
    writeJsonArtifact(
      path.join(root, "retrieval", "semantic-index.json"),
      memoryArtifacts.semanticIndex,
    ),
    writeJsonArtifact(
      path.join(root, "graph", "story-graph.json"),
      memoryArtifacts.storyGraph,
    ),
    writeJsonArtifact(
      path.join(root, "digests", "active-threads.json"),
      memoryArtifacts.activeThreadDigest,
    ),
  ]);
}

export async function writeRetrievalDebugReport(args: {
  projectId: string;
  chapterNumber: number;
  chapterPlan: ChapterPlan;
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  chapterArtifacts: ChapterArtifact[];
  semanticOverrideHits?: ReturnType<typeof toSemanticRetrievalHits>;
  writerContextPack: ReturnType<typeof buildContextPack>;
  reviewerContextPack: ReturnType<typeof buildContextPack>;
  specializedViews: ReturnType<typeof buildSpecializedReviewerViews>;
}): Promise<void> {
  const root = path.resolve(
    process.cwd(),
    "data",
    "projects",
    args.projectId,
    "memory",
    "retrieval",
  );

  await writeJsonArtifact(
    path.join(root, `chapter-${String(args.chapterNumber).padStart(3, "0")}.json`),
    {
      chapterNumber: args.chapterNumber,
      searchIntent: args.chapterPlan.searchIntent ?? null,
      commercial: args.chapterPlan.commercial ?? null,
      exactSearchHits: buildExactSearchHits({
        chapterPlan: args.chapterPlan,
        storyMemories: args.storyMemories,
        characterStates: args.characterStates,
        artifacts: buildMemorySystemArtifacts({
          storyMemories: args.storyMemories,
          characterStates: args.characterStates,
          chapterArtifacts: args.chapterArtifacts,
        }),
      }),
      writerRetrievalSignals: args.writerContextPack.retrievalSignals,
      reviewerRetrievalSignals: args.reviewerContextPack.retrievalSignals,
      semanticHits: buildMemoryRetrievalPack({
        chapterPlan: args.chapterPlan,
        storyMemories: args.storyMemories,
        characterStates: args.characterStates,
        chapterArtifacts: args.chapterArtifacts,
        semanticOverrideHits: args.semanticOverrideHits,
      }).semanticHits,
      graphHits: buildMemoryRetrievalPack({
        chapterPlan: args.chapterPlan,
        storyMemories: args.storyMemories,
        characterStates: args.characterStates,
        chapterArtifacts: args.chapterArtifacts,
        semanticOverrideHits: args.semanticOverrideHits,
      }).graphHits,
      relevantLedgerEntries: args.writerContextPack.relevantLedgerEntries,
      relevantChapterCards: args.writerContextPack.relevantChapterCards,
      relevantWorldFacts: args.writerContextPack.relevantWorldFacts,
      resourceCandidates: args.specializedViews.resourceCandidates,
      relationshipCandidates: args.specializedViews.relationshipCandidates,
    },
  );
}

export async function rebuildMemorySystemOutputsForProject(
  repository: FileProjectRepository,
  loadAllChapterArtifacts: (
    repository: FileProjectRepository,
    projectId: string,
  ) => Promise<ChapterArtifact[]>,
  projectId: string,
  storyMemories?: StoryMemory[],
  characterStates?: CharacterState[],
): Promise<void> {
  const [loadedMemories, loadedCharacters, chapterArtifacts] = await Promise.all([
    storyMemories ? Promise.resolve(storyMemories) : repository.loadStoryMemories(projectId),
    characterStates ? Promise.resolve(characterStates) : repository.loadCharacterStates(projectId),
    loadAllChapterArtifacts(repository, projectId),
  ]);

  await writeMemorySystemOutputs({
    projectId,
    storyMemories: loadedMemories,
    characterStates: loadedCharacters,
    chapterArtifacts,
  });
}
