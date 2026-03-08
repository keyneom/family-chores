# Business Logic Review Notes (OOM / Infinite Data Safety)

Date: 2026-01-28
Reviewer: Codex

Goal
- Systematically review all business-logic features described in README and core files.
- Focus on correctness, stability, and OOM/infinite‑data safety.
- Notes only (no code changes) while parallel design work proceeds.

---

## Scope Checklist (README Features)
1) Automatic task rotation and assignment
2) Reward tracking (stars + money)
3) Timed tasks (start/stop, late penalty, approvals)
4) Parent approvals (pins + gating)
5) Local persistence (localStorage)
6) Optional on‑chain payments
7) Onboarding / first‑run guidance
8) Sync / import/export
9) Unified Task migration + legacy compatibility
10) Action log
11) Voice announcements

---

# Detailed Review By Feature (with explicit recommendations)

## 1) Automatic Task Rotation & Assignment
Files: `utils/projectionUtils.ts`, `utils/taskAssignment.ts`, `utils/choreScheduling.ts`, `components/ChildColumn.tsx`, `components/ChildrenGrid.tsx`

Current behavior
- Projection model: recurring tasks are NOT pre‑generated. ChildColumn projects today + 7 upcoming days per child.
- `getTheoreticalAssignment` is pure. Handles linked rotations with a max recursion depth (MAX_LINK_DEPTH = 10).
- For rotation, uses `rotation.startDate` and day‑diff for daily frequency. For non‑daily, uses a simplified approximation (also day‑diff).

Correctness gaps
- For weekly/monthly/custom schedules, round‑robin rotation index uses day‑diff approximation rather than true occurrence counting; rotation can drift over long spans.
- Rotation history (`assignment.history` or `rotation.lastAssigned*`) is stored but not used in projection.
- `assignment.allowMultiplePerDay` is defined but not enforced in projection.

OOM / performance risks
- ChildColumn does repeated `Array.find` on `state.taskInstances` inside nested loops (tasks × days × children). As instances grow, this becomes costly.

Recommendations (explicit)
- Add in‑memory indexed maps for instance lookup (Map of `templateId+date` and `templateId+date+childId`) and use those instead of repeated `.find`.
- Centralize projection window constants (e.g., TODAY + 7 days). Enforce max window in all projection code paths.
- For round‑robin on non‑daily schedules: implement bounded occurrence counting (only within the projection window) or document the approximation clearly in UI/docs.
- Consider using assignment history to align rotation across long ranges if required by product logic.

---

## 2) Task Instances (Realized) & One‑Off Tasks
Files: `components/TaskItem.tsx`, `components/ChildColumn.tsx`, `components/modals/TaskModal.tsx`, `components/modals/OneOffTaskModal.tsx`, `utils/taskInstanceGeneration.ts`

Current behavior
- Instances are realized on interaction (complete/move/early complete). One‑off tasks created via TaskModal create instances immediately for assigned children.
- `ADD_TASK_INSTANCE` dedupes by `id` and by `templateId+childId+date`.
- OneOffTaskModal (legacy) creates instances with `childId || 0` and uses `assignedTo` for “any child”.

Correctness gaps
- OneOffTaskModal (legacy) can create instances with `childId=0` (invalid) when no child is selected.
- There are two flows for one‑off creation (TaskModal and OneOffTaskModal), risking inconsistent data.

OOM / performance risks
- `taskInstances` grows without bound and is persisted.

Recommendations (explicit)
- Remove or disable OneOffTaskModal, or route it to TaskModal so there is a single authoritative creation flow.
- Add retention policy for instances (e.g., keep last 90/180/365 days, or cap per‑task instances). Keep completed timed instances as needed.
- Centralize instance creation in a helper to standardize IDs and child assignment.

---

## 3) Timed Tasks (Start/Stop, Late Penalties)
Files: `components/ChoresAppContext.tsx`, `components/hooks/useTimer.tsx`, `components/TaskItem.tsx`, `components/TimedCountdown.tsx`, `utils/taskKey.ts`

