import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  pickArcForChapterDeterministic,
  pickBeatForChapterDeterministic,
  applyMemoryUpdaterResult,
  buildContextPack,
  buildDerivedAuthorProfilePacks,
  defaultPayoffPatterns,
  mapAuthorInterviewToProfile,
  normalizeAuthorInterviewResult,
  type ArcOutline,
  type AuthorInterviewSessionInput,
  type BeatOutline,
  type ChapterArtifact,
  type ChapterPlan,
  type CharacterState,
  type DerivedAuthorProfilePacks,
  type FactConsistencyReviewerResult,
  type MemoryUpdaterResult,
  type MissingResourceReviewerResult,
  type StoryOutline,
  type StoryMemory,
  type StorySetup,
  type StyleBible,
  type ThemeBible,
  type WorldFact,
  type WriterResult,
  shouldRewriteForConsistency,
  validateAuthorInterviewResult,
} from "./domain/index.js";
import {
  demoArcOutlines,
  demoBeatOutlines,
  demoCharacterStates,
  demoPremise,
  demoProjectTitle,
  demoStoryOutline,
  demoStoryMemories,
  demoStorySetup,
  demoStyleBible,
  demoThemeBible,
  demoWorldFacts,
} from "./defaults/demo-project.js";
import {
  buildInterviewInputFromQuizAnswers,
  formatAuthorPresetCatalog as formatAuthorPresetCatalogText,
  getAuthorInterviewPresetById,
} from "./defaults/author-presets.js";
import { LlmService } from "./llm/service.js";
import type { ChatMessage } from "./llm/types.js";
import {
  authorInterviewDisplayDraftSchema,
  authorInterviewNormalizedDraftSchema,
  buildAuthorInterviewDisplayMessages,
  buildAuthorInterviewNormalizeMessages,
  buildAuthorInterviewSmallModelNormalizeMessages,
  buildFactConsistencyReviewMessages,
  buildMemoryUpdaterMessages,
  buildMissingResourceReviewMessages,
  buildRewriterMessages,
  buildPlannerMessages,
  buildWriterMessages,
  factConsistencyReviewerResultSchema,
  memoryUpdaterResultSchema,
  missingResourceReviewerResultSchema,
  plannerResultSchema,
} from "./prompts/index.js";
import { parseWriterLikeOutput } from "./soft-output.js";
import { FileProjectRepository } from "./storage/index.js";

function logStage(stage: string, detail: string): void {
  console.log(`[${stage}] ${detail}`);
}

