# Character-Driven Narrative Roadmap

Execution checklist:

- `docs/character-driven-narrative-todolist.md`

## Why This Exists

The existing `docs/longform-narrative-engine-roadmap.md` built a runtime scheduler:
contracts, threads, scheduler scores, episode packets, agency gate, runtime eval.
Every part of it is *deterministic*. Every chapter asks the engine the same
question:

> "Which thread has the highest urgency × heat × payoffReadiness right now?"

That is not how human writers work.

Real writers — including the most read serial novelists in Chinese 网文, Japanese
ライトノベル, English-language web fiction, and TV showrunner rooms — almost
never think in scheduler scores. They think in:

- a *scene* with a goal that may or may not advance the plot
- a *character moment* where two people just talk and the reader feels the
  relationship deepen
- a *daily-life chapter* where nothing significant happens but the world feels
  more real afterwards
- a *texture detail* — a glance, a hesitation, a refused sentence
- a *gap between what a character says, what they think, and what they want*

When we ran the existing engine end-to-end on `demo_run_b` for 5 chapters, two
human-noticed problems surfaced that no eval could catch:

1. **Pace too fast.** Five chapters in a row delivered major reveals. No
   breathing room. No daily-life. No "they just had coffee and didn't talk
   about the case" chapter.
2. **Characters not three-dimensional.** Each chapter forced a hard choice
   under pressure. The protagonist's *voice* — what they characteristically
   notice, the things they refuse to say, their habitual mannerisms — never
   accumulated.

Both problems trace to the same root: **the foreground driver is a numeric
scheduler, not a humanistic deliberation.**

This roadmap describes a complementary layer that promotes humanistic
concerns to the foreground while keeping the scheduler as a *guardrail*.

## Research Foundation

### 1. The scene is the writer's primary unit, not the chapter

Dwight Swain (*Techniques of the Selling Writer*) and Jack Bickham (*Scene &
Structure*) teach that the unit of fiction is the **scene + sequel** pair:

- **Scene** = goal → conflict → disaster.
- **Sequel** = reaction → dilemma → decision.

A scene is a unit of conflict. A sequel is a unit of *transition* — the breath
between scenes, where the character feels, processes, and chooses. *Sequels
are where character interiority lives.* Chapters in long-form fiction are
typically composed of 2–5 scenes plus their sequels, not one atomic plot
event.

Robert McKee (*Story*) sharpens this: "Beats build scenes, scenes build
sequences, sequences build acts." A *beat* is a single exchange of action and
reaction; you can have a beat where nothing changes outwardly but the
*subtextual* value (trust, hope, shame) shifts. McKee's rule — *if your
starting and ending scene values don't change, your scene is a non-event* —
is satisfied by emotional shifts, not just plot shifts.

Sources:
- https://en.wikipedia.org/wiki/Scene_and_sequel
- https://www.septembercfawkes.com/2021/09/scene-structure-according-to-dwight-v.html
- https://www.septembercfawkes.com/2021/10/sequel-structure-according-to-swain.html
- https://writershelpingwriters.net/2022/03/scenes-vs-sequels-whats-a-good-balance/

Implication for this engine:

- The atomic unit is a **scene packet**, not a chapter packet.
- Some scenes have no plot turn — they exist for sequel/interiority work.
- A chapter is a *composition* of scenes, picked by a director.

### 2. Showrunner methodology — A-plot / B-plot / runner

Television writers' rooms break a season into episodes that always carry
multiple stories at different intensities:

- **A-story** — the main plot driver of the episode (most screen time).
- **B-story** — usually a secondary character or relationship arc that runs
  alongside, often *quieter*.
- **C-story / runner** — slow burns spread across episodes; sometimes
  one-line jokes or recurring threads that pay off in distant episodes.

Crucially, "breaking" stories in the writers' room is a *conversation*, not a
ranking algorithm. The showrunner asks: *"What does this episode need? What
is the audience going to feel? Whose story do we want them to live in for the
next 45 minutes?"*

