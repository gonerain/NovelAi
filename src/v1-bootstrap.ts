import {
  buildDerivedAuthorProfilePacks,
  mapAuthorInterviewToProfile,
  normalizeAuthorInterviewResult,
  resolveGenrePayoffPack,
  validateAuthorInterviewResult,
  type AuthorInterviewSessionInput,
  type DerivedAuthorProfilePacks,
} from "./domain/index.js";
import { demoPremise, demoProjectTitle, demoStoryMemories, demoStoryOutline, demoArcOutlines, demoBeatOutlines, demoCharacterStates, demoWorldFacts, demoThemeBible, demoStyleBible, demoStorySetup } from "./defaults/demo-project.js";
import {
  buildInterviewInputFromQuizAnswers,
  getAuthorInterviewPresetById,
} from "./defaults/author-presets.js";
import { LlmService } from "./llm/service.js";
import {
  authorInterviewDisplayDraftSchema,
  authorInterviewNormalizedDraftSchema,
  buildAuthorInterviewDisplayMessages,
  buildAuthorInterviewNormalizeMessages,
  buildAuthorInterviewSmallModelNormalizeMessages,
} from "./prompts/index.js";
import { FileProjectRepository } from "./storage/index.js";
import { deriveFallbackSeedMemories, type ProjectBaseState } from "./v1-shared.js";

async function generateAuthorProfileFromInterviewInput(args: {
  service: LlmService;
  interviewInput: AuthorInterviewSessionInput;
  projectId: string;
  logStage: (stage: string, detail: string) => void;
}): Promise<{
  authorProfile: ReturnType<typeof mapAuthorInterviewToProfile>;
  authorPacks: DerivedAuthorProfilePacks;
  validationIssues: string[];
}> {
  const interviewCombined = args.interviewInput.smallModel
    ? await (async () => {
        args.logStage("bootstrap", "llm: author_interview normalized-only");
        const normalizedOnlyMessages =
          buildAuthorInterviewSmallModelNormalizeMessages(args.interviewInput);
        const normalizedOnlyResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: normalizedOnlyMessages,
          schema: authorInterviewNormalizedDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });

        return {
          display: {
            summary: normalizedOnlyResult.object.normalized.authorProfile.summary,
            authorProfile: normalizedOnlyResult.object.normalized.authorProfile,
            components: normalizedOnlyResult.object.normalized.components.map((component) => ({
              id: component.id,
              name: component.name,
              category: component.category,
              description: component.name,
              priority: component.priority,
            })),
            constraints: normalizedOnlyResult.object.normalized.constraints,
            openQuestions: [],
            conflictsDetected: [],
          },
          normalized: normalizedOnlyResult.object.normalized,
        };
      })()
    : await (async () => {
        args.logStage("bootstrap", "llm: author_interview display");
        const displayMessages = buildAuthorInterviewDisplayMessages(args.interviewInput);
        const displayResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: displayMessages,
          schema: authorInterviewDisplayDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });
        args.logStage("bootstrap", "llm: author_interview normalized");
        const normalizedMessages = buildAuthorInterviewNormalizeMessages({
          input: args.interviewInput,
          display: displayResult.object.display,
        });
        const normalizedResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: normalizedMessages,
          schema: authorInterviewNormalizedDraftSchema,
          temperature: 0.2,
          maxTokens: 2600,
        });

        return {
          display: displayResult.object.display,
          normalized: normalizedResult.object.normalized,
        };
      })();

  const normalizedInterview = normalizeAuthorInterviewResult(interviewCombined);
  const validationIssues = validateAuthorInterviewResult(normalizedInterview).map(
    (issue) => `${issue.path}: ${issue.message}`,
  );
  const authorProfile = mapAuthorInterviewToProfile(normalizedInterview, {
    profileId: `${args.projectId}-author-profile`,
    profileName: "Default Author Profile",
  });
  const authorPacks = buildDerivedAuthorProfilePacks(authorProfile);
  return {
    authorProfile,
    authorPacks,
    validationIssues,
  };
}

