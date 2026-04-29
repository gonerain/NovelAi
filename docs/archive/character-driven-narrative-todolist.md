# Character-Driven Narrative TODO

## Execution Principle

This is the humanistic counterpart to
`docs/longform-narrative-engine-todolist.md`.

The existing scheduler engine is **not removed**. It is demoted to a
continuity guardrail. The foreground driver becomes a writers'-room
deliberation that thinks in scenes, voice, relationship moments, and
pacing breath — not in scheduler scores.

Every phase must produce at least one of:

- a persistent humanistic artifact (scene packet, voice profile,
  relationship moments log, sensory anchor, director brief, …)
- a deterministic check that the artifact is being *used*
  (cue recurrence, moment growth, sensory rotation, pacing budget)
- a CLI command for inspection
- an eval case framed as a craft question, not a numeric threshold
- optional UI surface

Do not move to the next phase just because the JSON schema exists.
Move only when the resulting chapter feels meaningfully more humanistic
than the previous phase's output on the same project state.

## Phase A: Scene granularity

Goal:

- a chapter is composed of 2–5 scenes; each scene is the atomic unit

TODO:

- [ ] Add domain type `ScenePacket` with fields: `id, chapterNumber,
  sceneNumber, sceneShape, povCharacterId, participants, setting,
  goalText, obstacleOrTexture, turnText, exitState,
  subtextPerCharacter, voiceCuesUsed, sensoryAnchorsUsed,
  expectedDeltaIds, wordTarget`
- [ ] Add `SceneShape` enum: `plot_advance | pressure_buildup |
  confrontation | payoff | aftermath | character_moment |
  relationship_beat | world_texture | interlude | sequel | reflection`
- [ ] Add storage:
  - [ ] `chapters/chapter-XXX/scenes/scene-NNN.json`
  - [ ] `chapters/chapter-XXX/scene_index.json`
- [ ] Add path helpers `chapterScenePath`, `chapterSceneIndexPath`
- [ ] Add CLI:
  - [ ] `scene plan --project <id> --chapter <n>`
  - [ ] `scene inspect --project <id> --chapter <n> [--scene <m>]`
- [ ] Make the scene plan generator deterministic for now (LLM later
  in Phase G); take an existing episode packet and split it into 3
  scenes with reasonable defaults
- [ ] Add a chapter writer mode that walks the scene index and
  produces one scene draft per packet, then concatenates with
  separators
- [ ] Keep the legacy single-draft writer behind a flag

Files likely touched:

- `src/domain/types.ts`
- `src/domain/scene.ts` (new)
- `src/v1-paths.ts`
- `src/v1-chapter-generation.ts`
- `src/v1-formatters.ts`
- `src/v1.ts`

Acceptance:

- generated chapter has scene packets on disk
- chapter draft = concatenation of scene drafts
- `scene inspect` shows the scenes and their shapes

Do not:

- delete the existing single-draft path; both must coexist behind a flag

## Phase B: Character voice profile

Goal:

- a character thickens over chapters by recycling voice cues

TODO:

- [ ] Add domain type `CharacterVoiceProfile`
- [ ] Storage:
  - [ ] `character-voice/<characterId>.json`
- [ ] Bootstrap a profile per active character at project bootstrap
  (LLM-assisted)
- [ ] Add a "voice spotter" post-chapter pass: scan the chapter draft,
  match against existing cues, update `usageHistory`, propose new cues
  for human approval (write to `voice_proposals.json`, do not auto-add)
- [ ] Surface voice profile in writer prompts: "deploy at least one of
  these existing cues this chapter"
- [ ] Add CLI:
  - [ ] `voice inspect --project <id> --character <id>`
  - [ ] `voice apply-proposals --project <id> --character <id>`

Files likely touched:

- `src/domain/types.ts`
- `src/domain/character-voice.ts` (new)
- `src/v1-voice.ts` (new)
- `src/prompts/writer.ts`
- `src/storage/file-project-repository.ts`

Acceptance:

- a character profile records the chapters in which each cue appeared
- consecutive chapters reuse cues rather than inventing new ones each
  time

Do not:

- auto-merge proposed new cues; they require human approval

## Phase C: Relationship moments log

Goal:

- relationships are remembered as concrete moments, not numbers

TODO:

- [ ] Add domain type `RelationshipMomentsLog`
- [ ] Storage:
  - [ ] `relationship-moments/<charA>__<charB>.json`
- [ ] Bootstrap an empty log per primary relationship pair
- [ ] Add a "moment spotter" post-chapter pass that extracts new
  moments from the chapter, classifies value shifts, appends to the
  pair's log
- [ ] Track per-pair `firstTimeRecord` (firstTouch, firstLie,
  firstSharedJoke, firstApology, firstSilence, firstPromise)
- [ ] Track per-pair `unsaidThings`: what the pair has *not* said but
  feels — surfaced as future hooks
- [ ] Surface the log in writer prompts when both characters appear
  in the same scene
- [ ] Add CLI:
  - [ ] `moments inspect --project <id> --pair <charA>,<charB>`

Files likely touched:

- `src/domain/types.ts`
- `src/domain/relationship-moments.ts` (new)
- `src/v1-moments.ts` (new)
- `src/prompts/writer.ts`

Acceptance:

- after 5 chapters, every primary pair has at least 3 entries in
  `momentSet` and at least 1 in `unsaidThings`
- writer prompts cite specific moments back ("第3章地铁站的沉默") rather
  than abstract trust scores

Do not:

- treat `valueShift` numbers as scheduler inputs; the log is
  narrative-first

## Phase D: Subtext map per scene

Goal:

- every scene knows what each speaking character is hiding

TODO:

- [ ] Extend scene packets with `subtextPerCharacter`:
  `{ characterId, surfaceAction, internalState, concealedTruth,
  selfDeception }`
- [ ] Director deliberation must produce subtext for the POV
  character of every scene
- [ ] Writer prompts receive the subtext as a "what this character is
  hiding from others / from themselves in this scene" block
- [ ] Add eval `subtext_present`: each scene has non-empty subtext
  for at least its POV character

Files likely touched:

- `src/domain/scene.ts`
- `src/prompts/writer.ts`
- `src/v1-runtime-eval.ts`

Acceptance:

- writer drafts contain at least one moment where the POV character's
  internal state diverges from their surface action

Do not:

- expose subtext directly to the reader as exposition; it must be
  *enacted*, not narrated

## Phase E: Sensory anchor bank

Goal:

- the world re-occurs sensorially across chapters

TODO:

- [ ] Add domain type `SensoryAnchor`
- [ ] Storage:
  - [ ] `sensory-anchors.json` (project-level)
- [ ] Bootstrap 8–20 anchors per project (LLM + setting + character data)
- [ ] Director selects 1–3 anchors per chapter to recur (rotation
  policy: prefer least-recently-used)
- [ ] Writer prompt surfaces selected anchors with a directive to use
  them in *new emotional registers*, not as repetition
- [ ] Post-chapter "anchor spotter" pass detects which were actually
  used and updates `usageHistory`
- [ ] Add CLI:
  - [ ] `anchors inspect --project <id>`
  - [ ] `anchors rotate --project <id> --chapter <n>`

Files likely touched:

- `src/domain/types.ts`
- `src/domain/sensory-anchors.ts` (new)
- `src/v1-anchors.ts` (new)
- `src/prompts/writer.ts`

Acceptance:

- by chapter 10, at least 5 anchors have been re-used in ≥2 distinct
  emotional registers

Do not:

- inflate the bank to >25 anchors; rotation should produce *recurrence*,
  not variety

## Phase F: Chapter shape catalogue + pacing budget

Goal:

- chapters can legitimately be quiet; engine no longer forces escalation

TODO:

- [ ] Add `ChapterShape` enum (see roadmap §6 catalogue)
- [ ] Add domain type `PacingBudget`
- [ ] Add a rolling-7-chapter window tracker
- [ ] Add eval `pacing_breath`:
  - [ ] within any 7 consecutive chapters, ≥2 are non-plot shapes
  - [ ] no more than 3 consecutive plot-pressure shapes
- [ ] Allow scenes within a chapter to mix shapes (chapter shape =
  the dominant scene shape, but mixing is allowed)
- [ ] Update `chooseChapterMode` to be advisory only; chapter shape is
  selected by the director (Phase G)

