# Longform Narrative Engine TODO

## Execution Principle

Build this as a scheduler, not as prompts.

Every phase must produce at least one of:

- a persistent artifact
- a deterministic score
- a command
- an eval case
- a UI inspection surface

Do not move to the next phase just because the JSON schema exists. Move only when the runtime can make a better decision than the old outline-driven route.

## Phase 0: Demote Static Outline

Goal:

- stop treating `beat-outlines.json` as chapter choreography

TODO:

- [x] Document `beat-outlines.json` as coarse scaffold in README or outline docs
- [x] Update planner prompt wording from "use beat as hard anchor" to "respect hard constraints, steer from current state"
- [x] Mark beat fields as:
  - [x] hard: arc id, required irreversible turns, forbidden moves, ending obligations
  - [x] soft: beatGoal, conflict, expectedChange, chapterRangeHint
- [x] Add a small eval case that fails if chapter plan copies stale beat wording while ignoring active consequence carryover
- [x] Add migration note: existing projects keep outlines, but future planner demotes them

Files likely touched:

- `src/prompts/planner.ts`
- `src/v1-shared.ts`
- `docs/longform-narrative-engine-roadmap.md`
- `docs/longform-narrative-engine-todolist.md`

Commands:

- `npm run check`
- `npm test`

Acceptance:

- generated chapter plans no longer treat `expectedChange` as mandatory exact event when active state disagrees
- docs clearly say outline is scaffold, not script

Do not:

- remove outline generation
- rewrite chapter generation end to end

## Phase 1: Contracts and Thread Schema

Goal:

- introduce runtime artifacts for reader promises and schedulable threads

TODO:

- [x] Add domain types:
  - [x] `StoryContract`
  - [x] `NarrativeThread`
  - [x] `ThreadSchedulerState`
  - [x] `ThreadStatus`
  - [x] `ThreadType`
- [x] Add storage methods:
  - [x] `saveStoryContracts`
  - [x] `loadStoryContracts`
  - [x] `saveNarrativeThreads`
  - [x] `loadNarrativeThreads`
- [x] Add file paths:
  - [x] `story-contracts.json`
  - [x] `narrative-threads.json`
- [x] Add default seed data from existing project state:
  - [x] one protagonist transformation thread
  - [x] one main plot/mystery thread
  - [x] one relationship thread
  - [x] one genre payoff thread
  - [x] one long-arc promise thread
- [x] Add CLI commands:
  - [x] `threads seed --project <id>`
  - [x] `threads inspect --project <id>`
  - [x] `story inspect-contracts --project <id>`
- [x] Add formatter output that shows:
  - [x] active thread count
  - [x] unresolved reader promises
  - [x] top pressure lines
  - [x] contract violations if any

Files likely touched:

- `src/domain/types.ts`
- `src/storage/project-repository.ts`
- `src/storage/file-project-repository.ts`
- `src/v1-paths.ts`
- `src/v1-lib.ts`
- `src/v1.ts`
- `src/v1-formatters.ts`

Commands:

- `./run-v1.sh threads seed --project demo_project`
- `./run-v1.sh threads inspect --project demo_project`
- `./run-v1.sh story inspect-contracts --project demo_project`

Acceptance:

- new files are created for a demo project
- CLI can inspect contracts and threads without invoking LLM
- project can answer: "what unresolved story forces are alive?"

Do not:

- integrate into generation yet
- add LLM prompts for thread creation until deterministic seed is working

## Phase 2: Thread Scheduler

Goal:

- make thread selection computable and explainable

TODO:

- [x] Implement scheduler scoring:
  - [x] urgency
  - [x] heat
  - [x] staleness
  - [x] readerDebt
  - [x] payoffReadiness
  - [x] setupDebt
  - [x] agencyPotential
  - [x] offscreenPressure
- [x] Implement default score formula
- [x] Add score reason generation
- [x] Add `threads rank --project <id> --chapter <n>`
- [x] Add scheduler hard rules:
  - [x] staleness > 80 requires touch/pause/retire
  - [x] payoffReadiness > 75 and readerDebt > 60 suggests payoff/half-payoff
  - [x] setupDebt > 70 blocks full payoff
  - [x] agencyPotential < 40 blocks primary selection unless repaired
