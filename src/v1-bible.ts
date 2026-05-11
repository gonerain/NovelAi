import {
  bindRevealItemsToWorldFacts,
  buildDerivedAuthorProfilePacks,
  describeFactCoverage,
  describeRevealStatus,
  emptyDecisionProfile,
  findDecisionProfileGap,
  findIdenticalConsecutiveScenes,
  getEffectiveRevealItems,
  isDecisionProfileEmpty,
  validateArcShiftsForArc,
  validateCharacterDecisionProfileCoverage,
  validateScenePlans,
  type ArcOutline,
  type ArcShift,
  type BeatOutline,
  type ChapterScenePlan,
  type CharacterDecisionProfile,
  type CharacterState,
  type ProtagonistArc,
  type RevealItem,
  type SceneMicroShift,
  type StoryOutline,
  type SupportingCharacterArc,
  type ThemeBible,
  type WorldFact,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import {
  arcShiftDeriveResultSchema,
  buildArcShiftDeriveMessages,
} from "./prompts/arc-shift.js";
import {
  buildDecisionProfileMessages,
  decisionProfileGenerationResultSchema,
} from "./prompts/decision-profile.js";
import {
  buildSceneDecomposerMessages,
  sceneDecomposerResultSchema,
} from "./prompts/scene-decomposer.js";
import { FileProjectRepository } from "./storage/index.js";
import { writePromptDebug } from "./v1-artifacts.js";

export interface FillDecisionProfilesOptions {
  projectId: string;
  serviceFactory?: () => LlmService;
  repository?: FileProjectRepository;
  logStage?: (stage: string, detail: string) => void;
  /**
   * If true, regenerate even when a profile already looks populated.
   * Default false (idempotent: only fill empty / missing).
   */
  force?: boolean;
}

export interface FillDecisionProfilesResult {
  projectId: string;
  filledCharacterIds: string[];
  skippedCharacterIds: string[];
  missingAfterRunCharacterIds: string[];
  warnings: string[];
}

function pickPlannerAuthorPack(
  packs: Awaited<ReturnType<FileProjectRepository["loadDerivedAuthorProfilePacks"]>>,
) {
  if (!packs) {
    return null;
  }
  return packs.planner;
}

function sanitizeProfile(raw: CharacterDecisionProfile | undefined | null): CharacterDecisionProfile {
  const fallback = emptyDecisionProfile();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const cleanedString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

  const cleanedArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") {
        continue;
      }
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      result.push(trimmed);
      if (result.length >= 4) {
        break;
      }
    }
    return result;
  };

  return {
    coreDesire: cleanedString(raw.coreDesire) || fallback.coreDesire,
    coreFear: cleanedString(raw.coreFear) || fallback.coreFear,
    falseBelief: cleanedString(raw.falseBelief) || fallback.falseBelief,
    defaultCopingStyle:
      cleanedString(raw.defaultCopingStyle) || fallback.defaultCopingStyle,
    controlPattern: cleanedString(raw.controlPattern) || fallback.controlPattern,
    unacceptableCosts: cleanedArray(raw.unacceptableCosts),
    likelyCompromises: cleanedArray(raw.likelyCompromises),
    relationshipSoftSpots: cleanedArray(raw.relationshipSoftSpots),
    breakThresholds: cleanedArray(raw.breakThresholds),
  };
}

