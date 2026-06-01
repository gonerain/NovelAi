import type {
  ArcOutline,
  BeatOutline,
  RevealItem,
  RevealMode,
  WorldFact,
} from "./types.js";
import { getEffectiveRevealItems } from "./reveal-item.js";

/**
 * Default label-vocabulary extracted from a fact title when none is
 * configured. Heuristic: keep length-2/3/4 Chinese substrings that
 * look like coined nouns. This catches "修正机制", "关系锚点",
 * "失配者" etc. False positives are filtered by a stop list of
 * generic punctuation-like or filler bigrams.
 */
const STOP_BIGRAMS = new Set<string>([
  "的", "是", "和", "与", "对", "为", "把", "让", "被", "都", "或",
  "也", "她", "他", "你", "我", "它", "这", "那", "了", "在", "中",
  "以", "及", "更", "再", "又", "来", "去", "上", "下", "里", "外",
  "成", "做", "看", "说", "想", "会", "能", "可", "要", "得", "着",
]);

const PUNCTUATION = /[\s，。！？、；：,.!?;:'"'"“”\(\)（）]/u;

const GENERIC_BOUNDARY_VOCABULARY_STOP = new Set<string>([
  "代价",
  "定位",
  "线索",
  "电话",
  "短信",
  "消息",
  "地址",
  "书包",
  "粉色书包",
  "手机",
  "合同",
  "票据",
  "账本",
  "打印机",
]);

const CONCEPT_LABEL_MARKERS = [
  "机制",
  "规则",
  "资格",
  "权限",
  "锚点",
  "修正",
  "失配",
  "典当",
  "契约",
  "债务",
  "回归",
  "掌柜",
  "异常",
  "开门费",
];

function isCjk(ch: string): boolean {
  if (!ch) return false;
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x4e00 && code <= 0x9fff;
}

function isBoundaryVocabularyCandidate(word: string): boolean {
  const trimmed = word.trim();
  if (!trimmed) return false;
  if (GENERIC_BOUNDARY_VOCABULARY_STOP.has(trimmed)) return false;
  return CONCEPT_LABEL_MARKERS.some((marker) => trimmed.includes(marker));
}

function extractCjkRuns(text: string): string[] {
  const runs: string[] = [];
  let buffer = "";
  for (const ch of text) {
    if (isCjk(ch)) {
      buffer += ch;
    } else {
      if (buffer.length > 0) runs.push(buffer);
      buffer = "";
    }
  }
  if (buffer.length > 0) runs.push(buffer);
  return runs;
}

export function extractLabelVocabularyFromTitle(title: string, max = 6): string[] {
  const runs = extractCjkRuns(title);
  const candidates = new Set<string>();
  for (const run of runs) {
    for (let length = 4; length >= 2; length -= 1) {
      for (let i = 0; i + length <= run.length; i += 1) {
        const phrase = run.slice(i, i + length);
        if (phrase.length === 1 && STOP_BIGRAMS.has(phrase)) continue;
        if (PUNCTUATION.test(phrase)) continue;
        candidates.add(phrase);
      }
    }
  }
  // Rank candidates: longer first; within same length, prefer those
  // that contain at least one "noun-flavoured" character. Heuristic
  // is loose; the writer prompt will treat the list as advisory.
  const ranked = [...candidates].sort((a, b) => b.length - a.length);
  return ranked.filter(isBoundaryVocabularyCandidate).slice(0, max);
}

export function getLabelVocabulary(fact: WorldFact): string[] {
  if (fact.labelVocabulary && fact.labelVocabulary.length > 0) {
    return fact.labelVocabulary.filter(isBoundaryVocabularyCandidate);
  }
  return extractLabelVocabularyFromTitle(fact.title);
}

/**
 * Heuristic: arcs early in `majorArcIds` are in `anomaly` stage;
 * once we're past 1/3 of the arc list it becomes `suspected`; past
 * 2/3 it's `named`. Used as a default when revealMode is unset on
 * a RevealItem.
 */
export function defaultRevealModeForArc(
  arcId: string | undefined,
  arcs: ArcOutline[],
): RevealMode {
  if (!arcId) return "experienced_as_anomaly";
  const index = arcs.findIndex((arc) => arc.id === arcId);
  if (index < 0 || arcs.length === 0) return "experienced_as_anomaly";
  const fraction = index / arcs.length;
  if (fraction < 1 / 3) return "experienced_as_anomaly";
  if (fraction < 2 / 3) return "suspected_as_pattern";
  return "named_explicitly";
}

export function effectiveRevealMode(
  reveal: RevealItem,
  beat: BeatOutline | undefined,
  arcs: ArcOutline[],
): RevealMode {
  if (reveal.revealMode) return reveal.revealMode;
  return defaultRevealModeForArc(beat?.arcId, arcs);
}

export interface KnowledgeBoundaryFinding {
  factId: string;
  factTitle: string;
  vocabulary: string;
  occurrences: number;
  revealMode: RevealMode;
  /** First 80 chars of context around the first occurrence. */
  excerpt: string;
}

/**
 * Scan a draft for any labelVocabulary words from facts whose
 * effective reveal mode is `experienced_as_anomaly` or
 * `suspected_as_pattern`. Words found in any such mode are flagged
 * — when `suspected_as_pattern`, the rule is slightly looser (the
 * character may have a private name) but the canonical label is
 * still forbidden.
 */
export function findKnowledgeBoundaryBreaches(args: {
  draft: string;
  beat: BeatOutline | undefined;
  arcs: ArcOutline[];
  worldFacts: WorldFact[];
}): KnowledgeBoundaryFinding[] {
  if (!args.beat) return [];
  const reveals = getEffectiveRevealItems(args.beat);
  const factById = new Map(args.worldFacts.map((fact) => [fact.id, fact]));
  const findings: KnowledgeBoundaryFinding[] = [];
  const seenVocab = new Set<string>();

  for (const reveal of reveals) {
    if (reveal.kind !== "world_fact" || !reveal.refId) continue;
    const fact = factById.get(reveal.refId);
    if (!fact) continue;
    const mode = effectiveRevealMode(reveal, args.beat, args.arcs);
    if (mode === "named_explicitly") continue;
    const vocab = getLabelVocabulary(fact);
    for (const word of vocab) {
      if (seenVocab.has(`${fact.id}::${word}`)) continue;
      const matches = countOccurrences(args.draft, word);
      if (matches === 0) continue;
      seenVocab.add(`${fact.id}::${word}`);
      findings.push({
        factId: fact.id,
        factTitle: fact.title,
        vocabulary: word,
        occurrences: matches,
        revealMode: mode,
        excerpt: makeExcerpt(args.draft, word),
      });
    }
  }
  return findings;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

function makeExcerpt(draft: string, needle: string): string {
  const idx = draft.indexOf(needle);
  if (idx < 0) return "";
  const start = Math.max(0, idx - 30);
  const end = Math.min(draft.length, idx + needle.length + 30);
  return draft.slice(start, end);
}

export interface KnowledgeBoundaryContext {
  factsByMode: Record<RevealMode, Array<{ factId: string; vocab: string[] }>>;
}

/**
 * Render the per-fact knowledge-boundary view for a given chapter:
 * which facts are in which reveal mode, and what vocabulary is
 * forbidden / allowed. Consumed by writer + scene-decomposer
 * prompts.
 */
export function buildKnowledgeBoundaryContext(args: {
  beat: BeatOutline | undefined;
  arcs: ArcOutline[];
  worldFacts: WorldFact[];
}): KnowledgeBoundaryContext {
  const factsByMode: KnowledgeBoundaryContext["factsByMode"] = {
    experienced_as_anomaly: [],
    suspected_as_pattern: [],
    named_explicitly: [],
  };
  if (!args.beat) return { factsByMode };
  const reveals = getEffectiveRevealItems(args.beat);
  const factById = new Map(args.worldFacts.map((fact) => [fact.id, fact]));
  const seen = new Set<string>();
  for (const reveal of reveals) {
    if (reveal.kind !== "world_fact" || !reveal.refId) continue;
    const fact = factById.get(reveal.refId);
    if (!fact || seen.has(fact.id)) continue;
    seen.add(fact.id);
    const mode = effectiveRevealMode(reveal, args.beat, args.arcs);
    factsByMode[mode].push({
      factId: fact.id,
      vocab: getLabelVocabulary(fact),
    });
  }
  return { factsByMode };
}