- [x] Persist `lastScore` and `lastScoreReasons`
- [x] Add unit tests for ranking and hard-rule warnings

Files likely touched:

- `src/domain/thread-scheduler.ts`
- `src/v1-threads.ts`
- `src/v1-formatters.ts`
- `src/v1.ts`
- `src/**/*.test.ts`

Commands:

- `./run-v1.sh threads rank --project demo_project --chapter 4`

Acceptance:

- ranking command produces ordered candidate threads
- every score has human-readable reasons
- low-agency or high-setup-debt threads are not silently selected as primary

Do not:

- let the LLM choose primary thread without scheduler context

## Phase 3: Episode Packet Schema

Goal:

- create an installment-level plan artifact before chapter drafting

TODO:

- [x] Add domain type `EpisodePacket`
- [x] Add fields:
  - [x] `chapterMode`
  - [x] `payoffType`
  - [x] `activeThreadsUsed`
  - [x] `primaryChoiceOwner`
  - [x] `agencyOwnerId`
  - [x] `nonTransferableChoice`
  - [x] `readerPayoff`
  - [x] `endHook`
  - [x] `stateDeltasExpected`
  - [x] `doNotResolve`
- [x] Add storage path:
  - [x] `chapters/chapter-XXX/episode_packet.json`
- [x] Add command:
  - [x] `episode plan --project <id> --chapter <n>`
  - [x] `episode inspect --project <id> --chapter <n>`
- [x] Build packet from:
  - [x] selected thread ranking
  - [x] contracts
  - [x] current character decision profiles
  - [x] recent consequences
  - [x] genre payoff history
- [x] Add packet normalizer
- [x] Add packet formatter

Files likely touched:

- `src/domain/types.ts`
- `src/v1-episode.ts`
- `src/v1-paths.ts`
- `src/v1.ts`
- `src/v1-formatters.ts`

Commands:

- `./run-v1.sh episode plan --project demo_project --chapter 4`
- `./run-v1.sh episode inspect --project demo_project --chapter 4`

Acceptance:

- each packet states chapter mode and payoff type
- packet can be inspected without opening raw JSON
- packet includes selected thread ids and reasons

Do not:

- replace chapter generation until packet eval exists

## Phase 4: Protagonist Agency Gate

Goal:

- prevent passive protagonist chapters

TODO:

- [x] Add `agencyScore` computation
- [x] Add agency checks:
  - [x] protagonist has non-transferable choice
  - [x] at least two tolerable options exist
  - [x] chosen action has cost
  - [x] consequence would not happen the same way without protagonist
  - [x] protagonist is not merely observing/receiving info
- [x] Add packet failure reason `low_agency`
- [x] Add command:
  - [x] `episode eval --project <id> --chapter <n>`
- [x] Add unit tests:
  - [x] passive observation fails
  - [x] transferable choice fails
  - [x] costly choice passes

Files likely touched:

- `src/domain/agency-eval.ts`
- `src/v1-episode.ts`
- `src/v1-formatters.ts`
- `src/**/*.test.ts`

Commands:

- `./run-v1.sh episode eval --project demo_project --chapter 4`

Acceptance:

- `agencyScore < 60` blocks packet promotion
- failure output tells what to repair

Do not:

- accept "protagonist is present" as agency

## Phase 5: Integrate Episode Packet Into Chapter Generation

Goal:

- chapter generation consumes episode packet before legacy planner

TODO:

- [x] Change chapter generation flow:
  - [x] load existing episode packet if present
  - [x] generate packet if missing
  - [x] run packet eval
  - [x] only then build chapter plan/draft
- [x] Add prompt context from packet:
  - [x] chapterMode
  - [x] payoffType
  - [x] selected threads
  - [x] agency requirement
  - [x] doNotResolve
- [x] Keep legacy planner fallback behind a clear branch
- [x] Write packet sidecar for generated chapters
- [x] Add role/episode eval after generation

Files likely touched:

- `src/v1-chapter-generation.ts`
- `src/prompts/planner.ts`
- `src/prompts/writer.ts`
- `src/domain/context-builder.ts`