export async function fillDecisionProfilesForProject(
  options: FillDecisionProfilesOptions,
): Promise<FillDecisionProfilesResult> {
  const repository = options.repository ?? new FileProjectRepository();
  const log = options.logStage ?? (() => {});

  const characterStates = await repository.loadCharacterStates(options.projectId);
  if (characterStates.length === 0) {
    return {
      projectId: options.projectId,
      filledCharacterIds: [],
      skippedCharacterIds: [],
      missingAfterRunCharacterIds: [],
      warnings: ["No character states found; bootstrap project first."],
    };
  }

  const targets = options.force
    ? characterStates
    : characterStates.filter(
        (state) => isDecisionProfileEmpty(state.decisionProfile) || findDecisionProfileGap(state) !== null,
      );

  if (targets.length === 0) {
    return {
      projectId: options.projectId,
      filledCharacterIds: [],
      skippedCharacterIds: characterStates.map((state) => state.id),
      missingAfterRunCharacterIds: [],
      warnings: [],
    };
  }

  const authorProfile = await repository.loadAuthorProfile(options.projectId);
  if (!authorProfile) {
    throw new Error(
      `Author profile missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const loadedPacks = await repository.loadDerivedAuthorProfilePacks(options.projectId);
  const authorPacks = loadedPacks ?? buildDerivedAuthorProfilePacks(authorProfile);
  if (!loadedPacks) {
    await repository.saveDerivedAuthorProfilePacks(options.projectId, authorPacks);
  }
  const plannerPack = pickPlannerAuthorPack(authorPacks);
  if (!plannerPack) {
    throw new Error("Planner author pack unavailable; cannot prompt decision profile.");
  }

  const themeBible: ThemeBible | null = await repository.loadThemeBible(options.projectId);
  if (!themeBible) {
    throw new Error(
      `Theme bible missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const storyOutline: StoryOutline | null = await repository.loadStoryOutline(options.projectId);
  const storySetup = await repository.loadStorySetup(options.projectId);
  const premise = storySetup?.premise ?? storyOutline?.premise ?? "";

  const service = (options.serviceFactory ?? (() => new LlmService()))();

  const filledIds: string[] = [];
  const warnings: string[] = [];
  const updatedStates: CharacterState[] = [...characterStates];

  for (const character of targets) {
    log("bible", `decision_profile fill character=${character.id}`);
    const messages = buildDecisionProfileMessages({
      character,
      authorPack: plannerPack,
      themeBible,
      storyOutline: storyOutline ?? undefined,
      premise,
    });
    await writePromptDebug({
      projectId: options.projectId,
      scope: "outline",
      label: `decision_profile_${character.id}`,
      messages,
    });
    try {
      const result = await service.generateObjectForTask({
        task: "cast_decision_profile",
        messages,
        schema: decisionProfileGenerationResultSchema,
        temperature: 0.3,
        maxTokens: 1400,
      });
      const sanitized = sanitizeProfile(result.object.decisionProfile);
      const index = updatedStates.findIndex((state) => state.id === character.id);
      if (index >= 0) {
        updatedStates[index] = { ...updatedStates[index]!, decisionProfile: sanitized };
        filledIds.push(character.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`character=${character.id}: ${message}`);
      log("bible", `WARN decision_profile fill failed character=${character.id}: ${message}`);
    }
  }

  if (filledIds.length > 0) {
    await repository.saveCharacterStates(options.projectId, updatedStates);
  }

  const remainingGaps = validateCharacterDecisionProfileCoverage(updatedStates);

  return {
    projectId: options.projectId,
    filledCharacterIds: filledIds,
    skippedCharacterIds: characterStates
      .filter((state) => !targets.some((target) => target.id === state.id))
      .map((state) => state.id),
    missingAfterRunCharacterIds: remainingGaps.map((gap) => gap.characterId),
    warnings,
  };
}

export function formatFillDecisionProfilesResult(result: FillDecisionProfilesResult): string {
  const lines = [`Decision profile fill — project=${result.projectId}`];
  lines.push(`  filled: ${result.filledCharacterIds.length}`);
  if (result.filledCharacterIds.length > 0) {
    lines.push(`    ${result.filledCharacterIds.join(", ")}`);
  }
  lines.push(`  already populated (skipped): ${result.skippedCharacterIds.length}`);
  if (result.missingAfterRunCharacterIds.length > 0) {
    lines.push(
      `  still missing after run: ${result.missingAfterRunCharacterIds.join(", ")}`,
    );
  }
  if (result.warnings.length > 0) {
    lines.push("  warnings:");
    for (const warning of result.warnings) {
      lines.push(`    - ${warning}`);
    }
  }
  return lines.join("\n");
}

export interface DeriveArcShiftsOptions {
  projectId: string;
  serviceFactory?: () => LlmService;
  repository?: FileProjectRepository;
  logStage?: (stage: string, detail: string) => void;
  /**
   * If true, regenerate even arcs that already have populated
   * protagonistArc + valid shifts. Default false.
   */
  force?: boolean;
}

export interface DeriveArcShiftsResult {
  projectId: string;
  filledArcIds: string[];
  skippedArcIds: string[];
  remainingIssues: Array<{
    arcId: string;
    reason: string;
  }>;
  warnings: string[];
}

function clampShifts(shifts: unknown, fallbackArcId: string): ArcShift[] {
  if (!Array.isArray(shifts)) {
    return [];
  }
  const result: ArcShift[] = [];
  let counter = 1;
  for (const raw of shifts) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const r = raw as Record<string, unknown>;
    const oldDefault = typeof r.oldDefault === "string" ? r.oldDefault.trim() : "";
    const pressureTrigger =
      typeof r.pressureTrigger === "string" ? r.pressureTrigger.trim() : "";
    const newChoice = typeof r.newChoice === "string" ? r.newChoice.trim() : "";
    const costPaid = typeof r.costPaid === "string" ? r.costPaid.trim() : "";
    if (!oldDefault || !pressureTrigger || !newChoice || !costPaid) {
      continue;
    }
    const idValue =
      typeof r.id === "string" && r.id.trim().length > 0
        ? r.id.trim()
        : `shift_${fallbackArcId}_${String(counter).padStart(2, "0")}`;
    let expectedChapterRange: ArcShift["expectedChapterRange"];
    const range = r.expectedChapterRange;
    if (
      range &&
      typeof range === "object" &&
      typeof (range as { start?: unknown }).start === "number" &&
      typeof (range as { end?: unknown }).end === "number"
    ) {
      const start = (range as { start: number }).start;
      const end = (range as { end: number }).end;
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        expectedChapterRange = { start, end };
      }
    }
    result.push({
      id: idValue,
      oldDefault,
      pressureTrigger,
      newChoice,
      costPaid,
      ...(expectedChapterRange ? { expectedChapterRange } : {}),
    });
    counter += 1;
  }
  return result;
}

function clampProtagonistArc(raw: unknown, arcId: string): ProtagonistArc | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const start = typeof r.startInternalState === "string" ? r.startInternalState.trim() : "";
  const end = typeof r.endInternalState === "string" ? r.endInternalState.trim() : "";
  const falseBelief =
    typeof r.falseBeliefChallenged === "string" ? r.falseBeliefChallenged.trim() : "";
  const cost = typeof r.costAccepted === "string" ? r.costAccepted.trim() : "";
  const shifts = clampShifts(r.shifts, arcId);
  if (!start || !end || !falseBelief || !cost || shifts.length === 0) {
    return null;
  }
  return {
    startInternalState: start,
    endInternalState: end,
    falseBeliefChallenged: falseBelief,
    costAccepted: cost,
    shifts,
  };
}

