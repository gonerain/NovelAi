import type {
  CharacterState,
  ChapterMode,
  EpisodePacket,
  EpisodePayoffType,
  NarrativeThread,
  NarrativeThreadStatus,
  StateDelta,
  StoryContract,
  StoryProject,
  ThreadEconomyReport,
  ThreadUpdateReport,
} from "./domain/index.js";
import {
  applyDeltasToThreads,
  computeThreadEconomyReport,
  rankNarrativeThreads,
  type ThreadRankResult,
} from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { extractStateDeltas } from "./v1-deltas.js";
import { readJsonArtifact, writeJsonArtifact } from "./v1-artifacts.js";
import {
  chapterConsequenceEdgesPath,
  chapterDecisionLogPath,
  chapterEpisodePacketPath,
  chapterRelationshipShiftPath,
  chapterStateDeltasPath,
  chapterThreadUpdateReportPath,
  chapterThreadsSuggestNextPath,
  narrativeThreadsPath,
  storyContractsPath,
  threadEconomyReportPath,
} from "./v1-paths.js";
import type {
  ConsequenceEdgeArtifact,
  DecisionLogArtifact,
  RelationshipShiftArtifact,
} from "./v1-role-drive.js";

export interface ThreadSeedRunResult {
  projectId: string;
  storyContractsPath: string;
  narrativeThreadsPath: string;
  contractsCreated: number;
  threadsCreated: number;
  keptExistingContracts: number;
  keptExistingThreads: number;
}

export interface ThreadInspectRunResult {
  projectId: string;
  storyContractsPath: string;
  narrativeThreadsPath: string;
  contractCount: number;
  threadCount: number;
  activeThreadCount: number;
  contracts: StoryContract[];
  threads: NarrativeThread[];
}

export interface ThreadRankRunResult {
  projectId: string;
  chapterNumber: number;
  narrativeThreadsPath: string;
  rankedThreads: ThreadRankResult[];
}

export interface ThreadUpdateRunResult {
  projectId: string;
  chapterNumber: number;
  narrativeThreadsPath: string;
  reportPath: string;
  threadsConsidered: number;
  threadsTouched: number;
  appliedDeltaCount: number;
  conflictCount: number;
  unmatchedDeltaIds: string[];
  report: ThreadUpdateReport;
}

export interface ThreadEconomyRunResult {
  projectId: string;
  chapterNumber: number;
  narrativeThreadsPath: string;
  reportPath: string;
  report: ThreadEconomyReport;
}

export interface ThreadEvalRunResult {
  projectId: string;
  chapterNumber: number;
  narrativeThreadsPath: string;
  economyReportPath: string;
  economy: ThreadEconomyReport;
  schedulerWarnings: Array<{
    threadId: string;
    score: number;
    warnings: string[];
    reasons: string[];
  }>;
  passed: boolean;
}

export interface ThreadNextMoveSuggestion {
  threadId: string;
  threadType: NarrativeThread["threadType"];
  status: NarrativeThreadStatus;
  score: number;
  reasons: string[];
  warnings: string[];
  suggestedMode: ChapterMode;
  suggestedPayoffType: EpisodePayoffType;
  suggestedMove: string;
  agencyRepairNeeded: boolean;
  agencyRepairNote?: string;
}

export interface ThreadSuggestNextRunResult {
  projectId: string;
  chapterNumber: number;
  reportPath: string;
  primarySuggestion: ThreadNextMoveSuggestion | null;
  supportingSuggestions: ThreadNextMoveSuggestion[];
  blockedSuggestions: ThreadNextMoveSuggestion[];
  notes: string[];
  recentDeltaCount: number;
}

function firstDefinedText(values: Array<string | undefined>, fallback: string): string {
  return values.map((value) => value?.trim()).find(Boolean) ?? fallback;
}

function primaryCharacter(project: StoryProject): CharacterState | undefined {
  const defaultId = project.storySetup.defaultActiveCharacterIds[0];
  return project.characters.find((character) => character.id === defaultId) ?? project.characters[0];
}

function secondaryCharacter(project: StoryProject, protagonistId?: string): CharacterState | undefined {
  return project.characters.find((character) => character.id !== protagonistId);
}

