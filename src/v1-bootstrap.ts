import {
  buildDerivedAuthorProfilePacks,
  mapAuthorInterviewToProfile,
  normalizeAuthorInterviewResult,
  resolveGenrePayoffPack,
  validateArcShiftsForArcs,
  validateAuthorInterviewResult,
  validateCharacterDecisionProfileCoverage,
  type AuthorInterviewSessionInput,
  type DerivedAuthorProfilePacks,
} from "./domain/index.js";
import {
  bindWorldFactsForProject,
  deriveArcShiftsForProject,
  fillDecisionProfilesForProject,
} from "./v1-bible.js";
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
import { writePromptDebug } from "./v1-artifacts.js";
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
        await writePromptDebug({
          projectId: args.projectId,
          scope: "outline",
          label: "author_interview_normalized_only",
          messages: normalizedOnlyMessages,
          module: "author_interview_small_model_normalize",
          input: args.interviewInput,
        });
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
        await writePromptDebug({
          projectId: args.projectId,
          scope: "outline",
          label: "author_interview_display",
          messages: displayMessages,
          module: "author_interview_display",
          input: args.interviewInput,
        });
        const displayResult = await args.service.generateObjectForTask({
          task: "author_interview",
          messages: displayMessages,
          schema: authorInterviewDisplayDraftSchema,
          temperature: 0.2,
          maxTokens: 2200,
        });
        args.logStage("bootstrap", "llm: author_interview normalized");
        const normalizeInput = {
          input: args.interviewInput,
          display: displayResult.object.display,
        };
        const normalizedMessages = buildAuthorInterviewNormalizeMessages(normalizeInput);
        await writePromptDebug({
          projectId: args.projectId,
          scope: "outline",
          label: "author_interview_normalized",
          messages: normalizedMessages,
          module: "author_interview_normalize",
          input: normalizeInput,
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

  let resolvedCharacterStates = characterStates;
  const initialDecisionGaps = validateCharacterDecisionProfileCoverage(characterStates);
  if (initialDecisionGaps.length > 0) {
    args.logStage(
      "bootstrap",
      `decision profile gaps detected count=${initialDecisionGaps.length}`,
    );
    try {
      const fillResult = await fillDecisionProfilesForProject({
        projectId: args.projectId,
        serviceFactory: () => args.service,
        repository: args.repository,
        logStage: args.logStage,
      });
      if (fillResult.filledCharacterIds.length > 0) {
        args.logStage(
          "bootstrap",
          `decision profile filled ids=${fillResult.filledCharacterIds.join(",")}`,
        );
        resolvedCharacterStates = await args.repository.loadCharacterStates(args.projectId);
      }
      for (const warning of fillResult.warnings) {
        validationIssues.push(`decisionProfile: ${warning}`);
      }
      for (const id of fillResult.missingAfterRunCharacterIds) {
        validationIssues.push(
          `decisionProfile: character=${id} still missing required fields after fill`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      args.logStage("bootstrap", `WARN decision profile fill skipped: ${message}`);
      for (const gap of initialDecisionGaps) {
        validationIssues.push(
          `decisionProfile: character=${gap.characterId} (${gap.characterName}) missing ${gap.missingFields.join(", ")}`,
        );
      }
    }
  }

  let resolvedArcOutlines = arcOutlines;
  const arcShiftCoverage = validateArcShiftsForArcs(arcOutlines);
  if (arcShiftCoverage.length > 0) {
    args.logStage(
      "bootstrap",
      `arc shift gaps detected count=${arcShiftCoverage.length}`,
    );
    try {
      const deriveResult = await deriveArcShiftsForProject({
        projectId: args.projectId,
        serviceFactory: () => args.service,
        repository: args.repository,
        logStage: args.logStage,
      });
      if (deriveResult.filledArcIds.length > 0) {
        args.logStage(
          "bootstrap",
          `arc shifts filled ids=${deriveResult.filledArcIds.join(",")}`,
        );
        resolvedArcOutlines = await args.repository.loadArcOutlines(args.projectId);
      }
      for (const warning of deriveResult.warnings) {
        validationIssues.push(`arcShift: ${warning}`);
      }
      for (const issue of deriveResult.remainingIssues) {
        validationIssues.push(`arcShift: arc=${issue.arcId} ${issue.reason}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      args.logStage("bootstrap", `WARN arc shift derive skipped: ${message}`);
      for (const coverage of arcShiftCoverage) {
        if (coverage.protagonistArcMissing) {
          validationIssues.push(
            `arcShift: arc=${coverage.arcId} protagonistArc missing`,
          );
        }
        for (const issueGroup of coverage.protagonistShiftIssues) {
          validationIssues.push(
            `arcShift: arc=${coverage.arcId} shift=${issueGroup.shiftId} ${issueGroup.issues.length} issue(s)`,
          );
        }
      }
    }
  }

  let resolvedBeatOutlines = beatOutlines;
  if (worldFacts.length > 0 && beatOutlines.length > 0) {
    try {
      const bindResult = await bindWorldFactsForProject({
        projectId: args.projectId,
        repository: args.repository,
        logStage: args.logStage,
      });
      if (bindResult.beatsTouched.length > 0) {
        resolvedBeatOutlines = await args.repository.loadBeatOutlines(args.projectId);
        args.logStage(
          "bootstrap",
          `world facts bound beats=${bindResult.beatsTouched.length} reveals=${bindResult.revealsBound}`,
        );
      }
      for (const warning of bindResult.warnings) {
        validationIssues.push(`worldFactBinding: ${warning}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      args.logStage("bootstrap", `WARN world fact binding skipped: ${message}`);
    }
  }

  args.logStage("bootstrap", "base files ready");

  return {
    storySetup,
    genrePayoffPack,
    storyOutline,
    arcOutlines: resolvedArcOutlines,
    beatOutlines: resolvedBeatOutlines,
    authorPacks,
    themeBible,
    styleBible,
    characterStates: resolvedCharacterStates,
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
