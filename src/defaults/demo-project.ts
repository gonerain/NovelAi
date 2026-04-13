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
        "I want to write stories about slowly understanding yourself and then deciding whether you can forgive yourself. I like redemption, but never cheap forgiveness.",
    },
    {
      questionId: "character_bias",
      answer:
        "I favor characters who look composed, restrained, even cold, but are already damaged inside. I also like a frail quality, restraint, and stubbornness.",
    },
    {
      questionId: "relationship_pattern",
      answer:
        "I like two people who matter deeply to each other but refuse to say it clearly. The relationship moves through testing, misreading, avoidance, and late confession. Repair must cost something.",
    },
    {
      questionId: "plot_bias",
      answer:
        "I prefer slow burn structure, but when the key scene arrives I want the emotion to hit hard. I like big stories broken into small outcomes that keep moving toward the end without feeling formulaic.",
    },
    {
      questionId: "ending_bias",
      answer:
        "I want endings that are thematic, complete, and striking. They can be bitter, but they must hold. Something can be lost, but the core theme cannot be lost.",
    },
    {
      questionId: "aesthetic_private_goods",
      answer:
        "I always sneak in rain at night, old wounds, medicine, caregiving, and characters pretending they are fine when they are near collapse. I dislike fast reconciliation and tool-like side characters.",
    },
  ],
  targetProject: {
    title: demoProjectTitle,
    premise: demoPremise,
    themeHint: "self-understanding and redemption",
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
    "Force the protagonist to decide whether survival is worth exposing his hidden lifeline and dependence on someone else.",
  openingSituation:
    "After escaping pursuers, the protagonist is badly injured in a temporary inn refuge. His senior brother notices that something is wrong, but the protagonist still tries to hide both the wound and the existence of a last-resort pill.",
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
    "The protagonist is forced to reveal his hidden survival resource.",
    "Trust between the protagonist and senior brother fractures before it can deepen.",
    "The protagonist must choose between secrecy and shared survival.",
  ],
};

export const demoArcOutlines: ArcOutline[] = [
  {
    id: "arc-1",
    storyOutlineId: demoStoryOutline.id,
    name: "The Cost of Survival",
    arcGoal:
      "Push the protagonist from private self-destruction toward a first irreversible act of accepting rescue.",
    startState:
      "The protagonist believes secrecy and self-control are safer than dependence on anyone else.",
    endState:
      "The protagonist survives by exposing a hidden resource, but the relationship with senior brother becomes strained and unstable.",
    requiredTurns: [
      "The hidden wound becomes impossible to conceal.",
      "The pill moves from secret resource to active choice.",
      "Senior brother shifts from suspicion to confirmed knowledge.",
    ],
    relationshipChanges: [
      "Senior brother moves from concern to intervention.",
      "The protagonist's defensive distance turns into visible vulnerability.",
    ],
    memoryRequirements: ["memory-pill-001", "memory-wound-003", "memory-secret-002"],
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
    beatGoal: "Establish the protagonist, the senior brother, the temporary refuge, and the hidden injury.",
    conflict: "The protagonist tries to hold control while the senior brother starts noticing the crack in that control.",
    expectedChange:
      "The reader understands the immediate danger, the relationship tension, and the existence of a hidden resource.",
    requiredCharacters: ["protagonist", "senior_brother"],
    requiredMemories: ["memory-wound-003", "memory-pill-001", "memory-secret-002"],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-old-setup-payoff",
    ],
    revealTargets: [
      "Who the protagonist is in one strong impression",
      "Who the senior brother is relative to him",
      "Why this refuge is temporary and dangerous",
    ],
    constraints: [
      "Do not dump the whole backstory.",
      "Do not treat Chapter 1 like a mid-arc continuation scene.",
    ],
    openingAnchor: {
      readerAnchor: [
        "The protagonist is injured and hiding it.",
        "Senior brother is an ally with emotional authority to intervene.",
      ],
      relationshipAnchor: [
        "They are close enough for tension, but not honest with each other.",
      ],
      worldAnchor: [
        "They are hiding in a temporary refuge after pursuit.",
      ],
      hook: "Before dawn, the protagonist must decide whether survival is worth exposure.",
    },
  },
  {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    beatGoal: "Increase urgency and turn the hidden pill into an unavoidable decision point.",
    conflict:
      "The protagonist's vow against dependence collides with worsening physical collapse and the senior brother's pressure.",
    expectedChange:
      "The protagonist can no longer treat the pill as abstract insurance; it becomes the center of the scene.",
    requiredCharacters: ["protagonist", "senior_brother"],
    requiredMemories: ["memory-pill-001", "memory-wound-003", "memory-secret-002"],
    payoffPatternIds: [
      "payoff-costly-rescue",
      "payoff-delayed-confession",
    ],
    revealTargets: ["The true cost of using the pill", "The emotional source of the protagonist's refusal"],
    constraints: [
      "Do not resolve the decision too early if this beat is used for a middle chapter.",
    ],
  },
  {
    id: "beat-3",
    arcId: "arc-1",
    order: 3,
    beatGoal: "Force the protagonist into an irreversible choice that saves his life but damages trust.",
    conflict:
      "The protagonist must choose between secrecy and survival under immediate threat.",
    expectedChange:
      "The pill is used or revealed, and the senior brother's suspicion becomes knowledge.",
    requiredCharacters: ["protagonist", "senior_brother"],
    requiredMemories: ["memory-pill-001", "memory-wound-003", "memory-secret-002"],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-relationship-breakpoint",
      "payoff-costly-rescue",
    ],
    revealTargets: ["The pill is no longer only hidden", "Trust damage becomes part of the arc state"],
    constraints: [
      "Do not resolve the relationship cleanly in the same beat.",
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
    title: "Unused life-saving pill",
    summary:
      "The protagonist once obtained a rare pill that can keep him alive in a near-death moment. He has not used it yet.",
    ownerCharacterId: "protagonist",
    relatedCharacterIds: ["protagonist"],
    relatedLocationIds: [],
    triggerConditions: ["near death", "severe injury", "cannot escape"],
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
    title: "Using the pill reveals abnormal spiritual traces",
    description:
      "The rare pill releases an abnormal pulse when used, making the user's background and value easier to trace.",
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
