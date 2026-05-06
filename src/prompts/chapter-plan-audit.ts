import type {
  ArcOutline,
  BeatOutline,
  ChapterPlan,
  ChapterScenePlan,
  EpisodePacket,
  StoryOutline,
  ThemeBible,
  WorldFact,
} from "../domain/index.js";
import type { ChatMessage } from "../llm/types.js";

export interface ChapterPlanAuditChapterInput {
  chapterNumber: number;
  chapterPlan?: ChapterPlan;
  scenePlan?: ChapterScenePlan;
  episodePacket?: EpisodePacket;
  /** Optional final draft if the chapter has already been generated. */
  draft?: string;
  draftCnCharCount?: number;
}

export interface ChapterPlanAuditInput {
  projectId: string;
  fromChapter: number;
  toChapter: number;
  storyOutline?: StoryOutline;
  themeBible?: ThemeBible;
  arcOutlines: ArcOutline[];
  beatOutlines: BeatOutline[];
  worldFacts: WorldFact[];
  chapters: ChapterPlanAuditChapterInput[];
}

const SYSTEM_PROMPT = [
  "你现在是商业网文「章节计划审核器」。",
  "你的任务不是夸文笔，也不是泛泛评价，而是判断：把这套细纲/章纲/正文交给 AI 生成，会不会天然写重、写散、写成任务流水账。",
  "请用严格、技术化、偏审稿人的态度审核。直接说问题，不要客套。",
  "",
  "审核必须覆盖以下 9 步，按下面的输出格式产出。如果某一栏在当前数据下没什么可写，可压缩，但不要跳过整段标题。",
  "",
  "## 1. 先判断问题来源",
  "主因只能选 1 个：章节计划问题 / 单章任务过多 / 节奏分配问题 / 信息释放过早或过晚 / 角色动机不清 / 场景承载力不足 / 正文执行问题 / 文笔语言问题。",
  "再列 1-2 个次因。",
  "必须明确说明：如果按这个版本继续写，AI 最可能在哪里写崩。",
  "",
  "## 2. 审单章职责",
  "每一章只能有一个主问题。检查：",
  "- 这一章读者最想知道的问题是什么？",
  "- 是否同时承担太多功能？",
  "- 有没有把「当前动作 + 大段回忆 + 男主心理解释 + 阵营设定 + 新势力登场」全部塞进一章？",
  "- 哪些保留 / 删除 / 延后 / 只暗示。",
  "",
  "## 3. 审节奏分配",
  "铺垫是否太长？推进是否太急？爆点是否过密？余波是否缺失？是否每章都像季终集？是否给了读者足够时间代入女主处境？",
  "如果是开篇 1-6 章，重点检查：是否太早进入幕后棋局；是否太早解释机制全貌；是否应该先强化女主的亲身异常体验；是否中后段悬念被提前消耗。",
  "前期原则：优先写「异常造成的现实反馈」，不要急着解释「机制是谁控制、怎么运作、历史旧案是什么」。",
  "",
  "## 4. 审信息释放",
  "列出当前章节释放的新信息，并判断：哪些必须现在放 / 应该延后 / 只需要露一根针 / 解释会破坏悬疑感 / 是否保留了中后段关键悬念。",
  "判断标准：读者前期需要知道的是「发生了什么危险」，不是「世界观为什么这样」。",
  "",
  "## 5. 审角色行动",
  "每章必须有角色选择，而不是只有信息展示。检查：主角是否做了明确选择？这个选择是否带来代价？女主是否只是被剧情推着走？女主是否有阶段性小胜利？男主是否太早被洗白？配角是否只是工具人？",
  "特别注意：男主 POV 只写选择，不写洗白。不要用作者口吻解释他有多心疼女主。应该通过他的行动暴露矛盾。",
  "",
  "## 6. 审场景承载力",
  "一个场景里是否塞了过多人物和信息？当前场景有没有明确压迫源？道具/短信/直播/日历/监控/名单等是否在推动剧情？是否能通过外部动作展示冲突，而不是靠心理独白解释？",
  "",
  "## 7. 审尾钩",
  "每章结尾：是否自然？是否是新问题而不是强行反转？是否承接本章主问题？是否让读者想点下一章？是否只是「又来一个大人物 / 又爆一个大设定」？",
  "好的尾钩优先来自：她做了切断动作却被现实判定无效；她刚获得一点主动权却付出代价；她以为是某个人在控制结果发现更大的规则在运转；某个角色做出了和默认立场相反的选择。",
  "",
  "## 8. 必须输出 AI 生成风险",
  "预测如果按当前计划生成正文，AI 最可能出现的问题，例如：写成设定说明 / 任务流水账 / 大段心理独白 / 女主行动被动 / 男主提前洗白 / 场景动作不足 / 结尾靠硬反转 / 每章都像季终集 / 人物只是交换信息。",
  "",
  "## 9. 输出格式（严格按此结构产出 markdown）",
  "",
  "### 总结判断",
  "一句话说明当前版本最大问题。",
  "",
  "### 问题来源",
  "- 主因：",
  "- 次因：",
  "- AI 最可能写崩的位置：",
  "",
  "### 最强部分",
  "指出 1-3 个真正有效的设计，并说明为什么有效。",
  "",
  "### 最大问题",
  "按严重程度列出 3-5 个问题。",
  "",
  "### 逐章审核",
  "逐章给出。每章字段：",
  "- 当前主问题：",
  "- 承担任务：",
  "- 是否超载：",
  "- 保留：",
  "- 删除：",
  "- 延后：",
  "- 强化：",
  "如果输入里也带了正文 draft，再加一行：",
  "- 正文执行问题：",
  "",
  "### 信息释放表",
  "用 markdown 表格：",
  "| 信息点 | 当前释放位置 | 是否过早 | 建议 |",
  "| --- | --- | --- | --- |",
  "",
  "### 节奏重排建议",
  "给具体重排方案：第几章保留什么 / 删除什么 / 延后什么 / 改成暗示 / 改成尾钩。不要只说「放慢」。",
  "",
  "### 可写进 chapter planner 的规则",
  "归纳成几条可机器执行的规则。例：每章只能有一个主问题；每章最多释放一个新机制信息；回忆不能超过本章篇幅 15%；前六章禁止解释机制全貌；男主 POV 只写选择不写洗白；每章必须有「选择—代价—尾钩」。",
  "",
  "输出整体使用中文。除上述结构外不要输出任何额外开场白或寒暄。",
].join("\n");