async function writePromptDebug(args: {
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

export interface V1RunOptions {
  projectId: string;
  mode: "first-n" | "chapter";
  count?: number;
  chapterNumber?: number;
}

export interface V1RunResult {
  projectId: string;
  targetChapter: number;
  generatedChapterNumbers: number[];
  artifacts: ChapterArtifact[];
  validationIssues: string[];
}

interface ProjectBaseState {
  storySetup: StorySetup;
  storyOutline: StoryOutline;
  arcOutlines: ArcOutline[];
  beatOutlines: BeatOutline[];
  authorPacks: DerivedAuthorProfilePacks;
  themeBible: ThemeBible;
  styleBible: StyleBible;
  characterStates: CharacterState[];
  worldFacts: WorldFact[];
  storyMemories: StoryMemory[];
  chapterPlans: ChapterPlan[];
}

interface InvalidateResult {
  projectId: string;
  chapterNumber: number;
  deletedChapterNumbers: number[];
  remainingChapterPlans: number;
  remainingMemories: number;
}

function assertChapterPlanningAnchors(args: {
  projectId: string;
  chapterNumber: number;
  beatOutlines: BeatOutline[];
  currentArc: ArcOutline | undefined;
  currentBeat: BeatOutline | undefined;
}): void {
  if (!args.currentArc) {
    throw new Error(
      [
        `No arc outline found for project=${args.projectId}, chapter=${args.chapterNumber}.`,
        `Run: ./run-v1.sh outline generate-stack --project ${args.projectId} --count 250`,
        `or:  .\\run-v1.ps1 outline generate-stack --project ${args.projectId} --count 250`,
      ].join("\n"),
    );
  }

  const beatsInArc = args.beatOutlines.filter((beat) => beat.arcId === args.currentArc?.id);
  if (beatsInArc.length === 0 || !args.currentBeat) {
    throw new Error(
      [
        `No beat outline found for project=${args.projectId}, arc=${args.currentArc.id}, chapter=${args.chapterNumber}.`,
        `Run: ./run-v1.sh outline generate-stack --project ${args.projectId} --count 250`,
        `or:  .\\run-v1.ps1 outline generate-stack --project ${args.projectId} --count 250`,
      ].join("\n"),
    );
  }
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

function stripGeneratedChapterNotes(notes: string[]): string[] {
  return uniqueStrings(
    notes.filter((note) => !/^Chapter\s+\d+:/i.test(note.trim())),
    12,
  );
}

function deriveFallbackSeedMemories(memories: StoryMemory[]): StoryMemory[] {
  const nongenerated = memories.filter((memory) => !memory.id.startsWith("chapter-"));
  const nongeneratedIds = new Set(nongenerated.map((memory) => memory.id));
  const demoIds = new Set(demoStoryMemories.map((memory) => memory.id));

  if (
    nongenerated.length > 0 &&
    nongenerated.every((memory) => demoIds.has(memory.id))
  ) {
    return demoStoryMemories
      .filter((memory) => nongeneratedIds.has(memory.id))
      .map((memory) => ({ ...memory, notes: [...memory.notes] }));
  }

  return nongenerated.map((memory) => ({
    ...memory,
    status: "active",
    lastReferencedIn: memory.introducedIn,
    notes: stripGeneratedChapterNotes(memory.notes),
  }));
}

async function loadSeedStoryMemories(
  repository: FileProjectRepository,
  projectId: string,
  currentMemories: StoryMemory[],
): Promise<StoryMemory[]> {
  const existingSeed = await repository.loadSeedStoryMemories(projectId);
  if (existingSeed.length > 0) {
    return existingSeed;
  }

  const fallbackSeed = deriveFallbackSeedMemories(currentMemories);
  await repository.saveSeedStoryMemories(projectId, fallbackSeed);
  return fallbackSeed;
}

function normalizePayoffPatternIds(args: {
  plannerIds?: string[];
  currentArc?: ArcOutline;
  currentBeat?: BeatOutline;
}): string[] {
  const validIds = new Set(defaultPayoffPatterns.map((pattern) => pattern.id));
  const preferredIds = [
    ...(args.currentBeat?.payoffPatternIds ?? []),
    ...(args.currentArc?.primaryPayoffPatternIds ?? []),
  ].filter((id, index, items) => Boolean(id) && items.indexOf(id) === index);

  const filteredPlannerIds = (args.plannerIds ?? []).filter((id) => validIds.has(id));

  if (filteredPlannerIds.length > 0) {
    const allowedPreferred = new Set(preferredIds);
    const aligned = filteredPlannerIds.filter((id) => allowedPreferred.has(id));
    return aligned.length > 0 ? aligned.slice(0, 2) : filteredPlannerIds.slice(0, 2);
  }

  return preferredIds.filter((id) => validIds.has(id)).slice(0, 2);
}

function upsertChapterPlan(chapterPlans: ChapterPlan[], chapterPlan: ChapterPlan): ChapterPlan[] {
  const chapterNumber = chapterPlan.chapterNumber;
  if (!chapterNumber) {
    return [...chapterPlans, chapterPlan];
  }

  const filtered = chapterPlans.filter((item) => item.chapterNumber !== chapterNumber);
  return [...filtered, chapterPlan].sort(
    (left, right) => (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0),
  );
}

function buildRecentConsequences(
  artifact: ChapterArtifact | null,
  fallbackGoal: string,
): string[] {
  if (!artifact) {
    return [];
  }

  return uniqueStrings(
    [
      artifact.memoryUpdate.chapterSummary,
      ...artifact.memoryUpdate.carryForwardHints,
      artifact.plan.plannedOutcome,
      fallbackGoal,
    ],
    4,
  );
}

function hasBlockingReviewerIssues(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): boolean {
  const hasHighFact = args.fact.findings.some((item) => item.severity === "high");
  return hasHighFact;
}

function normalizeReviewerResults(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
} {
  const missingSeen = new Set<string>();
  const missingCandidates = args.missing.findings
    .filter((item) => {
      const key = `${item.issueType}|${item.memoryId}|${item.title}|${item.suggestedFix}`.trim();
      if (!key || missingSeen.has(key)) {
        return false;
      }
      missingSeen.add(key);
      return true;
    });
  const missingHigh = missingCandidates.filter((item) => item.severity === "high").slice(0, 1);
  const missingOthers = missingCandidates
    .filter((item) => item.severity !== "high")
    .slice(0, 2);
  const missingFindings = [...missingHigh, ...missingOthers].slice(0, 3);

  const factSeen = new Set<string>();
  const factFindings = args.fact.findings
    .filter((item) => {
      const key = `${item.issueType}|${item.title}|${item.violatedFactIds.join(",")}|${item.suggestedFix}`.trim();
      if (!key || factSeen.has(key)) {
        return false;
      }
      factSeen.add(key);
      return true;
    })
    .slice(0, 3);

  return {
    missing: { ...args.missing, findings: missingFindings },
    fact: { ...args.fact, findings: factFindings },
  };
}

function countReviewerFindingsBySeverity(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): { high: number; medium: number; low: number } {
  const allFindings = [...args.fact.findings];
  return {
    high: allFindings.filter((item) => item.severity === "high").length,
    medium: allFindings.filter((item) => item.severity === "medium").length,
    low: allFindings.filter((item) => item.severity === "low").length,
  };
}

function buildRewritePlan(args: {
  missing: MissingResourceReviewerResult;
  fact: FactConsistencyReviewerResult;
}): {
  mode: "repair_first" | "hybrid_upgrade" | "quality_boost";
  objective: string;
} {
  const severity = countReviewerFindingsBySeverity(args);

  if (severity.high > 0) {
    return {
      mode: "repair_first",
      objective:
        "Fix all high-severity consistency issues first; keep chapter events and outcomes unchanged.",
    };
  }

  if (severity.medium > 0 || severity.low >= 2) {
    return {
      mode: "hybrid_upgrade",
      objective:
        "Resolve fact and role consistency findings while keeping chapter events and outcomes unchanged.",
    };
  }

  return {
    mode: "quality_boost",
    objective:
      "No fact/role consistency findings detected. Keep the draft unchanged unless minor clarity touch-ups are necessary.",
  };
}

async function ensureBootstrappedProject(
  service: LlmService,
  repository: FileProjectRepository,
  projectId: string,
  authorPresetId?: string,
): Promise<ProjectBaseState & { validationIssues: string[] }> {
  logStage("bootstrap", `ensure project=${projectId}`);
  const existingProject = await repository.getProject(projectId);
  if (!existingProject) {
    await repository.createProject({
      id: projectId,
      title: demoProjectTitle,
    });
  }

  let authorProfile = await repository.loadAuthorProfile(projectId);
  let authorPacks = await repository.loadDerivedAuthorProfilePacks(projectId);
  const validationIssues: string[] = [];

  if (!authorProfile) {
    logStage("bootstrap", "author profile missing -> run interview");
    const selectedPreset = getAuthorInterviewPresetById(authorPresetId);
    const interviewInput = {
      ...selectedPreset.interviewInput,
      targetProject: {
        title: demoProjectTitle,
        premise: demoPremise,
        themeHint: "power, betrayal, and costly redemption",
      },
    };
    const generated = await generateAuthorProfileFromInterviewInput({
      service,
      interviewInput,
      projectId,
    });
    validationIssues.push(...generated.validationIssues);
    authorProfile = generated.authorProfile;
    authorPacks = generated.authorPacks;

    await repository.saveAuthorProfile(projectId, authorProfile);
    await repository.saveDerivedAuthorProfilePacks(projectId, authorPacks);
    logStage("bootstrap", "saved author profile + packs");
  } else if (!authorPacks) {
    authorPacks = buildDerivedAuthorProfilePacks(authorProfile);
    await repository.saveDerivedAuthorProfilePacks(projectId, authorPacks);
    logStage("bootstrap", "rebuilt missing author packs");
  }

  const themeBible = (await repository.loadThemeBible(projectId)) ?? demoThemeBible;
  const styleBible = (await repository.loadStyleBible(projectId)) ?? demoStyleBible;
  const storySetup = (await repository.loadStorySetup(projectId)) ?? demoStorySetup;
  const loadedStoryOutline = await repository.loadStoryOutline(projectId);
  const loadedArcOutlines = await repository.loadArcOutlines(projectId);
  const loadedBeatOutlines = await repository.loadBeatOutlines(projectId);
  const loadedCharacterStates = await repository.loadCharacterStates(projectId);
  const loadedWorldFacts = await repository.loadWorldFacts(projectId);
  const loadedStoryMemories = await repository.loadStoryMemories(projectId);
  const storyOutline = loadedStoryOutline ?? demoStoryOutline;
  const arcOutlines = loadedArcOutlines.length ? loadedArcOutlines : demoArcOutlines;
  const beatOutlines = loadedBeatOutlines.length ? loadedBeatOutlines : demoBeatOutlines;
  const characterStates = loadedCharacterStates.length ? loadedCharacterStates : demoCharacterStates;
  const worldFacts = loadedWorldFacts.length ? loadedWorldFacts : demoWorldFacts;
  const storyMemories = loadedStoryMemories.length ? loadedStoryMemories : demoStoryMemories;
  const chapterPlans = await repository.loadChapterPlans(projectId);

  await repository.saveThemeBible(projectId, themeBible);
  await repository.saveStyleBible(projectId, styleBible);
  await repository.saveStorySetup(projectId, storySetup);
  await repository.saveStoryOutline(projectId, storyOutline);
  await repository.saveArcOutlines(projectId, arcOutlines);
  await repository.saveBeatOutlines(projectId, beatOutlines);
  await repository.saveCharacterStates(projectId, characterStates);
  await repository.saveWorldFacts(projectId, worldFacts);
  await repository.saveStoryMemories(projectId, storyMemories);
  if ((await repository.loadSeedStoryMemories(projectId)).length === 0) {
    await repository.saveSeedStoryMemories(
      projectId,
      loadedStoryMemories.length ? deriveFallbackSeedMemories(storyMemories) : demoStoryMemories,
    );
  }

  logStage("bootstrap", "base files ready");

  return {
    storySetup,
    storyOutline,
    arcOutlines,
    beatOutlines,
    authorPacks,
    themeBible,
    styleBible,
    characterStates,
    worldFacts,
    storyMemories,
    chapterPlans,
    validationIssues,
  };
}

export async function invalidateFromChapter(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<InvalidateResult> {
  const repository = new FileProjectRepository();

  if (args.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1");
  }

  const currentMemories = await repository.loadStoryMemories(args.projectId);
  const seedMemories = await loadSeedStoryMemories(repository, args.projectId, currentMemories);
  const allChapterNumbers = await repository.listChapterArtifactNumbers(args.projectId);
  const deletedChapterNumbers = allChapterNumbers.filter((number) => number >= args.chapterNumber);
  const keptChapterNumbers = allChapterNumbers.filter((number) => number < args.chapterNumber);

  let rebuiltMemories = seedMemories.map((memory) => ({
    ...memory,
    notes: [...memory.notes],
  }));

  for (const chapterNumber of keptChapterNumbers) {
    const artifact = await repository.loadChapterArtifact(args.projectId, chapterNumber);
    if (!artifact) {
      continue;
    }

    rebuiltMemories = applyMemoryUpdaterResult(
      rebuiltMemories,
      artifact.memoryUpdate,
      artifact.chapterNumber,
    );
  }

  const chapterPlans = await repository.loadChapterPlans(args.projectId);
  const previousMemories = currentMemories.map((memory) => ({
    ...memory,
    notes: [...memory.notes],
  }));
  const previousPlans = chapterPlans.map((plan) => ({ ...plan }));
  const remainingPlans = chapterPlans.filter(
    (plan) => (plan.chapterNumber ?? Number.MAX_SAFE_INTEGER) < args.chapterNumber,
  );
  const deletedArtifactsBackup = (
    await Promise.all(
      deletedChapterNumbers.map(async (chapterNumber) => ({
        chapterNumber,
        artifact: await repository.loadChapterArtifact(args.projectId, chapterNumber),
      })),
    )
  )
    .filter((item): item is { chapterNumber: number; artifact: ChapterArtifact } => Boolean(item.artifact))
    .map((item) => ({ chapterNumber: item.chapterNumber, artifact: item.artifact }));

  try {
    for (const chapterNumber of deletedChapterNumbers) {
      await repository.deleteChapterArtifact(args.projectId, chapterNumber);
    }

    await repository.saveChapterPlans(args.projectId, remainingPlans);
    await repository.saveStoryMemories(args.projectId, rebuiltMemories);
  } catch (error) {
    // Best-effort rollback to avoid partial invalidation state.
    await repository.saveChapterPlans(args.projectId, previousPlans);
    await repository.saveStoryMemories(args.projectId, previousMemories);
    for (const item of deletedArtifactsBackup) {
      await repository.saveChapterArtifact(args.projectId, item.artifact);
    }
    throw error;
  }

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    deletedChapterNumbers,
    remainingChapterPlans: remainingPlans.length,
    remainingMemories: rebuiltMemories.length,
  };
}

async function generateAuthorProfileFromInterviewInput(args: {
  service: LlmService;
  interviewInput: AuthorInterviewSessionInput;
  projectId: string;
}): Promise<{
  authorProfile: ReturnType<typeof mapAuthorInterviewToProfile>;
  authorPacks: DerivedAuthorProfilePacks;
  validationIssues: string[];
}> {
  const interviewCombined = args.interviewInput.smallModel
    ? await (async () => {
        logStage("bootstrap", "llm: author_interview normalized-only");
        const normalizedOnlyMessages =
          buildAuthorInterviewSmallModelNormalizeMessages(args.interviewInput);
        const normalizedOnlyResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: normalizedOnlyMessages,
          schema: authorInterviewNormalizedDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });

        return {
          display: {
            summary: normalizedOnlyResult.object.normalized.authorProfile.summary,
            authorProfile: normalizedOnlyResult.object.normalized.authorProfile,
            components: normalizedOnlyResult.object.normalized.components.map((component) => ({
              id: component.id,
              name: component.name,
              category: component.category,
              description: component.name,
              priority: component.priority,
            })),
            constraints: normalizedOnlyResult.object.normalized.constraints,
            openQuestions: [],
            conflictsDetected: [],
          },
          normalized: normalizedOnlyResult.object.normalized,
        };
      })()
    : await (async () => {
        logStage("bootstrap", "llm: author_interview display");
        const displayMessages = buildAuthorInterviewDisplayMessages(args.interviewInput);
        const displayResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: displayMessages,
          schema: authorInterviewDisplayDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });
        logStage("bootstrap", "llm: author_interview normalized");
        const normalizedMessages = buildAuthorInterviewNormalizeMessages({
          input: args.interviewInput,
          display: displayResult.object.display,
        });
        const normalizedResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: normalizedMessages,
          schema: authorInterviewNormalizedDraftSchema,
          temperature: 0.2,
          maxTokens: 2600,
        });

        return {
          display: displayResult.object.display,
          normalized: normalizedResult.object.normalized,
        };
      })();

  const normalizedInterview = normalizeAuthorInterviewResult(interviewCombined);
  const validationIssues = validateAuthorInterviewResult(normalizedInterview).map(
    (issue) => `${issue.path}: ${issue.message}`,
  );
  const authorProfile = mapAuthorInterviewToProfile(normalizedInterview, {
    profileId: `${args.projectId}-author-profile`,
    profileName: "Default Author Profile",
  });
  const authorPacks = buildDerivedAuthorProfilePacks(authorProfile);
  return {
    authorProfile,
    authorPacks,
    validationIssues,
  };
}

