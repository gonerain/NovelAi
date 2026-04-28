# Longform Narrative Engine Roadmap

Execution checklist:

- `docs/longform-narrative-engine-todolist.md`

## Why This Exists

The current route is still too outline-driven:

`story outline -> arc outline -> beat outline -> chapter plan -> draft`

That works for short books and controlled demos, but it does not match how long novels and serial fiction actually stay alive.

Long-form fiction needs a system that can hold long-range direction while adapting chapter by chapter. The engine should behave less like a static outline executor and more like a serialized narrative control loop.

Target model:

`promise -> pressure -> choice -> consequence -> reader pull -> updated local plan`

Not:

`prewritten beat says event happens -> chapter forces event`

## Research Notes

### 1. Serial fiction is installment-native

Britannica defines serial narrative as work appearing in parts at intervals, and notes that many 19th-century novels first appeared serially. Its Dickens coverage also notes that serial publication encouraged multiple plotlines and required each episode to be individually shaped.

Implication for this project:

- each chapter must be a satisfying installment, not just a slice of a future outline
- chapter openings and endings need independent design
- multi-thread tracking matters more than a linear beat list

Sources:

- https://www.britannica.com/art/serial-narrative-format
- https://www.britannica.com/art/English-literature/Dickens

### 2. Long serials need a loose plan, not micro-choreography

Laterpress recommends planning the whole serial at the level of major beats, but warns against micromanaging every detail because serial publishing can incorporate reader response and improvisation.

Implication:

- keep ending obligations, major reversals, and character arc commitments stable
- keep scene route, chapter conflict, and tactical execution flexible
- treat outline as contracts and pressure fields, not a script

Source:

- https://www.laterpress.com/craft-of-writing/complete-guide-to-writing-serial-fiction/

### 3. Each installment needs mini-plot plus forward pull

Serial-fiction guidance repeatedly emphasizes that every installment must feel complete enough to satisfy readers while leaving enough open to pull them forward.

Implication:

- a chapter plan should include local objective, complication, turn, payoff, and next pull
- "nothing changed but setup happened" should fail validation
- hooks should vary by type, not repeat cliffhanger spam

Sources:

- https://www.laterpress.com/craft-of-writing/complete-guide-to-writing-serial-fiction/
- https://rivereditor.com/guides/how-to-write-compelling-chapter-hooks-keep-readers-reading-2026
- https://rivereditor.com/guides/how-to-write-book-chapters-keep-readers-engaged-2026

### 4. Snowflake-style expansion is useful only if it stays layered

The Snowflake Method starts from a small summary and expands outward into character, plot, and scene detail. That is valuable, but only if the expansion remains layered and revisable.

Implication:

- build story from core promise to arcs to active threads to chapter packets
- never let a low-level beat override higher-level story truth
- regenerate local plans from current state rather than treating original beat text as canonical

Sources:

- https://www.storyplanner.com/story/plan/the-snowflake-method
- https://www.novel-software.com/snowflake-method/
- https://savethecat.com/how-to-write-a-novel

### 5. Continuity is a system, not memory dump

Series/serial writing accumulates continuity drift: character facts, relationship states, timeline, world rules, and promises. A useful bible is a working source of truth, not a lore scrapbook.

Implication:

- facts need statuses, scope, source chapter, and allowed evolution
- relationship and promise threads need lifecycle states
- every new chapter should update the bible through explicit deltas

Sources:

- https://urdr.io/blog/how-to-build-a-series-bible
- https://editorial-conductorai.com/blog/seven-common-continuity-errors-fiction-series

## Design Diagnosis

### Current Failure Mode

The current outline stack encodes too much future execution:

- arc outlines own large fixed ranges
- beat outlines own chapter ranges and expected changes
- chapter planner tries to obey beat wording even when generated consequences have changed the causal state
- regeneration often means invalidating chapters instead of re-steering threads

This causes four long-form problems:

- stale beat pressure: old beats keep forcing outdated conflict
- weak installment logic: chapter exists to satisfy outline, not reader momentum
- poor thread economics: promises, mysteries, relationships, and resources are not first-class schedulable objects
- brittle long range: the more chapters generated, the more expensive it is to change direction

