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
export const demoProjectTitle = "雨幕共鸣";
export const demoPremise =
  "在一个共鸣者与普通人共存的世界，C市连续降雨二十天。能以情绪影响天气的雨璃一边掩护自己，一边策划用隐藏的生死共鸣为绝症母亲续命，而X局调查员诺兰与玲正步步逼近真相。";

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
  coreTheme: "看似最不需要救赎的人，往往最需要被救赎",
  subThemes: [
    "最坚固的墙保护最脆弱的心",
    "成长与拒绝成长",
    "友情与责任的拉扯",
  ],
  motifs: ["连雨", "雨伞", "项链", "医院天台", "甜品店日常"],
  taboos: ["廉价和解", "无代价牺牲", "突然热血反转"],
  endingTarget: "在无人能阻止她的时刻，雨璃最终自己停下越界共鸣，留下悬而未决的雨与命运",
  emotionalDestination: "安宁冷寂的日常表面下，角色学会直面失去与选择的责任",
};

export const demoStyleBible: StyleBible = {
  narrativeStyle: ["日常化", "平淡克制", "细节慢叙"],
  emotionalStyle: [
    "情绪主要通过动作、停顿和环境反馈呈现",
    "避免直白宣泄，保留冷感与留白",
  ],
  dialogueStyle: ["生活化对话", "轻微打趣下的试探", "信息延迟揭示"],
  pacingStyle: ["日常推进", "调查线渐进加压", "章节尾部小钩子"],
  imagery: ["细雨与路灯", "潮湿玻璃", "暖色店灯", "安静室内噪音"],
  preferredConflictShapes: ["隐瞒与识破", "责任与情感冲突", "自我克制与失控边缘"],
  preferredClimaxShapes: ["迟到的自我选择", "温和场景中的高代价决定"],
  antiPatterns: ["强行高燃打斗", "人物突然性格反转", "过量设定解释"],
};

export const demoStorySetup: StorySetup = {
  premise: demoPremise,
  currentArcGoal:
    "在日常校园与打工场景中铺开连雨异常与调查接近，推动雨璃在“保护母亲”与“不伤及他人”之间不断收紧选择空间。",
  openingSituation:
    "C市已连续下雨二十天。雨璃维持着大学、打工与照顾母亲的平静日常，却在甜品店里第一次与X局调查员诺兰、玲擦肩。",
  defaultActiveCharacterIds: ["yuli", "qingxin", "nolan"],
  genrePayoffPackId: "female_relationship_v1",
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
    "连雨异常引发X局长期调查，雨璃在日常中持续误导线索，并推动市民形成带伞习惯。",
    "诺兰在晴心与雨璃之间长期摇摆，难以确定真正任务目标，调查多次被引向错误分支。",
    "后段才逼近“生死之雨”计划真相，外部阻止最终失效，只剩雨璃自我选择。",
  ],
};

export const demoArcOutlines: ArcOutline[] = [
  {
    id: "arc-1",
    storyOutlineId: demoStoryOutline.id,
    name: "连雨日常与调查逼近",
    arcGoal:
      "在长期日常中并行推进三条线：雨璃维持可控降雨并误导调查、调查组只能逐步缩小范围、母女双方彼此知情却互不点破。",
    startState:
      "C市连雨持续，雨璃看似稳定自控，调查组尚无确定目标。",
    endState:
      "调查组仅锁定异常模式与少量可疑对象，仍无法确认雨璃是否目标，更无法拼出‘共享生命计划’全貌。",
    requiredTurns: [
      "以甜品店、通勤、电话问候等日常场景承载高风险信息交换。",
      "雨璃在晴心带来的情绪波动与降雨控制目标之间反复校准。",
      "诺兰与玲多次接近真相又被误导，调查不断升级但无法完成个人锁定。",
    ],
    relationshipChanges: [
      "诺兰对雨璃保持怀疑与共情并存，但长期无法下结论。",
      "雨璃与晴心的轻松日常逐渐被隐瞒成本侵蚀。",
    ],
    memoryRequirements: [
      "memory-rain-001",
      "memory-life-death-002",
      "memory-mother-illness-003",
    ],
    beatIds: ["beat-1", "beat-2", "beat-3"],
    primaryPayoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-delayed-confession",
      "payoff-relationship-breakpoint",
    ],
    chapterRangeHint: {
      start: 1,
      end: 24,
    },
  },
];