export async function interviewProject(args: {
  projectId: string;
  answersRaw: string;
}): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const existingProject = await repository.getProject(args.projectId);
  if (!existingProject) {
    await repository.createProject({
      id: args.projectId,
      title: demoProjectTitle,
    });
  }

  const interviewInput = buildInterviewInputFromQuizAnswers(args.answersRaw, {
    title: demoProjectTitle,
    premise: demoPremise,
    themeHint: "custom quiz generated author profile",
  });
  const generated = await generateAuthorProfileFromInterviewInput({
    service,
    interviewInput,
    projectId: args.projectId,
  });

  await repository.saveAuthorProfile(args.projectId, generated.authorProfile);
  await repository.saveDerivedAuthorProfilePacks(args.projectId, generated.authorPacks);
  return {
    projectId: args.projectId,
    validationIssues: generated.validationIssues,
  };
}

export async function bootstrapProject(
  projectId: string,
  options?: { authorPresetId?: string },
): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const base = await ensureBootstrappedProject(
    service,
    repository,
    projectId,
    options?.authorPresetId,
  );

  return {
    projectId,
    validationIssues: base.validationIssues,
  };
}

async function generateChapterArtifact(args: {
  service: LlmService;
  base: ProjectBaseState;
  repository: FileProjectRepository;
  projectId: string;
  chapterNumber: number;
  currentSituation: string;
  recentConsequences: string[];
}): Promise<{
  artifact: ChapterArtifact;
  updatedStoryMemories: StoryMemory[];
  updatedChapterPlans: ChapterPlan[];
}> {
  logStage("chapter", `start chapter=${args.chapterNumber}`);
  const currentArc = pickArcForChapterDeterministic(args.base.arcOutlines, args.chapterNumber);
  const currentBeat = pickBeatForChapterDeterministic(
    args.base.beatOutlines,
    currentArc,
    args.chapterNumber,
  );
  assertChapterPlanningAnchors({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    beatOutlines: args.base.beatOutlines,
    currentArc,
    currentBeat,
  });

  const plannerMessages = buildPlannerMessages({
    authorPack: args.base.authorPacks.planner,
    themeBible: args.base.themeBible,
    styleBible: args.base.styleBible,
    storyOutline: args.base.storyOutline,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    arcId: currentArc?.id,
    chapterNumber: args.chapterNumber,
    mode: args.chapterNumber === 1 ? "opening" : "continuation",
    premise: args.base.storySetup.premise,
    currentArcGoal: currentArc?.arcGoal ?? args.base.storySetup.currentArcGoal,
    currentSituation: args.currentSituation,
    activeCharacterIds:
      currentBeat?.requiredCharacters.length
        ? currentBeat.requiredCharacters
        : args.base.storySetup.defaultActiveCharacterIds,
    candidateMemoryIds: args.base.storyMemories
      .filter((memory) => memory.status === "active" || memory.status === "triggered")
      .map((memory) => memory.id)
      .slice(0, 12),
    recentConsequences: args.recentConsequences,
  });

  logStage("chapter", `llm: planner chapter=${args.chapterNumber}`);
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_planner`,
    messages: plannerMessages,
  });
  const plannerResult = await args.service.generateObjectForTask({
    task: "planner",
    messages: plannerMessages,
    schema: plannerResultSchema,
    temperature: 0.2,
    maxTokens: 2200,
  });

  const planned = plannerResult.object.chapterPlan;
  const chapterPlan = {
    ...planned,
    chapterNumber: args.chapterNumber,
    arcId: currentArc?.id ?? planned.arcId ?? "arc-1",
    beatId: currentBeat?.id ?? planned.beatId,
    requiredCharacters: uniqueStrings(
      [...planned.requiredCharacters, ...(currentBeat?.requiredCharacters ?? [])],
      8,
    ),
    requiredMemories: uniqueStrings(
      [...planned.requiredMemories, ...(currentBeat?.requiredMemories ?? [])],
      12,
    ),
    beatConstraints: uniqueStrings([...(currentBeat?.constraints ?? [])], 6),
    mustHitConflicts: uniqueStrings(
      [
        ...planned.mustHitConflicts,
        planned.chapterGoal,
        planned.emotionalGoal,
        planned.plannedOutcome,
        currentBeat?.conflict ?? "",
      ],
      6,
    ),
    disallowedMoves: uniqueStrings([...planned.disallowedMoves], 6),
    payoffPatternIds: normalizePayoffPatternIds({
      plannerIds: planned.payoffPatternIds,
      currentArc,
      currentBeat,
    }),
  };

  logStage("chapter", `build context chapter=${args.chapterNumber}`);
  const writerContextPack = buildContextPack({
    task: "writer",
    authorPack: args.base.authorPacks.writer,
    themeBible: args.base.themeBible,
    styleBible: args.base.styleBible,
    chapterPlan,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    characterStates: args.base.characterStates,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
  });
  const reviewerContextPack = buildContextPack({
    task: "reviewer",
    authorPack: args.base.authorPacks.reviewer,
    themeBible: args.base.themeBible,
    styleBible: args.base.styleBible,
    chapterPlan,
    arcOutline: currentArc,
    beatOutline: currentBeat,
    characterStates: args.base.characterStates,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
  });

  logStage("chapter", `llm: writer chapter=${args.chapterNumber}`);
  const writerMessages = buildWriterMessages({
    contextPack: writerContextPack,
    minParagraphs: 5,
    maxParagraphs: 8,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_writer`,
    messages: writerMessages,
  });
  const writerTextResult = await args.service.generateForTask({
    task: "writer",
    messages: writerMessages,
    temperature: 0.6,
    maxTokens: 2800,
  });
  const writerOutput = parseWriterLikeOutput({
    provider: writerTextResult.provider,
    rawText: writerTextResult.text,
  });
  const writerResult = {
    object: {
      title: writerOutput.title,
      draft: writerOutput.draft,
      notes: writerOutput.notes,
    } satisfies WriterResult,
  };

  logStage("chapter", `llm: review_missing_resource chapter=${args.chapterNumber}`);
  const missingReviewMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    storyMemories: args.base.storyMemories,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_missing_resource`,
    messages: missingReviewMessages,
  });
  const missingResourceReview = await args.service.generateObjectForTask({
    task: "review_missing_resource",
    messages: missingReviewMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  logStage("chapter", `llm: review_fact chapter=${args.chapterNumber}`);
  const factReviewMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: writerResult.object.draft,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_fact`,
    messages: factReviewMessages,
  });
  const factConsistencyReview = await args.service.generateObjectForTask({
    task: "review_fact",
    messages: factReviewMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  const initialNormalized = normalizeReviewerResults({
    missing: missingResourceReview.object as MissingResourceReviewerResult,
    fact: factConsistencyReview.object as FactConsistencyReviewerResult,
  });
  const initialMissing = initialNormalized.missing;
  const initialFact = initialNormalized.fact;
  const rewritePlan = buildRewritePlan({
    missing: initialMissing,
    fact: initialFact,
  });
  const originalDraft = writerResult.object.draft;
  const originalTitle = writerResult.object.title;
  let rewrittenDraft = writerResult.object.draft;
  let rewrittenTitle = writerResult.object.title;
  let activeMissing = initialMissing;
  let activeFact = initialFact;
  const shouldRewriteForConsistencyNow = shouldRewriteForConsistency(activeFact);
  if (shouldRewriteForConsistencyNow) {
    const rewriteTemp = rewritePlan.mode === "repair_first" ? 0.35 : 0.5;
    logStage("chapter", `llm: rewriter chapter=${args.chapterNumber} mode=${rewritePlan.mode} pass=1`);
    const rewriterMessages = buildRewriterMessages({
      title: rewrittenTitle,
      draft: rewrittenDraft,
      mode: rewritePlan.mode,
      objective: rewritePlan.objective,
      missingResourceReview: activeMissing,
      factConsistencyReview: activeFact,
    });
    await writePromptDebug({
      projectId: args.projectId,
      scope: "chapter",
      label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_rewriter_${rewritePlan.mode}`,
      messages: rewriterMessages,
    });
    const rewrittenTextResult = await args.service.generateForTask({
      task: "rewriter",
      messages: rewriterMessages,
      temperature: rewriteTemp,
      maxTokens: 3000,
    });
    const rewrittenOutput = parseWriterLikeOutput({
      provider: rewrittenTextResult.provider,
      rawText: rewrittenTextResult.text,
      fallbackTitle: rewrittenTitle,
    });
    rewrittenDraft = rewrittenOutput.draft;
    rewrittenTitle = rewrittenOutput.title ?? rewrittenTitle;
  }

  logStage("chapter", `llm: review_missing_resource_final chapter=${args.chapterNumber} pass=1`);
  const missingFinalMessages = buildMissingResourceReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_missing_resource_final`,
    messages: missingFinalMessages,
  });
  const missingResourceReviewFinal = await args.service.generateObjectForTask({
    task: "review_missing_resource",
    messages: missingFinalMessages,
    schema: missingResourceReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  logStage("chapter", `llm: review_fact_final chapter=${args.chapterNumber} pass=1`);
  const factFinalMessages = buildFactConsistencyReviewMessages({
    contextPack: reviewerContextPack,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    worldFacts: args.base.worldFacts,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_review_fact_final`,
    messages: factFinalMessages,
  });
  const factConsistencyReviewFinal = await args.service.generateObjectForTask({
    task: "review_fact",
    messages: factFinalMessages,
    schema: factConsistencyReviewerResultSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });

  const normalizedFinal = normalizeReviewerResults({
    missing: missingResourceReviewFinal.object as MissingResourceReviewerResult,
    fact: factConsistencyReviewFinal.object as FactConsistencyReviewerResult,
  });
  activeMissing = normalizedFinal.missing;
  activeFact = normalizedFinal.fact;

  if (
    rewritePlan.mode === "quality_boost" &&
    hasBlockingReviewerIssues({ missing: activeMissing, fact: activeFact })
  ) {
    rewrittenDraft = originalDraft;
    rewrittenTitle = originalTitle;
    activeMissing = initialMissing;
    activeFact = initialFact;
  }

  logStage("chapter", `llm: memory_updater chapter=${args.chapterNumber}`);
  const memoryMessages = buildMemoryUpdaterMessages({
    chapterNumber: args.chapterNumber,
    chapterPlan,
    draft: rewrittenDraft,
    storyMemories: args.base.storyMemories,
    activeCharacterIds: chapterPlan.requiredCharacters,
  });
  await writePromptDebug({
    projectId: args.projectId,
    scope: "chapter",
    label: `chapter-${String(args.chapterNumber).padStart(3, "0")}_memory_updater`,
    messages: memoryMessages,
  });
  const memoryUpdate = await args.service.generateObjectForTask({
    task: "memory_updater",
    messages: memoryMessages,
    schema: memoryUpdaterResultSchema,
    temperature: 0.2,
    maxTokens: 2200,
  });

  const updatedStoryMemories = applyMemoryUpdaterResult(
    args.base.storyMemories,
    memoryUpdate.object,
    args.chapterNumber,
  );
  const updatedChapterPlans = upsertChapterPlan(args.base.chapterPlans, chapterPlan);

  const artifact: ChapterArtifact = {
    chapterNumber: args.chapterNumber,
    plan: chapterPlan,
    contextPack: writerContextPack,
    writerResult: {
      ...(writerResult.object as WriterResult),
      title: rewrittenTitle,
      draft: rewrittenDraft,
    },
    missingResourceReview: activeMissing,
    factConsistencyReview: activeFact,
    memoryUpdate: memoryUpdate.object as MemoryUpdaterResult,
    generatedAt: new Date().toISOString(),
  };

  logStage("chapter", `save artifacts chapter=${args.chapterNumber}`);
  await args.repository.saveChapterPlans(args.projectId, updatedChapterPlans);
  await args.repository.saveStoryMemories(args.projectId, updatedStoryMemories);
  await args.repository.saveChapterArtifact(args.projectId, artifact);

  logStage("chapter", `done chapter=${args.chapterNumber}`);
  return {
    artifact,
    updatedStoryMemories,
    updatedChapterPlans,
  };
}

function parseTargetChapter(options: V1RunOptions): number {
  if (options.mode === "first-n") {
    if (!options.count || options.count < 1) {
      throw new Error("count must be >= 1 when mode is first-n");
    }
    return options.count;
  }

  if (!options.chapterNumber || options.chapterNumber < 1) {
    throw new Error("chapterNumber must be >= 1 when mode is chapter");
  }

  return options.chapterNumber;
}

export async function runV1(options: V1RunOptions): Promise<V1RunResult> {
  logStage("run", `start mode=${options.mode} project=${options.projectId}`);
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const targetChapter = parseTargetChapter(options);

  const base = await ensureBootstrappedProject(service, repository, options.projectId);
  const existingArtifacts: ChapterArtifact[] = [];
  let maxExistingChapter = 0;
  for (let chapterNumber = 1; chapterNumber <= targetChapter; chapterNumber += 1) {
    const artifact = await repository.loadChapterArtifact(options.projectId, chapterNumber);
    if (!artifact) {
      break;
    }
    existingArtifacts.push(artifact);
    maxExistingChapter = chapterNumber;
  }

  if (maxExistingChapter >= targetChapter) {
    return {
      projectId: options.projectId,
      targetChapter,
      generatedChapterNumbers: [],
      artifacts: existingArtifacts,
      validationIssues: base.validationIssues,
    };
  }

  let storyMemories = base.storyMemories;
  let chapterPlans = base.chapterPlans;
  const generatedArtifacts: ChapterArtifact[] = [];

  const previousArtifact = maxExistingChapter > 0 ? existingArtifacts[existingArtifacts.length - 1] : null;

  let currentSituation = previousArtifact?.memoryUpdate.nextSituation ?? base.storySetup.openingSituation;
  let recentConsequences = buildRecentConsequences(previousArtifact, base.storySetup.currentArcGoal);

  for (let chapterNumber = maxExistingChapter + 1; chapterNumber <= targetChapter; chapterNumber += 1) {
    logStage("run", `generate chapter=${chapterNumber}/${targetChapter}`);
    const generation = await generateChapterArtifact({
      service,
      repository,
      projectId: options.projectId,
      chapterNumber,
      currentSituation,
      recentConsequences,
      base: {
        ...base,
        storyMemories,
        chapterPlans,
      },
    });

    generatedArtifacts.push(generation.artifact);
    storyMemories = generation.updatedStoryMemories;
    chapterPlans = generation.updatedChapterPlans;
    currentSituation = generation.artifact.memoryUpdate.nextSituation;
    recentConsequences = buildRecentConsequences(
      generation.artifact,
      base.storySetup.currentArcGoal,
    );
  }

  logStage("run", "completed");
  return {
    projectId: options.projectId,
    targetChapter,
    generatedChapterNumbers: generatedArtifacts.map((artifact) => artifact.chapterNumber),
    artifacts: generatedArtifacts,
    validationIssues: base.validationIssues,
  };
}

export function formatV1RunResult(result: V1RunResult): string {
  const lines: string[] = [];

  lines.push(`Project: ${result.projectId}`);
  lines.push(`Target chapter: ${result.targetChapter}`);
  lines.push(
    `Generated now: ${result.generatedChapterNumbers.length > 0 ? result.generatedChapterNumbers.join(", ") : "none"}`,
  );

  for (const artifact of result.artifacts) {
    lines.push("");
    lines.push(`=== Chapter ${artifact.chapterNumber} ===`);
    lines.push(`Title: ${artifact.writerResult.title ?? artifact.plan.title ?? "(untitled)"}`);
    lines.push(`Goal: ${artifact.plan.chapterGoal}`);
    lines.push(`Draft path: data/projects/${result.projectId}/chapters/chapter-${String(artifact.chapterNumber).padStart(3, "0")}/draft.md`);
    lines.push(`Summary: ${artifact.memoryUpdate.chapterSummary}`);
    lines.push(`Next: ${artifact.memoryUpdate.nextSituation}`);
    lines.push(
      `Missing resource findings: ${artifact.missingResourceReview.findings.length}`,
    );
    lines.push(`Fact findings: ${artifact.factConsistencyReview.findings.length}`);
  }

  if (result.validationIssues.length > 0) {
    lines.push("");
    lines.push("Validation issues:");
    for (const issue of result.validationIssues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join("\n");
}

export function formatInvalidateResult(result: InvalidateResult): string {
  return [
    `Project: ${result.projectId}`,
    `Invalidated from chapter: ${result.chapterNumber}`,
    `Deleted chapter artifacts: ${result.deletedChapterNumbers.length > 0 ? result.deletedChapterNumbers.join(", ") : "none"}`,
    `Remaining chapter plans: ${result.remainingChapterPlans}`,
    `Remaining memories: ${result.remainingMemories}`,
  ].join("\n");
}

export const defaultDemoProjectId = "demo-project";

export function formatAuthorPresetCatalog(): string {
  return formatAuthorPresetCatalogText();
}
export const defaultDemoPremise = demoPremise;
