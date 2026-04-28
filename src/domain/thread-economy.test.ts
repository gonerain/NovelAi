import test from "node:test";
import assert from "node:assert/strict";

import { computeThreadEconomyReport } from "./thread-economy.js";
import type { NarrativeThread } from "./types.js";

function makeThread(overrides: Partial<NarrativeThread> = {}): NarrativeThread {
  return {
    id: overrides.id ?? "thread-a",
    threadType: overrides.threadType ?? "plot_threat",
    title: overrides.title ?? "Thread A",
    ownerCharacterIds: overrides.ownerCharacterIds ?? ["protagonist"],
    introducedChapter: overrides.introducedChapter ?? 1,
    currentStatus: overrides.currentStatus ?? "active",
    readerQuestion: overrides.readerQuestion ?? "What changes?",
    pressure: overrides.pressure ?? "pressure",
    stakes: overrides.stakes ?? "stakes",
    nextUsefulMoves: overrides.nextUsefulMoves ?? ["pressure"],
    blockedBy: overrides.blockedBy ?? [],
    payoffConditions: overrides.payoffConditions ?? ["choice"],
    payoffTypeOptions: overrides.payoffTypeOptions ?? ["strategic_reversal"],
    lastTouchedChapter: overrides.lastTouchedChapter ?? 1,
    cadenceTarget: overrides.cadenceTarget ?? "frequent",
    expectedSpanChapters: overrides.expectedSpanChapters ?? 30,
    minTouchInterval: overrides.minTouchInterval ?? 1,
    maxDormantChapters: overrides.maxDormantChapters ?? 4,
    allowedModes: overrides.allowedModes ?? ["pressure"],
    relatedContracts: overrides.relatedContracts ?? [],
    scheduler: overrides.scheduler ?? {
      urgency: 50,
      heat: 50,
      staleness: 0,
      payoffReadiness: 30,
      setupDebt: 30,
      readerDebt: 30,
      agencyPotential: 50,
      offscreenPressure: 20,
    },
  };
}

test("dormant beyond maxDormantChapters flags thread_neglected", () => {
  const thread = makeThread({
    lastTouchedChapter: 1,
    maxDormantChapters: 3,
  });
  const report = computeThreadEconomyReport({ threads: [thread], chapterNumber: 8 });
  const entry = report.entries[0];
  assert.ok(entry.warnings.includes("thread_neglected"));
  assert.ok(report.warnings.some((w) => w.code === "thread_neglected"));
});

test("age beyond expectedSpanChapters flags thread_overstretched", () => {
  const thread = makeThread({
    introducedChapter: 1,
    expectedSpanChapters: 5,
  });
  const report = computeThreadEconomyReport({ threads: [thread], chapterNumber: 12 });
  assert.ok(report.entries[0].warnings.includes("thread_overstretched"));
});

test("high payoff readiness before window start flags payoff_too_early on slow_burn", () => {
  const thread = makeThread({
    introducedChapter: 1,
    expectedSpanChapters: 50,
    cadenceTarget: "slow_burn",
    scheduler: {
      urgency: 70,
      heat: 70,
      staleness: 0,
      payoffReadiness: 90,
      setupDebt: 30,
      readerDebt: 30,
      agencyPotential: 70,
      offscreenPressure: 20,
    },
  });
  const report = computeThreadEconomyReport({ threads: [thread], chapterNumber: 5 });
  assert.ok(report.entries[0].warnings.includes("payoff_too_early"));
});