function clampSupportingArcs(
  raw: unknown,
  arcId: string,
  knownCharacterIds: Set<string>,
): SupportingCharacterArc[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: SupportingCharacterArc[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const r = item as Record<string, unknown>;
    const characterId = typeof r.characterId === "string" ? r.characterId.trim() : "";
    if (!characterId || !knownCharacterIds.has(characterId)) {
      continue;
    }
    const startState = typeof r.startState === "string" ? r.startState.trim() : "";
    const endState = typeof r.endState === "string" ? r.endState.trim() : "";
    const shifts = clampShifts(r.shifts, `${arcId}_${characterId}`);
    if (!startState || !endState || shifts.length === 0) {
      continue;
    }
    result.push({
      characterId,
      startState,
      endState,
      shifts,
    });
  }
  return result;
}

function arcNeedsDerivation(arc: ArcOutline): boolean {
  const coverage = validateArcShiftsForArc(arc);
  return (
    coverage.protagonistArcMissing ||
    coverage.protagonistShiftIssues.length > 0
  );
}

export async function deriveArcShiftsForProject(
  options: DeriveArcShiftsOptions,
): Promise<DeriveArcShiftsResult> {
  const repository = options.repository ?? new FileProjectRepository();
  const log = options.logStage ?? (() => {});

  const arcs = await repository.loadArcOutlines(options.projectId);
  if (arcs.length === 0) {
    return {
      projectId: options.projectId,
      filledArcIds: [],
      skippedArcIds: [],
      remainingIssues: [],
      warnings: ["No arc outlines found; bootstrap project first."],
    };
  }

  const targets = options.force
    ? arcs
    : arcs.filter((arc) => arcNeedsDerivation(arc));
  if (targets.length === 0) {
    return {
      projectId: options.projectId,
      filledArcIds: [],
      skippedArcIds: arcs.map((arc) => arc.id),
      remainingIssues: [],
      warnings: [],
    };
  }

  const characterStates = await repository.loadCharacterStates(options.projectId);
  if (characterStates.length === 0) {
    throw new Error(
      `Character states missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const protagonist =
    characterStates.find((state) => state.id === "protagonist") ?? characterStates[0]!;
  const knownCharacterIds = new Set(characterStates.map((state) => state.id));

  const authorProfile = await repository.loadAuthorProfile(options.projectId);
  if (!authorProfile) {
    throw new Error(
      `Author profile missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const loadedPacks = await repository.loadDerivedAuthorProfilePacks(options.projectId);
  const authorPacks = loadedPacks ?? buildDerivedAuthorProfilePacks(authorProfile);
  if (!loadedPacks) {
    await repository.saveDerivedAuthorProfilePacks(options.projectId, authorPacks);
  }
  const plannerPack = authorPacks.planner;

  const themeBible = await repository.loadThemeBible(options.projectId);
  if (!themeBible) {
    throw new Error(
      `Theme bible missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const storyOutline = await repository.loadStoryOutline(options.projectId);

  const service = (options.serviceFactory ?? (() => new LlmService()))();
  const filledArcIds: string[] = [];
  const warnings: string[] = [];
  const updatedArcs: ArcOutline[] = [...arcs];

  for (const arc of targets) {
    log("bible", `arc_shift derive arc=${arc.id}`);
    const supportingCharacters = characterStates.filter(
      (state) => state.id !== protagonist.id,
    );
    const messages = buildArcShiftDeriveMessages({
      arc,
      protagonist,
      supportingCharacters,
      authorPack: plannerPack,
      themeBible,
      storyOutline: storyOutline ?? undefined,
    });
    await writePromptDebug({
      projectId: options.projectId,
      scope: "outline",
      label: `arc_shift_${arc.id}`,
      messages,
    });
    try {
      const result = await service.generateObjectForTask({
        task: "arc_shift_derive",
        messages,
        schema: arcShiftDeriveResultSchema,
        temperature: 0.3,
        maxTokens: 2400,
      });
      const protagonistArc = clampProtagonistArc(result.object.protagonistArc, arc.id);
      const supportingCharacterArcs = clampSupportingArcs(
        result.object.supportingCharacterArcs,
        arc.id,
        knownCharacterIds,
      );
      if (!protagonistArc) {
        warnings.push(
          `arc=${arc.id}: protagonistArc missing required fields after sanitization`,
        );
        continue;
      }
      const index = updatedArcs.findIndex((item) => item.id === arc.id);
      if (index >= 0) {
        updatedArcs[index] = {
          ...updatedArcs[index]!,
          protagonistArc,
          supportingCharacterArcs,
        };
        filledArcIds.push(arc.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`arc=${arc.id}: ${message}`);
      log("bible", `WARN arc_shift derive failed arc=${arc.id}: ${message}`);
    }
  }

  if (filledArcIds.length > 0) {
    await repository.saveArcOutlines(options.projectId, updatedArcs);
  }

  const remainingIssues: DeriveArcShiftsResult["remainingIssues"] = [];
  for (const arc of updatedArcs) {
    const coverage = validateArcShiftsForArc(arc);
    if (coverage.protagonistArcMissing) {
      remainingIssues.push({ arcId: arc.id, reason: "protagonistArc missing" });
      continue;
    }
    if (coverage.protagonistShiftIssues.length > 0) {
      remainingIssues.push({
        arcId: arc.id,
        reason: `${coverage.protagonistShiftIssues.length} shift issue(s)`,
      });
    }
  }

  return {
    projectId: options.projectId,
    filledArcIds,
    skippedArcIds: arcs
      .filter((arc) => !targets.some((target) => target.id === arc.id))
      .map((arc) => arc.id),
    remainingIssues,
    warnings,
  };
}

export function formatDeriveArcShiftsResult(result: DeriveArcShiftsResult): string {
  const lines = [`Arc shift derive — project=${result.projectId}`];
  lines.push(`  filled: ${result.filledArcIds.length}`);
  if (result.filledArcIds.length > 0) {
    lines.push(`    ${result.filledArcIds.join(", ")}`);
  }
  lines.push(`  already populated (skipped): ${result.skippedArcIds.length}`);
  if (result.remainingIssues.length > 0) {
    lines.push("  remaining issues:");
    for (const issue of result.remainingIssues) {
      lines.push(`    - arc=${issue.arcId}: ${issue.reason}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("  warnings:");
    for (const warning of result.warnings) {
      lines.push(`    - ${warning}`);
    }
  }
  return lines.join("\n");
}

export interface DecomposeChapterScenesOptions {
  projectId: string;
  /** When omitted, decomposes scene plans for every beat with chapterRangeHint. */
  beatId?: string;
  serviceFactory?: () => LlmService;
  repository?: FileProjectRepository;
  logStage?: (stage: string, detail: string) => void;
  /** Force regeneration even when scene plans already cover the beat. */
  force?: boolean;
}

export interface DecomposeChapterScenesResult {
  projectId: string;
  beatsProcessed: string[];
  beatsSkipped: string[];
  scenePlanCount: number;
  identicalConsecutivePairs: Array<{
    beatId: string;
    earlierChapter: number;
    laterChapter: number;
    identicalFields: string[];
  }>;
  scaffoldIssueCount: number;
  microShiftIssueCount: number;
  warnings: string[];
}

function resolveCharacterId(
  raw: string,
  knownCharacterIds: Set<string>,
  nameToId: Map<string, string>,
): string {
  const trimmed = raw.trim();
  if (knownCharacterIds.has(trimmed)) {
    return trimmed;
  }
  const mapped = nameToId.get(trimmed);
  if (mapped) {
    return mapped;
  }
  return "";
}

function clampSceneMicroShift(
  raw: unknown,
  knownCharacterIds: Set<string>,
  knownArcShiftIds: Set<string>,
  nameToId: Map<string, string>,
): SceneMicroShift | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const rawCharacterId = typeof r.characterId === "string" ? r.characterId : "";
  const characterId = resolveCharacterId(rawCharacterId, knownCharacterIds, nameToId);
  if (!characterId) {
    return null;
  }
  const oldDefault = typeof r.oldDefault === "string" ? r.oldDefault.trim() : "";
  const pressureTrigger =
    typeof r.pressureTrigger === "string" ? r.pressureTrigger.trim() : "";
  const newChoice = typeof r.newChoice === "string" ? r.newChoice.trim() : "";
  const costPaid = typeof r.costPaid === "string" ? r.costPaid.trim() : "";
  if (!oldDefault || !pressureTrigger || !newChoice || !costPaid) {
    return null;
  }
  const arcShiftRefRaw =
    typeof r.arcShiftRef === "string" ? r.arcShiftRef.trim() : "";
  const arcShiftRef =
    arcShiftRefRaw && knownArcShiftIds.has(arcShiftRefRaw)
      ? arcShiftRefRaw
      : undefined;
  return {
    characterId,
    ...(arcShiftRef ? { arcShiftRef } : {}),
    oldDefault,
    pressureTrigger,
    newChoice,
    costPaid,
  };
}

function clampScenePlan(
  raw: unknown,
  context: {
    arcId: string;
    beatId: string;
    chapterRange: { start: number; end: number };
    knownCharacterIds: Set<string>;
    knownArcShiftIds: Set<string>;
    knownRevealIds: Set<string>;
    nameToId: Map<string, string>;
  },
): ChapterScenePlan | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const chapterNumber = typeof r.chapterNumber === "number" ? r.chapterNumber : NaN;
  if (
    !Number.isFinite(chapterNumber) ||
    chapterNumber < context.chapterRange.start ||
    chapterNumber > context.chapterRange.end
  ) {
    return null;
  }
  const rawPov = typeof r.pov === "string" ? r.pov : "";
  const pov = resolveCharacterId(rawPov, context.knownCharacterIds, context.nameToId) || rawPov.trim();
  const location = typeof r.location === "string" ? r.location.trim() : "";
  const propsAndAnchorsRaw = Array.isArray(r.propsAndAnchors)
    ? r.propsAndAnchors.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
  const opening = (r.openingScene ?? {}) as Record<string, unknown>;
  const mid = (r.midConflict ?? {}) as Record<string, unknown>;
  const climax = (r.climax ?? {}) as Record<string, unknown>;
  const endHook = typeof r.endHook === "string" ? r.endHook.trim() : "";
  const dueRevealIds = Array.isArray(r.dueRevealIds)
    ? r.dueRevealIds
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .filter((item) =>
          context.knownRevealIds.size === 0 ? true : context.knownRevealIds.has(item),
        )
    : [];
  const microShifts = Array.isArray(r.characterArcMicroShift)
    ? (r.characterArcMicroShift
        .map((shift) =>
          clampSceneMicroShift(
            shift,
            context.knownCharacterIds,
            context.knownArcShiftIds,
            context.nameToId,
          ),
        )
        .filter((shift): shift is SceneMicroShift => shift !== null) as SceneMicroShift[])
    : [];
  const expectedDeltas = Array.isArray(r.expectedDeltas)
    ? r.expectedDeltas.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];

  return {
    chapterNumber,
    arcId: context.arcId,
    beatId: context.beatId,
    pov,
    location,
    propsAndAnchors: propsAndAnchorsRaw,
    openingScene: {
      entryHook: typeof opening.entryHook === "string" ? opening.entryHook.trim() : "",
      situationOnPage:
        typeof opening.situationOnPage === "string" ? opening.situationOnPage.trim() : "",
    },
    midConflict: {
      trigger: typeof mid.trigger === "string" ? mid.trigger.trim() : "",
      escalation: typeof mid.escalation === "string" ? mid.escalation.trim() : "",
    },
    climax: {
      decisionOwnerId: (() => {
        const raw = typeof climax.decisionOwnerId === "string" ? climax.decisionOwnerId : "";
        const resolved = resolveCharacterId(raw, context.knownCharacterIds, context.nameToId);
        return resolved || raw.trim();
      })(),
      decisionUnderPressure:
        typeof climax.decisionUnderPressure === "string"
          ? climax.decisionUnderPressure.trim()
          : "",
      costPaid: typeof climax.costPaid === "string" ? climax.costPaid.trim() : "",
    },
    endHook,
    protagonistGain: typeof r.protagonistGain === "string" ? r.protagonistGain.trim() : null,
    advancingTaskIds: Array.isArray(r.advancingTaskIds)
      ? r.advancingTaskIds.filter((item): item is string => typeof item === "string")
      : [],
    heldTaskIds: Array.isArray(r.heldTaskIds)
      ? r.heldTaskIds.filter((item): item is string => typeof item === "string")
      : [],
    characterDecisionArc: (() => {
      const arc = r.characterDecisionArc as Record<string, unknown> | undefined;
      if (!arc || typeof arc !== "object") return undefined;
      const str = (k: string) => (typeof arc[k] === "string" ? (arc[k] as string).trim() : "");
      return {
        desire: str("desire"),
        misjudgment: str("misjudgment"),
        activeCounter: str("activeCounter"),
        forcedChoice: str("forcedChoice"),
        costPaid: str("costPaid"),
        downstreamImpact: str("downstreamImpact"),
      };
    })(),
    dueRevealIds,
    characterArcMicroShift: microShifts,
    expectedDeltas,
    source: "llm",
    generatedAt: new Date().toISOString(),
  };
}

