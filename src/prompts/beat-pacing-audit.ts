import type { ArcOutline, BeatOutline, WorldFact } from "../domain/types.js";
import type { ChatMessage } from "../llm/types.js";

export interface BeatPacingAuditInput {
  arc: ArcOutline;
  beats: BeatOutline[];
  worldFacts: WorldFact[];
  allArcOutlines: ArcOutline[];
}

export interface BeatPacingAuditResult {
  arcId: string;
  reportMarkdown: string;
  /** Beats that should be rewritten, as JSON patches. Null if no violations. */
  rewrittenBeats: BeatPacingRewrite[] | null;
}

export interface BeatPacingRewrite {
  beatId: string;
  revealTargets: string[];
  constraints: string[];
  beatGoal?: string;
  rationale: string;
}

export function buildBeatPacingAuditMessages(
  input: BeatPacingAuditInput,
): ChatMessage[] {
  const arcOrder = [...input.allArcOutlines]
    .sort((a, b) => (a.chapterRangeHint?.start ?? 0) - (b.chapterRangeHint?.start ?? 0))
    .map((a, i) => ({ id: a.id, order: i + 1, start: a.chapterRangeHint?.start ?? 0 }));

  const currentArcOrder = arcOrder.find((a) => a.id === input.arc.id);
  const currentStart = currentArcOrder?.start ?? 0;

  const forbiddenFacts = input.worldFacts
    .filter((f) => {
      if (!f.minRevealArc) return false;
      const minArcEntry = arcOrder.find((a) => a.id === f.minRevealArc);
      return minArcEntry && minArcEntry.start > currentStart;
    })
    .map((f) => ({
      id: f.id,
      title: f.title,
      labelVocabulary: f.labelVocabulary ?? [],
      minRevealArc: f.minRevealArc,
    }));

  const beatSummaries = input.beats
    .sort((a, b) => (a.chapterRangeHint?.start ?? 0) - (b.chapterRangeHint?.start ?? 0))
    .map((b) => ({
      id: b.id,
      ch: `${b.chapterRangeHint?.start}-${b.chapterRangeHint?.end}`,
      beatGoal: b.beatGoal,
      revealTargets: b.revealTargets,
      constraints: b.constraints,
      conflict: b.conflict,
      expectedChange: b.expectedChange,
    }));

  return [
    {
      role: "system",
      content: [
        "You are a story pacing editor. Your task: audit the beat outlines for ONE arc and identify pacing violations.",
        "Two violation types to check:",
        "",
        "TYPE A — Vocabulary leaks (hard violations):",
        "The forbidden facts list contains canonical world-builder labels that must NOT appear in beat revealTargets / constraints / beatGoal for this arc.",
        "A violation is: a forbidden label (or obvious paraphrase) appearing in any beat field for this arc.",
        "Fix: rewrite that beat's revealTargets / constraints so it describes the protagonist's EXPERIENCE rather than naming the rule.",
        "Example fix: '旁人自动把她的拒绝理解成情绪波动' NOT '认知平滑处理了她的退出意图'.",
        "",
        "TYPE B — Narrative density (soft violations):",
        "Check for pacing issues that are NOT vocabulary-based:",
        "- Supporting characters (闻既白, 周聆, 张叙年, 谢临川) appearing in revealTargets as named operators with backstory/motivation in the first half of the arc",
        "- More than 3 major dramatic reveals stacked into a single beat",
        "- 'System is absolutely irreversible' framing in early beats (removes narrative hope)",
        "- Protagonist going from zero knowledge to near-complete mechanism understanding within the arc",
        "- Beats where the protagonist's interiority is skipped entirely in favour of external plot mechanics",
        "",
        "Output format — produce valid JSON with two fields:",
        "1. reportMarkdown: a concise Chinese editorial report (markdown) covering: summary, A violations list, B violations list, rewrite rationale",
        "2. rewrittenBeats: array of {beatId, revealTargets, constraints, beatGoal (optional), rationale} — only for beats that need rewriting; null if no violations",
        "JSON only. No prose outside the JSON.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Arc: ${input.arc.id} / ${input.arc.name}`,
        `Arc goal: ${input.arc.arcGoal}`,
        `Chapter range: ${input.arc.chapterRangeHint?.start}-${input.arc.chapterRangeHint?.end}`,
        "",
        forbiddenFacts.length > 0
          ? `Forbidden vocabulary for this arc (TYPE A):\n${forbiddenFacts
              .map(
                (f) =>
                  `  - ${f.labelVocabulary.join(" / ")}  (「${f.title}」, earliest arc: ${f.minRevealArc})`,
              )
              .join("\n")}`
          : "No TYPE A forbidden vocabulary for this arc.",
        "",
        `Beats to audit:\n${JSON.stringify(beatSummaries, null, 2)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export const beatPacingAuditResultSchema: BeatPacingAuditResult = {
  arcId: "string",
  reportMarkdown: "string",
  rewrittenBeats: [
    {
      beatId: "string",
      revealTargets: ["string"],
      constraints: ["string"],
      beatGoal: "string",
      rationale: "string",
    },
  ],
} as unknown as BeatPacingAuditResult;
