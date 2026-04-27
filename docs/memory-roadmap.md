# Memory Roadmap

## Goal

Keep long-form recall reliable without dumping the whole project into every prompt.

The system should prefer:

- deterministic lookup for hard facts
- compact writer context
- reproducible derived artifacts
- file-first storage now, database later

## Current Status

Already in code:

- file-based memory artifacts
- ledger snapshots
- chapter cards
- exact search helpers
- semantic retrieval
- graph expansion
- retrieval eval
- impact / rewrite-plan / regenerate linkage

This is enough for a working v1.

The main risks are no longer "missing features". They are:

- bad memory writeback
- eval coverage being too narrow
- graph logic still being shallow

## What Matters Now

### 1. Writeback quality

If memory writeback is wrong, better retrieval only amplifies wrong facts.

Priority:

- strengthen contradiction review between chapter text and ledger updates
- classify writeback warnings explicitly:
  - `contradiction`: conflicts with existing facts or invalid state transitions
  - `unsupported`: update cannot be grounded in the current chapter text
  - `overgeneralized`: one-off behavior gets written back as a stable trait or rule
- keep warnings explicit and chapter-local

### 2. Eval coverage

Current eval is useful but too narrow.

Priority:

- add more realistic failure cases
- include non-memory continuity cases
- make regressions easier to diagnose

### 3. Better dependency paths

Current graph helps recall, but it is still shallow.

Priority:

- explicit thread dependency paths
- foreshadow callback paths
- resource dependency paths

## Priority Order

1. chapter-text + ledger contradiction review
2. broaden retrieval eval suites
3. deepen graph dependency paths
4. database-backed canonical indexes

## Deferred On Purpose

- more reviewer fan-out
- heavier semantic tricks
- big database migration before query pain is real

## Storage Decision

Not worth a full database migration yet.

Plan:

- keep JSON artifacts as source-visible outputs
- move to SQLite only when query cost and consistency pain are clearly dominant

## Exit Conditions

### Good enough for current phase

- retrieval eval stays green after changes
- chapter generation keeps producing stable artifacts
- debugging a missed fact is possible from sidecars

### Start database phase only when

- file rebuild/query cost becomes a real blocker
- sidecar consistency becomes hard to maintain
- command latency becomes unacceptable