Files likely touched:

- `src/domain/types.ts`
- `src/domain/pacing-budget.ts` (new)
- `src/v1-runtime-eval.ts`
- `src/v1-formatters.ts`

Acceptance:

- a project can run 10 chapters in which 3+ chapters legitimately have
  no plot move, with pacing eval passing

Do not:

- block plot-pressure chapters; just enforce the breathing window

## Phase G: Director deliberation step

Goal:

- the foreground driver is a humanistic LLM deliberation, not a numeric
  scheduler

TODO:

- [ ] Build the director LLM prompt; design it as a writers'-room brief:
  - chapter shape options
  - voice cues that are due to recur
  - relationship moments seeded but not built on
  - sensory anchors that are stale
  - pacing budget signal (whether window forces a non-plot shape)
  - existing scheduler advisory inputs (urgency / readerDebt / staleness
    on top threads — *as advice*, not as ranking)
- [ ] Director output schema:
  - `chapterShape`
  - `sceneRoster` — ordered list of scene plans
  - `povRotation` — POV per scene
  - `subtextHints` — per scene, per POV
  - `voiceCuesToUse`
  - `anchorsToRecur`
  - `optionalPlotMoves`
  - `narrativeReasoning` — 3–5 sentences in natural language
- [ ] Persist `chapters/chapter-XXX/director_brief.json`
- [ ] Add CLI:
  - [ ] `director plan --project <id> --chapter <n>`
  - [ ] `director inspect --project <id> --chapter <n>`
- [ ] Replace the call site in chapter generation: director plan →
  scene packets → writer per scene → assembled chapter

Files likely touched:

- `src/domain/director.ts` (new)
- `src/prompts/director.ts` (new)
- `src/v1-director.ts` (new)
- `src/v1-chapter-generation.ts`
- `src/v1-formatters.ts`

Acceptance:

- on the same project state, the director picks different chapter
  shapes across chapters 1–7 and explains each in narrative reasoning
- existing scheduler eval still runs but its findings are surfaced as
  *advice* in the director brief

Do not:

- let the director ignore the scheduler entirely; contracts and
  forbidden moves still bind

## Phase H: Character-agent writing

Goal:

- per-scene writing happens through a character voice, not a narrator
  hovering above

TODO:

- [ ] Build a Character Agent prompt that takes:
  - the POV character's voice profile
  - the scene packet (goal, turn, subtext)
  - the relationship moments shared with in-scene characters
  - the selected sensory anchors
  - the chapter so far (prior scenes already written)
- [ ] Route per-scene drafting through the character agent of that
  scene's POV
- [ ] Non-POV characters speak through the POV character's filter
- [ ] Optional: at chapter assembly time, a "stitcher" agent smooths
  scene-to-scene transitions while preserving each scene's voice

Files likely touched:

- `src/prompts/character-agent.ts` (new)
- `src/v1-chapter-generation.ts`

Acceptance:

- a chapter where two POVs alternate reads as if narrated by two
  different characters
- the same character's voice in chapter 7 still recognisably matches
  chapter 1, but has *grown*

Do not:

- replace the existing writer prompt entirely until parity is shown
  on the agency / continuity / commercial-variety eval sections

## Phase I: Humanistic eval sections

Goal:

- regression report tracks craft drift, not just continuity drift

TODO:

- [ ] Add eval sections (severity = warning unless noted):
  - [ ] `voice_continuity` — at least one cue recycled per active
    character per chapter (after chapter 3)
  - [ ] `voice_growth` — new cues are believable expansions of prior
    pattern (LLM judge)
  - [ ] `relationship_texture` — pair appearances produce ≥1 moment
    log entry (after chapter 2 of pair)
  - [ ] `pacing_breath` — rolling 7-window budget met
  - [ ] `subtext_present` — each scene's POV has non-empty subtext
  - [ ] `sensory_recurrence` — ≥1 anchor reused per chapter (after
    chapter 5)
  - [ ] `unsaid_pressure` — `unsaidThings` either grew or shrank
    (an existing entry surfaced)
  - [ ] `value_shift_minimum` — every scene ends with at least one
    value moved (trust / mood / knowledge / posture / debt)