Current behavior
- `START_TIMER` removes prior timers for same taskKey+childId.
- `STOP_TIMER` computes elapsed, reward, and creates `TimedCompletion`. Updates instance if found, otherwise realizes one.
- TaskKey parsing centralized with `parseTaskKey` (supports legacy `childId:choreId`).

Correctness gaps
- `allowNegative` exists in TimedSettings but is not enforced when calculating money reward.
- TaskKey creation is distributed (TaskItem + ChildColumn) instead of a single helper.

OOM / performance risks
- `timedCompletions` is unbounded and scanned linearly to find pending approvals.

Recommendations (explicit)
- Enforce `allowNegative`: if false, clamp money reward to >= 0 on late completions.
- Add retention policy for timed completions (e.g., last N or by date range).
- Create a helper to generate taskKey consistently and use it everywhere.
- Add a fast lookup map for pending completions (by taskKey+childId) to avoid repeated scans.

---

## 4) Reward Tracking (Stars + Money)
Files: `components/ChoresAppContext.tsx`, `components/TaskItem.tsx`

Current behavior
- Stars and money applied directly to child records on completion/approval.
- PAY_CHILD resets money to 0.

Correctness gaps
- No ledger; balances are the source of truth. This is OK but must be preserved if history is pruned.

OOM / performance risks
- None directly.

Recommendations (explicit)
- If pruning instances/logs, do NOT recompute balances from history. If balance rebuild is desired, add an explicit “recompute” tool that operates on retained history only.

---

## 5) Parent Approvals / PINs
Files: `components/modals/PinModal.tsx`, `components/modals/SettingsModal.tsx`, `components/TaskItem.tsx`, `components/ChildColumn.tsx`, `utils/pinUtils.ts`

Current behavior
- PINs stored hashed with salt. Approvals required based on settings.
- PinModal validates against all approvers and returns handle.

Correctness gaps
- Generally consistent. Some flows use alerts if no approvers exist; ok.

OOM / performance risks
- None.

Recommendations (explicit)
- Ensure all approval‑gated actions log actorHandle and are subject to log retention to avoid unbounded growth.

---

## 6) Local Persistence
Files: `components/ChoresAppContext.tsx`

Current behavior
- Entire state persisted to `localStorage` on each state change via `JSON.stringify`.
- On load, merges legacy data into unified `tasks`, dedupes instances.

Correctness gaps
- `SET_STATE` overwrites entire state and only normalizes tasks; other fields may bypass dedupe or defaults.

OOM / performance risks
- Large state writes can exceed localStorage limits and block UI.

Recommendations (explicit)
- Wrap `localStorage.setItem` in try/catch; on failure, prune large arrays and retry.
- Add a size estimator to warn users when state grows beyond safe thresholds.
- Consider persisting only essential slices (tasks/children/settings) and store history separately.

---

## 7) Sync / Import / Export
Files: `components/modals/SyncModal.tsx`

Current behavior
- Exports full state (minus actionLog) compressed via pako.
- Imports full state and sets via `SET_STATE`.

Correctness gaps
- Minimal validation; no pruning or schema checks.

OOM / performance risks
- Large exports may exceed QR capacity; compression is memory‑intensive.
- Imports can immediately inflate arrays and break performance.

Recommendations (explicit)
- Provide “Essential Export” vs “Full Export”. Default to essential.
- Validate and prune on import (cap instances/completions/logs).
- Add explicit warning for large payload sizes before generating QR.

---

## 8) Onboarding / First‑Run Guidance (Explicit Context)
Files: `components/Onboarding/TourGuide.tsx`, `components/Onboarding/OnboardingWizard.tsx`, `components/Layout.tsx`

Current behavior
- TourGuide is the active onboarding flow used in Layout.
- OnboardingWizard is a separate implementation that is NOT referenced anywhere in Layout or pages.

