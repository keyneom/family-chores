# Smoke Test Runbook

This runbook defines repeatable smoke execution for the full Family Chores app.

Use with:

- `notes/smoke-control-inventory.md`
- `.cursor/rules/ux-design-guidelines.mdc`

## 1) Required Test Discipline

- Canonical app URL is **exactly** `http://localhost:3000/family-chores`.
- Treat navigation to `http://localhost:3000/` (or any non-`/family-chores` path) as a setup failure for smoke execution.
- Before running any scenario, verify the browser URL is `.../family-chores`.
- Reset state before each scenario group:
  - run `localStorage.clear()`
  - reload `http://localhost:3000/family-chores`
- For every click/type/submit/navigation change:
  - capture `browser_snapshot`
  - capture screenshot
  - inspect console messages
- If any checklist item fails:
  - stop immediately
  - log the issue
  - restart from reset

## 2) Per-Step Checklist

Each action must pass all checks below:

- only one actionable modal/overlay present
- required CTA is visible and not obscured
- required inputs are visible and keyboard reachable
- no unexpected overflow/cut-off content
- feedback (toast/error/success) appears in context and does not block next action
- focus order and keyboard behavior remain valid
- no console/runtime errors introduced by the step
- current URL remains under `http://localhost:3000/family-chores`

## 3) Smoke Data Profiles

Use two deterministic profiles:

- `profile-empty`
  - no children, no tasks, no approvers
  - onboarding pending
- `profile-populated`
  - at least three children
  - at least three recurring tasks
  - at least one one-off task
  - at least one timed task
  - one approver configured
  - at least two round-robin tasks with explicit, non-default rotation order
  - at least one linked-rotation task with non-zero offset

## 3.1) Core Rotation Coverage Requirement

Rotation/assignment is a core feature and must be tested extensively, not sampled.

Minimum required rotation validation in every comprehensive run:

- Create at least 3 children and at least 3 recurring tasks.
- Configure at least 2 tasks in `round-robin` mode.
- Use explicit rotation order (not default insertion order) for at least one task.
- Validate assignment correctness for at least 7 consecutive days.
- Validate after reordering rotation order that projected day-to-child assignments update correctly.
- Validate linked rotation with offset (`+1` or `-1`) for at least 5 consecutive days.
- Validate drag-drop decision branches for rotating tasks:
  - move just instance
  - redo all future rotations
- Treat any day mismatch between expected and actual assigned child as `high` severity.

## 4) Execution Phases and Gates

## Phase 0: Control Inventory Gate

- Objective: verify every actionable control in inventory is mapped to one happy and one error/guard path.
- Pass criteria:
  - no missing controls
  - every control has permutation tags

## Phase 1: Core Path Gate

- Objective: run highest-risk controls and workflows:
  - onboarding
  - child/task CRUD
  - completion + approval + PIN
  - timed start/stop/approve
  - assignment/rotation basics
- Pass criteria:
  - all automated phase tests green
  - no blocking runtime overlays/crashes during manual path

## Phase 2: Expanded Feature Gate

- Objective:
  - settings permutations
  - sync import/export success/failure
  - wallet payment precondition/error paths
  - action log/export
- Pass criteria:
  - all controls in these areas executed with evidence
  - all deviations documented with reproducible steps

## Phase 3: Cross-Permutation Gate

- Objective: run near-exhaustive combination sweeps:
  - approval on/off with task completion and edit/delete
  - timed + auto-approve on/off + forgive/approve branches
  - one-off + edit/delete scope behavior
  - sync restore + subsequent task interactions
- Pass criteria:
  - agreed matrix completed
  - residual untested combos explicitly listed and justified

## 5) Repeatable Scenario Format

Use this exact format for every scenario:

- Scenario ID: `SCN-<area>-<number>`
- Controls under test:
- Preconditions:
- Steps:
  - `Step N`: user action
  - expected UI state
  - expected state mutation
