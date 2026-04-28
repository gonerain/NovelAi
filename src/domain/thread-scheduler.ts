import type { NarrativeThread, ThreadSchedulerState } from "./types.js";

export interface ThreadScoreBreakdown {
  urgency: number;
  heat: number;
  staleness: number;
  readerDebt: number;
  payoffReadiness: number;
  agencyPotential: number;
  offscreenPressure: number;
  setupDebtPenalty: number;
}

export interface ThreadRankResult {
  thread: NarrativeThread;
  score: number;
  reasons: string[];
  warnings: string[];
  breakdown: ThreadScoreBreakdown;
}

export function clampSchedulerValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeScheduler(state: ThreadSchedulerState): ThreadSchedulerState {
  return {
    urgency: clampSchedulerValue(state.urgency),
    heat: clampSchedulerValue(state.heat),
    staleness: clampSchedulerValue(state.staleness),
    payoffReadiness: clampSchedulerValue(state.payoffReadiness),
    setupDebt: clampSchedulerValue(state.setupDebt),
    readerDebt: clampSchedulerValue(state.readerDebt),
    agencyPotential: clampSchedulerValue(state.agencyPotential),
    offscreenPressure: clampSchedulerValue(state.offscreenPressure),
    lastScore: state.lastScore,
    lastScoreReasons: state.lastScoreReasons,
  };
}

export function calculateThreadScore(thread: NarrativeThread): ThreadRankResult {
  const scheduler = normalizeScheduler(thread.scheduler);
  const breakdown: ThreadScoreBreakdown = {
    urgency: scheduler.urgency * 0.24,
    heat: scheduler.heat * 0.2,
    staleness: scheduler.staleness * 0.16,
    readerDebt: scheduler.readerDebt * 0.14,
    payoffReadiness: scheduler.payoffReadiness * 0.12,
    agencyPotential: scheduler.agencyPotential * 0.1,
    offscreenPressure: scheduler.offscreenPressure * 0.04,
    setupDebtPenalty: scheduler.setupDebt * -0.12,
  };
  const rawScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const score = clampSchedulerValue(rawScore);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (scheduler.urgency >= 70) {
    reasons.push("high urgency");
  }
  if (scheduler.heat >= 70) {
    reasons.push("high heat");
  }
  if (scheduler.staleness >= 80) {
    reasons.push("thread has gone stale");
    warnings.push("high_staleness_requires_touch");
  }
  if (scheduler.readerDebt >= 60) {
    reasons.push("reader promise debt is accumulating");
  }
  if (scheduler.payoffReadiness >= 75) {
    reasons.push("payoff is nearly ready");
    warnings.push("ready_for_payoff");
  }
  if (scheduler.payoffReadiness >= 75 && scheduler.readerDebt >= 60) {
    reasons.push("reader debt supports payoff or half-payoff");
    warnings.push("payoff_or_half_payoff_suggested");
  }
  if (scheduler.setupDebt >= 70) {
    reasons.push("setup debt blocks a clean payoff");
    warnings.push("setup_debt_blocks_payoff");
    warnings.push("primary_selection_blocked_until_repaired");
  }
  if (scheduler.agencyPotential < 40) {
    warnings.push("low_agency_needs_repair");
    warnings.push("primary_selection_blocked_until_repaired");
  }
  if (scheduler.offscreenPressure >= 50) {
    reasons.push("offscreen pressure is moving");
  }
  if (thread.currentStatus === "ready_for_payoff") {
    reasons.push("status is ready_for_payoff");
    warnings.push("ready_for_payoff");
  }

  return {
    thread: {
      ...thread,
      scheduler,
    },
    score,
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
    breakdown,
  };
}

export function updateThreadStaleness(
  thread: NarrativeThread,
  currentChapter: number,
): NarrativeThread {
  const dormantChapters = Math.max(0, currentChapter - thread.lastTouchedChapter);
  const maxDormant = Math.max(1, thread.maxDormantChapters);
  const calculatedStaleness = clampSchedulerValue((dormantChapters / maxDormant) * 100);

  return {
    ...thread,
    scheduler: {
      ...thread.scheduler,
      staleness: Math.max(clampSchedulerValue(thread.scheduler.staleness), calculatedStaleness),
    },
  };
}

export function rankNarrativeThreads(
  threads: NarrativeThread[],
  currentChapter: number,
): ThreadRankResult[] {
  return threads
    .filter((thread) => thread.currentStatus !== "resolved" && thread.currentStatus !== "retired")
    .map((thread) => calculateThreadScore(updateThreadStaleness(thread, currentChapter)))
    .sort(
      (left, right) =>
        Number(left.warnings.includes("primary_selection_blocked_until_repaired")) -
          Number(right.warnings.includes("primary_selection_blocked_until_repaired")) ||
        right.score - left.score ||
        right.thread.scheduler.urgency - left.thread.scheduler.urgency ||
        left.thread.lastTouchedChapter - right.thread.lastTouchedChapter ||
        left.thread.id.localeCompare(right.thread.id),
    );
}
