import type {
  ChapterMode,
  CharacterState,
  EpisodePacket,
  EpisodePayoffType,
  ExpectedStateDelta,
  NarrativeThread,
  StoryContract,
  StoryProject,
  ThreadRankResult,
  AgencyEvalReport,
} from "./domain/index.js";
import { evaluateEpisodeAgency, rankNarrativeThreads } from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { readJsonArtifact, writeJsonArtifact } from "./v1-artifacts.js";
import {
  chapterEpisodeEvalPath,
  chapterEpisodePacketPath,
  chapterEpisodePacketRevisionPath,
} from "./v1-paths.js";
import { seedNarrativeRuntime } from "./v1-threads.js";
import {
  buildRecentCommercialHistory,
  buildRecentConsequences,
  buildUnresolvedDelayedConsequences,
  loadAllChapterArtifacts,
  uniqueStrings,
} from "./v1-shared.js";

export interface EpisodePlanRunResult {
  projectId: string;
  chapterNumber: number;
  packetPath: string;
  packet: EpisodePacket;
}

export interface EpisodeInspectRunResult {
  projectId: string;
  chapterNumber: number;
  packetPath: string;
  packet: EpisodePacket | null;
}

export interface EpisodeEvalRunResult {
  projectId: string;
  chapterNumber: number;
  packetPath: string;
  evalPath: string;
  report: AgencyEvalReport;
}

export interface EpisodeRevisePacketRunResult {
  projectId: string;
  chapterNumber: number;
  packetPath: string;
  evalPath: string;
  revisionId: string;
  revisionPath: string | null;
  packet: EpisodePacket;
  previousPacket: EpisodePacket | null;
  changeSummary: string[];
  report: AgencyEvalReport;
}

async function loadRecentPacketSummaries(args: {
  projectId: string;
  chapterNumber: number;
  count?: number;
}): Promise<RecentPacketSummary[]> {
  const count = Math.max(0, args.count ?? 3);
  if (count === 0 || args.chapterNumber <= 1) {
    return [];
  }
  const start = Math.max(1, args.chapterNumber - count);
  const summaries: RecentPacketSummary[] = [];
  for (let chapter = args.chapterNumber - 1; chapter >= start; chapter -= 1) {
    const packet = await readJsonArtifact<EpisodePacket>(
      chapterEpisodePacketPath(args.projectId, chapter),
    );
    if (!packet) {
      continue;
    }
    summaries.push({
      chapterNumber: packet.chapterNumber,
      primaryThreadId: packet.primaryThreadId,
      chapterMode: packet.chapterMode,
      payoffType: packet.payoffType,
      endHook: packet.endHook,
    });
  }
  return summaries;
}

function isUsableEpisodePacket(packet: EpisodePacket | null, chapterNumber: number): packet is EpisodePacket {
  return Boolean(
    packet &&
      packet.chapterNumber === chapterNumber &&
      packet.chapterMode &&
      packet.payoffType &&
      packet.primaryThreadId &&
      packet.agencyOwnerId &&
      packet.nonTransferableChoice &&
      Array.isArray(packet.tolerableOptions) &&
      packet.tolerableOptions.length >= 2 &&
      packet.choiceCost &&
      packet.protagonistConsequence &&
      Array.isArray(packet.activeThreadsUsed) &&
      Array.isArray(packet.stateDeltasExpected),
  );
}

function primaryCharacter(project: StoryProject): CharacterState | undefined {
  const defaultId = project.storySetup.defaultActiveCharacterIds[0];
  return project.characters.find((character) => character.id === defaultId) ?? project.characters[0];
}

function chooseChapterModeNatural(primary: ThreadRankResult): ChapterMode {
  const scheduler = primary.thread.scheduler;
  if (
    primary.warnings.includes("payoff_or_half_payoff_suggested") ||
    primary.thread.currentStatus === "ready_for_payoff"
  ) {
    return "payoff";
  }
  if (scheduler.heat >= 70 || scheduler.urgency >= 75) {
    return "confront";
  }
  if (primary.thread.threadType === "mystery" || primary.thread.threadType === "world_rule") {
    return "investigate";
  }
  if (scheduler.staleness >= 80 || scheduler.readerDebt >= 60) {
    return "pressure";
  }
  if (primary.thread.currentStatus === "seeded") {
    return "seed";
  }
  return "braid";
}

