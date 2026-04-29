# NovelAi Architecture & Pipeline Diagrams

This document is a navigational map of the engine. Each Mermaid block
renders directly on GitHub. Read the diagrams in the order they appear —
each one zooms in further than the previous.

> 6 diagrams, 1 CLI table:
> 1. System topology (top-down)
> 2. Chapter generation pipeline (per-chapter sequence)
> 3. Per-chapter data artifacts (file flow)
> 4. Module layer dependencies (file map)
> 5. Runtime data loop (cross-chapter state)
> 6. Future humanistic layer overlay
> 7. CLI command map

---

## 1. System Topology

The engine has six concentric layers. CLI/UI on the outside, pure
domain logic on the inside. Each outer layer depends only on the
layers inside it.

```mermaid
flowchart TD
    subgraph CLI_UI["CLI + UI · entry points"]
        CLI["src/v1.ts · CLI router"]
        SCRIPT["scripts/generate-project.sh"]
        UI["src/ui.ts · HTTP server<br/>src/ui/index.html · app.js"]
    end

    subgraph WORKFLOWS["Workflows · v1-*.ts"]
        BOOT["v1-bootstrap.ts<br/>v1-runner.ts"]
        OUTLINE["outline-lib.ts<br/>+ v1-mutations.ts"]
        THREADS["v1-threads.ts<br/>· seed/inspect/rank/update<br/>· suggest-next/economy/eval"]
        EPISODE["v1-episode.ts<br/>· plan/inspect/eval/revise"]
        CHAPGEN["v1-chapter-generation.ts<br/>· main loop"]
        DELTAS["v1-deltas.ts"]
        OFFSCREEN["v1-offscreen.ts"]
        IMPACT["v1-impact.ts<br/>v1-rewrite-draft.ts<br/>v1-draft-rewrites.ts"]
        RTEVAL["v1-runtime-eval.ts<br/>· 6-section aggregator"]
        SHARED["v1-shared.ts<br/>v1-lib.ts<br/>v1-formatters.ts<br/>v1-paths.ts<br/>v1-artifacts.ts"]
    end

    subgraph PROMPTS["LLM prompts · src/prompts/*"]
        PR_PLAN["planner.ts"]
        PR_WRITE["writer.ts"]
        PR_REVIEW["review-*.ts"]
        PR_MEM["memory-updater.ts"]
        PR_REWRITE["rewriter.ts"]
    end

    subgraph DOMAIN["Domain · src/domain/* · pure types + logic"]
        D_TYPES["types.ts"]
        D_THREAD["thread-scheduler.ts<br/>thread-updater.ts<br/>thread-economy.ts"]
        D_AGENCY["agency-eval.ts"]
        D_DELTA["state-delta-eval.ts"]
        D_OFF["offscreen-moves.ts"]
        D_VARIETY["commercial-variety.ts"]
        D_CTX["context-builder.ts<br/>memory-system.ts<br/>retrieval-eval.ts"]
        D_OTHER["planner.ts · writer.ts · reviewer.ts<br/>change-impact.ts · rewrite-policy.ts<br/>chapter-mapping.ts · payoff-patterns.ts<br/>author-profile-* · author-interview-*"]
    end

    subgraph STORAGE["Storage · src/storage/*"]
        REPO["FileProjectRepository<br/>· per-project JSON files<br/>· chapter sidecars"]
    end

    subgraph LLMS["LLM service · src/llm/*"]
        SERVICE["LlmService · DeepSeek wrapper"]
    end

    CLI --> WORKFLOWS
    SCRIPT --> CLI
    UI --> WORKFLOWS

    WORKFLOWS --> PROMPTS
    WORKFLOWS --> DOMAIN
    WORKFLOWS --> STORAGE
    WORKFLOWS --> LLMS

    PROMPTS --> DOMAIN
    DOMAIN --> D_TYPES
    STORAGE --> D_TYPES
```

**Reading guide:**
- Solid arrows = "imports from" / "calls into."
- Workflows are the only files that touch storage *and* prompts *and*
  domain. They are the integration glue.
- Domain modules are pure: no IO, no LLM calls, no async by default.

---

## 2. Chapter Generation Pipeline (per chapter)

This is the runtime that fires every time a chapter is generated.
Each `↪ LLM` step is a network call to the configured provider.