function safeText(value: string | undefined, fallback = "(none)"): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function formatChapter(input: ChapterPlanAuditChapterInput): string {
  const sections: string[] = [];
  sections.push(`### Chapter ${input.chapterNumber}`);

  const plan = input.chapterPlan;
  if (plan) {
    sections.push("[chapterPlan]");
    sections.push(
      [
        `chapterType=${safeText(plan.chapterType)}`,
        `arcId=${safeText(plan.arcId)}`,
        `beatId=${safeText(plan.beatId)}`,
        `title=${safeText(plan.title)}`,
        `chapterGoal=${safeText(plan.chapterGoal)}`,
        `emotionalGoal=${safeText(plan.emotionalGoal)}`,
        `plannedOutcome=${safeText(plan.plannedOutcome)}`,
        `sceneType=${safeText(plan.sceneType)}`,
        `sceneTags=${plan.sceneTags.join(" / ") || "(none)"}`,
        `requiredCharacters=${plan.requiredCharacters.join(" / ") || "(none)"}`,
        `requiredMemories=${plan.requiredMemories.join(" / ") || "(none)"}`,
        `mustHitConflicts=${plan.mustHitConflicts.join(" / ") || "(none)"}`,
        `disallowedMoves=${plan.disallowedMoves.join(" / ") || "(none)"}`,
      ].join("\n"),
    );
    if (plan.commercial) {
      sections.push(
        `[commercial] openingMode=${safeText(plan.commercial.openingMode)}; coreSellPoint=${safeText(plan.commercial.coreSellPoint)}; visibleProblem=${safeText(plan.commercial.visibleProblem)}; externalTurn=${safeText(plan.commercial.externalTurn)}; microPayoff=${safeText(plan.commercial.microPayoff)}; rewardType=${safeText(plan.commercial.rewardType)}; rewardTiming=${safeText(plan.commercial.rewardTiming)}; rewardTarget=${safeText(plan.commercial.rewardTarget)}; endHook=${safeText(plan.commercial.endHook)}; readerPromise=${safeText(plan.commercial.readerPromise)}`,
      );
    }
  } else {
    sections.push("[chapterPlan] (none)");
  }

  const scene = input.scenePlan;
  if (scene) {
    sections.push("[scenePlan]");
    sections.push(
      [
        `pov=${scene.pov}`,
        `location=${scene.location}`,
        `propsAndAnchors=${scene.propsAndAnchors.join(" / ") || "(none)"}`,
        `openingScene.entryHook=${safeText(scene.openingScene?.entryHook)}`,
        `openingScene.situationOnPage=${safeText(scene.openingScene?.situationOnPage)}`,
        `midConflict.trigger=${safeText(scene.midConflict?.trigger)}`,
        `midConflict.escalation=${safeText(scene.midConflict?.escalation)}`,
        `climax.decisionOwnerId=${safeText(scene.climax?.decisionOwnerId)}`,
        `climax.decisionUnderPressure=${safeText(scene.climax?.decisionUnderPressure)}`,
        `climax.costPaid=${safeText(scene.climax?.costPaid)}`,
        `endHook=${safeText(scene.endHook)}`,
        `dueRevealIds=${scene.dueRevealIds.join(" / ") || "(none)"}`,
        `characterArcMicroShift.count=${scene.characterArcMicroShift.length}`,
      ].join("\n"),
    );
    if (scene.characterArcMicroShift.length > 0) {
      sections.push(
        scene.characterArcMicroShift
          .map(
            (shift, idx) =>
              `  shift[${idx}] characterId=${shift.characterId} oldDefault=${safeText(shift.oldDefault)} pressureTrigger=${safeText(shift.pressureTrigger)} newChoice=${safeText(shift.newChoice)} costPaid=${safeText(shift.costPaid)}`,
          )
          .join("\n"),
      );
    }
  } else {
    sections.push("[scenePlan] (none)");
  }

  const episode = input.episodePacket;
  if (episode) {
    sections.push("[episodePacket]");
    sections.push(
      [
        `chapterMode=${episode.chapterMode}`,
        `payoffType=${episode.payoffType}`,
        `agencyOwnerId=${episode.agencyOwnerId}`,
        `nonTransferableChoice=${safeText(episode.nonTransferableChoice)}`,
        `tolerableOptions=${episode.tolerableOptions.join(" | ") || "(none)"}`,
        `choiceCost=${safeText(episode.choiceCost)}`,
        `protagonistConsequence=${safeText(episode.protagonistConsequence)}`,
        `readerPayoff=${safeText(episode.readerPayoff)}`,
        `endHook=${safeText(episode.endHook)}`,
        `doNotResolve=${episode.doNotResolve.join(" | ") || "(none)"}`,
      ].join("\n"),
    );
  } else {
    sections.push("[episodePacket] (none)");
  }

  if (input.draft) {
    sections.push(
      `[draft] cnCharCount=${input.draftCnCharCount ?? "?"}; full text follows:`,
    );
    sections.push(input.draft);
  } else {
    sections.push("[draft] (not generated yet)");
  }

  return sections.join("\n");
}