function contract(args: Omit<StoryContract, "createdAtChapter" | "status">): StoryContract {
  return {
    ...args,
    createdAtChapter: 1,
    status: "active",
  };
}

function scheduler(args: Partial<NarrativeThread["scheduler"]>): NarrativeThread["scheduler"] {
  return {
    urgency: args.urgency ?? 40,
    heat: args.heat ?? 40,
    staleness: args.staleness ?? 0,
    payoffReadiness: args.payoffReadiness ?? 20,
    setupDebt: args.setupDebt ?? 30,
    readerDebt: args.readerDebt ?? 35,
    agencyPotential: args.agencyPotential ?? 60,
    offscreenPressure: args.offscreenPressure ?? 20,
  };
}

function thread(args: {
  id: string;
  threadType: NarrativeThread["threadType"];
  title: string;
  ownerCharacterIds: string[];
  currentStatus?: NarrativeThreadStatus;
  readerQuestion: string;
  pressure: string;
  stakes: string;
  nextUsefulMoves: string[];
  blockedBy?: string[];
  payoffConditions: string[];
  payoffTypeOptions: EpisodePayoffType[];
  cadenceTarget: NarrativeThread["cadenceTarget"];
  expectedSpanChapters: number;
  minTouchInterval: number;
  maxDormantChapters: number;
  allowedModes: ChapterMode[];
  relatedContracts: string[];
  scheduler: NarrativeThread["scheduler"];
}): NarrativeThread {
  return {
    ...args,
    introducedChapter: 1,
    currentStatus: args.currentStatus ?? "seeded",
    blockedBy: args.blockedBy ?? [],
    lastTouchedChapter: 1,
  };
}

function buildSeedContracts(project: StoryProject): StoryContract[] {
  const protagonist = primaryCharacter(project);
  const protagonistName = protagonist?.name ?? "主角";
  const ending = firstDefinedText(
    [project.storyOutline?.endingTarget, project.themeBible.endingTarget],
    "长线结局必须兑现前期核心承诺。",
  );
  const arcGoal = project.storySetup.currentArcGoal;

  return [
    contract({
      id: "contract-story-truth-premise",
      contractType: "story_truth",
      statement: project.premise,
      readerVisible: true,
      priority: "critical",
      evidence: ["story-setup.premise"],
      forbiddenMoves: ["不得无因推翻前提中的核心世界规则。"],
      payoffSignals: ["章节推进持续验证前提，而不是把前提当背景装饰。"],
    }),
    contract({
      id: "contract-reader-promise-current-arc",
      contractType: "reader_promise",
      statement: arcGoal,
      readerVisible: true,
      dueByChapter: 30,
      priority: "high",
      evidence: ["story-setup.currentArcGoal"],
      forbiddenMoves: ["不得连续多章绕开当前弧线问题。"],
      payoffSignals: ["读者能看到当前弧线问题被推进、压迫或半兑现。"],
    }),
    contract({
      id: "contract-genre-payoff",
      contractType: "genre_contract",
      statement: `类型承诺：${project.storySetup.genrePayoffPackId ?? "default"} 必须持续提供可感知爽点或情绪回报。`,
      readerVisible: true,
      dueByChapter: 5,
      priority: "high",
      evidence: ["story-setup.genrePayoffPackId"],
      forbiddenMoves: ["不得只堆解释而不给读者可见回报。"],
      payoffSignals: ["信息揭示、关系推进、地位变化或反派吃瘪形成章节级回报。"],
    }),
    contract({
      id: "contract-protagonist-agency",
      contractType: "character_arc",
      statement: `${protagonistName}必须通过不可替代的选择改变局面。`,
      readerVisible: true,
      priority: "critical",
      evidence: ["character-states", "decision-profile"],
      forbiddenMoves: ["不得让主角只旁观、只被推着走，或由旁人替他完成核心选择。"],
      payoffSignals: ["章节后果能追溯到主角选择，而不是随机事件。"],
    }),
    contract({
      id: "contract-ending-obligation",
      contractType: "ending_obligation",
      statement: ending,
      readerVisible: false,
      priority: "medium",
      evidence: ["story-outline.endingTarget", "theme-bible.endingTarget"],
      forbiddenMoves: ["不得写出与终局义务不可调和的不可逆设定。"],
      payoffSignals: ["长线伏笔逐步靠近终局义务。"],
    }),
    contract({
      id: "contract-forbidden-passive-protagonist",
      contractType: "forbidden_move",
      statement: "禁止用外力连续替主角解决核心冲突。",
      readerVisible: false,
      priority: "critical",
      evidence: ["roadmap.runtime-control"],
      forbiddenMoves: ["天降救场替代主角选择。", "NPC解释直接清空核心悬念。"],
      payoffSignals: ["关键推进必须绑定主角选择成本。"],
    }),
  ];
}