### Runtime Control Gap

The first version of this roadmap still risks becoming "nice narrative JSON plus prompts".

That is not enough.

The system needs computable scheduling signals, otherwise it will still depend on the model's improvisation at planning time.

Required shift:

- from `thread has pressure` to `thread has urgency/heat/staleness/payoff readiness`
- from `chapter has structure` to `chapter has mode/payoff type/agency requirement`
- from `contract is a constraint` to `contract is a reader-facing promise with violation rules`
- from `delta records change` to `delta has causal weight and visibility`
- from `long plot exists` to `500-chapter span economics are tracked`
- from `characters are involved` to `protagonist agency is measured`
- from `world waits for protagonist` to `offscreen actors make scheduled moves`

### Replacement Principle

The new engine should separate:

- `Contracts`: stable promises the story must eventually honor
- `Threads`: active moving tensions that can rise, pause, merge, or resolve
- `Episodes`: chapter-local installment packets
- `State Deltas`: what the chapter changed
- `Steering`: local patching and next-chapter planning

## New Architecture

### 1. Story Contracts

Contracts are hard commitments and reader promises. They should be few, stable, and typed.

Contract types:

- `story_truth`: facts that cannot be contradicted
- `reader_promise`: why readers keep reading
- `genre_contract`: expected commercial reward pattern
- `character_arc`: required internal movement
- `ending_obligation`: final destination or irreversible endpoint
- `forbidden_move`: things the system must never do

Examples:

- protagonist must not become passive cargo
- mystery answer cannot be revealed before evidence ladder is built
- every 3-5 chapters must deliver some visible reader reward
- relationship cannot become trust without earned cost
- antagonist cannot become incompetent just to let protagonist win

Storage:

- `story-contracts.json`

Fields:

- `id`
- `contractType`
- `statement`
- `readerFacingPromise`
- `whyItMatters`
- `rewardExpectation`
- `lockedUntil`
- `canBeReinterpreted`
- `mustNotViolate`
- `evidenceRequiredBeforePayoff`
- `violationExamples`
- `evalSignals`

Rule:

- contracts constrain thread steering
- contracts do not dictate chapter events
- reader promises influence scheduling priority
- forbidden moves become hard eval failures

### 2. Narrative Threads

Threads replace most of what beat outlines are currently trying to do.

Thread types:

- `plot_threat`
- `mystery`
- `relationship`
- `character_wound`
- `resource`
- `world_rule`
- `promise`
- `rival_pressure`
- `theme_argument`

Runtime scheduling fields:

- `urgency`: 0-100, how soon the thread needs attention
- `heat`: 0-100, how much reader-facing tension it currently carries
- `staleness`: computed from `currentChapter - lastTouchedChapter`
- `payoffReadiness`: 0-100, whether enough setup exists to pay this thread
- `setupDebt`: 0-100, how much groundwork is still missing
- `readerDebt`: 0-100, how long readers have waited for movement
- `agencyPotential`: 0-100, whether this thread can force a meaningful protagonist choice
- `offscreenPressure`: 0-100, whether non-protagonist actors are moving it

Storage:

- `narrative-threads.json`

Fields:

- `id`
- `threadType`
- `ownerCharacterIds`
- `introducedChapter`
- `currentStatus`: `seeded | active | intensifying | paused | ready_for_payoff | resolved | retired`
- `readerQuestion`
- `pressure`
- `stakes`
- `nextUsefulMoves`
- `blockedBy`
- `payoffConditions`
- `payoffTypeOptions`
- `lastTouchedChapter`
- `cadenceTarget`
- `expectedSpanChapters`
- `minTouchInterval`
- `maxDormantChapters`
- `allowedModes`: `seed | pressure | investigate | confront | payoff | aftermath | braid`
- `relatedContracts`
- `scheduler`

Scheduler subfields:

- `urgency`
- `heat`
- `staleness`
- `payoffReadiness`
- `setupDebt`
- `readerDebt`
- `agencyPotential`
- `offscreenPressure`
- `lastScore`
- `lastScoreReasons`

