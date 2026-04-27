export type EntityId = string;

export type Priority = "low" | "medium" | "high" | "critical";

export type MemoryKind =
  | "event"
  | "resource"
  | "promise"
  | "injury"
  | "clue"
  | "suspense_hook"
  | "long_arc_thread";

export type MemoryStatus =
  | "active"
  | "triggered"
  | "resolved"
  | "expired"
  | "consumed"
  | "hidden";

export type RelationshipType =
  | "family"
  | "friend"
  | "ally"
  | "enemy"
  | "mentor"
  | "student"
  | "lover"
  | "rival"
  | "subordinate"
  | "leader"
  | "unknown";

export type AuthorComponentCategory =
  | "theme"
  | "style"
  | "character"
  | "plot"
  | "relationship"
  | "pacing"
  | "conflict"
  | "ending"
  | "aesthetic"
  | "constraint";

export type AuthorEffectTarget =
  | "planner"
  | "context_builder"
  | "writer"
  | "reviewer"
  | "memory";

export type PayoffPatternCategory =
  | "emotional"
  | "plot"
  | "relationship"
  | "theme";

export type MemorySearchLedgerType =
  | "resource"
  | "promise"
  | "injury"
  | "foreshadow"
  | "relationship";

export type GenrePayoffPackId =
  | "male_webnovel_v1"
  | "female_relationship_v1"
  | "suspense_v1";

export interface ThemeBible {
  coreTheme: string;
  subThemes: string[];
  motifs: string[];
  taboos: string[];
  endingTarget: string;
  emotionalDestination: string;
}

export interface StyleBible {
  narrativeStyle: string[];
  emotionalStyle: string[];
  dialogueStyle: string[];
  pacingStyle: string[];
  imagery: string[];
  preferredConflictShapes: string[];
  preferredClimaxShapes: string[];
  antiPatterns: string[];
}

export interface ConstraintRule {
  id: EntityId;
  name: string;
  description: string;
  severity: Priority;
}

export interface AuthorComponentEffect {
  target: AuthorEffectTarget;
  apply: string[];
  avoid: string[];
}

export interface AuthorComponent {
  id: EntityId;
  name: string;
  category: AuthorComponentCategory;
  description: string;
  strengthens: string[];
  suppresses: string[];
  effects: AuthorComponentEffect[];
  validationHints: string[];
  priority: number;
  enabled: boolean;
}

export interface AuthorProfile {
  id: EntityId;
  name: string;
  summary: string;
  corePreferences: string[];
  aestheticMotifs: string[];
  favoriteCharacterTypes: string[];
  favoriteRelationshipPatterns: string[];
  plotBiases: string[];
  endingBiases: string[];
  components: AuthorComponent[];
  constraints: ConstraintRule[];
}

export interface RelationshipState {
  targetCharacterId: EntityId;
  type: RelationshipType;
  publicLabel: string;
  privateTruth: string;
  trustLevel: number;
  tensionLevel: number;
  dependencyLevel: number;
  lastUpdatedInChapter?: number;
}

export interface CharacterDecisionProfile {
  coreDesire: string;
  coreFear: string;
  falseBelief: string;
  defaultCopingStyle: string;
  controlPattern: string;
  unacceptableCosts: string[];
  likelyCompromises: string[];
  relationshipSoftSpots: string[];
  breakThresholds: string[];
}

export interface CharacterState {
  id: EntityId;
  name: string;
  archetype?: string;
  coreTraits: string[];
  desires: string[];
  fears: string[];
  wounds: string[];
  voiceNotes: string[];
  currentGoals: string[];
  emotionalState: string[];
  knowledgeBoundary: string[];
  secretsKept: string[];
  decisionProfile?: CharacterDecisionProfile;
  relationships: RelationshipState[];
}

export interface WorldFact {
  id: EntityId;
  category: string;
  title: string;
  description: string;
  scope: "global" | "regional" | "local" | "character_specific";
  visibility: "public" | "private" | "hidden";
  relatedCharacterIds: EntityId[];
  relatedLocationIds: EntityId[];
}

export interface StoryMemory {
  id: EntityId;
  kind: MemoryKind;
  title: string;
  summary: string;
  ownerCharacterId?: EntityId;
  relatedCharacterIds: EntityId[];
  relatedLocationIds: EntityId[];
  triggerConditions: string[];
  introducedIn: number;
  lastReferencedIn?: number;
  status: MemoryStatus;
  priority: Priority;
  visibility: "public" | "private" | "hidden";
  notes: string[];
}

export interface PlannerSearchIntent {
  entityIds: EntityId[];
  memoryIds: EntityId[];
  ledgerTypes: MemorySearchLedgerType[];
  topicQueries: string[];
  exactPhrases: string[];
}

