import { applyMemoryUpdaterResult } from "./memory-updater.js";
import {
  buildChapterCardSemanticText,
  buildExactSearchHits,
  buildMemorySemanticText,
  buildMemoryRetrievalPack,
  buildMemorySystemArtifacts,
  buildSemanticQueryText,
  toSemanticRetrievalHits,
} from "./memory-system.js";
import type {
  ExactSearchHit,
  MemoryChapterArtifactSnapshot,
  MemoryRetrievalPack,
  SemanticRetrievalHit,
} from "./memory-system.js";
import type { ChapterArtifact } from "./chapter-artifact.js";
import type {
  ChapterPlan,
  CharacterState,
  EntityId,
  StoryMemory,
} from "./types.js";

export type RetrievalEvalCaseType = "memory" | "exact_phrase" | "ledger_type";

export interface RetrievalEvalCase {
  id: EntityId;
  chapterNumber: number;
  caseType: RetrievalEvalCaseType;
  label: string;
  expectedValue: string;
  enabled: boolean;
  source: "auto_seed" | "manual";
  notes: string[];
}

export interface RetrievalEvalSet {
  projectId: string;
  generatedAt: string;
  cases: RetrievalEvalCase[];
}

export interface RetrievalEvalCaseResult {
  caseId: EntityId;
  chapterNumber: number;
  caseType: RetrievalEvalCaseType;
  label: string;
  expectedValue: string;
  passed: boolean;
  evidence: string[];
}

export interface RetrievalEvalChapterSummary {
  chapterNumber: number;
  totalCases: number;
  passedCases: number;
  failedCaseIds: EntityId[];
}

export interface RetrievalEvalReport {
  projectId: string;
  generatedAt: string;
  totalCases: number;
  passedCases: number;
  skippedCases: number;
  caseResults: RetrievalEvalCaseResult[];
  chapterSummaries: RetrievalEvalChapterSummary[];
}

interface RetrievalEvalChapterView {
  chapterNumber: number;
  plan: ChapterPlan;
  retrievalPack: MemoryRetrievalPack;
  exactSearchHits: ExactSearchHit[];
  corpusTexts: string[];
  availableLedgerTypes: string[];
}

