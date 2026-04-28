import test from "node:test";
import assert from "node:assert/strict";

import { buildEpisodePacketFromRuntime } from "./v1-episode.js";
import type { StoryProject, ThreadRankResult } from "./domain/index.js";

const project: StoryProject = {
  id: "project-a",
  title: "Project A",
  premise: "Premise",
  status: "active",
  authorProfile: {
    id: "author",
    name: "Author",
    summary: "summary",
    corePreferences: [],
    aestheticMotifs: [],
    favoriteCharacterTypes: [],
    favoriteRelationshipPatterns: [],
    plotBiases: [],
    endingBiases: [],
    components: [],
    constraints: [],
  },
  themeBible: {
    coreTheme: "theme",
    subThemes: [],
    motifs: [],
    taboos: [],
    endingTarget: "ending",
    emotionalDestination: "destination",
  },
  styleBible: {
    narrativeStyle: [],
    emotionalStyle: [],
    dialogueStyle: [],
    pacingStyle: [],
    imagery: [],
    preferredConflictShapes: [],
    preferredClimaxShapes: [],
    antiPatterns: [],
  },
  storySetup: {
    premise: "Premise",
    currentArcGoal: "Arc goal",
    openingSituation: "Opening",
    defaultActiveCharacterIds: ["hero"],
  },
  arcOutlines: [],
  beatOutlines: [],
  characters: [
    {
      id: "hero",
      name: "Hero",
      coreTraits: [],
      desires: ["win"],
      fears: ["loss"],
      wounds: [],
      voiceNotes: [],
      currentGoals: ["find truth"],
      emotionalState: [],
      knowledgeBoundary: [],
      secretsKept: [],
      decisionProfile: {
        coreDesire: "choose freely",
        coreFear: "being controlled",
        falseBelief: "alone is safe",
        defaultCopingStyle: "escape",
        controlPattern: "hide",
        unacceptableCosts: [],
        likelyCompromises: [],
        relationshipSoftSpots: [],
        breakThresholds: [],
      },
      relationships: [],
    },
  ],
  worldFacts: [],
  memories: [],
  chapterPlans: [],
};

function rankedThread(overrides: Partial<ThreadRankResult> = {}): ThreadRankResult {
  return {
    score: overrides.score ?? 85,
    reasons: overrides.reasons ?? ["high urgency"],
    warnings: overrides.warnings ?? ["payoff_or_half_payoff_suggested"],
    breakdown: overrides.breakdown ?? {
      urgency: 20,
      heat: 20,
      staleness: 10,
      readerDebt: 10,
      payoffReadiness: 10,
      agencyPotential: 8,
      offscreenPressure: 2,
      setupDebtPenalty: 0,
    },
    thread: overrides.thread ?? {
      id: "thread-main",
      threadType: "plot_threat",
      title: "Main",
      ownerCharacterIds: ["hero"],
      introducedChapter: 1,
      currentStatus: "active",
      readerQuestion: "Will hero act?",
      pressure: "Hero must act",
      stakes: "stakes",
      nextUsefulMoves: ["confront"],
      blockedBy: [],
      payoffConditions: ["choice"],
      payoffTypeOptions: ["strategic_reversal"],
      lastTouchedChapter: 1,
      cadenceTarget: "frequent",
      expectedSpanChapters: 30,
      minTouchInterval: 1,
      maxDormantChapters: 3,
      allowedModes: ["confront", "payoff"],
      relatedContracts: ["contract-agency"],
      scheduler: {
        urgency: 90,
        heat: 80,
        staleness: 30,
        payoffReadiness: 80,
        setupDebt: 10,
        readerDebt: 70,
        agencyPotential: 90,
        offscreenPressure: 20,
      },
    },
  };
}