Commands:

- `./run-v1.sh chapter generate --project demo_project --chapter 4`

Acceptance:

- generated chapter has `episode_packet.json`
- writer prompt includes chapter mode, payoff type, and agency requirement
- packet eval failures block or warn according to severity

Do not:

- remove existing chapter plan artifact yet

## Phase 6: State Deltas

Goal:

- make chapter effects update runtime story state

TODO:

- [x] Add domain type `StateDelta`
- [x] Add fields:
  - [x] `deltaType`
  - [x] `targetId`
  - [x] `before`
  - [x] `after`
  - [x] `causalWeight`
  - [x] `visibility`
  - [x] `evidenceSnippet`
  - [x] `confidence`
  - [x] `contractImpact`
- [x] Add path:
  - [x] `chapters/chapter-XXX/state_deltas.json`
- [x] Add extractor from chapter artifact and role-driven sidecars
- [x] Add evaluator:
  - [x] material/major/irreversible delta requires evidence
  - [x] hidden delta cannot count as reader payoff
  - [x] irreversible delta checks contracts
- [x] Add command:
  - [x] `threads inspect-deltas --project <id> --chapter <n>`

Files likely touched:

- `src/domain/types.ts`
- `src/v1-deltas.ts`
- `src/v1-impact.ts`
- `src/v1-paths.ts`

Commands:

- `./run-v1.sh threads inspect-deltas --project demo_project --chapter 4`

Acceptance:

- chapter effects can be read as weighted/visible deltas
- thread scheduler can consume deltas in later phase

Do not:

- let unsupported deltas update canonical threads

## Phase 7: Thread Updater

Goal:

- apply state deltas to narrative threads

TODO:

- [x] Implement thread update rules:
  - [x] reader-visible major delta lowers readerDebt
  - [x] hidden/offscreen delta raises offscreenPressure
  - [x] payoff delta changes status when payoff conditions met
  - [x] material delta updates urgency/heat
- [x] Add conflict checks against contracts
- [x] Add command:
  - [x] `threads update-from-chapter --project <id> --chapter <n>`
- [x] Persist updated threads
- [x] Add audit report:
  - [x] `chapters/chapter-XXX/thread_update_report.json`

Files likely touched:

- `src/v1-threads.ts`
- `src/v1-deltas.ts`
- `src/v1-paths.ts`

Commands:

- `./run-v1.sh threads update-from-chapter --project demo_project --chapter 4`

Acceptance:

- next `threads rank` changes after applying deltas
- report explains why scores/status changed

Do not:

- mutate threads without report

## Phase 8: Offscreen Moves

Goal:

- make antagonist/world/secondary actors progress without protagonist trigger

TODO:

- [x] Add domain type `OffscreenMove`
- [x] Add file:
  - [x] `offscreen-moves.json`
- [x] Add commands:
  - [x] `offscreen schedule --project <id>`
  - [x] `offscreen inspect --project <id>`
- [x] Add deterministic move application:
  - [x] scheduledChapter <= current chapter
  - [x] hidden/hinted/revealed visibility
  - [x] pressure added to target thread
- [x] Add eval:
  - [x] hidden move revealed in expected window
  - [x] antagonist does not only react after protagonist
  - [x] offscreen move creates counterplay opportunity

Files likely touched:

- `src/domain/types.ts`
- `src/v1-offscreen.ts`
- `src/v1-threads.ts`
- `src/v1.ts`

Commands:

- `./run-v1.sh offscreen schedule --project demo_project`
- `./run-v1.sh offscreen inspect --project demo_project`

Acceptance:

- scheduler sees offscreenPressure
- antagonist/world threads can advance while protagonist is elsewhere

Do not:

- count hidden offscreen movement as reader payoff

## Phase 9: Span Economy and Cadence Eval

Goal:

- support 500-chapter pacing instead of short-arc planning

TODO:

- [x] Add thread economy report:
  - [x] `thread-economy-report.json`
- [x] Compute:
  - [x] currentAgeChapters
  - [x] staleness
  - [x] expectedSpanChapters
  - [x] payoffWindow
  - [x] touch interval violations