function gatherKnownArcShiftIds(arc: ArcOutline): Set<string> {
  const ids = new Set<string>();
  for (const shift of arc.protagonistArc?.shifts ?? []) {
    if (shift.id) ids.add(shift.id);
  }
  for (const supportingArc of arc.supportingCharacterArcs ?? []) {
    for (const shift of supportingArc.shifts ?? []) {
      if (shift.id) ids.add(shift.id);
    }
  }
  return ids;
}

function defaultBeatChapterRange(beat: BeatOutline, arc: ArcOutline | undefined) {
  if (beat.chapterRangeHint) {
    return beat.chapterRangeHint;
  }
  if (arc?.chapterRangeHint) {
    return arc.chapterRangeHint;
  }
  return null;
}

export async function decomposeChapterScenesForProject(
  options: DecomposeChapterScenesOptions,
): Promise<DecomposeChapterScenesResult> {
  const repository = options.repository ?? new FileProjectRepository();
  const log = options.logStage ?? (() => {});

  const beats = await repository.loadBeatOutlines(options.projectId);
  const arcs = await repository.loadArcOutlines(options.projectId);
  if (beats.length === 0 || arcs.length === 0) {
    return {
      projectId: options.projectId,
      beatsProcessed: [],
      beatsSkipped: [],
      scenePlanCount: 0,
      identicalConsecutivePairs: [],
      scaffoldIssueCount: 0,
      microShiftIssueCount: 0,
      warnings: ["No beats or arcs found; bootstrap project first."],
    };
  }

  const targetBeats = options.beatId
    ? beats.filter((beat) => beat.id === options.beatId)
    : beats;
  if (targetBeats.length === 0) {
    return {
      projectId: options.projectId,
      beatsProcessed: [],
      beatsSkipped: beats.map((beat) => beat.id),
      scenePlanCount: 0,
      identicalConsecutivePairs: [],
      scaffoldIssueCount: 0,
      microShiftIssueCount: 0,
      warnings: [`No beat matched id=${options.beatId ?? ""}`],
    };
  }

  const characterStates = await repository.loadCharacterStates(options.projectId);
  if (characterStates.length === 0) {
    throw new Error(
      `Character states missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const protagonist =
    characterStates.find((state) => state.id === "protagonist") ?? characterStates[0]!;
  const knownCharacterIds = new Set(characterStates.map((state) => state.id));
  const nameToId = new Map<string, string>();
  for (const state of characterStates) {
    if (state.name && state.name.trim().length > 0) {
      nameToId.set(state.name.trim(), state.id);
    }
  }

  const authorProfile = await repository.loadAuthorProfile(options.projectId);
  if (!authorProfile) {
    throw new Error(
      `Author profile missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const loadedPacks = await repository.loadDerivedAuthorProfilePacks(options.projectId);
  const authorPacks = loadedPacks ?? buildDerivedAuthorProfilePacks(authorProfile);
  if (!loadedPacks) {
    await repository.saveDerivedAuthorProfilePacks(options.projectId, authorPacks);
  }
  const plannerPack = authorPacks.planner;

  const themeBible = await repository.loadThemeBible(options.projectId);
  if (!themeBible) {
    throw new Error(
      `Theme bible missing for project=${options.projectId}; run project:bootstrap first.`,
    );
  }
  const storyOutline = await repository.loadStoryOutline(options.projectId);
  const worldFacts = await repository.loadWorldFacts(options.projectId);

  const existingPlans = await repository.loadChapterScenePlans(options.projectId);
  const planByChapter = new Map<number, ChapterScenePlan>();
  for (const plan of existingPlans) {
    planByChapter.set(plan.chapterNumber, plan);
  }

  const service = (options.serviceFactory ?? (() => new LlmService()))();
  const beatsProcessed: string[] = [];
  const beatsSkipped: string[] = [];
  const warnings: string[] = [];

  for (const beat of targetBeats) {
    const arc = arcs.find((item) => item.id === beat.arcId);
    const range = defaultBeatChapterRange(beat, arc);
    if (!range) {
      warnings.push(`beat=${beat.id}: no chapterRangeHint on beat or arc`);
      beatsSkipped.push(beat.id);
      continue;
    }
    const chaptersInRange: number[] = [];
    for (let chapter = range.start; chapter <= range.end; chapter += 1) {
      chaptersInRange.push(chapter);
    }
    const alreadyCovered = chaptersInRange.every((chapter) => {
      const existing = planByChapter.get(chapter);
      return existing && existing.beatId === beat.id;
    });
    if (alreadyCovered && !options.force) {
      beatsSkipped.push(beat.id);
      continue;
    }

    const knownArcShiftIds = arc ? gatherKnownArcShiftIds(arc) : new Set<string>();
    const beatRevealItems = getEffectiveRevealItems(beat);
    const knownRevealIds = new Set(beatRevealItems.map((item) => item.id));
    let producedAnyForBeat = false;
    for (const chapterNumber of chaptersInRange) {
      const existingForChapter = planByChapter.get(chapterNumber);
      const alreadyValid =
        existingForChapter &&
        existingForChapter.beatId === beat.id &&
        validateScenePlans([existingForChapter]).length === 0;
      if (alreadyValid && !options.force) {
        continue;
      }
      const peerPlans = chaptersInRange
        .filter((chapter) => chapter !== chapterNumber)
        .map((chapter) => planByChapter.get(chapter))
        .filter((plan): plan is ChapterScenePlan => plan !== undefined && plan.beatId === beat.id);

      // Compute beat budget status for this specific chapter position.
      const chaptersRemaining = range.end - chapterNumber + 1;
      const totalTaskBudget = (beat.narrativeTasks ?? []).reduce(
        (sum, t) => sum + t.targetChapterBudget,
        0,
      );
      // Approximate budget consumed by chapters before this one (peer plans that exist).
      const budgetConsumedByPeers = peerPlans.reduce(
        (sum, p) => sum + (p.advancingTaskIds?.length ? 1 : 0),
        0,
      );
      const taskBudgetRemaining = Math.max(0, totalTaskBudget - budgetConsumedByPeers);
      const shortfall = Math.max(0, chaptersRemaining - taskBudgetRemaining);
      const beatBudgetStatus = beat.narrativeTasks?.length
        ? { chaptersRemaining, taskBudgetRemaining, shortfall, isFinale: taskBudgetRemaining === 0 }
        : undefined;

      log(
        "bible",
        `scene_decomposer beat=${beat.id} chapter=${chapterNumber} (peers=${peerPlans.length})`,
      );
      const messages = buildSceneDecomposerMessages({
        arc: arc ?? {
          id: beat.arcId,
          name: "(unknown arc)",
          arcGoal: "",
          startState: "",
          endState: "",
          requiredTurns: [],
          relationshipChanges: [],
          memoryRequirements: [],
          beatIds: [beat.id],
        },
        beat,
        themeBible,
        storyOutline: storyOutline ?? undefined,
        authorPack: plannerPack,
        protagonist,
        supportingCharacters: characterStates.filter((state) => state.id !== protagonist.id),
        worldFacts,
        chapterRange: range,
        targetChapterNumber: chapterNumber,
        peerPlans,
        existingPlans: existingForChapter && !options.force ? [existingForChapter] : undefined,
        revealItems: beatRevealItems,
        allArcOutlines: arcs,
        beatBudgetStatus,
      });
      await writePromptDebug({
        projectId: options.projectId,
        scope: "outline",
        label: `scene_decomposer_${beat.id}_ch${String(chapterNumber).padStart(3, "0")}`,
        messages,
      });
      try {
        const result = await service.generateObjectForTask({
          task: "scene_decomposer",
          messages,
          schema: sceneDecomposerResultSchema,
          temperature: 0.4,
          maxTokens: 6000,
        });
        const rawPlans = Array.isArray(result.object.scenePlans)
          ? (result.object.scenePlans as unknown[])
          : [];
        let accepted: ChapterScenePlan | null = null;
        for (const rawPlan of rawPlans) {
          const clamped = clampScenePlan(rawPlan, {
            arcId: beat.arcId,
            beatId: beat.id,
            chapterRange: range,
            knownCharacterIds,
            knownArcShiftIds,
            knownRevealIds,
            nameToId,
          });
          if (clamped && clamped.chapterNumber === chapterNumber) {
            accepted = clamped;
            break;
          }
        }
        if (!accepted) {
          warnings.push(
            `beat=${beat.id} chapter=${chapterNumber}: no usable scene plan returned`,
          );
          continue;
        }
        planByChapter.set(chapterNumber, accepted);
        producedAnyForBeat = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`beat=${beat.id} chapter=${chapterNumber}: ${message}`);
        log(
          "bible",
          `WARN scene_decomposer failed beat=${beat.id} chapter=${chapterNumber}: ${message}`,
        );
      }
    }
    if (producedAnyForBeat) {
      beatsProcessed.push(beat.id);
    }
  }

  const updatedPlans = Array.from(planByChapter.values()).sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );
  if (beatsProcessed.length > 0) {
    await repository.saveChapterScenePlans(options.projectId, updatedPlans);
  }

  const validationCoverage = validateScenePlans(updatedPlans);
  let scaffoldIssueCount = 0;
  let microShiftIssueCount = 0;
  for (const coverage of validationCoverage) {
    scaffoldIssueCount += coverage.scaffoldIssues.length;
    microShiftIssueCount += coverage.microShiftIssues.reduce(
      (sum, group) => sum + group.issues.length,
      0,
    );
  }
  const identicalRaw = findIdenticalConsecutiveScenes(updatedPlans);
  const identicalConsecutivePairs = identicalRaw.map((finding) => ({
    beatId:
      updatedPlans.find((plan) => plan.chapterNumber === finding.earlierChapter)?.beatId ?? "",
    earlierChapter: finding.earlierChapter,
    laterChapter: finding.laterChapter,
    identicalFields: finding.identicalFields,
  }));

  return {
    projectId: options.projectId,
    beatsProcessed,
    beatsSkipped,
    scenePlanCount: updatedPlans.length,
    identicalConsecutivePairs,
    scaffoldIssueCount,
    microShiftIssueCount,
    warnings,
  };
}

