import test from "node:test";
import assert from "node:assert/strict";

import { applyDeltasToThreads } from "./thread-updater.js";
import type {
  NarrativeThread,
  StateDelta,
  StoryContract,
} from "./types.js";

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
      staleness: 30,
      payoffReadiness: 30,
      setupDebt: 30,
      readerDebt: 60,
      agencyPotential: 60,
      offscreenPressure: 20,
    },
  };
}

function makeDelta(overrides: Partial<StateDelta> = {}): StateDelta {
  return {
    id: overrides.id ?? "delta-1",
    chapterNumber: overrides.chapterNumber ?? 4,
    deltaType: overrides.deltaType ?? "thread_progress",
    targetType: overrides.targetType ?? "thread",
    targetId: overrides.targetId ?? "thread-a",
    before: overrides.before ?? "before",
    after: overrides.after ?? "after",
    causalWeight: overrides.causalWeight ?? "major",
    visibility: overrides.visibility ?? "reader_visible",
    evidenceSnippet: overrides.evidenceSnippet ?? "evidence snippet content",
    confidence: overrides.confidence ?? 0.8,
    contractImpact: overrides.contractImpact ?? [],
    source: overrides.source ?? "episode_packet",
  };
}

const baseContract: StoryContract = {
  id: "contract-reader",
  contractType: "reader_promise",
  statement: "reader promise",
  readerVisible: true,
  createdAtChapter: 1,
  priority: "high",
  evidence: [],
  forbiddenMoves: [],
  payoffSignals: [],
  status: "active",
};

test("reader-visible major delta lowers readerDebt and bumps heat", () => {
  const thread = makeThread();
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [makeDelta()],
    contracts: [baseContract],
    chapterNumber: 4,
  });

  const updated = result.threads[0];
  assert.equal(updated.lastTouchedChapter, 4);
  assert.ok(updated.scheduler.readerDebt < thread.scheduler.readerDebt);
  assert.ok(updated.scheduler.heat > thread.scheduler.heat);
  assert.equal(result.report.threadsTouched, 1);
  assert.equal(result.report.appliedDeltaCount, 1);
  assert.equal(result.report.unmatchedDeltaIds.length, 0);
});

test("hidden/offscreen delta raises offscreenPressure but not readerDebt", () => {
  const thread = makeThread({
    scheduler: {
      urgency: 30,
      heat: 30,
      staleness: 0,
      payoffReadiness: 20,
      setupDebt: 30,
      readerDebt: 40,
      agencyPotential: 50,
      offscreenPressure: 20,
    },
  });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [
      makeDelta({
        id: "delta-hidden",
        visibility: "offscreen",
        causalWeight: "major",
      }),
    ],
    contracts: [baseContract],
    chapterNumber: 5,
  });

  const updated = result.threads[0];
  assert.ok(updated.scheduler.offscreenPressure > thread.scheduler.offscreenPressure);
  assert.equal(updated.scheduler.readerDebt, thread.scheduler.readerDebt);
});

test("delta that fulfills a related contract resolves the thread when payoff conditions are met", () => {
  const thread = makeThread({
    relatedContracts: [baseContract.id],
    scheduler: {
      urgency: 70,
      heat: 70,
      staleness: 10,
      payoffReadiness: 80,
      setupDebt: 10,
      readerDebt: 60,
      agencyPotential: 60,
      offscreenPressure: 20,
    },
  });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [
      makeDelta({
        id: "delta-payoff",
        causalWeight: "irreversible",
        contractImpact: [
          {
            contractId: baseContract.id,
            impact: "fulfills",
            note: "explicit payoff",
          },
        ],
      }),
    ],
    contracts: [baseContract],
    chapterNumber: 6,
  });

  const updated = result.threads[0];
  assert.equal(updated.currentStatus, "resolved");
  const change = result.report.changes.find((entry) => entry.threadId === thread.id);
  assert.ok(change);
  assert.ok(change.statusChangeReasons.length > 0);
});

test("delta that violates a related contract surfaces a conflict", () => {
  const thread = makeThread({ relatedContracts: [baseContract.id] });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [
      makeDelta({
        id: "delta-violation",
        contractImpact: [
          {
            contractId: baseContract.id,
            impact: "violates",
            note: "broke promise",
          },
        ],
      }),
    ],
    contracts: [baseContract],
    chapterNumber: 7,
  });

  assert.equal(result.report.conflicts.length, 1);
  const conflict = result.report.conflicts[0];
  assert.equal(conflict.contractId, baseContract.id);
  assert.equal(conflict.impact, "violates");
});

test("unknown contract id referenced in delta surfaces an unknown_contract conflict", () => {
  const thread = makeThread({ relatedContracts: ["contract-unknown"] });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [
      makeDelta({
        id: "delta-unknown",
        contractImpact: [
          {
            contractId: "contract-unknown",
            impact: "supports",
            note: "phantom contract",
          },
        ],
      }),
    ],
    contracts: [baseContract],
    chapterNumber: 8,
  });

  const conflict = result.report.conflicts.find(
    (item) => item.impact === "unknown_contract" && item.contractId === "contract-unknown",
  );
  assert.ok(conflict);
});

test("unmatched delta does not change any thread", () => {
  const thread = makeThread({ id: "thread-a", relatedContracts: [] });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [
      makeDelta({
        id: "delta-orphan",
        targetType: "thread",
        targetId: "thread-other",
      }),
    ],
    contracts: [baseContract],
    chapterNumber: 9,
  });

  assert.equal(result.report.threadsTouched, 0);
  assert.equal(result.report.unmatchedDeltaIds.length, 1);
  assert.equal(result.threads[0], thread);
});

test("seeded thread receiving its first delta becomes active", () => {
  const thread = makeThread({ currentStatus: "seeded" });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [makeDelta({ causalWeight: "minor" })],
    contracts: [baseContract],
    chapterNumber: 4,
  });

  assert.equal(result.threads[0].currentStatus, "active");
});

test("character-target delta matches threads sharing owner ids", () => {
  const thread = makeThread({ ownerCharacterIds: ["protagonist"] });
  const result = applyDeltasToThreads({
    threads: [thread],
    deltas: [
      makeDelta({
        id: "delta-character",
        targetType: "character",
        targetId: "protagonist",
        deltaType: "character_state",
      }),
    ],
    contracts: [baseContract],
    chapterNumber: 4,
  });

  assert.equal(result.report.threadsTouched, 1);
  assert.equal(result.report.unmatchedDeltaIds.length, 0);
});
