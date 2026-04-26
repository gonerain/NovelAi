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
export const demoProjectTitle = "我能改判别人的命运";
export const demoPremise =
  "在命书真实存在的都市里，普通人的未来会以黑字流动、红字锁死、金字交易的形式显现。底层内容风控员夜烬觉醒“命书改判”能力后，救下被购买死亡结局的沈知夏，并以假面身份“执笔人”组建白纸会，对抗垄断命运交易的天衡会。";

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
  coreTheme: "握有改写他人命运之笔的人，最先要学会限制自己落笔",
  subThemes: [
    "被写死的人生也应重新拥有选择权",
    "救赎与支配只隔着一次自以为正确的越界",
    "同伴不是棋子，而是阻止执笔人成为暴君的白纸",
  ],
  motifs: ["命书红字", "白纸", "金色债印", "天台直播", "风控后台"],
  taboos: ["无代价改命", "主角全知全能", "反派降智自爆"],
  endingTarget: "夜烬赢下与天衡会的第一场命运审判，却发现自己母亲的病也属于一份更早的金字交易",
  emotionalDestination: "从孤身落笔的冷酷棋手，走向必须接受组织审笔与同伴制衡的执笔人",
};

export const demoStyleBible: StyleBible = {
  narrativeStyle: ["都市冷感", "高智商布局", "强钩子推进"],
  emotionalStyle: [
    "情绪通过命书文字变化、沉默决策和代价反噬呈现",
    "避免廉价热血，保留权谋压迫感与灰色选择",
  ],
  dialogueStyle: ["锋利短句", "互相试探的谈判感", "关键信息延迟揭示"],
  pacingStyle: ["开章抛危机", "中段布置反转", "章尾留下改判代价或敌方反写"],
  imagery: ["冷光屏幕", "血红命字", "空白纸页", "雨夜天台", "地下债账"],
  preferredConflictShapes: ["预知与锁死命运", "改判与现实落地", "组织审笔与个人越界"],
  preferredClimaxShapes: ["反向利用锁死结局", "公开审判中的身份隐藏", "胜利后代价落回自身"],
  antiPatterns: ["单纯靠预知躲灾", "能力无规则许愿", "队友只负责崇拜主角"],
};

export const demoStorySetup: StorySetup = {
  premise: demoPremise,
  currentArcGoal:
    "以沈知夏被购买的死亡结局为开篇，建立黑字、红字、金字三类命书规则，推动夜烬从旁观预知者变成第一次改判命运的执笔人。",
  openingSituation:
    "夜烬在深夜审核到一条被系统拦截的求救视频，视频中的沈知夏说自己不是自杀。第二天，他在地铁站看见她头顶浮现红字死亡判决与金字购买标记。",
  defaultActiveCharacterIds: ["yejin", "shenzhixia", "gulinchuan"],
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
    "夜烬发现黑字未来可以靠人力改变，但沈知夏头顶的红字死亡判决会自我修正，必须通过命书改判才能打破。",
    "夜烬将沈知夏的‘三日后跳楼自杀’改判为‘三日后在天台公开真相’，并开始为这个新结局布置现实条件。",
    "天台直播案成功后，执笔人第一次进入公众视野，天衡会确认出现野生命书改判者，而白纸会的雏形被迫成立。",
  ],
};