Sources:
- https://www.tv-calling.com/what-are-a-b-and-c-stories-in-screenwriting-tv-writing-101/
- https://industrialscripts.com/a-b-and-c-plots/
- https://scriptmag.com/features/writers-room-101-beats-breaking-blending
- https://screencraft.org/blog/simple-guide-to-the-tv-writers-room-hierarchy/

Implication for this engine:

- The "primary thread" concept is too thin. Replace with **chapter shape**:
  A-story (plot or relationship), B-story (character or world), runner
  (foreshadow or callback).
- Selection is a **deliberation prompt** ("what does this chapter need?"),
  not a numeric ranking.
- Some chapters legitimately have *no* A-plot move and only B-story texture.

### 3. Slice-of-life and small-moment craft

Slice-of-life fiction prioritises subtle emotional shifts over dramatic plot
twists: "*a glance exchanged between friends, a hesitation before a
confession, the bittersweet nostalgia of a fading season.*" Stakes are
small but personal, drawn from emotional connection rather than world peril.

The form is dominated by characters' inner lives: *"characters' emotions are
the plot."* The charm of the genre lies in detail — captured sensory and
behavioural specifics — not in escalation.

Sources:
- https://en.wikipedia.org/wiki/Slice_of_life
- https://dovelynnwriter.com/2018/05/14/4-core-traits-of-plotted-slice-of-life-fiction/
- http://blog.janicehardy.com/2010/12/just-another-day-slice-of-life-stories.html
- https://theboar.org/2025/01/a-slice-of-life-the-quiet-joys-of-everyday-narratives/

Implication for this engine:

- A chapter shape catalogue must include *plot-free* shapes:
  `character_moment`, `daily_life`, `world_texture`, `interlude`.
- Eval must accept emotional value shifts as legitimate scene events even
  when no thread state changes.

### 4. Kishōtenketsu — non-conflict structure

The Chinese-Korean-Japanese 起承转合 / kishōtenketsu structure is a four-act
form in which **conflict is optional**:

- **起 / Ki** — introduction (characters, era, setting)
- **承 / Shō** — development (deepens, no major reversal yet)
- **转 / Ten** — twist (recontextualises rather than opposes)
- **合 / Ketsu** — reconciliation (the new perspective settles)

Meaning is built through *contrast*, not opposition. This explains why a
500-chapter Chinese web novel can sustain reader interest with extended
"承" stretches that would seem flat in a Western three-act framework — those
chapters are *deepening*, not stalling.

Sources:
- https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
- https://www.helpingwritersbecomeauthors.com/kishotenketsu-story-structure/
- https://artofnarrative.com/2020/07/08/kishotenketsu-exploring-the-four-act-story-structure/
- https://www.authorflows.com/blogs/kishotenketsu-story-structure-no-conflict

Implication for this engine:

- Long arcs should have explicit `Shō` stretches: chapters whose job is
  *deepening understanding*, not creating new pressure.
- The eval must not flag these as `payoff_too_early` or
  `thread_neglected` — they're doing the development work the form requires.

### 5. Character interiority and three-dimensional voice

Three-dimensional characters live in the gap between three statements:

- *what the character says they want*
- *what they think they want*
- *what they actually want*

(Source: McKee, *Story*; also surfaced in countercraft.substack and pdhines on
interiority.)

Deep POV technique — free indirect discourse, sensory filtering through the
character's awareness, characteristic vocabulary — is what makes a reader
feel they are *living inside the character's head* rather than watching a
plot move. Specific tools:

- **Sensory filter:** every described object passes through what *this*
  character would notice — a scent, a temperature, a texture.
- **Verbal habits:** the character has words they reach for, sentences they
  refuse, tics in syntax.
- **Mannerism:** physical habits — the way they hold a phone, the gesture
  they make when lying.
- **Subtext:** what they're feeling that they will not name, even to
  themselves.