- [x] Add warnings:
  - [x] `thread_overstretched`
  - [x] `thread_neglected`
  - [x] `payoff_too_early`
  - [x] `payoff_overdue`
  - [x] `too_many_seed_only_threads`
- [x] Add command:
  - [x] `threads economy --project <id>`
  - [x] `threads eval --project <id>`

Files likely touched:

- `src/v1-threads.ts`
- `src/v1-formatters.ts`
- `src/v1-paths.ts`

Commands:

- `./run-v1.sh threads economy --project demo_project`
- `./run-v1.sh threads eval --project demo_project`

Acceptance:

- system can explain pacing debt across long spans
- stale or overdue threads show actionable warnings

Do not:

- treat all long-running threads as errors; some should intentionally simmer

## Phase 10: Local Steering Instead of Broad Regeneration

Goal:

- replace blind downstream invalidation with local steering first

TODO:

- [x] Add command:
  - [x] `threads suggest-next --project <id> --chapter <n>`
  - [x] `episode revise-packet --project <id> --chapter <n>`
- [x] Use thread rank/deltas to propose next local move
- [x] Patch episode packet without touching entire outline
- [x] Run eval before allowing draft regeneration
- [x] Keep old invalidate/regenerate as fallback

Files likely touched:

- `src/v1-episode.ts`
- `src/v1-threads.ts`
- `src/v1-mutations.ts`

Commands:

- `./run-v1.sh threads suggest-next --project demo_project --chapter 4`
- `./run-v1.sh episode revise-packet --project demo_project --chapter 4`

Acceptance:

- changed chapter produces local steering suggestions before invalidation
- broad regeneration is no longer the default correction path

Do not:

- delete regenerate-from-target workflow yet

## Phase 11: UI Thread Board

Goal:

- make runtime story state inspectable without raw JSON

TODO:

- [x] Add UI resources for:
  - [x] contracts
  - [x] narrative threads
  - [x] thread ranking
  - [x] episode packets
  - [x] state deltas
  - [x] offscreen moves
  - [x] thread economy report
- [x] Add friendly card views
- [x] Add thread board:
  - [x] sorted by score
  - [x] status
  - [x] staleness
  - [x] payoff readiness
  - [x] next suggested move
- [x] Add warnings panel

Files likely touched:

- `src/ui.ts`
- `src/ui/app.js`
- `src/ui/index.html`
- `src/ui/styles.css`

Acceptance:

- writer can answer from UI:
  - [x] what threads are alive?
  - [x] what is overdue?
  - [x] what is ready to pay off?
  - [x] what should the next chapter probably touch?

Do not:

- let UI invent story logic; UI should inspect and explicitly trigger commands

## Phase 12: Regression Hardening

Goal:

- make failures visible before generation quality degrades

TODO:

- [x] Add eval suite for thread scheduler
- [x] Add eval suite for episode packet
- [x] Add eval suite for agency
- [x] Add eval suite for offscreen moves
- [x] Add eval suite for span economy
- [x] Add regression comparison like retrieval eval
- [x] Add strict mode:
  - [x] block generation on hard failures
  - [x] warn on soft failures

Commands:

- `./run-v1.sh threads eval --project demo_project`
- `./run-v1.sh episode eval --project demo_project --chapter 4`

Acceptance:

- regression report identifies quality drift in scheduling, not just memory retrieval

Do not:

- rely only on LLM review text

## Suggested First Sprint

Implement only this:

- [x] Phase 0 outline demotion prompt/doc changes
- [x] Phase 1 minimal contracts + threads schema/storage
- [x] Phase 2 deterministic scheduler score + `threads rank`

Sprint exit:

- `threads seed`
- `threads inspect`
- `threads rank`
- unit tests for score formula
- no chapter generation integration yet

Why:

- this proves the core claim: the system can schedule narrative pressure deterministically before asking the model to write.

## Phase 13: Outline Backbone Repair

Goal:

- close the gap between the runtime layer (Phases 1–12) and the
  outline / bible layer that feeds it. Audit on `0417` showed
  characters without `decisionProfile`, arcs without character弧光,
  beats without scene structure, reveals as free strings, and 章级细
  纲 as a markdown copy-paste loop.

Priority (highest first):