function chooseChapterMode(args: {
  primary: ThreadRankResult;
  previousPrimaryThreadId: string | null;
  previousMode: ChapterMode | null;
}): ChapterMode {
  const natural = chooseChapterModeNatural(args.primary);
  if (
    args.previousMode === null ||
    args.previousMode !== natural ||
    args.previousPrimaryThreadId !== args.primary.thread.id
  ) {
    return natural;
  }
  // Same primary thread + same natural mode as previous chapter → rotate within allowedModes.
  const allowed = args.primary.thread.allowedModes;
  if (allowed.length <= 1) {
    return natural;
  }
  const idx = allowed.indexOf(natural);
  if (idx < 0) {
    return allowed[0]!;
  }
  return allowed[(idx + 1) % allowed.length]!;
}

function choosePayoffTypeNatural(primary: ThreadRankResult): EpisodePayoffType {
  if (primary.thread.payoffTypeOptions.length > 0) {
    return primary.thread.payoffTypeOptions[0]!;
  }
  if (primary.thread.threadType === "relationship") {
    return "relationship_shift";
  }
  if (primary.thread.threadType === "mystery" || primary.thread.threadType === "world_rule") {
    return "information_reveal";
  }
  return "strategic_reversal";
}

function choosePayoffType(args: {
  primary: ThreadRankResult;
  previousPrimaryThreadId: string | null;
  previousPayoffType: EpisodePayoffType | null;
  recentPayoffTypes: EpisodePayoffType[];
}): EpisodePayoffType {
  const options = args.primary.thread.payoffTypeOptions;
  const natural = choosePayoffTypeNatural(args.primary);
  if (options.length <= 1) {
    return natural;
  }
  const sameThread = args.previousPrimaryThreadId === args.primary.thread.id;
  const repeatsImmediate = sameThread && args.previousPayoffType === natural;
  const overusedRecently = args.recentPayoffTypes.filter((item) => item === natural).length >= 2;
  if (!repeatsImmediate && !overusedRecently) {
    return natural;
  }
  // Rotate within the thread's payoffTypeOptions, skipping the previous and the most-overused.
  const blocked = new Set<EpisodePayoffType>();
  if (args.previousPayoffType) {
    blocked.add(args.previousPayoffType);
  }
  for (const recent of args.recentPayoffTypes) {
    blocked.add(recent);
  }
  const fresh = options.find((option) => !blocked.has(option));
  if (fresh) {
    return fresh;
  }
  // All options used recently → fall back to the next index after the previous one.
  const idx = options.indexOf(natural);
  return options[(idx + 1) % options.length]!;
}

function chooseSupportingThreads(rankedThreads: ThreadRankResult[]): ThreadRankResult[] {
  return rankedThreads
    .filter((item) => !item.warnings.includes("primary_selection_blocked_until_repaired"))
    .slice(0, 3);
}

