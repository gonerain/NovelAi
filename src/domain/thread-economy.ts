import type { EntityId, NarrativeThread, NarrativeThreadStatus } from "./types.js";

export type ThreadEconomyWarningCode =
  | "thread_overstretched"
  | "thread_neglected"
  | "payoff_too_early"
  | "payoff_overdue"
  | "too_many_seed_only_threads"
  | "minimum_touch_interval_violated";

export interface ThreadEconomyWarning {
  threadId: EntityId | null;
  code: ThreadEconomyWarningCode;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ThreadEconomyEntry {
  threadId: EntityId;
  threadType: NarrativeThread["threadType"];
  status: NarrativeThreadStatus;
  introducedChapter: number;
  lastTouchedChapter: number;
  currentAgeChapters: number;
  dormantChapters: number;
  expectedSpanChapters: number;
  minTouchInterval: number;
  maxDormantChapters: number;
  payoffWindowStart: number;
  payoffWindowEnd: number;
  touchIntervalViolated: boolean;
  setupDebt: number;
  payoffReadiness: number;
  readerDebt: number;
  warnings: ThreadEconomyWarningCode[];
}

export interface ThreadEconomyReport {
  chapterNumber: number;
  totalThreads: number;
  activeThreads: number;
  resolvedThreads: number;
  retiredThreads: number;
  seedOnlyThreads: number;
  entries: ThreadEconomyEntry[];
  warnings: ThreadEconomyWarning[];
  passed: boolean;
}

const SEED_ONLY_THRESHOLD = 3;
const PAYOFF_READY_FLAG = 75;
const PAYOFF_DEBT_FLAG = 60;

function clampPositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function payoffWindow(thread: NarrativeThread): { start: number; end: number } {
  const span = Math.max(1, thread.expectedSpanChapters);
  const introduced = thread.introducedChapter;
  const start = introduced + Math.round(span * 0.6);
  const end = introduced + span;
  return { start, end };
}

function buildEntry(args: {
  thread: NarrativeThread;
  chapterNumber: number;
}): { entry: ThreadEconomyEntry; warnings: ThreadEconomyWarning[] } {
  const { thread, chapterNumber } = args;
  const window = payoffWindow(thread);
  const dormant = clampPositive(chapterNumber - thread.lastTouchedChapter);
  const age = clampPositive(chapterNumber - thread.introducedChapter);
  const touchIntervalViolated =
    thread.minTouchInterval > 0 && dormant > thread.minTouchInterval * 2;

  const warnings: ThreadEconomyWarningCode[] = [];
  const detailWarnings: ThreadEconomyWarning[] = [];

  if (
    thread.currentStatus !== "resolved" &&
    thread.currentStatus !== "retired" &&
    age > thread.expectedSpanChapters
  ) {
    warnings.push("thread_overstretched");
    detailWarnings.push({
      threadId: thread.id,
      code: "thread_overstretched",
      severity: "warning",
      message: `Thread age ${age} exceeds expectedSpanChapters ${thread.expectedSpanChapters}.`,
    });
  }

  if (
    thread.currentStatus !== "resolved" &&
    thread.currentStatus !== "retired" &&
    dormant > thread.maxDormantChapters
  ) {
    warnings.push("thread_neglected");
    detailWarnings.push({
      threadId: thread.id,
      code: "thread_neglected",
      severity: "warning",
      message: `Thread dormant ${dormant} chapters exceeds maxDormantChapters ${thread.maxDormantChapters}.`,
    });
  }

  if (
    thread.currentStatus !== "resolved" &&
    thread.currentStatus !== "retired" &&
    thread.scheduler.payoffReadiness >= PAYOFF_READY_FLAG &&
    chapterNumber < window.start
  ) {
    warnings.push("payoff_too_early");
    detailWarnings.push({
      threadId: thread.id,
      code: "payoff_too_early",
      severity: "warning",
      message: `Payoff readiness ${thread.scheduler.payoffReadiness} signals payoff before window start ${window.start}.`,
    });
  }

  if (
    thread.currentStatus !== "resolved" &&
    thread.currentStatus !== "retired" &&
    chapterNumber > window.end &&
    thread.scheduler.readerDebt >= PAYOFF_DEBT_FLAG
  ) {
    warnings.push("payoff_overdue");
    detailWarnings.push({
      threadId: thread.id,
      code: "payoff_overdue",
      severity: "error",
      message: `Past payoff window end ${window.end} with readerDebt ${thread.scheduler.readerDebt}; payoff is overdue.`,
    });
  }

  if (touchIntervalViolated && thread.currentStatus !== "resolved" && thread.currentStatus !== "retired") {
    detailWarnings.push({
      threadId: thread.id,
      code: "minimum_touch_interval_violated",
      severity: "warning",
      message: `Minimum touch interval ${thread.minTouchInterval} violated (${dormant} chapters dormant).`,
    });
    if (!warnings.includes("minimum_touch_interval_violated")) {
      warnings.push("minimum_touch_interval_violated");
    }
  }

  const entry: ThreadEconomyEntry = {
    threadId: thread.id,
    threadType: thread.threadType,
    status: thread.currentStatus,
    introducedChapter: thread.introducedChapter,
    lastTouchedChapter: thread.lastTouchedChapter,
    currentAgeChapters: age,
    dormantChapters: dormant,
    expectedSpanChapters: thread.expectedSpanChapters,
    minTouchInterval: thread.minTouchInterval,
    maxDormantChapters: thread.maxDormantChapters,
    payoffWindowStart: window.start,
    payoffWindowEnd: window.end,
    touchIntervalViolated,
    setupDebt: thread.scheduler.setupDebt,
    payoffReadiness: thread.scheduler.payoffReadiness,
    readerDebt: thread.scheduler.readerDebt,
    warnings,
  };

  return { entry, warnings: detailWarnings };
}

export function computeThreadEconomyReport(args: {
  threads: NarrativeThread[];
  chapterNumber: number;
}): ThreadEconomyReport {
  const entries: ThreadEconomyEntry[] = [];
  const warnings: ThreadEconomyWarning[] = [];

  for (const thread of args.threads) {
    const { entry, warnings: entryWarnings } = buildEntry({
      thread,
      chapterNumber: args.chapterNumber,
    });
    entries.push(entry);
    warnings.push(...entryWarnings);
  }

  const seedOnlyThreads = args.threads.filter(
    (thread) => thread.currentStatus === "seeded",
  ).length;
  if (seedOnlyThreads >= SEED_ONLY_THRESHOLD) {
    warnings.push({
      threadId: null,
      code: "too_many_seed_only_threads",
      severity: "warning",
      message: `${seedOnlyThreads} threads remain in 'seeded' status; consider activating or retiring some.`,
    });
  }

  return {
    chapterNumber: args.chapterNumber,
    totalThreads: args.threads.length,
    activeThreads: args.threads.filter(
      (thread) =>
        thread.currentStatus !== "resolved" && thread.currentStatus !== "retired",
    ).length,
    resolvedThreads: args.threads.filter((thread) => thread.currentStatus === "resolved").length,
    retiredThreads: args.threads.filter((thread) => thread.currentStatus === "retired").length,
    seedOnlyThreads,
    entries,
    warnings,
    passed: warnings.every((warning) => warning.severity !== "error"),
  };
}
