# Character-Driven Dynamic Outline Roadmap

## Goal

Make long-form progression come from:

- character choice under pressure
- visible consequence chains
- local outline adjustment

The engine is:

`choice -> consequence -> new pressure -> next choice`

Not:

`author wants next arc -> event happens`

## Non-Goals

- not a full autonomous story agent
- not freeform re-planning every chapter
- not replacing outline with improvisation

## Current Status

Already in code:

- `CharacterState.decisionProfile`
- beat-level decision fields
- planner sees active decision profiles
- writer/reviewer context preserves decision pressure
- role-driven reviewer exists
- per-chapter sidecars:
  - `decision_log.json`
  - `relationship_shift.json`
  - `consequence_edges.json`
- planner can see unresolved delayed consequences from prior chapters

Still missing:

- future beat patching from consequence edges
- project-level inspection tools for decision propagation
- stronger distinction between "resolved" and "still active" delayed consequences

## Design Rules

### 1. Character beats event

Every major turn should answer:

- who had pressure
- what options they had
- what they chose
- what cost that choice created

### 2. Outline gives boundaries, not choreography

Outline should lock:

- arc goal
- theme direction
- required irreversible turns
- ending obligations

Outline should stay flexible on:

- scene route
- who says what first
- how a beat is executed

### 3. Local patch only

If a chapter changes future pressure, patch:

- affected beats
- relationship trajectory notes
- delayed consequence notes

Do not re-outline the whole book unless the arc skeleton is already wrong.

## Roadmap

### Phase 1: Decision Schema

Status: done enough for v1

Owns:

- character decision profiles
- beat decision fields
- planner awareness

Exit condition:

- planner can produce chapter plans that clearly name chooser, pressure, and outcome

### Phase 2: Chapter Consequence Tracking

Status: partially done

Owns:

- chapter decision logs
- relationship shift sidecars
- consequence edges
- unresolved delayed consequence carryover

Exit condition:

- every important chapter can be read as a compact decision chain without opening the full draft

### Phase 3: Outline Patch Suggestions

Status: in progress

Owns:

- detect when a consequence edge should alter future beats
- produce patch suggestions before regeneration
- route patch suggestions into existing impact / rewrite-plan workflow

Deliverables:

- `outline_patch_suggestions.json`
- command for inspecting chapter-to-beat pressure propagation
- `project inspect-consequences --project <id> --chapter <n>`
- `outline suggest-patches --project <id> --from-chapter <n>`

Exit condition:

- changing a core choice no longer means blind invalidate-and-regenerate

### Phase 4: Decision-Aware Regeneration

Status: later

Owns:

- regenerate from target with optional beat patch
- make planner prefer active consequence chain over stale beat expectation

Exit condition:

- regeneration uses current causal state, not only original beat wording

## Priority Order

1. make beat patch suggestions
2. add consequence propagation inspection
3. tighten delayed-consequence resolution logic
4. only then consider visualization

## Commands To Add

### Next

- `project inspect-consequences --project <id> --chapter <n>`
- `outline suggest-patches --project <id> --from-chapter <n>`

### Later

- `project regenerate-with-patches --project <id> --target <id>`

## Guardrails

- log only real choice points, not every scene action
- prefer one primary decision owner per beat
- if no real cost exists, it is not a valid consequence beat
- patch locally first
- keep hard ending/arc obligations outside automatic patch scope

## UI Position

UI should expose this system as inspection and editing support only:

- view decision logs
- view relationship shifts
- view consequence edges
- review patch suggestions

UI should not become the place where story logic is invented.
