import type { EntityId } from "./types.js";

/**
 * Chapter shape catalogue used by task-driven semi-supervision and the
 * (deferred) per-chapter Director. Open enum: callers may add more shapes
 * by widening the type, but the canonical set lives here.
 */
export type ChapterShape =
  | "plot_advance"
  | "pressure_buildup"
  | "confrontation"
  | "payoff"
  | "aftermath"
  | "character_moment"
  | "relationship_beat"
  | "world_texture"
  | "interlude"
  | "reflection";

export const ALL_CHAPTER_SHAPES: ChapterShape[] = [
  "plot_advance",
  "pressure_buildup",
  "confrontation",
  "payoff",
  "aftermath",
  "character_moment",
  "relationship_beat",
  "world_texture",
  "interlude",
  "reflection",
];

/**
 * Shapes that count as "plot pressure" in the rolling pacing-budget window.
 * Everything else is "non-plot" — character/relationship/world texture or
 * sequel/aftermath work.
 */
export const PLOT_PRESSURE_SHAPES = new Set<ChapterShape>([
  "plot_advance",
  "pressure_buildup",
  "confrontation",
  "payoff",
]);

export function isChapterShape(value: unknown): value is ChapterShape {
  return typeof value === "string" && (ALL_CHAPTER_SHAPES as string[]).includes(value);
}

export function isPlotPressureShape(shape: ChapterShape): boolean {
  return PLOT_PRESSURE_SHAPES.has(shape);
}

/**
 * Optional annotation fields layered on top of the existing BeatOutline.
 * The decomposer (Phase 2) writes these; the writer prompt (Phase 3)
 * elevates them above scheduler-derived signals.
 *
 * All fields are optional so existing data without annotations stays valid.
 */
export interface BeatAnnotations {
  /** Chapter shape this beat is meant to land. */
  shape?: ChapterShape;
  /** What the POV character is hiding from others or themselves in this beat. */
  subtext?: string;
  /**
   * Concrete sensory or behavioural anchors the writer must enact in this
   * beat. NOT plot facts. 2-4 entries is typical.
   */
  textureMust?: string[];
  /** Things that must NOT happen in this beat (subset of forbiddenMoves). */
  forbiddenInBeat?: string[];
  /** Voice cues per character that the writer should deploy. */
  voiceCues?: BeatVoiceCue[];
  /**
   * A specific remembered moment this beat should produce, written so
   * later beats can reference it back ("第7章雨夜共餐时她注意到他手上新的伤").
   */
  relationshipMoment?: string;
  /** Rough cn_chars target for the chapter assembled from this beat. */
  textureTargetChars?: number;
  /** What carries the reader into the next chapter. May be quiet. */
  continuationHook?: string;
  /** Provenance: which task brief this beat was decomposed from. */
  taskId?: EntityId;
  /** Provenance: order index inside that task's decomposition. */
  taskBeatIndex?: number;
}

export interface BeatVoiceCue {
  characterId: EntityId;
  cue: string;
}

/**
 * Pacing budget computed over a rolling window of recent chapter shapes.
 * Used by the decomposer (advisory) and by the eval system.
 */
export interface PacingBudget {
  windowSize: number;
  shapesInWindow: ChapterShape[];
  nonPlotChapterCount: number;
  consecutivePlotPressure: number;
  passes: boolean;
  pacingNudge: "expand_breathing" | "allow_plot" | "neutral";
}

const DEFAULT_WINDOW = 7;
const NON_PLOT_MIN_PER_WINDOW = 2;
const MAX_CONSECUTIVE_PLOT = 3;

export function computePacingBudget(args: {
  recentShapes: ChapterShape[];
  windowSize?: number;
}): PacingBudget {
  const windowSize = Math.max(1, args.windowSize ?? DEFAULT_WINDOW);
  const shapesInWindow = args.recentShapes.slice(-windowSize);
  const nonPlotChapterCount = shapesInWindow.filter((shape) => !isPlotPressureShape(shape)).length;

  let consecutivePlotPressure = 0;
  for (let i = shapesInWindow.length - 1; i >= 0; i -= 1) {
    if (isPlotPressureShape(shapesInWindow[i]!)) {
      consecutivePlotPressure += 1;
    } else {
      break;
    }
  }

  const passes =
    nonPlotChapterCount >= NON_PLOT_MIN_PER_WINDOW &&
    consecutivePlotPressure <= MAX_CONSECUTIVE_PLOT;

  let pacingNudge: PacingBudget["pacingNudge"];
  if (consecutivePlotPressure >= MAX_CONSECUTIVE_PLOT || nonPlotChapterCount < NON_PLOT_MIN_PER_WINDOW) {
    pacingNudge = "expand_breathing";
  } else {
    const lastTwoNonPlot =
      shapesInWindow.length >= 2 &&
      !isPlotPressureShape(shapesInWindow[shapesInWindow.length - 1]!) &&
      !isPlotPressureShape(shapesInWindow[shapesInWindow.length - 2]!);
    pacingNudge = lastTwoNonPlot ? "allow_plot" : "neutral";
  }

  return {
    windowSize,
    shapesInWindow,
    nonPlotChapterCount,
    consecutivePlotPressure,
    passes,
    pacingNudge,
  };
}
