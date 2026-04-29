# Sprint 1: Humanistic Layer (A + D-lite + F + G)

Minimal first-sprint plan to test whether scene-level planning, chapter
shape selection, and natural-language director deliberation can reduce
plot-only behaviour and make chapters feel more human.

## Goal

Prove (or disprove) one architectural claim:

> Replacing numeric-scheduler chapter selection with a Director that
> reasons in natural language, paired with scene-granular drafting and
> a chapter-shape catalogue that legalises zero-major-plot chapters,
> produces chapters that read as more human than the current engine on
> the same project state.

If a 6–8 reader blind survey supports this, we expand into Phases B/C/E
(voice profiles, relationship moments, sensory anchors).

If it doesn't: the architecture isn't the bottleneck — model choice,
retrieval, or prompt baseline is. Different fix path.

## In scope

- **A — Scene granularity.** Each chapter is composed of 2–5 scene
  packets, written one at a time and concatenated.
- **D-lite — Single subtext string per scene.** *Not* a full
  `subtextPerCharacter` map. One free-text field captures what the POV
  character is hiding from others / from themselves in this scene.
- **F — Chapter shape catalogue + pacing budget.** Open enum with at
  least 4 non-plot shapes; rolling-7-window pacing eval becomes
  advisory but tracked.
- **G — Director deliberation.** A single LLM call per chapter that
  receives scheduler/contracts/recent-history *as advice*, produces
  chapter shape + scene roster + per-scene subtext string + 3–5
  sentence narrative reasoning.

## Explicitly out of scope (defer to later sprints)

- B — Character voice profiles
- C — Relationship moments database
- E — Sensory anchor bank
- H — Character agents (per-scene voice-coloured writers)
- I — Humanistic eval dashboard / LLM judges
- J — UI for scene timeline / voice / moments / anchors

## Required artifacts (this sprint only)

```ts
// src/domain/scene.ts (new)
export type ChapterShape =
  | "plot_advance"
  | "pressure_buildup"
  | "confrontation"
  | "payoff"
  | "aftermath"
  | "character_moment"
  | "relationship_beat"
  | "world_texture"
  | "interlude"
  | "reflection";

export interface ScenePacket {
  id: string;                     // "scene-001-002"
  chapterNumber: number;
  sceneNumber: number;            // 1-based within the chapter
  povCharacterId: string;
  participants: string[];
  setting: string;
  visibleAction: string;          // what the POV is observably doing
  scenePurpose: string;           // why this scene exists in this chapter
  turn: string;                   // the value shift at end-of-scene
  subtext: string;                // D-lite: one free-text string
  plotBudget: "high" | "medium" | "low" | "none";
  relationshipBudget: "high" | "medium" | "low" | "none";
  wordTarget: number;             // rough cn_chars target, 600-1500
}

export interface PacingBudget {
  windowSize: number;             // 7 by default
  shapesInWindow: ChapterShape[]; // most recent N chapter shapes
  nonPlotChapterCount: number;    // count in window
  consecutivePlotPressure: number;// run-length of recent plot shapes
  passes: boolean;                // ≥2 non-plot in window AND ≤3 consecutive plot
}

export interface DirectorBrief {
  chapterNumber: number;
  generatedAt: string;
  chapterShape: ChapterShape;
  sceneRoster: Array<Omit<ScenePacket, "id">>;
  schedulerAdvisory: {
    primaryThreadId: string | null;
    schedulerWarnings: string[];
    economyWarnings: string[];
    pacingNudge: "expand_breathing" | "allow_plot" | "neutral";
  };
  narrativeReasoning: string;     // 3-5 sentences in natural language
  contractsHonoured: string[];    // contract ids the director commits to respect
  forbiddenMoves: string[];       // forbidden moves carried from contracts
}
```

`ScenePacket.id` follows `scene-{chapter:03d}-{scene:02d}`.

## File targets

### New files

| File | Purpose |
|---|---|
| `src/domain/scene.ts` | `ChapterShape` enum, `ScenePacket`, `PacingBudget`, `computePacingBudget()` |
| `src/domain/scene.test.ts` | Unit tests for pacing budget |
| `src/domain/director.ts` | `DirectorBrief` type, normalisation, validation |
| `src/domain/director.test.ts` | Unit tests for brief shape validation |
| `src/prompts/director.ts` | `buildDirectorMessages` (LLM prompt builder) |
| `src/prompts/scene-writer.ts` | `buildSceneWriterMessages` (per-scene prompt) |
| `src/v1-director.ts` | `planDirectorBrief`, `inspectDirectorBrief`, schema for retry helper |
| `src/v1-scene.ts` | `writeChapterFromScenes` — orchestrates per-scene writer + concat |
| `scripts/run-ab-experiment.sh` | Run both engines on the same project |
| `scripts/blind-mix-chapters.py` | Produce shuffled blind-mix bundle for the reader survey |
| `docs/sprint-1-survey.md` | Reader survey instructions and questions |

