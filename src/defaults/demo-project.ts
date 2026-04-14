import type {
  ArcOutline,
  AuthorInterviewSessionInput,
  BeatOutline,
  CharacterState,
  StoryOutline,
  StoryMemory,
  StorySetup,
  StyleBible,
  ThemeBible,
  WorldFact,
} from "../domain/index.js";

export const demoProjectId = "demo-project";
export const demoProjectTitle = "Demo Novel Project";
export const demoPremise =
  "A protagonist who appears controlled and self-contained is forced, over a long journey, to admit his self-destructive habits and learn to accept rescue.";

export const demoInterviewInput: AuthorInterviewSessionInput = {
  userRawAnswers: [
    {
      questionId: "theme_core",
      answer:
        "I want stories about ambition, betrayal, and delayed justice. Characters should pay real prices before earning any form of redemption.",
    },
    {
      questionId: "character_bias",
      answer:
        "I favor highly competent characters with hidden damage: strategists, liars, survivors, and people who weaponize calm under pressure.",
    },
    {
      questionId: "relationship_pattern",
      answer:
        "I like alliances built on mutual use, then slowly contaminated by loyalty. Trust should be negotiated through leverage, not confession.",
    },
    {
      questionId: "plot_bias",
      answer:
        "I prefer layered conspiracies, escalating stakes, and hard reversals. Each chapter should produce tactical gain with strategic loss.",
    },
    {
      questionId: "ending_bias",
      answer:
        "I prefer bitter-precise endings: the protagonist wins the war but loses a private world. No perfect closure.",
    },
    {
      questionId: "aesthetic_private_goods",
      answer:
        "I always sneak in decaying cities, ritual scars, coded messages, debt ledgers, cold weather, and courtroom-or-council confrontations. I dislike naive side characters and sudden emotional reconciliation.",
    },
  ],
  targetProject: {
    title: demoProjectTitle,
    premise: demoPremise,
    themeHint: "power, betrayal, and costly redemption",
  },
};

export const demoThemeBible: ThemeBible = {
  coreTheme: "Self-understanding and redemption",
  subThemes: [
    "self-destructive coping",
    "accepting rescue",
    "late honesty",
  ],
  motifs: ["night rain", "old wounds", "medicine"],
  taboos: ["cheap reconciliation", "costless redemption"],
  endingTarget: "A bittersweet ending that still fulfills the theme",
  emotionalDestination: "After understanding himself, the protagonist still chooses to keep living",
};

export const demoStyleBible: StyleBible = {
  narrativeStyle: ["restrained", "detailed", "slow-burn"],
  emotionalStyle: [
    "show emotion through action and setting",
    "use sharper language in emotional breakpoints",
  ],
  dialogueStyle: ["subtext-heavy", "testing", "avoidant"],
  pacingStyle: ["slow setup", "concentrated emotional spikes"],
  imagery: ["night rain", "old wound pain", "medicine bitterness", "caregiving gestures"],
  preferredConflictShapes: ["misreading", "avoidance", "self-denial"],
  preferredClimaxShapes: ["late understanding", "reconciliation with cost"],
  antiPatterns: ["fast reconciliation", "theme exposition monologue"],
};

export const demoStorySetup: StorySetup = {
  premise: demoPremise,
  currentArcGoal:
    "Through daily travel frictions, push the protagonist from habitual self-control toward one small but real act of accepting help.",
  openingSituation:
    "After a tense night on the road, the protagonist and senior brother stop at a temporary inn. On the surface they are handling ordinary chores, but the protagonist keeps hiding a worsening old injury and refuses even low-stakes care.",
  defaultActiveCharacterIds: ["protagonist", "senior_brother"],
  storyOutlineId: "story-outline-demo",
  currentArcId: "arc-1",
};

export const demoStoryOutline: StoryOutline = {
  id: "story-outline-demo",
  title: demoProjectTitle,
  premise: demoPremise,
  coreTheme: demoThemeBible.coreTheme,
  endingTarget: demoThemeBible.endingTarget,
  majorArcIds: ["arc-1"],
  keyTurningPoints: [
    "Small daily incidents repeatedly expose the protagonist's over-control and avoidance.",
    "The senior brother stops arguing in big speeches and starts intervening through practical, ordinary actions.",
    "The protagonist makes a small but meaningful choice to accept help in public, shifting the relationship baseline.",
  ],
};

