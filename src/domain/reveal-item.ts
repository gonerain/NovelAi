import type { BeatOutline, RevealItem } from "./types.js";

const HARD_REVEAL_KEYWORDS = [
  "机制",
  "规则",
  "X局",
  "共鸣者",
  "锚点",
  "见证",
  "命名",
  "漏洞",
  "代价",
  "档案",
];

function hashFingerprint(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function inferReveal(text: string): {
  kind: RevealItem["kind"];
  severity: RevealItem["severityIfMissed"];
} {
  const trimmed = text.trim();
  const matchesHard = HARD_REVEAL_KEYWORDS.some((keyword) => trimmed.includes(keyword));
  return {
    kind: matchesHard ? "world_fact" : "character_truth",
    severity: matchesHard ? "hard" : "soft",
  };
}

/**
 * Build deterministic RevealItem ids stable across regenerations:
 *   reveal_<beatId>_<index>_<short-hash-of-text>
 * Same beat + same revealTargets array order + same text yields the
 * same id, so downstream `dueRevealIds[]` references stay valid.
 */
export function deriveRevealItemsFromStrings(args: {
  beatId: string;
  revealTargets: string[];
  chapterRange?: { start: number; end: number };
}): RevealItem[] {
  if (args.revealTargets.length === 0) {
    return [];
  }
  const range = args.chapterRange;
  const result: RevealItem[] = [];
  for (let index = 0; index < args.revealTargets.length; index += 1) {
    const text = args.revealTargets[index]!.trim();
    if (!text) continue;
    const inferred = inferReveal(text);
    let dueChapter: number;
    if (range && range.end >= range.start) {
      // Spread reveals across the beat's chapter range, weighted to
      // the second half so the writer has setup room before each
      // reveal lands.
      const span = range.end - range.start;
      const slot = args.revealTargets.length === 1
        ? Math.max(range.start, range.end - 1)
        : range.start + Math.round(((index + 1) * span) / args.revealTargets.length);
      dueChapter = Math.max(range.start, Math.min(range.end, slot));
    } else {
      dueChapter = index + 1;
    }
    const id = `reveal_${args.beatId}_${String(index + 1).padStart(2, "0")}_${hashFingerprint(text).slice(0, 6)}`;
    result.push({
      id,
      kind: inferred.kind,
      text,
      dueChapter,
      severityIfMissed: inferred.severity,
    });
  }
  return result;
}

export function getEffectiveRevealItems(beat: BeatOutline): RevealItem[] {
  if (beat.revealItems && beat.revealItems.length > 0) {
    return beat.revealItems;
  }
  return deriveRevealItemsFromStrings({
    beatId: beat.id,
    revealTargets: beat.revealTargets,
    chapterRange: beat.chapterRangeHint,
  });
}

/**
 * Reveals whose dueChapter is exactly the current chapter. Use to
 * tell the writer "these MUST land this chapter".
 */
export function selectRevealsDueAt(args: {
  reveals: RevealItem[];
  chapterNumber: number;
}): RevealItem[] {
  return args.reveals.filter((reveal) => reveal.dueChapter === args.chapterNumber);
}

/**
 * Reveals whose dueChapter is past and that have not been recorded
 * as landed. These are missed reveals; reviewer should flag them.
 */
export function selectOverdueReveals(args: {
  reveals: RevealItem[];
  currentChapter: number;
}): RevealItem[] {
  return args.reveals.filter(
    (reveal) =>
      reveal.dueChapter < args.currentChapter && reveal.landedInChapter == null,
  );
}

export interface RevealStatusEntry {
  reveal: RevealItem;
  beatId: string;
  status: "pending" | "due_now" | "landed" | "overdue";
}

export function describeRevealStatus(args: {
  beats: BeatOutline[];
  currentChapter?: number;
}): RevealStatusEntry[] {
  const entries: RevealStatusEntry[] = [];
  for (const beat of args.beats) {
    const reveals = getEffectiveRevealItems(beat);
    for (const reveal of reveals) {
      let status: RevealStatusEntry["status"] = "pending";
      if (reveal.landedInChapter != null) {
        status = "landed";
      } else if (
        args.currentChapter != null &&
        reveal.dueChapter < args.currentChapter
      ) {
        status = "overdue";
      } else if (
        args.currentChapter != null &&
        reveal.dueChapter === args.currentChapter
      ) {
        status = "due_now";
      }
      entries.push({ reveal, beatId: beat.id, status });
    }
  }
  return entries;
}