export function buildRetrievalEvalSeed(args: {
  projectId: string;
  chapterArtifacts: ChapterArtifact[];
}): RetrievalEvalSet {
  const cases: RetrievalEvalCase[] = [];
  const seen = new Set<string>();

  const pushCase = (item: RetrievalEvalCase) => {
    const key = `${item.chapterNumber}|${item.caseType}|${item.expectedValue}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    cases.push(item);
  };

  for (const artifact of args.chapterArtifacts) {
    const chapterNumber = artifact.chapterNumber;
    const plan = artifact.plan;
    const memoryIds = uniqueStrings(
      [...plan.requiredMemories, ...(plan.searchIntent?.memoryIds ?? [])],
      6,
    );
    const exactPhrases = uniqueStrings(plan.searchIntent?.exactPhrases ?? [], 6);
    const ledgerTypes = uniqueStrings(plan.searchIntent?.ledgerTypes ?? [], 4);

    for (const memoryId of memoryIds) {
      pushCase({
        id: `retrieval-eval-ch${String(chapterNumber).padStart(3, "0")}-memory-${sanitizeId(memoryId)}`,
        chapterNumber,
        caseType: "memory",
        label: `Chapter ${chapterNumber} should recall memory ${memoryId}`,
        expectedValue: memoryId,
        enabled: true,
        source: "auto_seed",
        notes: ["Generated from requiredMemories/searchIntent.memoryIds."],
      });
    }

    for (const phrase of exactPhrases) {
      pushCase({
        id: `retrieval-eval-ch${String(chapterNumber).padStart(3, "0")}-phrase-${sanitizeId(phrase)}`,
        chapterNumber,
        caseType: "exact_phrase",
        label: `Chapter ${chapterNumber} should exact-hit phrase ${phrase}`,
        expectedValue: phrase,
        enabled: true,
        source: "auto_seed",
        notes: ["Generated from searchIntent.exactPhrases."],
      });
    }

    for (const ledgerType of ledgerTypes) {
      pushCase({
        id: `retrieval-eval-ch${String(chapterNumber).padStart(3, "0")}-ledger-${sanitizeId(ledgerType)}`,
        chapterNumber,
        caseType: "ledger_type",
        label: `Chapter ${chapterNumber} should recall ${ledgerType} ledger entries`,
        expectedValue: ledgerType,
        enabled: true,
        source: "auto_seed",
        notes: ["Generated from searchIntent.ledgerTypes."],
      });
    }
  }

  return {
    projectId: args.projectId,
    generatedAt: new Date().toISOString(),
    cases,
  };
}

export async function buildRetrievalEvalChapterViews(args: {
  chapterArtifacts: ChapterArtifact[];
  characterStates: CharacterState[];
  seedStoryMemories: StoryMemory[];
  resolveSemanticHits?: (input: {
    chapterPlan: ChapterPlan;
    storyMemories: StoryMemory[];
    chapterArtifacts: MemoryChapterArtifactSnapshot[];
  }) => Promise<SemanticRetrievalHit[] | undefined>;
}): Promise<RetrievalEvalChapterView[]> {
  const sortedArtifacts = [...args.chapterArtifacts].sort(
    (left, right) => left.chapterNumber - right.chapterNumber,
  );
  const views: RetrievalEvalChapterView[] = [];
  let storyMemories = cloneStoryMemories(args.seedStoryMemories);
  const priorArtifacts: ChapterArtifact[] = [];

  for (const artifact of sortedArtifacts) {
    const chapterArtifacts = priorArtifacts.map(asMemoryChapterArtifactSnapshot);
    const artifacts = buildMemorySystemArtifacts({
      storyMemories,
      characterStates: args.characterStates,
      chapterArtifacts,
    });
    const semanticOverrideHits = args.resolveSemanticHits
      ? await args.resolveSemanticHits({
          chapterPlan: artifact.plan,
          storyMemories,
          chapterArtifacts,
        })
      : undefined;
    const retrievalPack = buildMemoryRetrievalPack({
      chapterPlan: artifact.plan,
      storyMemories,
      characterStates: args.characterStates,
      chapterArtifacts,
      semanticOverrideHits,
    });
    const exactSearchHits = buildExactSearchHits({
      chapterPlan: artifact.plan,
      storyMemories,
      characterStates: args.characterStates,
      artifacts,
    });

    views.push({
      chapterNumber: artifact.chapterNumber,
      plan: artifact.plan,
      retrievalPack,
      exactSearchHits,
      corpusTexts: buildCorpusTexts({
        storyMemories,
        characterStates: args.characterStates,
        artifacts,
      }),
      availableLedgerTypes: collectAvailableLedgerTypes(artifacts),
    });

    storyMemories = applyMemoryUpdaterResult(
      storyMemories,
      artifact.memoryUpdate,
      artifact.chapterNumber,
    );
    priorArtifacts.push(artifact);
  }

  return views;
}

export function normalizeRetrievalEvalSetAgainstChapterViews(args: {
  evalSet: RetrievalEvalSet;
  chapterViews: RetrievalEvalChapterView[];
}): RetrievalEvalSet {
  const viewMap = new Map(args.chapterViews.map((view) => [view.chapterNumber, view]));

  return {
    ...args.evalSet,
    cases: args.evalSet.cases.map((item) => {
      const view = viewMap.get(item.chapterNumber);
      if (!view) {
        return {
          ...item,
          enabled: false,
          notes: uniqueStrings([...item.notes, "Disabled: no chapter view available."], 6),
        };
      }

      if (item.caseType === "exact_phrase") {
        const normalizedExpected = normalizeText(item.expectedValue);
        const hasCorpusSupport = view.corpusTexts.some((text) => text.includes(normalizedExpected));
        if (!hasCorpusSupport) {
          return {
            ...item,
            enabled: false,
            notes: uniqueStrings(
              [...item.notes, "Disabled: exact phrase not found in prior retrieval corpus."],
              6,
            ),
          };
        }
      }

      if (item.caseType === "ledger_type") {
        const normalizedExpected = normalizeText(item.expectedValue);
        const hasLedgerSupport = view.availableLedgerTypes.some(
          (ledgerType) => normalizeText(ledgerType) === normalizedExpected,
        );
        if (!hasLedgerSupport) {
          return {
            ...item,
            enabled: false,
            notes: uniqueStrings(
              [...item.notes, "Disabled: requested ledger type absent from prior retrieval corpus."],
              6,
            ),
          };
        }
      }

      return item;
    }),
  };
}

export function evaluateRetrievalCases(args: {
  projectId: string;
  evalSet: RetrievalEvalSet;
  chapterViews: RetrievalEvalChapterView[];
}): RetrievalEvalReport {
  const viewMap = new Map(args.chapterViews.map((view) => [view.chapterNumber, view]));
  const caseResults: RetrievalEvalCaseResult[] = [];
  let skippedCases = 0;

  for (const item of args.evalSet.cases) {
    if (!item.enabled) {
      skippedCases += 1;
      continue;
    }

    const view = viewMap.get(item.chapterNumber);
    if (!view) {
      skippedCases += 1;
      continue;
    }

    caseResults.push(evaluateSingleCase(item, view));
  }

  const chapterSummaryMap = new Map<number, RetrievalEvalChapterSummary>();
  for (const result of caseResults) {
    const summary =
      chapterSummaryMap.get(result.chapterNumber) ??
      {
        chapterNumber: result.chapterNumber,
        totalCases: 0,
        passedCases: 0,
        failedCaseIds: [],
      };
    summary.totalCases += 1;
    if (result.passed) {
      summary.passedCases += 1;
    } else {
      summary.failedCaseIds.push(result.caseId);
    }
    chapterSummaryMap.set(result.chapterNumber, summary);
  }

  const passedCases = caseResults.filter((item) => item.passed).length;

  return {
    projectId: args.projectId,
    generatedAt: new Date().toISOString(),
    totalCases: caseResults.length,
    passedCases,
    skippedCases,
    caseResults,
    chapterSummaries: [...chapterSummaryMap.values()].sort(
      (left, right) => left.chapterNumber - right.chapterNumber,
    ),
  };
}

function evaluateSingleCase(
  item: RetrievalEvalCase,
  view: RetrievalEvalChapterView,
): RetrievalEvalCaseResult {
  if (item.caseType === "memory") {
    const evidence = collectMemoryEvidence(item.expectedValue, view);
    return {
      caseId: item.id,
      chapterNumber: item.chapterNumber,
      caseType: item.caseType,
      label: item.label,
      expectedValue: item.expectedValue,
      passed: evidence.length > 0,
      evidence,
    };
  }

  if (item.caseType === "exact_phrase") {
    const evidence = collectExactPhraseEvidence(item.expectedValue, view);
    return {
      caseId: item.id,
      chapterNumber: item.chapterNumber,
      caseType: item.caseType,
      label: item.label,
      expectedValue: item.expectedValue,
      passed: evidence.length > 0,
      evidence,
    };
  }

  const normalizedLedgerType = normalizeText(item.expectedValue);
  const evidence = view.retrievalPack.relevantLedgerEntries
    .filter((entry) => normalizeText(entry.ledgerType) === normalizedLedgerType)
    .map((entry) => `${entry.ledgerType}:${entry.title}`);

  return {
    caseId: item.id,
    chapterNumber: item.chapterNumber,
    caseType: item.caseType,
    label: item.label,
    expectedValue: item.expectedValue,
    passed: evidence.length > 0,
    evidence,
  };
}

function collectMemoryEvidence(memoryId: string, view: RetrievalEvalChapterView): string[] {
  const evidence: string[] = [];

  for (const entry of view.retrievalPack.relevantLedgerEntries) {
    if (entry.sourceMemoryIds.includes(memoryId)) {
      evidence.push(`ledger:${entry.ledgerType}:${entry.title}`);
    }
  }

  for (const card of view.retrievalPack.relevantChapterCards) {
    if (card.memoryIds.includes(memoryId)) {
      evidence.push(`chapter_card:${card.chapterNumber}:${card.title}`);
    }
  }

  for (const hit of view.exactSearchHits) {
    if (hit.kind === "memory" && hit.targetId === memoryId) {
      evidence.push(`exact_hit:${hit.label}`);
    }
  }

  return uniqueStrings(evidence, 12);
}

function collectExactPhraseEvidence(
  phrase: string,
  view: RetrievalEvalChapterView,
): string[] {
  const normalizedExpected = normalizeText(phrase);
  const evidence: string[] = [];

  for (const hit of view.exactSearchHits) {
    if (
      normalizeText(hit.matchedPhrase) === normalizedExpected ||
      normalizeText(hit.label).includes(normalizedExpected)
    ) {
      evidence.push(`${hit.kind}:${hit.label}`);
    }
  }

  for (const entry of view.retrievalPack.relevantLedgerEntries) {
    if (containsPhrase([entry.title, entry.summary, ...entry.sourceMemoryIds], normalizedExpected)) {
      evidence.push(`ledger:${entry.title}`);
    }
  }

  for (const card of view.retrievalPack.relevantChapterCards) {
    if (
      containsPhrase(
        [card.title, card.summary, card.nextSituation, ...card.memoryIds, ...card.characterIds],
        normalizedExpected,
      )
    ) {
      evidence.push(`chapter_card:${card.title}`);
    }
  }

  return uniqueStrings(evidence, 12);
}

function asMemoryChapterArtifactSnapshot(
  artifact: ChapterArtifact,
): MemoryChapterArtifactSnapshot {
  return {
    chapterNumber: artifact.chapterNumber,
    plan: artifact.plan,
    writerResult: {
      title: artifact.writerResult.title,
    },
    memoryUpdate: artifact.memoryUpdate,
  };
}

function buildCorpusTexts(args: {
  storyMemories: StoryMemory[];
  characterStates: CharacterState[];
  artifacts: ReturnType<typeof buildMemorySystemArtifacts>;
}): string[] {
  return uniqueStrings(
    [
      ...args.storyMemories.flatMap((memory) => [
        memory.id,
        memory.title,
        memory.summary,
        ...memory.triggerConditions,
        ...memory.notes,
      ]),
      ...args.artifacts.chapterCards.flatMap((card) => [
        card.id,
        card.title,
        card.summary,
        card.nextSituation,
        card.sceneType,
        ...card.sceneTags,
        ...card.keywords,
      ]),
      ...[
        ...args.artifacts.ledgers.resources,
        ...args.artifacts.ledgers.promises,
        ...args.artifacts.ledgers.injuries,
        ...args.artifacts.ledgers.foreshadows,
      ].flatMap((entry) => [entry.id, entry.title, entry.summary, ...entry.tags]),
      ...args.artifacts.ledgers.relationships.flatMap((entry) => [
        entry.id,
        entry.publicLabel,
        entry.privateTruth,
        entry.relationshipType,
      ]),
      ...args.characterStates.flatMap((character) => [
        character.id,
        character.name,
        ...character.currentGoals,
        ...character.emotionalState,
        ...character.wounds,
        ...character.voiceNotes,
      ]),
    ].map(normalizeText),
    400,
  );
}

function collectAvailableLedgerTypes(
  artifacts: ReturnType<typeof buildMemorySystemArtifacts>,
): string[] {
  const result: string[] = [];

  if (artifacts.ledgers.resources.length > 0) {
    result.push("resource");
  }
  if (artifacts.ledgers.promises.length > 0) {
    result.push("promise");
  }
  if (artifacts.ledgers.injuries.length > 0) {
    result.push("injury");
  }
  if (artifacts.ledgers.foreshadows.length > 0) {
    result.push("foreshadow");
  }
  if (artifacts.ledgers.relationships.length > 0) {
    result.push("relationship");
  }

  return result;
}

function cloneStoryMemories(memories: StoryMemory[]): StoryMemory[] {
  return memories.map((memory) => ({
    ...memory,
    relatedCharacterIds: [...memory.relatedCharacterIds],
    relatedLocationIds: [...memory.relatedLocationIds],
    triggerConditions: [...memory.triggerConditions],
    notes: [...memory.notes],
  }));
}

function sanitizeId(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (cleaned) {
    return cleaned;
  }

  const fallback = [...value.trim()]
    .slice(0, 8)
    .map((char) => char.codePointAt(0)?.toString(16) ?? "x")
    .join("-");

  return fallback || "term";
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function containsPhrase(candidates: string[], normalizedExpected: string): boolean {
  return candidates.some((candidate) => normalizeText(candidate).includes(normalizedExpected));
}

function uniqueStrings<T extends string>(items: T[], limit: number): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}