Rule:

- chapter planning selects from active threads
- thread state decides what needs attention
- beat outline no longer owns all future pressure
- next-thread selection must be explainable from numeric scheduling signals

Default ranking formula:

```text
threadScore =
  urgency * 0.24
  + heat * 0.20
  + staleness * 0.16
  + readerDebt * 0.14
  + payoffReadiness * 0.12
  + agencyPotential * 0.10
  + offscreenPressure * 0.04
  - setupDebt * 0.12
```

Rules:

- if `staleness > 80`, thread must be touched, paused, or explicitly retired
- if `payoffReadiness > 75` and `readerDebt > 60`, schedule a half-payoff or payoff soon
- if `setupDebt > 70`, thread can only seed, pressure, investigate, or braid
- if `agencyPotential < 40`, thread cannot be primary unless revised to create protagonist choice
- if all candidate threads have low agency, planner must generate an agency repair requirement

### 3. Episode Packets

Each chapter should be planned as an installment.

Storage:

- per chapter `episode_packet.json`

Fields:

- `chapterNumber`
- `chapterMode`: `seed | pressure | investigate | confront | payoff | aftermath | braid`
- `payoffType`: `information_reveal | power_growth | status_gain | relationship_shift | villain_setback | emotional_impact | resource_gain | strategic_reversal`
- `openingHook`
- `reentryContext`
- `localObjective`
- `activeThreadsUsed`
- `primaryChoiceOwner`
- `protagonistAgencyTest`
- `pressure`
- `complication`
- `turn`
- `readerPayoff`
- `newQuestion`
- `endHook`
- `stateDeltasExpected`
- `doNotResolve`

Rule:

- no episode packet, no chapter generation
- if there is no turn or payoff, the chapter is not ready
- if protagonist has no non-transferable choice, the packet fails
- chapter mode must match selected thread state and payoff readiness

Chapter mode rules:

- `seed`: introduce future pressure without resolving it
- `pressure`: make an existing thread harder to ignore
- `investigate`: convert uncertainty into actionable evidence
- `confront`: force opposing actors into direct friction
- `payoff`: deliver a promised reward or reversal
- `aftermath`: show costs and update relationship/world state
- `braid`: connect two or more threads without fully paying either

Payoff type rules:

- rotate payoff types to avoid monotonous chapters
- `payoff` mode must use a concrete payoff type
- `pressure` mode may use small `emotional_impact` or `strategic_reversal`
- `aftermath` mode must still create reader pull

### 4. State Deltas

Generated chapters should update the project through deltas, not by rewriting the whole outline.

Delta types:

- `thread_advanced`
- `thread_paused`
- `thread_resolved`
- `relationship_shifted`
- `contract_reinterpreted`
- `resource_gained`
- `resource_spent`
- `promise_created`
- `promise_paid`
- `new_reader_question`

Storage:

- per chapter `state_deltas.json`

Fields:

- `deltaType`
- `targetId`
- `before`
- `after`
- `causalWeight`: `minor | material | major | irreversible`
- `visibility`: `reader_visible | protagonist_visible | other_character_visible | offscreen_hidden`
- `evidenceSnippet`
- `confidence`
- `requiresHumanReview`
- `changesThreadScore`
- `contractImpact`

Rule:

- memory updater should emit deltas
- thread updater applies deltas
- role eval validates that deltas are grounded in the draft
- irreversible deltas require explicit evidence
- hidden deltas can raise offscreen pressure but cannot satisfy reader payoff
- reader-visible major deltas should reset readerDebt for related threads

Delta scheduling effects:

- `minor`: updates continuity only
- `material`: changes next chapter pressure
- `major`: changes thread ranking immediately
- `irreversible`: may require contract check and local steering patch

### 5. Steering Planner

The planner should not ask, "what beat comes next?"

It should ask:

- what contracts must remain true?
- what threads are active?
- what has been neglected?
- what pressure naturally follows the last chapter?
- what installment shape best serves reader momentum now?

Inputs:

- story contracts
- active narrative threads
- recent state deltas
- chapter cadence history
- character decision profiles
- genre/payoff rhythm

Outputs:

- episode packet
- selected thread moves
- expected state deltas

### 6. Span Economy

500-chapter fiction needs resource budgeting.

A thread should know roughly how long it is expected to live and how often readers must see motion.

Storage:

- part of `narrative-threads.json`
- aggregate report `thread-economy-report.json`

Fields:

- `expectedSpanChapters`
- `currentAgeChapters`
- `minTouchInterval`
- `maxDormantChapters`
- `setupWindow`
- `pressureWindow`
- `payoffWindow`
- `halfPayoffAllowed`
- `mustExplodeByChapter`
- `retirementCondition`

Rules:

- long threads need periodic visible pressure or reminders
- short threads should not linger past their payoff window
- half-payoff can reduce readerDebt without resolving the thread
- major payoff should not happen before setup debt is low enough

Eval warnings:

- `thread_overstretched`
- `thread_neglected`
- `payoff_too_early`
- `payoff_overdue`
- `too_many_seed_only_threads`

### 7. Protagonist Agency Gate

Commercial long-form fiction needs protagonist-driven momentum.

Every chapter should answer:

- what choice could only the protagonist make?
- what did that choice cost?
- what changed because of that choice?
- what would have happened if they chose differently?

Episode packet fields:

- `agencyOwnerId`
- `nonTransferableChoice`
- `availableOptions`
- `chosenAction`
- `rejectedOption`
- `costAccepted`
- `consequenceCreated`
- `agencyScore`: 0-100

Hard rules:

- if `agencyScore < 60`, chapter cannot be generated without an agency repair note
- if protagonist only observes, reacts, or receives information, agency fails
- if another character could make the same choice with same outcome, agency fails
- if consequence would happen anyway, agency fails

### 8. Offscreen Moves

The world should move without waiting for the protagonist.

Offscreen actors:

- antagonist
- rival
- institution
- ally with own agenda
- market/social/public pressure
- supernatural/systemic force

Storage:

- `offscreen-moves.json`

Fields:

- `id`
- `actorId`
- `actorType`
- `targetThreadId`
- `moveType`: `advance_plan | cover_tracks | pressure_ally | exploit_resource | create_deadline | mislead | escalate_cost`
- `scheduledChapter`
- `visibility`: `hidden | hinted | revealed`
- `expectedRevealWindow`
- `pressureAdded`
- `counterplayOpportunity`

Rules:

- offscreen moves can raise thread urgency/heat
- hidden moves cannot count as reader payoff until hinted or revealed
- antagonist competence is maintained by scheduled offscreen progress
- protagonist chapters should sometimes discover consequences of offscreen moves, not always trigger them

## Runtime Loop

Every chapter should run the same deterministic control loop before asking the model to draft prose.

### Pre-Planning

1. Load contracts.
2. Load active threads.
3. Apply pending offscreen moves whose `scheduledChapter <= currentChapter`.
4. Recompute thread scheduler fields:
   - urgency
   - heat
   - staleness
   - payoffReadiness
   - setupDebt
   - readerDebt
   - agencyPotential
   - offscreenPressure
5. Rank candidate threads.
6. Select primary and secondary threads.
7. Select chapter mode and payoff type.
8. Build agency requirement.
9. Build episode packet.

### Planning Gate

Episode packet must pass:

- has primary thread
- has chapter mode
- has payoff type or explicit reason for deferred payoff
- has protagonist agency score >= 60
- does not violate forbidden moves
- does not pay off high setup-debt thread
- includes at least one reader-visible move unless chapter is explicitly hidden setup

If it fails:

- repair episode packet
- do not draft

### Post-Draft

1. Extract state deltas.
2. Validate evidence snippets.
3. Apply visible deltas to threads.
4. Apply hidden deltas to offscreen pressure.
5. Update readerDebt and staleness.
6. Update thread status.
7. Run thread eval.
8. Run agency eval.
9. Run contract violation eval.

### Failure Policy