```mermaid
sequenceDiagram
    autonumber
    participant CLI as CLI / Script
    participant Run as v1-runner.runV1
    participant Gen as generateChapterArtifact
    participant Off as applyOffscreenMovesForChapter
    participant Plan as planEpisodePacket
    participant Eval as evalEpisodePacket (agency gate)
    participant LLM as LlmService
    participant Ctx as buildContextPack
    participant Roles as buildDecisionLog<br/>buildRelationshipShift<br/>buildConsequenceEdges
    participant Repo as FileProjectRepository
    participant Upd as updateThreadsFromChapter

    CLI->>Run: chapter generate-first --count N
    Run->>Run: ensureBootstrappedProject<br/>(skips if already bootstrapped)
    loop for each chapter
        Run->>Gen: generateChapterArtifact(...)
        Gen->>Off: apply due offscreen moves
        Off->>Repo: load offscreen-moves.json
        Off->>Repo: save updated threads + moves
        Gen->>Plan: planEpisodePacket
        Plan->>Repo: load contracts + threads + recent packets
        Plan->>Plan: rankNarrativeThreads<br/>buildEpisodePacketFromRuntime<br/>(mode/payoff rotation)
        Plan->>Repo: save episode_packet.json
        Gen->>Eval: evalEpisodePacket (agency gate)
        Eval-->>Gen: passed=true (else throw)
        Gen->>LLM: ↪ planner (retry-wrapped)
        LLM-->>Gen: ChapterPlan
        Gen->>Ctx: buildContextPack (writer + reviewer)
        Gen->>LLM: ↪ writer
        LLM-->>Gen: draft v1
        par initial review fan-out
            Gen->>LLM: ↪ review_missing_resource
            Gen->>LLM: ↪ review_fact
            Gen->>LLM: ↪ review_commercial
            Gen->>LLM: ↪ review_role_drive (sees prior chapter snapshot)
        end
        Gen->>Gen: buildRewritePlan
        opt rewrite needed
            Gen->>LLM: ↪ rewriter (mode = repair_first / hybrid_upgrade /<br/>commercial_tune / quality_boost)
        end
        opt cn_chars < 2500
            Gen->>LLM: ↪ rewriter (mode = length_expand · safety net)
        end
        par final review fan-out
            Gen->>LLM: ↪ review_missing_resource_final
            Gen->>LLM: ↪ review_fact_final
            Gen->>LLM: ↪ review_commercial_final
            Gen->>LLM: ↪ review_role_drive_final
        end
        Gen->>LLM: ↪ memory_updater (retry-wrapped)
        LLM-->>Gen: memoryPatches + newMemories
        Gen->>Roles: build sidecars (chapter-aware)
        Gen->>Repo: save result.json + draft.md +<br/>episode_packet + episode_eval +<br/>decision_log + relationship_shift +<br/>consequence_edges + chapter_stats +<br/>memory_update_validation
        Gen->>Upd: updateThreadsFromChapter (auto)
        Upd->>Repo: extractStateDeltas<br/>applyDeltasToThreads (capped)
        Upd->>Repo: save state_deltas + narrative-threads +<br/>thread_update_report
        Gen-->>Run: artifact
    end
    Run-->>CLI: V1RunResult
    opt --with-runtime-eval
        CLI->>CLI: runtime eval --chapter N<br/>(6-section aggregator + regression)
    end
```

**Reading guide:**
- Steps `Off` (offscreen apply) and `Upd` (thread update) bracket the
  chapter — pre-pressure goes in, post-pressure goes out.
- The agency gate (step 7) is what blocked chapter 4 in the very first
  run. Now passes because the eval strips quoted context before the
  passive scan.
- The `length_expand` rewrite (step ~12) is the safety net that fired
  on chapter 3 of `demo_run_b` (2213 → 4304 cn chars).
- 10 LLM calls is the typical chapter cost. With one retry on
  `memory_updater` truncation, ~11.

---

## 3. Per-chapter Data Artifacts

Every chapter writes about a dozen artifacts. This is the dataflow
between them.

