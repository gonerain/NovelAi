import type { ChapterMode, EpisodePayoffType } from "./types.js";

export interface CommercialVarietySample {
  chapterNumber: number;
  chapterMode: ChapterMode;
  payoffType: EpisodePayoffType;
  endHook: string;
}

export type CommercialVarietyCode =
  | "payoff_variety_violation"
  | "mode_variety_violation"
  | "hook_variety_violation";

export interface CommercialVarietyFinding {
  code: CommercialVarietyCode;
  severity: "info" | "warning" | "error";
  windowStart: number;
  windowEnd: number;
  detail: string;
}

export interface CommercialVarietyReport {
  windowSize: number;
  windowStart: number;
  windowEnd: number;
  payoffCounts: Partial<Record<EpisodePayoffType, number>>;
  modeCounts: Partial<Record<ChapterMode, number>>;
  passed: boolean;
  findings: CommercialVarietyFinding[];
}

const STOPWORDS = new Set([
  "尾钩",
  "压力",
  "落到",
  "下一章",
  "必须",
  "本章",
  "and",
  "the",
  "to",
  "of",
  "must",
  "next",
  "chapter",
  "压到",
  "把",
  "到",
  "在",
  "于",
]);

function tokenizeHook(text: string): string[] {
  if (!text) {
    return [];
  }
  // Strip punctuation, then split: keep CJK runs as individual chars + Latin words.
  const cleaned = text.replace(/[\s\p{P}\p{S}]+/gu, " ");
  const segments: string[] = [];
  for (const part of cleaned.split(" ")) {
    if (!part) {
      continue;
    }
    if (/^[一-鿿]+$/.test(part)) {
      // CJK run: bigrams pick up structure better than single chars.
      if (part.length === 1) {
        segments.push(part);
      } else {
        for (let i = 0; i < part.length - 1; i += 1) {
          segments.push(part.slice(i, i + 2));
        }
      }
    } else {
      segments.push(part.toLowerCase());
    }
  }
  return segments.filter((token) => !STOPWORDS.has(token) && token.length >= 2);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const COMMERCIAL_VARIETY_HOOK_OVERLAP_THRESHOLD = 0.6;

export function evaluateCommercialVariety(args: {
  samples: CommercialVarietySample[];
  windowSize?: number;
  payoffMaxRepeat?: number;
  modeMaxRepeat?: number;
  hookOverlapThreshold?: number;
}): CommercialVarietyReport {
  const window = Math.max(1, args.windowSize ?? 5);
  const payoffMax = Math.max(1, args.payoffMaxRepeat ?? 3);
  const modeMax = Math.max(1, args.modeMaxRepeat ?? 3);
  const hookThreshold = args.hookOverlapThreshold ?? COMMERCIAL_VARIETY_HOOK_OVERLAP_THRESHOLD;

  const sorted = [...args.samples].sort((left, right) => left.chapterNumber - right.chapterNumber);
  const recent = sorted.slice(-window);
  const findings: CommercialVarietyFinding[] = [];
  if (recent.length === 0) {
    return {
      windowSize: window,
      windowStart: 0,
      windowEnd: 0,
      payoffCounts: {},
      modeCounts: {},
      passed: true,
      findings,
    };
  }

  const windowStart = recent[0]!.chapterNumber;
  const windowEnd = recent[recent.length - 1]!.chapterNumber;

  const payoffCounts: Partial<Record<EpisodePayoffType, number>> = {};
  const modeCounts: Partial<Record<ChapterMode, number>> = {};
  for (const sample of recent) {
    payoffCounts[sample.payoffType] = (payoffCounts[sample.payoffType] ?? 0) + 1;
    modeCounts[sample.chapterMode] = (modeCounts[sample.chapterMode] ?? 0) + 1;
  }

  for (const [payoff, count] of Object.entries(payoffCounts) as Array<[EpisodePayoffType, number]>) {
    if (count > payoffMax) {
      findings.push({
        code: "payoff_variety_violation",
        severity: "warning",
        windowStart,
        windowEnd,
        detail: `payoffType ${payoff} repeated ${count} times in chapters ${windowStart}-${windowEnd} (limit ${payoffMax}).`,
      });
    }
  }
  for (const [mode, count] of Object.entries(modeCounts) as Array<[ChapterMode, number]>) {
    if (count > modeMax) {
      findings.push({
        code: "mode_variety_violation",
        severity: "warning",
        windowStart,
        windowEnd,
        detail: `chapterMode ${mode} repeated ${count} times in chapters ${windowStart}-${windowEnd} (limit ${modeMax}).`,
      });
    }
  }
  for (let i = 1; i < recent.length; i += 1) {
    const previous = recent[i - 1]!;
    const current = recent[i]!;
    const overlap = jaccard(new Set(tokenizeHook(previous.endHook)), new Set(tokenizeHook(current.endHook)));
    if (overlap >= hookThreshold) {
      findings.push({
        code: "hook_variety_violation",
        severity: overlap >= 0.85 ? "error" : "warning",
        windowStart: previous.chapterNumber,
        windowEnd: current.chapterNumber,
        detail: `endHook overlap=${overlap.toFixed(2)} between chapter ${previous.chapterNumber} and ${current.chapterNumber} exceeds ${hookThreshold.toFixed(2)}.`,
      });
    }
  }

  return {
    windowSize: window,
    windowStart,
    windowEnd,
    payoffCounts,
    modeCounts,
    passed: findings.every((finding) => finding.severity !== "error"),
    findings,
  };
}
