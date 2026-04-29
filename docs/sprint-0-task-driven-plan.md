# Sprint 0: Task-Driven Semi-Supervision

A human gives the engine high-level direction — "develop trust between
A and B over a few quiet chapters", "introduce X's medical history
through Y's investigation", "slow everything down for one chapter
where nothing happens" — and the engine decomposes the task into
beats, decides how many chapters it should take, and executes through
the existing chapter pipeline.

The human is the showrunner. The engine is the writers' room *and*
the writer. The unit of human input is a **task brief**, not a beat
or a chapter.

This plan **supersedes** the previous sprint plans. Sprint 1
(humanistic engine with per-chapter Director) and the per-beat
directive variant are *deferred*; we'll only build pieces of them if
this sprint still leaves visible AI fingerprints.

## Why this is the right shape

Three claims:

1. **Human writers are good at intent and bad at typing.** They have
   strong opinions about *what should happen* — "she has to discover
   it without him saying it" — and weak patience for grinding out
   prose. Task briefs let the human work where they're cheap.
2. **AI is good at decomposition and bad at taste.** Given a clear
   intent, an LLM can produce 3 reasonable beat plans. Given a blank
   page, the LLM produces median web-fiction.
3. **Existing infrastructure already supports it.** `BeatOutline`
   has 17 fields; `outline approve-detail` already gates chapter
   generation; the writer already reads beat fields. We just need a
   decomposer in front, annotation parsing in the middle, and a
   review surface at the back.

The TV writers'-room metaphor is exact. The showrunner says "in
episode 4 the audience needs to *think* the brother is dead, then we
walk it back in episode 6." The room breaks that into actual scenes.
The writer drafts. We're building the room and the writer; the human
is the showrunner.

## What the human does (and does not do)

| Does | Does NOT |
|---|---|
| Submit task briefs (2–5 min each, every 3–7 chapters) | Write beats |
| Read post-task review surface (~5 min) | Plan chapters |
| Approve / reject decomposer output before generation | Pick scene shapes |
| Write a project-bootstrap interview at start | Hand-edit drafts |
| Optionally inject mid-task constraints ("slow down") | Track scheduler scores |

Total human effort: **~7–13 min per 3–5 chapter "arc"** ≈ **1.5–3 min
per chapter**. About a fifth of the per-beat-directive proposal and
nearly nothing compared to writing prose by hand.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Human (showrunner)                                               │
│   submits task brief                                             │
│   reviews post-task surface                                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │ task brief (Markdown / JSON)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Decomposer (AI · 1 LLM call per task)                            │
│   input: task brief + current state (characters, threads,        │
│   contracts, pacing window, last 3 beats, last chapter end-hook) │
│   output: ordered list of annotated beats, with reasoning        │
│           + chapter-count allocation                             │
└──────────────────────────────┬───────────────────────────────────┘
                               │ annotated beats appended to
                               │ beat-outlines.json
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Existing chapter pipeline (unchanged)                            │
│   episode plan → agency gate → planner → writer → reviews        │
│   → memory updater → role-drive → state deltas → thread update   │
│   → chapter_stats                                                │
│                                                                  │
│   BUT: writer prompt now elevates beat annotations               │
│   (shape / subtext / texture-must / forbidden / voice-cues)      │
│   above scheduler scores.                                        │
└──────────────────────────────┬───────────────────────────────────┘
                               │ N chapters generated against the
                               │ task's beats
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Review surface (CLI / UI later)                                  │
│   task brief recap + beats + per-chapter summary +               │
│   eval status + AI-suggested next-task hints                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
                       human writes next task
```

## Task brief format

Markdown is the human-friendly surface; the parser produces structured
`TaskBrief` objects.

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
  - 至少一个手部动作（伸手、停下、放下）
  - 雨或地铁广播作为背景之一

chapter-budget: auto (estimate 1-2)
pacing-hint: this is a deliberate breath; the previous arc was plot-heavy.
forbidden-shapes: [confrontation, payoff]
preferred-shapes: [relationship_beat, character_moment, aftermath]
```