```mermaid
flowchart LR
    subgraph PROJ["Project-level (read by chapter, updated by chapter)"]
        SC["story-contracts.json"]
        NT["narrative-threads.json"]
        OM["offscreen-moves.json"]
        SM["story-memories.json"]
        CS["character-states.json"]
        WF["world-facts.json"]
        AO["arc-outlines.json"]
        BO["beat-outlines.json"]
        SO["story-outline.json"]
        SP["story-setup.json"]
        CP["chapter-plans.json"]
    end

    subgraph CHAP["chapters/chapter-NNN/ (written this chapter)"]
        EP["episode_packet.json"]
        EPE["episode_eval.json"]
        PL["plan (in result.json)"]
        DR["draft.md"]
        RES["result.json · ChapterArtifact"]
        DL["decision_log.json"]
        RS["relationship_shift.json"]
        CE["consequence_edges.json"]
        SD["state_deltas.json"]
        TUR["thread_update_report.json"]
        STATS["chapter_stats.json"]
        MV["memory_update_validation.json"]
    end

    subgraph MEM["memory/eval/ + memory/retrieval/"]
        RTE["runtime-eval-report.json"]
        RTREG["runtime-eval-regression.json"]
        RDE["role-driven-eval-report.json"]
        EVS["retrieval-eval-set.json"]
        EVR["retrieval-eval-report.json"]
        EMB["embedding-cache.json"]
    end

    %% inputs into a chapter
    SC --> EP
    NT --> EP
    OM --> EP
    SM --> RES
    CS --> EP
    WF --> RES
    AO --> EP
    BO --> EP

    %% chapter outputs feed each other
    EP --> EPE
    EP --> PL
    PL --> DR
    DR --> RES
    RES --> DL
    DR --> DL
    DL --> RS
    DL --> CE
    EP --> SD
    DL --> SD
    RS --> SD
    CE --> SD
    SM --> SD
    SD --> TUR
    SC --> TUR
    TUR --> NT

    %% chapter -> project state mutations
    RES -. updates .-> SM
    RES -. upserts .-> CP
    TUR -. mutates .-> NT
    EP -. unchanged .-> SC

    %% eval pulls from artifacts
    EP --> RTE
    EPE --> RTE
    SD --> RTE
    NT --> RTE
    OM --> RTE
    RTE --> RTREG

    classDef proj fill:#1f3a5f,stroke:#5b8def,color:#eaeaea;
    classDef chap fill:#4a2f5f,stroke:#a06fbf,color:#eaeaea;
    classDef mem fill:#1e5f4f,stroke:#5fc59f,color:#eaeaea;
    class SC,NT,OM,SM,CS,WF,AO,BO,SO,SP,CP proj
    class EP,EPE,PL,DR,RES,DL,RS,CE,SD,TUR,STATS,MV chap
    class RTE,RTREG,RDE,EVS,EVR,EMB mem
```

**Reading guide:**
- **Blue boxes** are project-level (live at `data/projects/<id>/`).
- **Purple boxes** are chapter-level sidecars (live at
  `data/projects/<id>/chapters/chapter-NNN/`).
- **Green boxes** are eval reports.
- Solid arrows = "is read by." Dashed arrows = "writes back to."
- The closed loop `state_deltas → thread_update_report →
  narrative-threads` is what makes chapter N+1's ranking depend on
  what chapter N actually did.

---

## 4. Module Layer Dependencies

How the source files relate to each other.

