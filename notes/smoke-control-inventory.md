# Smoke Control Inventory

This inventory maps every actionable UI control to required happy/error coverage and major state permutations.

## Global Preconditions

- App URL: `http://localhost:3000/family-chores` (canonical and required)
- Never run smoke flows from root (`http://localhost:3000/`) or any non-`/family-chores` path.
- Reset before each scenario group:
  - `localStorage.clear()`
  - hard reload app
- Evidence per step:
  - `browser_snapshot`
  - screenshot
  - console message check
- Stop on first checklist failure, log it, then restart from reset.

## Permutation Tags

- `S-empty`: no children/tasks/approvers.
- `S-populated`: at least 2 children, recurring+one-off+timed tasks.
- `S-approval-off`: all approval toggles disabled.
- `S-approval-on`: approvals enabled with at least one approver.
- `S-no-approver`: approval enabled but approver list empty.
- `S-wallet-disconnected`: no wallet connection.
- `S-wallet-connected`: wallet connected.
- `S-sync-valid`: import payload valid.
- `S-sync-invalid`: import payload empty/malformed.
- `S-onboarding-pending`: onboarding not completed.
- `S-onboarding-complete`: onboarding completed.
- `S-rotation-matrix`: multi-day rotation validation (>=7 days, >=2 rotating tasks, >=3 children).
- `S-rotation-reordered`: same matrix after changing rotation order.
- `S-linked-offset`: linked rotation with non-zero offset validation window.

## Header + Global Controls

- `settingsBtn` (`Header.tsx`)
  - Happy: opens Settings modal.
  - Error/guard: when runtime overlay exists, verify modal can still open or defect logged.
  - Tags: `S-empty`, `S-populated`.
- `syncBtn` (`Header.tsx`)
  - Happy: opens Sync modal.
  - Error/guard: open/close repeatedly, error banner state should not leak unexpectedly.
  - Tags: `S-empty`, `S-populated`.
- `Connect Wallet` / wallet disconnect button (`Header.tsx`)
  - Happy: connect succeeds and short address renders; disconnect returns to connect button.
  - Error/guard: connector unavailable/user rejects; verify inline error and no crash.
  - Tags: `S-wallet-disconnected`, `S-wallet-connected`.
- `+ Add Child` floating action (`Layout.tsx`)
  - Happy: opens Add Child modal.
  - Error/guard: while another modal is open, second modal should not stack (or defect logged).
  - Tags: `S-empty`, `S-populated`.
- `+ Add Chore` floating action (`Layout.tsx`)
  - Happy: opens Task modal in create mode.
  - Error/guard: invalid cron disables submit; Enter key in select must not submit unexpectedly.
  - Tags: `S-empty`, `S-populated`.

## Onboarding Controls

- Tour start trigger (`Layout.tsx` + `TourGuide.tsx`)
  - Happy: when no approvers and onboarding incomplete, welcome step appears.
  - Error/guard: with onboarding complete, no tour auto-open.
  - Tags: `S-onboarding-pending`, `S-onboarding-complete`.
- Tour next/back/finish/skip CTAs (`TourGuide.tsx`)
  - Happy: full flow completes and sets completion flag.
  - Error/guard: skip path should stop tour and prevent immediate re-open.
  - Tags: `S-onboarding-pending`.

## Children Grid + Child Header Controls

- Column drag start/drop (`ChildrenGrid.tsx`)
  - Happy: reorder child columns and persist order.
  - Error/guard: dragging task card must not trigger column reorder path.
  - Tags: `S-populated`.
- Child `Edit` button (`ChildColumn.tsx`)
  - Happy: opens Edit Child modal for selected child.
  - Error/guard: with edit approval on + no approver, alert appears.
  - Tags: `S-populated`, `S-approval-on`, `S-no-approver`.
- Child `Pay` button (`ChildColumn.tsx`)
  - Happy: positive balance opens confirm and payout zeroes money.
  - Error/guard: zero balance shows Cannot Pay Out alert.
  - Tags: `S-populated`.
- Child `Wallet` button (`ChildColumn.tsx`)
  - Happy: opens WalletPay modal.
  - Error/guard: missing child address blocks send with inline message.
  - Tags: `S-populated`, `S-wallet-disconnected`, `S-wallet-connected`.
- Child `Log` button (`ChildColumn.tsx`)
  - Happy: opens Action Log modal filtered to child.
  - Error/guard: no entries state renders safely.
  - Tags: `S-populated`.
- `+ Task` in Today's Tasks section (`ChildColumn.tsx`)
  - Happy: opens Task modal preselecting child.
  - Error/guard: open while another overlay exists should not create stacked-action confusion.
  - Tags: `S-populated`.
- `Show completed` / `Hide completed` (`ChildColumn.tsx`)
  - Happy: toggles completed list visibility.
  - Error/guard: count matches number of completed tasks.
  - Tags: `S-populated`.
