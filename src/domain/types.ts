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

export type StoryContractType =
  | "story_truth"
  | "reader_promise"
  | "genre_contract"
  | "character_arc"
  | "ending_obligation"
  | "forbidden_move";

export type NarrativeThreadType =
  | "plot_threat"
  | "mystery"
  | "relationship"
  | "character_wound"
  | "resource"
  | "world_rule"
  | "promise"
  | "rival_pressure"
  | "theme_argument";

export type NarrativeThreadStatus =
  | "seeded"
  | "active"
  | "intensifying"
  | "paused"
  | "ready_for_payoff"
  | "resolved"
  | "retired";

export type ChapterMode =
  | "seed"
  | "pressure"
  | "investigate"
  | "confront"
  | "payoff"
  | "aftermath"
  | "braid";

export type EpisodePayoffType =
  | "information_reveal"
  | "power_growth"
  | "status_gain"
  | "relationship_shift"
  | "villain_setback"
  | "emotional_impact"
  | "resource_gain"
  | "strategic_reversal";

export type StateDeltaVisibility = "reader_visible" | "character_visible" | "offscreen";

export type StateDeltaTargetType =
  | "character"
  | "relationship"
  | "thread"
  | "contract"
  | "world"
  | "resource"
  | "knowledge";

export type StateDeltaType =
  | "character_state"
  | "relationship_shift"
  | "thread_progress"
  | "contract_progress"
  | "world_fact"
  | "resource_change"
  | "knowledge_change"
  | "memory_change";

export type OffscreenActorType =
  | "antagonist"
  | "rival"
  | "institution"
  | "ally_with_agenda"
  | "social_pressure"
  | "systemic_force";

export type OffscreenMoveType =
  | "advance_plan"
  | "cover_tracks"
  | "pressure_ally"
  | "exploit_resource"
  | "create_deadline"
  | "mislead"
  | "escalate_cost";

export type OffscreenMoveVisibility = "hidden" | "hinted" | "revealed";

export type OffscreenMoveStatus = "pending" | "applied" | "revealed" | "skipped";

export interface OffscreenMove {
  id: EntityId;
  actorId: EntityId;
  actorName: string;
  actorType: OffscreenActorType;
  targetThreadId: EntityId;
  moveType: OffscreenMoveType;
  description: string;
  scheduledChapter: number;
  visibility: OffscreenMoveVisibility;
  expectedRevealWindow: number;
  pressureAdded: number;
  counterplayOpportunity: string;
  status: OffscreenMoveStatus;
  appliedAtChapter?: number;
  revealedAtChapter?: number;
}

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
  decisionProfile: CharacterDecisionProfile;
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
  /**
   * Words and short phrases that the world-builder coined for this
   * fact, e.g. "关系修正机制", "锚点", "失配者". When a reveal that
   * binds to this fact is in `experienced_as_anomaly` or
   * `suspected_as_pattern` mode, the writer must NOT put any of
   * these labels in the POV character's dialogue or interior
   * monologue. They are reference vocabulary for the writer, not
   * the character.
   *
   * Optional. When omitted, `extractLabelVocabularyFromTitle()`
   * provides a heuristic default at read time.
   */
  labelVocabulary?: string[];
  /**
   * The earliest arc id in which this fact's canonical labels may
   * appear verbatim in beat revealTargets / constraints / beatGoal.
   * In beats belonging to arcs that start before this arc, the fact's
   * labelVocabulary is treated as forbidden vocabulary — the beat
   * generator must describe the experiential effect instead.
   *
   * Compared by arc chapterRangeHint.start: an arc whose start chapter
   * is less than minRevealArc's start chapter is "before" it.
   *
   * Optional. When omitted, no restriction is enforced.
   */
  minRevealArc?: string;
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

export interface StoryContract {
  id: EntityId;
  contractType: StoryContractType;
  statement: string;
  readerVisible: boolean;
  createdAtChapter: number;
  dueByChapter?: number;
  priority: Priority;
  evidence: string[];
  forbiddenMoves: string[];
  payoffSignals: string[];
  status: "active" | "fulfilled" | "broken" | "retired";
}

export interface ThreadSchedulerState {
  urgency: number;
  heat: number;
  staleness: number;
  payoffReadiness: number;
  setupDebt: number;
  readerDebt: number;
  agencyPotential: number;
  offscreenPressure: number;
  lastScore?: number;
  lastScoreReasons?: string[];
}

export interface NarrativeThread {
  id: EntityId;
  threadType: NarrativeThreadType;
  title: string;
  ownerCharacterIds: EntityId[];
  introducedChapter: number;
  currentStatus: NarrativeThreadStatus;
  readerQuestion: string;
  pressure: string;
  stakes: string;
  nextUsefulMoves: string[];
  blockedBy: string[];
  payoffConditions: string[];
  payoffTypeOptions: EpisodePayoffType[];
  lastTouchedChapter: number;
  cadenceTarget: "every_chapter" | "frequent" | "periodic" | "slow_burn" | "only_when_hot";
  expectedSpanChapters: number;
  minTouchInterval: number;
  maxDormantChapters: number;
  allowedModes: ChapterMode[];
  relatedContracts: EntityId[];
  scheduler: ThreadSchedulerState;
}