- [ ] LLM-judge harness for the cases that can't be heuristically
  matched
- [ ] Regression diff over time on these sections (parallel to the
  existing `runtime-eval-regression.json`)

Files likely touched:

- `src/v1-runtime-eval.ts`
- `src/domain/humanistic-eval.ts` (new)
- `src/prompts/eval-judge.ts` (new, LLM judge prompts)

Acceptance:

- the regression report can answer *"which of voice / relationship /
  pacing / subtext got worse this chapter?"* in plain language

Do not:

- let humanistic eval block generation by default. Strict mode is
  optional and per-section.

## Phase J: UI for scene-level inspection

Goal:

- a writer can review every dimension the engine now tracks without
  opening JSON

TODO:

- [ ] Scene timeline view per chapter (cards by scene, shape coloured,
  POV labelled)
- [ ] Voice profile dashboard per character — cue list with usage
  histogram across chapters
- [ ] Relationship moments timeline per pair — chronological card
  list, value shifts annotated
- [ ] Sensory anchor recurrence map — anchor × chapter heatmap
- [ ] Director-brief reader view (the natural-language reasoning
  surfaced)
- [ ] Pacing-budget panel — rolling 7-window indicator

Files likely touched:

- `src/ui.ts`
- `src/ui/index.html`
- `src/ui/app.js`
- `src/ui/styles.css`

Acceptance:

- the writer can answer from the UI:
  - [ ] which scenes did this chapter contain?
  - [ ] which voice cues recurred this chapter and which are stale?
  - [ ] which relationship pairs gained moments and which are dormant?
  - [ ] is the pacing window currently breathing or pressed?
  - [ ] what was the director's reasoning?

Do not:

- let UI invent narrative content; it inspects and triggers commands

## Suggested First Sprint

Implement only this thin vertical slice, then evaluate whether the output
*feels* more humanistic before expanding:

- [ ] Phase A: scene granularity (3-scene chapter)
- [ ] Phase D: subtext map for those scenes
- [ ] Phase F: chapter shape catalogue + simple pacing budget
- [ ] Phase G: director deliberation that picks the shape and writes
  the brief

Sprint exit:

- one chapter on disk that uses `character_moment` or
  `relationship_beat` shape with zero plot moves
- director brief reads like a writers'-room note, not a JSON dump
- scheduler eval still passes (continuity unaffected)
- a human reader can tell that the chapter is *purposefully quiet*

Why:

- this proves the core claim: the engine can produce a chapter that
  *helps* the story without forcing escalation, and the rest of the
  architecture (voice, moments, anchors, character agents) can be
  layered in incrementally.

## Migration Notes

- All existing artifacts (contracts, threads, deltas, offscreen, runtime
  eval) keep working unchanged.
- New artifacts are additive. Projects that opt out of the
  character-driven layer get the previous behaviour.
- Per-project flag (`humanistic_layer: true|false` in `project.json` or
  CLI option) toggles foreground driver between
  `buildEpisodePacketFromRuntime` (legacy scheduler) and the director
  deliberation (new humanistic).
- The runtime eval report includes both legacy sections and humanistic
  sections; either can be made strict independently.

## Guardrails

- do not delete the scheduler; demote it
- do not let the director ignore contracts and forbidden moves
- do not auto-merge LLM-proposed voice cues; require human approval
- do not inflate sensory anchor count past ~25 — recurrence is the goal
- do not let humanistic eval block generation by default
- do not chain six character_moment chapters; pacing budget must alternate
- do not score relationships numerically as the source of truth — the
  log is narrative-first; numbers are derived

## Success Criteria

The character-driven layer is working when:

- a chapter exists that contains zero plot moves and is *purposeful*
- a reader can identify a character by their voice without seeing the
  name
- a relationship has ≥3 remembered, concrete moments by chapter 10
- a sensory anchor introduced in chapter 1 returns in chapter 7 in a
  different emotional register
- the rolling 7-chapter pacing budget is met by default
- the director writes a one-paragraph rationale that reads like a
  showrunner brief
- existing scheduler eval (continuity, contracts, deltas) is unaffected
- on the same project state, switching `humanistic_layer: false` to
  `true` produces a measurably more textured 5-chapter sample
