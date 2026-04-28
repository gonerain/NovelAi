import test from "node:test";
import assert from "node:assert/strict";

import { applyDueOffscreenMoves, evaluateOffscreenMoves } from "./offscreen-moves.js";
import type { NarrativeThread, OffscreenMove } from "./types.js";

function makeThread(overrides: Partial<NarrativeThread> = {}): NarrativeThread {
  return {
    id: overrides.id ?? "thread-a",
    threadType: overrides.threadType ?? "plot_threat",
    title: overrides.title ?? "Thread A",
    ownerCharacterIds: overrides.ownerCharacterIds ?? ["protagonist"],
    introducedChapter: overrides.introducedChapter ?? 1,
    currentStatus: overrides.currentStatus ?? "active",
    readerQuestion: overrides.readerQuestion ?? "What is moving offscreen?",
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
      urgency: 30,
      heat: 30,
      staleness: 0,
      payoffReadiness: 20,
      setupDebt: 30,
      readerDebt: 40,
      agencyPotential: 50,
      offscreenPressure: 10,
    },
  };
}

function makeMove(overrides: Partial<OffscreenMove> = {}): OffscreenMove {
  return {
    id: overrides.id ?? "move-1",
    actorId: overrides.actorId ?? "antagonist-a",
    actorName: overrides.actorName ?? "Shadow Lord",
    actorType: overrides.actorType ?? "antagonist",
    targetThreadId: overrides.targetThreadId ?? "thread-a",
    moveType: overrides.moveType ?? "advance_plan",
    description: overrides.description ?? "advances the secret plan",
    scheduledChapter: overrides.scheduledChapter ?? 3,
    visibility: overrides.visibility ?? "hidden",
    expectedRevealWindow: overrides.expectedRevealWindow ?? 4,
    pressureAdded: overrides.pressureAdded ?? 30,
    counterplayOpportunity:
      overrides.counterplayOpportunity ?? "protagonist can intercept by investigating the rumor",
    status: overrides.status ?? "pending",
    appliedAtChapter: overrides.appliedAtChapter,
    revealedAtChapter: overrides.revealedAtChapter,
  };
}

test("due move bumps offscreenPressure on the target thread", () => {
  const thread = makeThread();
  const move = makeMove();
  const result = applyDueOffscreenMoves({
    threads: [thread],
    moves: [move],
    chapterNumber: 4,
  });

  const updatedThread = result.threads[0];
  assert.ok(updatedThread.scheduler.offscreenPressure > thread.scheduler.offscreenPressure);
  assert.equal(result.report.appliedCount, 1);
  assert.equal(result.moves[0].status, "applied");
  assert.equal(result.moves[0].appliedAtChapter, 4);
});

test("future move is not applied yet", () => {
  const thread = makeThread();
  const move = makeMove({ scheduledChapter: 10 });
  const result = applyDueOffscreenMoves({
    threads: [thread],
    moves: [move],
    chapterNumber: 4,
  });

  assert.equal(result.report.appliedCount, 0);
  assert.equal(result.moves[0].status, "pending");
  assert.equal(result.threads[0].scheduler.offscreenPressure, thread.scheduler.offscreenPressure);
});

test("hidden move past expected reveal window flags overdue reveal", () => {
  const thread = makeThread();
  const move = makeMove({
    visibility: "hidden",
    scheduledChapter: 1,
    expectedRevealWindow: 3,
    status: "applied",
    appliedAtChapter: 1,
  });

  const report = evaluateOffscreenMoves({
    chapterNumber: 6,
    moves: [move],
    threads: [thread],
  });

  assert.equal(report.passed, false);
  assert.ok(report.findings.some((f) => f.code === "hidden_reveal_window_overdue"));
});

test("missing counterplay surfaces a warning", () => {
  const thread = makeThread();
  const move = makeMove({ counterplayOpportunity: "" });
  const report = evaluateOffscreenMoves({
    chapterNumber: 4,
    moves: [move],
    threads: [thread],
  });
  assert.ok(report.findings.some((f) => f.code === "missing_counterplay"));
});

test("eval flags antagonist as only reactive when nothing applied", () => {
  const thread = makeThread();
  const move = makeMove({ scheduledChapter: 5, status: "pending" });
  const report = evaluateOffscreenMoves({
    chapterNumber: 2,
    moves: [move],
    threads: [thread],
  });

  assert.ok(
    report.findings.some((f) => f.code === "antagonist_only_reactive"),
    "expected antagonist_only_reactive finding",
  );
});

test("move targeting unknown thread is skipped and flagged", () => {
  const thread = makeThread({ id: "thread-a" });
  const move = makeMove({ targetThreadId: "thread-missing", scheduledChapter: 1 });
  const result = applyDueOffscreenMoves({
    threads: [thread],
    moves: [move],
    chapterNumber: 1,
  });

  assert.equal(result.report.skippedCount, 1);
  assert.equal(result.moves[0].status, "skipped");
  const evalReport = evaluateOffscreenMoves({
    chapterNumber: 1,
    moves: result.moves,
    threads: [thread],
  });
  assert.ok(evalReport.findings.some((f) => f.code === "missing_target_thread"));
});

test("create_deadline and revealed visibility add extra urgency/heat", () => {
  const thread = makeThread();
  const move = makeMove({
    moveType: "create_deadline",
    visibility: "revealed",
    pressureAdded: 40,
  });
  const result = applyDueOffscreenMoves({
    threads: [thread],
    moves: [move],
    chapterNumber: 3,
  });
  const updatedThread = result.threads[0];
  assert.ok(updatedThread.scheduler.urgency > thread.scheduler.urgency + 10);
  assert.ok(updatedThread.scheduler.heat > thread.scheduler.heat);
});
