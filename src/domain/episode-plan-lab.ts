import type {
  ArcOutline,
  BeatOutline,
  CastCharacterOutline,
  CharacterState,
  ChapterMode,
  EntityId,
  EpisodePayoffType,
  NarrativeThread,
  StoryOutline,
  StoryProject,
  WorldFact,
} from "./types.js";

export interface EpisodePlanLabInput {
  project: StoryProject;
  episodeId: EntityId;
  chapterStart: number;
  chapterEnd: number;
  targetChapterCount: number;
  themePreset?: EpisodePlanLabThemePreset;
  sourceArcs: ArcOutline[];
  sourceBeats: BeatOutline[];
  cast: CastCharacterOutline[];
  characters: CharacterState[];
  worldFacts: WorldFact[];
  existingThreads: NarrativeThread[];
}

export type EpisodePlanLabThemePresetId =
  | "project"
  | "abnormal_containment"
  | "game_invasion_opportunity"
  | "borrowed_photo_romance"
  | "time_stop_wasteland";

export interface EpisodePlanLabThemePreset {
  id: EpisodePlanLabThemePresetId;
  title: string;
  premise: string;
  openingContainer: string;
  targetAudience: string;
  commercialLoop: string;
  requiredGenrePayload: Array<
    "statusGate" | "ownershipTransfer" | "lieState" | "abilityBudget"
  >;
  benchmarkNotes: string[];
}

export interface EpisodeOutlineArtifact {
  id: EntityId;
  title: string;
  chapterRange: {
    start: number;
    end: number;
  };
  sourceArcIds: EntityId[];
  sourceBeatIds: EntityId[];
  externalEventContainer: string;
  centralPressure: string;
  factions: string[];
  readerPromises: string[];
  escalationLadder: string[];
  doNotResolveYet: string[];
}

export interface EpisodeCharacterThreadArtifact {
  id: EntityId;
  characterId: EntityId;
  title: string;
  readerQuestion: string;
  startingPressure: string;
  desiredTurn: string;
  collisionWithEventContainer: string;
  characterPayload?: {
    hookLabel: string;
    surfaceMask: string;
    coreDrive: string;
    innerContradiction: string;
    competenceProof: string;
    vulnerabilityCost: string;
    readerDesireHook: string;
    relationshipLeverage: string;
    iconicBehavior: string;
    oocGuard: string;
  };
  mustTouchChapters: number[];
  payoffExpectation: string;
}

export interface EpisodeWorldRuleTrackArtifact {
  id: EntityId;
  worldFactIds: EntityId[];
  title: string;
  rulePressure: string;
  howReadersLearnIt: string;
  plotFunction: string;
  revealSteps: Array<{
    chapterNumber: number;
    step: string;
  }>;
  forbiddenInfodump: string;
}

export interface EpisodeEventGenrePayload {
  statusGate?: {
    beforeStatus: string;
    afterStatus: string;
    validator: string;
    readerReward: string;
  };
  ownershipTransfer?: {
    expectedOwner: string;
    actualOwner: string;
    asset: string;
    retaliationCreated: string;
  };
  lieState?: {
    currentLie: string;
    exposureRisk: string;
    debtIncreased: string;
    temporaryCover: string;
  };
  abilityBudget?: {
    resourceName: string;
    budgetBefore: string;
    budgetAfter: string;
    costIfMisused: string;
  };
  readerSettlement?: {
    immediateReward: string;
    newDebtOrThreat: string;
    socialReaction: string;
    nextGate: string;
  };
}

export interface EpisodeEventPoolItem {
  id: EntityId;
  stage: string;
  eventType:
    | "departure"
    | "discovery"
    | "attempt"
    | "encounter"
    | "confrontation"
    | "crisis"
    | "arrival"
    | "rule_pressure"
    | "test"
    | "duel"
    | "betrayal"
    | "reveal"
    | "setback"
    | "payoff"
    | "invasion"
    | "aftermath";
  oneLine: string;
  involvedCharacterIds: EntityId[];
  threadIds: EntityId[];
  worldRuleTrackIds: EntityId[];
  readerPayoff: string;
  costOrConsequence: string;
  genrePayload?: EpisodeEventGenrePayload;
  suggestedChapter?: number;
}