function formatArc(arc: ArcOutline): string {
  const lines = [
    `[arc ${arc.id}] name=${arc.name}`,
    `  arcGoal=${safeText(arc.arcGoal)}`,
    `  arcSellingPoint=${safeText(arc.arcSellingPoint)}`,
    `  arcHook=${safeText(arc.arcHook)}`,
    `  arcPayoff=${safeText(arc.arcPayoff)}`,
    `  startState=${safeText(arc.startState)}`,
    `  endState=${safeText(arc.endState)}`,
    `  chapterRange=${arc.chapterRangeHint ? `${arc.chapterRangeHint.start}-${arc.chapterRangeHint.end}` : "(unset)"}`,
    `  beatIds=${arc.beatIds.join(" / ") || "(none)"}`,
  ];
  if (arc.protagonistArc) {
    lines.push(
      `  protagonistArc.startInternalState=${safeText(arc.protagonistArc.startInternalState)}`,
      `  protagonistArc.endInternalState=${safeText(arc.protagonistArc.endInternalState)}`,
      `  protagonistArc.shifts.count=${arc.protagonistArc.shifts.length}`,
    );
  }
  return lines.join("\n");
}

function formatBeat(beat: BeatOutline): string {
  return [
    `[beat ${beat.id}] arcId=${beat.arcId} order=${beat.order}`,
    `  beatGoal=${safeText(beat.beatGoal)}`,
    `  conflict=${safeText(beat.conflict)}`,
    `  expectedChange=${safeText(beat.expectedChange)}`,
    `  chapterRange=${beat.chapterRangeHint ? `${beat.chapterRangeHint.start}-${beat.chapterRangeHint.end}` : "(unset)"}`,
    `  revealTargets=${(beat.revealTargets ?? []).join(" / ") || "(none)"}`,
    `  worldFactIds=${(beat.worldFactIds ?? []).join(" / ") || "(none)"}`,
    `  decisionPressure=${safeText(beat.decisionPressure)}`,
    `  likelyChoice=${safeText(beat.likelyChoice)}`,
    `  immediateConsequence=${safeText(beat.immediateConsequence)}`,
    `  delayedConsequence=${safeText(beat.delayedConsequence)}`,
  ].join("\n");
}