export function formatDecomposeChapterScenesResult(
  result: DecomposeChapterScenesResult,
): string {
  const lines = [`Scene decomposer — project=${result.projectId}`];
  lines.push(`  beats processed: ${result.beatsProcessed.length}`);
  if (result.beatsProcessed.length > 0) {
    lines.push(`    ${result.beatsProcessed.join(", ")}`);
  }
  lines.push(`  beats skipped: ${result.beatsSkipped.length}`);
  lines.push(`  scene plans on disk: ${result.scenePlanCount}`);
  lines.push(`  scaffold issues: ${result.scaffoldIssueCount}`);
  lines.push(`  micro-shift issues: ${result.microShiftIssueCount}`);
  if (result.identicalConsecutivePairs.length > 0) {
    lines.push("  identical consecutive scene plans (template-fill smell):");
    for (const pair of result.identicalConsecutivePairs) {
      lines.push(
        `    - chapters ${pair.earlierChapter}->${pair.laterChapter} share ${pair.identicalFields.join(",")}`,
      );
    }
  }
  if (result.warnings.length > 0) {
    lines.push("  warnings:");
    for (const warning of result.warnings) {
      lines.push(`    - ${warning}`);
    }
  }
  return lines.join("\n");
}

export interface InspectRevealsOptions {
  projectId: string;
  repository?: FileProjectRepository;
  /** When provided, status is computed relative to this chapter. */
  currentChapter?: number;
}

