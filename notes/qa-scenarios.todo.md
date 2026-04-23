# QA scenarios + findings (browser smoke)
Date: 2026-01-28

## Scenarios (planned + executed)
- Child CRUD: add, edit, delete.
- Task/Chore CRUD: create recurring, edit rotation order, delete/cancel.
- Rotation scheduling: rotate across children, reorder rotation order, verify projected + today lists.
- One-off task creation: set due date/time.
- Link rotation with another task: verify available list/options.
- Console/a11y: check for errors/warnings after flows.

## Findings / failures / weirdness
### Child CRUD
- Add child (Ava + Ben): OK.
- Edit child (rename Noah -> Noah P): OK.
- Delete child from Edit modal: **two modals open at once** (Edit Child stays open behind Delete Child). Violates single-focus modal rule; needs closing/hiding parent modal when opening confirm.

### Create task (recurring) + rotation
- Attempted to switch Rotation Mode via click: clicking option `Rotate across children` in dropdown **timed out** (not interactive). Keyboard ArrowDown + Enter worked but **also submitted the form**, creating the task without explicitly clicking Create. Likely Enter propagates to submit. Suggest: prevent default form submit when focus is in select dropdown or only submit on Create click.
- Task was created as “Rotate Trash” after the Enter keystroke even though Create wasn’t clicked. Risk: accidental task creation while navigating fields.

### Edit task (recurring) + rotation order
- Edit flow (Edit all future occurrences) works.
- **Duplicate field**: “Link rotation with another task” appears twice in Edit Task modal.
- Link rotation dropdown shows **only “None (independent rotation)”**; no other tasks available to link. If linking is expected, list is empty or filter too strict.
- Rotation order controls (Move down) do reorder (Ben becomes 1, Ava becomes 2). After Save, Today list shows Rotate Trash under Ben, suggesting rotation order change applied.
- **No visible offset control** for linked rotations or per-task offset. If offsets are a requirement, UI appears missing or hidden.

### One-off task creation (Ben)
- Opened Create Task (One-off) from Ben section; selection defaults to One-off and Ben checked.
- **Bug:** Typing into Date field caused Title to become `Homework2026-01-29` and Date value unexpectedly changed to `2026-12-01`. This suggests focus/typing bleed or input parsing issue on date fields.
- Cancelled to avoid creating corrupted task.

### Console / a11y
- Console messages during session:
  - “Password field is not contained in a form” (PIN inputs).
  - “A form field element should have an id or name attribute (count: 120)”.
  - “No label associated with a form field (count: 2)”.

## Notes on rotation schedule visibility
- After creation and reorder, Rotate Trash entries appear in both Ava and Ben scheduled lists. Need to verify these align with rotation order (Ben: 1/28, 1/30, 2/1, 2/3; Ava: 1/29, 1/31, 2/2 in one earlier snapshot) and ensure there are no duplicates across children when using rotation vs assign-to-all.

## Recommendations (logic/UX)
- Prevent form submit on Enter when focus is on select/combobox; make explicit Create click required.
- Ensure dropdown options are clickable (focus/ARIA issues?).
- Remove duplicate “Link rotation with another task” field.
- Provide explicit rotation offset control (if requirement exists) and show its effect in preview list.
- Fix date input handling so typing doesn’t mutate Title; validate date parsing.
- Only one modal at a time: hide/close Edit modal before opening Delete confirmation.
- Add name/id on inputs + label associations to clear a11y warnings; wrap PIN inputs in form or suppress validation appropriately.