- `See more` / `Show less` scheduled (`ChildColumn.tsx`)
  - Happy: expands and collapses scheduled list.
  - Error/guard: no duplicate cards after toggling.
  - Tags: `S-populated`.

## Task Card Controls

- Drag task card (`TaskItem.tsx`)
  - Happy: dropping on other child moves instance.
  - Error/guard: same-child drop no-op.
  - Tags: `S-populated`.
- `Complete` for non-timed tasks
  - Happy: marks complete, rewards applied.
  - Error/guard: with approval required + no approver, alert displayed and no completion.
  - Tags: `S-approval-off`, `S-approval-on`, `S-no-approver`.
- Timed `Start` / `Stop`
  - Happy: start creates timer, stop creates pending/approved completion depending settings.
  - Error/guard: stopping missing timer should no-op without crash.
  - Tags: `S-populated`.
- Pending timed `Approve` / `Forgive`
  - Happy: approve applies stars/money; forgive applies stars without money.
  - Error/guard: invalid PIN rejects and keeps pending state.
  - Tags: `S-approval-on`.
- Task `Edit` button
  - Happy: opens edit-scope modal then Task modal.
  - Error/guard: select scope semantics must match outcome (`instance`, `future`, `template`).
  - Tags: `S-populated`.
- Task `Delete` button
  - Happy: opens delete-scope modal and applies selected behavior.
  - Error/guard: approval required + no approver blocks with alert.
  - Tags: `S-populated`, `S-approval-on`, `S-no-approver`.

## Shared Approval/Prompt Controls

- `PinModal` submit/cancel/close (`PinModal.tsx`)
  - Happy: valid PIN returns actor handle and executes pending action.
  - Error/guard: invalid format, unknown PIN, and no approver all show inline error.
  - Tags: `S-approval-on`, `S-no-approver`.
- `AlertModal` close
  - Happy: dismisses alert and preserves underlying state.
  - Error/guard: ensure alert does not trap focus after close.
  - Tags: all.
- `ConfirmationModal` confirm/cancel/overlay close
  - Happy: confirm triggers action once.
  - Error/guard: cancel/overlay close are non-destructive.
  - Tags: all.

## Task Modal Controls

- Core fields (`Title`, `Emoji`, `Color`, `Type`, `Star Reward`, `Money Reward`, `Require PIN`, `Voice Announcements`)
  - Happy: save persists edits/new task correctly.
  - Error/guard: required title enforced; invalid number handling does not crash.
  - Tags: `S-populated`.
- Assignment mode select (`single-child`, `round-robin`, `simultaneous`)
  - Happy: each mode saves expected assignment strategy.
  - Error/guard: keyboard Enter on select should not submit form unexpectedly.
  - Tags: `S-populated`.
- Round-robin controls:
  - child checkboxes, reorder up/down, linked task select, linked offset input.
  - Happy: saved order/linked behavior reflected in projections across multi-day matrix checks.
  - Error/guard: linked task self-selection prevented.
  - Tags: `S-populated`, `S-rotation-matrix`, `S-linked-offset`, `S-rotation-reordered`.
- Simultaneous controls:
  - `Select all`, `Clear`, per-child checkboxes.
  - Happy: all selected children receive projections.
  - Error/guard: clear leaves no invalid assignment side effects.
  - Tags: `S-populated`.
- Schedule controls:
  - `Use advanced cron expression`, cron input, `Generate cron expression`.
  - rule mode controls (`Frequency`, `Interval`, weekdays, month day, start date, time, end mode, timezone).
  - Happy: preview renders expected upcoming dates.
  - Error/guard: invalid cron disables submit and shows validation message.
  - Tags: `S-populated`.
- One-off controls:
  - `Date`, `Time`.
  - Happy: save creates one-off instance at selected due date/time.
  - Error/guard: date input should not mutate title/other fields.
  - Tags: `S-populated`.
- Timer controls:
  - `This is a timed task`, `Allowed Minutes`, `Late Penalty`, `Auto-approve on Stop`.
  - Happy: timed behavior follows settings.
  - Error/guard: negative/large penalty edge behavior stays deterministic.
  - Tags: `S-populated`.
- Footer:
  - `Create`/`Save`, `Cancel`, close `x`.
  - Happy: submit persists; cancel/close discard unsaved.
  - Error/guard: cron invalid keeps submit disabled.
  - Tags: `S-populated`.

## Settings Modal Controls

- Approval toggles (task move, early complete, task complete, edit tasks/children)
  - Happy: save persists toggles.
  - Error/guard: enabling approvals with no approver blocked with notice.
  - Tags: `S-approval-off`, `S-no-approver`.
- Approver controls:
  - handle input, PIN input, confirm PIN input, `Add Approver`, `Remove`.
  - Happy: add first approver, add second with verification, remove with verification.
  - Error/guard: invalid PIN format, mismatch, duplicate PIN rejected.
  - Tags: `S-approval-on`, `S-no-approver`.
