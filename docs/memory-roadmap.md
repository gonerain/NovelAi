# Memory Framework Roadmap

## Goal

Build a memory framework for long-form novel generation that prioritizes:

- high recall for critical facts
- low prompt bloat
- deterministic retrieval for hard facts
- incremental file-based persistence now, database migration later

The current project already has `story-memories.json`, `context-builder`, and chapter-level memory updates. The next stages should upgrade this into a layered memory system instead of replacing the existing pipeline.

## Current Problems

- `StoryMemory` is still too flat. Resources, promises, injuries, and foreshadowing are mixed together.
- Retrieval is mostly a single scoring pass over memories plus world facts.
- Important hard facts can still be missed if they are not phrased close to the current chapter goal.
- Reviewers mostly look at the same visible context, so repeated review passes do not guarantee higher recall.
- Memory output is not yet split into stable file-based ledgers and retrieval sidecar files.

## Design Principles

- Hard facts should prefer structured ledgers over semantic guessing.
- Writer context should stay compact. Retrieval quality should improve before token count increases.
- Memory writes must stay traceable to source chapters.
- Every derived artifact should be reproducible from project files.
- File layout should mirror a future SQLite/Postgres schema closely.

## Target Architecture

### Layer 0: Core Memory

Always in context:

- author identity and constraints
- current arc / beat
- chapter objective
- active character states
- top unresolved threads

### Layer 1: Structured Ledgers

Deterministic memory for hard facts:

- resource ledger
- promise ledger
- injury ledger
- foreshadow ledger
- relationship ledger
- timeline ledger

### Layer 2: Chapter Cards

Per-chapter sidecar cards for retrieval:

- chapter summary
- next situation
- active characters
- referenced memory ids
- scene tags

### Layer 3: Retrieval Indexes

- entity to chapter map
- keyword / exact lookup
- semantic index later
- graph expansion later

### Layer 4: Digests

- active thread digest
- arc digest
- role digest

## Reference Projects And Takeaways

### `novel-creator-skill`

Worth copying:

- low-context strategy
- two-stage retrieval
- knowledge graph as a support layer, not the only truth source
- chapter gate artifacts

Not worth copying directly:

- very heavy command surface
- aggressive multi-agent orchestration too early

Reference:

- https://github.com/leenbj/novel-creator-skill

### `NovelForge`

Worth copying:

- schema-first content model
- explicit context injection
- preview-before-writeback workflow

Not worth copying directly:

- editor-heavy product scope
- UI and workflow complexity beyond current CLI stage

Reference:

- https://github.com/RhythmicWave/NovelForge

### Anthropic Context Engineering

Worth copying:

- memory, compaction, and tool clearing are different levers
- avoid context rot by keeping prompts small and relevant

Reference:

- https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools

### Letta / MemGPT

Worth copying:

- core memory versus archival memory split
- keep critical always-visible context separate from searchable context

Reference:

- https://docs.letta.com/guides/core-concepts/stateful-agents

### LangGraph Memory

Worth copying:

- semantic search as a store capability, not the whole architecture

Reference:

- https://www.langchain.com/blog/semantic-search-for-langgraph-memory

### LlamaIndex Recursive Retriever

Worth copying:

- retrieve summary nodes first, then drill down into detailed nodes

Reference:

- https://docs.llamaindex.ai/en/stable/examples/query_engine/recursive_retriever_agents/

### HippoRAG

Worth copying:

- graph-assisted retrieval for associative recall
- ranking across linked evidence instead of isolated chunks

Reference:

- https://github.com/osu-nlp-group/hipporag

## Phases

### Phase 1: File-Based Memory Skeleton

Status: implement now

Deliverables:

- `memory/chapter-cards.json`
- `memory/ledgers/resources.json`
- `memory/ledgers/promises.json`
- `memory/ledgers/injuries.json`
- `memory/ledgers/foreshadows.json`
- `memory/ledgers/relationships.json`
- `memory/ledgers/timeline.json`
- `memory/retrieval/entity-chapter-map.json`
- `memory/digests/active-threads.json`

Code changes:

- derive these artifacts from existing `storyMemories`, `characterStates`, `chapterPlans`, and chapter artifacts
- inject a compact retrieval pack into writer and reviewer context
- keep backward compatibility with current `story-memories.json`

### Phase 2: Specialized Retrieval

Deliverables:

- exact search by entity / alias / memory id
- per-reviewer retrieval views
- chapter-side retrieval debugging output

### Phase 3: Semantic Search

Deliverables:

- embedding index for chapter cards and long-form memory cards
- hybrid exact + semantic recall
- reranking step

### Phase 4: Graph Expansion

Deliverables:

- lightweight story graph
- 1-hop / 2-hop expansion around entities and threads
- change-impact tracing for outline edits

### Phase 5: Database Migration

Deliverables:

- SQLite first
- stable ids and migrations
- indexed retrieval over ledgers and cards

## TODO List

### Now

- [x] add file-based memory artifacts
- [x] add retrieval pack with chapter cards + ledger snapshots
- [x] expose retrieval outputs to writer and reviewer prompts
- [x] rebuild memory artifacts after chapter invalidation
- [x] verify type safety and sample generation
- [x] add planner search intent output
- [x] add chapter commercial controls for opening hook, visible problem, micro payoff, and end hook
- [x] add continuity guard so planner must advance from currentSituation and recentConsequences
- [x] add structured chapter reward typing and timing controls

### Next

- [x] add specialized reviewer retrieval
- [x] add retrieval debug report per chapter
- [x] add exact search helpers for ids, aliases, and titles
- [x] add chapter-level commercial reviewer for hook clarity, payoff delivery, and end-hook strength
- [x] add reward rotation heuristics from prior chapter plans
- [x] add genre-specific payoff packs for male-oriented webnovel, female-oriented relationship tension, and suspense

### Later

- [ ] upgrade local semantic vector search to provider-backed embeddings when cost/perf justifies it
- [ ] add graph expansion
- [x] add retrieval eval set with planted facts
- [ ] add database-backed storage

## Delivery Status

- Phase 1 is effectively done in code: file-based memory artifacts, retrieval pack injection, and planner search intent are working.
- A parallel commercial-control track is now in progress: planner and writer can exchange opening mode, visible problem, payoff, and hook signals.
- Retrieval eval now has a file-based scaffold and CLI, so recall changes can be measured instead of judged only by feel.
- Retrieval eval now supports regression-style comparison against the previous report, and chapter generation can opt into `--with-eval` / `--strict-eval`.
- Phase 3 has an initial local slice: chapter cards and long-form memories now feed a provider-free semantic vector index, and retrieval is hybrid exact + semantic without weakening ledger-first hard fact recall.
- The next meaningful milestone is not more memory volume. It is hybrid search or graph expansion, but only against that eval baseline.

## Known Risks

- wrong memory writeback becomes high-recall wrong retrieval
- too many ledgers can bloat prompts if not compiled carefully
- graph maintenance cost can exceed value early
- reviewer fan-out can increase cost without increasing truth if retrieval is weak

## Guardrails

- every derived memory artifact must remain reproducible
- every ledger entry should preserve source chapter references
- writer context should stay compact and selective
- hard facts should prefer ledger retrieval over semantic retrieval
