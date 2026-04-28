import type {
  CastCharacterOutline,
  NarrativeThread,
  OffscreenActorType,
  OffscreenApplyReport,
  OffscreenEvalReport,
  OffscreenMove,
  OffscreenMoveType,
  StoryProject,
} from "./domain/index.js";
import {
  applyDueOffscreenMoves,
  evaluateOffscreenMoves,
} from "./domain/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { narrativeThreadsPath, offscreenMovesPath } from "./v1-paths.js";

export interface OffscreenScheduleRunResult {
  projectId: string;
  offscreenMovesPath: string;
  movesCreated: number;
  movesKept: number;
  totalMoves: number;
  moves: OffscreenMove[];
}

export interface OffscreenInspectRunResult {
  projectId: string;
  offscreenMovesPath: string;
  totalMoves: number;
  pendingMoves: number;
  appliedMoves: number;
  hiddenMoves: number;
  moves: OffscreenMove[];
  evalReport: OffscreenEvalReport;
}

export interface OffscreenApplyRunResult {
  projectId: string;
  chapterNumber: number;
  offscreenMovesPath: string;
  narrativeThreadsPath: string;
  applyReport: OffscreenApplyReport;
}

const ANTAGONIST_KEYWORDS = ["反派", "对手", "敌", "antagonist", "villain", "enemy"];
const RIVAL_KEYWORDS = ["竞争", "对照", "rival"];
const INSTITUTION_KEYWORDS = ["宗门", "家族", "组织", "institution", "guild"];

function classifyActorType(role: string, storyFunction: string): OffscreenActorType {
  const haystack = `${role} ${storyFunction}`.toLowerCase();
  if (ANTAGONIST_KEYWORDS.some((token) => haystack.includes(token.toLowerCase()))) {
    return "antagonist";
  }
  if (RIVAL_KEYWORDS.some((token) => haystack.includes(token.toLowerCase()))) {
    return "rival";
  }
  if (INSTITUTION_KEYWORDS.some((token) => haystack.includes(token.toLowerCase()))) {
    return "institution";
  }
  return "ally_with_agenda";
}

function selectAntagonisticCast(project: StoryProject): CastCharacterOutline[] {
  const cast = project.castOutlines ?? [];
  const protagonistIds = new Set(project.storySetup.defaultActiveCharacterIds);
  const candidates = cast.filter((member) => !protagonistIds.has(member.id));
  return candidates.slice(0, 3);
}

function pickTargetThread(args: {
  threads: NarrativeThread[];
  preferredTypes: NarrativeThread["threadType"][];
  excludeIds: Set<string>;
}): NarrativeThread | undefined {
  const usable = args.threads.filter(
    (thread) =>
      !args.excludeIds.has(thread.id) &&
      thread.currentStatus !== "resolved" &&
      thread.currentStatus !== "retired",
  );
  for (const type of args.preferredTypes) {
    const found = usable.find((thread) => thread.threadType === type);
    if (found) {
      return found;
    }
  }
  return usable[0];
}

function moveTypeForActor(actorType: OffscreenActorType): OffscreenMoveType {
  switch (actorType) {
    case "antagonist":
      return "advance_plan";
    case "rival":
      return "exploit_resource";
    case "institution":
      return "create_deadline";
    case "ally_with_agenda":
      return "pressure_ally";
    case "social_pressure":
      return "escalate_cost";
    case "systemic_force":
      return "mislead";
  }
}

function buildSeedMoves(args: {
  project: StoryProject;
  threads: NarrativeThread[];
  startChapter: number;
}): OffscreenMove[] {
  const cast = selectAntagonisticCast(args.project);
  const moves: OffscreenMove[] = [];
  const usedTargetIds = new Set<string>();

  cast.forEach((member, index) => {
    const actorType = classifyActorType(member.role, member.storyFunction);
    const moveType = moveTypeForActor(actorType);
    const target = pickTargetThread({
      threads: args.threads,
      preferredTypes: ["plot_threat", "rival_pressure", "promise"],
      excludeIds: usedTargetIds,
    });
    if (!target) {
      return;
    }
    usedTargetIds.add(target.id);

    const scheduledChapter = Math.max(args.startChapter, args.startChapter + index * 2);
    moves.push({
      id: `offscreen-${member.id}-${moveType}`,
      actorId: member.id,
      actorName: member.name,
      actorType,
      targetThreadId: target.id,
      moveType,
      description: `${member.name}（${member.role}）借助 ${moveType} 推进 ${target.title} 的暗线压力。`,
      scheduledChapter,
      visibility: index === 0 ? "hinted" : "hidden",
      expectedRevealWindow: 4 + index,
      pressureAdded: 30 + index * 5,
      counterplayOpportunity: `主角可借由调查或对抗 ${member.name} 的 ${moveType} 行动来反制并将其转为可见进展。`,
      status: "pending",
    });
  });

  if (moves.length === 0 && args.threads.length > 0) {
    const fallbackTarget = args.threads.find(
      (thread) => thread.threadType === "plot_threat",
    ) ?? args.threads[0];
    moves.push({
      id: `offscreen-systemic-${fallbackTarget.id}`,
      actorId: "systemic-force",
      actorName: "系统性压力",
      actorType: "systemic_force",
      targetThreadId: fallbackTarget.id,
      moveType: "create_deadline",
      description: "系统性压力默默推进，制造无形截止期。",
      scheduledChapter: args.startChapter,
      visibility: "hidden",
      expectedRevealWindow: 5,
      pressureAdded: 25,
      counterplayOpportunity: "主角可主动调查时间线，将隐性截止期转为可见线索。",
      status: "pending",
    });
  }

  return moves;
}

