# UX Review Notes (Clarity, Redundancy, Guidelines Alignment)

Date: 2026-01-28
Reviewer: Codex

Scope
- UX review against provided guidelines and established references (Nielsen Norman, Apple HIG, Material, WCAG 2.1 AA).
- Notes only; no browser testing performed in this pass.

Important
- Required UX testing steps (localStorage reset, tutorial walkthrough, snapshots, console checks) have NOT been executed. These must be done with browser automation before sign‑off.

---

## Executive Summary
- The app has two overlapping onboarding approaches (TourGuide vs OnboardingWizard). This creates confusion, inconsistent states, and risks repeated setup flows. Choose one.
- Task creation/editing surfaces repeat inputs (TaskModal + Settings “Add Chore” + OneOffTaskModal), which can force users to redefine details or encounter inconsistent defaults.
- PIN‑gated actions are inconsistent in feedback and context. Some flows block without clear next step.
- Action log exists but is buried; author attribution is sometimes absent. Destructive operations are confirmed but lack undo.
- Accessibility gaps: keyboard focus management, error messaging, and color‑only indicators need verification; several inline controls may be hard to reach or interpret.

---

# Feature‑by‑Feature UX Notes + Recommendations

## 1) Onboarding / First‑Run Guidance
Files: `components/Onboarding/TourGuide.tsx`, `components/Onboarding/OnboardingWizard.tsx`, `components/Layout.tsx`

Observations
- Two different onboarding implementations exist. TourGuide is active; OnboardingWizard appears unused.
- Tour flow relies on modal detection via DOM queries; if modals are open/closed manually or via multiple entry points, steps can become misaligned.
- OnboardingWizard has a “create sample task” and wallet connect step; TourGuide focuses on settings and actions. UX is inconsistent.

Guideline alignment
- Single focus & modality: tour overlays + modals risk multiple overlapping layers if not carefully managed.
- Discoverability: duplicate onboarding flows reduce clarity.

Recommendations
- Choose one onboarding flow and delete/disable the other. If TourGuide remains, ensure it can drive the entire first‑run experience without relying on implicit DOM checks.
- Add a “Resume setup” CTA if onboarding is dismissed; avoid re‑triggering the tour if users intentionally skipped.
- Ensure onboarding completion flag is set in a single, consistent location.

---

## 2) Task Creation & Editing
Files: `components/modals/TaskModal.tsx`, `components/modals/OneOffTaskModal.tsx`, `components/modals/SettingsModal.tsx`, `components/TaskItem.tsx`

Observations
- Multiple entry points for creating tasks (Settings modal, “+ Add Chore” fixed button, per‑child “+ Task”).
- OneOffTaskModal still exists; TaskModal handles both recurring and one‑off. This creates duplicated flows and inconsistent defaults.
- TaskModal requires many fields; editing a single instance vs template adds extra cognitive load with a confirmation modal.

Guideline alignment
- Discoverability & clarity: multiple “add task” flows can be confusing and lead to redefining the same settings.
- Single focus: nested modals (edit confirm + TaskModal) can feel like repeated steps.

Recommendations
- Consolidate all task creation/editing into TaskModal only. Remove OneOffTaskModal or route it to TaskModal with preset defaults.
- Provide a compact “quick add” for one‑off tasks (title + date) with progressive disclosure for advanced options.
- When editing, default to the most likely scope (instance vs template) based on context, and clearly explain consequences.

---

## 3) Task Lists & Completion Flow
Files: `components/ChildColumn.tsx`, `components/TaskItem.tsx`, `components/TimedCountdown.tsx`

Observations
- Today’s tasks, upcoming scheduled, and inactive sections exist; “upcoming scheduled” entries appear similar to today entries and may feel like duplicates.
- Early completion flow prompts PIN in some cases; messaging varies.
- Timed tasks show Start/Stop; pending approvals show Approve/Forgive, but no “why” context is provided (e.g., late by X minutes).

Guideline alignment
- Visibility of system status: timed tasks could show remaining/overdue context more clearly.
- Safe actions & undo: completions are immediate with no undo; some flows use confirmation modals but not all.

Recommendations
- Clarify section labels: “Today”, “Scheduled (Next 7 Days)”, “Upcoming (Inactive)” to reduce duplication confusion.
- Add context to pending approvals (elapsed time vs allowed, late penalty) to help parents decide.
- Provide undo or “reopen task” affordance for recent completions.

---

## 4) Approvals & PIN Flow
Files: `components/modals/PinModal.tsx`, `components/modals/SettingsModal.tsx`, `components/TaskItem.tsx`, `components/ChildColumn.tsx`

