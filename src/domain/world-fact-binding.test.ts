import test from "node:test";
import assert from "node:assert/strict";

import {
  bindRevealItemsToWorldFacts,
  describeFactCoverage,
  findBestWorldFactForReveal,
  getWorldFactsForBeat,
} from "./world-fact-binding.js";


import type { BeatOutline, RevealItem, WorldFact } from "./types.js";

const facts: WorldFact[] = [
  {
    id: "fact_anchor_007",
    category: "character_rule",
    title: "陆承砚是林见月当前最强锚点",
    description:
      "因婚约年限长、家族绑定深、公众见证多，陆承砚与林见月之间的旧关系是全局最难作废的一条主锚。",
    scope: "character_specific",
    visibility: "hidden",
    relatedCharacterIds: ["protagonist", "char_01"],
    relatedLocationIds: [],
  },
  {
    id: "fact_mechanism_001",
    category: "global_rule",
    title: "关系修正机制会自动修补高共识关系",
    description:
      "一旦某段关系被足够多的人承认、见证并内化为‘正确位置’，现实就会倾向于自动修补其断裂。",
    scope: "global",
    visibility: "hidden",
    relatedCharacterIds: [],
    relatedLocationIds: [],
  },
  {
    id: "fact_loophole_004",
    category: "global_rule",
    title: "真正有效的反制不是删除关系，而是主动命名新位置",
    description: "想对抗修正机制，不能只说‘我不要这个身份’，还必须在可被见证的情境下说清‘我现在是什么’。",
    scope: "global",
    visibility: "hidden",
    relatedCharacterIds: [],
    relatedLocationIds: [],
  },
];

test("findBestWorldFactForReveal picks the closest fact by trigram overlap", () => {
  const reveal: RevealItem = {
    id: "r1",
    kind: "character_truth",
    text: "陆承砚不仅是前未婚夫，也是最强的关系锚点",
    dueChapter: 4,
    severityIfMissed: "hard",
  };
  const match = findBestWorldFactForReveal(reveal, facts);
  assert.ok(match);
  assert.equal(match!.factId, "fact_anchor_007");
});

test("findBestWorldFactForReveal prefers title-anchored matches over description-only ones", () => {
  // Both fact_anchor_007 (title 陆承砚是林见月当前最强锚点) and
  // fact_mechanism_003 (description happens to also mention 关系锚点)
  // could match, but the title overlap should win.
  const competingFacts: WorldFact[] = [
    {
      id: "fact_anchor_007",
      category: "character_rule",
      title: "陆承砚是林见月当前最强锚点",
      description: "因婚约年限长、家族绑定深、公众见证多。",
      scope: "character_specific",
      visibility: "hidden",
      relatedCharacterIds: [],
      relatedLocationIds: [],
    },
    {
      id: "fact_mechanism_003",
      category: "global_rule",
      title: "越公开、越多人见证的关系，越难被单方面作废",
      description: "关系修正机制对高见证度与高公开度极度敏感。关系锚点强度会被公开仪式提升。",
      scope: "global",
      visibility: "public",
      relatedCharacterIds: [],
      relatedLocationIds: [],
    },
  ];
  const reveal: RevealItem = {
    id: "r2",
    kind: "character_truth",
    text: "陆承砚不仅是前未婚夫，也是最强的关系锚点",
    dueChapter: 4,
    severityIfMissed: "hard",
  };
  const match = findBestWorldFactForReveal(reveal, competingFacts);
  assert.ok(match);
  assert.equal(match!.factId, "fact_anchor_007");
  assert.equal(match!.matchedOn, "title");
});

test("findBestWorldFactForReveal returns null when below threshold", () => {
  const reveal: RevealItem = {
    id: "r1",
    kind: "character_truth",
    text: "她喝了一杯冰咖啡，看着窗外的阳光",
    dueChapter: 1,
    severityIfMissed: "soft",
  };
  const match = findBestWorldFactForReveal(reveal, facts);
  assert.equal(match, null);
});

test("bindRevealItemsToWorldFacts upgrades unbound character_truth reveals", () => {
  const reveals: RevealItem[] = [
    {
      id: "r1",
      kind: "character_truth",
      text: "真正可行的反制不是清空关系，而是主动命名新关系",
      dueChapter: 6,
      severityIfMissed: "hard",
    },
  ];
  const out = bindRevealItemsToWorldFacts(reveals, facts);
  assert.equal(out[0]!.refId, "fact_loophole_004");
  assert.equal(out[0]!.kind, "world_fact");
});

test("bindRevealItemsToWorldFacts leaves explicit refIds alone", () => {
  const reveals: RevealItem[] = [
    {
      id: "r1",
      kind: "world_fact",
      refId: "fact_mechanism_001",
      text: "自定义文本",
      dueChapter: 1,
      severityIfMissed: "hard",
    },
  ];
  const out = bindRevealItemsToWorldFacts(reveals, facts);
  assert.equal(out[0]!.refId, "fact_mechanism_001");
});

function makeBeat(overrides: Partial<BeatOutline> = {}): BeatOutline {
  return {
    id: "beat_a",
    arcId: "arc_a",
    order: 1,
    chapterRangeHint: { start: 1, end: 6 },
    beatGoal: "...",
    conflict: "...",
    expectedChange: "...",
    requiredCharacters: [],
    requiredMemories: [],
    revealTargets: [
      "陆承砚不仅是前未婚夫，也是最强的关系锚点",
      "关系修正机制会自动修补高共识关系",
    ],
    constraints: [],
    ...overrides,
  };
}

test("getWorldFactsForBeat unions explicit ids and reveal-bound refIds", () => {
  const beat = makeBeat({
    worldFactIds: ["fact_loophole_004"],
  });
  const list = getWorldFactsForBeat(beat, facts);
  const ids = list.map((fact) => fact.id);
  assert.ok(ids.includes("fact_loophole_004"));
  assert.ok(ids.includes("fact_anchor_007"));
  assert.ok(ids.includes("fact_mechanism_001"));
});

test("describeFactCoverage reports per-beat coverage with via-source", () => {
  const beat = makeBeat({ worldFactIds: ["fact_loophole_004"] });
  const coverage = describeFactCoverage([beat], facts);
  const anchor = coverage.find((entry) => entry.factId === "fact_anchor_007");
  const loophole = coverage.find((entry) => entry.factId === "fact_loophole_004");
  assert.ok(anchor);
  assert.ok(loophole);
  assert.equal(anchor!.beats[0]!.via, "reveal");
  assert.equal(loophole!.beats[0]!.via, "explicit");
});