function buildSeedThreads(project: StoryProject, contracts: StoryContract[]): NarrativeThread[] {
  const protagonist = primaryCharacter(project);
  const secondary = secondaryCharacter(project, protagonist?.id);
  const protagonistIds = protagonist ? [protagonist.id] : project.storySetup.defaultActiveCharacterIds.slice(0, 1);
  const relationshipIds = [protagonist?.id, secondary?.id].filter((id): id is string => Boolean(id));
  const contractIds = new Set(contracts.map((item) => item.id));
  const endingContract = contractIds.has("contract-ending-obligation") ? ["contract-ending-obligation"] : [];
  const readerPromise = contractIds.has("contract-reader-promise-current-arc")
    ? ["contract-reader-promise-current-arc"]
    : [];
  const agencyContract = contractIds.has("contract-protagonist-agency")
    ? ["contract-protagonist-agency", "contract-forbidden-passive-protagonist"]
    : [];

  return [
    thread({
      id: "thread-main-plot-pressure",
      threadType: "plot_threat",
      title: "当前弧线主压力",
      ownerCharacterIds: protagonistIds,
      currentStatus: "active",
      readerQuestion: `主角如何推进：${project.storySetup.currentArcGoal}`,
      pressure: project.storySetup.currentArcGoal,
      stakes: "如果当前弧线停滞，读者会失去下一章期待。",
      nextUsefulMoves: ["施压", "调查", "对抗", "半兑现"],
      payoffConditions: ["主角做出不可替代选择", "当前弧线出现可见新局面"],
      payoffTypeOptions: ["strategic_reversal", "information_reveal", "status_gain"],
      cadenceTarget: "frequent",
      expectedSpanChapters: 30,
      minTouchInterval: 1,
      maxDormantChapters: 3,
      allowedModes: ["pressure", "investigate", "confront", "payoff", "braid"],
      relatedContracts: [...readerPromise, ...agencyContract],
      scheduler: scheduler({
        urgency: 72,
        heat: 62,
        readerDebt: 58,
        agencyPotential: 75,
        offscreenPressure: 35,
      }),
    }),
    thread({
      id: "thread-protagonist-agency-arc",
      threadType: "character_wound",
      title: "主角能动性与代价",
      ownerCharacterIds: protagonistIds,
      currentStatus: "active",
      readerQuestion: `${protagonist?.name ?? "主角"}会为了目标付出什么代价？`,
      pressure: firstDefinedText(
        [protagonist?.decisionProfile?.coreFear, protagonist?.fears[0]],
        "主角必须在可承受与不可承受的代价之间选择。",
      ),
      stakes: "如果没有主角选择，章节推进会退化成事件流水账。",
      nextUsefulMoves: ["提出两难选择", "让选择制造后果", "把后果转成下一章压力"],
      payoffConditions: ["选择必须改变关系、资源、地位或信息边界", "后果必须进入状态记录"],
      payoffTypeOptions: ["emotional_impact", "status_gain", "relationship_shift"],
      cadenceTarget: "every_chapter",
      expectedSpanChapters: 500,
      minTouchInterval: 1,
      maxDormantChapters: 1,
      allowedModes: ["pressure", "confront", "payoff", "aftermath", "braid"],
      relatedContracts: agencyContract,
      scheduler: scheduler({
        urgency: 80,
        heat: 55,
        readerDebt: 65,
        agencyPotential: 90,
        setupDebt: 20,
      }),
    }),
    thread({
      id: "thread-primary-relationship-pressure",
      threadType: "relationship",
      title: "核心关系张力",
      ownerCharacterIds: relationshipIds,
      currentStatus: relationshipIds.length >= 2 ? "active" : "seeded",
      readerQuestion: relationshipIds.length >= 2
        ? "核心关系会被压力拉近还是撕裂？"
        : "核心关系位还需要被明确建立。",
      pressure: firstDefinedText(
        [secondary?.relationships.find((item) => item.targetCharacterId === protagonist?.id)?.privateTruth],
        "关系中的信任、依赖和隐瞒需要形成可见变化。",
      ),
      stakes: "关系线停滞会削弱商业网文的情绪粘性。",
      nextUsefulMoves: ["制造误解", "交换资源", "暴露秘密", "共同承担代价"],
      blockedBy: relationshipIds.length >= 2 ? [] : ["缺少第二核心角色"],
      payoffConditions: ["信任、张力或依赖至少一项发生变化"],
      payoffTypeOptions: ["relationship_shift", "emotional_impact", "resource_gain"],
      cadenceTarget: "periodic",
      expectedSpanChapters: 80,
      minTouchInterval: 2,
      maxDormantChapters: 6,
      allowedModes: ["seed", "pressure", "aftermath", "payoff", "braid"],
      relatedContracts: ["contract-reader-promise-current-arc"],
      scheduler: scheduler({
        urgency: 45,
        heat: relationshipIds.length >= 2 ? 58 : 30,
        readerDebt: 38,
        agencyPotential: 60,
        setupDebt: relationshipIds.length >= 2 ? 25 : 65,
      }),
    }),
    thread({
      id: "thread-genre-payoff-cycle",
      threadType: "promise",
      title: "类型回报循环",
      ownerCharacterIds: protagonistIds,
      currentStatus: "active",
      readerQuestion: "这一阶段给读者的可见回报是什么？",
      pressure: "每数章必须有小兑现，不能只铺垫。",
      stakes: "缺少章节级回报会直接损害追更动力。",
      nextUsefulMoves: ["信息揭示", "战力成长", "地位提升", "反派吃瘪", "情绪冲击"],
      payoffConditions: ["章节内出现读者可见小回报", "回报不破坏长线压力"],
      payoffTypeOptions: [
        "information_reveal",
        "power_growth",
        "status_gain",
        "villain_setback",
        "emotional_impact",
      ],
      cadenceTarget: "frequent",
      expectedSpanChapters: 500,
      minTouchInterval: 1,
      maxDormantChapters: 3,
      allowedModes: ["pressure", "investigate", "confront", "payoff", "braid"],
      relatedContracts: ["contract-genre-payoff"],
      scheduler: scheduler({
        urgency: 68,
        heat: 50,
        readerDebt: 70,
        payoffReadiness: 45,
        agencyPotential: 65,
      }),
    }),
    thread({
      id: "thread-ending-obligation",
      threadType: "promise",
      title: "终局义务伏线",
      ownerCharacterIds: protagonistIds,
      currentStatus: "seeded",
      readerQuestion: "长线终局承诺正在如何靠近？",
      pressure: project.storyOutline?.endingTarget ?? project.themeBible.endingTarget,
      stakes: "如果长线承诺长期不触碰，500章结构会散。",
      nextUsefulMoves: ["埋线", "轻触", "半揭示", "制造不可逆代价"],
      payoffConditions: ["只能半兑现或埋线，避免过早清空终局悬念"],
      payoffTypeOptions: ["information_reveal", "emotional_impact", "strategic_reversal"],
      cadenceTarget: "slow_burn",
      expectedSpanChapters: 500,
      minTouchInterval: 8,
      maxDormantChapters: 25,
      allowedModes: ["seed", "investigate", "aftermath", "braid"],
      relatedContracts: endingContract,
      scheduler: scheduler({
        urgency: 25,
        heat: 35,
        readerDebt: 25,
        payoffReadiness: 15,
        setupDebt: 55,
        agencyPotential: 50,
      }),
    }),
  ];
}

