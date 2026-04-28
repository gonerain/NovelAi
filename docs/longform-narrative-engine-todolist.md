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
