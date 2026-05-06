import type { BeatOutline, RevealItem, WorldFact } from "./types.js";
import { getEffectiveRevealItems } from "./reveal-item.js";

const BIGRAM_N = 2;
const TRIGRAM_N = 3;
// A match is accepted when either combined-title score clears its
// bar OR combined-(title+description) score clears the lower bar.
// Title is heavily preferred because descriptions across multiple
// facts often share generic vocabulary (e.g. "关系锚点").
const MIN_TITLE_BIGRAM_OVERLAP = 3;
const MIN_TRIGRAM_OVERLAP = 2;
const MIN_FULL_BIGRAM_OVERLAP = 5;
// Weights for combining scores into a ranking number.
const W_TITLE_BIGRAM = 3;
const W_TITLE_TRIGRAM = 5;
const W_DESC_BIGRAM = 1;
const W_DESC_TRIGRAM = 2;

const PUNCT_SPLIT = /[，。！？、；：,.!?;:\s\n]+/u;

function bigramTokens(text: string, n: number): Set<string> {
  const grams = new Set<string>();
  for (const segment of text.split(PUNCT_SPLIT)) {
    if (segment.length < n) continue;
    for (let i = 0; i + n <= segment.length; i += 1) {
      grams.add(segment.slice(i, i + n));
    }
  }
  return grams;
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const gram of a) {
    if (b.has(gram)) count += 1;
  }
  return count;
}

export interface RevealFactMatch {
  factId: string;
  score: number;
  matchedOn: "title" | "description";
}

interface FactScoreRow {
  factId: string;
  titleBigramScore: number;
  titleTrigramScore: number;
  descBigramScore: number;
  descTrigramScore: number;
  hasTitleSignal: boolean;
  hasFullSignal: boolean;
}

function scoreFactsAgainstReveal(
  reveal: RevealItem,
  worldFacts: WorldFact[],
): FactScoreRow[] {
  const revealBigrams = bigramTokens(reveal.text, BIGRAM_N);
  const revealTrigrams = bigramTokens(reveal.text, TRIGRAM_N);
  const rows: FactScoreRow[] = [];
  for (const fact of worldFacts) {
    const titleBigramScore = overlapCount(revealBigrams, bigramTokens(fact.title, BIGRAM_N));
    const titleTrigramScore = overlapCount(revealTrigrams, bigramTokens(fact.title, TRIGRAM_N));
    const descBigramScore = overlapCount(revealBigrams, bigramTokens(fact.description, BIGRAM_N));
    const descTrigramScore = overlapCount(revealTrigrams, bigramTokens(fact.description, TRIGRAM_N));
    const hasTitleSignal =
      titleBigramScore >= MIN_TITLE_BIGRAM_OVERLAP ||
      titleTrigramScore >= MIN_TRIGRAM_OVERLAP;
    const fullBigramScore = titleBigramScore + descBigramScore;
    const fullTrigramScore = titleTrigramScore + descTrigramScore;
    const hasFullSignal =
      fullBigramScore >= MIN_FULL_BIGRAM_OVERLAP ||
      fullTrigramScore >= MIN_TRIGRAM_OVERLAP;
    rows.push({
      factId: fact.id,
      titleBigramScore,
      titleTrigramScore,
      descBigramScore,
      descTrigramScore,
      hasTitleSignal,
      hasFullSignal,
    });
  }
  return rows;
}

export function findBestWorldFactForReveal(
  reveal: RevealItem,
  worldFacts: WorldFact[],
): RevealFactMatch | null {
  if (worldFacts.length === 0) return null;
  const rows = scoreFactsAgainstReveal(reveal, worldFacts);

  // Stage 1: any fact with a strong TITLE signal? Title is canonical
  // — if a reveal mentions a character name from one fact's title
  // and a generic phrase that happens to also appear in another
  // fact's description, the title-anchored match should win.
  const titleStrong = rows.filter((row) => row.hasTitleSignal);
  if (titleStrong.length > 0) {
    let best: FactScoreRow | null = null;
    for (const row of titleStrong) {
      const score =
        row.titleBigramScore * W_TITLE_BIGRAM +
        row.titleTrigramScore * W_TITLE_TRIGRAM;
      const bestScore = best
        ? best.titleBigramScore * W_TITLE_BIGRAM + best.titleTrigramScore * W_TITLE_TRIGRAM
        : -1;
      if (!best || score > bestScore) {
        best = row;
      }
    }
    if (best) {
      return {
        factId: best.factId,
        score:
          best.titleBigramScore * W_TITLE_BIGRAM +
          best.titleTrigramScore * W_TITLE_TRIGRAM +
          best.descBigramScore * W_DESC_BIGRAM +
          best.descTrigramScore * W_DESC_TRIGRAM,
        matchedOn: "title",
      };
    }
  }

  // Stage 2: no title signal anywhere — fall back to description-only
  // matches that pass the (higher) full-corpus threshold.
  let best: FactScoreRow | null = null;
  for (const row of rows) {
    if (!row.hasFullSignal) continue;
    const score =
      row.titleBigramScore * W_TITLE_BIGRAM +
      row.titleTrigramScore * W_TITLE_TRIGRAM +
      row.descBigramScore * W_DESC_BIGRAM +
      row.descTrigramScore * W_DESC_TRIGRAM;
    const bestScore = best
      ? best.titleBigramScore * W_TITLE_BIGRAM +
        best.titleTrigramScore * W_TITLE_TRIGRAM +
        best.descBigramScore * W_DESC_BIGRAM +
        best.descTrigramScore * W_DESC_TRIGRAM
      : -1;
    if (!best || score > bestScore) {
      best = row;
    }
  }
  if (!best) return null;
  return {
    factId: best.factId,
    score:
      best.titleBigramScore * W_TITLE_BIGRAM +
      best.titleTrigramScore * W_TITLE_TRIGRAM +
      best.descBigramScore * W_DESC_BIGRAM +
      best.descTrigramScore * W_DESC_TRIGRAM,
    matchedOn: "description",
  };
}

