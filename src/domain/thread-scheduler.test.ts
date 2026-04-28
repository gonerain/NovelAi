import test from "node:test";
import assert from "node:assert/strict";

import { calculateThreadScore, rankNarrativeThreads, updateThreadStaleness } from "./thread-scheduler.js";
import type { NarrativeThread } from "./types.js";

function makeThread(overrides: Partial<NarrativeThread> = {}): NarrativeThread {
  return {
    id: overrides.id ?? "thread-a",
    threadType: overrides.threadType ?? "plot_threat",
    title: overrides.title ?? "Thread A",
    ownerCharacterIds: overrides.ownerCharacterIds ?? ["protagonist"],
    introducedChapter: overrides.introducedChapter ?? 1,
    currentStatus: overrides.currentStatus ?? "active",
    readerQuestion: overrides.readerQuestion ?? "What happens next?",
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
      payoffReadiness: 20,
      setupDebt: 20,
      readerDebt: 40,
      agencyPotential: 60,
      offscreenPressure: 10,
    },
  };
}

test("calculateThreadScore applies weighted runtime controls", () => {
  const result = calculateThreadScore(
    makeThread({
      scheduler: {
        urgency: 100,
        heat: 100,
        staleness: 100,
        payoffReadiness: 100,
        setupDebt: 0,
        readerDebt: 100,
        agencyPotential: 100,
        offscreenPressure: 100,
      },
    }),
  );

  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("high urgency"));
  assert.ok(result.warnings.includes("ready_for_payoff"));
});

test("updateThreadStaleness derives dormancy pressure from chapter distance", () => {
  const updated = updateThreadStaleness(
    makeThread({
      lastTouchedChapter: 2,
      maxDormantChapters: 4,
      scheduler: {
        urgency: 10,
        heat: 10,
        staleness: 0,
        payoffReadiness: 10,
        setupDebt: 10,
        readerDebt: 10,
        agencyPotential: 10,
        offscreenPressure: 10,
      },
    }),
    5,
  );

  assert.equal(updated.scheduler.staleness, 75);
});

test("rankNarrativeThreads ignores resolved threads and sorts by score", () => {
  const ranked = rankNarrativeThreads(
    [
      makeThread({
        id: "low",
        scheduler: {
          urgency: 10,
          heat: 10,
          staleness: 0,
          payoffReadiness: 10,
          setupDebt: 70,
          readerDebt: 10,
          agencyPotential: 10,
          offscreenPressure: 10,
        },
      }),
      makeThread({
        id: "high",
        scheduler: {
          urgency: 90,
          heat: 80,
          staleness: 0,
          payoffReadiness: 70,
          setupDebt: 0,
          readerDebt: 80,
          agencyPotential: 80,
          offscreenPressure: 40,
        },
      }),
      makeThread({
        id: "done",
        currentStatus: "resolved",
        scheduler: {
          urgency: 100,
          heat: 100,
          staleness: 100,
          payoffReadiness: 100,
          setupDebt: 0,
          readerDebt: 100,
          agencyPotential: 100,
          offscreenPressure: 100,
        },
      }),
    ],
    1,
  );

  assert.deepEqual(ranked.map((item) => item.thread.id), ["high", "low"]);
});