- Error/guard branch:
  - trigger condition
  - expected block/error behavior
- Evidence:
  - snapshot ID
  - screenshot file
  - console check result
- Result: pass/fail
- Notes:

## 6) Scenario Packs

Run packs in order. Restart from reset if any step fails.

### Pack A: Onboarding + Global Actions

- `SCN-onboarding-01`: onboarding autostart on fresh state.
- `SCN-onboarding-02`: complete tour from welcome to finish.
- `SCN-global-01`: open/close Settings, Sync, Add Child, Add Chore.
- `SCN-global-02`: wallet connect rejection path and no-crash verification.

### Pack B: Child Lifecycle

- `SCN-child-01`: add child from floating action.
- `SCN-child-02`: edit child fields and save.
- `SCN-child-03`: delete child via edit modal confirmation.
- `SCN-child-04`: pay cash zero-balance guard.
- `SCN-child-05`: pay cash positive-balance success.

### Pack C: Task Lifecycle

- `SCN-task-01`: create recurring task (single-child mode).
- `SCN-task-02`: create one-off task with due date/time.
- `SCN-task-03`: create timed task with timer settings.
- `SCN-task-04`: edit scope `instance`.
- `SCN-task-05`: edit scope `future`.
- `SCN-task-06`: edit scope `template`.
- `SCN-task-07`: delete scope `instance`.
- `SCN-task-08`: delete scope `future`.
- `SCN-task-09`: delete scope `template`.

### Pack D: Assignment + Rotation

- `SCN-assign-01`: switch rotation mode from single to round-robin.
- `SCN-assign-02`: reorder round-robin children.
- `SCN-assign-03`: simultaneous mode with multi-child assignment.
- `SCN-assign-04`: drag/drop non-rotating task between children.
- `SCN-assign-05`: drag/drop rotating task with both confirmation options.
- `SCN-assign-06`: 7-day rotation matrix verification (task A and task B) against expected child/day table.
- `SCN-assign-07`: linked rotation offset verification (minimum 5-day window, non-zero offset).
- `SCN-assign-08`: reorder rotation then re-verify 7-day matrix reflects new order.

### Pack E: Completion + Approval + Timers

- `SCN-complete-01`: non-timed completion without approvals.
- `SCN-complete-02`: completion blocked when approvals enabled and no approver.
- `SCN-complete-03`: completion with PIN success path.
- `SCN-timer-01`: timed start/stop pending approval.
- `SCN-timer-02`: approve timed completion with money.
- `SCN-timer-03`: forgive timed completion without money.
- `SCN-timer-04`: auto-approve on stop behavior.

### Pack F: Settings + Sync + Wallet + Logs

- `SCN-settings-01`: save approval toggles.
- `SCN-settings-02`: add approver validation errors.
- `SCN-settings-03`: add/remove approver success.
- `SCN-settings-04`: reset all data confirmation.
- `SCN-settings-05`: restart tutorial flow.
- `SCN-sync-01`: generate export QR/text success.
- `SCN-sync-02`: import empty payload error path.
- `SCN-sync-03`: import malformed payload error path (no crash expected).
- `SCN-sync-04`: import valid payload success.
- `SCN-wallet-01`: wallet payment blocked when disconnected.
- `SCN-wallet-02`: wallet payment blocked when child address missing.
- `SCN-log-01`: action log opens and exports JSON/CSV.

## 7) Defect Logging Standard

For each failure, log:

- scenario ID
- control name
- permutation tag
- reproduction steps
- expected behavior
- actual behavior
- severity (`blocker`, `high`, `medium`, `low`)
- whether it blocks current phase gate

## 8) Exit Report Template

- Phase executed:
- Scenarios run:
- Pass count:
- Fail count:
- Blockers:
- Non-blocking defects:
- Not executed:
- Automation gaps:
- Recommendation:
  - proceed to next gate
  - fix and rerun current gate