### Modified files

| File | Change |
|---|---|
| `src/domain/index.ts` | Re-export `scene` and `director` modules |
| `src/domain/types.ts` | (no schema changes; `ScenePacket` lives in `scene.ts`) |
| `src/v1-paths.ts` | Add `chapterDirectorBriefPath`, `chapterSceneIndexPath`, `chapterScenePath(chapter, scene)` |
| `src/v1-chapter-generation.ts` | New `humanistic` branch: director plan → scene packets → per-scene writer → concat → reviews → memory updater. Legacy branch preserved. |
| `src/v1-lib.ts` | Re-export `planDirectorBrief`, `inspectDirectorBrief`, `writeChapterFromScenes` |
| `src/v1.ts` | New CLI: `director plan/inspect`, `scene inspect`. New `--humanistic` flag on `chapter generate*`. |
| `src/v1-formatters.ts` | Formatters for `DirectorBrief` and scene index |
| `scripts/generate-project.sh` | New `--humanistic` flag forwards to `chapter generate-first` |

## Phase F1 — Chapter shape catalogue + pacing budget

**No LLM. Pure logic.**

### Tasks

- [ ] Add `ChapterShape` enum and a constant `PLOT_PRESSURE_SHAPES` set
  containing `plot_advance`, `pressure_buildup`, `confrontation`,
  `payoff`. Everything else is "non-plot" for pacing purposes.
- [ ] Implement `computePacingBudget({ recentShapes, windowSize = 7 })`:
  - `nonPlotChapterCount = recentShapes.filter(s => !PLOT_PRESSURE_SHAPES.has(s)).length`
  - `consecutivePlotPressure = trailing run-length of plot shapes in
    recentShapes`
  - `passes = nonPlotChapterCount >= 2 && consecutivePlotPressure <= 3`
  - Returns `pacingNudge`:
    - `expand_breathing` if `consecutivePlotPressure >= 3` OR
      `nonPlotChapterCount < 2`
    - `allow_plot` if last 2 chapters were both non-plot
    - `neutral` otherwise
- [ ] Add a path helper `chapterDirectorBriefPath(projectId, n)` →
  `chapters/chapter-NNN/director_brief.json`.

### Acceptance

- 4+ unit tests pass (passes/fails for boundary cases of the budget).
- No code change to existing eval pipeline; runtime eval continues to
  pass on `demo_run_b`.

## Phase A1 — Scene granularity

**Deterministic plumbing first; LLM uses it later.**

### Tasks

- [ ] Add `ScenePacket` type and `chapterScenePath`,
  `chapterSceneIndexPath` helpers.
- [ ] Add storage:
  - `chapters/chapter-NNN/scenes/scene-NNN-MM.json` per scene packet
  - `chapters/chapter-NNN/scene_index.json` listing the ordered ids
- [ ] Add CLI commands `scene inspect --project --chapter [--scene]`
  and a formatter that prints the index + per-scene summary.
- [ ] No writer integration yet — `writeChapterFromScenes` is built
  in Phase G1 once director output is in shape.

### Acceptance

- A scene index can be hand-written and inspected.
- `scene inspect` prints the index without LLM calls.

## Phase G1 — Director deliberation

**LLM. The single new model call this sprint introduces.**

### Director prompt sketch

System prompt (humanistic, no scoring):

```
You are the showrunner of a Chinese web-fiction serial. You are
breaking the next chapter for your writers' room. You think in
scenes, characters, mood, what hasn't been said yet — not in
scheduler scores.

Inputs you receive:
- the existing premise, current arc goal, contracts, forbidden moves
- a snapshot of recent chapter shapes, pacing window, and scheduler
  advisory (urgency / readerDebt / staleness on top threads). Treat
  these as ADVICE, not as ranking — you choose chapter shape; the
  scheduler does not choose it for you.
- the previous chapter's summary and end-hook
- the active characters and their decision profiles

You must produce, in JSON:
- chapterShape: one of the catalogue
- sceneRoster: 2-5 scenes, each with povCharacterId, participants,
  setting, visibleAction, scenePurpose, turn, subtext, plotBudget,
  relationshipBudget, wordTarget
- narrativeReasoning: 3-5 sentences in natural prose explaining
  WHY this chapter looks like this; reference what has been
  neglected or overworked

Hard rules:
- Honour every active contract id passed in `contractsHonoured`.
- Never produce a scene that violates `forbiddenMoves`.
- If `pacingNudge = expand_breathing`, prefer a non-plot chapterShape
  unless the scheduler shows a hard payoff_overdue error.
- If `pacingNudge = allow_plot` and a thread is overdue, you may
  pick a plot-pressure shape.
- Total wordTarget across scenes should sum to roughly 3000-4500
  Chinese characters.

Soft preferences:
- Vary chapterShape across the recent window. The recent shape
  history is provided.
- Prefer scenes whose `turn` shifts an emotional/relational value
  (trust, mood, knowledge, posture) rather than only a plot fact.
- Prefer recurring participants over inventing new characters.
```

