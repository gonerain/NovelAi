import {
  normalizeAuthorInterviewResult,
  validateAuthorInterviewResult,
} from "./domain/index.js";
import {
  authorInterviewResultSchema,
  buildAuthorInterviewMessages,
} from "./prompts/author-interview.js";
import { LlmService } from "./llm/service.js";

async function main(): Promise<void> {
  const service = new LlmService();

  const messages = buildAuthorInterviewMessages({
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

  const rawResult = await service.generateObjectForTask({
    task: "author_interview",
    messages,
    schema: authorInterviewResultSchema,
    temperature: 0.2,
    maxTokens: 4000,
  });

  const normalizedResult = normalizeAuthorInterviewResult(rawResult.object);
  const validationIssues = validateAuthorInterviewResult(normalizedResult);

  console.log("=== RAW DISPLAY ===");
  console.log(JSON.stringify(rawResult.object.display, null, 2));
  console.log("\n=== NORMALIZED RESULT ===");
  console.log(JSON.stringify(normalizedResult.normalized, null, 2));
  console.log("\n=== VALIDATION ISSUES ===");
  console.log(JSON.stringify(validationIssues, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
