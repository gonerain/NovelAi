import type {
  ArcOutline,
  WorldFact,
} from "../domain/types.js";
import type {
  BeatOutlineGenerationInput,
  BeatOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

function arcStartChapter(arc: ArcOutline): number {
  return arc.chapterRangeHint?.start ?? 0;
}

function buildForbiddenVocabLines(
  currentArc: ArcOutline,
  allArcs: ArcOutline[],
  worldFacts: WorldFact[],
): string[] {
  const currentStart = arcStartChapter(currentArc);
  const lines: string[] = [];

  for (const fact of worldFacts) {
    if (!fact.minRevealArc) continue;
    const minArc = allArcs.find((a) => a.id === fact.minRevealArc);
    if (!minArc) continue;
    if (arcStartChapter(minArc) <= currentStart) continue;

    const vocab = fact.labelVocabulary ?? [];
    if (vocab.length === 0) continue;

    lines.push(
      `  - ${vocab.join(" / ")}  (「${fact.title}」— earliest arc: ${fact.minRevealArc})`,
    );
  }

  return lines;
}

export function buildBeatOutlineMessages(
  input: BeatOutlineGenerationInput,
): ChatMessage[] {
  const compactStoryOutline = {
    id: input.storyOutline.id,
    title: input.storyOutline.title,
    coreTheme: input.storyOutline.coreTheme,
    endingTarget: input.storyOutline.endingTarget,
  };
  const compactArcs = input.arcOutlines.map((arc) => ({
    id: arc.id,
    name: arc.name,
    arcGoal: arc.arcGoal,
    chapterRangeHint: arc.chapterRangeHint,
    memoryRequirements: arc.memoryRequirements.slice(0, 5),
    requiredTurns: arc.requiredTurns.slice(0, 4),
    relationshipChanges: arc.relationshipChanges.slice(0, 4),
  }));

  // Derive forbidden vocabulary lines for each arc being generated.
  const allArcs = input.allArcOutlines ?? input.arcOutlines;
  const forbiddenByArcId = new Map<string, string[]>();
  if (input.worldFacts && input.worldFacts.length > 0) {
    for (const arc of input.arcOutlines) {
      const lines = buildForbiddenVocabLines(arc, allArcs, input.worldFacts);
      if (lines.length > 0) {
        forbiddenByArcId.set(arc.id, lines);
      }
    }
  }

  const forbiddenSection =
    forbiddenByArcId.size > 0
      ? [
          "Info-pacing hard boundary (A-constraint):",
          "The following canonical labels MUST NOT appear verbatim or as paraphrase in revealTargets / constraints / beatGoal of the listed arc's beats.",
          "In those arcs, describe only what the POV character experiences or suspects — never name the underlying world-builder rule.",
          "Example: write '旁人自动把她的拒绝理解成情绪波动' NOT '认知平滑处理了她的退出意图'.",
          ...Array.from(forbiddenByArcId.entries()).flatMap(([arcId, lines]) => [
            `Arc ${arcId} — forbidden labels:`,
            ...lines,
          ]),
        ].join("\n")
      : undefined;

  return [
    {
      role: "system",
      content: [
        "Task: Convert arc outlines into beat outlines.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, concise Chinese is preferred; English is allowed when clearer.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- For each arc generate 3 to 6 beats.",
        "- Beat chapter ranges must fully cover arc range contiguously with no overlap.",
        "- Beat order starts at 1 per arc and increments by 1.",
        "- Each beat must include beatGoal/conflict/expectedChange/constraints/revealTargets.",
        "- Each beat should include narrativeTasks: 3-5 tasks covering different dimensions (main_plot / emotional / relationship / worldbuilding / foreshadowing). Each task has a targetChapterBudget — the number of chapters it expects to take. Total budget across all tasks must not exceed the beat's chapter count. Tasks should be independent so the scene decomposer can advance one without advancing others in the same chapter.",
        forbiddenSection,
        "Return valid JSON only.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Story outline (compressed):\n${JSON.stringify(compactStoryOutline, null, 2)}`,
        `Arc outlines (compressed):\n${JSON.stringify(compactArcs, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export const beatOutlineGenerationResultSchema: BeatOutlineGenerationResult = {
  beatOutlines: [
    {
      id: "string",
      arcId: "string",
      order: 1,
      chapterRangeHint: {
        start: 1,
        end: 3,
      },
      beatGoal: "string",
      conflict: "string",
      expectedChange: "string",
      requiredCharacters: ["string"],
      requiredMemories: ["string"],
      payoffPatternIds: ["string"],
      revealTargets: ["string"],
      constraints: ["string"],
      openingAnchor: {
        readerAnchor: ["string"],
        relationshipAnchor: ["string"],
        worldAnchor: ["string"],
        hook: "string",
      },
      narrativeTasks: [
        {
          id: "string",
          dimension: "main_plot",
          description: "string",
          targetChapterBudget: 3,
          chaptersUsed: 0,
        },
      ],
    },
  ],
  notes: ["string"],
} as unknown as BeatOutlineGenerationResult;
