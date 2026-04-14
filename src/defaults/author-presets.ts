import type { AuthorInterviewSessionInput } from "../domain/index.js";

export interface AuthorPresetQuestion {
  id: string;
  questionId: string;
  question: string;
  options: Array<{
    key: "A" | "B" | "C";
    label: string;
    answerText: string;
  }>;
}

export interface AuthorInterviewPreset {
  id: string;
  name: string;
  description: string;
  interviewInput: AuthorInterviewSessionInput;
}

export const authorPresetQuestions: AuthorPresetQuestion[] = [
  {
    id: "q1",
    questionId: "theme_core",
    question: "你更想写哪种核心冲突？",
    options: [
      {
        key: "A",
        label: "权力博弈与背叛",
        answerText:
          "I want stories about ambition, betrayal, delayed justice, and the cost of power.",
      },
      {
        key: "B",
        label: "情感修复与关系拉扯",
        answerText:
          "I want stories about emotional repair, misrecognition, and hard-won trust after damage.",
      },
      {
        key: "C",
        label: "悬疑调查与真相揭露",
        answerText:
          "I want stories about truth versus survival, and the cost of exposing hidden systems.",
      },
    ],
  },
  {
    id: "q2",
    questionId: "character_bias",
    question: "你偏好的主角类型是？",
    options: [
      {
        key: "A",
        label: "高能理性派，擅长算计",
        answerText:
          "I prefer highly competent strategic leads who weaponize calm under pressure.",
      },
      {
        key: "B",
        label: "受伤克制派，情绪内敛",
        answerText:
          "I favor restrained and wounded leads who hide pain behind discipline.",
      },
      {
        key: "C",
        label: "灰度行动派，道德模糊",
        answerText:
          "I like morally gray survivors who choose practical evil over naive idealism.",
      },
    ],
  },
  {
    id: "q3",
    questionId: "relationship_pattern",
    question: "你偏好的关系推进方式是？",
    options: [
      {
        key: "A",
        label: "互相利用到互相牵制",
        answerText:
          "I like alliances built on leverage that slowly turn into conflicted loyalty.",
      },
      {
        key: "B",
        label: "误解回避到迟到坦白",
        answerText:
          "I like deep bonds hidden under avoidance, testing, and costly late confession.",
      },
      {
        key: "C",
        label: "合作查案到立场分裂",
        answerText:
          "I like partnerships that crack under secrecy and competing agendas.",
      },
    ],
  },
  {
    id: "q4",
    questionId: "plot_bias",
    question: "你偏好的剧情推进节奏是？",
    options: [
      {
        key: "A",
        label: "层层博弈+硬反转",
        answerText:
          "I prefer layered conspiracies, hard reversals, and tactical wins with strategic losses.",
      },
      {
        key: "B",
        label: "慢燃铺垫+情绪爆点",
        answerText:
          "I prefer slow burn pacing with concentrated emotional breakpoints and irreversible turns.",
      },
      {
        key: "C",
        label: "线索链推进+连续揭示",
        answerText:
          "I prefer clue-lattice progression where every answer creates a larger question.",
      },
    ],
  },
  {
    id: "q5",
    questionId: "ending_bias",
    question: "你能接受哪种结局调性？",
    options: [
      {
        key: "A",
        label: "苦涩但胜利",
        answerText:
          "I prefer bitter-precise endings: they may win the war but lose a private world.",
      },
      {
        key: "B",
        label: "遗憾但和解",
        answerText:
          "I prefer bittersweet but emotionally complete endings where repair carries real cost.",
      },
      {
        key: "C",
        label: "真相落地但关系破碎",
        answerText:
          "I prefer truth-forward endings where revelation succeeds but key relationships fracture.",
      },
    ],
  },
  {
    id: "q6",
    questionId: "aesthetic_private_goods",
    question: "你偏好的审美母题是？",
    options: [
      {
        key: "A",
        label: "冷城、议会、账本、密谋",
        answerText:
          "I like cold weather, decaying cities, coded messages, debt ledgers, and council confrontations.",
      },
      {
        key: "B",
        label: "夜雨、旧伤、照料、沉默",
        answerText:
          "I like night rain, old wounds, caregiving gestures, silence, and controlled dialogue.",
      },
      {
        key: "C",
        label: "档案、封印、符号、程序压力",
        answerText:
          "I like archives, sealed files, urban ruins, coded symbols, and procedural pressure scenes.",
      },
    ],
  },
];

export const defaultAuthorPresetId = "power_intrigue";

