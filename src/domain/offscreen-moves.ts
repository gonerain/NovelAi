import type {
  EntityId,
  NarrativeThread,
  OffscreenActorType,
  OffscreenMove,
  OffscreenMoveType,
  ThreadSchedulerState,
} from "./types.js";
import { clampSchedulerValue } from "./thread-scheduler.js";

export interface OffscreenMoveApplication {
  moveId: EntityId;
  actorName: string;
  actorType: OffscreenActorType;
  targetThreadId: EntityId;
  moveType: OffscreenMoveType;
  pressureAdded: number;
  visibilityAtApply: OffscreenMove["visibility"];
  scheduledChapter: number;
  appliedAtChapter: number;
}

export interface OffscreenApplyReport {
  chapterNumber: number;
  appliedCount: number;
  skippedCount: number;
  applied: OffscreenMoveApplication[];
}

export interface OffscreenApplyResult {
  threads: NarrativeThread[];
  moves: OffscreenMove[];
  report: OffscreenApplyReport;
}

function clamp01to100(value: number): number {
  return clampSchedulerValue(value);
}

function pressureToScheduler(args: {
  scheduler: ThreadSchedulerState;
  move: OffscreenMove;
}): ThreadSchedulerState {
  const { scheduler, move } = args;
  const pressure = Math.max(0, Math.min(100, Math.round(move.pressureAdded)));

  let urgencyBonus = 0;
  let heatBonus = 0;
  let offscreenBonus = pressure;

  if (move.visibility === "hidden") {
    urgencyBonus = Math.round(pressure * 0.3);
  } else if (move.visibility === "hinted") {
    urgencyBonus = Math.round(pressure * 0.4);
    heatBonus = Math.round(pressure * 0.25);
  } else {
    urgencyBonus = Math.round(pressure * 0.5);
    heatBonus = Math.round(pressure * 0.4);
  }

  switch (move.moveType) {
    case "create_deadline":
      urgencyBonus += 8;
      break;
    case "escalate_cost":
      urgencyBonus += 5;
      heatBonus += 3;
      break;
    case "advance_plan":
      offscreenBonus += 4;
      break;
    case "cover_tracks":
      offscreenBonus += 5;
      break;
    case "exploit_resource":
      heatBonus += 4;
      break;
    case "mislead":
      heatBonus += 2;
      break;
    case "pressure_ally":
      heatBonus += 4;
      urgencyBonus += 3;
      break;
  }

  return {
    ...scheduler,
    urgency: clamp01to100(scheduler.urgency + urgencyBonus),
    heat: clamp01to100(scheduler.heat + heatBonus),
    offscreenPressure: clamp01to100(scheduler.offscreenPressure + offscreenBonus),
  };
}

export function applyDueOffscreenMoves(args: {
  threads: NarrativeThread[];
  moves: OffscreenMove[];
  chapterNumber: number;
}): OffscreenApplyResult {
  const threadIndex = new Map(args.threads.map((thread) => [thread.id, thread]));
  const updatedThreads = new Map<EntityId, NarrativeThread>();
  const applied: OffscreenMoveApplication[] = [];
  let skippedCount = 0;

  const updatedMoves = args.moves.map((move) => {
    const isDue = move.scheduledChapter <= args.chapterNumber;
    const alreadyApplied = move.status === "applied" || move.status === "revealed";
    if (!isDue || alreadyApplied || move.status === "skipped") {
      return move;
    }

    const targetThread = updatedThreads.get(move.targetThreadId) ?? threadIndex.get(move.targetThreadId);
    if (!targetThread) {
      skippedCount += 1;
      return { ...move, status: "skipped" as const };
    }

    const updatedScheduler = pressureToScheduler({
      scheduler: targetThread.scheduler,
      move,
    });
    const updatedThread: NarrativeThread = {
      ...targetThread,
      scheduler: updatedScheduler,
    };
    updatedThreads.set(targetThread.id, updatedThread);

    applied.push({
      moveId: move.id,
      actorName: move.actorName,
      actorType: move.actorType,
      targetThreadId: move.targetThreadId,
      moveType: move.moveType,
      pressureAdded: move.pressureAdded,
      visibilityAtApply: move.visibility,
      scheduledChapter: move.scheduledChapter,
      appliedAtChapter: args.chapterNumber,
    });

    return {
      ...move,
      status: "applied" as const,
      appliedAtChapter: args.chapterNumber,
    };
  });

  const threads = args.threads.map((thread) => updatedThreads.get(thread.id) ?? thread);

  return {
    threads,
    moves: updatedMoves,
    report: {
      chapterNumber: args.chapterNumber,
      appliedCount: applied.length,
      skippedCount,
      applied,
    },
  };
}