/**
 * Auto-bind RevealItem.refId to a WorldFact id where a strong
 * match exists. When a reveal already has refId, leave it alone.
 * When refId is set but the resolved fact is not in worldFacts,
 * the reveal is left unchanged (no spurious overrides).
 *
 * Side effect: when binding succeeds, the reveal's `kind` is
 * upgraded to `world_fact` if it was the synth-default
 * `character_truth`.
 */
export function bindRevealItemsToWorldFacts(
  reveals: RevealItem[],
  worldFacts: WorldFact[],
): RevealItem[] {
  const factIds = new Set(worldFacts.map((fact) => fact.id));
  return reveals.map((reveal) => {
    if (reveal.refId && factIds.has(reveal.refId)) {
      return reveal;
    }
    if (reveal.refId && !factIds.has(reveal.refId)) {
      return reveal;
    }
    const match = findBestWorldFactForReveal(reveal, worldFacts);
    if (!match) {
      return reveal;
    }
    return {
      ...reveal,
      refId: match.factId,
      kind: reveal.kind === "character_truth" ? "world_fact" : reveal.kind,
    };
  });
}

/**
 * Given a beat (with or without `worldFactIds` / `revealItems`),
 * return the actual WorldFact[] this beat references. Unions:
 *   - explicit `beat.worldFactIds`
 *   - resolved `refId` from each effective reveal whose
 *     `kind === "world_fact"`
 * After binding, this becomes the primary read path. Order is
 * stable (worldFactIds first, then reveal-derived, deduped).
 */
export function getWorldFactsForBeat(
  beat: BeatOutline,
  worldFacts: WorldFact[],
): WorldFact[] {
  const factById = new Map(worldFacts.map((fact) => [fact.id, fact]));
  const seen = new Set<string>();
  const result: WorldFact[] = [];

  for (const id of beat.worldFactIds ?? []) {
    const fact = factById.get(id);
    if (fact && !seen.has(id)) {
      seen.add(id);
      result.push(fact);
    }
  }

  const reveals = bindRevealItemsToWorldFacts(getEffectiveRevealItems(beat), worldFacts);
  for (const reveal of reveals) {
    if (reveal.kind !== "world_fact" || !reveal.refId) continue;
    const fact = factById.get(reveal.refId);
    if (fact && !seen.has(fact.id)) {
      seen.add(fact.id);
      result.push(fact);
    }
  }

  return result;
}

export interface FactCoverageEntry {
  factId: string;
  title: string;
  category: string;
  scope: WorldFact["scope"];
  beats: Array<{
    beatId: string;
    chapterRange?: { start: number; end: number };
    via: "explicit" | "reveal" | "both";
    revealIds: string[];
  }>;
  earliestDueChapter?: number;
}

export function describeFactCoverage(
  beats: BeatOutline[],
  worldFacts: WorldFact[],
): FactCoverageEntry[] {
  const entries = new Map<string, FactCoverageEntry>();
  for (const fact of worldFacts) {
    entries.set(fact.id, {
      factId: fact.id,
      title: fact.title,
      category: fact.category,
      scope: fact.scope,
      beats: [],
    });
  }

  for (const beat of beats) {
    const explicitIds = new Set(beat.worldFactIds ?? []);
    const reveals = bindRevealItemsToWorldFacts(
      getEffectiveRevealItems(beat),
      worldFacts,
    );
    const revealsByFact = new Map<string, RevealItem[]>();
    for (const reveal of reveals) {
      if (reveal.kind !== "world_fact" || !reveal.refId) continue;
      const list = revealsByFact.get(reveal.refId) ?? [];
      list.push(reveal);
      revealsByFact.set(reveal.refId, list);
    }
    const allFactIds = new Set([...explicitIds, ...revealsByFact.keys()]);
    for (const factId of allFactIds) {
      const entry = entries.get(factId);
      if (!entry) continue;
      const beatReveals = revealsByFact.get(factId) ?? [];
      const hasExplicit = explicitIds.has(factId);
      const hasReveal = beatReveals.length > 0;
      entry.beats.push({
        beatId: beat.id,
        chapterRange: beat.chapterRangeHint,
        via:
          hasExplicit && hasReveal ? "both" : hasExplicit ? "explicit" : "reveal",
        revealIds: beatReveals.map((reveal) => reveal.id),
      });
      const due = beatReveals
        .map((reveal) => reveal.dueChapter)
        .filter((value) => Number.isFinite(value));
      if (due.length > 0) {
        const minDue = Math.min(...due);
        if (entry.earliestDueChapter == null || minDue < entry.earliestDueChapter) {
          entry.earliestDueChapter = minDue;
        }
      }
    }
  }

  return [...entries.values()].sort((a, b) => {
    const left = a.earliestDueChapter ?? Number.POSITIVE_INFINITY;
    const right = b.earliestDueChapter ?? Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return a.factId.localeCompare(b.factId);
  });
}
