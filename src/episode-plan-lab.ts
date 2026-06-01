import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  evaluateEpisodePlanLabResult,
  formatEpisodePlanLabHumanReview,
  selectEpisodePlanLabInput,
  type EpisodePlanLabThemePreset,
  type EpisodePlanLabThemePresetId,
  type EpisodePlanLabResult,
} from "./domain/index.js";
import { LlmService } from "./llm/service.js";
import {
  buildEpisodePlanLabMessages,
  episodePlanLabResultSchema,
} from "./prompts/index.js";
import { FileProjectRepository } from "./storage/index.js";

interface ParsedArgs {
  projectId: string;
  episodeId?: string;
  chapterStart?: number;
  chapterEnd?: number;
  themePresetId: EpisodePlanLabThemePresetId;
  maxTokens: number;
  evalOnly: boolean;
  dryRun: boolean;
}

function usage(): string {
  return [
    "Usage:",
    "  node dist/episode-plan-lab.js --project <id> [--episode <id>] [--from <n>] [--to <n>] [--theme-preset <id>] [--max-tokens <n>] [--dry-run] [--eval-only]",
    "",
    "Writes:",
    "  data/projects/<id>/episode-plan-lab/<episode-id>/prompt.json",
    "  data/projects/<id>/episode-plan-lab/<episode-id>/episode-plan-lab.result.json",
    "  data/projects/<id>/episode-plan-lab/<episode-id>/episode-plan-lab.eval.json",
    "  data/projects/<id>/episode-plan-lab/<episode-id>/human-review.md",
  ].join("\n");
}

function parseInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function themePresetById(id: EpisodePlanLabThemePresetId): EpisodePlanLabThemePreset | undefined {
  if (id === "project") return undefined;
  const presets: Record<Exclude<EpisodePlanLabThemePresetId, "project">, EpisodePlanLabThemePreset> = {
    abnormal_containment: {
      id: "abnormal_containment",
      title: "大一实习生的749入职考",
      premise: "大一实习生在工地实习时撞见异常怪物，二十年未触发的金手指终于响应。749机构介入后，他必须通过收容考核，获得官方许可和第一份正式任务。",
      openingContainer: "工地异常出土 -> 第一次收容 -> 749上门 -> 入职考核 -> 正式任务派发",
      targetAudience: "男频都市异能/收容怪物读者，偏好杀伐果断、官方体系、能力奖励、身份升级。",
      commercialLoop: "每个事件都要结算：怪物收容奖励、主角身份抬升、749认可度、下一只异常或考核门槛。",
      requiredGenrePayload: ["statusGate", "abilityBudget"],
      benchmarkNotes: [
        "第一章必须见怪，不要慢热铺校园。",
        "官方体系不是背景，是身份升级和资源许可。",
        "每2章至少一次明确奖励或权限提升。",
      ],
    },
    game_invasion_opportunity: {
      id: "game_invasion_opportunity",
      title: "十日内测抢男女主机缘",
      premise: "游戏入侵现实前开启十日内测，主角知道原剧情中男女主和公会会拿走隐藏职业、首杀、神器和地图资源。他必须在倒计时内连续截胡，把原定机缘转移到自己名下。",
      openingContainer: "穿书/重生醒悟 -> 十日内测开启 -> 第一隐藏职业 -> 首杀公告 -> 公会围堵 -> 更大地图开放",
      targetAudience: "男频游戏入侵/抢机缘读者，偏好截胡、系统公告、资源滚雪球、原主角吃瘪。",
      commercialLoop: "每个事件都要结算：原本谁拿、现在谁拿、系统公告如何放大、谁因此报复。",
      requiredGenrePayload: ["ownershipTransfer", "statusGate"],
      benchmarkNotes: [
        "不要只写主角变强，必须写谁亏了。",
        "系统公告和公会反应是爽点放大器。",
        "十日倒计时要不断压缩行动窗口。",
      ],
    },
    borrowed_photo_romance: {
      id: "borrowed_photo_romance",
      title: "盗图网恋财阀继承人的线下见面倒计时",
      premise: "女主穿成盗用舍友照片网恋财阀继承人的恶毒女配，刚醒来就收到线下见面要求。她欠钱、盗图、原书会死，不能立刻坦白，只能在见面倒计时里不断拖延和补谎。",
      openingContainer: "宿舍醒来 -> 见面要求 -> 债务核算 -> 第一次拖延 -> 舍友照片风险 -> 男主到校 -> 谎言升级",
      targetAudience: "女频甜宠/穿书喜剧读者，偏好高压谎言、暧昧拉扯、财阀压迫、每章更危险但更甜。",
      commercialLoop: "每个事件都要结算：谎言有没有暂时活下来、暴露风险如何增加、债务/暧昧如何加深。",
      requiredGenrePayload: ["lieState"],
      benchmarkNotes: [
        "爽点不是胜利，而是又活过一章但谎更大。",
        "男主可能早知道，要持续制造猎人与猎物错位。",
        "舍友照片是身份炸弹，必须反复施压。",
      ],
    },
    time_stop_wasteland: {
      id: "time_stop_wasteland",
      title: "一分钟时停的第一次公开证明",
      premise: "废土少年每天只有一分钟时停。小镇危机中，他必须用极少时间完成子弹赌局、公开反杀和救场，让旁观者承认他不是普通人。",
      openingContainer: "能力确认 -> 子弹赌局 -> 公开战斗 -> 时停耗尽 -> 灭镇危机 -> 超凡资格",
      targetAudience: "男频废土异能读者，偏好能力限制、极限反杀、公开承认、疯狂策略。",
      commercialLoop: "每个事件都要结算：时停预算前后变化、误用代价、公开反应、下一次更高风险。",
      requiredGenrePayload: ["abilityBudget", "statusGate"],
      benchmarkNotes: [
        "能力强不够，限制必须比能力更有戏。",
        "每次使用时停都要让读者知道还剩多少。",
        "公开见证比私下胜利更爆。",
      ],
    },
  };
  return presets[id];
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    projectId: "",
    themePresetId: "project",
    maxTokens: 12000,
    evalOnly: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      parsed.projectId = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--episode") {
      parsed.episodeId = argv[index + 1];
      index += 1;
    } else if (arg === "--from") {
      parsed.chapterStart = parseInteger(argv[index + 1], "--from");
      index += 1;
    } else if (arg === "--to") {
      parsed.chapterEnd = parseInteger(argv[index + 1], "--to");
      index += 1;
    } else if (arg === "--theme-preset") {
      const value = argv[index + 1] as EpisodePlanLabThemePresetId | undefined;
      if (
        !value ||
        ![
          "project",
          "abnormal_containment",
          "game_invasion_opportunity",
          "borrowed_photo_romance",
          "time_stop_wasteland",
        ].includes(value)
      ) {
        throw new Error("--theme-preset must be one of: project, abnormal_containment, game_invasion_opportunity, borrowed_photo_romance, time_stop_wasteland");
      }
      parsed.themePresetId = value;
      index += 1;
    } else if (arg === "--max-tokens") {
      parsed.maxTokens = parseInteger(argv[index + 1], "--max-tokens");
      index += 1;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--eval-only") {
      parsed.evalOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.projectId) {
    throw new Error("Missing --project <id>");
  }
  if (
    parsed.chapterStart !== undefined &&
    parsed.chapterEnd !== undefined &&
    parsed.chapterEnd < parsed.chapterStart
  ) {
    throw new Error("--to must be >= --from");
  }
  return parsed;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repository = new FileProjectRepository();
  const project = await repository.loadStoryProject(args.projectId);
  if (!project) {
    throw new Error(`Project not found or incomplete: ${args.projectId}`);
  }

  const input = selectEpisodePlanLabInput({
    project,
    episodeId: args.episodeId,
    chapterStart: args.chapterStart,
    chapterEnd: args.chapterEnd,
    themePreset: themePresetById(args.themePresetId),
  });
  const messages = buildEpisodePlanLabMessages(input);
  const outputDir = path.resolve(
    process.cwd(),
    "data",
    "projects",
    args.projectId,
    "episode-plan-lab",
    input.episodeId,
  );
  await mkdir(outputDir, { recursive: true });
  await writeJson(path.join(outputDir, "prompt.json"), {
    task: "episode_plan_lab",
    messages,
  });

  if (args.dryRun) {
    console.log(`Prompt written: ${path.join(outputDir, "prompt.json")}`);
    return;
  }

  if (args.evalOnly) {
    const raw = await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(outputDir, "episode-plan-lab.result.json"), "utf-8"),
    );
    const result = JSON.parse(raw) as EpisodePlanLabResult;
    const evaluation = evaluateEpisodePlanLabResult(result, {
      knownCharacterIds: input.characters.map((character) => character.id),
      knownWorldFactIds: input.worldFacts.map((fact) => fact.id),
    });
    await writeJson(path.join(outputDir, "episode-plan-lab.eval.json"), evaluation);
    await writeFile(
      path.join(outputDir, "human-review.md"),
      formatEpisodePlanLabHumanReview({
        projectTitle: project.title,
        result,
        evaluation,
      }),
      "utf-8",
    );
    console.log(
      [
        `Episode plan lab eval refreshed: ${args.projectId}/${input.episodeId}`,
        `Auto score: ${evaluation.score}`,
        `Auto passed: ${evaluation.passed ? "yes" : "no"}`,
        `Evaluation: ${path.join(outputDir, "episode-plan-lab.eval.json")}`,
        `Human review: ${path.join(outputDir, "human-review.md")}`,
      ].join("\n"),
    );
    return;
  }

  const service = new LlmService();
  const generation = await service.generateObjectForTask({
    task: "episode_plan_lab",
    messages,
    schema: episodePlanLabResultSchema,
    temperature: 0.25,
    maxTokens: args.maxTokens,
  });
  const result = generation.object as EpisodePlanLabResult;
  const evaluation = evaluateEpisodePlanLabResult(result, {
    knownCharacterIds: input.characters.map((character) => character.id),
    knownWorldFactIds: input.worldFacts.map((fact) => fact.id),
  });

  await writeJson(path.join(outputDir, "episode-plan-lab.result.json"), result);
  await writeJson(path.join(outputDir, "episode-plan-lab.eval.json"), evaluation);
  await writeFile(
    path.join(outputDir, "human-review.md"),
    formatEpisodePlanLabHumanReview({
      projectTitle: project.title,
      result,
      evaluation,
    }),
    "utf-8",
  );

  console.log(
    [
      `Episode plan lab complete: ${args.projectId}/${input.episodeId}`,
      `Auto score: ${evaluation.score}`,
      `Auto passed: ${evaluation.passed ? "yes" : "no"}`,
      `Result: ${path.join(outputDir, "episode-plan-lab.result.json")}`,
      `Evaluation: ${path.join(outputDir, "episode-plan-lab.eval.json")}`,
      `Human review: ${path.join(outputDir, "human-review.md")}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
