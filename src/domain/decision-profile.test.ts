import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyDecisionProfile,
  findDecisionProfileGap,
  isDecisionProfileEmpty,
  validateCharacterDecisionProfileCoverage,
} from "./decision-profile.js";
import type { CharacterState } from "./types.js";

function makeCharacter(overrides: Partial<CharacterState> = {}): CharacterState {
  return {
    id: "char_x",
    name: "测试人物",
    coreTraits: [],
    desires: [],
    fears: [],
    wounds: [],
    voiceNotes: [],
    currentGoals: [],
    emotionalState: [],
    knowledgeBoundary: [],
    secretsKept: [],
    decisionProfile: emptyDecisionProfile(),
    relationships: [],
    ...overrides,
  };
}

test("emptyDecisionProfile is detected as empty", () => {
  assert.equal(isDecisionProfileEmpty(emptyDecisionProfile()), true);
});

test("populated decisionProfile is not empty", () => {
  const populated = makeCharacter({
    decisionProfile: {
      coreDesire: "保护母亲",
      coreFear: "失去母亲",
      falseBelief: "只要再撑一阵，世界会自己解决",
      defaultCopingStyle: "压抑后默默承担",
      controlPattern: "信息筛选",
      unacceptableCosts: ["伤害无关市民", "牵连晴心"],
      likelyCompromises: ["短期欺骗诺兰", "对X局让步"],
      relationshipSoftSpots: ["晴心", "母亲"],
      breakThresholds: ["有人当众揭露真相", "母亲突然恶化"],
    },
  });
  assert.equal(isDecisionProfileEmpty(populated.decisionProfile), false);
  assert.equal(findDecisionProfileGap(populated), null);
});

test("findDecisionProfileGap reports missing string fields", () => {
  const partial = makeCharacter({
    decisionProfile: {
      ...emptyDecisionProfile(),
      coreDesire: "目标 A",
    },
  });
  const gap = findDecisionProfileGap(partial);
  assert.ok(gap, "expected a gap");
  assert.deepEqual(gap.missingFields.includes("coreDesire"), false);
  assert.deepEqual(gap.missingFields.includes("coreFear"), true);
  assert.deepEqual(gap.missingFields.includes("unacceptableCosts"), true);
});

test("findDecisionProfileGap rejects whitespace-only string fields", () => {
  const profile = emptyDecisionProfile();
  profile.coreDesire = "   ";
  profile.unacceptableCosts = ["", "   "];
  const partial = makeCharacter({ decisionProfile: profile });
  const gap = findDecisionProfileGap(partial);
  assert.ok(gap);
  assert.deepEqual(gap.missingFields.includes("coreDesire"), true);
  assert.deepEqual(gap.missingFields.includes("unacceptableCosts"), true);
});

test("validateCharacterDecisionProfileCoverage returns one entry per gapped character", () => {
  const populated = makeCharacter({
    id: "char_a",
    decisionProfile: {
      coreDesire: "目标",
      coreFear: "失败",
      falseBelief: "误信",
      defaultCopingStyle: "压抑",
      controlPattern: "信息",
      unacceptableCosts: ["a", "b"],
      likelyCompromises: ["c"],
      relationshipSoftSpots: ["d"],
      breakThresholds: ["e"],
    },
  });
  const empty = makeCharacter({ id: "char_b" });
  const result = validateCharacterDecisionProfileCoverage([populated, empty]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.characterId, "char_b");
});