export const demoBeatOutlines: BeatOutline[] = [
  {
    id: "beat-1",
    arcId: "arc-1",
    order: 1,
    beatGoal:
      "建立安宁冷寂的日常基调，抛出“连雨异常+调查者出现”双钩子，但不做目标锁定。",
    conflict:
      "雨璃需要维持情绪稳定与降雨控制，但晴心的陪伴不断打乱她的情绪校准。",
    expectedChange:
      "读者确认雨璃与天气存在隐性绑定，并感知诺兰/玲开始调查异常现象而非锁定个人。",
    requiredCharacters: ["yuli", "qingxin", "nolan", "ling"],
    requiredMemories: [
      "memory-rain-001",
      "memory-mother-illness-003",
    ],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-old-setup-payoff",
    ],
    revealTargets: [
      "雨璃对情绪和天气的高精度控制习惯",
      "晴心作为“日常暖源”对雨璃控制策略的干扰",
      "诺兰/玲的职业化观察方式",
    ],
    constraints: [
      "禁止一章内讲完共鸣系统全设定",
      "保持日常场景密度，不直接爆发大冲突",
      "前段只锁定异常现象，不锁定雨璃个人",
    ],
    chapterRangeHint: {
      start: 1,
      end: 8,
    },
    openingAnchor: {
      readerAnchor: [
        "日常对白与环境细节应当自然流动",
        "异常信息通过轻微不协调感渗出",
      ],
      relationshipAnchor: [
        "雨璃与晴心亲密自然，但存在不对称隐瞒",
      ],
      worldAnchor: [
        "C市连雨二十天，X局开始介入调查",
      ],
      hook: "雨璃在甜品店门口看见诺兰的那一刻，笑意停住，雨势悄然变化。",
    },
  },
  {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    beatGoal:
      "调查线推进到“可疑人群与可疑区域”阶段，雨璃开始主动布置误导与城市雨具习惯工程。",
    conflict:
      "雨璃既要压住晴心带来的正向情绪波动，又要让诺兰和玲在多个候选目标之间反复摇摆。",
    expectedChange:
      "调查组只能确认异常链条与少量候选对象，雨璃的行动从被动防守转向策略性预埋。",
    requiredCharacters: ["yuli", "qingxin", "nolan", "ling"],
    requiredMemories: [
      "memory-rain-001",
      "memory-umbrella-plan-004",
      "memory-mother-illness-003",
    ],
    payoffPatternIds: [
      "payoff-costly-rescue",
      "payoff-delayed-confession",
    ],
    revealTargets: [
      "爱心雨伞与公益行动背后的真实动机",
      "诺兰对命运/选择的消极信念被雨璃触动",
    ],
    constraints: [
      "不提前揭露生死共鸣完整机制",
      "维持外冷内压的叙述温度",
      "保持“诺兰在晴心与雨璃间摇摆”的不确定性",
    ],
    chapterRangeHint: {
      start: 9,
      end: 16,
    },
  },
  {
    id: "beat-3",
    arcId: "arc-1",
    order: 3,
    beatGoal:
      "累积误导与反证，制造‘接近真相但仍无法落锤’的高压中段。",
    conflict:
      "诺兰与玲多次形成错误闭环，雨璃在维持计划与保护晴心/母亲之间承受持续消耗。",
    expectedChange:
      "调查进入高压僵局：异常证据增多，但目标身份仍不确定，终局选择被推迟到后续大弧。",
    requiredCharacters: ["yuli", "qingxin", "nolan", "ling"],
    requiredMemories: [
      "memory-life-death-002",
      "memory-mother-illness-003",
    ],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-relationship-breakpoint",
      "payoff-costly-rescue",
    ],
    revealTargets: [
      "母亲与雨璃互相知情却彼此成全的情感结构",
      "诺兰从“命定论执行者”向“承担选择后果者”转变",
    ],
    constraints: [
      "中段禁止直接落地终局答案",
      "维持信息增量但保留关键身份不确定性",
    ],
    chapterRangeHint: {
      start: 17,
      end: 24,
    },
  },
];