function buildNonTransferableChoice(args: {
  owner: CharacterState | undefined;
  primaryThread: NarrativeThread;
  recentConsequences: string[];
}): string {
  const ownerName = args.owner?.name ?? "主角";
  const pressure = args.primaryThread.pressure;
  const recent = args.recentConsequences[0];
  const desire = args.owner?.decisionProfile?.coreDesire ?? args.owner?.currentGoals[0];
  const cost = args.owner?.decisionProfile?.coreFear ?? args.owner?.fears[0] ?? "付出明确代价";

  return [
    `${ownerName}必须亲自回应「${pressure}」。`,
    desire ? `选择要服务于其当前欲望：${desire}。` : undefined,
    recent ? `不能绕开上一轮后果：${recent}。` : undefined,
    `代价必须触及：${cost}。`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildTolerableOptions(owner: CharacterState | undefined, primaryThread: NarrativeThread): string[] {
  const compromises = owner?.decisionProfile?.likelyCompromises ?? [];
  const goals = owner?.currentGoals ?? [];
  return uniqueStrings(
    [
      compromises[0] ? `接受有限代价：${compromises[0]}` : undefined,
      goals[0] ? `主动推进目标：${goals[0]}` : undefined,
      primaryThread.nextUsefulMoves[0] ? `改用线程动作：${primaryThread.nextUsefulMoves[0]}` : undefined,
      "暂时公开一部分真实意图以换取局面变化",
    ].filter((item): item is string => Boolean(item)),
    3,
  );
}

function buildChoiceCost(owner: CharacterState | undefined, primaryThread: NarrativeThread): string {
  return (
    owner?.decisionProfile?.coreFear ??
    owner?.fears[0] ??
    primaryThread.stakes ??
    "选择必须带来关系、资源、地位或信息边界上的明确代价。"
  );
}

function buildProtagonistConsequence(owner: CharacterState | undefined, primaryThread: NarrativeThread): string {
  const ownerName = owner?.name ?? "主角";
  return `${ownerName}的选择必须导致「${primaryThread.readerQuestion}」出现新的可见局面。`;
}

function buildExpectedStateDeltas(args: {
  primary: ThreadRankResult;
  supporting: ThreadRankResult[];
  owner: CharacterState | undefined;
  contracts: StoryContract[];
}): ExpectedStateDelta[] {
  const deltas: ExpectedStateDelta[] = [
    {
      targetType: "thread",
      targetId: args.primary.thread.id,
      description: `推进或改变线程压力：${args.primary.thread.pressure}`,
      causalWeight: args.primary.score >= 70 ? "major" : "minor",
      visibility: "reader_visible",
    },
  ];

  if (args.owner) {
    deltas.push({
      targetType: "character",
      targetId: args.owner.id,
      description: `${args.owner.name}的选择必须留下可追踪后果。`,
      causalWeight: "major",
      visibility: "reader_visible",
    });
  }

  for (const supporting of args.supporting.slice(1, 3)) {
    deltas.push({
      targetType: "thread",
      targetId: supporting.thread.id,
      description: `轻触支线：${supporting.thread.readerQuestion}`,
      causalWeight: "minor",
      visibility: "reader_visible",
    });
  }

  const endingContract = args.contracts.find((item) => item.contractType === "ending_obligation");
  if (endingContract && args.primary.thread.relatedContracts.includes(endingContract.id)) {
    deltas.push({
      targetType: "contract",
      targetId: endingContract.id,
      description: "不得破坏终局义务，只允许埋线或半揭示。",
      causalWeight: "irreversible",
      visibility: "offscreen",
    });
  }

  return deltas;
}

export interface RecentPacketSummary {
  chapterNumber: number;
  primaryThreadId: string;
  chapterMode: ChapterMode;
  payoffType: EpisodePayoffType;
  endHook?: string;
}

function tokenizeHookForCompare(text: string): Set<string> {
  if (!text) {
    return new Set();
  }
  const cleaned = text.replace(/[\s\p{P}\p{S}]+/gu, " ");
  const tokens = new Set<string>();
  for (const part of cleaned.split(" ")) {
    if (!part) {
      continue;
    }
    if (/^[一-鿿]+$/.test(part) && part.length >= 2) {
      for (let i = 0; i < part.length - 1; i += 1) {
        tokens.add(part.slice(i, i + 2));
      }
    } else if (part.length >= 2) {
      tokens.add(part.toLowerCase());
    }
  }
  return tokens;
}

function jaccardOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  return intersection / (a.size + b.size - intersection);
}

function buildEndHook(args: {
  primaryThread: NarrativeThread;
  unresolvedDelayedConsequences: string[];
  recentConsequences: string[];
  previousEndHook?: string;
}): string {
  const carryoverCandidates = [
    ...args.unresolvedDelayedConsequences,
    ...args.recentConsequences,
  ].filter(Boolean);
  const moveCandidates = [
    ...args.primaryThread.nextUsefulMoves,
    args.primaryThread.pressure,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const previousTokens = tokenizeHookForCompare(args.previousEndHook ?? "");
  const formats = (carryover: string | undefined, move: string) =>
    carryover
      ? `尾钩需要承接：${carryover}；并把下一章压力落到：${move}`
      : `尾钩必须把下一章压力落到：${move}`;

  // Build candidate hooks: prefer carryover-prefixed forms (richer signal) first,
  // and only fall back to the bare-move form if every carryover overlaps the previous hook.
  const candidates: string[] = [];
  for (const carryover of carryoverCandidates) {
    for (const move of moveCandidates) {
      candidates.push(formats(carryover, move));
    }
  }
  for (const move of moveCandidates) {
    candidates.push(formats(undefined, move));
  }
  if (candidates.length === 0) {
    return formats(undefined, args.primaryThread.pressure);
  }
  if (previousTokens.size === 0) {
    return candidates[0]!;
  }
  // Pick the candidate with lowest token overlap against the previous chapter's hook.
  let best = candidates[0]!;
  let bestOverlap = jaccardOverlap(tokenizeHookForCompare(best), previousTokens);
  for (let i = 1; i < candidates.length; i += 1) {
    const overlap = jaccardOverlap(tokenizeHookForCompare(candidates[i]!), previousTokens);
    if (overlap < bestOverlap) {
      best = candidates[i]!;
      bestOverlap = overlap;
      if (bestOverlap === 0) {
        break;
      }
    }
  }
  return best;
}

function buildReaderPayoff(args: {
  payoffType: EpisodePayoffType;
  primaryThread: NarrativeThread;
  recentConsequences: string[];
}): string {
  const consequence = args.recentConsequences[0];
  if (consequence) {
    return `本章以「${args.payoffType}」回应「${args.primaryThread.readerQuestion}」，并对上一章后果（${consequence.slice(0, 60)}）给出可见反应。`;
  }
  return `本章以「${args.payoffType}」兑现读者对「${args.primaryThread.readerQuestion}」的期待。`;
}

export function buildEpisodePacketFromRuntime(args: {
  project: StoryProject;
  chapterNumber: number;
  contracts: StoryContract[];
  rankedThreads: ThreadRankResult[];
  recentConsequences: string[];
  unresolvedDelayedConsequences: string[];
  recentCommercialHistory: string[];
  recentPackets?: RecentPacketSummary[];
  generatedAt?: string;
}): EpisodePacket {
  const eligible = chooseSupportingThreads(args.rankedThreads);
  const primary = eligible[0] ?? args.rankedThreads[0];
  if (!primary) {
    throw new Error("Cannot build episode packet without ranked narrative threads.");
  }

  const ownerId = primary.thread.ownerCharacterIds[0] ?? args.project.storySetup.defaultActiveCharacterIds[0];
  const owner =
    args.project.characters.find((character) => character.id === ownerId) ??
    primaryCharacter(args.project);
  const supporting = eligible.length > 0 ? eligible : [primary];
  const contractIds = uniqueStrings(
    [
      ...primary.thread.relatedContracts,
      ...supporting.flatMap((item) => item.thread.relatedContracts),
      ...args.contracts
        .filter((contract) => contract.priority === "critical" && contract.status === "active")
        .map((contract) => contract.id),
    ],
    8,
  );
  const recentPackets = (args.recentPackets ?? []).slice().sort(
    (left, right) => right.chapterNumber - left.chapterNumber,
  );
  const previous = recentPackets[0] ?? null;
  const chapterMode = chooseChapterMode({
    primary,
    previousPrimaryThreadId: previous?.primaryThreadId ?? null,
    previousMode: previous?.chapterMode ?? null,
  });
  const payoffType = choosePayoffType({
    primary,
    previousPrimaryThreadId: previous?.primaryThreadId ?? null,
    previousPayoffType: previous?.payoffType ?? null,
    recentPayoffTypes: recentPackets.slice(0, 3).map((item) => item.payoffType),
  });

  return {
    id: `episode-${String(args.chapterNumber).padStart(3, "0")}`,
    projectId: args.project.id,
    chapterNumber: args.chapterNumber,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    chapterMode,
    payoffType,
    primaryThreadId: primary.thread.id,
    activeThreadsUsed: supporting.map((item, index) => ({
      threadId: item.thread.id,
      role: index === 0 ? "primary" : "supporting",
      score: item.score,
      reasons: item.reasons,
      warnings: item.warnings,
    })),
    primaryChoiceOwner: owner?.id ?? ownerId ?? "unknown",
    agencyOwnerId: owner?.id ?? ownerId ?? "unknown",
    nonTransferableChoice: buildNonTransferableChoice({
      owner,
      primaryThread: primary.thread,
      recentConsequences: args.recentConsequences,
    }),
    tolerableOptions: buildTolerableOptions(owner, primary.thread),
    choiceCost: buildChoiceCost(owner, primary.thread),
    protagonistConsequence: buildProtagonistConsequence(owner, primary.thread),
    readerPayoff: buildReaderPayoff({
      payoffType,
      primaryThread: primary.thread,
      recentConsequences: args.recentConsequences,
    }),
    endHook: buildEndHook({
      primaryThread: primary.thread,
      unresolvedDelayedConsequences: args.unresolvedDelayedConsequences,
      recentConsequences: args.recentConsequences,
      previousEndHook: previous?.endHook,
    }),
    stateDeltasExpected: buildExpectedStateDeltas({
      primary,
      supporting,
      owner,
      contracts: args.contracts,
    }),
    doNotResolve: uniqueStrings(
      [
        ...primary.thread.blockedBy,
        ...args.contracts
          .filter((contract) => contract.contractType === "ending_obligation")
          .map((contract) => `不要提前兑现终局义务：${contract.statement}`),
        ...args.contracts.flatMap((contract) => contract.forbiddenMoves),
      ],
      8,
    ),
    contractIds,
    schedulerWarnings: uniqueStrings(supporting.flatMap((item) => item.warnings), 8),
    recentConsequences: args.recentConsequences,
    unresolvedDelayedConsequences: args.unresolvedDelayedConsequences,
    recentCommercialHistory: args.recentCommercialHistory,
  };
}

export async function planEpisodePacket(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<EpisodePlanRunResult> {
  const packetPath = chapterEpisodePacketPath(args.projectId, args.chapterNumber);
  const existingPacket = await readJsonArtifact<EpisodePacket>(packetPath);
  if (isUsableEpisodePacket(existingPacket, args.chapterNumber)) {
    return {
      projectId: args.projectId,
      chapterNumber: args.chapterNumber,
      packetPath,
      packet: existingPacket,
    };
  }

  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${args.projectId}`);
  }

  let [contracts, threads] = await Promise.all([
    repository.loadStoryContracts(args.projectId),
    repository.loadNarrativeThreads(args.projectId),
  ]);
  if (contracts.length === 0 || threads.length === 0) {
    await seedNarrativeRuntime({ projectId: args.projectId });
    [contracts, threads] = await Promise.all([
      repository.loadStoryContracts(args.projectId),
      repository.loadNarrativeThreads(args.projectId),
    ]);
  }

  const chapterArtifacts = await loadAllChapterArtifacts(repository, args.projectId);
  const previousArtifact =
    chapterArtifacts.find((artifact) => artifact.chapterNumber === args.chapterNumber - 1) ?? null;
  const recentConsequences = buildRecentConsequences(
    previousArtifact,
    project.storySetup.currentArcGoal,
  );
  const unresolvedDelayedConsequences = buildUnresolvedDelayedConsequences({
    chapterArtifacts,
    beatOutlines: project.beatOutlines,
    currentChapterNumber: args.chapterNumber,
  });
  const recentCommercialHistory = buildRecentCommercialHistory(
    project.chapterPlans,
    args.chapterNumber,
  );
  const rankedThreads = rankNarrativeThreads(threads, args.chapterNumber);
  const rankedById = new Map(rankedThreads.map((item) => [item.thread.id, item]));
  await repository.saveNarrativeThreads(
    args.projectId,
    threads.map((thread) => {
      const ranked = rankedById.get(thread.id);
      if (!ranked) {
        return thread;
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

  const recentPackets = await loadRecentPacketSummaries({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });
  const packet = buildEpisodePacketFromRuntime({
    project,
    chapterNumber: args.chapterNumber,
    contracts,
    rankedThreads,
    recentConsequences,
    unresolvedDelayedConsequences,
    recentCommercialHistory,
    recentPackets,
  });
  await writeJsonArtifact(packetPath, packet);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    packetPath,
    packet,
  };
}

export async function inspectEpisodePacket(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<EpisodeInspectRunResult> {
  const packetPath = chapterEpisodePacketPath(args.projectId, args.chapterNumber);
  const packet = await readJsonArtifact<EpisodePacket>(packetPath);
  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    packetPath,
    packet,
  };
}

function summarizePacketChanges(args: {
  previous: EpisodePacket | null;
  next: EpisodePacket;
}): string[] {
  if (!args.previous) {
    return ["No previous packet on disk; created fresh packet."];
  }
  const changes: string[] = [];
  if (args.previous.primaryThreadId !== args.next.primaryThreadId) {
    changes.push(
      `primaryThreadId: ${args.previous.primaryThreadId} -> ${args.next.primaryThreadId}`,
    );
  }
  if (args.previous.chapterMode !== args.next.chapterMode) {
    changes.push(`chapterMode: ${args.previous.chapterMode} -> ${args.next.chapterMode}`);
  }
  if (args.previous.payoffType !== args.next.payoffType) {
    changes.push(`payoffType: ${args.previous.payoffType} -> ${args.next.payoffType}`);
  }
  if (args.previous.agencyOwnerId !== args.next.agencyOwnerId) {
    changes.push(`agencyOwnerId: ${args.previous.agencyOwnerId} -> ${args.next.agencyOwnerId}`);
  }
  const previousThreadIds = args.previous.activeThreadsUsed.map((item) => item.threadId).join(",");
  const nextThreadIds = args.next.activeThreadsUsed.map((item) => item.threadId).join(",");
  if (previousThreadIds !== nextThreadIds) {
    changes.push(`activeThreadsUsed: [${previousThreadIds}] -> [${nextThreadIds}]`);
  }
  if (args.previous.endHook !== args.next.endHook) {
    changes.push("endHook updated");
  }
  if (args.previous.readerPayoff !== args.next.readerPayoff) {
    changes.push("readerPayoff updated");
  }
  if (args.previous.nonTransferableChoice !== args.next.nonTransferableChoice) {
    changes.push("nonTransferableChoice updated");
  }
  if (changes.length === 0) {
    changes.push("No structural changes detected; packet refreshed in place.");
  }
  return changes;
}

export async function reviseEpisodePacket(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<EpisodeRevisePacketRunResult> {
  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${args.projectId}`);
  }

  const packetPath = chapterEpisodePacketPath(args.projectId, args.chapterNumber);
  const previousPacket = await readJsonArtifact<EpisodePacket>(packetPath);

  const revisionId = `revision-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const revisionPath = previousPacket
    ? chapterEpisodePacketRevisionPath(args.projectId, args.chapterNumber, revisionId)
    : null;
  if (previousPacket && revisionPath) {
    await writeJsonArtifact(revisionPath, previousPacket);
  }

  let [contracts, threads] = await Promise.all([
    repository.loadStoryContracts(args.projectId),
    repository.loadNarrativeThreads(args.projectId),
  ]);
  if (contracts.length === 0 || threads.length === 0) {
    await seedNarrativeRuntime({ projectId: args.projectId });
    [contracts, threads] = await Promise.all([
      repository.loadStoryContracts(args.projectId),
      repository.loadNarrativeThreads(args.projectId),
    ]);
  }

  const chapterArtifacts = await loadAllChapterArtifacts(repository, args.projectId);
  const previousArtifact =
    chapterArtifacts.find((artifact) => artifact.chapterNumber === args.chapterNumber - 1) ?? null;
  const recentConsequences = buildRecentConsequences(
    previousArtifact,
    project.storySetup.currentArcGoal,
  );
  const unresolvedDelayedConsequences = buildUnresolvedDelayedConsequences({
    chapterArtifacts,
    beatOutlines: project.beatOutlines,
    currentChapterNumber: args.chapterNumber,
  });
  const recentCommercialHistory = buildRecentCommercialHistory(
    project.chapterPlans,
    args.chapterNumber,
  );
  const rankedThreads = rankNarrativeThreads(threads, args.chapterNumber);
  const rankedById = new Map(rankedThreads.map((item) => [item.thread.id, item]));
  await repository.saveNarrativeThreads(
    args.projectId,
    threads.map((thread) => {
      const ranked = rankedById.get(thread.id);
      if (!ranked) {
        return thread;
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

  const recentPackets = await loadRecentPacketSummaries({
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
  });
  const packet = buildEpisodePacketFromRuntime({
    project,
    chapterNumber: args.chapterNumber,
    contracts,
    rankedThreads,
    recentConsequences,
    unresolvedDelayedConsequences,
    recentCommercialHistory,
    recentPackets,
  });
  await writeJsonArtifact(packetPath, packet);

  const agencyOwner = project.characters.find((character) => character.id === packet.agencyOwnerId);
  const report = evaluateEpisodeAgency({
    packet,
    agencyOwner,
  });
  const evalPath = chapterEpisodeEvalPath(args.projectId, args.chapterNumber);
  await writeJsonArtifact(evalPath, report);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    packetPath,
    evalPath,
    revisionId,
    revisionPath,
    packet,
    previousPacket,
    changeSummary: summarizePacketChanges({ previous: previousPacket, next: packet }),
    report,
  };
}

export async function evalEpisodePacket(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<EpisodeEvalRunResult> {
  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${args.projectId}`);
  }

  const packetPath = chapterEpisodePacketPath(args.projectId, args.chapterNumber);
  let packet = await readJsonArtifact<EpisodePacket>(packetPath);
  if (!packet) {
    packet = (await planEpisodePacket(args)).packet;
  }

  const agencyOwner = project.characters.find((character) => character.id === packet.agencyOwnerId);
  const report = evaluateEpisodeAgency({
    packet,
    agencyOwner,
  });
  const evalPath = chapterEpisodeEvalPath(args.projectId, args.chapterNumber);
  await writeJsonArtifact(evalPath, report);

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    packetPath,
    evalPath,
    report,
  };
}