```mermaid
flowchart TB
    subgraph L0["Layer 0 · Pure types"]
        TYPES["domain/types.ts"]
    end

    subgraph L1["Layer 1 · Pure logic + algorithms"]
        SCHED["thread-scheduler.ts"]
        UPD["thread-updater.ts"]
        ECON["thread-economy.ts"]
        AG["agency-eval.ts"]
        DEV["state-delta-eval.ts"]
        OFF["offscreen-moves.ts"]
        VAR["commercial-variety.ts"]
        CTXB["context-builder.ts"]
        MEM["memory-system.ts<br/>memory-updater.ts"]
        REVW["reviewer.ts<br/>writer.ts<br/>planner.ts"]
        OUTLINE["outline-generation.ts"]
        IMPACT["change-impact.ts<br/>rewrite-policy.ts"]
        AUTHOR["author-interview*<br/>author-profile-*"]
        RETR["retrieval-eval.ts<br/>chapter-mapping.ts<br/>payoff-patterns.ts<br/>chapter-artifact.ts"]
    end

    subgraph L2["Layer 2 · LLM prompt builders"]
        PWRITE["prompts/writer.ts"]
        PPLAN["prompts/planner.ts"]
        PREV["prompts/review-*.ts<br/>+ memory-updater.ts<br/>+ rewriter.ts"]
    end

    subgraph L3["Layer 3 · IO + LLM service"]
        REPO["storage/file-project-repository.ts<br/>+ project-repository.ts"]
        SVC["llm/service.ts"]
        ART["v1-artifacts.ts<br/>· readJsonArtifact<br/>· writeJsonArtifact"]
        PATHS["v1-paths.ts<br/>· ~30 path helpers"]
    end

    subgraph L4["Layer 4 · Workflows"]
        SHARED["v1-shared.ts"]
        BOOT["v1-bootstrap.ts"]
        RUN["v1-runner.ts"]
        CGEN["v1-chapter-generation.ts"]
        EPI["v1-episode.ts"]
        THR["v1-threads.ts"]
        DEL["v1-deltas.ts"]
        OFFW["v1-offscreen.ts"]
        IMPW["v1-impact.ts<br/>v1-rewrite-draft.ts<br/>v1-mutations.ts<br/>v1-draft-rewrites.ts"]
        RTE["v1-runtime-eval.ts"]
        RDRIVE["v1-role-drive.ts"]
        FMT["v1-formatters.ts"]
        LIB["v1-lib.ts · re-exports"]
    end

    subgraph L5["Layer 5 · Entry points"]
        CLI["v1.ts · CLI router"]
        UI["ui.ts + ui/*"]
        SCRIPT["scripts/generate-project.sh"]
    end

    L0 --> L1
    L1 --> L2
    L0 --> L2
    L0 --> L3
    L1 --> L3
    L1 --> L4
    L2 --> L4
    L3 --> L4
    L4 --> L5
    L4 --> LIB
    LIB --> CLI
    LIB --> UI
    SCRIPT --> CLI
```

**Reading guide:**
- Strict layering. Higher layers import from lower; never the reverse.
- Tests live next to the file they test (`*.test.ts`) and only import
  from their own layer or below.
- `v1-lib.ts` is the public face of layer 4 — anything CLI/UI needs
  re-exports from there.

---

## 5. Runtime Data Loop (cross-chapter state)

How threads, contracts, and offscreen moves evolve across multiple
chapters. This is the *deterministic* loop the runtime guarantees.

```mermaid
flowchart LR
    subgraph CH_N["Chapter N"]
        OF1["1. apply due<br/>offscreen moves"]
        EP1["2. plan packet<br/>· rank threads<br/>· rotate mode/payoff<br/>· content-aware endHook"]
        AGC["3. agency gate"]
        WR["4. writer + 4 reviews +<br/>optional rewrite +<br/>length-expand safety net +<br/>4 final reviews +<br/>memory updater"]
        DLT["5. extract state deltas<br/>(packet + memory + decision +<br/>relationship + consequence)"]
        UPD1["6. apply deltas to threads<br/>(per-chapter cap ±25-40)"]
    end

    subgraph CH_N1["Chapter N+1"]
        OF2["...same loop, but threads have<br/>moved · staleness reset for touched ·<br/>readerDebt down for visible majors ·<br/>offscreenPressure up for hidden ·<br/>setupDebt down for thread_progress"]
    end

    subgraph PERSIST["Persisted state (project-level)"]
        T["narrative-threads.json"]
        C["story-contracts.json (read-only mostly)"]
        O["offscreen-moves.json"]
        SDC["per-chapter state_deltas[]"]
    end

    subgraph EVAL["Per-N runtime eval"]
        E1["thread_scheduler"]
        E2["thread_economy<br/>· cadence-aware payoff_too_early"]
        E3["episode_agency"]
        E4["state_deltas"]
        E5["offscreen_moves"]
        E6["commercial_variety<br/>· hook + payoff + mode"]
        REG["runtime-eval-regression.json"]
    end

    OF1 --> EP1 --> AGC --> WR --> DLT --> UPD1 --> CH_N1
    UPD1 -. writes .-> T
    UPD1 -. writes .-> SDC
    OF1 -. writes .-> O
    OF1 -. writes .-> T
    EP1 -. reads .-> T
    EP1 -. reads .-> C
    AGC -. reads .-> C

    T --> EVAL
    C --> EVAL
    O --> EVAL
    SDC --> EVAL
    EVAL --> REG
```

**Reading guide:**
- Threads are *never* mutated except through `applyDeltasToThreads` or
  `applyDueOffscreenMoves`. Both have audit reports.