export const demoArcOutlines: ArcOutline[] = [
  {
    id: "arc-1",
    storyOutlineId: demoStoryOutline.id,
    name: "Daily Friction, Slow Softening",
    arcGoal:
      "Use ordinary co-travel scenes to reveal both the protagonist's likable competence and his stubborn self-denial, then land a believable first step toward shared trust.",
    startState:
      "The protagonist handles everything efficiently, appears reliable, and refuses visible vulnerability.",
    endState:
      "The protagonist still resists dependence, but now accepts one concrete form of help without framing it as defeat.",
    requiredTurns: [
      "A mundane task (meal, medicine, route, lodging) becomes a pressure point for hidden pain.",
      "The protagonist's competence makes him more attractive, but also shows how he isolates himself.",
      "Senior brother switches from confrontation to precise, practical care that cannot be brushed off.",
    ],
    relationshipChanges: [
      "Senior brother moves from verbal pressure to action-based support.",
      "The protagonist's defensive distance gains small cracks rather than dramatic collapse.",
    ],
    memoryRequirements: ["memory-pill-001", "memory-wound-003", "memory-vow-002"],
    beatIds: ["beat-1", "beat-2", "beat-3"],
    primaryPayoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-costly-rescue",
      "payoff-relationship-breakpoint",
    ],
    chapterRangeHint: {
      start: 1,
      end: 3,
    },
  },
];

export const demoBeatOutlines: BeatOutline[] = [
  {
    id: "beat-1",
    arcId: "arc-1",
    order: 1,
    beatGoal:
      "Establish daily co-travel rhythm, show why the protagonist is likable and useful, and quietly plant the hidden injury.",
    conflict:
      "The protagonist keeps things smooth and efficient, while the senior brother notices that this smoothness is also avoidance.",
    expectedChange:
      "The reader understands the duo dynamic through small actions, and sees the first subtle mismatch between reliability and self-neglect.",
    requiredCharacters: ["protagonist", "senior_brother"],
    requiredMemories: ["memory-wound-003", "memory-pill-001", "memory-vow-002"],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-old-setup-payoff",
    ],
    revealTargets: [
      "Protagonist's competence and charm in ordinary interactions",
      "How senior brother reads him better than others do",
      "A small physical or behavioral tell that hints at hidden strain",
    ],
    constraints: [
      "Do not dump the whole backstory.",
      "Do not open with immediate life-or-death escalation.",
    ],
    openingAnchor: {
      readerAnchor: [
        "The protagonist appears capable and collected in ordinary routines.",
        "Tiny mismatches suggest he is hiding pain or exhaustion.",
      ],
      relationshipAnchor: [
        "They are close enough to bicker over details, but still avoid direct honesty.",
      ],
      worldAnchor: [
        "They are hiding in a temporary refuge after pursuit.",
      ],
      hook: "In everyday moments, the protagonist keeps proving he is dependable while quietly proving he is unwell.",
    },
  },
  {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    beatGoal:
      "Increase emotional pressure through daily frictions and force the pair to negotiate boundaries around care and control.",
    conflict:
      "The protagonist insists on handling everything alone, while the senior brother starts using practical interventions instead of arguments.",
    expectedChange:
      "Their tension moves from abstract disagreement to concrete behavior, and each gains clearer leverage over the other.",
    requiredCharacters: ["protagonist", "senior_brother"],
    requiredMemories: ["memory-pill-001", "memory-wound-003", "memory-vow-002"],
    payoffPatternIds: [
      "payoff-costly-rescue",
      "payoff-delayed-confession",
    ],
    revealTargets: [
      "A likable but self-damaging habit in the protagonist",
      "The senior brother's care style under frustration",
    ],
    constraints: [
      "Do not resolve the relationship in a big confession scene.",
    ],
  },
  {
    id: "beat-3",
    arcId: "arc-1",
    order: 3,
    beatGoal:
      "Land one small irreversible trust shift through a concrete everyday decision.",
    conflict:
      "The protagonist must choose between preserving his self-image and accepting practical help in front of someone he cannot fully shut out.",
    expectedChange:
      "A minor but real act of acceptance happens, setting a new baseline for future chapters.",
    requiredCharacters: ["protagonist", "senior_brother"],
    requiredMemories: ["memory-pill-001", "memory-wound-003", "memory-vow-002"],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-relationship-breakpoint",
      "payoff-costly-rescue",
    ],
    revealTargets: [
      "The protagonist can accept a small rescue without full surrender",
      "The pair gains workable, imperfect cooperation",
    ],
    constraints: [
      "Do not jump from small acceptance to complete emotional resolution.",
    ],
  },
];