export interface EpisodeChapterPlanSetItem {
  chapterNumber: number;
  title: string;
  chapterMode: ChapterMode;
  payoffType: EpisodePayoffType;
  mainEventIds: EntityId[];
  primaryCharacterThreadId: EntityId;
  supportingThreadIds: EntityId[];
  worldRuleTrackIds: EntityId[];
  chapterGoal: string;
  openingHook: string;
  centralCollision: string;
  forcedChoiceOrTurn: string;
  visiblePayoff: string;
  costOrComplication: string;
  endHook: string;
  writerBrief: string;
  disallowedMoves: string[];
}

export interface EpisodeChapterPlanSetArtifact {
  episodeId: EntityId;
  plans: EpisodeChapterPlanSetItem[];
}

export interface EpisodePlanLabResult {
  episode_outline: EpisodeOutlineArtifact;
  character_threads: EpisodeCharacterThreadArtifact[];
  world_rule_tracks: EpisodeWorldRuleTrackArtifact[];
  event_pool: EpisodeEventPoolItem[];
  episode_chapter_plan_set: EpisodeChapterPlanSetArtifact;
  notes: string[];
}

export interface EpisodePlanLabEvaluation {
  score: number;
  passed: boolean;
  findings: Array<{
    severity: "info" | "warn" | "fail";
    item: string;
    message: string;
  }>;
  humanReviewQuestions: string[];
}