Sources:
- https://nownovel.com/interiority-in-fiction-the-glue-between-inner-and-outer-worlds/
- https://countercraft.substack.com/p/the-view-from-inside-on-adding-interiority
- https://lisahallwilson.com/making-the-most-of-sensory-detail-in-deep-pov/
- https://pdhines.com/character-interiority/
- https://bang2write.com/2025/10/mastering-deep-third-pov-how-to-write-stories-that-feel-fully-immersive.html

Implication for this engine:

- Character profiles must track *voice quirks*, *sensory filters*,
  *mannerisms*, *subtext patterns* — separately from the existing
  `decisionProfile` (which captures choices, not voice).
- These voice fields must be surfaced to the writer prompt explicitly each
  chapter.
- Voice fields *grow* over chapters: a tic established in chapter 3 must
  appear again in chapter 12.

### 6. Multi-agent LLM writers' room

Recent research (Agents' Room, 2024–2025) shows multi-agent LLM systems that
decompose narrative writing into specialised roles — Director, Character
Agents, Critic — outperform single-prompt long-form generation in human
preference studies. Stories generated by structured, multi-agent systems are
consistently rated higher in structural coherence and narrative depth, and
are notably better at maintaining consistent character motivations.

Sources:
- https://aclanthology.org/2025.in2writing-1.9.pdf (Multi-Agent Based Character Simulation for Story Writing)
- https://openreview.net/pdf?id=HfWcFs7XLR (Agents' Room: Narrative Generation through Multi-step Collaboration)
- https://arxiv.org/pdf/2506.16445 (A Multi-Agent Framework for Long Story Generation)
- https://aclanthology.org/2025.findings-emnlp.750.pdf (Survey on LLMs for Story Generation)

Implication for this engine:

- Replace single-prompt episode packet generation with a **deliberation
  step** in which a Director LLM holds multiple humanistic concerns and
  picks chapter shape.
- Use **Character Agents** at writing time so each named character speaks
  in their own voice and acts on their own subtext, rather than the writer
  prompt mixing all of them.

### 7. Chinese web fiction reality

Chinese web novels run thousands of chapters at 2,000–4,000 characters each,
with daily updates and real-time reader feedback. The format demands:

- *Each chapter is a satisfying installment* — even a quiet one.
- *Cliffhangers and payoff cadence* drive subscription retention, but…
- *Daily-life and interaction-only chapters* exist on every major platform
  and are valued by readers — they cement attachment to the character.

Sources:
- https://thechinaproject.com/2022/08/17/chinas-sprawling-world-of-web-fiction/
- https://www.pioneerpublisher.com/SAA/article/download/1228/1126/1287
- https://simonkjones.substack.com/p/pacing-in-a-serialised-story
- https://www.chinese-forums.com/forums/topic/62025-my-18-months-experience-of-reading-original-chinese-webnovels/

Implication for this engine:

- "No plot move" chapters must be a first-class option, not a fallback.
- The pacing budget should explicitly reserve a fraction of chapters for
  daily-life / character-only / world-texture work.

## Architectural Shift

Two layers, with their roles inverted from the existing engine.

```
                ┌──────────────────────────────────────────────┐
                │  LAYER 2 — WRITERS' ROOM (foreground driver) │
                │                                              │
                │  Director LLM deliberates:                   │
                │   - what does this chapter need?             │
                │   - whose voice carries it?                  │
                │   - is this a plot, character, or world      │
                │     chapter?                                 │
                │   - what scenes, in what order?              │
                │   - which subtext lives in each scene?       │
                │   - which sensory anchors recur?             │
                │                                              │
                │  Output: scene packet sequence per chapter.  │
                └──────────────────────┬───────────────────────┘
                                       │
                                       │ writes scenes; emits state deltas
                                       ▼
                ┌──────────────────────────────────────────────┐
                │  LAYER 1 — SCHEDULER (guardrail, not driver) │
                │                                              │
                │  - Contracts (continuity, forbidden moves)   │
                │  - Threads (don't lose track of promises)    │
                │  - Scheduler scores (warn on neglect)        │
                │  - Runtime eval (catch drift)                │
                │                                              │
                │  Used to *constrain* the writers' room, not  │
                │  to choose the chapter for it.               │
                └──────────────────────────────────────────────┘
```

The existing engine is preserved. Its role changes from "decide the chapter"
to "tell the writers' room what must not break, what's been neglected, and
what continuity must hold."

## New Artifacts

### 1. Scene Packet (replaces episode packet's primary role)

A chapter is composed of 2–5 scene packets. Each scene packet has its own
goal, turn, and exit-state.

Storage:

- `chapters/chapter-XXX/scenes/scene-NNN.json`
- `chapters/chapter-XXX/scene_index.json` (ordered list)

Fields per scene packet:

- `id`
- `chapterNumber`
- `sceneNumber` (1-based within chapter)
- `sceneShape`: `plot_move | character_moment | relationship_beat | world_texture | interlude | sequel | reflection`
- `povCharacterId`
- `participants`: ordered character ids
- `setting`: location + sensory anchor refs
- `goalText`: what is *attempted* in this scene (may be small — "share a meal", "ask a question")
- `obstacleOrTexture`: what gets in the way OR what colours the scene if there's no obstacle
- `turnText`: what shifts (can be emotional, not plot)
- `exitState`: how the scene ends — value change in trust/mood/knowledge/posture
- `subtextPerCharacter`: map of character → what they're concealing in this scene
- `voiceCuesUsed`: which voice quirks the writer should deploy
- `sensoryAnchorsUsed`: which sense-memories recur
- `expectedDeltaIds`: zero or more state deltas the scene is expected to emit
- `wordTarget`: rough character target for this scene (e.g., 600–1200 cn chars)

A scene with `sceneShape = character_moment` is allowed to emit zero plot
deltas. The runtime eval must accept this.

### 2. Character Voice Profile (per character, accumulating)

Storage:

- `character-voice/<characterId>.json`

Fields:

- `id`
- `name`
- `voiceQuirks`: characteristic verbal habits (`"经常先沉默两秒再回答"`)
- `refusalPatterns`: things this character *will not* say
- `sensoryFilters`: what this character notices first (smell of money, the
  weight of someone's silence, the temperature of a room)
- `mannerisms`: physical habits (`"说谎时摸左手腕"`)
- `subtextPatterns`: emotions they consistently suppress (`"对感激的反射是冷淡"`)
- `firstAppearedChapter`
- `lastReinforcedChapter` (auto-updated when the writer uses the cue)
- `reinforcementCount`
- `establishedMoments`: ordered list of concrete chapter-references where the
  cue was earned ("第3章: 在地铁站第一次摸了左手腕")

Rule: a voice cue must be reinforced at least every N chapters or it counts
as forgotten. The writers' room is told to recycle existing cues before
inventing new ones — characters should *thicken*, not *bloat*.

### 3. Relationship Moments Log (per relationship pair)

Storage:

- `relationship-moments/<charA>__<charB>.json`

Fields:

- `pair`: `[charAId, charBId]`
- `momentSet`: ordered list of `{ chapterNumber, sceneNumber, summary, valueShift }`
  where `valueShift` is e.g. `{ trust: +5, intimacy: +2, debt: +1 }`
- `unsaidThings`: persistent list of what the pair has never spoken aloud
- `repeatedRituals`: small recurring beats ("每次见面她都先把外套挂在他左边")
- `firstTimeRecord`: explicit "first time X happened" register
  (`firstTouch`, `firstLie`, `firstSharedJoke`, `firstApology`)

This is the *texture* the user wants: not `trustLevel: 65` but a list of
remembered moments that the writer can reach for in later chapters.

### 4. Subtext Map (per scene)

Storage:

- inside each scene packet under `subtextPerCharacter`

Each entry:

```
{
  characterId,
  surfaceAction,       // what they do or say
  internalState,       // what they actually feel
  concealedTruth,      // what they are hiding from the other characters
  selfDeception        // what they are hiding from themselves
}
```

Required for at least the POV character; encouraged for any speaking role.

### 5. Sensory Anchor Bank

Storage:

- `sensory-anchors.json` (project-level)

Fields per anchor:

- `id`
- `kind`: `smell | sound | tactile | taste | sight | weight | rhythm`
- `description`
- `attachedTo`: optional character / location / object id
- `firstUsedChapter`
- `usageHistory`: ordered chapter numbers when used

Rule: a story is given roughly 8–20 sensory anchors at bootstrap. The
writers' room rotates through them so the world *re-occurs* sensorially —
the same subway smell on chapter 1 returns on chapter 7 in a different
emotional register.

### 6. Chapter Shape Catalogue

Replaces the existing `chapterMode` enum (which was scheduler-driven).

Shapes (ordered roughly by plot pressure, not strictly):

| Shape                | Allowed plot move? | Required ingredients |
|----------------------|--------------------|----------------------|
| `plot_advance`       | yes                | A-story scene + B-runner texture |
| `pressure_buildup`   | yes (small)        | scene with rising stakes, no resolution |
| `confrontation`      | yes (high)         | direct opposition; visible delta required |
| `payoff`             | yes (high)         | reward earned; setup debt must be low |
| `aftermath`          | no (mostly)        | reaction sequel scenes; emotional cost shown |
| `character_moment`   | no                 | one POV character's interiority; voice cues recycled |
| `relationship_beat`  | no                 | relationship-pair scene; moment added to log |
| `world_texture`      | no                 | setting deepens; sensory anchors recur |
| `interlude`          | no                 | shift POV to non-protagonist; runner advances |
| `reflection`         | no                 | sequel chapter — pure reaction/dilemma/decision |

The catalogue is open: new shapes can be added without changing the eval
shape contract.

### 7. Pacing Budget

A rolling window policy:

- Within any 7 consecutive chapters, **at least 2 should be non-plot
  shapes** (`character_moment`, `relationship_beat`, `world_texture`,
  `interlude`, or `reflection`).
- No more than **3 consecutive plot-pressure chapters**
  (`plot_advance`, `pressure_buildup`, `confrontation`, `payoff`).
- Long arcs (>30 chapters) must reserve at least one full chapter as
  `world_texture` per major-arc beat.

These are humanistic defaults; the writers' room can override with reason.

### 8. Director Deliberation

Replaces `buildEpisodePacketFromRuntime` as the foreground driver.

Inputs:

- the existing scheduler state (read-only — the guardrail)
- the existing contracts and threads (continuity constraints)
- voice profiles (what cues are due to recur)
- relationship moments (what's been seeded but not built on)
- sensory bank (which anchors are stale)
- pacing budget (what shape window we're in)
- recent chapter-shape history
- recent draft length history (avoid both compression and bloat)

Output:

- a *chapter plan*: chapter shape, scene roster, POV per scene, subtext
  per scene, voice cues to recycle, sensory anchors to recur, optional
  plot moves
- *narrative reasoning*: 3–5 sentences explaining why this chapter looks
  like this. Persisted in `chapters/chapter-XXX/director_brief.json`.

The deliberation is an **LLM prompt** that explicitly weighs craft concerns
in natural language, not a numeric formula. The director writes a brief in
the way a showrunner would talk to their writers' room, then the brief is
parsed into a structured chapter plan.

## Eval Shift

The existing runtime eval (`thread_scheduler`, `thread_economy`,
`episode_agency`, `state_deltas`, `offscreen_moves`, `commercial_variety`)
remains as a **continuity guardrail**. New humanistic eval sections are
added on top:

### Humanistic Eval Cases

| Section            | Question |
|--------------------|----------|
| `voice_continuity` | Did the writer recycle at least one voice cue per active character? |
| `voice_growth`     | Did any character earn a new cue in a believable way? |
| `relationship_texture` | Did at least one relationship gain a concrete remembered moment when its pair appeared in scene? |
| `pacing_breath`    | Is the rolling 7-chapter window within budget? |
| `subtext_present`  | Does each scene have non-empty subtext for its POV character? |
| `sensory_recurrence` | Did the writer use ≥1 anchor from the bank rather than inventing fresh? |
| `unsaid_pressure`  | Did the relationship moments log gain something to its `unsaidThings` *or* did an existing unsaid finally surface? |
| `value_shift_minimum` | Did each scene end with at least one value shifted, even if small? |

These cannot be substring-matched; they require either an LLM judge or
soft heuristics + human review.

The numeric scheduler eval cases (`payoff_too_early` etc.) become *advisory
context* for the director, not gates.

## What We Keep, Demote, or Add

### Keep
- `story-contracts.json`, `narrative-threads.json` (continuity backbone)
- `state_deltas.json` per chapter (runtime memory of what changed)
- `offscreen-moves.json` (antagonist/world progression)
- `runtime-eval-report.json` (continuity guardrails)
- `chapter generate-first` workflow shell
- Chinese decisionProfile / character-states / world-facts data

### Demote
- `episode_packet.json` — becomes a *summary* of the chapter's scenes, not
  the source of truth. The scene packets are the source of truth.
- `chooseChapterMode` numeric heuristic — becomes *one input* to the
  director deliberation, not the decision-maker.
- `payoff_too_early` etc. — becomes *advice surfaced to the director*, not a
  gating warning.
- The agency gate — re-implemented per scene, not per chapter. A
  `character_moment` scene doesn't need a non-transferable choice.

### Add
- Scene packets, scene index
- Character voice profiles
- Relationship moments log
- Subtext map per scene
- Sensory anchor bank
- Chapter shape catalogue
- Pacing budget tracker
- Director deliberation step (LLM)
- Character-agent writing step (LLM, optional but desirable)
- Humanistic eval sections

## Roadmap

### Phase A — Foundation: scene granularity

- Add `ScenePacket` domain type
- Add `chapters/chapter-XXX/scenes/` storage
- Add `scene plan` and `scene inspect` CLI commands
- Refactor chapter generation to: director writes chapter plan → writer
  produces each scene → scenes assembled into chapter draft + final review
- Existing single-draft writer remains as a fallback

Exit: a chapter is on disk as a sequence of inspectable scene packets, with
the chapter draft assembled from them.

### Phase B — Character voice profile

- Add `CharacterVoiceProfile` domain type
- Bootstrap a profile per main character (LLM + interview answers)
- After each chapter, an LLM "voice spotter" scans the draft and updates
  `usageHistory` for any cues it recognised (or proposes new cues for
  human approval)
- Surface voice profile in writer prompts

Exit: voice cues recur across chapters; a voice eval can be run.

### Phase C — Relationship moments log

- Add `RelationshipMomentsLog` domain type
- Bootstrap a log per primary relationship
- After each chapter, an LLM "moment spotter" extracts new moments and
  appends to the log (with `valueShift` quantified for the scheduler's
  benefit)
- Surface moments in writer prompts when the relationship pair appears

Exit: relationships have a concrete moment log that the writer can
reference back to instead of an abstract `trustLevel`.

### Phase D — Subtext map per scene

- Extend scene packets with `subtextPerCharacter`
- Director deliberation must produce subtext for the POV character of
  every scene
- Writer prompts receive the subtext as "what this character is hiding /
  feeling / refusing to say in this scene"

Exit: scenes have an explicit subtext layer; eval can check it's present.

### Phase E — Sensory anchor bank

- Add `SensoryAnchor` domain type
- Bootstrap 8–20 anchors per project (LLM + setting data)
- Director picks 1–3 anchors per chapter to recur
- Writer prompts surface them as "use these recurring sensations to anchor
  the world"

Exit: the world re-occurs sensorially across chapters.

### Phase F — Chapter shape catalogue + pacing budget

- Add `ChapterShape` enum and `PacingBudget` domain type
- Replace the existing `chapterMode` selection with shape selection
- Add a rolling-7-window budget tracker with eval support
- Allow zero-plot-move chapters

Exit: chapters can legitimately be quiet; the engine no longer forces
confrontation every chapter.

### Phase G — Director deliberation step

- Build the director LLM prompt (humanistic, natural-language)
- Director output: chapter shape, scene roster, POV per scene, subtext
  hints, voice cues, anchors, optional plot moves, narrative reasoning
- Persist `director_brief.json` per chapter
- The existing scheduler scores become *one input* to the director, not
  the decision-maker

Exit: a writer-LLM-style director picks chapters and explains why, in
prose. The scheduler becomes advisory.

### Phase H — Character-agent writing

- Optional but high-value. Per-scene writing routes through a Character
  Agent prompt for the scene's POV character that maintains:
  - that character's voice profile
  - that character's subtext for this scene
  - the relationship moments they share with other in-scene characters
- Non-POV characters speak through the POV character's filter

Exit: drafts read as if written from inside the POV character, not
narrated from above.

### Phase I — Humanistic eval

- Add the new eval sections (`voice_continuity`, `voice_growth`,
  `relationship_texture`, `pacing_breath`, `subtext_present`,
  `sensory_recurrence`, `unsaid_pressure`, `value_shift_minimum`)
- LLM-judge implementations where heuristics aren't reliable
- Optional human review surface (UI panel)

Exit: regression report tracks craft drift, not just continuity drift.

### Phase J — UI for scene-level inspection

- Scene timeline view per chapter
- Voice profile dashboard per character (cue usage histogram)
- Relationship moments timeline per pair
- Sensory anchor recurrence map
- Director-brief reader view

Exit: a writer can review every dimension that the engine now tracks
without opening JSON.

## Non-goals

- Replacing the existing scheduler. It stays as a guardrail.
- Removing the agency gate concept. It moves down to scene granularity.
- Auto-generating "perfect" prose. The goal is humanistic *organisation*;
  the LLM still does the writing.
- Locking in a single craft tradition. The chapter shape catalogue is
  open; Western three-act + Eastern kishōtenketsu + serial cliffhanger
  + slice-of-life all coexist.

## Migration Plan

1. Build Phases A–C alongside the existing engine. Both can produce
   chapters; switch is per-project flag.
2. Phase G replaces `buildEpisodePacketFromRuntime` for new projects;
   existing projects can opt in.
3. Numeric scheduler eval cases stay as-is, but their failures become
   *advisory* rather than *blocking* once Phase G ships.
4. Phase I adds new eval sections; regression report tracks both old and
   new.

## Success Criteria

The new system is working when:

- a chapter exists on disk that contains zero plot moves and is
  *purposeful*, not filler
- a reader can identify a character by their voice without seeing the
  name
- a relationship has at least three remembered, concrete moments by
  chapter 10
- a sensory anchor introduced in chapter 1 returns in chapter 7 in a
  different emotional register
- the rolling 7-window pacing budget is met by default
- the director writes a one-paragraph rationale that reads like a
  showrunner brief, not a scheduler dump
- existing continuity (contracts, threads, no contradictions) is
  unaffected

## Practical Near-Term Target

Do not attempt the full architecture in one push.

A thin vertical slice:

1. Phase A scene granularity for one chapter (chapter is composed of
   3 scenes; each has goal/turn/exit-state)
2. Phase D subtext map for those scenes
3. Phase F chapter shape catalogue with at least one zero-plot shape
4. Phase G director deliberation that picks the shape and writes the
   brief

If the resulting chapter feels meaningfully more humanistic than the
current engine's output on the same project state, expand into Phases
B / C / E / H / I / J.