export async function seedNarrativeRuntime(args: {
  projectId: string;
}): Promise<ThreadSeedRunResult> {
  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${args.projectId}`);
  }

  const existingContracts = await repository.loadStoryContracts(args.projectId);
  const existingThreads = await repository.loadNarrativeThreads(args.projectId);
  const contracts = existingContracts.length > 0 ? existingContracts : buildSeedContracts(project);
  const threads = existingThreads.length > 0 ? existingThreads : buildSeedThreads(project, contracts);

  if (existingContracts.length === 0) {
    await repository.saveStoryContracts(args.projectId, contracts);
  }
  if (existingThreads.length === 0) {
    await repository.saveNarrativeThreads(args.projectId, threads);
  }

  return {
    projectId: args.projectId,
    storyContractsPath: storyContractsPath(args.projectId),
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    contractsCreated: existingContracts.length === 0 ? contracts.length : 0,
    threadsCreated: existingThreads.length === 0 ? threads.length : 0,
    keptExistingContracts: existingContracts.length,
    keptExistingThreads: existingThreads.length,
  };
}

export async function inspectNarrativeRuntime(args: {
  projectId: string;
}): Promise<ThreadInspectRunResult> {
  const repository = new FileProjectRepository();
  const [contracts, threads] = await Promise.all([
    repository.loadStoryContracts(args.projectId),
    repository.loadNarrativeThreads(args.projectId),
  ]);

  return {
    projectId: args.projectId,
    storyContractsPath: storyContractsPath(args.projectId),
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    contractCount: contracts.length,
    threadCount: threads.length,
    activeThreadCount: threads.filter((item) => item.currentStatus !== "resolved" && item.currentStatus !== "retired").length,
    contracts,
    threads,
  };
}

export async function updateThreadsFromChapter(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<ThreadUpdateRunResult> {
  const repository = new FileProjectRepository();
  const [threads, contracts, artifact] = await Promise.all([
    repository.loadNarrativeThreads(args.projectId),
    repository.loadStoryContracts(args.projectId),
    repository.loadChapterArtifact(args.projectId, args.chapterNumber),
  ]);

  if (threads.length === 0) {
    throw new Error(
      `Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`,
    );
  }
  if (!artifact) {
    throw new Error(
      `Chapter artifact not found: project=${args.projectId}, chapter=${args.chapterNumber}`,
    );
  }

  const deltasPath = chapterStateDeltasPath(args.projectId, args.chapterNumber);
  let deltas = await readJsonArtifact<StateDelta[]>(deltasPath);
  if (!deltas) {
    const [packet, decisionLog, relationshipShift, consequenceEdges] = await Promise.all([
      readJsonArtifact<EpisodePacket>(chapterEpisodePacketPath(args.projectId, args.chapterNumber)),
      readJsonArtifact<DecisionLogArtifact>(chapterDecisionLogPath(args.projectId, args.chapterNumber)),
      readJsonArtifact<RelationshipShiftArtifact>(
        chapterRelationshipShiftPath(args.projectId, args.chapterNumber),
      ),
      readJsonArtifact<ConsequenceEdgeArtifact>(
        chapterConsequenceEdgesPath(args.projectId, args.chapterNumber),
      ),
    ]);
    deltas = extractStateDeltas({
      artifact,
      packet,
      decisionLog,
      relationshipShift,
      consequenceEdges,
    });
    await writeJsonArtifact(deltasPath, deltas);
  }

  const result = applyDeltasToThreads({
    threads,
    deltas,
    contracts,
    chapterNumber: args.chapterNumber,
  });

  await repository.saveNarrativeThreads(args.projectId, result.threads);
  const reportPath = chapterThreadUpdateReportPath(args.projectId, args.chapterNumber);
  await writeJsonArtifact(reportPath, result.report);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    reportPath,
    threadsConsidered: result.report.threadsConsidered,
    threadsTouched: result.report.threadsTouched,
    appliedDeltaCount: result.report.appliedDeltaCount,
    conflictCount: result.report.conflicts.length,
    unmatchedDeltaIds: result.report.unmatchedDeltaIds,
    report: result.report,
  };
}

export async function rankNarrativeRuntime(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<ThreadRankRunResult> {
  const repository = new FileProjectRepository();
  const threads = await repository.loadNarrativeThreads(args.projectId);
  if (threads.length === 0) {
    throw new Error(`Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`);
  }

  const rankedThreads = rankNarrativeThreads(threads, args.chapterNumber);
  const rankedById = new Map(rankedThreads.map((item) => [item.thread.id, item]));
  await repository.saveNarrativeThreads(
    args.projectId,
    threads.map((threadItem) => {
      const ranked = rankedById.get(threadItem.id);
      if (!ranked) {
        return threadItem;
      }
      return {
        ...ranked.thread,
        scheduler: {
          ...ranked.thread.scheduler,
          lastScore: ranked.score,
          lastScoreReasons: ranked.reasons,
        },
      };
    }),
  );

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    rankedThreads,
  };
}

function chooseSuggestedMode(args: {
  thread: NarrativeThread;
  warnings: string[];
}): ChapterMode {
  const scheduler = args.thread.scheduler;
  if (
    args.thread.currentStatus === "ready_for_payoff" ||
    args.warnings.includes("ready_for_payoff") ||
    args.warnings.includes("payoff_or_half_payoff_suggested")
  ) {
    return "payoff";
  }
  if (args.warnings.includes("setup_debt_blocks_payoff")) {
    return "investigate";
  }
  if (scheduler.heat >= 70 || scheduler.urgency >= 75) {
    return "confront";
  }
  if (args.thread.threadType === "mystery" || args.thread.threadType === "world_rule") {
    return "investigate";
  }
  if (scheduler.staleness >= 80 || scheduler.readerDebt >= 60) {
    return "pressure";
  }
  if (args.thread.currentStatus === "seeded") {
    return "seed";
  }
  if (args.thread.currentStatus === "intensifying") {
    return "confront";
  }
  return "braid";
}

function chooseSuggestedPayoffType(thread: NarrativeThread): EpisodePayoffType {
  if (thread.payoffTypeOptions.length > 0) {
    return thread.payoffTypeOptions[0]!;
  }
  if (thread.threadType === "relationship") {
    return "relationship_shift";
  }
  if (thread.threadType === "mystery" || thread.threadType === "world_rule") {
    return "information_reveal";
  }
  return "strategic_reversal";
}

function buildSuggestion(args: {
  ranked: ThreadRankResult;
}): ThreadNextMoveSuggestion {
  const { thread, score, reasons, warnings } = args.ranked;
  const suggestedMode = chooseSuggestedMode({ thread, warnings });
  const suggestedPayoffType = chooseSuggestedPayoffType(thread);
  const suggestedMove =
    thread.nextUsefulMoves[0] ?? thread.pressure ?? "未指定线程动作";
  const agencyRepairNeeded =
    warnings.includes("low_agency_needs_repair") || thread.scheduler.agencyPotential < 40;

  return {
    threadId: thread.id,
    threadType: thread.threadType,
    status: thread.currentStatus,
    score,
    reasons,
    warnings,
    suggestedMode,
    suggestedPayoffType,
    suggestedMove,
    agencyRepairNeeded,
    agencyRepairNote: agencyRepairNeeded
      ? `Agency potential ${thread.scheduler.agencyPotential} 低于阈值；提议一个不可替代的主角选择以修复能动性。`
      : undefined,
  };
}

export async function suggestNextThreadMoves(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<ThreadSuggestNextRunResult> {
  const repository = new FileProjectRepository();
  const threads = await repository.loadNarrativeThreads(args.projectId);
  if (threads.length === 0) {
    throw new Error(
      `Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`,
    );
  }

  const ranked = rankNarrativeThreads(threads, args.chapterNumber);
  const blocked = ranked.filter((item) =>
    item.warnings.includes("primary_selection_blocked_until_repaired"),
  );
  const eligible = ranked.filter(
    (item) => !item.warnings.includes("primary_selection_blocked_until_repaired"),
  );

  const primarySuggestion = eligible[0] ? buildSuggestion({ ranked: eligible[0] }) : null;
  const supportingSuggestions = eligible.slice(1, 4).map((item) => buildSuggestion({ ranked: item }));
  const blockedSuggestions = blocked.map((item) => buildSuggestion({ ranked: item }));

  const previousChapter = Math.max(1, args.chapterNumber - 1);
  const previousDeltas = await readJsonArtifact<StateDelta[]>(
    chapterStateDeltasPath(args.projectId, previousChapter),
  );
  const recentDeltaCount = previousDeltas?.length ?? 0;

  const notes: string[] = [];
  if (recentDeltaCount === 0) {
    notes.push(`No state deltas detected for chapter ${previousChapter}; suggestions rely on current scheduler state only.`);
  }
  if (!primarySuggestion) {
    notes.push("All eligible threads are blocked; only repair suggestions can be primary.");
  }
  if (primarySuggestion?.agencyRepairNeeded) {
    notes.push("Primary thread needs agency repair before it can be promoted.");
  }
  if (
    primarySuggestion &&
    primarySuggestion.warnings.includes("setup_debt_blocks_payoff") &&
    primarySuggestion.suggestedMode === "payoff"
  ) {
    notes.push("Setup debt is high; downgrading payoff suggestion to investigate/pressure is recommended.");
  }

  const result: ThreadSuggestNextRunResult = {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    reportPath: chapterThreadsSuggestNextPath(args.projectId, args.chapterNumber),
    primarySuggestion,
    supportingSuggestions,
    blockedSuggestions,
    notes,
    recentDeltaCount,
  };
  await writeJsonArtifact(result.reportPath, result);
  return result;
}

function resolveEconomyChapter(args: {
  threads: NarrativeThread[];
  chapterNumber?: number;
}): number {
  if (args.chapterNumber && args.chapterNumber >= 1) {
    return args.chapterNumber;
  }
  const fromThreads = args.threads.reduce(
    (max, thread) => Math.max(max, thread.lastTouchedChapter, thread.introducedChapter),
    1,
  );
  return Math.max(1, fromThreads);
}

export async function computeThreadEconomy(args: {
  projectId: string;
  chapterNumber?: number;
}): Promise<ThreadEconomyRunResult> {
  const repository = new FileProjectRepository();
  const threads = await repository.loadNarrativeThreads(args.projectId);
  if (threads.length === 0) {
    throw new Error(
      `Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`,
    );
  }

  const chapterNumber = resolveEconomyChapter({ threads, chapterNumber: args.chapterNumber });
  const report = computeThreadEconomyReport({ threads, chapterNumber });
  const reportPath = threadEconomyReportPath(args.projectId);
  await writeJsonArtifact(reportPath, report);

  return {
    projectId: args.projectId,
    chapterNumber,
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    reportPath,
    report,
  };
}

export async function runThreadEval(args: {
  projectId: string;
  chapterNumber?: number;
}): Promise<ThreadEvalRunResult> {
  const repository = new FileProjectRepository();
  const threads = await repository.loadNarrativeThreads(args.projectId);
  if (threads.length === 0) {
    throw new Error(
      `Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`,
    );
  }

  const chapterNumber = resolveEconomyChapter({ threads, chapterNumber: args.chapterNumber });
  const economyReport = computeThreadEconomyReport({ threads, chapterNumber });
  const economyReportPath = threadEconomyReportPath(args.projectId);
  await writeJsonArtifact(economyReportPath, economyReport);

  const ranked = rankNarrativeThreads(threads, chapterNumber);
  const schedulerWarnings = ranked
    .filter((item) => item.warnings.length > 0)
    .map((item) => ({
      threadId: item.thread.id,
      score: item.score,
      warnings: item.warnings,
      reasons: item.reasons,
    }));

  const passed =
    economyReport.passed &&
    !schedulerWarnings.some((entry) =>
      entry.warnings.includes("primary_selection_blocked_until_repaired"),
    );

  return {
    projectId: args.projectId,
    chapterNumber,
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    economyReportPath,
    economy: economyReport,
    schedulerWarnings,
    passed,
  };
}