export const demoCharacterStates: CharacterState[] = [
  {
    id: "yuli",
    name: "雨璃",
    archetype: "高自控的情绪共鸣者",
    coreTraits: ["内敛", "敏感", "执行稳定"],
    desires: ["延长母亲生命", "不伤及无辜市民"],
    fears: ["失去母亲", "情绪失控暴露能力"],
    wounds: ["长期压抑情感", "不敢对关系抱有期待"],
    voiceNotes: ["礼貌克制", "句子短", "避免直接情绪词"],
    currentGoals: ["维持连雨控制", "误导X局调查", "推进城市带伞习惯"],
    emotionalState: ["平静", "紧绷", "疲惫"],
    knowledgeBoundary: ["知道雨共鸣机制", "知道生死共鸣存在代价"],
    secretsKept: ["生死共鸣能力", "共享生命计划细节"],
    relationships: [
      {
        targetCharacterId: "qingxin",
        type: "friend",
        publicLabel: "从小一起长大的朋友",
        privateTruth: "珍惜这段关系却不敢让她卷入真相",
        trustLevel: 90,
        tensionLevel: 35,
        dependencyLevel: 72,
        lastUpdatedInChapter: 0,
      },
      {
        targetCharacterId: "nolan",
        type: "ally",
        publicLabel: "陌生调查者",
        privateTruth: "直觉上认为他可能看穿自己",
        trustLevel: 22,
        tensionLevel: 78,
        dependencyLevel: 18,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "qingxin",
    name: "晴心",
    archetype: "直觉敏锐的明亮朋友",
    coreTraits: ["开朗", "依赖关系", "感受力强"],
    desires: ["和雨璃保持亲密陪伴", "维持日常快乐"],
    fears: ["被重要之人瞒着", "关系突然断裂"],
    wounds: ["家庭情感缺位", "对稳定关系高度依赖"],
    voiceNotes: ["语速快", "爱插科打诨", "情绪外放"],
    currentGoals: ["拉雨璃多参与日常活动", "降低她的情绪负担"],
    emotionalState: ["明亮", "不安", "依赖"],
    knowledgeBoundary: ["不知道生死共鸣", "不知道X局调查全貌"],
    secretsKept: ["对雨璃状态异常已有隐约察觉"],
    relationships: [
      {
        targetCharacterId: "yuli",
        type: "friend",
        publicLabel: "最好的朋友",
        privateTruth: "害怕被留在真相之外",
        trustLevel: 92,
        tensionLevel: 40,
        dependencyLevel: 84,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "nolan",
    name: "诺兰",
    archetype: "冷静执行者",
    coreTraits: ["克制", "高执行力", "谨慎"],
    desires: ["完成X局任务", "避免共鸣灾害扩大"],
    fears: ["重演父母悲剧", "自己判断失误造成不可逆后果"],
    wounds: ["母亲病逝", "父亲研究成功却来不及救治后失踪"],
    voiceNotes: ["平直简短", "少评价多观察", "决策语气冷硬"],
    currentGoals: ["识别连雨异常源", "在多名候选对象中排查真实目标"],
    emotionalState: ["冷淡", "压抑", "动摇"],
    knowledgeBoundary: ["知道组织规则", "不知道雨璃生死共鸣代价细节"],
    secretsKept: ["对命运论的消极依赖", "对雨璃产生非任务性关注"],
    relationships: [
      {
        targetCharacterId: "ling",
        type: "ally",
        publicLabel: "同组调查员",
        privateTruth: "依赖她的外向观察补全自己的盲区",
        trustLevel: 70,
        tensionLevel: 32,
        dependencyLevel: 45,
        lastUpdatedInChapter: 0,
      },
      {
        targetCharacterId: "yuli",
        type: "ally",
        publicLabel: "可疑对象之一",
        privateTruth: "怀疑与共情并存，且长期难以定论",
        trustLevel: 25,
        tensionLevel: 82,
        dependencyLevel: 28,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "ling",
    name: "玲",
    archetype: "使命驱动的新晋调查员",
    coreTraits: ["敏锐", "积极", "责任感强"],
    desires: ["快速建立调查功绩", "把诺兰重新拉回组织体系"],
    fears: ["误判导致城市异常升级"],
    wounds: ["与诺兰多年失联后重逢却生疏"],
    voiceNotes: ["表达直接", "观察结论先行", "节奏偏快"],
    currentGoals: ["协助诺兰缩小候选范围", "验证雨璃与晴心的行为差异"],
    emotionalState: ["亢奋", "紧张", "好奇"],
    knowledgeBoundary: ["知道诺兰过去片段", "不知道雨璃家庭真实处境"],
    secretsKept: ["受退休父母嘱托要把诺兰带回组织中心"],
    relationships: [
      {
        targetCharacterId: "nolan",
        type: "friend",
        publicLabel: "旧识搭档",
        privateTruth: "对如今诺兰的冷感状态不适应",
        trustLevel: 66,
        tensionLevel: 44,
        dependencyLevel: 38,
        lastUpdatedInChapter: 0,
      },
    ],
  },
];

export const demoStoryMemories: StoryMemory[] = [
  {
    id: "memory-rain-001",
    kind: "resource",
    title: "雨共鸣与情绪绑定",
    summary:
      "雨璃的情绪会直接影响天气，稳定情绪可维持可控降雨，剧烈波动可能引发风暴级异常。",
    ownerCharacterId: "yuli",
    relatedCharacterIds: ["yuli"],
    relatedLocationIds: [],
    triggerConditions: ["情绪剧烈波动", "强悲伤状态", "持续心理压抑"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "active",
    priority: "critical",
    visibility: "hidden",
    notes: ["X局数据库没有完整记录该能力来源。"],
  },
  {
    id: "memory-life-death-002",
    kind: "suspense_hook",
    title: "生死共鸣隐藏能力",
    summary:
      "雨璃拥有继承自父亲血脉的生死共鸣，可交换生命；受项链影响后表现为“生死之雨”，会平均淋雨者生命。",
    ownerCharacterId: "yuli",
    relatedCharacterIds: ["yuli", "nolan"],
    relatedLocationIds: [],
    triggerConditions: ["触发生死共鸣", "项链共鸣放大", "医院终局对峙"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "hidden",
    priority: "critical",
    visibility: "hidden",
    notes: ["一旦失控，城市级伤亡风险极高。"],
  },
  {
    id: "memory-mother-illness-003",
    kind: "promise",
    title: "母亲绝症与共享生命计划",
    summary:
      "雨璃母亲身患绝症命不久矣。雨璃计划通过生死共鸣共享生命，母亲知情并希望阻止她越界。",
    ownerCharacterId: "yuli",
    relatedCharacterIds: ["yuli", "nolan"],
    relatedLocationIds: [],
    triggerConditions: ["医院探望", "母女电话", "计划推进到执行边缘"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "active",
    priority: "critical",
    visibility: "private",
    notes: ["母亲与雨璃互相知道彼此意图，但长期不正面点破。"],
  },
  {
    id: "memory-umbrella-plan-004",
    kind: "long_arc_thread",
    title: "提高市民雨具携带率",
    summary:
      "为降低极端计划的附带伤害，雨璃通过公益雨伞项目等方式提高市民带伞/雨衣习惯。",
    ownerCharacterId: "yuli",
    relatedCharacterIds: ["yuli", "qingxin"],
    relatedLocationIds: ["c-city"],
    triggerConditions: ["连雨持续", "公益活动推进", "调查组复盘城市行为数据"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "active",
    priority: "high",
    visibility: "private",
    notes: ["该善意策略也会反向强化调查可疑度。"],
  },
];

export const demoWorldFacts: WorldFact[] = [
  {
    id: "fact-xbureau-001",
    category: "organization_rule",
    title: "X局负责城市共鸣监控与管理",
    description:
      "X局在各城市设分部，统计管理共鸣者并监控异常共鸣，以避免能力滥用造成社会性灾害。",
    scope: "global",
    visibility: "public",
    relatedCharacterIds: ["nolan", "ling"],
    relatedLocationIds: ["c-city"],
  },
  {
    id: "fact-city-rain-002",
    category: "anomaly_rule",
    title: "C市连续降雨二十天",
    description:
      "当前降雨强度长期维持在“造成生活不便但不致命”的区间，显示出异常精准的情绪化控制特征。",
    scope: "regional",
    visibility: "public",
    relatedCharacterIds: ["yuli", "nolan", "ling"],
    relatedLocationIds: ["c-city"],
  },
  {
    id: "fact-necklace-003",
    category: "artifact_rule",
    title: "雨共鸣项链来自父亲",
    description:
      "项链是雨璃雨共鸣能力的关键媒介，也会放大并扰动她的生死共鸣表现。",
    scope: "character_specific",
    visibility: "private",
    relatedCharacterIds: ["yuli", "nolan"],
    relatedLocationIds: [],
  },
  {
    id: "fact-life-rain-cost-004",
    category: "power_rule",
    title: "生死之雨存在极端代价",
    description:
      "生死共鸣失控触发降雨时，需要支付一半生命，且会平均所有淋雨者的生命值。",
    scope: "character_specific",
    visibility: "hidden",
    relatedCharacterIds: ["yuli"],
    relatedLocationIds: [],
  },
];
