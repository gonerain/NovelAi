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
- `project inspect-consequences` reports delayed consequence status as `active`, `resolved`, or `indeterminate`
- `outline suggest-patches` produces local beat patch suggestions and suppresses delayed-consequence carry-forward when the source is already resolved
- `outline apply-patches` applies approved patch suggestions back into `beat-outlines.json` with an audit report
- `project regenerate-with-patches` routes suggested/applied outline patches into targeted regeneration
- patch application supports first-class selection/rejection flags: `--only-beat`, `--skip-beat`, `--only-type`, `--skip-type`
- planner is instructed and post-processed to prefer active consequence chains over stale beat wording
- UI resource navigation exposes existing role-driven sidecars and impact/patch reports for review
- `project role-eval` checks decision-log completeness, consequence-edge presence, and active consequence carryover with regression deltas
- UI friendly view summarizes role-driven review artifacts, patch reports, consequence inspections, and role-driven eval reports
- UI can explicitly run consequence inspection, patch suggestion, patch application, and role-driven eval from the workbench

Still missing:

- richer graph-style visualization beyond card summaries

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

Status: done enough for v1

Owns:

- detect when a consequence edge should alter future beats
- produce patch suggestions before regeneration
- route patch suggestions into existing impact / rewrite-plan workflow

Deliverables:

- `outline_patch_suggestions.json` - done
- command for inspecting chapter-to-beat pressure propagation - done
- `project inspect-consequences --project <id> --chapter <n>` - done
- `outline suggest-patches --project <id> --from-chapter <n>` - done
- apply/reject patch workflow - done through editable suggestions, selection/rejection flags, and `outline apply-patches`
- `project regenerate-with-patches --project <id> --target <id>` - done

Exit condition:

- changing a core choice no longer means blind invalidate-and-regenerate

### Phase 4: Decision-Aware Regeneration

Status: partially done

Owns:

- regenerate from target with optional beat patch
- make planner prefer active consequence chain over stale beat expectation

Exit condition:

- regeneration uses current causal state, not only original beat wording

## Priority Order

1. add graph-style visualization if card summaries are not enough
2. expand role-driven eval cases as failure modes appear
3. tighten UI affordances around destructive patch application if needed

## Commands To Add

### Added

- `project inspect-consequences --project <id> --chapter <n>`
- `outline suggest-patches --project <id> --from-chapter <n>`
- `outline apply-patches --project <id> --from-chapter <n>`
- `project regenerate-with-patches --project <id> --target <id>`
- `project role-eval --project <id>`
- patch selection flags: `--only-beat <ids>`, `--skip-beat <ids>`, `--only-type <types>`, `--skip-type <types>`

### Later

- graph-style UI visualization for decision propagation
- UI patch review and approval flow - basic explicit actions done

## Guardrails

- log only real choice points, not every scene action
- prefer one primary decision owner per beat
- if no real cost exists, it is not a valid consequence beat
- patch locally first
- keep hard ending/arc obligations outside automatic patch scope

## UI Position

UI should expose this system as inspection and editing support only:

- view decision logs - friendly card view done
- view relationship shifts - friendly card view done
- view consequence edges - friendly card view done
- review patch suggestions - friendly card view done
- review role-driven eval reports - friendly card view done

UI should not become the place where story logic is invented.
