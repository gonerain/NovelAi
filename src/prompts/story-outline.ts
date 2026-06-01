import type {
  StoryOutlineGenerationInput,
  StoryOutlineGenerationResult,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export function buildStoryOutlineMessages(
  input: StoryOutlineGenerationInput,
): ChatMessage[] {
  const compactAuthorProfile = {
    summary: input.authorProfile.summary,
    corePreferences: input.authorProfile.corePreferences.slice(0, 6),
    plotBiases: input.authorProfile.plotBiases.slice(0, 6),
    endingBiases: input.authorProfile.endingBiases.slice(0, 6),
    topConstraints: input.authorProfile.topConstraints.slice(0, 4).map((item) => item.description),
  };

  const compactTheme = {
    coreTheme: input.themeBible.coreTheme,
    endingTarget: input.themeBible.endingTarget,
    emotionalDestination: input.themeBible.emotionalDestination,
    subThemes: input.themeBible.subThemes.slice(0, 5),
    taboos: input.themeBible.taboos.slice(0, 4),
  };

  const compactStyle = {
    narrativeStyle: input.styleBible.narrativeStyle.slice(0, 4),
    pacingStyle: input.styleBible.pacingStyle.slice(0, 4),
    antiPatterns: input.styleBible.antiPatterns.slice(0, 5),
  };

  const compactSetup = {
    premise: input.storySetup.premise,
    currentArcGoal: input.storySetup.currentArcGoal,
    openingSituation: input.storySetup.openingSituation,
    defaultActiveCharacterIds: input.storySetup.defaultActiveCharacterIds.slice(0, 4),
    genrePayoffPackId: input.storySetup.genrePayoffPackId,
  };

  return [
    {
      role: "system",
      content: [
        "Task: Generate a female-frequency commercial web-novel story promise and episode roadmap. In this project, each arc blueprint is an EPISODE / 篇章, not a rigid whole-book volume.",
        "Hard constraints:",
        "- Output valid JSON only.",
        "- Keep JSON keys/schema fields/id-like tokens in English exactly as required.",
        "- For semantic text fields, write in Chinese.",
        "- Keep mixed-language style consistent: structural control in English, content payload can be Chinese.",
        "- Exactly targetArcCount arc blueprints.",
        "- Arc blueprints must fully cover chapter 1..targetChapterCount, contiguous, no gaps, no overlaps. Treat them as rolling episodes like 波之国篇 / 中忍考试篇: only the current episode needs dense design later; later episodes stay directional.",
        "- targetChapterCount is the current generation window, NOT necessarily the whole novel length. Do not compress the whole novel or final victory into a small test window.",
        "- Arc functions must be distinct; avoid repeated generic arc shapes.",
        "",
        "Commercial positioning:",
        "- Adapt to storySetup.genrePayoffPackId and storySetup.premise. Do not force a female relationship premise onto an urban fantasy / suspense / male webnovel premise.",
        "- The protagonist is not a slogan machine. They must have visible quirks, daily habits, flaws, sharp edges, and costs.",
        "- If genrePayoffPackId is female_relationship_v1: use relationship labels, being heard, old intimacy, and emotional cost as the core engine.",
        "- If genrePayoffPackId is urban_rule_pawnshop_v1: use strange transactions, ordinary-life rules, human desire, price, first-client mystery, and reality backlash as the core engine.",
        "- If genrePayoffPackId is urban_rule_pawnshop_v1, every episode should be easy to retell as: someone sells a life rule to solve an urgent problem, gets a clue or relief, and pays a human price.",
        "- Mechanisms must surface through concrete life objects and choices, not abstract rule lectures.",
        "",
        "Concept Grounding / So-What Test:",
        "- Every major rule, cost, clue, power, relationship shift, theme point, and arc payoff must pass a So-What Test.",
        "- A design fails if its only explanation is symbolic, thematic, aesthetic, or interpretive.",
        "- A design passes only if an ordinary reader can immediately understand the concrete consequence without literary analysis.",
        "- For each major arc blueprint, make the consequence visible: what action, loss, leverage, danger, status change, relationship behavior, or resource change appears on page?",
        "- If an obvious workaround exists, the design must imply why that workaround fails. Avoid concepts where readers can say 'so what?' or 'just do X instead'.",
        "- Translate every symbol into a concrete consequence within 1-3 chapters.",
        "",
        "Story outline field mapping:",
        "- premise: include the hook, commercial promise, and why readers will keep reading.",
        "- coreTheme: name the human cost behind the genre mechanism.",
        "- endingTarget: define the emotional / moral final state, not only a mechanical rule solution.",
        "- keyTurningPoints: write major irreversible turns in protagonist choice, price, relationships, and world pressure.",
        "- arcBlueprints: each blueprint is an episode with a concrete reader question, main pressure, main reader payoff, and what it must NOT resolve too early.",
        "- arcBlueprints must include grounded stakes in functionInStory: visible consequence + pressure + why it cannot be ignored.",
        "",
        "First episode requirements:",
        "- The first arc blueprint should be the opening episode named from the project's actual premise.",
        "- First episode length should be about 18-24 chapters when targetChapterCount allows. If targetArcCount=1, the whole window is the first episode and must not jump to later cases.",
        "- The first episode MUST start from storySetup.openingSituation. Do not replace it with a warehouse, press conference, airport, trial, office war room, or abstract system scene unless the setup explicitly says so.",
        "- It must not crack the whole mechanism, solve the protagonist's inheritance/identity/relationship problem, or turn any guide character into a full savior.",
        "- If urban_rule_pawnshop_v1: first episode must center the first transaction and its backlash. Keep pawnshop origin, former owner, rule pricing system, and long-term enemy as light hooks only.",
        "- If urban_rule_pawnshop_v1: first episode must include the first client, the first life rule, the desired exchange, the visible price, and one chapter-end backlash.",
        "- If urban_rule_pawnshop_v1 and targetArcCount=1: design only the first transaction episode in depth. Do not introduce second/third unrelated clients as separate episode arcs.",
        "- If female_relationship_v1: first episode should feel like daily relationship residue and end with at least one important person accurately hearing the protagonist while public pressure remains wrong.",
        "",
        "Rolling-episode pacing:",
        "- For targetChapterCount below 80, generate only early/mid-early episodes. Leave final victory, public final hearing, final legal settlement, and full self-naming success outside the current window.",
        "- For a 30-60 chapter test window, generate only early/mid-early episodes tailored to the actual premise; never jump to final victory.",
        "- Later episode blueprints should open new relationship pressures, not jump directly to final self-naming victory.",
        "- The last arc in a short test window should end by creating a bigger problem, not resolving the premise.",
        "",
        "Concrete banned early-story tendency unless the user setup explicitly contains it:",
        "- Do not use final-hearing, final-terminal, public final settlement, complete identity resolution, or full-system explanation in early episodes.",
        "",
        "Forbidden tendencies:",
        "- Do not make the protagonist only say correct opinions.",
        "- Do not make chapters only about files, permissions, archives, or evidence.",
        "- Do not make clients / supporting characters disposable tools; each must have desire, danger, and cost.",
        "- Do not turn urban_rule_pawnshop_v1 into pure instance-clearing, power upgrades, or cold puzzle solving.",
        "- Do not write chapter prose.",
        "Return valid JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Project title: ${input.projectTitle}`,
        `Target chapter count: ${input.targetChapterCount}`,
        `Target arc count: ${input.targetArcCount}`,
        `Author profile (compressed):\n${JSON.stringify(compactAuthorProfile, null, 2)}`,
        `Theme (compressed):\n${JSON.stringify(compactTheme, null, 2)}`,
        `Style (compressed):\n${JSON.stringify(compactStyle, null, 2)}`,
        `Story setup (compressed):\n${JSON.stringify(compactSetup, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export const storyOutlineGenerationResultSchema: StoryOutlineGenerationResult = {
  storyOutline: {
    id: "string",
    title: "string",
    premise: "string",
    coreTheme: "string",
    endingTarget: "string",
    majorArcIds: ["string"],
    keyTurningPoints: ["string"],
  },
  arcBlueprints: [
    {
      id: "string",
      name: "string",
      functionInStory: "string",
      chapterRangeHint: {
        start: 1,
        end: 25,
      },
    },
  ],
  notes: ["string"],
} as unknown as StoryOutlineGenerationResult;