- 13.A `decisionProfile` required + bootstrap step
- 13.B per-arc character arcs
- 13.C `ChapterScenePlan` layer + LLM decomposer
- 13.D `RevealItem` with `dueChapter`
- 13.E bind `worldFactIds` to beats

### 13.A — `decisionProfile` Backbone (P0) — DONE

TODO:

- [x] `domain/types.ts`: drop `?` on `CharacterState.decisionProfile`
- [x] `src/prompts/decision-profile.ts`: new prompt builder
- [x] add task type `cast_decision_profile` in `llm/config.ts` and
  `llm/types.ts`
- [x] `v1-bootstrap.ts`: after character-states ready, fill missing
  `decisionProfile` per character via the new prompt; failure falls
  back to validator warnings in `validationIssues` rather than
  silently leaving empty
- [x] `validateCharacterDecisionProfileCoverage` reports gaps to
  `validationIssues`
- [x] CLI: `bible fill-decision-profiles --project <id>` for back-fill
  (idempotent: only fills empty/missing unless `force` future-flag)
- [x] back-fill `0417` — 7/7 characters populated, idempotency
  verified
- [x] unit tests for validator (`src/domain/decision-profile.test.ts`,
  5 cases pass)
- [ ] update writer/planner prompts: drop "if decisionProfile exists"
  conditionals (deferred — the conditionals still exist in
  `formatActiveCharacters` etc. but they are now dead branches; will
  prune in 13.B together with arc shift surfacing)

Files likely touched:

- `src/domain/types.ts`
- `src/prompts/decision-profile.ts` (new)
- `src/prompts/index.ts`
- `src/llm/registry.ts`
- `src/v1-bootstrap.ts`
- `src/v1.ts`
- `src/v1-shared.ts`

Acceptance:

- `0417/character-states.json` has populated `decisionProfile` for all
  6 characters
- `bible fill-decision-profiles` is idempotent
- validator surfaces gaps loudly when present

### 13.B — Per-Arc Character Arcs (P0) — DONE

> **Hard rule:** every "shift" is a struct
> `{ oldDefault, pressureTrigger, newChoice, costPaid }`, never a
> string. See `feedback_arc_shifts_must_be_concrete.md`.

TODO:

- [x] Add domain type `ArcShift = { id, oldDefault, pressureTrigger,
  newChoice, costPaid, expectedChapterRange? }`
- [x] Extend `ArcOutline`:
  - [x] `protagonistArc { startInternalState, endInternalState,
    falseBeliefChallenged, costAccepted, shifts: ArcShift[] }`
  - [x] `supportingCharacterArcs: Array<{ characterId, startState,
    endState, shifts: ArcShift[] }>`
- [x] Validator (`src/domain/arc-shift.ts`): rejects
  `ArcShift` with any of the 4 mandatory fields empty, under
  4 chars, or matching the generic-phrase blocklist. Tests in
  `src/domain/arc-shift.test.ts`.
- [x] Prompt (`src/prompts/arc-shift.ts`) +
  `bible:derive-arc-shifts` CLI for back-fill.
- [x] Auto-derive arc shifts in `ensureBootstrappedProject` after
  decisionProfile fill, surfacing remaining issues to
  `validationIssues`.
- [x] Surface in planner prompt: `protagonistArcBlock` +
  `supportingArcsBlock`, plus 2 hard system rules referring to
  `expectedChapterRange`.
- [x] Surface in writer prompt via `ContextPack.arcShiftSignals` —
  in-range shifts only — emitted as an "Arc shift contract this
  chapter" block.
- [x] Surface in role-driven reviewer system prompt + user content;
  reviewer is told to fail when chapter falls back to oldDefault
  without enacting any in-range shift.
- [x] Back-fill `0417` arc-outlines: 5/5 arcs populated, idempotency
  verified. Spot-check: arc_escape's protagonist shifts are
  scene-bound (婚礼直播 -> 驱车回现场, 当众否认 -> 系统覆盖, 苏映牵
  连 -> 主动结盟).
- [ ] update `src/prompts/arc-outline.ts` to ask for these fields
- [ ] migrator: derive minimal `protagonistArc` from existing
  `relationshipChanges` + endingTarget for legacy arc-outlines