## Next scenarios to run
- [meta] Test harness guard: fail fast if browser starts on any URL other than `http://localhost:3000/family-chores`; do not execute smoke steps on root or alternate paths.
- Delete task (single occurrence vs future vs template) and verify projections update.
- One-off task with past date: ensure not shown in Today/Scheduled.
- Recurring task with end date “After N occurrences” and “On date” (ensure projection count capped).
- Cron expression mode: generate cron -> verify preview and projection match.
- Timed task: start/stop, pending approval, approve/deny, timer resumes, off-by-one dates.
- Linked rotation tasks with offset (once link list works): verify Today + projection + action log.
- [settings] Reset All Data confirm: clicking modal "Reset All Data" clears children/tasks (main shows "No children configured"), but Settings modal remains open with stale approver form state (Handle "Mom1111", PIN mismatch). Consider closing settings and clearing form state after reset to avoid confusing post-reset state.
- [settings] Reset All Data confirmation modal stacks on top of Settings (multi-modal). Needs single-focus handling.
- [onboarding] After Reset All Data, Welcome tour auto-opens while Settings modal still open (multi-overlay). This violates single-focus; per checklist should stop and restart tutorial, but noting issue since no fix here.
- [children] Delete from Edit Child opens "Delete Child" confirmation on top of Edit Child modal (stacked modals). Single-focus violation.
- [approval] Completing tasks works even though Settings require parent approval for completing tasks and there are no approvers. Expected a PIN prompt or block; task completed and stars increased.
- [tasks/edit] "Edit just this occurrence" flow: changed title to "Test Task Updated" but UI still showed "Test Task"; change did not apply to the selected instance.
- [tasks/edit] "Edit all future occurrences" updates past/completed occurrences too (today’s completed instance renamed), contradicting the option text.
- [tasks/edit] Money/Star reward spinbuttons show `valuemax=0` in a11y; manual entry accepted `0.5`. Bounds likely wrong/inconsistent.
- [tasks/edit] "Edit task template entirely" updated future scheduled money reward but not completed instance; behavior inconsistent with description (should affect past + future).
- [tasks/delete] "Delete just this occurrence" did not remove the selected scheduled instance (1/29 still listed after delete).
- [tasks/delete] "Delete all future occurrences" removed scheduled list as expected.
- [tasks/one-off] Editing a one-off and saving moved it out of Today into “Upcoming Tasks” and also created a scheduled instance on 1/29 12:00 AM. One-off tasks shouldn’t generate recurring/scheduled instances.
- [wallet] Top-level "Connect Wallet" shows "Connector not found" and triggers Next.js runtime error overlay, which blocks the UI (Settings can’t be opened while overlay is present).
- [sync] Scan QR Code toggles to "Stop" and shows camera prompt text; Manual Entry shows textarea and Import Data button. No validation tested yet.
- [logs] Export JSON/CSV buttons clicked; no visible confirmation/toast of download success.
- [children] Deleting child from Settings list removes immediately with no confirmation (Ava removed). Consider confirmation/undo per guidelines.
- [tasks/rotation] Rotation Mode combobox options not selectable in Create Task modal (clicking "Rotate across children" times out; keyboard ArrowDown/Enter doesn't change selection). Rotation not testable.
- [timers] Timed task creation works; enabling "This is a timed task" reveals Allowed Minutes, Late Penalty, Auto-approve on Stop. Start toggles to Stop but no visible countdown/time remaining.
- [timers] Stopping a timed task marks the instance as completed and moves it to "Pending approval" state (Approve/Forgive). Approve/Forgive require PIN even though no approver exists.
- [todo] Not yet exercised: advanced cron toggle + Generate cron expression; Frequency/Interval combinations; Rotation "Assign to all selected children"; Require PIN on task creation; timed task auto-approve on stop checkbox; manual sync Import Data flow with valid payload.
### Create task (one-off) input bleed + require PIN
- Reproduced input bleed: setting Date via fill (`2026-01-30`) appended to Title (`OneOff Ava2026-01-30`).
- After toggling Require PIN, Date reverted to `2026-01-28` without user change.
- Creating one-off with Require PIN **did not prompt for PIN**; task created immediately.
- Created task shows on Today list with date/time `1/28, 5:00 PM` (not the entered `1/30`).

### Create task (cron) creation no-op
- Clicked Create on advanced cron task (Title: “Weekly Task”, cron `0 17 */1 * *`); modal closed but no task appears in Today or Scheduled.

### Require PIN enforcement
- Task created with “Require PIN” checked but **completion did not prompt for PIN**; completing Ava task immediately increased stars (Ava 0 -> 1). Appears Require PIN is not enforced on completion.

### Timed task auto-approve on stop
- Enabled “Auto-approve on Stop” in Edit Task for Timed Task, saved.
- Started scheduled instance (1/29) and stopped; result: new “Pending approval” instance dated `1/28` appears in Scheduled. Auto-approve did **not** apply; still requires Approve/Forgive. Also date changed to 1/28 while scheduled item was 1/29.
- Timer UI shows countdown only after Start (a small circle with remaining time); no visible timer UI in Today list for pending approval item.

### Sync modal import error handling
- Import Data with empty input shows toast: “Please paste configuration data.”
- Import Data with invalid JSON (`not json`) triggers toast: “Error importing configuration. Please check the data format.” but **also throws a Next.js runtime overlay** (JSON.parse error) and blocks UI until dismissed. Error handling not preventing crash (components/modals/SyncModal.tsx JSON.parse at ~line 125).

### Sync modal QR generation
- “Generate Config Data” renders a QR code successfully.
- Sync modal still shows prior error toast message (“Error importing configuration…”) and retains previous textarea content when reopened; state not cleared on close/reopen.

### Dev error overlay persistence
- After invalid import JSON, Next.js issues badge appears at bottom-left (“1 Issue”) and persists in UI until cleared; could confuse users in dev/testing.

### Payments
- Ben “Pay” (cash) opens modal: “Cannot Pay Out — Ben has no money to pay out.” (OK closes modal).
- Ben “Wallet” opens on-chain payment modal with token/network selectors and amount default 0.01.
- “Send Payment” without wallet connection shows inline message: “Please connect your wallet first.” No crash.

### Action log
- Ben “Log” opens action log modal listing recent events with JSON payloads.
- Export JSON/CSV buttons clicked; no visible confirmation/toast that download started/completed.

---

## Comprehensive smoke execution (2026-04-21)

### Canonical path guard
- All smoke execution is now pinned to `http://localhost:3000/family-chores`.
- Any run starting on root (`http://localhost:3000/`) is treated as setup failure.

### Automated smoke results
- `npm run test:smoke`: PASS (3/3 suites, 9/9 tests).
- `npm run test:e2e:smoke`: PASS (4/4 specs).
- Notes:
  - E2E specs were stabilized for deterministic pathing and reduced flake.
  - E2E now covers onboarding visibility, core global controls, sync empty-import guard, and approval settings save path.

### Manual browser smoke (non-automated paths)

#### Passed
- Reset flow (`localStorage.clear` + reload) restores fresh state.
- Settings -> Reset All Data confirmation dialog behavior.
- Edit Child -> Delete confirmation dialog behavior.
- Recurring task edit scope options (`instance` / `future` / `template`) are shown with expected labels.
- Recurring task delete scope options (`instance` / `future` / `template`) are shown with expected labels.
- Sync malformed JSON import shows user-facing error message and keeps modal interactive.
- Wallet pay guard path for zero-balance child shows blocking alert.
- Action log modal opens and export JSON/CSV controls are clickable.

#### Failed
- No blocking failures observed in this focused manual run.

#### Console/runtime observations
- Dev-mode only console noise observed (HMR/hydration warnings).
- No app-crash blocker found in the executed manual paths.

### Additional testing pass (2026-04-21, continued)

#### Automated expansion results
- `npm run test:smoke`: PASS (6/6 suites, 16/16 tests).
  - includes new coverage:
    - approval action matrix (`complete`, `earlyComplete`, `taskMove`, `editTasks`, `deleteTasks`)
    - timed outcomes matrix (on-time, late, approve vs forgive, auto-approve)
    - rotation matrix (7-day explicit order + reorder + linked offset checks)
- `npm test -- tests/taskAssignment.test.ts`: PASS (6/6 tests).
- `npm run test:e2e:smoke`: PASS (4/4 specs).

#### Manual harness caveat
- During deeper browser-tool manual continuation, a harness-level issue was observed where modal content appeared in accessibility snapshots but not visually in screenshots.
- Because this prevented reliable manual confirmation of some modal-heavy branches, critical rotation/approval/timed correctness was continued and validated via deterministic automated coverage above.
- Treat this as a testing-harness risk item (not yet confirmed as app runtime bug) and re-run affected manual scenarios after harness behavior is stable.

