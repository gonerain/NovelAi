import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveRevealItemsFromStrings,
  describeRevealStatus,
  getEffectiveRevealItems,
  selectOverdueReveals,
  selectRevealsDueAt,
} from "./reveal-item.js";
import type { BeatOutline } from "./types.js";

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
      "世界会自动把'离开'解释成'暂时缺席'",
      "陆承砚是最强的关系锚点",
      "她从小被培养成合格未婚妻",
    ],
    constraints: [],
    ...overrides,
  };
}

test("deriveRevealItemsFromStrings spreads reveals across chapter range", () => {
  const items = deriveRevealItemsFromStrings({
    beatId: "beat_a",
    revealTargets: ["A", "B", "C"],
    chapterRange: { start: 1, end: 6 },
  });
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.dueChapter >= 1 && item.dueChapter <= 6));
  // Ensure they are not all bunched on the same chapter
  const chapters = new Set(items.map((item) => item.dueChapter));
  assert.ok(chapters.size >= 2);
});

test("deriveRevealItemsFromStrings produces stable ids", () => {
  const a = deriveRevealItemsFromStrings({
    beatId: "beat_a",
    revealTargets: ["关系修正机制会自动修复婚约"],
    chapterRange: { start: 1, end: 6 },
  });
  const b = deriveRevealItemsFromStrings({
    beatId: "beat_a",
    revealTargets: ["关系修正机制会自动修复婚约"],
    chapterRange: { start: 1, end: 6 },
  });
  assert.equal(a[0]!.id, b[0]!.id);
});

test("hard severity inferred from world-rule keywords", () => {
  const items = deriveRevealItemsFromStrings({
    beatId: "beat_a",
    revealTargets: [
      "她喝了一杯咖啡（柔软琐事）",
      "关系修正机制会自动复位婚约（硬世界规则）",
    ],
  });
  const soft = items.find((item) => item.severityIfMissed === "soft");
  const hard = items.find((item) => item.severityIfMissed === "hard");
  assert.ok(soft, "expected at least one soft reveal");
  assert.ok(hard, "expected at least one hard reveal");
  assert.equal(hard!.kind, "world_fact");
});

test("getEffectiveRevealItems falls back to revealTargets when revealItems missing", () => {
  const beat = makeBeat();
  const items = getEffectiveRevealItems(beat);
  assert.equal(items.length, 3);
});

test("getEffectiveRevealItems prefers populated revealItems", () => {
  const beat = makeBeat({
    revealItems: [
      {
        id: "reveal_custom_01",
        kind: "world_fact",
        text: "explicit reveal",
        dueChapter: 3,
        severityIfMissed: "hard",
      },
    ],
  });
  const items = getEffectiveRevealItems(beat);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.id, "reveal_custom_01");
});

test("selectRevealsDueAt picks chapters with exact match", () => {
  const items = deriveRevealItemsFromStrings({
    beatId: "beat_a",
    revealTargets: ["A", "B"],
    chapterRange: { start: 1, end: 4 },
  });
  const dueAt = items[0]!.dueChapter;
  const due = selectRevealsDueAt({ reveals: items, chapterNumber: dueAt });
  assert.ok(due.length >= 1);
});

test("selectOverdueReveals picks unlanded past-due reveals", () => {
  const items = deriveRevealItemsFromStrings({
    beatId: "beat_a",
    revealTargets: ["A"],
    chapterRange: { start: 1, end: 2 },
  });
  const overdue = selectOverdueReveals({ reveals: items, currentChapter: 99 });
  assert.equal(overdue.length, 1);
});

test("describeRevealStatus computes pending / due_now / overdue / landed", () => {
  const beat = makeBeat({
    chapterRangeHint: { start: 1, end: 4 },
    revealItems: [
      {
        id: "r1",
        kind: "world_fact",
        text: "X",
        dueChapter: 2,
        severityIfMissed: "hard",
      },
      {
        id: "r2",
        kind: "world_fact",
        text: "Y",
        dueChapter: 5,
        severityIfMissed: "soft",
      },
      {
        id: "r3",
        kind: "world_fact",
        text: "Z",
        dueChapter: 1,
        severityIfMissed: "hard",
        landedInChapter: 1,
      },
    ],
  });
  const status = describeRevealStatus({ beats: [beat], currentChapter: 3 });
  const map = new Map(status.map((s) => [s.reveal.id, s.status]));
  assert.equal(map.get("r1"), "overdue");
  assert.equal(map.get("r2"), "pending");
  assert.equal(map.get("r3"), "landed");
});