export const demoArcOutlines: ArcOutline[] = [
  {
    id: "arc-1",
    storyOutlineId: demoStoryOutline.id,
    name: "执笔人诞生与沈知夏死亡改判",
    arcGoal:
      "在一场被购买的自杀结局中并行推进三条线：夜烬理解命书规则、沈知夏从受害者变成证人、顾临川以官方调查者身份逼近执笔人的真实身份。",
    startState:
      "夜烬只是能看见零散黑字未来的底层风控员，尚未意识到红字与金字代表锁死判决和命运交易。",
    endState:
      "沈知夏死亡结局被改判为公开控诉，执笔人名号出现，顾临川开始追查神秘改命者，天衡会将夜烬列为危险目标。",
    requiredTurns: [
      "以短视频审核、地铁偶遇、匿名求救等都市场景承载命书规则曝光。",
      "夜烬确认普通黑字可以靠行动改变，但红字会持续修正，必须落笔改判。",
      "沈知夏案从救人升级为对命运交易链条的首次公开审判。",
    ],
    relationshipChanges: [
      "夜烬与沈知夏从救人与被救的关系，转为互相利用又互相制衡的同盟。",
      "顾临川对执笔人的态度从怀疑都市传说，转为确认其拥有危险的法外权力。",
    ],
    memoryRequirements: [
      "memory-fatebook-001",
      "memory-red-gold-002",
      "memory-mother-contract-003",
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
      "建立都市风控后台与命书初现的强钩子，抛出‘被删除求救视频+三日后自杀红字+结局已被购买’三重悬念。",
    conflict:
      "夜烬原以为自己只是看见可变未来，但沈知夏的死亡红字无论怎样干预都会自我修正。",
    expectedChange:
      "读者确认命书不是单纯预知，而是分为可变黑字、锁死红字和交易金字；夜烬第一次意识到必须改判。",
    requiredCharacters: ["yejin", "shenzhixia", "gulinchuan", "linlu"],
    requiredMemories: [
      "memory-fatebook-001",
      "memory-mother-contract-003",
    ],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-old-setup-payoff",
    ],
    revealTargets: [
      "夜烬能看见命书文字但不能直接改写自己的命运",
      "沈知夏的自杀结局并非心理崩溃，而是被购买的金字交易",
      "顾临川所在调查组已注意到多起异常自杀与顶罪案件",
    ],
    constraints: [
      "禁止一章内讲完命书系统全设定",
      "保持都市现实压力，不写灾厄副本或怪物事件",
      "前段只证明红字会修正，不提前揭露天衡会全貌",
    ],
    chapterRangeHint: {
      start: 1,
      end: 8,
    },
    openingAnchor: {
      readerAnchor: [
        "第一章必须从被系统拦截的求救视频切入",
        "异常信息通过后台状态、命书文字和现实巧合逐层加压",
      ],
      relationshipAnchor: [
        "夜烬与沈知夏最初互不信任，他救她也带着调查动机",
      ],
      worldAnchor: [
        "都市里大多数人只活在黑字未来中，少数人的红字判决被金字交易锁定",
      ],
      hook: "夜烬删掉‘跳楼自杀’四个字后，自己的命书弹出红字：三日后替沈知夏跳楼。",
    },
  },
  {
    id: "beat-2",
    arcId: "arc-1",
    order: 2,
    beatGoal:
      "调查沈知夏死亡交易的现实链条，夜烬决定不逃避天台结局，而是把‘跳楼自杀’改判成‘天台直播说出真相’。",
    conflict:
      "夜烬既要保护沈知夏撑过空白期，又要让幕后买家相信原死亡结局仍会如期发生。",
    expectedChange:
      "沈知夏从被动受害者转为主动证人，夜烬从预知者转为布局者，并初步形成白纸会的组织必要性。",
    requiredCharacters: ["yejin", "shenzhixia", "gulinchuan", "linlu"],
    requiredMemories: [
      "memory-fatebook-001",
      "memory-whitepaper-004",
      "memory-mother-contract-003",
    ],
    payoffPatternIds: [
      "payoff-costly-rescue",
      "payoff-delayed-confession",
    ],
    revealTargets: [
      "空白期规则：红字改判后旧结局碎裂，新结局未落稳，最容易被天衡会反写",
      "白纸会的意义：帮执笔人查账、护送、审笔，而不是崇拜他的能力",
    ],
    constraints: [
      "不提前揭露夜烬母亲交易全貌",
      "维持主角棋手感，但不能让队友显得无用",
      "保持‘改判终点、谋划道路’的能力边界",
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
      "完成天台直播反杀，公开沈知夏案真相，让执笔人名号出现，并埋下天衡会与顾临川双线追捕。",
    conflict:
      "顾临川要依法阻止失控舆论，天衡会要让红字死亡重新落地，夜烬必须在不暴露身份的情况下让新结局成立。",
    expectedChange:
      "沈知夏活下来并加入夜烬阵营，执笔人成为都市传说，天衡会正式确认野生命书改判者存在。",
    requiredCharacters: ["yejin", "shenzhixia", "gulinchuan", "linlu"],
    requiredMemories: [
      "memory-red-gold-002",
      "memory-mother-contract-003",
    ],
    payoffPatternIds: [
      "payoff-forced-exposure",
      "payoff-relationship-breakpoint",
      "payoff-costly-rescue",
    ],
    revealTargets: [
      "天衡会通过寿命、名望、牢狱和死亡交易垄断上层失败成本",
      "顾临川与夜烬目标相似但路线相反，一个信法律，一个信改判",
    ],
    constraints: [
      "中段禁止让天衡会主脑亲自下场",
      "胜利必须附带代价：夜烬母亲病情或自身命书出现新红字",
    ],
    chapterRangeHint: {
      start: 17,
      end: 24,
    },
  },
];

export const demoCharacterStates: CharacterState[] = [
  {
    id: "yejin",
    name: "夜烬",
    archetype: "冷静危险的命书改判者",
    coreTraits: ["高智商", "克制", "善于布局"],
    desires: ["查清母亲病症背后的金字交易", "夺回被权贵写死的普通人命运"],
    fears: ["自己成为新的天衡会", "落笔救人却支配他人人生"],
    wounds: ["父亲失踪留下的债账阴影", "长期在底层系统里旁观无数求救被删除"],
    voiceNotes: ["冷静短句", "先给结论再补条件", "很少解释真实动机"],
    currentGoals: ["破解沈知夏死亡红字", "隐瞒执笔人身份", "确认命书改判的代价边界"],
    emotionalState: ["冷静", "警惕", "压抑亢奋"],
    knowledgeBoundary: ["知道黑字未来可变", "初步知道红字和金字必须改判才能破局"],
    secretsKept: ["执笔人身份", "母亲病历上出现过金字债印"],
    relationships: [
      {
        targetCharacterId: "shenzhixia",
        type: "ally",
        publicLabel: "被他救下的自杀案当事人",
        privateTruth: "需要她作为第一位证人，也害怕她成为审判自己越界的人",
        trustLevel: 42,
        tensionLevel: 76,
        dependencyLevel: 58,
        lastUpdatedInChapter: 0,
      },
      {
        targetCharacterId: "gulinchuan",
        type: "ally",
        publicLabel: "官方调查者",
        privateTruth: "知道顾临川迟早会追到自己，但暂时需要借他的体制力量落地证据",
        trustLevel: 25,
        tensionLevel: 84,
        dependencyLevel: 34,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "shenzhixia",
    name: "沈知夏",
    archetype: "被夺走未来的准律师",
    coreTraits: ["敏锐", "倔强", "原则感强"],
    desires: ["证明自己不是自杀", "夺回被卖掉的未来"],
    fears: ["再一次被写成无声的受害者", "夜烬用救命之恩替她决定人生"],
    wounds: ["奖学金、论文和家庭关系被系统性摧毁", "原本的律师命运被擦成死亡红字"],
    voiceNotes: ["逻辑清楚", "反问锋利", "恐惧时仍要求证据"],
    currentGoals: ["活过三日死亡判决", "找出购买自己结局的人"],
    emotionalState: ["恐惧", "愤怒", "强撑理智"],
    knowledgeBoundary: ["不知道天衡会全貌", "知道自己自杀结局不是自然形成"],
    secretsKept: ["手里可能有一份能指向买家的残缺证据"],
    relationships: [
      {
        targetCharacterId: "yejin",
        type: "ally",
        publicLabel: "救命者与可疑执笔人",
        privateTruth: "感激他救命，却拒绝把自己的未来交给他书写",
        trustLevel: 48,
        tensionLevel: 72,
        dependencyLevel: 66,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "gulinchuan",
    name: "顾临川",
    archetype: "相信程序正义的官方调查者",
    coreTraits: ["冷硬", "敏锐", "原则至上"],
    desires: ["查清连环异常自杀与顶罪案", "阻止法外改命权失控"],
    fears: ["正义被神秘能力挟持", "自己为了抓执笔人反而放走真正买命者"],
    wounds: ["曾因证据链断裂放跑权贵嫌疑人", "亲眼见过替罪羊被制度碾碎"],
    voiceNotes: ["措辞准确", "少情绪多质询", "用法律概念压迫对话"],
    currentGoals: ["识别执笔人真实身份", "确认沈知夏案背后是否存在命运交易"],
    emotionalState: ["克制", "怀疑", "被迫动摇"],
    knowledgeBoundary: ["知道异常案件存在共同利益链", "不知道命书改判的具体规则"],
    secretsKept: ["对执笔人方法有隐秘认同，但不能承认"],
    relationships: [
      {
        targetCharacterId: "linlu",
        type: "ally",
        publicLabel: "技术协查对象",
        privateTruth: "需要她的技术能力，却不完全相信她的立场",
        trustLevel: 58,
        tensionLevel: 46,
        dependencyLevel: 44,
        lastUpdatedInChapter: 0,
      },
      {
        targetCharacterId: "yejin",
        type: "ally",
        publicLabel: "普通平台风控员",
        privateTruth: "直觉夜烬知道太多，却暂时缺乏能指向执笔人的证据",
        trustLevel: 28,
        tensionLevel: 82,
        dependencyLevel: 30,
        lastUpdatedInChapter: 0,
      },
    ],
  },
  {
    id: "linlu",
    name: "林鹿",
    archetype: "游离在灰区的天才黑客",
    coreTraits: ["机灵", "反骨", "技术敏感"],
    desires: ["查出是谁把自己的未来标成背锅命", "在白纸会里保留自由"],
    fears: ["被官方当成工具人", "被夜烬当成可牺牲棋子"],
    wounds: ["曾替资本平台背过数据黑锅", "命书里残留未触发的牢狱红字"],
    voiceNotes: ["嘴快", "爱嘲讽", "关键时刻突然认真"],
    currentGoals: ["协助追踪求救视频删除链路", "确认平台后台是否接入命运交易接口"],
    emotionalState: ["兴奋", "戒备", "好奇"],
    knowledgeBoundary: ["知道部分平台数据异常", "不知道天衡会十二席结构"],
    secretsKept: ["私下保存了多起被删求救视频的备份"],
    relationships: [
      {
        targetCharacterId: "gulinchuan",
        type: "friend",
        publicLabel: "半合作半被监管的技术人员",
        privateTruth: "既想利用官方资源，又怕顾临川把她送回审讯室",
        trustLevel: 54,
        tensionLevel: 62,
        dependencyLevel: 42,
        lastUpdatedInChapter: 0,
      },
    ],
  },
];

export const demoStoryMemories: StoryMemory[] = [
  {
    id: "memory-fatebook-001",
    kind: "resource",
    title: "命书黑字与可变未来",
    summary:
      "夜烬能看见部分人的命书黑字，黑字代表流动未来，可通过提前行动、证据布置和现实干预改变，不必消耗改判能力。",
    ownerCharacterId: "yejin",
    relatedCharacterIds: ["yejin"],
    relatedLocationIds: [],
    triggerConditions: ["看见短期未来", "判断是否需要落笔", "普通危机被提前规避"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "active",
    priority: "critical",
    visibility: "hidden",
    notes: ["黑字不是判决，主角不能把所有预知都误认为必须改命。"],
  },
  {
    id: "memory-red-gold-002",
    kind: "suspense_hook",
    title: "红字判决与金字交易",
    summary:
      "红字代表锁死结局，会在被阻止后自我修正；金字代表该结局被购买、转嫁或抵押。夜烬必须通过命书改判才能真正打破红字。",
    ownerCharacterId: "yejin",
    relatedCharacterIds: ["yejin", "shenzhixia"],
    relatedLocationIds: [],
    triggerConditions: ["红字死亡出现", "金字债印浮现", "天衡会反写命运"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "hidden",
    priority: "critical",
    visibility: "hidden",
    notes: ["改判不是许愿，只能改终点，现实路径仍需谋划落地。"],
  },
  {
    id: "memory-mother-contract-003",
    kind: "promise",
    title: "母亲病历上的金字债印",
    summary:
      "夜烬母亲长期重病，病历深处曾浮现金字债印。夜烬怀疑这不是自然疾病，而是父亲失踪前留下或挡下的一份命运交易。",
    ownerCharacterId: "yejin",
    relatedCharacterIds: ["yejin", "gulinchuan"],
    relatedLocationIds: [],
    triggerConditions: ["医院探望", "病历异常", "夜烬考虑为私情越界落笔"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "active",
    priority: "critical",
    visibility: "private",
    notes: ["母亲线用于推动夜烬在公义与私欲之间不断越界。"],
  },
  {
    id: "memory-whitepaper-004",
    kind: "long_arc_thread",
    title: "白纸会的查账、护送与审笔",
    summary:
      "白纸会由被夺走原本命运的人组成，负责查出金字买家、保护改判后的空白期当事人，并监督夜烬是否有资格落笔。",
    ownerCharacterId: "yejin",
    relatedCharacterIds: ["yejin", "shenzhixia"],
    relatedLocationIds: ["c-city"],
    triggerConditions: ["空白期保护", "决定是否改判", "组织内部质疑夜烬越界"],
    introducedIn: 1,
    lastReferencedIn: 1,
    status: "active",
    priority: "high",
    visibility: "private",
    notes: ["白纸会不是主角的工具，而是防止执笔人成为新暴君的制衡结构。"],
  },
];

export const demoWorldFacts: WorldFact[] = [
  {
    id: "fact-tianheng-001",
    category: "organization_rule",
    title: "天衡会垄断命运交易",
    description:
      "天衡会以慈善、医疗、数据、金融和娱乐资本为外壳，暗中购买、转嫁和抵押寿命、名望、牢狱、疾病与死亡结局。",
    scope: "global",
    visibility: "public",
    relatedCharacterIds: ["gulinchuan", "linlu"],
    relatedLocationIds: ["c-city"],
  },
  {
    id: "fact-shenzhixia-case-002",
    category: "anomaly_rule",
    title: "沈知夏三日后自杀结局已被购买",
    description:
      "沈知夏头顶浮现红字死亡判决与金字购买标记，说明她的自杀并非心理崩溃，而是有人支付代价后锁定的命运合同。",
    scope: "regional",
    visibility: "public",
    relatedCharacterIds: ["yejin", "shenzhixia", "gulinchuan"],
    relatedLocationIds: ["c-city"],
  },
  {
    id: "fact-fatebook-rule-003",
    category: "artifact_rule",
    title: "命书文字分为黑字、红字与金字",
    description:
      "黑字是可变未来，红字是会自我修正的锁死判决，金字是被购买或转嫁的命运交易标记。三者共同构成夜烬理解世界的基础规则。",
    scope: "character_specific",
    visibility: "private",
    relatedCharacterIds: ["yejin", "gulinchuan"],
    relatedLocationIds: [],
  },
  {
    id: "fact-revision-cost-004",
    category: "power_rule",
    title: "命书改判只能改终点，不能省略道路",
    description:
      "夜烬可以对红字或金字进行一次改判，但新结局仍需要现实条件、证据链、护送、舆论和代价偿还才能落地；强行二次编辑会反噬自身命书。",
    scope: "character_specific",
    visibility: "hidden",
    relatedCharacterIds: ["yejin"],
    relatedLocationIds: [],
  },
];