Observations
- PIN modal is reused, but in some cases it opens without explicit context or pre‑validation messages.
- When no approvers exist, users see an alert but may not be guided to “Add Approver” directly.

Guideline alignment
- Error prevention/recovery: alerts are generic; missing direct path to fix.

Recommendations
- When no approvers exist, include a “Go to Settings” CTA in the alert and auto‑close current modal to avoid stacking.
- Standardize PIN prompt text by action type (complete, early complete, move, delete). Include summary of action.
- Ensure actor handle is always displayed in action log for PIN‑gated actions.

---

## 5) Settings Modal
Files: `components/modals/SettingsModal.tsx`

Observations
- Settings is dense; approver management, task list, and child management share the same surface.
- Some inline validations are present; toast feedback exists but is not consistently used across actions.

Guideline alignment
- Progressive disclosure: dense surface may overwhelm users.

Recommendations
- Split Settings into sections with collapsible panels or separate sub‑views (Approvers, Children, Tasks, Voice).
- Provide consistent success toasts for create/update/delete actions.

---

## 6) Action Log
Files: `components/modals/ActionLogModal.tsx`

Observations
- Action log is buried behind an icon button per child. Entries can be verbose and hard to scan.

Guideline alignment
- Discoverability: audit trails should be easy to find, especially for approvals.

Recommendations
- Add a global “Activity” entry in header or settings.
- Include filters (by child, by action type, approval‑only) and a compact list view.

---

## 7) Sync / Import / Export
Files: `components/modals/SyncModal.tsx`

Observations
- Sync modal uses QR/text export and manual import; no preview of what will be overwritten.

Guideline alignment
- Error prevention: importing should confirm destructive overwrite.

Recommendations
- Add a confirmation step summarizing counts (children, tasks, instances) before applying import.
- Offer “Merge” vs “Replace” options when importing.

---

## 8) Wallet / Payments
Files: `components/modals/WalletPayModal.tsx`, `components/Header.tsx`

Observations
- Wallet connect is in header and in payment modal. Two entry points can cause confusion about connection state.

Guideline alignment
- Consistency: wallet status should be centralized and clearly visible.

Recommendations
- Use header connection status as the single source of truth; payment modal should reference it and not re‑connect separately.
- Provide clear feedback on transaction status with non‑blocking toasts.

---

## 9) Child Management
Files: `components/modals/AddChildModal.tsx`, `components/modals/EditChildModal.tsx`, `components/ChildColumn.tsx`

Observations
- Add/Edit child actions exist in Settings and in child column; duplicates may be acceptable but can confuse.
- EditChildModal shows balances but not recent activity.

Guideline alignment
- Discoverability & clarity: duplicates should be consistent and clearly labeled.

Recommendations
- Ensure Add Child is a single primary CTA (header or FAB) and other entry points route to it.
- Consider showing recent approvals or tasks in EditChildModal for context.

---

## 10) Accessibility (WCAG 2.1 AA)
Files: Global UI, modals, buttons, forms

Observations
- Many controls use icons with text; good, but focus management and ARIA labels need verification.
- Modal focus trapping and keyboard navigation are not explicitly handled.
- Color‑only indicators (overdue, status) may fail AA without text alternatives.

Recommendations
- Add focus traps in modals; ensure ESC closes and focus returns to trigger.
- Ensure all interactive elements have clear labels and visible focus states.
- Provide text labels for overdue/late states (not just color/icon).

---

## 11) Single Focus & Modality
Files: all modals + TourGuide

Observations
- Many flows open modals from modals. Some logic closes previous modals, but not guaranteed everywhere.

Recommendations
- Centralize modal management so only one primary modal can be open at a time. Use a modal stack manager or enforce close‑before‑open in a single context provider.

---

# Required UX Testing (Not Performed Yet)

Per guidelines, before UX changes are signed off, we must:
1) Clear localStorage, reload, wait for welcome dialog.
2) Step through the entire tutorial, capturing snapshots after each action and verifying overlay state, CTA visibility, and console errors.
3) If any issue appears, stop, fix, restart from step 1.

This has NOT been executed in this notes‑only pass.


---

# UX Testing Session (Partial, Stopped Per Guidelines)

Session date: 2026-01-28
Status: STOPPED (per testing rules)