test("buildEpisodePacketFromRuntime rotates payoffType when previous chapter used the same one", () => {
  const ranked = rankedThread({
    thread: {
      ...rankedThread().thread,
      payoffTypeOptions: ["strategic_reversal", "information_reveal", "status_gain"],
      allowedModes: ["payoff", "confront", "pressure"],
    },
  });

  const packet = buildEpisodePacketFromRuntime({
    project,
    chapterNumber: 5,
    contracts: [],
    rankedThreads: [ranked],
    recentConsequences: ["previous cost"],
    unresolvedDelayedConsequences: [],
    recentCommercialHistory: [],
    recentPackets: [
      {
        chapterNumber: 4,
        primaryThreadId: "thread-main",
        chapterMode: "payoff",
        payoffType: "strategic_reversal",
      },
    ],
    generatedAt: "2026-01-02T00:00:00.000Z",
  });

  assert.notEqual(packet.payoffType, "strategic_reversal");
  assert.notEqual(packet.chapterMode, "payoff");
  assert.ok(packet.endHook.length > 0);
});

test("buildEpisodePacketFromRuntime keeps natural pick when primary thread changed", () => {
  const ranked = rankedThread({
    thread: {
      ...rankedThread().thread,
      payoffTypeOptions: ["strategic_reversal"],
      allowedModes: ["payoff"],
    },
  });

  const packet = buildEpisodePacketFromRuntime({
    project,
    chapterNumber: 5,
    contracts: [],
    rankedThreads: [ranked],
    recentConsequences: [],
    unresolvedDelayedConsequences: [],
    recentCommercialHistory: [],
    recentPackets: [
      {
        chapterNumber: 4,
        primaryThreadId: "thread-other",
        chapterMode: "payoff",
        payoffType: "strategic_reversal",
      },
    ],
    generatedAt: "2026-01-02T00:00:00.000Z",
  });

  // Primary thread differs from previous chapter, so repetition is fine.
  assert.equal(packet.payoffType, "strategic_reversal");
  assert.equal(packet.chapterMode, "payoff");
});

test("buildEpisodePacketFromRuntime endHook references unresolved delayed consequence", () => {
  const ranked = rankedThread();
  const packet = buildEpisodePacketFromRuntime({
    project,
    chapterNumber: 6,
    contracts: [],
    rankedThreads: [ranked],
    recentConsequences: [],
    unresolvedDelayedConsequences: ["chapter=3 delayed alliance fallout"],
    recentCommercialHistory: [],
    generatedAt: "2026-01-02T00:00:00.000Z",
  });
  assert.ok(packet.endHook.includes("chapter=3 delayed alliance fallout"));
});

test("buildEpisodePacketFromRuntime creates an inspectable runtime packet", () => {
  const packet = buildEpisodePacketFromRuntime({
    project,
    chapterNumber: 4,
    contracts: [
      {
        id: "contract-agency",
        contractType: "character_arc",
        statement: "Hero must choose",
        readerVisible: true,
        createdAtChapter: 1,
        priority: "critical",
        evidence: [],
        forbiddenMoves: ["No passive hero"],
        payoffSignals: [],
        status: "active",
      },
    ],
    rankedThreads: [rankedThread()],
    recentConsequences: ["previous cost"],
    unresolvedDelayedConsequences: ["delayed risk"],
    recentCommercialHistory: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(packet.chapterMode, "payoff");
  assert.equal(packet.payoffType, "strategic_reversal");
  assert.equal(packet.primaryThreadId, "thread-main");
  assert.equal(packet.agencyOwnerId, "hero");
  assert.ok(packet.nonTransferableChoice.includes("Hero"));
  assert.ok(packet.tolerableOptions.length >= 2);
  assert.ok(packet.choiceCost.includes("being controlled"));
  assert.ok(packet.protagonistConsequence.includes("Hero"));
  assert.equal(packet.activeThreadsUsed[0]?.role, "primary");
  assert.equal(packet.stateDeltasExpected[0]?.targetType, "thread");
  assert.ok(packet.doNotResolve.includes("No passive hero"));
});