Why this matters
- Two separate onboarding implementations exist. One (TourGuide) is active; the other (OnboardingWizard) is unused/dead code.
- OnboardingWizard’s `handleComplete` does not set `parentSettings.onboardingCompleted` and uses `SET_STATE` with a captured state snapshot, which is risky if it were ever wired back in.

Recommendations (explicit)
- Choose ONE onboarding flow and delete or fully wire the other.
- If keeping OnboardingWizard, fix `handleComplete` to set `onboardingCompleted: true` via UPDATE_PARENT_SETTINGS and avoid full `SET_STATE` with stale state.
- Document which onboarding flow is canonical and remove dead code to avoid reintroduction bugs.

---

## 9) Unified Task Migration + Legacy Compatibility
Files: `types/task.ts`, `components/ChoresAppContext.tsx`, `components/TaskItem.tsx`, `components/ChildColumn.tsx`, `utils/choreScheduling.ts`

Current behavior
- Unified Task type in place, but legacy fields still appear (emoji, color, recurring).
- Some legacy paths still exist (e.g., OneOffTaskModal, chore scheduling helpers).

Correctness gaps
- Multiple representations can lead to normalization drift.

Recommendations (explicit)
- Complete migration: remove legacy paths or gate them behind explicit migration steps.
- Ensure all task creation and editing uses unified Task schema.

---

## 10) Action Log
Files: `components/ChoresAppContext.tsx`, `components/modals/ActionLogModal.tsx`

Current behavior
- Appends log entries for most actions. Modal shows last 50 and exports last 100.

OOM / performance risks
- Unbounded log growth (persisted).

Recommendations (explicit)
- Cap log size (e.g., last 500–1000). Provide export of full history before pruning if needed.

---

## 11) Voice Announcements
Files: `components/hooks/useScheduledTaskAnnouncements.tsx`, `components/hooks/useTimerAnnouncements.tsx`, `components/hooks/useTextToSpeech.tsx`

Current behavior
- Timed announcements every 1s; scheduled announcements every 30s.
- Uses Set to avoid repeated announcements per instance.

OOM / performance risks
- Minimal; but depends on size of scheduled tasks list.

Recommendations (explicit)
- Ensure scheduled tasks list remains bounded to projection window (current implementation does this via ChildColumn).

---

## 12) Optional On‑Chain Payments
Files: `components/modals/WalletPayModal.tsx`, `components/Header.tsx`

Current behavior
- Wallet connect and token transfer handled client‑side.

OOM / performance risks
- None.

Recommendations (explicit)
- No changes required for OOM. Consider error handling for large status strings or repeated connection attempts.

---

# Cross‑Cutting OOM / Infinite Data Risks

Primary
1) Unbounded arrays in state: `taskInstances`, `timedCompletions`, `actionLog`.
2) Hot‑path scans over large arrays (ChildColumn repeated `.find`).
3) Full‑state localStorage writes on every change.
4) Sync export/import without size limits or pruning.

Secondary
- Dead code (OnboardingWizard) and legacy flows (OneOffTaskModal) can create invalid data (childId=0) that further bloats state.

---

# Recommended Changes (When Code Changes Resume)

Priority 0 (OOM safety)
- Retention policies for instances, timedCompletions, actionLog.
- Guarded persistence with pruning on storage failure.

Priority 1 (Performance)
- Index maps for instance/pending completion lookup; reduce linear scans.
- Centralize projection window constants.

Priority 2 (Correctness & Cleanup)
- Remove or fix OnboardingWizard; choose a single onboarding flow.
- Remove/disable OneOffTaskModal; ensure TaskModal is authoritative.
- Centralize taskKey generation and instance creation helpers.

Open Questions
- Retention window: 90/180/365 days or configurable?
- Is full audit history required? If yes, add explicit “Export & Purge”.
- Sync/export default: essential vs full history?