export function buildChapterPlanAuditMessages(input: ChapterPlanAuditInput): ChatMessage[] {
  const headerLines: string[] = [
    `Project: ${input.projectId}`,
    `Audit window: chapters ${input.fromChapter}-${input.toChapter}`,
  ];
  if (input.storyOutline) {
    headerLines.push(
      `Story title: ${input.storyOutline.title}`,
      `Premise: ${input.storyOutline.premise}`,
      `Core theme: ${input.storyOutline.coreTheme}`,
      `Ending target: ${input.storyOutline.endingTarget}`,
      `Key turning points: ${input.storyOutline.keyTurningPoints.join(" / ") || "(none)"}`,
    );
  }
  if (input.themeBible) {
    headerLines.push(
      `Theme coreTheme: ${safeText(input.themeBible.coreTheme)}`,
      `Theme emotionalDestination: ${safeText(input.themeBible.emotionalDestination)}`,
      `Theme motifs: ${input.themeBible.motifs.join(" / ") || "(none)"}`,
      `Theme taboos: ${input.themeBible.taboos.join(" / ") || "(none)"}`,
    );
  }

  const factLines = input.worldFacts.slice(0, 16).map((fact) =>
    `[worldFact ${fact.id}] title=${fact.title}; category=${fact.category}; scope=${fact.scope}; description=${safeText(fact.description)}`,
  );

  const arcLines = input.arcOutlines.map(formatArc).join("\n");
  const beatLines = input.beatOutlines
    .filter((beat) => {
      const range = beat.chapterRangeHint;
      if (!range) return true;
      return range.end >= input.fromChapter && range.start <= input.toChapter;
    })
    .map(formatBeat)
    .join("\n");

  const chapterBlocks = input.chapters.map(formatChapter).join("\n\n");

  const userContent = [
    headerLines.join("\n"),
    "",
    "[story-level worldFacts (top 16)]",
    factLines.join("\n") || "(none)",
    "",
    "[arc outlines]",
    arcLines || "(none)",
    "",
    "[beat outlines overlapping window]",
    beatLines || "(none)",
    "",
    "[chapters]",
    chapterBlocks || "(none)",
    "",
    "请按 9 步审核器规范输出 markdown 报告。直接以「### 总结判断」开始。不要寒暄。",
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}