export interface ChapterCommercialPlan {
  openingMode?: "hard_hook" | "daily_abnormal" | "relationship_pressure" | "aftermath_hook";
  coreSellPoint: string;
  visibleProblem: string;
  externalTurn: string;
  microPayoff: string;
  endHook: string;
  readerPromise: string;
  paragraphRhythm: "tight" | "balanced" | "slow_burn";
  rewardType?:
    | "proof_win"
    | "countermove"
    | "relationship_pull"
    | "rule_reveal"
    | "status_shift";
  rewardTiming?: "early" | "mid" | "late";
  rewardTarget?: string;
}

export interface ChapterPlan {
  chapterNumber?: number;
  chapterType?: "setup" | "progress" | "payoff" | "aftermath";
  arcId?: EntityId;
  beatId?: EntityId;
  title?: string;
  chapterGoal: string;
  emotionalGoal: string;
  plannedOutcome: string;
  sceneType: string;
  sceneTags: string[];
  requiredCharacters: EntityId[];
  requiredMemories: EntityId[];
  searchIntent?: PlannerSearchIntent;
  commercial?: ChapterCommercialPlan;
  beatConstraints?: string[];
  mustHitConflicts: string[];
  disallowedMoves: string[];
  styleReminders: string[];
  authorComponentIds: EntityId[];
  payoffPatternIds?: EntityId[];
}

export interface StoryOutline {
  id: EntityId;
  title: string;
  premise: string;
  coreTheme: string;
  endingTarget: string;
  majorArcIds: EntityId[];
  keyTurningPoints: string[];
}

export interface GenrePayoffPack {
  id: GenrePayoffPackId;
  name: string;
  summary: string;
  openingModes: Array<NonNullable<ChapterCommercialPlan["openingMode"]>>;
  hookBias: string[];
  microPayoffBias: string[];
  rewardTargetBias: string[];
  avoidPatterns: string[];
  preferredRewardTypes: {
    setup: Array<NonNullable<ChapterCommercialPlan["rewardType"]>>;
    progress: Array<NonNullable<ChapterCommercialPlan["rewardType"]>>;
    payoff: Array<NonNullable<ChapterCommercialPlan["rewardType"]>>;
    aftermath: Array<NonNullable<ChapterCommercialPlan["rewardType"]>>;
  };
}

export interface ArcOutline {
  id: EntityId;
  storyOutlineId?: EntityId;
  name: string;
  arcGoal: string;
  arcSellingPoint?: string;
  arcHook?: string;
  arcPayoff?: string;
  startState: string;
  endState: string;
  requiredTurns: string[];
  primaryPowerPatternIds?: EntityId[];
  relationshipChanges: string[];
  memoryRequirements: EntityId[];
  beatIds: EntityId[];
  primaryPayoffPatternIds?: EntityId[];
  riskNotes?: string[];
  chapterRangeHint?: {
    start: number;
    end: number;
  };
}

export interface BeatOutline {
  id: EntityId;
  arcId: EntityId;
  order: number;
  chapterRangeHint?: {
    start: number;
    end: number;
  };
  beatGoal: string;
  conflict: string;
  expectedChange: string;
  requiredCharacters: EntityId[];
  requiredMemories: EntityId[];
  payoffPatternIds?: EntityId[];
  revealTargets: string[];
  constraints: string[];
  decisionOwnerIds?: EntityId[];
  decisionPressure?: string;
  availableOptions?: string[];
  likelyChoice?: string;
  immediateConsequence?: string;
  delayedConsequence?: string;
  relationshipShift?: string;
  themeShift?: string;
  openingAnchor?: {
    readerAnchor: string[];
    relationshipAnchor: string[];
    worldAnchor: string[];
    hook: string;
  };
}

export interface CastCharacterOutline {
  id: EntityId;
  name: string;
  role: string;
  storyFunction: string;
  relationshipToProtagonist: string;
  relationshipToSeniorBrother?: string;
  coreTension: string;
  intendedArc: string;
  presenceSpan: string;
}

export interface PayoffPattern {
  id: EntityId;
  name: string;
  category: PayoffPatternCategory;
  summary: string;
  readerReward: string;
  whenToUse: string[];
  requiredSetup: string[];
  avoidWhen: string[];
  risks: string[];
  arcUses: string[];
  beatUses: string[];
}

export interface StoryProject {
  id: EntityId;
  title: string;
  description?: string;
  status?: "draft" | "active" | "paused" | "archived";
  premise: string;
  authorProfile: AuthorProfile;
  themeBible: ThemeBible;
  styleBible: StyleBible;
  storySetup: StorySetup;
  storyOutline?: StoryOutline;
  arcOutlines: ArcOutline[];
  beatOutlines: BeatOutline[];
  castOutlines?: CastCharacterOutline[];
  characters: CharacterState[];
  worldFacts: WorldFact[];
  memories: StoryMemory[];
  chapterPlans: ChapterPlan[];
}

export interface StorySetup {
  premise: string;
  currentArcGoal: string;
  openingSituation: string;
  defaultActiveCharacterIds: EntityId[];
  genrePayoffPackId?: GenrePayoffPackId;
  storyOutlineId?: EntityId;
  currentArcId?: EntityId;
}
