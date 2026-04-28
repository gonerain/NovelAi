# UI Roadmap

## Decision

Build a thin internal control panel, not a full product UI.

The UI exists to reduce operating friction while the core system is still evolving.

## What UI Is For

- switch project
- browse project resources
- edit JSON / Markdown safely
- edit key character fields
- inspect generated chapter artifacts
- trigger common operational actions

## What UI Is Not For

- rich authoring environment
- full story graph editor
- workflow engine
- final-user polished product

## Current Problems

- default project boot path was brittle
- resource browsing works, but inspection depth is shallow
- role-driven artifacts are not surfaced
- operational commands still require terminal use

## Priority

### Phase 1: Stable Control Panel

Status: active

Must have:

- project load works with real default project
- resource list is reliable
- JSON/Markdown editing works
- character editing covers active production fields

Done:

- default project mismatch fixed
- `decisionProfile` fields exposed in character editor

Exit condition:

- one person can load a project, inspect content, edit character state, and save without terminal help

### Phase 2: Artifact Inspection

Status: next

Must have:

- inspect `result.json`
- inspect `decision_log.json`
- inspect `relationship_shift.json`
- inspect `consequence_edges.json`
- inspect retrieval debug sidecars

Exit condition:

- debug of a bad chapter no longer requires manual file hunting

### Phase 3: Operational Actions

Status: later

Must have:

- approve detail outline
- trigger chapter rewrite-draft
- trigger apply draft rewrite
- trigger invalidate / regenerate flows

Exit condition:

- common maintenance flows are accessible without shell memorization

## Feature Freeze

Do not build now:

- drag-and-drop story maps
- WYSIWYG rich text
- multi-user editing
- plugin systems
- dashboards for vanity metrics

## Build Rule

Every UI addition must satisfy one of:

- removes a repeated manual debugging step
- removes a high-friction edit path
- exposes an artifact that already exists in the backend

If it invents a new workflow, it probably should not be UI work yet.