export const demoCharacterStates: CharacterState[] = [
  {
    id: "protagonist",
    name: "Protagonist",
    archetype: "restrained self-destructive lead",
    coreTraits: ["calm", "stubborn", "over-controlled"],
    desires: ["solve everything alone", "stay composed"],
    fears: ["being seen as weak", "burdening others"],
    wounds: ["old injury that flares under strain", "habit of refusing help"],
    voiceNotes: ["speaks briefly", "downplays his own pain"],
    currentGoals: ["hide the severity of the injury", "avoid exposing the hidden pill"],
    emotionalState: ["tense", "drained", "guarded"],
    knowledgeBoundary: ["knows he still carries a life-saving pill"],
    secretsKept: ["the origin and value of the pill"],
    relationships: [
      {
        targetCharacterId: "senior_brother",
        type: "ally",
        publicLabel: "traveling senior brother",
        privateTruth: "emotionally dependent on him, but unwilling to admit it",
        trustLevel: 72,
        tensionLevel: 81,
        dependencyLevel: 68,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "senior_brother",
    name: "Senior Brother",
    archetype: "protective ally with controlled intensity",
    coreTraits: ["observant", "restrained", "persistent"],
    desires: ["confirm what the protagonist is hiding", "keep him alive"],
    fears: ["losing someone important through hesitation"],
    wounds: ["once lost a companion by acting too late"],
    voiceNotes: ["speaks evenly", "presses truth quietly rather than loudly"],
    currentGoals: ["force the protagonist to accept help"],
    emotionalState: ["suspicious", "worried", "holding back anger"],
    knowledgeBoundary: ["suspects a hidden trump card but does not know what it is"],
    secretsKept: ["is willing to intervene by force if needed"],
    relationships: [
      {
        targetCharacterId: "protagonist",
        type: "ally",
        publicLabel: "traveling junior brother",
        privateTruth: "his protectiveness is no longer neutral",
        trustLevel: 78,
        tensionLevel: 76,
        dependencyLevel: 64,
        lastUpdatedInChapter: 0,
      },
    ],
  },
];

export const demoStoryMemories: StoryMemory[] = [
  {
    id: "memory-pill-001",
    kind: "resource",
    title: "Rare stabilizing pill",
    summary:
      "The protagonist carries a rare stabilizing pill that can quickly suppress injury flare-ups, but using it may expose traces and deepen his psychological dependence on external rescue.",
    ownerCharacterId: "protagonist",
    relatedCharacterIds: ["protagonist"],
    relatedLocationIds: [],
    triggerConditions: ["injury flare-up", "sustained strain", "cannot maintain facade"],
    introducedIn: 12,
    lastReferencedIn: 12,
    status: "active",
    priority: "critical",
    visibility: "private",
    notes: ["Senior Brother does not know this pill exists."],
  },
  {
    id: "memory-wound-003",
    kind: "injury",
    title: "Old injury flare-up",
    summary:
      "The protagonist's old injury worsens quickly after high-intensity combat and affects both movement and judgment.",
    ownerCharacterId: "protagonist",
    relatedCharacterIds: ["protagonist", "senior_brother"],
    relatedLocationIds: [],
    triggerConditions: ["high-intensity combat", "energy overuse", "severe injury"],
    introducedIn: 8,
    lastReferencedIn: 18,
    status: "active",
    priority: "high",
    visibility: "public",
    notes: ["The protagonist habitually hides the severity."],
  },
  {
    id: "memory-vow-002",
    kind: "promise",
    title: "Refusal to owe life-debts again",
    summary:
      "The protagonist has privately vowed not to keep surviving by accepting rescue and debt from others, which drives his resistance to help.",
    ownerCharacterId: "protagonist",
    relatedCharacterIds: ["protagonist"],
    relatedLocationIds: [],
    triggerConditions: ["being forced to accept help", "being cared for"],
    introducedIn: 10,
    lastReferencedIn: 16,
    status: "active",
    priority: "high",
    visibility: "private",
    notes: ["This is a key emotional source of his resistance."],
  },
];

export const demoWorldFacts: WorldFact[] = [
  {
    id: "fact-inn-001",
    category: "location_rule",
    title: "The inn refuge is temporary",
    description:
      "The inn barrier can block tracking only for one night. After dawn, pursuers can lock onto the location again.",
    scope: "local",
    visibility: "public",
    relatedCharacterIds: ["protagonist", "senior_brother"],
    relatedLocationIds: ["inn-room"],
  },
  {
    id: "fact-pill-002",
    category: "resource_rule",
    title: "Using the pill leaves abnormal traces",
    description:
      "The rare pill leaves a traceable pulse after use, increasing long-term exposure risk even when it solves short-term instability.",
    scope: "character_specific",
    visibility: "hidden",
    relatedCharacterIds: ["protagonist"],
    relatedLocationIds: [],
  },
  {
    id: "fact-brother-003",
    category: "character_rule",
    title: "Senior Brother will not stay passive once danger is obvious",
    description:
      "If he confirms the protagonist is collapsing, he will intervene even against resistance.",
    scope: "character_specific",
    visibility: "public",
    relatedCharacterIds: ["senior_brother", "protagonist"],
    relatedLocationIds: [],
  },
];
