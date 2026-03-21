import {
  buildContextPack,
  buildDerivedAuthorProfilePacks,
  mapAuthorInterviewToProfile,
  normalizeAuthorInterviewResult,
  type CharacterState,
  type StoryMemory,
  type StyleBible,
  type ThemeBible,
  type WorldFact,
  validateAuthorInterviewResult,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import {
  authorInterviewResultSchema,
  buildAuthorInterviewMessages,
} from "./prompts/author-interview.js";
import { buildPlannerMessages, plannerResultSchema } from "./prompts/planner.js";
import { FileProjectRepository } from "./storage/index.js";

async function main(): Promise<void> {
  const service = new LlmService();
  const repository = new FileProjectRepository();
  const projectId = "demo-project";

  const themeBible: ThemeBible = {
    coreTheme: "理解自己与救赎",
    subThemes: ["自毁倾向", "接受拯救", "迟来的坦白"],
    motifs: ["雨夜", "旧伤", "药"],
    taboos: ["廉价和解", "无代价救赎"],
    endingTarget: "苦涩但成立地回收主题",
    emotionalDestination: "理解自己后仍选择活下去",
  };

  const styleBible: StyleBible = {
    narrativeStyle: ["克制", "细腻", "慢热"],
    emotionalStyle: ["通过动作和环境表达情绪", "爆发段落短促有力"],
    dialogueStyle: ["潜台词", "试探", "回避式对话"],
    pacingStyle: ["慢热铺垫", "关键段落集中爆发"],
    imagery: ["雨夜", "旧伤", "药味", "照顾与被照顾"],
    preferredConflictShapes: ["误读", "回避", "自我否认"],
    preferredClimaxShapes: ["迟来的理解", "有代价的和解"],
    antiPatterns: ["快速和解", "说教式点题"],
  };

  const characterStates: CharacterState[] = [
    {
      id: "protagonist",
      name: "主角",
      archetype: "克制型自毁者",
      coreTraits: ["冷静", "嘴硬", "过度自持"],
      desires: ["独自解决问题", "维持体面"],
      fears: ["被看穿脆弱", "拖累他人"],
      wounds: ["旧伤反复发作", "长期拒绝求助形成惯性"],
      voiceNotes: ["说话简短", "擅长轻描淡写自己的伤势"],
      currentGoals: ["隐藏伤势", "不暴露底牌"],
      emotionalState: ["压抑", "疲惫", "戒备"],
      knowledgeBoundary: ["知道自己仍持有保命丹药"],
      secretsKept: ["隐瞒保命底牌的来源与效果"],
      relationships: [
        {
          targetCharacterId: "senior_brother",
          type: "ally",
          publicLabel: "同行师兄",
          privateTruth: "已经在情感上高度依赖对方，但不愿承认",
          trustLevel: 72,
          tensionLevel: 81,
          dependencyLevel: 68,
          lastUpdatedInChapter: 0,
        },
      ],
    },
    {
      id: "senior_brother",
      name: "师兄",
      archetype: "表面温和实则强势的保护者",
      coreTraits: ["敏锐", "克制", "不轻易逼问"],
      desires: ["确认主角到底隐瞒了什么", "保护主角活下来"],
      fears: ["再次失去重要之人"],
      wounds: ["曾因迟疑失去同伴"],
      voiceNotes: ["说话平静", "会用极轻的语气逼近真相"],
      currentGoals: ["逼主角接受帮助"],
      emotionalState: ["怀疑", "担忧", "压着火气"],
      knowledgeBoundary: ["怀疑主角有底牌但不知道具体是什么"],
      secretsKept: ["已经决定必要时强行介入"],
      relationships: [
        {
          targetCharacterId: "protagonist",
          type: "ally",
          publicLabel: "同行师弟",
          privateTruth: "保护欲已越界",
          trustLevel: 78,
          tensionLevel: 76,
          dependencyLevel: 64,
          lastUpdatedInChapter: 0,
        },
      ],
    },
  ];

  const storyMemories: StoryMemory[] = [
    {
      id: "memory-pill-001",
      kind: "resource",
      title: "未使用的保命丹药",
      summary: "主角曾在黑市获得一枚可在濒死时保命的高阶丹药，至今未使用。",
      ownerCharacterId: "protagonist",
      relatedCharacterIds: ["protagonist"],
      relatedLocationIds: [],
      triggerConditions: ["濒死", "重伤", "无法撤离"],
      introducedIn: 12,
      lastReferencedIn: 12,
      status: "active",
      priority: "critical",
      visibility: "private",
      notes: ["师兄并不知道丹药的存在"],
    },
    {
      id: "memory-wound-003",
      kind: "injury",
      title: "旧伤复发",
      summary: "主角此前留下的旧伤在高强度战斗后会迅速恶化，影响行动与判断。",
      ownerCharacterId: "protagonist",
      relatedCharacterIds: ["protagonist", "senior_brother"],
      relatedLocationIds: [],
      triggerConditions: ["高强度战斗", "灵力透支", "重伤"],
      introducedIn: 8,
      lastReferencedIn: 18,
      status: "active",
      priority: "high",
      visibility: "public",
      notes: ["主角习惯压着不说"],
    },
    {
      id: "memory-secret-002",
      kind: "promise",
      title: "绝不再欠人情",
      summary: "主角曾发誓不再通过接受拯救来延续生命，因此对求助有强烈抗拒。",
      ownerCharacterId: "protagonist",
      relatedCharacterIds: ["protagonist"],
      relatedLocationIds: [],
      triggerConditions: ["被迫求助", "接受照顾"],
      introducedIn: 10,
      lastReferencedIn: 16,
      status: "active",
      priority: "high",
      visibility: "private",
      notes: ["这是其拒绝师兄帮助的重要心理来源"],
    },
  ];

  const worldFacts: WorldFact[] = [
    {
      id: "fact-inn-001",
      category: "location_rule",
      title: "客栈暂时安全但不宜久留",
      description: "客栈结界能暂时隔绝追踪，但最多维持一夜，天亮后追兵会重新锁定位置。",
      scope: "local",
      visibility: "public",
      relatedCharacterIds: ["protagonist", "senior_brother"],
      relatedLocationIds: ["inn-room"],
    },
    {
      id: "fact-pill-002",
      category: "resource_rule",
      title: "丹药使用后会暴露异常灵息",
      description: "高阶保命丹药在使用时会产生极强灵息波动，极易让外人判断持有者来历不凡。",
      scope: "character_specific",
      visibility: "hidden",
      relatedCharacterIds: ["protagonist"],
      relatedLocationIds: [],
    },
    {
      id: "fact-brother-003",
      category: "character_rule",
      title: "师兄不会接受被完全排除在外",
      description: "师兄一旦确认主角在拿命硬撑，宁可强行介入，也不会继续装作没看见。",
      scope: "character_specific",
      visibility: "public",
      relatedCharacterIds: ["senior_brother", "protagonist"],
      relatedLocationIds: [],
    },
  ];

  const interviewMessages = buildAuthorInterviewMessages({
    userRawAnswers: [
      {
        questionId: "theme_core",
        answer:
          "我最想写的是一个人怎么慢慢理解自己，并在理解之后决定是否原谅自己。我喜欢救赎，但不喜欢廉价原谅。",
      },
      {
        questionId: "character_bias",
        answer:
          "我喜欢表面稳定、体面、甚至有点冷的人，但他们内里其实早就坏掉了。我也喜欢病弱感、克制感和嘴硬。",
      },
      {
        questionId: "relationship_pattern",
        answer:
          "我喜欢两个人明明彼此重要，但都不肯说清楚，靠试探、误读、回避和迟来的坦白推进。和解一定要有代价。",
      },
      {
        questionId: "plot_bias",
        answer:
          "我偏慢热，但关键段落希望情绪很猛。我喜欢大故事拆成很多小结果，每一段都往终点靠，但不要太套路。",
      },
      {
        questionId: "ending_bias",
        answer:
          "我喜欢点题、完整、震撼的结局，最好是苦涩但成立。可以失去一些东西，但不能失去整个主题。",
      },
      {
        questionId: "aesthetic_private_goods",
        answer:
          "我会忍不住写雨夜、旧伤、药、照顾与被照顾、明明快死了还要装没事。我不喜欢快速和解，也不喜欢工具人配角。",
      },
    ],
    targetProject: {
      title: "未定名修仙文",
      premise:
        "一个表面冷静自持的主角，在漫长旅途中逐渐承认自己的自毁倾向，并被迫学会接受他人的拯救。",
      themeHint: "理解自己与救赎",
    },
  });

  const interviewResult = await service.generateObjectForTask({
    task: "author_interview",
    messages: interviewMessages,
    schema: authorInterviewResultSchema,
    temperature: 0.2,
    maxTokens: 4000,
  });

  const normalizedInterview = normalizeAuthorInterviewResult(interviewResult.object);
  const validationIssues = validateAuthorInterviewResult(normalizedInterview);
  const authorProfile = mapAuthorInterviewToProfile(normalizedInterview, {
    profileId: "author-profile-demo",
    profileName: "Demo Author Profile",
  });
  const derivedPacks = buildDerivedAuthorProfilePacks(authorProfile);

  const plannerMessages = buildPlannerMessages({
    authorPack: derivedPacks.planner,
    themeBible,
    styleBible,
    arcId: "arc-1",
    chapterNumber: 1,
    premise:
      "一个表面冷静自持的主角，在漫长旅途中逐渐承认自己的自毁倾向，并被迫学会接受他人的拯救。",
    currentArcGoal: "主角第一次在真正濒危时被迫考虑是否向师兄暴露自己的保命底牌。",
    currentSituation:
      "主角在与追兵交手后重伤，体内旧伤复发，师兄察觉他状态不对，但主角仍试图隐瞒。",
    activeCharacterIds: ["protagonist", "senior_brother"],
    candidateMemoryIds: ["memory-pill-001", "memory-wound-003", "memory-secret-002"],
    recentConsequences: [
      "主角已经连续两次拒绝他人帮助",
      "师兄开始怀疑主角隐瞒了重要事实",
    ],
  });

  const plannerResult = await service.generateObjectForTask({
    task: "planner",
    messages: plannerMessages,
    schema: plannerResultSchema,
    temperature: 0.2,
    maxTokens: 2200,
  });

  const writerContextPack = buildContextPack({
    task: "writer",
    authorPack: derivedPacks.writer,
    themeBible,
    styleBible,
    chapterPlan: plannerResult.object.chapterPlan,
    characterStates,
    storyMemories,
    worldFacts,
  });

  const existingProject = await repository.getProject(projectId);
  if (!existingProject) {
    await repository.createProject({
      id: projectId,
      title: "Demo Project",
    });
  }

  await repository.saveAuthorProfile(projectId, authorProfile);
  await repository.saveDerivedAuthorProfilePacks(projectId, derivedPacks);
  await repository.saveThemeBible(projectId, themeBible);
  await repository.saveStyleBible(projectId, styleBible);
  await repository.saveCharacterStates(projectId, characterStates);
  await repository.saveWorldFacts(projectId, worldFacts);
  await repository.saveStoryMemories(projectId, storyMemories);
  await repository.saveChapterPlans(projectId, [plannerResult.object.chapterPlan]);

  console.log("=== PLANNER PACK ===");
  console.log(JSON.stringify(derivedPacks.planner, null, 2));
  console.log("\n=== CHAPTER PLAN ===");
  console.log(JSON.stringify(plannerResult.object, null, 2));
  console.log("\n=== WRITER CONTEXT PACK ===");
  console.log(JSON.stringify(writerContextPack, null, 2));
  console.log("\n=== VALIDATION ISSUES ===");
  console.log(JSON.stringify(validationIssues, null, 2));
  console.log(`\nSaved to data/projects/${projectId}/author-profile.json`);
  console.log(`Saved to data/projects/${projectId}/derived/author-profile-packs.json`);
  console.log(`Saved to data/projects/${projectId}/theme-bible.json`);
  console.log(`Saved to data/projects/${projectId}/style-bible.json`);
  console.log(`Saved to data/projects/${projectId}/character-states.json`);
  console.log(`Saved to data/projects/${projectId}/world-facts.json`);
  console.log(`Saved to data/projects/${projectId}/story-memories.json`);
  console.log(`Saved to data/projects/${projectId}/chapter-plans.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