export interface InspectRevealsResult {
  projectId: string;
  totalReveals: number;
  byStatus: {
    pending: number;
    due_now: number;
    landed: number;
    overdue: number;
  };
  entries: Array<{
    revealId: string;
    beatId: string;
    kind: string;
    severity: "soft" | "hard";
    dueChapter: number;
    landedInChapter?: number;
    status: "pending" | "due_now" | "landed" | "overdue";
    text: string;
  }>;
}

export async function inspectRevealsForProject(
  options: InspectRevealsOptions,
): Promise<InspectRevealsResult> {
  const repository = options.repository ?? new FileProjectRepository();
  const beats = await repository.loadBeatOutlines(options.projectId);
  const status = describeRevealStatus({
    beats,
    currentChapter: options.currentChapter,
  });
  const counts = { pending: 0, due_now: 0, landed: 0, overdue: 0 };
  for (const entry of status) {
    counts[entry.status] += 1;
  }
  return {
    projectId: options.projectId,
    totalReveals: status.length,
    byStatus: counts,
    entries: status.map((entry) => ({
      revealId: entry.reveal.id,
      beatId: entry.beatId,
      kind: entry.reveal.kind,
      severity: entry.reveal.severityIfMissed,
      dueChapter: entry.reveal.dueChapter,
      ...(entry.reveal.landedInChapter != null
        ? { landedInChapter: entry.reveal.landedInChapter }
        : {}),
      status: entry.status,
      text: entry.reveal.text,
    })),
  };
}