function mergeMoves(args: {
  existing: OffscreenMove[];
  candidates: OffscreenMove[];
}): { merged: OffscreenMove[]; created: number; kept: number } {
  const existingIds = new Set(args.existing.map((move) => move.id));
  const additions = args.candidates.filter((move) => !existingIds.has(move.id));
  return {
    merged: [...args.existing, ...additions],
    created: additions.length,
    kept: args.existing.length,
  };
}

export async function scheduleOffscreenMoves(args: {
  projectId: string;
  startChapter?: number;
}): Promise<OffscreenScheduleRunResult> {
  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${args.projectId}`);
  }
  const threads = await repository.loadNarrativeThreads(args.projectId);
  if (threads.length === 0) {
    throw new Error(
      `Narrative threads not found. Run: ./run-v1.sh threads seed --project ${args.projectId}`,
    );
  }
  const existing = await repository.loadOffscreenMoves(args.projectId);
  const startChapter = args.startChapter ?? 1;
  const candidates = buildSeedMoves({ project, threads, startChapter });
  const { merged, created, kept } = mergeMoves({ existing, candidates });

  if (created > 0 || existing.length === 0) {
    await repository.saveOffscreenMoves(args.projectId, merged);
  }

  return {
    projectId: args.projectId,
    offscreenMovesPath: offscreenMovesPath(args.projectId),
    movesCreated: created,
    movesKept: kept,
    totalMoves: merged.length,
    moves: merged,
  };
}

export async function inspectOffscreenMoves(args: {
  projectId: string;
  chapterNumber?: number;
}): Promise<OffscreenInspectRunResult> {
  const repository = new FileProjectRepository();
  const [moves, threads] = await Promise.all([
    repository.loadOffscreenMoves(args.projectId),
    repository.loadNarrativeThreads(args.projectId),
  ]);
  const evalChapter =
    args.chapterNumber && args.chapterNumber >= 1
      ? args.chapterNumber
      : Math.max(
          1,
          ...moves.map((move) => move.appliedAtChapter ?? move.scheduledChapter),
        );
  const evalReport = evaluateOffscreenMoves({
    chapterNumber: evalChapter,
    moves,
    threads,
  });

  return {
    projectId: args.projectId,
    offscreenMovesPath: offscreenMovesPath(args.projectId),
    totalMoves: moves.length,
    pendingMoves: moves.filter((move) => move.status === "pending").length,
    appliedMoves: moves.filter(
      (move) => move.status === "applied" || move.status === "revealed",
    ).length,
    hiddenMoves: moves.filter((move) => move.visibility === "hidden").length,
    moves,
    evalReport,
  };
}

export async function applyOffscreenMovesForChapter(args: {
  projectId: string;
  chapterNumber: number;
}): Promise<OffscreenApplyRunResult> {
  const repository = new FileProjectRepository();
  const [moves, threads] = await Promise.all([
    repository.loadOffscreenMoves(args.projectId),
    repository.loadNarrativeThreads(args.projectId),
  ]);
  const result = applyDueOffscreenMoves({
    threads,
    moves,
    chapterNumber: args.chapterNumber,
  });

  if (result.report.appliedCount > 0) {
    await repository.saveNarrativeThreads(args.projectId, result.threads);
    await repository.saveOffscreenMoves(args.projectId, result.moves);
  }

  return {
    projectId: args.projectId,
    chapterNumber: args.chapterNumber,
    offscreenMovesPath: offscreenMovesPath(args.projectId),
    narrativeThreadsPath: narrativeThreadsPath(args.projectId),
    applyReport: result.report,
  };
}
