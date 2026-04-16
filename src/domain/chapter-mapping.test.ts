import test from "node:test";
import assert from "node:assert/strict";

import {
  pickArcForChapterDeterministic,
  pickBeatForChapterDeterministic,
} from "./chapter-mapping.js";
import type { ArcOutline, BeatOutline } from "./types.js";

const arcA: ArcOutline = {
  id: "arc-a",
  name: "A",
  arcGoal: "goal-a",
  startState: "start-a",
  endState: "end-a",
  requiredTurns: [],
  relationshipChanges: [],
  memoryRequirements: [],
  beatIds: [],
  chapterRangeHint: { start: 1, end: 10 },
};

const arcB: ArcOutline = {
  id: "arc-b",
  name: "B",
  arcGoal: "goal-b",
  startState: "start-b",
  endState: "end-b",
  requiredTurns: [],
  relationshipChanges: [],
  memoryRequirements: [],
  beatIds: [],
  chapterRangeHint: { start: 11, end: 20 },
};

test("pickArcForChapterDeterministic matches chapter range directly", () => {
  assert.equal(pickArcForChapterDeterministic([arcB, arcA], 5)?.id, "arc-a");
  assert.equal(pickArcForChapterDeterministic([arcB, arcA], 15)?.id, "arc-b");
});

test("pickArcForChapterDeterministic picks nearest ranged arc when out of range", () => {
  assert.equal(pickArcForChapterDeterministic([arcA, arcB], 25)?.id, "arc-b");
});

test("pickArcForChapterDeterministic falls back deterministically without ranges", () => {
  const arcNo1: ArcOutline = {
    id: "arc-2",
    name: "N2",
    arcGoal: "g2",
    startState: "s2",
    endState: "e2",
    requiredTurns: [],
    relationshipChanges: [],
    memoryRequirements: [],
    beatIds: [],
  };
  const arcNo2: ArcOutline = {
    id: "arc-1",
    name: "N1",
    arcGoal: "g1",
    startState: "s1",
    endState: "e1",
    requiredTurns: [],
    relationshipChanges: [],
    memoryRequirements: [],
    beatIds: [],
  };
  assert.equal(pickArcForChapterDeterministic([arcNo1, arcNo2], 1)?.id, "arc-1");
  assert.equal(pickArcForChapterDeterministic([arcNo1, arcNo2], 2)?.id, "arc-2");
  assert.equal(pickArcForChapterDeterministic([arcNo1, arcNo2], 5)?.id, "arc-2");
});

test("pickBeatForChapterDeterministic respects beat ranges", () => {
  const beats: BeatOutline[] = [
    {
      id: "beat-2",
      arcId: "arc-a",
      order: 2,
      chapterRangeHint: { start: 6, end: 10 },
      beatGoal: "g2",
      conflict: "c2",
      expectedChange: "e2",
      requiredCharacters: [],
      requiredMemories: [],
      revealTargets: [],
      constraints: [],
    },
    {
      id: "beat-1",
      arcId: "arc-a",
      order: 1,
      chapterRangeHint: { start: 1, end: 5 },
      beatGoal: "g1",
      conflict: "c1",
      expectedChange: "e1",
      requiredCharacters: [],
      requiredMemories: [],
      revealTargets: [],
      constraints: [],
    },
  ];

  assert.equal(pickBeatForChapterDeterministic(beats, arcA, 3)?.id, "beat-1");
  assert.equal(pickBeatForChapterDeterministic(beats, arcA, 9)?.id, "beat-2");
  assert.equal(pickBeatForChapterDeterministic(beats, arcA, 50)?.id, "beat-2");
});
