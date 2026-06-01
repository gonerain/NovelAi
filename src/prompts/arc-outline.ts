import type {
  ArcOutlineGenerationInput,
  ArcOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildArcOutlineMessages(
  input: ArcOutlineGenerationInput,
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
  const compactCast = input.cast.map((item) => ({
    id: item.id,
    role: item.role,
    storyFunction: item.storyFunction,
    coreTension: item.coreTension,
  }));

  return [
    {
      role: "system",
      content: [
        "Task: Convert episode blueprints into episode outlines. In this project, ArcOutline means EPISODE / 篇章.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, write in Chinese.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- Exactly targetArcCount arc outlines.",
        "- Preserve blueprint ids and chapter ranges.",
        "- Distinct episode functions and relationship pressure per episode.",
        "",
        "Episode design rules:",
        "- targetChapterCount is the current outline window, not proof that the novel ends there. If the window is short, outline only early episodes and do not create a final-resolution arc.",
        "- Each episode must have a clear reader question fitted to the premise.",
        "- Each episode must have one main commercial hook, one main reader payoff, and one new pressure created by the protagonist's choices.",
        "- Episodes should roll forward like a serial: do not fully detail future episodes, but each must create the next episode's pressure through choices and consequences.",
        "- Use character-driven causality: choice -> consequence -> new pressure -> new choice -> larger consequence.",
        "- Do not let setting expansion carry length. Long-form length comes from characters making choices that create new problems.",
        "",
        "Concept Grounding / So-What Test:",
        "- Every episode goal, required turn, rule, cost, clue, and relationship change must pass a So-What Test.",
        "- A design fails if it only means 'this symbolizes X' or 'this represents Y'.",
        "- A design passes only if a normal reader can immediately see why it matters on page.",
        "- For each requiredTurn, include a concrete visible consequence and pressure: what changes, why the character cannot ignore it, and what new problem it creates.",
        "- Include failed workaround awareness: avoid turns where readers can solve the problem with an obvious simple action.",
        "- For urban_rule_pawnshop_v1, every pawned rule must have an irreplaceable high-pressure scene consequence, not only emotional symbolism.",
        "",
        "Genre adaptation:",
        "- If genrePayoffPackId is female_relationship_v1: relationship naming and being heard are the core episode movements.",
        "- If genrePayoffPackId is urban_rule_pawnshop_v1: each episode should orbit one major transaction case or transaction consequence, with a concrete life rule, client desire, visible exchange, hidden price, and backlash.",
        "- If urban_rule_pawnshop_v1: do not design episodes as dungeon clears. Use life trouble, pawn tickets, rules sold by ordinary people, missing-person clues, debts, rent, contracts, neighbors, police, family, and old shop obligations.",
        "- If urban_rule_pawnshop_v1: the protagonist's arc should move from reluctant inheritor -> active examiner of desire -> debtor of the shop -> someone who understands price but still chooses.",
        "",
        "ArcOutline field mapping:",
        "- arcGoal: episode reader question + concrete relationship objective.",
        "- startState/endState: relationship naming state at episode start/end.",
        "- requiredTurns: include 3-5 turns, each with choice + consequence + new pressure. Keep each turn one concise sentence.",
        "- relationshipChanges: specify whose behavior or access changes, not just what the shift symbolizes.",
        "- memoryRequirements: track concrete objects/phrases/witness moments needed later.",
        "- protagonistArc: include 2-4 concrete shifts with oldDefault/pressureTrigger/newChoice/costPaid.",
        "- supportingCharacterArcs: include at most 3 characters, only for characters who make costly choices in this episode.",
        "",
        "Opening episode hard requirements if this is the first episode:",
        "- Treat storySetup.openingSituation as canonical. The first episode must begin there and preserve its concrete surface.",
        "- Do NOT start with airport/hotel/warehouse/office confrontation unless storySetup.openingSituation says so.",
        "- Length should be around 18-24 chapters if range allows. If this is the only arc in the current window, spend the whole window on this current episode.",
        "- If urban_rule_pawnshop_v1: include first client, first life-rule pawn, the client's hidden desire, protagonist's first active choice, first visible exchange, and first backlash.",
        "- If urban_rule_pawnshop_v1 and the first rule is a rescue/contact route, DO NOT transfer that route to the protagonist unless storySetup explicitly says so. The cost should be route loss, failed delivery, delayed rescue, or misdirected signal, not 'the protagonist becomes the new chosen rescuer'.",
        "- If urban_rule_pawnshop_v1: chapter 1 must introduce protagonist, concrete debt/trouble, pawnshop abnormality, first client, and the exact first pawned rule within the opening hook. Chapter 2-3 must complete or nearly complete the first transaction, not merely continue atmosphere.",
        "- If urban_rule_pawnshop_v1: keep shop origin, former owner, old debt, and pricing system as hooks. Do not explain them.",
        "- If female_relationship_v1: include old-intimate pressure, friend agency, boundary actions, and limited accurate hearing.",
        "- Do not make the protagonist ask an institution/guide to explain the full mechanism in the first episode; they should only experience specific life-level wrongness.",
        "",
        "Short-window pacing guard:",
        "- If targetChapterCount is below 80, the final arc must NOT be final victory, public final hearing, legal status settlement, terminal update, or complete self-naming success.",
        "- For a 30-60 chapter window, generate only early/mid-early episodes based on the actual premise. End with a larger problem, not complete victory.",
        "",
        "Memory discipline:",
        "- requiredTurns and memoryRequirements must not mention events that have not happened yet as if they already happened.",
        "- Avoid phrases like '仓库对峙时的沉默' unless the blueprint/setup already contains that event.",
        "",
        "Output size control:",
        "- Keep each string concise. Prefer one sharp Chinese sentence over paragraphs.",
        "- Do not paste chapter-by-chapter lists here; beat generation will handle intra-episode rhythm.",
        "- Do not write chapter prose.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target arc count: ${input.targetArcCount}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Story outline (compressed):\n${JSON.stringify(compactStoryOutline, null, 2)}`,
        compactSetup ? `Story setup (canonical opening):\n${JSON.stringify(compactSetup, null, 2)}` : "",
        `Arc blueprints:\n${JSON.stringify(input.arcBlueprints, null, 2)}`,
        `Cast skeleton (compressed):\n${JSON.stringify(compactCast, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export const arcOutlineGenerationResultSchema: ArcOutlineGenerationResult = {
  arcOutlines: [
    {
      id: "string",
      storyOutlineId: "string",
      name: "string",
      arcGoal: "string",
      startState: "string",
      endState: "string",
      requiredTurns: ["string"],
      relationshipChanges: ["string"],
      memoryRequirements: ["string"],
      beatIds: ["string"],
      chapterRangeHint: {
        start: 1,
        end: 25,
      },
    },
  ],
  notes: ["string"],
} as unknown as ArcOutlineGenerationResult;