export function formatInspectRevealsResult(result: InspectRevealsResult): string {
  const lines = [`Reveals — project=${result.projectId} total=${result.totalReveals}`];
  lines.push(
    `  status: pending=${result.byStatus.pending} due_now=${result.byStatus.due_now} landed=${result.byStatus.landed} overdue=${result.byStatus.overdue}`,
  );
  const sorted = [...result.entries].sort((a, b) => a.dueChapter - b.dueChapter);
  for (const entry of sorted) {
    const landed =
      entry.landedInChapter != null ? ` landed=ch${entry.landedInChapter}` : "";
    lines.push(
      `  - ch${entry.dueChapter} [${entry.severity}] ${entry.status}: ${entry.revealId} (beat=${entry.beatId})${landed}`,
    );
    lines.push(`      ${entry.text}`);
  }
  return lines.join("\n");
}

export interface BindWorldFactsOptions {
  projectId: string;
  repository?: FileProjectRepository;
  logStage?: (stage: string, detail: string) => void;
  /** Force re-binding even when reveals already have refIds. */
  force?: boolean;
}

export interface BindWorldFactsResult {
  projectId: string;
  beatsTouched: string[];
  revealsBound: number;
  beatsWithExplicitFactIds: number;
  warnings: string[];
}

export async function bindWorldFactsForProject(
  options: BindWorldFactsOptions,
): Promise<BindWorldFactsResult> {
  const repository = options.repository ?? new FileProjectRepository();
  const log = options.logStage ?? (() => {});
  const beats = await repository.loadBeatOutlines(options.projectId);
  const worldFacts = await repository.loadWorldFacts(options.projectId);
  if (beats.length === 0 || worldFacts.length === 0) {
    return {
      projectId: options.projectId,
      beatsTouched: [],
      revealsBound: 0,
      beatsWithExplicitFactIds: 0,
      warnings: ["beats or world-facts empty; bootstrap project first."],
    };
  }

  const beatsTouched: string[] = [];
  let revealsBound = 0;
  let beatsWithExplicitFactIds = 0;
  const updated: BeatOutline[] = beats.map((beat) => {
    const baseReveals = getEffectiveRevealItems(beat);
    const beforeBound = options.force
      ? baseReveals.map((reveal) => ({ ...reveal, refId: undefined }))
      : baseReveals;
    const bound = bindRevealItemsToWorldFacts(beforeBound, worldFacts);
    let changedReveals = 0;
    for (let i = 0; i < bound.length; i += 1) {
      const before = baseReveals[i];
      const after = bound[i];
      if (after && (after.refId !== before?.refId || after.kind !== before?.kind)) {
        changedReveals += 1;
      }
    }
    const newWorldFactIds = Array.from(
      new Set([
        ...(beat.worldFactIds ?? []),
        ...bound
          .filter((reveal) => reveal.kind === "world_fact" && reveal.refId)
          .map((reveal) => reveal.refId as string),
      ]),
    );
    const persistedRevealItems = bound.map((reveal) => ({
      ...reveal,
    }));
    const beatChanged =
      changedReveals > 0 ||
      JSON.stringify(beat.worldFactIds ?? []) !== JSON.stringify(newWorldFactIds) ||
      JSON.stringify(beat.revealItems ?? []) !== JSON.stringify(persistedRevealItems);
    if (beatChanged) {
      beatsTouched.push(beat.id);
      revealsBound += changedReveals;
      log(
        "bible",
        `bind_world_facts beat=${beat.id} bound_reveals=${changedReveals} fact_ids=${newWorldFactIds.length}`,
      );
    }
    if (newWorldFactIds.length > 0) {
      beatsWithExplicitFactIds += 1;
    }
    return {
      ...beat,
      revealItems: persistedRevealItems,
      worldFactIds: newWorldFactIds,
    };
  });

  if (beatsTouched.length > 0) {
    await repository.saveBeatOutlines(options.projectId, updated);
  }

  return {
    projectId: options.projectId,
    beatsTouched,
    revealsBound,
    beatsWithExplicitFactIds,
    warnings: [],
  };
}