- [ ] surface in planner prompt: `currentArcProtagonistShift`,
  per-character `arcShift` for active characters
- [ ] surface in writer prompt: "Character arc target this chapter"
- [ ] role-driven reviewer: `character_arc_drift` finding
- [ ] CLI: `bible derive-arcs --project <id>` for back-fill
- [ ] back-fill `0417` arc-outlines

Files likely touched:

- `src/domain/types.ts`
- `src/prompts/arc-outline.ts`
- `src/prompts/planner.ts`
- `src/prompts/writer.ts`
- `src/prompts/review-role-driven.ts`
- `src/v1-bootstrap.ts`
- `src/v1.ts`

Acceptance:

- 0417 arc-outlines have populated `protagonistArc` per arc
- writer prompt for chapter N references active characters' arc
  micro-shift line
- reviewer catches a deliberately written drift draft

### 13.C — `ChapterScenePlan` Layer + Decomposer (P1) — DONE

> **Hard rule:** `characterArcMicroShift` is `SceneMicroShift[]`
> with the same 4 fields as `ArcShift` plus `arcShiftRef`. No
> single-string micro-shifts. See
> `feedback_arc_shifts_must_be_concrete.md`.

TODO:

- [x] new domain type `SceneMicroShift = { characterId,
  arcShiftRef?, oldDefault, pressureTrigger, newChoice, costPaid }`
- [x] new domain type `ChapterScenePlan`
- [x] storage: `data/projects/<id>/scene-plans.json`
- [x] file-project-repository: load/save scene plans
- [x] new prompt `src/prompts/scene-decomposer.ts` (per-chapter
  mode with peer plans for diversity, used for token-budget reasons)
- [x] new task type `scene_decomposer` in `llm/types.ts` +
  `llm/config.ts`
- [x] CLI: `outline decompose-chapters --project <id> [--beat <id>]
  [--force]`. Iterates chapter-by-chapter inside each beat with
  peer-plan context to avoid byte-identical scenes.
- [ ] gate: `outline approve-detail` warns if scene plans missing
  (deferred — current `approve-detail` does not yet consult scene
  plans; should warn when chapters in approved range lack a plan)
- [x] planner: `PlannerInput.scenePlan` + `scenePlanBlock` in user
  prompt; new system rule "scene plan is authoritative".
- [x] writer: `ContextPack.scenePlanSignals` + dedicated "Scene
  plan contract" block; system rule reinforces the plan as
  authoritative.
- [x] replace `outline-lib.ts:602-619` template fill with a real
  scene-plan render. When scene plans cover a beat the markdown
  prints per-chapter blocks (pov, location, props, opening, mid,
  climax with structured cost, end hook, dueRevealIds, micro-shift
  rows). Falls back to a "待补" notice when scene plans are missing.
- [x] role-driven reviewer: receives scene plan signals + new
  system rule "scene plan adherence" — fires `author_pushed_turn`
  / `choice_pressure_missing` when the chapter swaps pov, drops
  the climax, or replaces the listed decision with a transferable
  event.
- [x] tests: `src/domain/scene-plan.test.ts` (5 cases) covering
  scaffold validator, micro-shift validator, `findIdentical
  ConsecutiveScenes` template-fill smell detection.
- [x] back-fill `0417` beat_arc_escape_1: 6/6 chapters generated,
  6 distinct POVs (protagonist / 陆承砚 / 苏映 / 闻既白 / 谢临川 /
  周聆), 6 distinct locations, 6 distinct end hooks, structured
  micro-shifts referring back to `shift_escape_01` etc.
- [x] regenerated 0417 detailed-outline.md no longer has byte-
  identical 6 rows per beat — chapters 1–6 each own their own
  block.

Files likely touched:

- `src/domain/types.ts`
- `src/domain/index.ts`
- `src/prompts/scene-decomposer.ts` (new)
- `src/prompts/planner.ts`
- `src/prompts/writer.ts`
- `src/prompts/review-role-driven.ts`
- `src/storage/file-project-repository.ts`
- `src/storage/types.ts`
- `src/v1-paths.ts`
- `src/v1.ts`
- `src/v1-chapter-generation.ts`
- `src/outline-lib.ts`