export interface EpisodeThreadUse {
  threadId: EntityId;
  role: "primary" | "supporting";
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface ExpectedStateDelta {
  targetType: StateDeltaTargetType;
  targetId?: EntityId;
  description: string;
  causalWeight: "minor" | "major" | "irreversible";
  visibility: StateDeltaVisibility;
}

export interface StateDeltaContractImpact {
  contractId: EntityId;
  impact: "supports" | "risks" | "violates" | "fulfills";
  note: string;
}

export interface StateDelta {
  id: EntityId;
  chapterNumber: number;
  deltaType: StateDeltaType;
  targetType: StateDeltaTargetType;
  targetId?: EntityId;
  before: string;
  after: string;
  causalWeight: "minor" | "major" | "irreversible";
  visibility: StateDeltaVisibility;
  evidenceSnippet: string;
  confidence: number;
  contractImpact: StateDeltaContractImpact[];
  source: "episode_packet" | "memory_update" | "decision_log" | "relationship_shift" | "consequence_edge";
}

export interface EpisodePacket {
  id: EntityId;
  projectId: EntityId;
  chapterNumber: number;
  generatedAt: string;
  chapterMode: ChapterMode;
  payoffType: EpisodePayoffType;
  primaryThreadId: EntityId;
  activeThreadsUsed: EpisodeThreadUse[];
  primaryChoiceOwner: EntityId;
  agencyOwnerId: EntityId;
  nonTransferableChoice: string;
  tolerableOptions: string[];
  choiceCost: string;
  protagonistConsequence: string;
  readerPayoff: string;
  endHook: string;
  stateDeltasExpected: ExpectedStateDelta[];
  doNotResolve: string[];
  contractIds: EntityId[];
  schedulerWarnings: string[];
  recentConsequences: string[];
  unresolvedDelayedConsequences: string[];
  recentCommercialHistory: string[];
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

/**
 * A single concrete shift in a character's behaviour during an arc.
 *
 * IMPORTANT: do not let this degrade into a free-form sentence ("she
 * goes from passive to active"). Each shift must bind to a specific
 * scene-shaped choice the character makes:
 *
 *  - oldDefault: what their decisionProfile would have produced
 *  - pressureTrigger: the on-page event that forced a different call
 *  - newChoice: the concrete action they actually take
 *  - costPaid: the visible price (info leaked, leverage spent,
 *    relationship damaged, identity exposed)
 *
 * Every entry must populate all four fields. Reviewer fails when any
 * field is empty or generic.
 */
export interface ArcShift {
  id: EntityId;
  oldDefault: string;
  pressureTrigger: string;
  newChoice: string;
  costPaid: string;
  expectedChapterRange?: {
    start: number;
    end: number;
  };
}

export interface ProtagonistArc {
  startInternalState: string;
  endInternalState: string;
  falseBeliefChallenged: string;
  costAccepted: string;
  shifts: ArcShift[];
}

export interface SupportingCharacterArc {
  characterId: EntityId;
  startState: string;
  endState: string;
  shifts: ArcShift[];
}

/**
 * Per-chapter, per-character micro-shift. Same hard rule as
 * `ArcShift`: the four observable fields are mandatory; this is not
 * a one-line slogan. `arcShiftRef` (when set) ties the scene-level
 * change back to its parent `ArcShift.id`.
 */
export interface SceneMicroShift {
  characterId: EntityId;
  arcShiftRef?: EntityId;
  oldDefault: string;
  pressureTrigger: string;
  newChoice: string;
  costPaid: string;
}

export interface SceneOpening {
  entryHook: string;
  situationOnPage: string;
}

export interface SceneMidConflict {
  trigger: string;
  escalation: string;
}

export interface SceneClimax {
  decisionOwnerId: EntityId;
  decisionUnderPressure: string;
  costPaid: string;
}

/**
 * Concrete per-chapter scene plan. Sits between BeatOutline (whole
 * 6-chapter range) and ChapterPlan (LLM-generated planner output).
 * Replaces the old detailed-outline.md template-fill, which copied
 * beat fields into 6 byte-identical rows.
 *
 * Each chapter in a beat gets its OWN entry. Two consecutive
 * chapters must differ structurally (different scene, opening,
 * climax owner, or end hook) — never byte-identical except for
 * chapterNumber.
 */
export interface ChapterScenePlan {
  chapterNumber: number;
  beatId: EntityId;
  arcId?: EntityId;
  pov: EntityId;
  location: string;
  propsAndAnchors: string[];
  openingScene: SceneOpening;
  midConflict: SceneMidConflict;
  climax: SceneClimax;
  endHook: string;
  /** Reveal item ids that must land in this chapter. */
  dueRevealIds: EntityId[];
  /**
   * Per-character micro-shifts that actually happen in this
   * chapter. Skip characters who only observe.
   */
  characterArcMicroShift: SceneMicroShift[];
  /** Optional state delta hints for downstream extraction. */
  expectedDeltas?: string[];
  /**
   * Concrete observable gain for the protagonist in this chapter.
   * Must be a real on-page acquisition: information learned, leverage
   * kept, a loophole observed, an ally protected. NOT an emotion.
   * Set to null when this chapter intentionally serves the "cost/loss"
   * side of the two-chapter pairing — but every pair (ch1-2, ch3-4,
   * ch5-6) must have at least one non-null entry.
   */
  protagonistGain?: string | null;
  /** Optional source: where this scene plan came from (LLM / human / fallback). */
  source?: "llm" | "human" | "fallback";
  generatedAt?: string;
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
  /**
   * Internal-state arc for the protagonist during this arc. Optional
   * during the migration window — projects bootstrapped before
   * Phase 13.B will not have it. New projects must populate it.
   */
  protagonistArc?: ProtagonistArc;
  /**
   * Per-supporting-character arcs for characters that actually grow
   * during this arc. Do NOT pad with placeholder entries for
   * characters who only observe.
   */
  supportingCharacterArcs?: SupportingCharacterArc[];
}

/**
 * One reveal that the story owes the reader by a specific chapter.
 *
 * Existing projects only have `BeatOutline.revealTargets: string[]`,
 * which is a free-text wishlist that nothing enforces. `RevealItem`
 * upgrades each entry into a typed promise with a hard due chapter
 * and a severity. Reviewer fails when a `severityIfMissed === "hard"`
 * reveal is past its dueChapter without landing.
 *
 * `id` should be stable across regenerations so `dueRevealIds` on a
 * `ChapterScenePlan` can refer back. `text` is the natural-language
 * payload the writer must enact on-page; `refId` (optional) ties it
 * to a `WorldFact` / `StoryMemory` / `NarrativeThread` / character
 * id when the reveal is actually about an existing artifact.
 */
/**
 * How a reveal is meant to land on-page at its dueChapter.
 *
 *   experienced_as_anomaly — POV character feels something is wrong
 *     but cannot name the rule. Reads anomalies through their
 *     existing frame (gaslighting, family pressure, coincidence,
 *     own perception failing). Forbidden to articulate the world-
 *     fact in dialogue or interior monologue.
 *
 *   suspected_as_pattern — POV character has noticed enough
 *     anomalies to suspect a pattern, but still does not have the
 *     world-builder's terminology. May coin a private placeholder
 *     name; may NOT use the canonical labelVocabulary.
 *
 *   named_explicitly — the rule is openly discussed; canonical
 *     labelVocabulary is now allowed in dialogue / monologue.
 *
 * Default for synthesized RevealItems is `experienced_as_anomaly`.
 * Use `bible escalate-reveal-modes` (TODO) to lift later-arc
 * reveals automatically.
 */
export type RevealMode =
  | "experienced_as_anomaly"
  | "suspected_as_pattern"
  | "named_explicitly";

export interface RevealItem {
  id: EntityId;
  kind: "world_fact" | "memory" | "character_truth" | "thread_setup" | "relationship_truth";
  refId?: EntityId;
  text: string;
  dueChapter: number;
  severityIfMissed: "soft" | "hard";
  /**
   * How the reveal should land at this dueChapter. When omitted,
   * `experienced_as_anomaly` is assumed for synthesized reveals.
   */
  revealMode?: RevealMode;
  /** Set after the reviewer confirms the reveal landed on-page. */
  landedInChapter?: number;
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
  /**
   * Typed reveal contracts. Optional during the migration window:
   * legacy beats may have only `revealTargets: string[]`. Use
   * `getEffectiveRevealItems(beat)` from `domain/reveal-item.ts` to
   * read; that helper synthesizes a soft RevealItem[] from
   * `revealTargets` when this field is missing.
   */
  revealItems?: RevealItem[];
  /**
   * WorldFact ids this beat owns — i.e. facts that should surface
   * (or be set up to surface) somewhere in the beat's chapter
   * range. Used to drive `bible inspect-fact-coverage` and to give
   * the writer the full WorldFact description when a `world_fact`
   * RevealItem points at a known fact.
   *
   * Optional during migration. `getWorldFactsForBeat(beat, facts)`
   * in `domain/world-fact-binding.ts` is the canonical reader; it
   * unions explicit `worldFactIds` with reveals carrying
   * `kind === "world_fact"` and a resolvable `refId`.
   */
  worldFactIds?: EntityId[];
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
  /**
   * Optional task-driven annotations layered on top of the existing beat
   * shape. Lives in src/domain/beat-annotations.ts. Existing data without
   * this field stays valid; the writer prompt only elevates these signals
   * when present.
   */
  annotations?: import("./beat-annotations.js").BeatAnnotations;
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
  storyContracts?: StoryContract[];
  narrativeThreads?: NarrativeThread[];
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
