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

    lines.push(`  - ${vocab.join(" / ")}  (${fact.title}; earliest arc: ${fact.minRevealArc})`);
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
  const compactSetup = input.storySetup
      ? {
        premise: input.storySetup.premise,
        currentArcGoal: input.storySetup.currentArcGoal,
        openingSituation: input.storySetup.openingSituation,
        defaultActiveCharacterIds: input.storySetup.defaultActiveCharacterIds.slice(0, 4),
        genrePayoffPackId: input.storySetup.genrePayoffPackId,
      }
    : undefined;
  const compactArcs = input.arcOutlines.map((arc) => ({
    id: arc.id,
    name: arc.name,
    arcGoal: arc.arcGoal,
    chapterRangeHint: arc.chapterRangeHint,
    memoryRequirements: arc.memoryRequirements.slice(0, 5),
    requiredTurns: arc.requiredTurns.slice(0, 4),
    relationshipChanges: arc.relationshipChanges.slice(0, 4),
  }));

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
          "In those arcs, describe only what the POV character experiences or suspects; never name the underlying world-builder rule.",
          "Example: write '亲友自动把她的拒绝理解成婚前情绪波动' NOT '关系修正机制覆盖了她的退出意图'.",
          ...Array.from(forbiddenByArcId.entries()).flatMap(([arcId, lines]) => [
            `Arc ${arcId} forbidden labels:`,
            ...lines,
          ]),
        ].join("\n")
      : undefined;

  return [
    {
      role: "system",
      content: [
        "Task: Convert episode outlines into episode beat outlines. BeatOutline means a relationship-rhythm segment inside the current episode, not a generic plot bucket.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, write in Chinese.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- For each arc generate exactly 4 beats when the arc has 16+ chapters; exactly 3 beats for shorter arcs.",
        "- For urban_rule_pawnshop_v1 first arc: Beat 1 MUST be exactly chapters 1-3. It must cover opening trouble, first client, exact pawned rule, and the protagonist's first non-passive choice.",
        "- Beat chapter ranges must fully cover arc range contiguously with no overlap.",
        "- Beat order starts at 1 per arc and increments by 1.",
        "- Each beat must include beatGoal/conflict/expectedChange/constraints/revealTargets.",
        "- Each beat MUST include narrativeTasks: exactly 3 tasks covering main_plot, emotional, and relationship. Each task needs: unique id, dimension, brief description, targetChapterBudget, chaptersUsed=0. Total budget must not exceed chapter count.",
        "- Strict output budget: every string should be one short Chinese sentence, preferably under 32 Chinese characters. Do not write paragraphs.",
        "",
        "Commercial beat design:",
        "- Beats must create a concrete reader payoff, not only logical progress.",
        "- Every beat needs a concrete life surface: kitchen, shop counter, hotel lobby, car downstairs, company pantry, bus stop, laundry, clinic, law office, police station, old contract, rent notice, food delivery, etc.",
        "- Every beat must include one emotional or genre payoff fitted to the premise.",
        "- Every beat must include one cost: safety lost, money lost, friend/client implicated, old habit stabbed, public explanation worsened, witness endangered, rule price collected, or reality backlash.",
        "- Avoid making the protagonist a tactical rule tester. Their actions must start from daily needs: eat, sleep, pay rent, open a shop, change card, return dress, get documents, find housing, protect someone, finish a transaction.",
        "- If urban_rule_pawnshop_v1: every beat should contain transaction pressure: client desire, pawned rule, exchange, price, clue, or backlash.",
        "- If urban_rule_pawnshop_v1: avoid power-up language. Rules are ordinary-life defaults with emotional cost, not combat skills.",
        "",
        "Concept Grounding / So-What Test:",
        "- Every beat must pass a So-What Test. If the payoff only works as symbolism, rewrite it.",
        "- Include a visible consequence: what changes on-page that readers can see?",
        "- Include pressure: why can the character not ignore it?",
        "- Include failed workaround: what obvious workaround would readers think of, and why does it not solve the problem?",
        "- Include scene proof: what object, action, or result can prove the consequence within this beat?",
        "- For urban_rule_pawnshop_v1, a pawned rule fails if a simple workaround makes the cost irrelevant. Example failure: '小名不回头' if calling a full name solves it.",
        "- Prefer rules whose loss closes a real route: emergency contact, finding home, being believed, remembering danger, recognizing a safe person, asking for help, or trusting rescue.",
        "- If a rule removes someone's rescue/contact route, do not replace it with the protagonist as the new automatic rescuer. Show failed delivery, delayed rescue, misdirected signal, or nobody receiving the right message.",
        "",
        "Opening episode rhythm target:",
        "- Use storySetup.openingSituation as the concrete opening surface.",
        "- If urban_rule_pawnshop_v1: Beat 1 should hook with inheritance/debt/shop opening, first client arrival, exact pawned rule, and protagonist's first active interrogation/condition.",
        "- If urban_rule_pawnshop_v1: Beat 2 should deepen and complete the first transaction by exposing the client's hidden desire and danger.",
        "- If urban_rule_pawnshop_v1: Beat 3 should deliver the exchange/clue and show price starting to collect.",
        "- If urban_rule_pawnshop_v1: Beat 4 should land first backlash and force the protagonist to stay involved.",
        "- If female_relationship_v1: use old intimacy pressure, public boundary, friend cost, old object crack, and limited witness.",
        "- If chapter range is long enough, mention a light mirror/hook inside an existing beat; do not add extra beats for it.",
        "",
        "Required content inside existing fields:",
        "- beatGoal: write the beat's reader question and relationship payoff, not a vague plot goal.",
        "- conflict: include visible consequence + pressure + failed workaround, not only atmosphere.",
        "- expectedChange: specify a visible state movement, e.g. 客人求助 -> 交易成立, 规则存在 -> 价格开始收取, 陆太太 -> 林小姐.",
        "- revealTargets: include only reader-facing promises that can land on page; prefer concrete consequences over lore labels.",
        "- constraints: include hard bans for this beat, especially what cannot be solved too early.",
        "- openingAnchor.readerAnchor: exactly 1 concrete scene/object hook.",
        "- openingAnchor.relationshipAnchor: exactly 1 old intimacy / friendship / witness hook.",
        "- openingAnchor.worldAnchor: exactly 1 normal-life pressure hook.",
        "- narrativeTasks must include at least one relationship task and one emotional task for every beat.",
        "- Use decisionOwnerIds, decisionPressure, likelyChoice, and relationshipShift. Do not add extra fields not shown in the JSON example.",
        "",
        "Continuity bans:",
        "- requiredMemories must only list setup facts, prior-episode facts, or objects/events created earlier in the same beat. Never list future events as if they already happened.",
        "- Do NOT invent prior memories like warehouse confrontation, media press conference, terminal update, or final identity record unless they are explicitly in storySetup or the current arc startState.",
        "- Do NOT delay the first transaction too long. The opening chapter must sell the premise; by chapter 3 the first pawned rule and exchange path should be emotionally legible.",
        "- Do NOT move final backlash too early. Major irreversible damage can land near the last beat, but the first client/rule/exchange must appear immediately.",
        "- Do NOT make second episode immediately become a rules laboratory. If later arcs explore rules, keep them anchored in life pressure, client desire, and cost.",
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
        compactSetup ? `Story setup (canonical opening):\n${JSON.stringify(compactSetup, null, 2)}` : "",
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
      decisionOwnerIds: ["string"],
      decisionPressure: "string",
      likelyChoice: "string",
      relationshipShift: "string",
      openingAnchor: {
        readerAnchor: ["凌晨旧柜台上的典当票"],
        relationshipAnchor: ["客人抱着孩子书包"],
        worldAnchor: ["打印机吐出新掌柜到岗"],
        hook: "string",
      },
      narrativeTasks: [
        {
          id: "task_beat_id_main",
          dimension: "main_plot",
          description: "处理被称谓污染的生活麻烦",
          targetChapterBudget: 3,
          chaptersUsed: 0,
        },
        {
          id: "task_beat_id_emotional",
          dimension: "emotional",
          description: "用小动作暴露嘴硬脆弱",
          targetChapterBudget: 2,
          chaptersUsed: 0,
        },
        {
          id: "task_beat_id_relationship",
          dimension: "relationship",
          description: "关系称呼发生可见位移",
          targetChapterBudget: 3,
          chaptersUsed: 0,
        },
      ],
    },
  ],
  notes: ["string"],
} as unknown as BeatOutlineGenerationResult;
