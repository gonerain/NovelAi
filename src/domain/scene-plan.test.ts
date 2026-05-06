import test from "node:test";
import assert from "node:assert/strict";

import {
  findIdenticalConsecutiveScenes,
  validateScenePlan,
  validateSceneScaffold,
  validateSceneMicroShift,
} from "./scene-plan.js";
import type { ChapterScenePlan, SceneMicroShift } from "./types.js";

function makePlan(overrides: Partial<ChapterScenePlan> = {}): ChapterScenePlan {
  return {
    chapterNumber: 1,
    beatId: "beat_a",
    arcId: "arc_a",
    pov: "protagonist",
    location: "婚礼酒店休息室",
    propsAndAnchors: ["手机短信", "退还的戒指"],
    openingScene: {
      entryHook: "她躲在休息室刷新手机，看到婚礼直播开始",
      situationOnPage: "陆承砚在大厅向宾客举杯",
    },
    midConflict: {
      trigger: "陆承砚的助理推门要求她回到现场",
      escalation: "助理威胁会让苏映的实习被取消",
    },
    climax: {
      decisionOwnerId: "protagonist",
      decisionUnderPressure: "她当众承认或者再次否认这场婚约",
      costPaid: "她的拒绝被解读成情侣闹别扭，她意识到话语被系统覆盖",
    },
    endHook: "她看见闻既白远远站在门口记下她的反应",
    dueRevealIds: ["reveal_role_001"],
    characterArcMicroShift: [
      {
        characterId: "protagonist",
        arcShiftRef: "shift_escape_02",
        oldDefault: "私下再拒绝陆承砚",
        pressureTrigger: "苏映的实习被作为筹码",
        newChoice: "在大厅当众宣布解除婚约",
        costPaid: "陆承砚开始从控制升级到使用强硬手段",
      },
    ],
    expectedDeltas: [],
    ...overrides,
  };
}

test("validateSceneScaffold accepts a fully populated plan", () => {
  assert.deepEqual(validateSceneScaffold(makePlan()), []);
});

test("validateSceneScaffold flags empty fields", () => {
  const issues = validateSceneScaffold(
    makePlan({
      openingScene: { entryHook: "", situationOnPage: "" },
    }),
  );
  assert.ok(issues.some((i) => i.field === "openingScene.entryHook"));
  assert.ok(issues.some((i) => i.field === "openingScene.situationOnPage"));
});

test("validateSceneMicroShift flags generic fields", () => {
  const shift: SceneMicroShift = {
    characterId: "protagonist",
    oldDefault: "x",
    pressureTrigger: "x",
    newChoice: "突破自己",
    costPaid: "x",
  };
  const issues = validateSceneMicroShift(shift);
  assert.ok(issues.some((i) => i.field === "newChoice"));
});

test("validateScenePlan composes scaffold + micro-shift issues", () => {
  const plan = makePlan({
    endHook: "",
    characterArcMicroShift: [
      {
        characterId: "char_05",
        oldDefault: "x",
        pressureTrigger: "她被点名",
        newChoice: "她当众站到主角身后",
        costPaid: "",
      },
    ],
  });
  const coverage = validateScenePlan(plan);
  assert.ok(coverage.scaffoldIssues.some((i) => i.field === "endHook"));
  assert.equal(coverage.microShiftIssues.length, 1);
});

test("findIdenticalConsecutiveScenes reports template-fill smell", () => {
  const a = makePlan({ chapterNumber: 1 });
  const b = makePlan({ chapterNumber: 2 });
  // Differ on >=3 of the tracked fields so c↔b is NOT flagged.
  const c = makePlan({
    chapterNumber: 3,
    pov: "char_05",
    location: "另一个地点",
    openingScene: { entryHook: "完全不同的开场", situationOnPage: "完全不同的场景" },
    climax: {
      decisionOwnerId: "char_05",
      decisionUnderPressure: "另一个角色的另一种选择",
      costPaid: "另一种代价",
    },
    endHook: "另一个钩子",
  });
  const findings = findIdenticalConsecutiveScenes([a, b, c]);
  assert.ok(findings.find((f) => f.earlierChapter === 1 && f.laterChapter === 2));
  assert.ok(!findings.find((f) => f.earlierChapter === 2 && f.laterChapter === 3));
});