Steps executed
1) localStorage cleared via DevTools; page reloaded.
2) Tour appeared (Step 1 Welcome). Snapshot captured. Console shows 404 for a resource + form field id/name issues.
3) Step 1 -> Open Settings. Snapshot captured. Settings modal opened with Tour Step 2.
4) Approver entry: typing PIN/Confirm caused handle field to change unexpectedly (handle became "Dad1234" when entering PIN). Indicates possible input focus/field association issue. Snapshot captured.
5) Clicking “Add Approver” initially produced validation error “PIN must be 4-12 digits” despite 4-digit input. After clearing and re-entering, Add Approver succeeded and Settings modal closed; tour advanced to Step 3.
6) Step 3 -> Open Add Child. Snapshot captured with Add Child modal + Tour Step 4.
7) Entered child name “Ava” and clicked “Add”. Snapshot captured. **Modal did NOT close and tour did NOT advance** (no visible confirmation). This violates required feedback and the tutorial progression.

Observed issues (must fix before continuing)
- Add Child action in tour step did not close modal or advance; no feedback shown. Likely event not firing or blocked by overlay.
- PIN inputs appear to affect the Handle field (unexpected concatenation). Indicates focus/label wiring problem or overlay interfering with input targeting.
- Console issues: “A form field element should have an id or name attribute (count: 12)” and password field not contained in a form (Chrome warning). These violate accessibility guidance and may affect input focus.

Per guidelines: walkthrough halted and must restart from localStorage.clear() after fixes.


---

# Additional UX Test Scenarios (Manual, Outside Tour)

Session date: 2026-01-28
Mode: Continued testing after tour failure (documented above)

## Scenario A: Add Child (Manual, outside tour)
Steps
- Clicked global “+ Add Child” button → Add Child modal opened.
- Entered name “Ava” and clicked Add.

Observations
- Modal closed and child column appeared. No confirmation toast.
- Console continues to report missing id/name attributes for form fields (accessibility).

Recommendations
- Add success toast or inline confirmation after child creation.
- Ensure all inputs have id/name and are inside a form (WCAG + Chrome warnings).

## Scenario B: Create Recurring Task (non‑timed)
Steps
- Opened “+ Add Chore” → TaskModal opened.
- Filled Title “Clean Room”, Emoji, rewards, selected child.
- Clicked Create.

Observations
- Task appears in Today’s list and Scheduled list for next days; duplication is visually heavy.
- No confirmation toast on create.

Recommendations
- Clarify separation between “Today” and “Scheduled” to avoid perceived duplicates.
- Add confirmation feedback after Create.

## Scenario C: Complete Task
Steps
- Clicked Complete on “Clean Room” (today).

Observations
- Stars/Money updated; task moved to completed list.
- No undo or confirmation toast.

Recommendations
- Add “Undo” for recent completions (Nielsen error recovery).
- Provide success toast or inline feedback.

## Scenario D: Action Log
Steps
- Opened Action Log from child column.

Observations
- Shows raw JSON blob; hard to scan. Author attribution not shown if absent.

Recommendations
- Provide structured summary (action + actor + result) with expandable payload details.

## Scenario E: Timed Task Creation + Start/Stop + Approval
Steps
- Created “Timed Dishes” with timed checkbox.
- Started timer, then immediately stopped.
- Expanded completed list and approved pending timed completion via PIN.

Observations
- Timer countdown not visible in a11y snapshot during running (may exist visually, but not exposed for accessibility).
- Timed completion appeared under “Completed” list as “Pending approval.”
- Date shown as “1/27” even though today is 1/28 (off‑by‑one display).
- After approval, completed timed task shows a disabled “Start” button instead of a clear “Done” state.
- Approval required PIN even though approvals toggles are off (implicit requirement for timed approvals).

Recommendations
- Expose timer countdown to screen readers; ensure it renders in accessibility tree.
- Show pending approvals in a dedicated “Pending approvals” section rather than within completed tasks.
- Fix date display for timed completions (off‑by‑one error).
- Replace disabled “Start” with a “Done” label for completed timed tasks.
- Clarify approval requirement for timed tasks in UI (why PIN is needed even if approvals are off).

## Scenario F: Delete Flow
Steps
- Clicked delete on scheduled task entry; delete modal opened.

Observations
- Modal provides 3 delete options; cancel works.

Recommendations
- None for flow, but consider an undo after delete or a “soft delete” fallback.

## Scenario G: Sync Export
Steps
- Opened Sync modal; generated QR.

Observations
- QR generated successfully; no size warning or indication of what’s included.

Recommendations
- Add summary counts (children/tasks/instances) before QR generation.
- Offer “Essential” vs “Full history” export choices.

