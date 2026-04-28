import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCommercialVariety,
  type CommercialVarietySample,
} from "./commercial-variety.js";

function sample(overrides: Partial<CommercialVarietySample>): CommercialVarietySample {
  return {
    chapterNumber: overrides.chapterNumber ?? 1,
    chapterMode: overrides.chapterMode ?? "confront",
    payoffType: overrides.payoffType ?? "emotional_impact",
    endHook: overrides.endHook ?? "默认尾钩",
  };
}

test("payoff_variety_violation when same payoff repeats too many times", () => {
  const samples = [
    sample({ chapterNumber: 1, payoffType: "emotional_impact" }),
    sample({ chapterNumber: 2, payoffType: "emotional_impact" }),
    sample({ chapterNumber: 3, payoffType: "emotional_impact" }),
    sample({ chapterNumber: 4, payoffType: "emotional_impact" }),
  ];
  const report = evaluateCommercialVariety({ samples, payoffMaxRepeat: 3 });
  assert.ok(report.findings.some((f) => f.code === "payoff_variety_violation"));
});

test("mode_variety_violation when same chapter mode repeats too many times", () => {
  const samples = Array.from({ length: 5 }, (_, i) =>
    sample({ chapterNumber: i + 1, chapterMode: "confront" }),
  );
  const report = evaluateCommercialVariety({ samples, modeMaxRepeat: 3 });
  assert.ok(report.findings.some((f) => f.code === "mode_variety_violation"));
});

test("hook_variety_violation when adjacent end hooks share most tokens", () => {
  const samples = [
    sample({
      chapterNumber: 1,
      endHook: "尾钩需要承接：母亲合同被发现；并把下一章压力落到：揭开父亲债务",
    }),
    sample({
      chapterNumber: 2,
      endHook: "尾钩需要承接：母亲合同被发现；并把下一章压力落到：揭开父亲债务",
    }),
    sample({
      chapterNumber: 3,
      endHook: "尾钩需要承接：母亲合同被发现；并把下一章压力落到：揭开父亲债务",
    }),
  ];
  const report = evaluateCommercialVariety({ samples });
  assert.ok(report.findings.some((f) => f.code === "hook_variety_violation"));
});

test("varied chapters pass cleanly", () => {
  const samples = [
    sample({
      chapterNumber: 1,
      chapterMode: "seed",
      payoffType: "information_reveal",
      endHook: "夜烬必须在三日内找到突破红字的办法",
    }),
    sample({
      chapterNumber: 2,
      chapterMode: "pressure",
      payoffType: "relationship_shift",
      endHook: "沈知夏开始调查中间人留下的录像带",
    }),
    sample({
      chapterNumber: 3,
      chapterMode: "investigate",
      payoffType: "strategic_reversal",
      endHook: "顾临川在档案室拿到一封以匿名笔迹写成的提示信",
    }),
    sample({
      chapterNumber: 4,
      chapterMode: "confront",
      payoffType: "villain_setback",
      endHook: "白纸会要求夜烬交出执笔人身份",
    }),
  ];
  const report = evaluateCommercialVariety({ samples });
  assert.equal(report.passed, true);
  assert.equal(
    report.findings.filter((f) => f.severity === "error").length,
    0,
    "no error severity findings",
  );
});

test("hook overlap below threshold does not trigger", () => {
  const samples = [
    sample({ chapterNumber: 1, endHook: "夜烬决定不告诉沈知夏命书反噬的代价" }),
    sample({ chapterNumber: 2, endHook: "顾临川开始追查白纸会的资金路径" }),
  ];
  const report = evaluateCommercialVariety({ samples });
  assert.ok(!report.findings.some((f) => f.code === "hook_variety_violation"));
});