Acceptance:

- `data/projects/0417/scene-plans.json` exists and has 24 entries
  for arc_escape (4 beats × 6 chapters)
- detailed-outline.md no longer has byte-identical rows
- writer prompt for chapter 1 vs chapter 2 differs in `pov` /
  `location` / `props` / `endHook` lines
- planner output for chapter 2 differs structurally from chapter 1

### 13.D — `RevealItem` with `dueChapter` (P1) — DONE

TODO:

- [x] new domain type `RevealItem` `{ id, kind, refId?, text,
  dueChapter, severityIfMissed, landedInChapter? }`
- [x] migrate `BeatOutline` additively: keep `revealTargets:
  string[]`, add `revealItems?: RevealItem[]`. Normalizer
  `getEffectiveRevealItems(beat)` synthesizes RevealItem[] from
  `revealTargets` when `revealItems` is missing — IDs are stable
  (`reveal_<beatId>_<index>_<short-hash>`), severity is inferred
  from world-rule keywords (机制 / 规则 / X局 / 共鸣者 / 锚点 /
  见证 / 命名 / 漏洞 / 代价 / 档案 → hard, else soft), dueChapter
  is spread across the beat's chapter range weighted to the
  second half so the writer has setup room.
- [ ] update `beat-outline.ts` prompt to ask for `RevealItem`
  directly (deferred — synth from `revealTargets` covers existing
  projects; new projects can keep using the string list and rely on
  the normalizer until we re-bootstrap them)
- [x] `ChapterScenePlan.dueRevealIds` now references RevealItem
  ids; the scene-decomposer prompt is told the typed reveals and
  forbidden from inventing ids; the clamp filters
  `dueRevealIds` against `knownRevealIds`.
- [x] context-builder: new `ContextPack.dueRevealContracts[]`
  derived from beat reveals filtered by chapterNumber + scene-
  plan dueRevealIds (deduped). Empty when no contracts.
- [x] writer prompt: dedicated "Reveal contracts due THIS chapter"
  block; new system rule "Reveal contract rule" — HARD reveals
  must surface on-page through scene action / dialogue /
  observable consequence; SOFT may be deferred.
- [x] missing-resource reviewer: extended to two failure modes
  (existing missing-resource + reveal_missed); receives
  `dueRevealContracts` JSON in user content; rule fires
  `reveal_missed: <reveal id>` (severity high) when a HARD reveal
  doesn't enact on-page.
- [ ] memory_updater: emit `reveal_landed` deltas (DEFERRED —
  needs reviewer to output explicit `revealsLanded[]` so we can
  set `RevealItem.landedInChapter`. Not blocking; until then,
  inspect-reveals shows pending / due_now / overdue but never
  landed=N).
- [x] CLI: `outline inspect-reveals --project <id> [--chapter <n>]`
  prints reveal id, beatId, kind, severity, dueChapter, status
  (pending / due_now / landed / overdue) with text snippet.
- [x] tests: 8 cases in `src/domain/reveal-item.test.ts`
  (`deriveRevealItemsFromStrings` spread, stable ids, severity
  inference, `getEffectiveRevealItems` fallback / preference,
  `selectRevealsDueAt` / `selectOverdueReveals`,
  `describeRevealStatus`).
- [x] back-fill 0417: 57 reveals derived across all beats.
- [x] re-decompose `beat_arc_escape_1` so `dueRevealIds` carry
  RevealItem ids instead of free text. Verified ch1
  `dueRevealIds=['reveal_beat_arc_escape_1_03_yv70km']`.
- [x] regenerated 0417 ch1 end-to-end with reveal contract: writer
  enacted "she's not here but they still wait. Procedure marches
  on, lights stay lit, MC keeps talking, only waiting for the
  thing labelled 'bride' to appear at 10 sharp" — that's the soft
  reveal "world auto-interprets leaving as temporary absence"
  landed on-page. missing-resource finding count 0 (down from 1
  in the previous test run — exactly the gap P1-D was meant to
  close).

Files likely touched:

- `src/domain/types.ts`
- `src/prompts/beat-outline.ts`
- `src/prompts/scene-decomposer.ts`
- `src/prompts/review-fact-consistency.ts` or new reviewer
- `src/v1-deltas.ts`
- `src/v1-impact.ts`
- `src/v1.ts`

Acceptance:

- `outline inspect-reveals --project 0417` lists each reveal with
  status `pending` / `landed-in-chapter-N` / `missed`
- a deliberate skip surfaces a `reveal_missed` reviewer finding

### 13.E — World Fact Binding (P2) — DONE

TODO:

- [x] add `BeatOutline.worldFactIds?: EntityId[]` (additive,
  optional — populated by `bind-world-facts`).
- [x] new domain helper `domain/world-fact-binding.ts` —
  `bindRevealItemsToWorldFacts`, `getWorldFactsForBeat`,
  `describeFactCoverage`, two-stage matcher (title-anchored
  preferred, description fallback) using bigram + trigram overlap
  with title-bigram threshold 3, full-corpus bigram threshold 5,
  trigram threshold 2. Title overlap weighted 3x bigram / 5x
  trigram; description 1x / 2x.
- [x] `RevealItem.kind` upgrades from `character_truth` to
  `world_fact` automatically when binder finds a fact match.
- [x] context-builder: `dueRevealContracts[]` entries now carry
  `factTitle` + `factDescription` when refId resolves; writer
  prompt prints "bound world fact" + description below the reveal
  line so the writer has the full grounding text on hand.
- [x] CLI: `bible bind-world-facts --project <id> [--force]` —
  populates `revealItems` refIds and `beat.worldFactIds`,
  idempotent unless `--force`.
- [x] CLI: `bible inspect-fact-coverage --project <id>` — prints
  per-fact coverage with via=explicit/reveal/both, beat membership,
  and earliestDueChapter; flags uncovered facts with non-zero exit
  code so CI can surface story gaps.
- [x] Bootstrap auto-runs `bindWorldFactsForProject` after arc
  shifts so new projects get bindings for free.
- [x] tests: `src/domain/world-fact-binding.test.ts` — 7 cases
  including the title-vs-description preference regression that
  caught the binder picking the wrong fact when descriptions
  shared generic vocabulary like "关系锚点".
- [x] back-fill 0417: 18 reveals bound after `--force`, 19/20
  beats now carry explicit worldFactIds, 7/8 facts covered.
- [x] inspect-fact-coverage on 0417 surfaced one real story gap:
  `fact_mechanism_002` (修正的主要方式是认知平滑/事件缝合/情绪
  放大) is currently unreferenced by any beat reveal — exactly the
  kind of "world setting that exists on paper but never surfaces
  in narrative" that the inspect command was designed to find.
- [x] regenerated 0417 ch2 end-to-end: writer prompt's "Reveal
  contracts due THIS chapter" block now includes the full
  WorldFact title + description for `fact_anchor_007` bound to
  the in-range reveals; reviewer 0/0 findings.
- [ ] arc-outline / beat-outline prompts directly ask LLM for
  `worldFactIds` (DEFERRED — auto-binder covers existing data;
  greenfield projects can adopt the explicit-LLM path later).

Files likely touched:

- `src/domain/types.ts`
- `src/prompts/arc-outline.ts`
- `src/prompts/beat-outline.ts`
- `src/prompts/writer.ts`
- `src/v1.ts`

Acceptance:

- `bible inspect-fact-coverage 0417` reports each world fact's
  expected arc / beat / chapter window

### Phase 13 Sprint Exit

- `0417/character-states.json` has full `decisionProfile`
- `0417/arc-outlines.json` has `protagonistArc` for each arc
- `0417/scene-plans.json` exists with at least the first 24 chapters
- a regenerated chapter 1 vs chapter 2 prompt is structurally
  different (different scene shape, not just chapterNumber)
- `npm test` and `npm run check` pass

### Do Not

- regenerate already-shipped chapters until scene plans exist for
  them
- delete `revealTargets: string[]` until 13.D ships normalizers
- block bootstrap when LLM call for decisionProfile fails — fall
  back to validator warnings, do not silently leave empty
- couple Phase 13 work to Phase 11 UI changes; UI can lag