User content carries: premise, recent-3-chapter summary stub, recent
shape window, scheduler/economy advisory, contracts list, forbidden
moves list, last chapter's end-hook, active characters with
decisionProfile.

### Tasks

- [ ] Build `buildDirectorMessages` in `src/prompts/director.ts`.
- [ ] Build `directorBriefSchema` (matches `DirectorBrief`).
- [ ] Build `planDirectorBrief({ projectId, chapterNumber })` in
  `src/v1-director.ts`:
  1. Load contracts, threads, recent-3-chapter packets, recent
     chapter shapes, last-chapter summary, active characters,
     economy advisory.
  2. Compute `PacingBudget` from recent shapes (Phase F1 helper).
  3. Build messages, route through
     `generateStructuredTaskWithRetry` (use `planner` task slot —
     same retry budget).
  4. Validate the returned brief: scene count 2-5, each scene has
     all required fields, contract ids subset of project, scene
     wordTarget sums in 2500-5500 range.
  5. Persist `chapters/chapter-NNN/director_brief.json` and write
     each scene to `chapters/chapter-NNN/scenes/scene-NNN-MM.json`
     plus the `scene_index.json`.
- [ ] CLI: `director plan/inspect`, formatter that prints
  chapterShape, narrativeReasoning, scene roster summary, and any
  hard-rule violations.

### Acceptance

- Running `director plan --project demo_run_b --chapter 1` against
  the existing demo project produces a valid brief with ≥2 scenes,
  parses cleanly, and is type-checked.
- Brief's narrativeReasoning is human-readable prose, not a JSON
  dump.

## Phase A2 — Per-scene writer + chapter assembly

**LLM. One writer call per scene replaces the single chapter writer.**

### Scene writer prompt sketch

```
You are writing one scene of a Chinese web-fiction chapter.

Inputs:
- the scene packet (visibleAction, scenePurpose, turn, subtext,
  plotBudget, relationshipBudget, wordTarget)
- the POV character's full profile
- the participants' profiles (read-only)
- the chapter so far (prior scene drafts, or empty for scene 1)
- the chapter's narrativeReasoning from the director

Hard rules:
- Filter every description through the POV character's awareness.
  Do not write what the POV cannot perceive.
- Enact the subtext — show, don't state. Never write "she felt
  conflicted"; show the conflict.
- The scene must end with a value shift matching `turn`. The shift
  may be small (a hesitation, a new piece of knowledge, a refused
  apology) — but the start and end states must differ.
- If plotBudget = "none", do NOT introduce a new plot fact or
  reveal. The scene works on character/relationship/world texture.
- Write to roughly the wordTarget (Chinese characters). Stop when
  the turn lands.

Soft preferences:
- Free indirect discourse where natural.
- Prefer concrete sensory detail over abstract emotion words.
- Repeat verbal habits or physical mannerisms that already
  appeared in earlier scenes if they fit.
```

### Tasks

- [ ] Build `buildSceneWriterMessages`.
- [ ] Build `writeChapterFromScenes({ projectId, chapterNumber })`:
  1. Load the director brief and scene index.
  2. For each scene in order: build messages, call writer LLM,
     accumulate the draft.
  3. Concatenate scenes into `draft.md` with one blank line
     separator (no scene markers in published output).
  4. Run the existing 4 reviews + final reviews on the assembled
     draft (no change to that pipeline).
  5. Run the existing memory updater (no change).
  6. Run the existing role-drive sidecar builders (no change).
  7. Run the existing auto thread updater (no change).
- [ ] Persist each scene's draft separately at
  `chapters/chapter-NNN/scenes/scene-NNN-MM.md` for
  inspection/diffing.
- [ ] Length floor still applies, but at chapter-total level (sum
  of scene drafts ≥ 2500 cn_chars). The auto length_expand
  rewrite pass operates on the assembled chapter, not per scene.