Required fields: `intent`, `characters`. Everything else optional.

## Decomposer output

The decomposer produces a `TaskDecomposition` containing:

- `chapterCount`: 1–5 chapters allocated (with explicit reasoning)
- `beats`: ordered list, each with the existing `BeatOutline` fields
  *plus* annotations (`shape`, `subtext`, `textureMust`, `forbiddenInBeat`,
  `voiceCues`, `relationshipMoment`, `textureTargetChars`,
  `continuationHook`)
- `coherenceCommitments`: contract ids the decomposition commits to
  honour
- `reasoning`: 4–6 sentences in natural prose explaining the
  decomposition (chapter count, shape choices, what was deliberately
  excluded)

Persisted as `data/projects/<id>/tasks/<task-id>.json`. The beats are
appended to the existing `beat-outlines.json` so the chapter pipeline
sees them.

### Decomposer prompt sketch

System prompt (humanistic, no scoring):

```
You are the writers' room for a Chinese web-fiction serial. The
showrunner has handed you a task brief. Your job is to decide:

  1. How many chapters this task should take (1–5)
  2. What beats break the task into chapters
  3. What shape, subtext, and texture each beat carries
  4. What must explicitly NOT happen in this task

You think in scenes, characters, and what hasn't been said yet — not
in scheduler scores. The scheduler advisory is provided for context;
treat it as a hint about what's been neglected, not as a ranking.

Hard rules:
- Honour every contract id in `existingContracts.active`.
- Never produce a beat that violates `forbiddenMoves`.
- Respect `task.forbiddenShapes` and `task.constraints`.
- If `pacingNudge = expand_breathing` (provided in advisory),
  prefer non-plot shapes unless the task explicitly says
  "advance the plot".

Soft preferences:
- Pick chapter count based on what the task can sustain. Don't pad
  one task into 5 chapters; don't compress a relationship-development
  task into a single chapter.
- Each beat's `subtext` should describe what the POV character is
  hiding from others or themselves in that beat.
- `textureMust` should contain 2–4 concrete sensory or behavioural
  anchors the writer must enact (NOT plot facts).
- `relationshipMoment` should capture a specific remembered moment
  that future beats can reference back to ("第7章雨夜共餐时她注意到他手上新的伤").
- `continuationHook` is what carries the reader into the next chapter.
  For relationship/aftermath shapes, this can be quiet (e.g., "她
  没走"); not every hook is a cliffhanger.
```

## In scope (this sprint)

- **Task brief domain type** — `TaskBrief`, parser, validator
- **Decomposer LLM** — task brief → annotated beats + chapter count +
  reasoning
- **Beat annotation extension** — `shape`, `subtext`, `textureMust`,
  `forbiddenInBeat`, `voiceCues`, `relationshipMoment`,
  `textureTargetChars`, `continuationHook`. These extend (not replace)
  `BeatOutline`.
- **Writer prompt elevation** — beat annotations become first-class
  signals in the writer prompt, above scheduler scores
- **Pacing budget computation** — rolling 7-window over recent beat
  shapes; passed to decomposer as advisory
- **Review surface** — `task review` CLI command + formatter
- **Per-chapter coherence check** — lightweight LLM judge after each
  chapter: "did this chapter match the task's intent and constraints?"
- **`task` CLI commands**: `submit / decompose / list / review /
  inspect`

## Explicitly out of scope (defer)

- Scene granularity (Sprint 1 Phase A) — keep chapter as atomic for now
- Per-chapter Director deliberation (Sprint 1 Phase G) — task-level
  decomposition replaces this
- Voice profiles (Phase B) — `voiceCues` in beats serve as a manual
  proxy for now
- Sensory anchor bank (Phase E) — `textureMust` per beat is the
  manual proxy