export type OffscreenEvalCode =
  | "hidden_reveal_window_overdue"
  | "antagonist_only_reactive"
  | "missing_counterplay"
  | "missing_target_thread";

export interface OffscreenEvalFinding {
  moveId: EntityId;
  severity: "info" | "warning" | "error";
  code: OffscreenEvalCode;
  message: string;
}

export interface OffscreenEvalReport {
  chapterNumber: number;
  totalMoves: number;
  hiddenMoves: number;
  appliedMoves: number;
  passed: boolean;
  findings: OffscreenEvalFinding[];
}

export function evaluateOffscreenMoves(args: {
  chapterNumber: number;
  moves: OffscreenMove[];
  threads: NarrativeThread[];
}): OffscreenEvalReport {
  const findings: OffscreenEvalFinding[] = [];
  const threadIds = new Set(args.threads.map((thread) => thread.id));
  const adversarialActors: OffscreenActorType[] = ["antagonist", "rival", "institution"];
  const adversarialMoves = args.moves.filter((move) => adversarialActors.includes(move.actorType));
  const adversarialAppliedBeforeOrAtCurrent = adversarialMoves.filter(
    (move) =>
      (move.appliedAtChapter ?? move.scheduledChapter) <= args.chapterNumber &&
      move.status !== "skipped",
  );

  for (const move of args.moves) {
    if (!threadIds.has(move.targetThreadId)) {
      findings.push({
        moveId: move.id,
        severity: "warning",
        code: "missing_target_thread",
        message: `Offscreen move targets unknown thread ${move.targetThreadId}.`,
      });
    }

    if (move.counterplayOpportunity.trim().length < 4) {
      findings.push({
        moveId: move.id,
        severity: "warning",
        code: "missing_counterplay",
        message: "Offscreen move must offer a counterplay opportunity for the protagonist.",
      });
    }

    if (move.visibility === "hidden") {
      const hiddenSince = move.appliedAtChapter ?? move.scheduledChapter;
      const dueRevealBy = hiddenSince + Math.max(1, move.expectedRevealWindow);
      if (args.chapterNumber > dueRevealBy && move.status !== "revealed") {
        findings.push({
          moveId: move.id,
          severity: "error",
          code: "hidden_reveal_window_overdue",
          message: `Hidden move past expected reveal window (chapter ${dueRevealBy}); reveal or hint is overdue.`,
        });
      }
    }
  }

  if (adversarialMoves.length > 0 && adversarialAppliedBeforeOrAtCurrent.length === 0) {
    findings.push({
      moveId: adversarialMoves[0].id,
      severity: "warning",
      code: "antagonist_only_reactive",
      message: "No adversarial offscreen move has been applied yet; antagonist looks only reactive.",
    });
  }

  return {
    chapterNumber: args.chapterNumber,
    totalMoves: args.moves.length,
    hiddenMoves: args.moves.filter((move) => move.visibility === "hidden").length,
    appliedMoves: args.moves.filter(
      (move) => move.status === "applied" || move.status === "revealed",
    ).length,
    passed: findings.every((finding) => finding.severity !== "error"),
    findings,
  };
}