export const authorInterviewPresets: AuthorInterviewPreset[] = [
  {
    id: "power_intrigue",
    name: "权谋背叛流",
    description: "高压博弈、算计反噬、胜利带代价。",
    interviewInput: {
      userRawAnswers: [
        {
          questionId: "theme_core",
          answer:
            "I want stories about ambition, betrayal, delayed justice, and the cost of power.",
        },
        {
          questionId: "character_bias",
          answer:
            "I prefer highly competent but morally strained leads who weaponize calm under pressure.",
        },
        {
          questionId: "relationship_pattern",
          answer:
            "I like alliances built on leverage that slowly turn into conflicted loyalty.",
        },
        {
          questionId: "plot_bias",
          answer:
            "I prefer layered conspiracies, hard reversals, and tactical wins with strategic losses.",
        },
        {
          questionId: "ending_bias",
          answer:
            "Bitter-precise endings: they may win the war but lose a private world.",
        },
        {
          questionId: "aesthetic_private_goods",
          answer:
            "I like cold weather, decaying cities, coded messages, debt ledgers, and council confrontations.",
        },
      ],
    },
  },
  {
    id: "slowburn_bond",
    name: "慢燃关系流",
    description: "克制情感、迟到坦白、修复有代价。",
    interviewInput: {
      userRawAnswers: [
        {
          questionId: "theme_core",
          answer:
            "I want to write about self-understanding, forgiveness with cost, and learning to accept rescue.",
        },
        {
          questionId: "character_bias",
          answer:
            "I favor restrained characters with hidden wounds, stubborn pride, and quiet tenderness.",
        },
        {
          questionId: "relationship_pattern",
          answer:
            "Two people matter deeply but keep missing each other until late confession.",
        },
        {
          questionId: "plot_bias",
          answer:
            "Slow burn pacing with concentrated emotional peaks and irreversible turning points.",
        },
        {
          questionId: "ending_bias",
          answer:
            "Bittersweet but complete ending, where emotional truth finally lands.",
        },
        {
          questionId: "aesthetic_private_goods",
          answer:
            "Night rain, old wounds, caregiving gestures, silence, and controlled dialogue.",
        },
      ],
    },
  },
  {
    id: "mystery_hunt",
    name: "悬疑追真流",
    description: "线索链推进、多重误导、真相反噬。",
    interviewInput: {
      userRawAnswers: [
        {
          questionId: "theme_core",
          answer:
            "I want stories about truth versus survival, and the cost of uncovering hidden systems.",
        },
        {
          questionId: "character_bias",
          answer:
            "I prefer observant investigators, compromised witnesses, and charismatic liars.",
        },
        {
          questionId: "relationship_pattern",
          answer:
            "Partnerships should be useful first, then tested by secrecy and competing agendas.",
        },
        {
          questionId: "plot_bias",
          answer:
            "I like clue lattices, progressive reveals, and each answer creating a larger question.",
        },
        {
          questionId: "ending_bias",
          answer:
            "Truth can be exposed, but someone important must pay for it.",
        },
        {
          questionId: "aesthetic_private_goods",
          answer:
            "Archives, sealed files, urban ruins, coded symbols, and procedural pressure scenes.",
        },
      ],
    },
  },
];

export function getAuthorInterviewPresetById(
  presetId?: string,
): AuthorInterviewPreset {
  if (!presetId) {
    return (
      authorInterviewPresets.find((item) => item.id === defaultAuthorPresetId) ??
      authorInterviewPresets[0]
    );
  }

  return (
    authorInterviewPresets.find((item) => item.id === presetId) ??
    authorInterviewPresets.find((item) => item.id === defaultAuthorPresetId) ??
    authorInterviewPresets[0]
  );
}

export function formatAuthorPresetCatalog(): string {
  const lines: string[] = [];
  lines.push("Author Profile Quiz:");
  for (const question of authorPresetQuestions) {
    lines.push(`${question.id}. ${question.question}`);
    for (const option of question.options) {
      lines.push(`   - ${option.key}. ${option.label}`);
    }
  }
  lines.push("");
  lines.push("Available presets:");
  for (const preset of authorInterviewPresets) {
    const defaultMark = preset.id === defaultAuthorPresetId ? " (default)" : "";
    lines.push(`- ${preset.id}${defaultMark}: ${preset.name} | ${preset.description}`);
  }
  lines.push("");
  lines.push("Use:");
  lines.push("  ./run-v1.sh project bootstrap --project <id> --profile <preset_id>");
  lines.push("  ./run-v1.sh project interview --project <id> --answers A,B,C,A,B,C");
  return lines.join("\n");
}

export function buildInterviewInputFromQuizAnswers(
  answersRaw: string,
  targetProject?: { title?: string; premise?: string; themeHint?: string },
): AuthorInterviewSessionInput {
  const answers = answersRaw
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const userRawAnswers = authorPresetQuestions.map((question, index) => {
    const picked = answers[index] ?? "A";
    const option =
      question.options.find((item) => item.key === picked) ?? question.options[0];
    return {
      questionId: question.questionId,
      answer: option.answerText,
    };
  });

  return {
    userRawAnswers,
    targetProject,
  };
}
