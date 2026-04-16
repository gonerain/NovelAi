import type { ArcOutline, BeatOutline } from "./types.js";

function distanceToRange(chapterNumber: number, range: { start: number; end: number }): number {
  if (chapterNumber < range.start) {
    return range.start - chapterNumber;
  }
  if (chapterNumber > range.end) {
    return chapterNumber - range.end;
  }
  return 0;
}

function sortArcsDeterministically(arcs: ArcOutline[]): ArcOutline[] {
  return [...arcs].sort((left, right) => {
    const leftStart = left.chapterRangeHint?.start ?? Number.MAX_SAFE_INTEGER;
    const rightStart = right.chapterRangeHint?.start ?? Number.MAX_SAFE_INTEGER;
    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }
    return left.id.localeCompare(right.id);
  });
}

export function pickArcForChapterDeterministic(
  arcOutlines: ArcOutline[],
  chapterNumber: number,
): ArcOutline | undefined {
  if (arcOutlines.length === 0) {
    return undefined;
  }

  const sorted = sortArcsDeterministically(arcOutlines);
  const ranged = sorted.filter((arc) => arc.chapterRangeHint);

  const directMatch = ranged.find((arc) => {
    const range = arc.chapterRangeHint!;
    return chapterNumber >= range.start && chapterNumber <= range.end;
  });
  if (directMatch) {
    return directMatch;
  }

  if (ranged.length > 0) {
    return ranged.reduce((best, current) => {
      if (!best.chapterRangeHint || !current.chapterRangeHint) {
        return best;
      }
      const bestDistance = distanceToRange(chapterNumber, best.chapterRangeHint);
      const currentDistance = distanceToRange(chapterNumber, current.chapterRangeHint);
      if (currentDistance !== bestDistance) {
        return currentDistance < bestDistance ? current : best;
      }
      return current.id.localeCompare(best.id) < 0 ? current : best;
    });
  }

  const index = Math.min(Math.max(chapterNumber - 1, 0), sorted.length - 1);
  return sorted[index];
}

export function pickBeatForChapterDeterministic(
  beatOutlines: BeatOutline[],
  arcOutline: ArcOutline | undefined,
  chapterNumber: number,
): BeatOutline | undefined {
  if (!arcOutline) {
    return undefined;
  }

  const arcBeats = beatOutlines
    .filter((beat) => beat.arcId === arcOutline.id)
    .sort((left, right) => {
      const leftStart = left.chapterRangeHint?.start ?? Number.MAX_SAFE_INTEGER;
      const rightStart = right.chapterRangeHint?.start ?? Number.MAX_SAFE_INTEGER;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.id.localeCompare(right.id);
    });

  if (arcBeats.length === 0) {
    return undefined;
  }

  const ranged = arcBeats.filter((beat) => beat.chapterRangeHint);
  const directMatch = ranged.find((beat) => {
    const range = beat.chapterRangeHint!;
    return chapterNumber >= range.start && chapterNumber <= range.end;
  });
  if (directMatch) {
    return directMatch;
  }

  if (ranged.length > 0) {
    return ranged.reduce((best, current) => {
      if (!best.chapterRangeHint || !current.chapterRangeHint) {
        return best;
      }
      const bestDistance = distanceToRange(chapterNumber, best.chapterRangeHint);
      const currentDistance = distanceToRange(chapterNumber, current.chapterRangeHint);
      if (currentDistance !== bestDistance) {
        return currentDistance < bestDistance ? current : best;
      }
      return current.id.localeCompare(best.id) < 0 ? current : best;
    });
  }

  return arcBeats[0];
}