- Per-chapter scheduler-delta cap (`±25–40` per field) prevents
  saturation from N parallel deltas in one chapter.
- Cadence-aware `payoff_too_early` rule: exempt for `frequent` /
  `every_chapter`, tighter threshold for `periodic`, standard for
  `slow_burn`.

---

## 6. Future Humanistic Layer Overlay (deferred)

The deferred long-range vision in
`docs/archive/character-driven-narrative-roadmap.md`. The existing
scheduler is preserved as a *guardrail*; a writers'-room layer
becomes the foreground driver. This shift is no longer the active
plan — `docs/sprint-0-task-driven-plan.md` reaches the same goal
via task-driven semi-supervision at lower risk. The diagram below
is kept for context; pieces of it (voice profiles, relationship
moments, sensory anchors) may auto-bootstrap from sprint 0 success.

```mermaid
flowchart TD
    subgraph NEW["Layer 2 · Writers' room (NEW · foreground driver)"]
        DIR["Director LLM<br/>· deliberates humanistic concerns<br/>· emits chapter shape +<br/>scene roster + reasoning"]
        DBR["director_brief.json"]
        SCN["Scene packets (2-5 / chapter)<br/>chapters/chapter-NNN/scenes/scene-NNN.json"]
        VOICE["Character voice profiles<br/>(per character, accumulating)"]
        MOM["Relationship moments log<br/>(per pair · firstTimes · unsaidThings)"]
        ANCH["Sensory anchor bank<br/>(8-20 per project · rotating)"]
        SUB["Subtext map (per scene)"]
        PB["Pacing budget tracker<br/>(rolling 7-window)"]
        CA["Character agents<br/>(per-scene POV writer)"]
    end

    subgraph OLD["Layer 1 · Scheduler (KEPT · demoted to guardrail)"]
        T["narrative-threads · scheduler scores"]
        C["story-contracts · forbidden moves"]
        D["state_deltas · continuity tracking"]
        OFF["offscreen-moves · world progression"]
        EV["runtime eval · 6 sections"]
    end

    subgraph HEV["Layer 3 · Humanistic eval (NEW)"]
        H1["voice_continuity"]
        H2["voice_growth"]
        H3["relationship_texture"]
        H4["pacing_breath"]
        H5["subtext_present"]
        H6["sensory_recurrence"]
        H7["unsaid_pressure"]
        H8["value_shift_minimum"]
    end

    DIR -- reads as advice --> T
    DIR -- reads as constraint --> C
    DIR -- reads --> D
    DIR -- reads --> OFF
    DIR -- consults --> VOICE
    DIR -- consults --> MOM
    DIR -- consults --> ANCH
    DIR -- consults --> PB
    DIR --> DBR
    DIR --> SCN
    SCN -- includes --> SUB
    SCN -- selects --> VOICE
    SCN -- selects --> ANCH
    CA -- writes from --> SCN
    CA -- voiced by --> VOICE

    SCN -- still emits --> D
    D -- still updates --> T
    T -- still gates via --> C

    SCN --> HEV
    VOICE --> H1
    VOICE --> H2
    MOM --> H3
    PB --> H4
    SUB --> H5
    ANCH --> H6
    MOM --> H7
    SCN --> H8

    EV --> HEV

    classDef new fill:#1e5f4f,stroke:#5fc59f,color:#eaeaea;
    classDef old fill:#1f3a5f,stroke:#5b8def,color:#eaeaea;
    classDef heval fill:#4a2f5f,stroke:#a06fbf,color:#eaeaea;
    class DIR,DBR,SCN,VOICE,MOM,ANCH,SUB,PB,CA new
    class T,C,D,OFF,EV old
    class H1,H2,H3,H4,H5,H6,H7,H8 heval
```

**Reading guide:**
- **Green** = new humanistic layer (proposed in the roadmap, not yet
  implemented).
- **Blue** = current scheduler engine, preserved as a guardrail.
- **Purple** = new humanistic eval sections that complement the
  existing 6-section runtime eval.
- Roles invert: today's scheduler picks the chapter; in the proposed
  layer the Director picks the chapter and the scheduler only
  surfaces neglect / contracts as advice.
- Toggle via `humanistic_layer: true|false` per project.

---

## 7. CLI Command Map

Currently exposed CLI commands, grouped by concern. Run any of them
through `./run-v1.sh <group> <action> --project <id> [...flags]`.