- hard contract violation: block promotion
- low protagonist agency: rewrite packet or draft
- payoff without setup: rewrite packet
- hidden-only chapter with no reader-visible motion: rewrite packet
- unresolved high-staleness thread ignored again: warning escalates to block after threshold

## Eval System

Eval must test scheduler behavior, not only JSON presence.

### Thread Eval Cases

- `thread_score_explainable`: selected primary thread has top or near-top score
- `high_staleness_touched`: stale threads are touched, paused, or retired
- `payoff_readiness_respected`: payoff does not happen before setup debt is low
- `reader_debt_reduced`: high readerDebt threads receive visible motion
- `span_economy_valid`: thread is not overstretched past its expected span

### Episode Eval Cases

- `chapter_mode_valid`: mode matches selected thread state
- `payoff_type_present`: payoff type exists and is reader-visible when needed
- `mini_plot_complete`: objective, complication, turn, payoff, end hook exist
- `agency_score_passed`: protagonist has non-transferable choice
- `no_passive_protagonist`: protagonist is not just observing or receiving information

### Delta Eval Cases

- `delta_grounded`: each material/major/irreversible delta has evidence
- `visibility_correct`: hidden deltas are not counted as reader payoff
- `causal_weight_correct`: irreversible changes are not marked minor
- `contract_impact_checked`: contract-affecting deltas run contract eval

### Offscreen Eval Cases

- `offscreen_pressure_progresses`: antagonist/world actors move on schedule
- `hidden_move_revealed_in_window`: hidden offscreen moves are eventually hinted or revealed
- `villain_competence_preserved`: antagonist does not only react after protagonist action

### Commercial Longform Eval Cases

- `payoff_variety`: payoff types rotate over nearby chapters
- `hook_variety`: end hooks do not repeat the same shape too often
- `no_seed_spam`: too many seed-only chapters in a row fails
- `reward_cadence`: reader-visible rewards happen within configured cadence

## Roadmap

### Phase 0: Freeze Current Outline Role

Status: next

Goal:

- stop expanding the current outline system as if more beat detail will solve long-form logic

Tasks:

- document that `beat-outlines.json` is a coarse scaffold only
- mark beat fields as advisory except hard constraints
- update planner language from "obey beat" to "respect scaffold, steer from current state"

Exit condition:

- planner prompts no longer treat beat wording as the primary source of truth when current threads disagree

### Phase 1: Runtime Contract and Thread Schema

Status: next

Goal:

- introduce narrative contracts and threads as schedulable runtime artifacts

Deliverables:

- `narrative-threads.json`
- `story-contracts.json`
- domain types for contracts and threads
- scheduler fields and scoring function
- bootstrap conversion from existing outlines/memories into initial threads

Minimum thread set:

- one protagonist transformation thread
- one main plot threat/mystery thread
- one relationship thread
- one genre payoff thread
- one long-arc promise thread

Exit condition:

- project inspection can answer "what unresolved story forces are alive, how urgent they are, and why one should be scheduled next"

### Phase 2: Episode Packet Planner and Agency Gate

Status: next

Goal:

- replace chapter planning as outline execution with installment planning

Deliverables:

- `episode_packet.json`
- prompt builder for episode packets
- planner result normalization
- chapter mode and payoff type enums
- protagonist agency gate
- eval checks for local objective / complication / turn / payoff / end hook / agency

Exit condition:

- each generated chapter has an explicit mini-plot, forward pull, payoff type, and non-transferable protagonist choice

### Phase 3: State Delta and Offscreen Move Updater

Status: later

Goal:

- after draft generation, update narrative threads and offscreen actors through grounded deltas

Deliverables:

- `state_deltas.json`
- `offscreen-moves.json`
- thread updater
- offscreen move scheduler
- delta grounding reviewer
- conflict warnings when deltas violate contracts

Exit condition:

- the next chapter planner sees updated thread states and world movement without reading the full draft

### Phase 4: Span Economy, Cadence, and Neglect Control

Status: later

Goal:

- prevent long-form drift where important threads disappear or hooks repeat

Deliverables:

