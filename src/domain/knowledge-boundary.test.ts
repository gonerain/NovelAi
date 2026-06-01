import test from "node:test";
import assert from "node:assert/strict";
import { getLabelVocabulary } from "./knowledge-boundary.js";
import type { WorldFact } from "./types.js";

function fact(labelVocabulary: string[]): WorldFact {
  return {
    id: "fact_test",
    category: "rule",
    title: "第一条规则：父亲第一求救资格",
    description: "测试事实",
    scope: "global",
    visibility: "hidden",
    relatedCharacterIds: [],
    relatedLocationIds: [],
    labelVocabulary,
  };
}

test("knowledge boundary ignores entities, props, and generic clue words in explicit vocab", () => {
  const vocab = getLabelVocabulary(
    fact(["父亲第一求救资格", "定位", "秦小满", "粉色书包", "人生规则"]),
  );

  assert.deepEqual(vocab, ["父亲第一求救资格", "人生规则"]);
});