| Group | Action | Purpose |
|---|---|---|
| `project` | `bootstrap` | Create project + run author interview / preset bootstrap. |
| `project` | `interview` | Interactive interview (alternative to preset). |
| `project` | `profiles` | List author preset catalogue. |
| `project` | `inspect` | Summarise project state. |
| `project` | `paths` | Print all file paths for the project. |
| `project` | `impact` | Change-impact analysis on a target. |
| `project` | `inspect-consequences` | Read role-drive consequence edges. |
| `project` | `rewrite-plan` | Plan a regeneration from a target. |
| `project` | `regenerate-from-target` | Invalidate downstream + regenerate. |
| `project` | `regenerate-with-patches` | Apply patches + regenerate. |
| `project` | `role-eval` | Role-drive eval pass. |
| `memory` | `eval-seed` | Seed retrieval eval set. |
| `memory` | `eval-run` | Run retrieval eval + regression. |
| `story` | `inspect-contracts` | List story contracts. |
| `threads` | `seed` | Bootstrap initial 5-thread runtime + 6 contracts. |
| `threads` | `inspect` | Show contracts + threads + active count. |
| `threads` | `rank` | Rank threads with explanatory reasons + warnings. |
| `threads` | `inspect-deltas` | Read per-chapter state deltas. |
| `threads` | `update-from-chapter` | Apply deltas to threads (auto-fired during chapter generation; can also be invoked manually). |
| `threads` | `economy` | Span-economy report (`thread_overstretched`, `payoff_too_early`, etc.). |
| `threads` | `eval` | Combined economy + scheduler eval. |
| `threads` | `suggest-next` | Local steering: propose next chapter's primary + supporting moves. |
| `episode` | `plan` | Build episode packet for a chapter. |
| `episode` | `inspect` | Read episode packet. |
| `episode` | `eval` | Agency eval. |
| `episode` | `revise-packet` | Snapshot + regenerate the packet (local steering). |
| `offscreen` | `schedule` | Seed offscreen moves from cast roles. |
| `offscreen` | `inspect` | Inspect moves + run eval. |
| `offscreen` | `apply` | Apply due moves to threads (auto-fired during chapter generation). |
| `runtime` | `eval` | 6-section runtime eval + regression diff (`--strict-eval` blocks). |
| `outline` | `inspect` | Inspect story+arc+beat outlines. |
| `outline` | `suggest-patches` | Role-drive patch suggestions. |
| `outline` | `apply-patches` | Apply outline patches. |
| `outline` | `generate-stack` | Generate story+arc+beat outlines (LLM). |
| `outline` | `generate-drafts` | Render `detailed-outline.md` for human review. |
| `outline` | `approve-detail` | Mark detailed outline approved (gates chapter gen). |
| `outline` | `validate` | Outline validation. |
| `chapter` | `generate` | Generate one chapter end-to-end (LLM). |
| `chapter` | `generate-first` | Generate the first N chapters (LLM). |
| `chapter` | `inspect` | Read a generated chapter. |
| `chapter` | `rewrite` | Rewrite a chapter (full regen). |
| `chapter` | `rewrite-draft` | Rewrite just the draft (keep plan + reviews). |
| `chapter` | `apply-draft-rewrite` | Promote a draft rewrite to canonical. |
| `chapter` | `list-draft-rewrites` | List draft-rewrite versions. |
| `chapter` | `inspect-draft-rewrite` | Read one rewrite version. |
| `chapter` | `invalidate-from` | Delete chapters from N onward. |
| `chapter` | `invalidate-target` | Delete chapters affected by a target. |
| `chapter` | `reset-all` | Wipe all chapters. |

The shell wrapper `scripts/generate-project.sh` chains the bootstrap →
outline → approve → threads-seed → optional offscreen-schedule →
chapter-generate-first → optional runtime-eval steps with idempotent
skipping.

---

## Cross-references

- Phase-by-phase build order: `docs/longform-narrative-engine-todolist.md`
- Original engine vision: `docs/longform-narrative-engine-roadmap.md`
- Current next-sprint plan (task-driven semi-supervision):
  `docs/sprint-0-task-driven-plan.md`
- Future humanistic layer (deferred):
  `docs/archive/character-driven-narrative-roadmap.md`
- Archived sprint 1 plan (superseded by sprint 0):
  `docs/archive/sprint-1-humanistic-plan.md`
- Archived earlier docs: `docs/archive/`