export async function ensureBootstrappedProject(args: {
  service: LlmService;
  repository: FileProjectRepository;
  projectId: string;
  authorPresetId?: string;
  logStage: (stage: string, detail: string) => void;
  rebuildMemorySystemOutputsForProject: (
    repository: FileProjectRepository,
    projectId: string,
    storyMemories?: ProjectBaseState["storyMemories"],
    characterStates?: ProjectBaseState["characterStates"],
  ) => Promise<void>;
}): Promise<ProjectBaseState & { validationIssues: string[] }> {
  args.logStage("bootstrap", `ensure project=${args.projectId}`);
  const existingProject = await args.repository.getProject(args.projectId);
  if (!existingProject) {
    await args.repository.createProject({
      id: args.projectId,
      title: demoProjectTitle,
    });
  }

  let authorProfile = await args.repository.loadAuthorProfile(args.projectId);
  let authorPacks = await args.repository.loadDerivedAuthorProfilePacks(args.projectId);
  const validationIssues: string[] = [];

  if (!authorProfile) {
    args.logStage("bootstrap", "author profile missing -> run interview");
    const selectedPreset = getAuthorInterviewPresetById(args.authorPresetId);
    const interviewInput = {
      ...selectedPreset.interviewInput,
      targetProject: {
        title: demoProjectTitle,
        premise: demoPremise,
        themeHint: "power, betrayal, and costly redemption",
      },
    };
    const generated = await generateAuthorProfileFromInterviewInput({
      service: args.service,
      interviewInput,
      projectId: args.projectId,
      logStage: args.logStage,
    });
    validationIssues.push(...generated.validationIssues);
    authorProfile = generated.authorProfile;
    authorPacks = generated.authorPacks;

    await args.repository.saveAuthorProfile(args.projectId, authorProfile);
    await args.repository.saveDerivedAuthorProfilePacks(args.projectId, authorPacks);
    args.logStage("bootstrap", "saved author profile + packs");
  } else if (!authorPacks) {
    authorPacks = buildDerivedAuthorProfilePacks(authorProfile);
    await args.repository.saveDerivedAuthorProfilePacks(args.projectId, authorPacks);
    args.logStage("bootstrap", "rebuilt missing author packs");
  }

  const themeBible = (await args.repository.loadThemeBible(args.projectId)) ?? demoThemeBible;
  const styleBible = (await args.repository.loadStyleBible(args.projectId)) ?? demoStyleBible;
  const storySetup = (await args.repository.loadStorySetup(args.projectId)) ?? demoStorySetup;
  const genrePayoffPack = resolveGenrePayoffPack(storySetup.genrePayoffPackId);
  const loadedStoryOutline = await args.repository.loadStoryOutline(args.projectId);
  const loadedArcOutlines = await args.repository.loadArcOutlines(args.projectId);
  const loadedBeatOutlines = await args.repository.loadBeatOutlines(args.projectId);
  const loadedCharacterStates = await args.repository.loadCharacterStates(args.projectId);
  const loadedWorldFacts = await args.repository.loadWorldFacts(args.projectId);
  const loadedStoryMemories = await args.repository.loadStoryMemories(args.projectId);
  const storyOutline = loadedStoryOutline ?? demoStoryOutline;
  const arcOutlines = loadedArcOutlines.length ? loadedArcOutlines : demoArcOutlines;
  const beatOutlines = loadedBeatOutlines.length ? loadedBeatOutlines : demoBeatOutlines;
  const characterStates = loadedCharacterStates.length ? loadedCharacterStates : demoCharacterStates;
  const worldFacts = loadedWorldFacts.length ? loadedWorldFacts : demoWorldFacts;
  const storyMemories = loadedStoryMemories.length ? loadedStoryMemories : demoStoryMemories;
  const chapterPlans = await args.repository.loadChapterPlans(args.projectId);

  await args.repository.saveThemeBible(args.projectId, themeBible);
  await args.repository.saveStyleBible(args.projectId, styleBible);
  await args.repository.saveStorySetup(args.projectId, storySetup);
  await args.repository.saveStoryOutline(args.projectId, storyOutline);
  await args.repository.saveArcOutlines(args.projectId, arcOutlines);
  await args.repository.saveBeatOutlines(args.projectId, beatOutlines);
  await args.repository.saveCharacterStates(args.projectId, characterStates);
  await args.repository.saveWorldFacts(args.projectId, worldFacts);
  await args.repository.saveStoryMemories(args.projectId, storyMemories);
  if ((await args.repository.loadSeedStoryMemories(args.projectId)).length === 0) {
    await args.repository.saveSeedStoryMemories(
      args.projectId,
      loadedStoryMemories.length ? deriveFallbackSeedMemories(storyMemories) : demoStoryMemories,
    );
  }
  await args.rebuildMemorySystemOutputsForProject(
    args.repository,
    args.projectId,
    storyMemories,
    characterStates,
  );

  args.logStage("bootstrap", "base files ready");

  return {
    storySetup,
    genrePayoffPack,
    storyOutline,
    arcOutlines,
    beatOutlines,
    authorPacks,
    themeBible,
    styleBible,
    characterStates,
    worldFacts,
    storyMemories,
    chapterPlans,
    validationIssues,
  };
}

export async function interviewProject(args: {
  projectId: string;
  answersRaw: string;
  serviceFactory: () => LlmService;
  repository: FileProjectRepository;
}): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  const service = args.serviceFactory();
  const existingProject = await args.repository.getProject(args.projectId);
  if (!existingProject) {
    await args.repository.createProject({
      id: args.projectId,
      title: demoProjectTitle,
    });
  }

  const interviewInput = buildInterviewInputFromQuizAnswers(args.answersRaw, {
    title: demoProjectTitle,
    premise: demoPremise,
    themeHint: "custom quiz generated author profile",
  });
  const generated = await generateAuthorProfileFromInterviewInput({
    service,
    interviewInput,
    projectId: args.projectId,
    logStage: () => {},
  });

  await args.repository.saveAuthorProfile(args.projectId, generated.authorProfile);
  await args.repository.saveDerivedAuthorProfilePacks(args.projectId, generated.authorPacks);
  return {
    projectId: args.projectId,
    validationIssues: generated.validationIssues,
  };
}

export async function bootstrapProject(args: {
  projectId: string;
  authorPresetId?: string;
  serviceFactory: () => LlmService;
  repository: FileProjectRepository;
  logStage: (stage: string, detail: string) => void;
  rebuildMemorySystemOutputsForProject: (
    repository: FileProjectRepository,
    projectId: string,
    storyMemories?: ProjectBaseState["storyMemories"],
    characterStates?: ProjectBaseState["characterStates"],
  ) => Promise<void>;
}): Promise<{
  projectId: string;
  validationIssues: string[];
}> {
  const base = await ensureBootstrappedProject({
    service: args.serviceFactory(),
    repository: args.repository,
    projectId: args.projectId,
    authorPresetId: args.authorPresetId,
    logStage: args.logStage,
    rebuildMemorySystemOutputsForProject: args.rebuildMemorySystemOutputsForProject,
  });

  return {
    projectId: args.projectId,
    validationIssues: base.validationIssues,
  };
}