- Voice controls:
  - global enable, volume/rate sliders, timer/scheduled announcement toggles and nested toggles.
  - Happy: save persists values.
  - Error/guard: disabling parent switch should effectively disable nested behavior.
  - Tags: `S-populated`.
- Children section controls:
  - `Edit`, move up/down arrows, `Delete`, add child name/address inputs, `Add Child`.
  - Happy: reorder and add/edit work.
  - Error/guard: delete requires confirmation policy (currently direct delete here; log as risk).
  - Tags: `S-populated`.
- Tasks section controls:
  - `+ New Task`, per-task `Edit`, per-task `Delete`.
  - Happy: open expected modals and complete actions.
  - Error/guard: delete is destructive and should be explicit in runbook.
  - Tags: `S-populated`.
- Footer controls:
  - `Save Settings`, `Restart Tutorial`, `Reset All Data`.
  - Happy: save closes modal and persists; restart tutorial toggles onboarding flag; reset clears state.
  - Error/guard: reset confirmation must be explicit and non-accidental.
  - Tags: `S-populated`, `S-onboarding-pending`, `S-onboarding-complete`.

## Sync Modal Controls

- `Generate Config Data`
  - Happy: QR or fallback text generated.
  - Error/guard: large payload fallback to text works.
  - Tags: `S-sync-valid`.
- `Copy to Clipboard` (text fallback mode)
  - Happy: copies payload.
  - Error/guard: clipboard errors handled without crash.
  - Tags: `S-sync-valid`.
- `Scan QR Code` / `Stop`
  - Happy: scanner starts/stops and scan populates import payload.
  - Error/guard: scanner stop/close cleanup works.
  - Tags: `S-sync-valid`.
- `Manual Entry` toggle and textarea
  - Happy: toggles field visibility and accepts payload.
  - Error/guard: stale error/textarea state after reopen is logged if present.
  - Tags: `S-sync-valid`, `S-sync-invalid`.
- `Import Data`
  - Happy: valid payload imports and success modal appears.
  - Error/guard: empty/malformed payload shows user error and must not crash runtime.
  - Tags: `S-sync-valid`, `S-sync-invalid`.

## Action Log Modal Controls

- `Export JSON (last 100)`
  - Happy: file download initiated.
  - Error/guard: empty log still exports valid structure.
  - Tags: `S-populated`.
- `Export CSV (last 100)`
  - Happy: CSV download initiated.
  - Error/guard: payload escaping remains valid.
  - Tags: `S-populated`.
- `Close` / `x` / overlay close
  - Happy: closes modal reliably.
  - Error/guard: no orphan overlay/focus trap.
  - Tags: all.

## WalletPay Modal Controls

- `Token` select
  - Happy: switch ETH/USDC and label changes.
  - Error/guard: unsupported network + USDC yields clear status.
  - Tags: `S-wallet-disconnected`, `S-wallet-connected`.
- `Amount` input
  - Happy: valid numeric string submits.
  - Error/guard: invalid numeric input handled gracefully.
  - Tags: `S-wallet-connected`.
- `Network` select
  - Happy: switches network successfully.
  - Error/guard: switch failure surfaces status without crash.
  - Tags: `S-wallet-connected`.
- `Connect Wallet`
  - Happy: connects and renders connected address.
  - Error/guard: missing provider or reject request displays status.
  - Tags: `S-wallet-disconnected`.
- `Send Payment`
  - Happy: sends tx and status includes hash.
  - Error/guard: no wallet/no child address/no token config blocks action with status.
  - Tags: `S-wallet-connected`, `S-wallet-disconnected`.
- `Cancel` / close `x`
  - Happy: closes modal without state mutation.
  - Error/guard: reopening resets transient status fields.
  - Tags: all.

## Drag/Scope Modals Controls

- `EditTaskConfirmModal` radios + `Continue` + `Cancel`
  - Happy: selected scope applied in edit flow.
  - Error/guard: one-off defaults to template-only behavior.
  - Tags: `S-populated`.
- `DeleteTaskModal` radios + `Delete` + `Cancel`
  - Happy: selected scope applied in delete flow.
  - Error/guard: one-off defaults to template-only delete.
  - Tags: `S-populated`.
- `DragDropConfirmModal` radios + `Move` + `Cancel`
  - Happy: `instance` vs `redo-rotations` produce expected results.
  - Error/guard: cancel leaves source/target unchanged.
  - Tags: `S-populated`.

## Completion Requirement

- Each control above must have at least:
  - one automated path (Jest or Playwright) where practical
  - one executed manual browser path where not practical
- Rotation-specific minimum:
  - at least 2 round-robin tasks and 3 children
  - explicit expected day-to-child table for >=7 days
  - post-reorder table revalidated
  - linked-offset table validated for >=5 days
- Every failure is logged with:
  - control id/name
  - permutation tag
  - exact reproduction
  - expected vs actual
  - pass/fail gate impact
