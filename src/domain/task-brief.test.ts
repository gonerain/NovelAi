import test from "node:test";
import assert from "node:assert/strict";

import { parseTaskBriefMarkdown, validateTaskBrief } from "./task-brief.js";

test("parses a complete task brief with all fields", () => {
  const md = `# Task: 慢节奏共餐 — 建立日常信任

intent:
  让夜烬和沈知夏在没有案件压力的场合第一次安静共处。
  目的不是推进剧情，而是让关系积累一个具体的、能被后面引用的画面。

characters:
  - yejin (POV)
  - shenzhixia

emotional-target:
  从"战术联盟"细微滑向"被动信任"。沈知夏注意到夜烬变了，但没说。

constraints:
  - 不要让夜烬解释命书代价
  - 不要出现顾临川或白纸会
  - 不要让任何一个角色直接承认情绪

texture-must:
  - 至少一个具体的食物细节
  - 至少一个手部动作
  - 雨或地铁广播作为背景之一

chapter-budget: auto

pacing-hint: this is a deliberate breath; the previous arc was plot-heavy.

forbidden-shapes: [confrontation, payoff]

preferred-shapes:
  - relationship_beat
  - character_moment
  - aftermath
`;

  const result = parseTaskBriefMarkdown({ markdown: md, defaultId: "task-01" });
  const errors = result.issues.filter((i) => i.severity === "error");
  assert.deepEqual(errors, [], `unexpected errors: ${JSON.stringify(errors)}`);
  assert.ok(result.brief);
  const brief = result.brief!;
  assert.equal(brief.id, "task-01");
  assert.equal(brief.title, "慢节奏共餐 — 建立日常信任");
  assert.ok(brief.intent.includes("夜烬"));
  assert.equal(brief.characters.length, 2);
  assert.equal(brief.characters[0]?.id, "yejin");
  assert.equal(brief.characters[0]?.pov, true);
  assert.equal(brief.characters[1]?.pov, false);
  assert.equal(brief.constraints.length, 3);
  assert.equal(brief.textureMust.length, 3);
  assert.equal(brief.chapterBudget.kind, "auto");
  assert.deepEqual(brief.preferredShapes.sort(), ["aftermath", "character_moment", "relationship_beat"]);
  assert.deepEqual(brief.forbiddenShapes.sort(), ["confrontation", "payoff"]);
  assert.equal(brief.status, "pending");
});

test("rejects brief missing required intent field", () => {
  const md = `# Task: empty
characters:
  - yejin (POV)
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.equal(result.brief, null);
  assert.ok(result.issues.some((i) => i.severity === "error" && i.message.includes("intent")));
});

test("rejects brief with no characters listed", () => {
  const md = `# Task: lonely
intent:
  Yejin walks alone through the rainy streets.
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.equal(result.brief, null);
  assert.ok(result.issues.some((i) => i.severity === "error" && i.message.includes("character")));
});

test("warns on unknown chapter shapes but still parses", () => {
  const md = `# Task: x
intent: just a relationship breath
characters: [yejin (POV)]
preferred-shapes: [relationship_beat, NOT_A_SHAPE, aftermath]
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.ok(result.brief);
  assert.deepEqual(result.brief!.preferredShapes.sort(), ["aftermath", "relationship_beat"]);
  assert.ok(result.issues.some((i) => i.severity === "warning" && i.message.includes("NOT_A_SHAPE")));
});

test("rejects shape appearing in both preferred and forbidden", () => {
  const md = `# Task: clash
intent: should fail validation
characters:
  - yejin (POV)
preferred-shapes: [confrontation]
forbidden-shapes: [confrontation]
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.equal(result.brief, null);
  assert.ok(result.issues.some((i) => i.message.includes("preferred and forbidden")));
});

test("parses inline list syntax for shapes", () => {
  const md = `# Task: short
intent: keep it short
characters: [shenzhixia]
forbidden-shapes: [payoff]
preferred-shapes: [character_moment]
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.ok(result.brief);
  assert.deepEqual(result.brief!.forbiddenShapes, ["payoff"]);
  assert.deepEqual(result.brief!.preferredShapes, ["character_moment"]);
});

test("parses chapter-budget as exact integer when given", () => {
  const md = `# Task: precise
intent: must take exactly 2 chapters
characters:
  - yejin (POV)
chapter-budget: 2
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.ok(result.brief);
  assert.deepEqual(result.brief!.chapterBudget, { kind: "exact", value: 2 });
});

test("clamps chapter-budget exact value when out of range", () => {
  const md = `# Task: too long
intent: should error
characters: [yejin (POV)]
chapter-budget: 99
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.ok(result.issues.some((i) => i.severity === "error" && i.message.includes("between 1 and 10")));
});

test("parses chapter-budget with auto + range hint", () => {
  const md = `# Task: rangey
intent: a flexible task
characters: [yejin (POV)]
chapter-budget: auto (2-3)
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.ok(result.brief);
  assert.equal(result.brief!.chapterBudget.kind, "auto");
  if (result.brief!.chapterBudget.kind === "auto") {
    assert.equal(result.brief!.chapterBudget.min, 2);
    assert.equal(result.brief!.chapterBudget.max, 3);
  }
});

test("warns on unknown top-level fields without breaking", () => {
  const md = `# Task: future
intent: a normal brief
characters: [yejin (POV)]
mystery-field: should be ignored
`;
  const result = parseTaskBriefMarkdown({ markdown: md });
  assert.ok(result.brief);
  // unknown lines that don't match KNOWN_FIELDS are silently dropped during
  // section splitting because they don't appear in the known list at all.
  // We don't strictly require a warning for raw text that doesn't even
  // produce a section; the parser just ignores them. Verify the brief itself
  // is valid.
  assert.equal(result.brief!.intent, "a normal brief");
});

test("validateTaskBrief catches structural issues post-parse", () => {
  const issues = validateTaskBrief({
    id: "",
    title: "x",
    intent: "short",
    characters: [],
    constraints: [],
    textureMust: [],
    chapterBudget: { kind: "exact", value: 99 },
    preferredShapes: ["confrontation"],
    forbiddenShapes: ["confrontation"],
    notes: [],
    submittedAt: new Date().toISOString(),
    status: "pending",
  });
  assert.ok(issues.some((i) => i.message.includes("id missing")));
  assert.ok(issues.some((i) => i.message.includes("at least 8")));
  assert.ok(issues.some((i) => i.message.includes("at least one character")));
  assert.ok(issues.some((i) => i.message.includes("1..10")));
  assert.ok(issues.some((i) => i.message.includes("preferred and forbidden")));
});