### Acceptance

- A chapter generated end-to-end via the humanistic path produces
  a `draft.md` whose word count is in target range, plus
  per-scene drafts on disk.
- Existing reviews and memory updater run unchanged.
- `state_deltas` and `narrative-threads` update normally.

## Integration — `--humanistic` flag

### Tasks

- [ ] In `v1-chapter-generation.ts`, branch on a new
  `humanisticMode` argument:
  - `false` (default) → existing pipeline (legacy episode packet)
  - `true` → director plan → scene writer → reviews → memory updater
- [ ] In `v1.ts`, add `--humanistic` flag to
  `chapter generate-first` and `chapter generate`.
- [ ] In `scripts/generate-project.sh`, forward `--humanistic`.
- [ ] When `--humanistic` is set, also persist a marker file at
  `chapters/chapter-NNN/.humanistic` so inspection commands can
  detect which engine produced which chapter.

### Acceptance

- A single project can have a mix of legacy and humanistic
  chapters on disk; both `chapter inspect` and `runtime eval`
  work across them.

## Acceptance gates (sprint level)

The sprint is *not* declared complete until all of these hold on a
single project (`demo_run_b_humanistic_a`):

1. **Generation runs end-to-end for 10 chapters** under the
   humanistic flag without manual intervention.
2. **At least 2 of 10 chapters have a non-plot `chapterShape`**
   (`character_moment`, `relationship_beat`, `world_texture`,
   `interlude`, `reflection`, or `aftermath`).
3. **At least 2 of 10 chapters have a relationship/daily/aftermath
   shape specifically** (`relationship_beat`, `aftermath`,
   `world_texture`, or `interlude`).
4. **Every chapter has 2-5 valid scene packets on disk** with all
   required fields populated.
5. **Every chapter has a director_brief.json** whose
   `narrativeReasoning` is non-empty prose ≥ 80 characters.
6. **Runtime eval has no hard failures** on the humanistic chapters
   (continuity guardrails still hold).
7. **Existing test suite still passes** (`npm run check`,
   `npm test`).
8. **`pacingBudget.passes === true`** at chapter 7 onwards (rolling
   7-window has ≥ 2 non-plot shapes and ≤ 3 consecutive plot
   shapes).

## A/B test protocol

### Setup

Use a fresh project clone so neither run inherits the other's
artifacts:

```
cp -r data/projects/demo_run_b data/projects/demo_run_b_baseline
cp -r data/projects/demo_run_b data/projects/demo_run_b_humanistic
rm -rf data/projects/demo_run_b_baseline/chapters \
       data/projects/demo_run_b_baseline/memory/eval/runtime-*.json
rm -rf data/projects/demo_run_b_humanistic/chapters \
       data/projects/demo_run_b_humanistic/memory/eval/runtime-*.json
```

Both projects share the same: premise, story setup, contracts,
threads, character profiles, outline, beat outlines, world facts,
seed memories. Only the chapter generation engine differs.

### Generation

```
# Baseline: existing scheduler-driven engine
./scripts/generate-project.sh \
    --project demo_run_b_baseline --count 10 \
    --with-offscreen --with-runtime-eval

# Humanistic: new sprint-1 engine
./scripts/generate-project.sh \
    --project demo_run_b_humanistic --count 10 \
    --with-offscreen --with-runtime-eval --humanistic
```

`scripts/run-ab-experiment.sh` is a thin wrapper that runs both,
captures both runtime eval reports, and emits a side-by-side diff.

### Blind-mix bundle

`scripts/blind-mix-chapters.py` produces a single output bundle:

- 20 chapters total (10 baseline + 10 humanistic), shuffled with a
  reproducible seed.
- Each chapter rendered to plain Markdown without headers that
  reveal the engine.
- A `manifest.json` (kept *only* by the test administrator) maps
  shuffled-id → engine + original-chapter.
- A `survey.md` (given to readers) lists the 20 chapters in
  shuffled order with the 5 questions.

### Reader survey (6–8 readers)

Per chapter, each reader answers:

1. **AI-written or human-written?** (`AI` / `Human` / `Unsure`)
2. **Readability** (1–5 scale: 1 = forced/clunky, 5 = pulls me through)
3. **Character aliveness** (1–5: 1 = pieces on a board, 5 = real people)
4. **Continue-reading intent** (1–5: 1 = stop, 5 = keep reading)
5. **Plot summary vs fiction** (1–5: 1 = feels like plot summary,
   5 = feels like lived fiction)

After all 20 chapters, one open-ended prompt:

> "Pick the 3 chapters that most surprised you in either direction
> (felt unusually good or unusually mechanical) and write one
> sentence about each."

### Survey analysis

Reduce per-chapter scores to per-engine medians + IQRs. The
hypothesis the sprint is testing:

> Humanistic-engine chapters have **either** lower median
> AI-identification rate **or** higher median character-aliveness
> score than baseline chapters, with confidence intervals that
> don't overlap.

A success on either metric is enough to expand into Phase B/C/E.
Failure on both means the architecture isn't the bottleneck and
we revisit prompting / model / retrieval.

## Cost estimate

Per chapter under the humanistic engine (rough):

- 1 director call (~2k input / ~1k output tokens)
- 3-4 scene writer calls (~2k input / ~1k output each)
- 4 initial reviews (unchanged)
- 0-1 chapter-level rewrite (existing logic; rarely needed if scene
  writers respect their wordTarget)
- 4 final reviews (unchanged)
- 1 memory updater (unchanged)

Roughly **11-13 LLM calls per chapter** vs the current ~10. Modest
overhead. For 10 chapters of A/B + 10 chapters of baseline = ~230
LLM calls total. Budget similarly to previous demo_run_b runs.

## Sprint-level deferred items

These are intentionally not built this sprint. They are the
follow-ups if the A/B succeeds:

- **B**: extract voice cues from generated chapters (per character),
  surface them to scene writers
- **C**: extract relationship moments per scene-pair, surface back
  to director and scene writers
- **D-full**: per-character subtext map (replace the single string)
- **E**: bootstrap sensory anchor bank, rotate per chapter
- **H**: route per-scene writing through a Character Agent with the
  POV character's voice profile
- **I**: humanistic eval sections (`voice_continuity`,
  `relationship_texture`, `pacing_breath`, `subtext_present`,
  `sensory_recurrence`, etc.)
- **J**: UI panels for scene timeline, director-brief reader,
  pacing-budget indicator

## Risks

1. **Scene writer produces inconsistent voice across scenes within a
   chapter.** Mitigation this sprint: the chapter so far is fed into
   each scene writer prompt. If still bad, add an optional stitcher
   pass in a follow-up sprint (or jump to Phase H sooner).

2. **Director picks too many non-plot chapters and the story stalls.**
   Mitigation: the pacing budget has *both* "≥2 non-plot in window"
   and "≤3 consecutive plot" — symmetric. Plus contracts and
   `payoff_overdue` errors override `pacingNudge=expand_breathing`.

3. **JSON brief truncation under DeepSeek.** Mitigation: the schema
   has 5+ scenes worth of nested objects. Keep `wordTarget` as
   `number` not nested object; cap director maxTokens at 3500;
   route through retry helper (3 attempts).

4. **A/B test contamination from accidental project-state diff.**
   Mitigation: explicit clone step before either run, with a
   pre-flight assertion that contracts/threads/outlines hash
   identically.

5. **Reader survey too small to be conclusive.** 6-8 readers × 20
   chapters = 120-160 ratings per question, which is enough to
   detect a 0.5-point shift on a 5-point scale at p<0.05 if the
   effect is real. If effect is smaller than that, we've learned
   that scene/director alone isn't the differentiator and we need
   the voice/moments/anchor layers.

## Sprint exit decision tree

```
After A/B completes:

  Reader hypothesis confirmed (lower AI-id OR higher aliveness)?
  ├── YES → expand into Phase B (voice profiles)
  │         and Phase E (sensory anchors); revisit C and H.
  │
  └── NO  → are review counts unchanged? draft lengths comparable?
            ├── YES → architecture isn't the bottleneck.
            │        Investigate model choice, retrieval depth,
            │        prompt baseline rewrite.
            │
            └── NO  → bug in the humanistic pipeline; fix the
                     mechanical regression first, then re-A/B
                     before declaring architectural verdict.
```

## File targets summary

```
NEW:
  src/domain/scene.ts
  src/domain/scene.test.ts
  src/domain/director.ts
  src/domain/director.test.ts
  src/prompts/director.ts
  src/prompts/scene-writer.ts
  src/v1-director.ts
  src/v1-scene.ts
  scripts/run-ab-experiment.sh
  scripts/blind-mix-chapters.py
  docs/sprint-1-survey.md

MODIFIED:
  src/domain/index.ts
  src/v1-paths.ts
  src/v1-chapter-generation.ts
  src/v1-lib.ts
  src/v1.ts
  src/v1-formatters.ts
  scripts/generate-project.sh
```

11 new files, 7 modified. Estimated 1–2 weeks of focused build for
the engineering work, plus the time required to run the A/B and
collect reader feedback.
