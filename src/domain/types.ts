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

export interface ChapterPlan {
  chapterNumber?: number;
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
  storyOutlineId?: EntityId;
  currentArcId?: EntityId;
}