- thread economy report
- thread cadence score
- hook variety history
- "neglected thread" warnings
- "overused hook type" warnings
- payoff readiness warnings
- setup debt warnings
- role-driven eval extensions

Exit condition:

- the system can explain why the next chapter should touch thread A instead of thread B, and whether it should seed, pressure, investigate, confront, payoff, aftermath, or braid

### Phase 5: Local Steering Instead of Regeneration

Status: later

Goal:

- reduce invalidate/regenerate as the default correction mechanism

Deliverables:

- `episode revise-packet`
- `threads suggest-next-moves`
- `threads apply-deltas`
- targeted episode packet regeneration

Exit condition:

- a changed chapter causes local thread steering first, not blind downstream invalidation

### Phase 6: UI Thread Board

Status: later

Goal:

- let humans review story state without reading raw JSON

Deliverables:

- thread board
- contract board
- episode packet view
- thread timeline
- neglected/overheated thread warnings

Exit condition:

- a writer can see "what story forces are alive, what changed last chapter, what must happen soon"

## Commands To Add

### Phase 1

- `story inspect-contracts --project <id>`
- `threads seed --project <id>`
- `threads inspect --project <id>`
- `threads rank --project <id> --chapter <n>`

### Phase 2

- `episode plan --project <id> --chapter <n>`
- `episode inspect --project <id> --chapter <n>`
- `episode eval --project <id> --chapter <n>`

### Phase 3

- `threads update-from-chapter --project <id> --chapter <n>`
- `threads inspect-deltas --project <id> --chapter <n>`
- `offscreen schedule --project <id>`
- `offscreen inspect --project <id>`

### Phase 4

- `threads eval --project <id>`
- `threads suggest-next --project <id> --chapter <n>`
- `threads economy --project <id>`

## Migration Plan

### What To Keep

- current story/arc/beat outlines as coarse scaffolds
- character decision profiles
- role-driven sidecars
- memory system
- retrieval eval
- role-driven eval
- patch suggestion/apply workflow

### What To Demote

- beat outline as chapter dictator
- chapter range as hard choreography
- expectedChange as mandatory exact event

### What To Add

- contracts
- threads
- episode packets
- state deltas
- runtime scheduler scores
- protagonist agency gate
- offscreen moves
- cadence evaluation

## Implementation Order

1. Add contract/thread domain types with runtime scheduling fields.
2. Add scoring function and `threads rank`.
3. Add thread seeding from existing outline/memory/role artifacts.
4. Add `threads inspect`.
5. Add episode packet schema with chapter mode, payoff type, and agency gate.
6. Make chapter generation consume episode packet before legacy planner.
7. Add state delta extraction with causalWeight and visibility.
8. Add offscreen move scheduler.
9. Add thread updater and thread eval.
10. Add UI thread board.

## Guardrails

- do not delete outline support; demote it
- do not make every thread active every chapter
- do not resolve a thread without evidence in draft
- do not turn hooks into constant cliffhangers
- do not let reader-pull override character causality
- do not let audience feedback rewrite core contracts automatically
- do not schedule a low-agency thread as primary unless repaired
- do not count hidden offscreen movement as reader payoff
- do not pay off a thread whose setup debt is still high

## Success Criteria

The new system is working when:

- chapters feel like installments, not outline fragments
- generated chapters can be summarized as "thread move + character choice + payoff + next pull"
- stale beat wording no longer overrides current story state
- unresolved promises have visible lifecycle states
- the system can warn when a thread is neglected
- the system can rank candidate threads with explicit numeric reasons
- every chapter has a mode, payoff type, and protagonist agency score
- offscreen actors can move threads without protagonist-triggered events
- local steering replaces broad invalidation for most changes

## Practical Near-Term Target

Do not attempt a full rewrite.

Build a thin vertical slice:

1. `story-contracts.json`
2. `narrative-threads.json`
3. thread scheduler fields and rank formula
4. `threads seed`
5. `threads inspect`
6. `threads rank`
7. `episode_packet.json` for one next chapter
8. protagonist agency gate for that episode packet

If that improves chapter planning quality, then expand into delta updates and UI.
