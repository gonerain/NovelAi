# Task Brief Reference

A task brief is the human-authored input that drives the task-driven
semi-supervision flow described in `docs/sprint-0-task-driven-plan.md`.
The human submits a brief; the AI decomposer (Phase 2, not yet built)
turns it into 1–5 annotated beats; the existing chapter pipeline
generates the actual chapters.

Briefs are written in a YAML-like Markdown format. The parser is in
`src/domain/task-brief.ts`; it accepts the schema below and reports
errors before anything is persisted.

## Quick start

```
# Open the editor with a template, save to submit
./scripts/task-edit.sh --project demo_run_b

# Or submit a brief that's already on disk
./run-v1.sh task submit --project demo_run_b --from-file briefs/01-quiet-meal.md

# List or inspect submitted briefs
./run-v1.sh task list --project demo_run_b
./run-v1.sh task inspect --project demo_run_b --task-id 01-quiet-meal
```

## Schema

Required fields:

| Field | Description |
|---|---|
| `intent:` | 2–4 sentences. What should this task accomplish? |
| `characters:` | Bullet list of character ids. Mark POV with `(POV)`. |

Optional fields:

| Field | Description |
|---|---|
| `emotional-target:` | What emotional/relational vector should shift |
| `constraints:` | Things that must NOT happen anywhere in this task |
| `texture-must:` | Sensory or behavioural anchors that must show up |
| `chapter-budget:` | `auto` (default) / `auto (2-3)` / exact integer 1–10 |
| `pacing-hint:` | Free-text hint about pace |
| `preferred-shapes:` | Subset of the chapter-shape catalogue |
| `forbidden-shapes:` | Subset of the chapter-shape catalogue |
| `notes:` | Free-text notes |

Chapter shape catalogue (canonical 10):

```
plot_advance     pressure_buildup     confrontation     payoff
aftermath        character_moment     relationship_beat world_texture
interlude        reflection
```

Plot-pressure shapes (the four leftmost in the first row) count
toward the rolling pacing-budget window; the rest are non-plot.

## Example 1 — Relationship development (slow burn)

```markdown
# Task: 慢节奏共餐 — 建立日常信任

intent:
  让夜烬和沈知夏在没有案件压力的场合第一次安静共处。
  目的不是推进剧情，而是让关系积累一个具体的、能被后面引用的画面。

characters:
  - yejin (POV)
  - shenzhixia

emotional-target:
  从"战术联盟"细微滑向"被动信任"。沈知夏注意到夜烬变了，但没说。
  夜烬有一刻想道歉，最终问了别的。

constraints:
  - 不要让夜烬解释命书代价
  - 不要出现顾临川或白纸会
  - 不要让任何一个角色直接承认情绪

texture-must:
  - 至少一个具体的食物细节
  - 至少一个手部动作
  - 雨或地铁广播作为背景之一

chapter-budget: auto (1-2)

pacing-hint: this is a deliberate breath; the previous arc was plot-heavy.

forbidden-shapes:
  - confrontation
  - payoff

preferred-shapes:
  - relationship_beat
  - character_moment
  - aftermath
```

## Example 2 — Plot investigation arc

```markdown
# Task: 调查母亲合同 — 通过医院档案推进

intent:
  夜烬借由查母亲T-0007合同推进主线。沈知夏陪同，但沈知夏的角度
  提供新信息：她注意到合同签发日期与她父亲失踪同一周。

characters:
  - yejin (POV)
  - shenzhixia
  - linlu - 出现一次，留下一个不解之物

emotional-target:
  夜烬第一次意识到事情牵涉自己父辈。沈知夏第一次主动提供信息。

constraints:
  - 不要在这一任务里完整揭示父亲的角色
  - 林鹿出现的方式必须是间接的（一张照片、一份签字）

texture-must:
  - 医院档案室的味道（消毒水、旧纸）
  - 监控摄像头一闪一闪的红灯

chapter-budget: auto (2-3)

preferred-shapes:
  - plot_advance
  - investigate
  - pressure_buildup

forbidden-shapes:
  - payoff
```

## Example 3 — World texture (deliberately quiet)

```markdown
# Task: 城市侧写 — 让命书系统的日常感更真实

intent:
  花一章描绘命书系统在普通市民日常中的存在感。不通过任何主线
  人物的眼睛——以沈知夏地铁通勤时的旁观为主。

characters:
  - shenzhixia (POV)

emotional-target:
  让读者感到"这世界不是为剧情存在的"。提升世界的可信度。

constraints:
  - 主线人物只在背景中露脸（电视新闻一闪、广告牌）
  - 不要交代任何尚未揭示的设定
  - 不要推进任何线索

texture-must:
  - 至少3个不同人物的命书片段（一秒看见就过去）
  - 早高峰的拥挤感
  - 一个孩子第一次在父母身上看见红字的瞬间

chapter-budget: 1

forbidden-shapes:
  - plot_advance
  - confrontation
  - payoff
  - pressure_buildup

preferred-shapes:
  - world_texture
  - interlude
```

## Example 4 — Slow-down / aftermath chapter

```markdown
# Task: 余震 — 上一章揭示的代价开始落到沈知夏身上

intent:
  上一章揭示了夜烬替沈知夏背了红字。这一章只做一件事：让沈知夏
  独处时面对这件事。不要让她解决它，不要让她见任何人。让读者
  感受到代价已经真实存在了。

characters:
  - shenzhixia (POV)

emotional-target:
  从"被救" → "我欠了什么"的认知转变。无法告诉任何人。

constraints:
  - 夜烬不出现
  - 不要她做出任何决定（这一章是反应，不是行动）
  - 不要打开新案件线

texture-must:
  - 物理动作：把某样东西放下、又拿起来、又放下
  - 一个具体的小空间（浴室、楼梯间、地铁车厢角落）

chapter-budget: 1

preferred-shapes:
  - aftermath
  - reflection

forbidden-shapes:
  - plot_advance
  - confrontation
  - payoff
  - pressure_buildup
```

## What happens after submission

1. The brief is saved to `data/projects/<id>/tasks/<task-id>.json`.
2. `task list` shows it as `pending`.
3. (Phase 2, not yet built) `task decompose` runs the decomposer LLM
   to produce annotated beats; status flips to `decomposed`.
4. (Phase 2) `task generate` runs the existing chapter pipeline
   against the decomposed beats; status flips to `generating` →
   `complete`.
5. (Phase 5) `task review` shows the post-generation summary plus
   AI-suggested next-task hints.

## Validation rules (enforced at submit)

- `intent:` must be at least 8 characters.
- At least one character is required.
- `chapter-budget:` integers must be 1–10.
- A shape cannot appear in both `preferred-shapes` and
  `forbidden-shapes`.
- Unknown chapter shapes raise warnings (other shapes still parse).
- Duplicate top-level keys produce a warning; the later value wins.

## Cross-references

- Sprint plan: `docs/sprint-0-task-driven-plan.md`
- Chapter shape catalogue: `src/domain/beat-annotations.ts`
- Parser source: `src/domain/task-brief.ts`
- Tests: `src/domain/task-brief.test.ts`