export function formatBindWorldFactsResult(result: BindWorldFactsResult): string {
  const lines = [`World fact binding — project=${result.projectId}`];
  lines.push(`  beats touched: ${result.beatsTouched.length}`);
  if (result.beatsTouched.length > 0) {
    lines.push(`    ${result.beatsTouched.join(", ")}`);
  }
  lines.push(`  reveals newly bound to facts: ${result.revealsBound}`);
  lines.push(`  beats now carrying explicit worldFactIds: ${result.beatsWithExplicitFactIds}`);
  if (result.warnings.length > 0) {
    lines.push("  warnings:");
    for (const warning of result.warnings) {
      lines.push(`    - ${warning}`);
    }
  }
  return lines.join("\n");
}

export interface InspectFactCoverageOptions {
  projectId: string;
  repository?: FileProjectRepository;
}

export interface InspectFactCoverageResult {
  projectId: string;
  totalFacts: number;
  uncoveredFacts: string[];
  entries: Awaited<ReturnType<typeof describeFactCoverage>>;
}

export async function inspectFactCoverageForProject(
  options: InspectFactCoverageOptions,
): Promise<InspectFactCoverageResult> {
  const repository = options.repository ?? new FileProjectRepository();
  const beats = await repository.loadBeatOutlines(options.projectId);
  const worldFacts = await repository.loadWorldFacts(options.projectId);
  const entries = describeFactCoverage(beats, worldFacts);
  const uncoveredFacts = entries
    .filter((entry) => entry.beats.length === 0)
    .map((entry) => entry.factId);
  return {
    projectId: options.projectId,
    totalFacts: worldFacts.length,
    uncoveredFacts,
    entries,
  };
}

export function formatInspectFactCoverageResult(
  result: InspectFactCoverageResult,
): string {
  const lines = [
    `World fact coverage — project=${result.projectId} total=${result.totalFacts}`,
  ];
  lines.push(
    `  uncovered: ${result.uncoveredFacts.length}${
      result.uncoveredFacts.length > 0 ? ` (${result.uncoveredFacts.join(", ")})` : ""
    }`,
  );
  for (const entry of result.entries) {
    const due =
      entry.earliestDueChapter != null ? `earliest-due=ch${entry.earliestDueChapter}` : "no-due";
    lines.push(
      `  - ${entry.factId} [${entry.scope}] ${entry.title} (${due}, beats=${entry.beats.length})`,
    );
    for (const beatRef of entry.beats) {
      const range = beatRef.chapterRange
        ? `ch${beatRef.chapterRange.start}-${beatRef.chapterRange.end}`
        : "no-range";
      const reveals = beatRef.revealIds.length > 0 ? ` reveals=${beatRef.revealIds.length}` : "";
      lines.push(`      via=${beatRef.via} beat=${beatRef.beatId} (${range})${reveals}`);
    }
  }
  return lines.join("\n");
}
