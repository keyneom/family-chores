# Smoke Coverage Map

This map assigns ownership for each smoke path:

- `JEST`: deterministic reducer/logic coverage
- `PW`: Playwright E2E UI coverage
- `MANUAL`: browser-run checklist coverage (required where automation is not reliable/practical)

## Current Automation Assets

- Jest smoke suite:
  - `tests/smoke/reducer.smoke.test.ts`
  - `tests/smoke/approval.smoke.test.ts`
  - `tests/smoke/sync-state.smoke.test.ts`
  - `tests/smoke/rotation-matrix.smoke.test.ts`
- Playwright smoke suite:
  - `e2e/smoke/core.spec.ts`
  - `e2e/smoke/approvals.spec.ts`

## Ownership by Area

## Global + Onboarding

- Header controls (`Settings`, `Sync`, wallet connect button)
  - `PW`: basic open/connect error path
  - `MANUAL`: modal stacking and focus interactions
- Floating actions (`+ Add Child`, `+ Add Chore`)
  - `PW`: open/create happy paths
  - `MANUAL`: cross-modal conflict and keyboard edge behavior
- Tour workflow
  - `PW`: appears on fresh state, skip path
  - `MANUAL`: full multi-step walkthrough with strict snapshot/screenshot cadence

## Child Lifecycle

- Add/edit/delete child
  - `PW`: add happy path
  - `JEST`: child add/delete state mutation
  - `MANUAL`: edit/delete overlay behavior, confirmation/stacking checks
- Child reorder
  - `MANUAL`: drag/drop and settings move up/down controls (visual behavior)
  - `JEST`: indirect via reducer settings updates
- Cash payout
  - `PW`: zero-balance guard path
  - `MANUAL`: positive payout confirmation and post-state checks
- Wallet payout modal open
  - `PW`: modal open and blocked send checks (disconnected/missing address)
  - `MANUAL`: real wallet/network interaction permutations

## Task Lifecycle

- Create/update/delete template
  - `JEST`: add/update/delete template logic
  - `PW`: create task basic UI flow
  - `MANUAL`: full field permutations and visual validation
- Edit/Delete scopes (`instance`/`future`/`template`)
  - `JEST`: disable future/delete semantics covered
  - `MANUAL`: UI scope choice + rendered outcome correctness
- One-off behavior
  - `JEST`: one-off deletion and import normalization
  - `MANUAL`: date/time editing and display regression checks

## Assignment + Rotation + Drag/Drop

- Assignment normalization and rotation strategy
  - `JEST`: assignment strategy normalization + deterministic day-by-day rotation matrix checks
  - `MANUAL`: reorder UI, linked task behavior, drag/drop options
- Drag/drop confirmation choices
  - `MANUAL`: `instance` vs `redo-rotations` behavior and task projections
- Core acceptance criteria for this area:
  - validate >=7-day expected assignment table for >=2 rotating tasks and >=3 children
  - validate linked-offset behavior for >=5 days
  - validate matrix again after rotation reorder

## Completion + Approval + Timers

- Non-timed complete flow
  - `PW`: completion requiring PIN
  - `JEST`: completion reward mutation
  - `MANUAL`: visual pending/completed state integrity
- Timed start/stop/approve/forgive
  - `JEST`: stop timer reward logic and approve/finalize semantics
  - `MANUAL`: UI Start/Stop/Pending/Approve/Forgive rendering and interaction checks
- Approval gating decisions
  - `JEST`: `requiresPin` and `hasApprovers` matrix
  - `PW`: PIN modal happy path on complete
  - `MANUAL`: all gate permutations across edit/move/delete/early complete

## Settings + Voice + Approvers

- Approval toggle persistence
  - `PW`: enable task-complete approval path
  - `JEST`: parent settings merge behavior via reducer tests
  - `MANUAL`: all toggle combinations + save/close UX behavior
- Approver add/remove
  - `PW`: add approver happy path
  - `JEST`: guard decision utilities
  - `MANUAL`: duplicate PIN rejection and remove verification UX
- Voice settings
  - `MANUAL`: slider/toggle persistence and runtime behavior

## Sync + Action Log

- Sync import/export
  - `PW`: empty import error and modal stability
  - `JEST`: `SET_STATE` normalization on imported state
  - `MANUAL`: malformed payload runtime handling, QR scanner, large payload fallback, success import roundtrip
- Action log and exports
  - `MANUAL`: modal review and JSON/CSV export verification
  - `JEST`: actor-handle and action-log mutation covered by reducer tests

## Remaining Manual-Only Buckets (Current)

- Wallet connected-chain payment permutations
- QR camera scanner behavior across permissions/states
- Linked rotation with offsets in UI
- Full onboarding step-by-step visual pass with all checklist points
- Focus order/keyboard traversal and accessibility regression checks
- Modal stacking and z-index conflicts under rapid multi-action flows

## Definition of Done for Coverage

- Every control from `notes/smoke-control-inventory.md` is tagged `JEST`, `PW`, or `MANUAL`.
- Every `MANUAL` item has at least one executed run entry in `notes/qa-scenarios.todo.md`.
- High-risk controls have dual coverage (`JEST` + `PW` or `PW` + `MANUAL`).
- Rotation/day-assignment logic has both deterministic automated matrix tests and manual projection-table verification.
