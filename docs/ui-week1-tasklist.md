# UI Week 1 Tasklist (Executable)

## Goal

Lock the IA and interaction baseline for a modern, user-friendly, concise UI.

## Week 1 Deliverables

- core interaction flows frozen
- consistent loading/success/error feedback pattern online
- non-essential controls identified and frozen out of v1
- quick usability validation completed

## Priority Backlog

### P0 - Must Finish This Week

1. Define and freeze core flow spec.
   - Output: `load -> switch -> edit -> save` and `character edit -> save` and `approve` flow diagrams.
   - Owner file: this doc + `docs/ui-modernization-execution.md`.
2. Unify action feedback pattern across all write/read actions.
   - Output: one interaction model for loading/success/failure messaging.
   - Owner files: `src/ui/app.js`, `src/ui/index.html`, `src/ui/styles.css`.
3. Add operation busy state to avoid repeated clicks and ambiguous behavior.
   - Output: while action running, action buttons disabled and status visible.
   - Owner files: `src/ui/app.js`, `src/ui/styles.css`.
4. Add empty-selection guard rails for save/reload actions.
   - Output: explicit warning when user clicks action without selected resource.
   - Owner file: `src/ui/app.js`.
5. Create v1 freeze list and reject list.
   - Output: fixed “out-of-scope v1” feature list.
   - Owner file: `docs/ui-modernization-execution.md`.

### P1 - Should Finish If Capacity Allows

1. Standardize microcopy for action labels and error hints.
   - Owner files: `src/ui/index.html`, `src/ui/app.js`.
2. Add basic keyboard and accessibility baseline.
   - Output: feedback area uses `aria-live`, key controls have clear focus states.
   - Owner files: `src/ui/index.html`, `src/ui/styles.css`.
3. Add manual QA scripts for core flows.
   - Output: copy-paste validation steps for tester.
   - Owner file: `docs/ui-week1-tasklist.md`.

## Day-by-Day Execution

### Day 1 (Monday)

1. Freeze IA and flow map.
2. Align acceptance criteria for each flow.
3. Confirm out-of-scope list with stakeholders.

### Day 2 (Tuesday)

1. Implement unified feedback state machine in frontend logic.
2. Add busy-state handling and duplicate-click prevention.
3. Add empty-action guards for reload/save.

### Day 3 (Wednesday)

1. Refine labels and feedback wording.
2. Verify panel-level interaction consistency.
3. Update docs to reflect implementation reality.

### Day 4 (Thursday)

1. Run 3-5 lightweight usability sessions.
2. Record confusion points and failure causes.
3. Triage issues into P0/P1/P2.

### Day 5 (Friday)

1. Fix all P0 from usability sessions.
2. Re-run core flow validation.
3. Publish Week 1 close-out summary and Week 2 handoff.

## Test Script (Manual)

1. Enter valid `projectId`, click `加载项目`, verify loading/success feedback.
2. Switch resource from list, verify editor title and content update.
3. Click `保存` with selected resource, verify success feedback.
4. Click `重载` with selected resource, verify content refresh feedback.
5. Trigger save/reload without selected resource, verify warning feedback.
6. Edit character fields and click `保存角色`, verify success feedback.
7. Submit approval and verify status chip updates to approved state.

## Done Criteria (Week 1)

- [ ] all P0 tasks finished
- [ ] feedback model is consistent for load/reload/save/approve actions
- [ ] no ambiguous silent failures during core workflows
- [ ] at least 3 usability sessions completed and logged
- [ ] v1 freeze list documented and agreed

## Week 1 Status Snapshot

- Backend/API split done: `src/ui.ts` now serves static assets and APIs.
- Frontend split done: `src/ui/index.html`, `src/ui/styles.css`, `src/ui/app.js`.
- Interaction feedback/busy-state baseline implemented in `app.js`.