test("frequent cadence threads are exempt from payoff_too_early", () => {
  // Web-fiction reality: a 500-chapter "frequent" or "every_chapter" thread is
  // designed to produce micro-payoffs almost every chapter. Hitting
  // payoffReadiness=100 at chapter 3 isn't a bug; it's the genre.
  const frequent = makeThread({
    id: "thread-frequent",
    introducedChapter: 1,
    expectedSpanChapters: 500,
    cadenceTarget: "frequent",
    scheduler: {
      urgency: 95,
      heat: 95,
      staleness: 0,
      payoffReadiness: 100,
      setupDebt: 0,
      readerDebt: 0,
      agencyPotential: 95,
      offscreenPressure: 30,
    },
  });
  const everyChapter = makeThread({
    id: "thread-every-chapter",
    introducedChapter: 1,
    expectedSpanChapters: 500,
    cadenceTarget: "every_chapter",
    scheduler: { ...frequent.scheduler },
  });
  const report = computeThreadEconomyReport({
    threads: [frequent, everyChapter],
    chapterNumber: 3,
  });
  for (const entry of report.entries) {
    assert.ok(
      !entry.warnings.includes("payoff_too_early"),
      `${entry.threadId} should be exempt from payoff_too_early on cadence=${entry.threadType}`,
    );
  }
});

test("periodic cadence uses tighter threshold for payoff_too_early", () => {
  // payoffReadiness=80 below the 90 threshold for periodic should NOT trigger.
  const safe = makeThread({
    introducedChapter: 1,
    expectedSpanChapters: 50,
    cadenceTarget: "periodic",
    scheduler: {
      urgency: 70,
      heat: 70,
      staleness: 0,
      payoffReadiness: 80,
      setupDebt: 30,
      readerDebt: 30,
      agencyPotential: 70,
      offscreenPressure: 20,
    },
  });
  const safeReport = computeThreadEconomyReport({ threads: [safe], chapterNumber: 5 });
  assert.ok(!safeReport.entries[0].warnings.includes("payoff_too_early"));

  // payoffReadiness=95 above the 90 threshold should trigger.
  const noisy = makeThread({
    ...safe,
    scheduler: { ...safe.scheduler, payoffReadiness: 95 },
  });
  const noisyReport = computeThreadEconomyReport({ threads: [noisy], chapterNumber: 5 });
  assert.ok(noisyReport.entries[0].warnings.includes("payoff_too_early"));
});

test("past payoff window with high readerDebt flags payoff_overdue (error)", () => {
  const thread = makeThread({
    introducedChapter: 1,
    expectedSpanChapters: 5,
    scheduler: {
      urgency: 60,
      heat: 60,
      staleness: 0,
      payoffReadiness: 50,
      setupDebt: 30,
      readerDebt: 80,
      agencyPotential: 60,
      offscreenPressure: 30,
    },
  });
  const report = computeThreadEconomyReport({ threads: [thread], chapterNumber: 12 });
  assert.ok(report.entries[0].warnings.includes("payoff_overdue"));
  assert.equal(report.passed, false);
});

test("too many seeded threads flags too_many_seed_only_threads", () => {
  const threads = [
    makeThread({ id: "t1", currentStatus: "seeded" }),
    makeThread({ id: "t2", currentStatus: "seeded" }),
    makeThread({ id: "t3", currentStatus: "seeded" }),
  ];
  const report = computeThreadEconomyReport({ threads, chapterNumber: 4 });
  assert.ok(report.warnings.some((w) => w.code === "too_many_seed_only_threads"));
});

test("resolved/retired threads do not raise overstretched/neglected warnings", () => {
  const threads = [
    makeThread({
      id: "t-resolved",
      currentStatus: "resolved",
      introducedChapter: 1,
      expectedSpanChapters: 3,
      lastTouchedChapter: 2,
      maxDormantChapters: 1,
    }),
    makeThread({
      id: "t-retired",
      currentStatus: "retired",
      introducedChapter: 1,
      expectedSpanChapters: 3,
      lastTouchedChapter: 2,
      maxDormantChapters: 1,
    }),
  ];
  const report = computeThreadEconomyReport({ threads, chapterNumber: 20 });
  for (const entry of report.entries) {
    assert.ok(!entry.warnings.includes("thread_overstretched"));
    assert.ok(!entry.warnings.includes("thread_neglected"));
  }
});