- Relationship moments database (Phase C) — `relationshipMoment` per
  beat is the manual proxy
- Character agents (Phase H)
- UI for task ledger / review surface (Phase J) — CLI only this sprint
- Humanistic eval LLM judges beyond the per-chapter coherence check

## File targets

### New files

| File | Purpose |
|---|---|
| `src/domain/task-brief.ts` | `TaskBrief`, `TaskDecomposition`, parser, validator |
| `src/domain/task-brief.test.ts` | Parser + validator tests |
| `src/domain/beat-annotations.ts` | Extension fields layered on `BeatOutline` |
| `src/prompts/task-decomposer.ts` | `buildTaskDecomposerMessages` |
| `src/prompts/task-coherence.ts` | `buildTaskCoherenceJudgeMessages` |
| `src/v1-task.ts` | Workflows: `submitTask`, `decomposeTask`, `listTasks`, `reviewTask`, `inspectTask` |
| `src/v1-task-coherence.ts` | Per-chapter post-draft coherence check |
| `scripts/task-edit.sh` | Open task brief in `$EDITOR`; round-trip parse on save |
| `docs/task-brief-reference.md` | Documentation of the brief format with 4 example briefs (plot / relationship / world / slow-down) |

### Modified files

| File | Change |
|---|---|
| `src/domain/types.ts` | Extend `BeatOutline` with optional annotation fields (don't break existing data) |
| `src/domain/index.ts` | Re-export new modules |
| `src/v1-paths.ts` | Add `taskBriefPath`, `taskDecompositionPath`, `tasksDirPath` |
| `src/storage/file-project-repository.ts` | `saveTaskBrief / loadTaskBriefs / saveTaskDecomposition` |
| `src/storage/project-repository.ts` | Interface additions |
| `src/prompts/writer.ts` | Elevate beat annotations above scheduler scores in prompt assembly |
| `src/v1-chapter-generation.ts` | After draft + reviews, run task-coherence check; mark chapter as `task-coherent: true|false` in `chapter_stats.json` |
| `src/v1-lib.ts` | Re-export task workflows |
| `src/v1.ts` | New CLI: `task submit/decompose/list/review/inspect` |
| `src/v1-formatters.ts` | Formatters for `TaskBrief`, `TaskDecomposition`, review surface |
| `scripts/generate-project.sh` | Optional `--task <id>` flag to scope generation to a task's chapter range |

11 new files, 7 modified. Comparable to sprint 1's footprint, but
each piece is simpler (no scene granularity / no per-chapter
director).

## Phases

### Phase 1 — Domain types + storage (no LLM)

- [ ] `TaskBrief` type with required `intent` + `characters`,
  optional fields per the Markdown schema above
- [ ] Markdown parser (`task-edit.sh` opens a template; on save,
  parse + validate)
- [ ] Storage at `data/projects/<id>/tasks/<task-id>.json`
- [ ] `task submit` CLI that creates a brief from `$EDITOR` template
  or from a `--from-file` argument

Acceptance: a task brief can be submitted, parsed, validated, and
inspected without any LLM call.

### Phase 2 — Decomposer LLM (one call per task)

- [ ] `buildTaskDecomposerMessages` prompt builder
- [ ] `decomposeTask({ projectId, taskId })`:
  1. Load the task brief
  2. Load current state: contracts, threads (advisory), recent beat
     shapes, last chapter end-hook, active characters with
     decisionProfile, pacing budget
  3. Build messages, route through `generateStructuredTaskWithRetry`
  4. Validate output schema (chapter count 1-5, beats non-empty,
     contract ids subset of project, no forbidden moves)
  5. Append beats to `beat-outlines.json` with task-id provenance
  6. Persist `TaskDecomposition` at
     `data/projects/<id>/tasks/<task-id>.decomposition.json`
- [ ] CLI: `task decompose --project <id> --task <id>`

Acceptance: decomposer produces 2-5 beats with valid shape +
subtext + texture annotations for each of 4 example task types
(plot, relationship, world, slow-down).

### Phase 3 — Writer prompt elevation

- [ ] `BeatOutline` extended with optional `shape`, `subtext`,
  `textureMust`, `forbiddenInBeat`, `voiceCues`,
  `relationshipMoment`, `textureTargetChars`, `continuationHook`
- [ ] In `prompts/writer.ts`, when current beat has annotations:
  - Add a "Beat shape: X" signal at top of the user message
  - Add "Subtext for POV: <subtext>" as a primary instruction
  - Add "Texture must include: <textureMust>" as Soft preferences
  - Add "Forbidden in this beat: <forbiddenInBeat>" as hard avoid
  - Add "Continuation hook target: <continuationHook>" near the end
  - Push scheduler-derived signals (urgency etc.) below these
- [ ] No change when annotations are absent (legacy projects unaffected)

Acceptance: drafts generated against annotated beats demonstrably
follow shape/subtext/texture directives in spot checks.

### Phase 4 — Per-chapter coherence check

- [ ] `buildTaskCoherenceJudgeMessages` — input: task brief + the
  generated chapter draft. Output: `coherent: true|false` +
  `concerns: string[]`
- [ ] Run after the existing reviews + memory updater
- [ ] Persist `coherent` and `concerns` into `chapter_stats.json`
- [ ] If `coherent === false`, log a warning but do not block —
  surface in review surface

Acceptance: the coherence judge reliably flags chapters whose
events contradict the task's `forbidden` list or whose shape
diverges from the beat.

### Phase 5 — Review surface

- [ ] `task review --project <id> --task <id>` shows:
  - the original task brief
  - the decomposition (chapter count, beats, decomposer reasoning)
  - per-chapter summary: chapter number, title, shape used,
    cn_chars, agency score, coherence flag, key turn
  - any runtime-eval warnings during the task's chapters
  - **AI-suggested next-task hints**: 2-3 short suggestions
    derived from current state (open promises, neglected
    relationships, stale threads, pacing budget shape)
- [ ] `task list` shows all tasks for a project with status:
  `pending | decomposed | generating | complete | reviewed`

Acceptance: a human can read the review surface in 5 minutes and
have enough context to write the next task brief.

### Phase 6 — Pacing budget integration

- [ ] Add `computePacingBudget` over recent beat shapes (window 7)
- [ ] Pass `pacingNudge` to the decomposer as advisory in the
  prompt user message
- [ ] Surface `pacingNudge` in review surface ("you've been plot-
  pressing for 4 chapters; next task should breathe")

Acceptance: when the recent window has 4+ plot shapes, the
decomposer prefers non-plot shapes unless the task explicitly
overrides.

## Acceptance gates (sprint level)

The sprint is *not* declared complete until all hold on a fresh
project (`demo_run_b_taskdriven`):

1. **3 example task types decompose successfully** end-to-end:
   - "Develop trust through quiet meal" (relationship)
   - "Investigate the gold-debt mark via medical archives" (plot)
   - "Slow down for one chapter where Yejin walks home" (slow-down)
2. **At least 2 of 10 chapters generated have non-plot shape**
   (`relationship_beat`, `character_moment`, `aftermath`,
   `world_texture`, `interlude`, or `reflection`).
3. **Per-chapter coherence check is wired and reports coherent =
   true** for ≥80% of generated chapters.
4. **Runtime eval has no hard failures** on the task-driven chapters.
5. **`task review` is human-readable** — narrative reasoning, not
   a JSON dump.
6. **Existing test suite still passes** (`npm run check`,
   `npm test`).
7. **Total human effort to produce 10 chapters from 3 task briefs
   is under 30 minutes** (timing recorded; aim ≤ 3 min per chapter
   amortised).
8. **Beat annotations round-trip** — the writer prompt elevation
   demonstrably shows up in the prompt debug output for at least
   one chapter.

## A/B test protocol

### Setup

```
cp -r data/projects/demo_run_b data/projects/demo_run_b_baseline
cp -r data/projects/demo_run_b data/projects/demo_run_b_taskdriven
# Reset chapters/eval on both
```

Both projects share identical premise/contracts/threads/outline/
characters. The baseline runs the existing scheduler engine. The
task-driven run generates 10 chapters from 3 task briefs (≈ 3-4
chapters per task).

### Generation

```
# Baseline: existing engine, scheduler-driven, 10 chapters
./scripts/generate-project.sh \
    --project demo_run_b_baseline --count 10 \
    --with-offscreen --with-runtime-eval

# Task-driven: 3 briefs decomposed, ~10 chapters
./run-v1.sh task submit --project demo_run_b_taskdriven \
    --from-file briefs/01-trust-through-meal.md
./run-v1.sh task decompose --project demo_run_b_taskdriven --task 01
./run-v1.sh task generate --project demo_run_b_taskdriven --task 01

./run-v1.sh task submit --project demo_run_b_taskdriven \
    --from-file briefs/02-investigate-medical-archive.md
./run-v1.sh task decompose --project demo_run_b_taskdriven --task 02
./run-v1.sh task generate --project demo_run_b_taskdriven --task 02

./run-v1.sh task submit --project demo_run_b_taskdriven \
    --from-file briefs/03-quiet-walk-home.md
./run-v1.sh task decompose --project demo_run_b_taskdriven --task 03
./run-v1.sh task generate --project demo_run_b_taskdriven --task 03
```

### Blind-mix bundle

`scripts/blind-mix-chapters.py` (built once, reusable across sprints):
shuffle 20 chapters with reproducible seed; render to plain Markdown
without engine-revealing headers; produce `manifest.json` (held by
the test admin) + `survey.md` (given to readers).

### Reader survey (6–8 readers)

Per chapter, each reader answers:

1. **AI-written or human-written?** (`AI` / `Human` / `Unsure`)
2. **Readability** (1–5)
3. **Character aliveness** (1–5)
4. **Continue-reading intent** (1–5)
5. **Plot summary vs lived fiction** (1–5)

After all 20 chapters: pick 3 chapters that surprised you in
either direction; one sentence each.

### Hypothesis

Task-driven chapters score **lower median AI-identification rate OR
higher median character-aliveness OR higher continue-reading
intent**, with confidence intervals not overlapping baseline.

## Cost estimate

Per task: 1 decomposer call (~6k input / ~3k output) + N chapters
× existing pipeline (~10–11 calls each) + N coherence-judge calls
(~2k each). Net: roughly **+0.4 calls per chapter amortised**.

For 10 chapters across 3 tasks: 3 decomposer + ~110 chapter calls
+ 10 coherence checks ≈ **123 LLM calls**. Comparable to the
baseline 10-chapter run.

## Sprint exit decision tree

```
After A/B completes:

  Reader hypothesis confirmed (lower AI-id OR higher aliveness OR
  higher continue intent)?
  ├── YES (any one moves) →
  │     - keep task-driven as the production mode
  │     - phase 2 follow-up: build review-surface UI (Phase J slice)
  │     - phase 2 follow-up: extract recurring textureMust into
  │       sensory-anchor bank (Phase E auto-bootstrap)
  │     - phase 2 follow-up: extract recurring voiceCues into
  │       voice profiles (Phase B auto-bootstrap)
  │
  └── NO  → are coherence checks failing > 30%?
            ├── YES → decomposer prompt or annotation elevation is
            │        weak; iterate on those before declaring
            │        architectural verdict.
            │
            └── NO  → annotations land but don't change reader
                     experience. The bottleneck is per-scene voice
                     fidelity. Build sprint 1 Phase A (scene
                     granularity) + Phase H (character agents) on
                     top of the task-driven decomposer.
```

## Risks

1. **Decomposer over-allocates chapters per task.** Mitigation:
   prompt cap at 5; if more is needed, the human submits a
   follow-up task. Chapter count is part of the brief's
   `chapter-budget` hint; `auto` lets the LLM decide bounded.

2. **Decomposer under-uses non-plot shapes by default.**
   Mitigation: pacing-nudge advisory; example-driven prompt; if
   acceptance gate 2 (≥2 of 10 non-plot) fails, tighten the prompt
   with explicit shape distribution targets.

3. **Beat annotations get diluted in writer prompt.** Mitigation:
   prompt-debug write-out lets us see exactly how annotations
   appear in the user message; spot-check during phase 3.

4. **Per-chapter coherence judge is noisy.** Mitigation: it's
   advisory only this sprint, not gating. If signal is poor, defer
   to LLM judges later (Phase I).

5. **Human writes task briefs that are too vague.** Mitigation:
   the brief template + 4 example briefs + the validator that
   requires `intent` + `characters` minimum. If still vague,
   decomposer can ask one clarifying question via a `task clarify`
   loop in a follow-up.

6. **Existing scheduler engine still drives sub-task decisions
   (mode/payoff selection).** Acceptable: the scheduler stays as
   guardrail; what changes is the *source of beat texture*. If
   the scheduler over-rides annotation choices, the writer prompt
   elevation in phase 3 should keep annotations dominant.

## Concrete example

**Day 1 (2 min):** Human submits `01-trust-through-meal.md` (the
task brief shown earlier).

**Day 1 (5 min):** `task decompose` produces:

- Chapter count: 2
- Beat 7: "夜烬带沈知夏去公寓楼下早餐铺" — `shape: relationship_beat`,
  `subtext: 想确认她是否还信任自己`, `textureMust: [豆浆漏在桌上 / 老板娘多看一眼 / 她把围巾绕进衣领里]`, `forbidden: [提案件 / 直接问对方感受]`,
  `relationshipMoment: 第一次共餐`, `continuationHook: 她没问他为什么沉默`
- Beat 8: "雨夜地铁回程" — `shape: aftermath`, `subtext: 回放了三遍他没说出口的那句话`, `textureMust: [车厢报站 / 玻璃上水痕 / 他留的座位]`, `forbidden: [新案件 / 与顾临川相关]`, `continuationHook: 第二天她迟到`
- Reasoning (5 sentences) explaining the choice.

**Day 1 (10 min):** Engine generates 2 chapters. Coherence judge
passes both.

**Day 1 (5 min):** `task review` shows:
- Brief recap
- Both chapter summaries with shape, length, key turn, agency
- "Suggested next tasks: (1) Yejin's mother's hospital visit
  surfaces an old debt; (2) Shen Zhixia's coworker confronts her
  about the sudden coat change."

**Day 2 (2 min):** Human picks suggestion (2), edits slightly,
submits as task 02.

Cycle repeats. Total human time: ~20 min for 5 chapters. ~4 min
per chapter, well below the 5-min budget.

## Cross-references

- Engine vision: `docs/longform-narrative-engine-roadmap.md`
- Architecture diagram: `docs/architecture-diagram.md`
- Future humanistic layer (deferred):
  `docs/archive/character-driven-narrative-roadmap.md`
- Sprint 1 plan (deferred — superseded by this sprint):
  `docs/archive/sprint-1-humanistic-plan.md`

## Decision

If the A/B confirms the hypothesis, **task-driven semi-supervision
becomes the production mode**, and we incrementally add:

- review-surface UI (Phase J slice)
- automatic voice-cue + sensory-anchor extraction (Phase B + E
  auto-bootstrap from observed annotations)
- finer-grained scene work (Sprint 1 Phase A) only if the
  remaining gap is at scene texture level

If the A/B fails, we have concrete signal about whether the
bottleneck is annotation-elevation or scene/voice fidelity, and
sprint 1 becomes the targeted next bet.