export interface EpisodePlanLabEvaluationContext {
  knownCharacterIds?: EntityId[];
  knownWorldFactIds?: EntityId[];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function selectEpisodePlanLabInput(args: {
  project: StoryProject;
  episodeId?: string;
  chapterStart?: number;
  chapterEnd?: number;
  themePreset?: EpisodePlanLabThemePreset;
}): EpisodePlanLabInput {
  const chapterStart = args.chapterStart ?? 1;
  const chapterEnd = args.chapterEnd ?? Math.min(chapterStart + 7, 12);
  const sourceArcs = args.project.arcOutlines.filter((arc) => {
    const range = arc.chapterRangeHint;
    return !range || (range.start <= chapterEnd && range.end >= chapterStart);
  });
  const sourceBeats = args.project.beatOutlines.filter((beat) => {
    const range = beat.chapterRangeHint;
    return !range || (range.start <= chapterEnd && range.end >= chapterStart);
  });
  const targetChapterCount = chapterEnd - chapterStart + 1;
  return {
    project: args.project,
    episodeId: args.episodeId ?? `episode-${chapterStart}-${chapterEnd}`,
    chapterStart,
    chapterEnd,
    targetChapterCount,
    themePreset: args.themePreset,
    sourceArcs,
    sourceBeats,
    cast: args.project.castOutlines ?? [],
    characters: args.project.characters,
    worldFacts: args.project.worldFacts,
    existingThreads: args.project.narrativeThreads ?? [],
  };
}

export function evaluateEpisodePlanLabResult(
  result: EpisodePlanLabResult,
  context: EpisodePlanLabEvaluationContext = {},
): EpisodePlanLabEvaluation {
  const findings: EpisodePlanLabEvaluation["findings"] = [];
  let score = 100;
  const plans = result.episode_chapter_plan_set.plans;
  const chapterNumbers = new Set(plans.map((plan) => plan.chapterNumber));
  const eventIds = new Set(result.event_pool.map((event) => event.id));
  const characterThreadIds = new Set(result.character_threads.map((thread) => thread.id));
  const worldRuleTrackIds = new Set(result.world_rule_tracks.map((track) => track.id));
  const knownCharacterIds = new Set(context.knownCharacterIds ?? []);
  const knownWorldFactIds = new Set(context.knownWorldFactIds ?? []);

  if (plans.length === 0) {
    findings.push({ severity: "fail", item: "episode_chapter_plan_set", message: "没有生成章节计划。" });
    score -= 35;
  }

  if (chapterNumbers.size !== plans.length) {
    findings.push({ severity: "fail", item: "chapter_numbers", message: "章节号重复。" });
    score -= 15;
  }

  for (const plan of plans) {
    if (plan.mainEventIds.length === 0) {
      findings.push({ severity: "fail", item: `chapter-${plan.chapterNumber}`, message: "缺少 mainEventIds，章节不是从事件池提取出来的。" });
      score -= 8;
    }
    for (const eventId of plan.mainEventIds) {
      if (!eventIds.has(eventId)) {
        findings.push({ severity: "fail", item: `chapter-${plan.chapterNumber}`, message: `引用了不存在的 event id: ${eventId}` });
        score -= 5;
      }
    }
    if (!characterThreadIds.has(plan.primaryCharacterThreadId)) {
      findings.push({ severity: "warn", item: `chapter-${plan.chapterNumber}`, message: "primaryCharacterThreadId 没有绑定到 character_threads。" });
      score -= 5;
    }
    for (const threadId of plan.supportingThreadIds) {
      if (!characterThreadIds.has(threadId)) {
        findings.push({ severity: "warn", item: `chapter-${plan.chapterNumber}`, message: `supportingThreadIds 引用了不存在的人物线: ${threadId}` });
        score -= 4;
      }
    }
    for (const trackId of plan.worldRuleTrackIds) {
      if (!worldRuleTrackIds.has(trackId)) {
        findings.push({ severity: "warn", item: `chapter-${plan.chapterNumber}`, message: `引用了不存在的 world rule track: ${trackId}` });
        score -= 4;
      }
    }
    if (plan.openingHook.trim().length < 8 || plan.endHook.trim().length < 8) {
      findings.push({ severity: "warn", item: `chapter-${plan.chapterNumber}`, message: "开章钩子或章末钩子过弱。" });
      score -= 4;
    }
    if (plan.centralCollision.trim().length < 12 || plan.visiblePayoff.trim().length < 8) {
      findings.push({ severity: "warn", item: `chapter-${plan.chapterNumber}`, message: "中心碰撞或可见爽点不够具体。" });
      score -= 5;
    }
  }

  if (result.character_threads.length < 2) {
    findings.push({ severity: "warn", item: "character_threads", message: "人物线少于 2 条，篇章碰撞容易单薄。" });
    score -= 10;
  }
  if (result.world_rule_tracks.length < 1) {
    findings.push({ severity: "warn", item: "world_rule_tracks", message: "缺少世界规则线，世界观很难转化为剧情压力。" });
    score -= 10;
  }
  if (result.event_pool.length < plans.length) {
    findings.push({ severity: "warn", item: "event_pool", message: "事件池数量少于章节数，章节计划可能会像摘要而不是可写事件。" });
    score -= 10;
  }
  const eventTypes = new Set(result.event_pool.map((event) => event.eventType));
  const allowedEventTypes = new Set([
    "departure",
    "discovery",
    "attempt",
    "encounter",
    "confrontation",
    "crisis",
    "arrival",
    "rule_pressure",
    "test",
    "duel",
    "betrayal",
    "reveal",
    "setback",
    "payoff",
    "invasion",
    "aftermath",
  ]);
  if (result.event_pool.length >= 4 && eventTypes.size < 3) {
    findings.push({ severity: "warn", item: "event_pool", message: "事件类型过于单一，篇章节奏可能变成重复测试。" });
    score -= 8;
  }
  const genericStages = new Set(["pressure", "resolve", "collision", "anomaly", "public", "denial", "escape"]);
  const genericStageCount = result.event_pool.filter((event) =>
    genericStages.has(event.stage.trim().toLowerCase()),
  ).length;
  if (genericStageCount >= Math.ceil(result.event_pool.length / 2)) {
    findings.push({ severity: "warn", item: "event_pool.stage", message: "多数 stage 是抽象功能词，缺少篇章外部事件阶段感。" });
    score -= 6;
  }

  for (const thread of result.character_threads) {
    if (knownCharacterIds.size > 0 && !knownCharacterIds.has(thread.characterId)) {
      findings.push({ severity: "fail", item: thread.id, message: `characterId 不存在: ${thread.characterId}` });
      score -= 10;
    }
    if (thread.collisionWithEventContainer.trim().length < 12) {
      findings.push({ severity: "warn", item: thread.id, message: "人物线没有具体说明如何撞上篇章容器。" });
      score -= 5;
    }
    if (!thread.characterPayload) {
      findings.push({ severity: "warn", item: thread.id, message: "缺少 characterPayload，人物只剩功能线，记忆点不足。" });
      score -= 8;
    } else {
      const payload = thread.characterPayload;
      const weakFields = [
        ["hookLabel", payload.hookLabel, 3],
        ["innerContradiction", payload.innerContradiction, 8],
        ["competenceProof", payload.competenceProof, 8],
        ["readerDesireHook", payload.readerDesireHook, 8],
        ["iconicBehavior", payload.iconicBehavior, 8],
        ["oocGuard", payload.oocGuard, 8],
      ].filter(([, value, minLength]) => String(value).trim().length < Number(minLength));
      if (weakFields.length > 0) {
        findings.push({ severity: "warn", item: thread.id, message: `characterPayload 字段过弱: ${weakFields.map(([key]) => key).join(", ")}` });
        score -= 4;
      }
    }
  }

  for (const track of result.world_rule_tracks) {
    for (const factId of track.worldFactIds) {
      if (knownWorldFactIds.size > 0 && !knownWorldFactIds.has(factId)) {
        findings.push({ severity: "fail", item: track.id, message: `worldFactId 不存在: ${factId}` });
        score -= 10;
      }
    }
    if (track.revealSteps.length === 0) {
      findings.push({ severity: "warn", item: track.id, message: "世界规则线缺少 revealSteps。" });
      score -= 5;
    }
  }

  for (const event of result.event_pool) {
    if (!allowedEventTypes.has(event.eventType)) {
      findings.push({ severity: "warn", item: event.id, message: `eventType 不在建议集合内: ${event.eventType}` });
      score -= 3;
    }
    for (const characterId of event.involvedCharacterIds) {
      if (knownCharacterIds.size > 0 && !knownCharacterIds.has(characterId)) {
        findings.push({ severity: "fail", item: event.id, message: `involvedCharacterIds 引用了不存在的角色: ${characterId}` });
        score -= 10;
      }
    }
    for (const threadId of event.threadIds) {
      if (!characterThreadIds.has(threadId)) {
        findings.push({ severity: "warn", item: event.id, message: `threadIds 引用了不存在的人物线: ${threadId}` });
        score -= 5;
      }
    }
    for (const trackId of event.worldRuleTrackIds) {
      if (!worldRuleTrackIds.has(trackId)) {
        findings.push({ severity: "warn", item: event.id, message: `worldRuleTrackIds 引用了不存在的规则线: ${trackId}` });
        score -= 5;
      }
    }
    if (!event.genrePayload?.readerSettlement) {
      findings.push({ severity: "warn", item: event.id, message: "缺少 genrePayload.readerSettlement，章节商业结算不够可审计。" });
      score -= 4;
    }
  }

  const payloadCoverage = result.event_pool.filter((event) => event.genrePayload).length;
  if (result.event_pool.length > 0 && payloadCoverage < Math.ceil(result.event_pool.length * 0.75)) {
    findings.push({ severity: "warn", item: "genrePayload", message: "少于 75% 的事件带 genrePayload，爆款账本覆盖不足。" });
    score -= 12;
  }
  const hasSpecializedPayload = result.event_pool.some((event) => {
    const payload = event.genrePayload;
    return Boolean(
      payload?.statusGate ||
        payload?.ownershipTransfer ||
        payload?.lieState ||
        payload?.abilityBudget,
    );
  });
  if (!hasSpecializedPayload) {
    findings.push({ severity: "warn", item: "genrePayload", message: "没有任何题材特化账本字段，容易退化成通用大纲。" });
    score -= 10;
  }

  if (findings.length === 0) {
    findings.push({ severity: "info", item: "overall", message: "自动初筛未发现结构性问题，仍需要人评判断网文读者吸引力。" });
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    passed: finalScore >= 75 && !findings.some((finding) => finding.severity === "fail"),
    findings,
    humanReviewQuestions: [
      "从多数网文读者角度，这个篇章容器的外部事件是否足够清楚、有压迫感？",
      "人物线是否真的和外部事件/世界规则发生碰撞，还是只是并排罗列？",
      "角色是否有一句话记忆点、出手证明、内在矛盾和 OOC 防线？",
      "每章是否都有可写成场景的事件、选择、代价、爽点和章末驱动力？",
      "世界规则线是在制造剧情压力，还是只是在解释设定？",
      "如果你只看章节计划组，会不会想继续看下一章？哪几章最弱？",
    ],
  };
}

export function formatEpisodePlanLabHumanReview(args: {
  projectTitle: string;
  result: EpisodePlanLabResult;
  evaluation: EpisodePlanLabEvaluation;
}): string {
  const lines: string[] = [];
  lines.push(`# Episode Plan Lab Review: ${args.projectTitle}`);
  lines.push("");
  lines.push(`Score: ${args.evaluation.score}`);
  lines.push(`Passed auto check: ${args.evaluation.passed ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Episode Outline");
  lines.push(`- Title: ${args.result.episode_outline.title}`);
  lines.push(`- Container: ${args.result.episode_outline.externalEventContainer}`);
  lines.push(`- Central pressure: ${args.result.episode_outline.centralPressure}`);
  lines.push(`- Reader promises: ${args.result.episode_outline.readerPromises.join(" / ")}`);
  lines.push("");
  lines.push("## Auto Findings");
  for (const finding of args.evaluation.findings) {
    lines.push(`- [${finding.severity}] ${finding.item}: ${finding.message}`);
  }
  lines.push("");
  lines.push("## Character Threads");
  for (const thread of args.result.character_threads) {
    lines.push(`- ${thread.id}: ${thread.title}`);
    lines.push(`  - Question: ${thread.readerQuestion}`);
    lines.push(`  - Collision: ${thread.collisionWithEventContainer}`);
    if (thread.characterPayload) {
      lines.push(`  - Hook label: ${thread.characterPayload.hookLabel}`);
      lines.push(`  - Competence proof: ${thread.characterPayload.competenceProof}`);
      lines.push(`  - Inner contradiction: ${thread.characterPayload.innerContradiction}`);
      lines.push(`  - Reader desire hook: ${thread.characterPayload.readerDesireHook}`);
      lines.push(`  - Iconic behavior: ${thread.characterPayload.iconicBehavior}`);
      lines.push(`  - OOC guard: ${thread.characterPayload.oocGuard}`);
    }
  }
  lines.push("");
  lines.push("## World Rule Tracks");
  for (const track of args.result.world_rule_tracks) {
    lines.push(`- ${track.id}: ${track.title}`);
    lines.push(`  - Pressure: ${track.rulePressure}`);
    lines.push(`  - Plot function: ${track.plotFunction}`);
  }
  lines.push("");
  lines.push("## Event Pool");
  for (const event of args.result.event_pool) {
    lines.push(`- ${event.id} [${event.eventType}] ${event.stage}: ${event.oneLine}`);
    lines.push(`  - Payoff: ${event.readerPayoff}`);
    lines.push(`  - Cost: ${event.costOrConsequence}`);
    if (event.genrePayload?.readerSettlement) {
      lines.push(`  - Settlement: ${event.genrePayload.readerSettlement.immediateReward}`);
      lines.push(`  - New debt/threat: ${event.genrePayload.readerSettlement.newDebtOrThreat}`);
      lines.push(`  - Social reaction: ${event.genrePayload.readerSettlement.socialReaction}`);
      lines.push(`  - Next gate: ${event.genrePayload.readerSettlement.nextGate}`);
    }
    if (event.genrePayload?.statusGate) {
      lines.push(`  - Status gate: ${event.genrePayload.statusGate.beforeStatus} -> ${event.genrePayload.statusGate.afterStatus}`);
    }
    if (event.genrePayload?.ownershipTransfer) {
      lines.push(`  - Ownership transfer: ${event.genrePayload.ownershipTransfer.asset}, ${event.genrePayload.ownershipTransfer.expectedOwner} -> ${event.genrePayload.ownershipTransfer.actualOwner}`);
    }
    if (event.genrePayload?.lieState) {
      lines.push(`  - Lie state: ${event.genrePayload.lieState.currentLie}; risk=${event.genrePayload.lieState.exposureRisk}`);
    }
    if (event.genrePayload?.abilityBudget) {
      lines.push(`  - Ability budget: ${event.genrePayload.abilityBudget.resourceName} ${event.genrePayload.abilityBudget.budgetBefore} -> ${event.genrePayload.abilityBudget.budgetAfter}`);
    }
  }
  lines.push("");
  lines.push("## Human Review Questions");
  for (const question of args.evaluation.humanReviewQuestions) {
    lines.push(`- [ ] ${question}`);
  }
  lines.push("");
  lines.push("## Chapter Plan Set");
  for (const plan of args.result.episode_chapter_plan_set.plans) {
    lines.push(`### Chapter ${plan.chapterNumber}: ${plan.title}`);
    lines.push(`- Opening hook: ${plan.openingHook}`);
    lines.push(`- Collision: ${plan.centralCollision}`);
    lines.push(`- Turn: ${plan.forcedChoiceOrTurn}`);
    lines.push(`- Payoff: ${plan.visiblePayoff}`);
    lines.push(`- Cost: ${plan.costOrComplication}`);
    lines.push(`- End hook: ${plan.endHook}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function compactStoryOutlineForEpisodePlanLab(
  storyOutline: StoryOutline | undefined,
): Partial<StoryOutline> | undefined {
  if (!storyOutline) return undefined;
  return {
    id: storyOutline.id,
    title: storyOutline.title,
    premise: storyOutline.premise,
    coreTheme: storyOutline.coreTheme,
    endingTarget: storyOutline.endingTarget,
    majorArcIds: storyOutline.majorArcIds,
    keyTurningPoints: storyOutline.keyTurningPoints,
  };
}
