import test from "node:test";
import assert from "node:assert/strict";

import { evaluateEpisodeAgency } from "./agency-eval.js";
import type { CharacterState, EpisodePacket } from "./types.js";

const hero: CharacterState = {
  id: "hero",
  name: "林见月",
  coreTraits: [],
  desires: [],
  fears: [],
  wounds: [],
  voiceNotes: [],
  currentGoals: [],
  emotionalState: [],
  knowledgeBoundary: [],
  secretsKept: [],
  relationships: [],
};

function makePacket(overrides: Partial<EpisodePacket> = {}): EpisodePacket {
  return {
    id: "episode-001",
    projectId: "project-a",
    chapterNumber: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    chapterMode: "confront",
    payoffType: "emotional_impact",
    primaryThreadId: "thread-a",
    activeThreadsUsed: [
      {
        threadId: "thread-a",
        role: "primary",
        score: 80,
        reasons: [],
        warnings: [],
      },
    ],
    primaryChoiceOwner: "hero",
    agencyOwnerId: "hero",
    nonTransferableChoice: "林见月必须亲自决定是否公开真实动机。",
    tolerableOptions: ["公开一部分事实", "暂时承担误解继续调查"],
    choiceCost: "公开会让她再次被关系修正机制锁定。",
    protagonistConsequence: "林见月的选择导致婚约规则暴露出新的可见裂缝。",
    readerPayoff: "读者看到规则被撬动。",
    endHook: "下一章规则反扑。",
    stateDeltasExpected: [
      {
        targetType: "character",
        targetId: "hero",
        description: "林见月的选择留下可追踪后果。",
        causalWeight: "major",
        visibility: "reader_visible",
      },
    ],
    doNotResolve: [],
    contractIds: [],
    schedulerWarnings: [],
    recentConsequences: [],
    unresolvedDelayedConsequences: [],
    recentCommercialHistory: [],
    ...overrides,
  };
}

test("costly protagonist choice passes agency eval", () => {
  const report = evaluateEpisodeAgency({
    packet: makePacket(),
    agencyOwner: hero,
  });

  assert.equal(report.passed, true);
  assert.equal(report.agencyScore, 100);
});

test("passive observation fails agency eval", () => {
  const report = evaluateEpisodeAgency({
    packet: makePacket({
      nonTransferableChoice: "林见月只是观察别人如何解决婚约问题。",
      protagonistConsequence: "林见月被告知规则已经发生变化。",
    }),
    agencyOwner: hero,
  });

  assert.equal(report.passed, false);
  assert.ok(report.failureReasons.includes("Packet contains passive observation/receiving-info language."));
});

test("quoted arc-goal pressure with passive verb does not trigger passive false positive", () => {
  // The episode packet quotes the primary thread's pressure inside 「…」 brackets.
  // If the arc goal happens to mention "旁观" while *describing* the protagonist's
  // transition AWAY from passivity, that text must not flip the passive check.
  const report = evaluateEpisodeAgency({
    packet: makePacket({
      nonTransferableChoice:
        "林见月必须亲自回应「推动林见月从旁观预知者变成第一次改判命运的执笔人」。 代价必须触及：每一次救援变成所有权与道德腐败。",
      protagonistConsequence: "林见月的选择必须导致「林见月会为了目标付出什么代价？」出现新的可见局面。",
    }),
    agencyOwner: hero,
  });

  assert.equal(
    report.checks.find((check) => check.id === "not_passive_observer")?.passed,
    true,
    "passive check should ignore content inside 「…」 quotes",
  );
});

test("recent-consequence carryover does not trigger passive false positive", () => {
  // Reproduces the chapter-4 false positive: the prior chapter summary embedded inside
  // nonTransferableChoice contains backstory verbs (e.g. "得知") that previously
  // tripped the passive check even though the current decision is active.
  const report = evaluateEpisodeAgency({
    packet: makePacket({
      nonTransferableChoice:
        "林见月必须亲自决定是否公开真实动机。 选择要服务于其当前欲望：救人不沦为掌控者。 不能绕开上一轮后果：林见月与盟友进入金库下层并发现伪装合同；林见月得知父亲十八年前用自己换母亲命。 代价必须触及：每次救援都会变成所有权与道德腐败。",
      protagonistConsequence: "林见月的选择导致婚约规则暴露出新的可见裂缝。",
    }),
    agencyOwner: hero,
  });

  assert.equal(report.passed, true);
  assert.equal(
    report.checks.find((check) => check.id === "not_passive_observer")?.passed,
    true,
  );
});

test("transferable single path fails agency eval with low_agency", () => {
  const report = evaluateEpisodeAgency({
    packet: makePacket({
      nonTransferableChoice: "有人需要决定是否公开真实动机。",
      tolerableOptions: ["公开一部分事实"],
      choiceCost: "",
      protagonistConsequence: "规则发生变化。",
      stateDeltasExpected: [],
    }),
    agencyOwner: hero,
  });

  assert.equal(report.passed, false);
  assert.ok(report.agencyScore < 60);
  assert.equal(report.failureReasons[0], "low_agency");
});

