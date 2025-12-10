# 🏠 Family Chores Rotation App

A family chore management app built with Next.js. It supports recurring and timed tasks, parent-controlled approvals using named approvers, local persistence, and a simple on-chain payment integration for later stages. This README documents how to develop locally and includes a detailed contributor-facing backlog with task breakdowns, file pointers, and acceptance criteria so work can be picked up without extra clarification.

## Quick start

Development:
```bash
npm run dev
```
Open `http://localhost:3000/family-chores`.

Production build:
```bash
npm run build
```

## High-level features

- Automatic task rotation and assignment
- Reward tracking (stars + money)
- Timed tasks with Start/Stop flows and configurable late-penalties
- Parent-controlled approval flows (approver handles + PINs)
- Local persistence via `localStorage` (key: `choresAppState`)
- Optional on-chain payments (wallet connect using Wagmi; ETH/USDC)

## Developer Notes

- Codebase: Next.js + React + TypeScript
- Global state: `components/ChoresAppContext.tsx` (reducer + persistence)
- UI modals: `components/modals/*` (TaskModal, PinModal, SettingsModal, etc.)
- Types: `types/*.ts` (task, actionLog)
- Utilities: `utils/*` (e.g. `pinUtils.ts` for salt/hash)

## Project Rules

1. **Only one primary modal at a time.** Whenever the tutorial or any CTA opens a modal (Settings, Add Child, Add Task, Pin prompt, etc.), close any existing modal/overlay first so the actionable UI is fully visible and interactive.
2. **Verify each tutorial step visually.** After triggering a guided step, confirm via snapshot or manual inspection that all required controls are on-screen and unobstructed. If anything is hidden (e.g., overlapped by Shepherd, stuck behind another modal), treat it as a bug and fix it before continuing the flow.

## Architecture

The app uses a **unified Task system** where all tasks (recurring, one-off, timed) are represented by a single `Task` type with optional properties:

- **Single unified type**: All tasks are stored in the `tasks` array in state. There is no dual state management - the `tasks` array is the single source of truth.
- **Optional properties**: A task can have any combination of optional properties:
  - `timed?`: Timed task settings (allowed seconds, late penalty, auto-approve)
  - `recurring?`: Recurring task settings (cadence: daily, weekly, monthly, custom)
  - `oneOff?`: One-off task settings (due date)
- **Flexible combinations**: A task can be both recurring AND timed, or one-off AND timed, etc. All features are optional properties on the unified type.
- **Migration status**: The codebase is currently migrating from legacy `chores` and `oneOffTasks` arrays to the unified `tasks` array. Legacy state is still present but will be removed once migration is complete.

## Current Implementation Details (for contributors)

- Approver model: `parentSettings.pins` is an array of approver entries: `{ handle, pinHash, salt }`. PINs are salted and hashed client-side with SubtleCrypto (`utils/pinUtils.ts`).
- Approval gating: parent settings under `state.parentSettings.approvals` control which actions require approval (move, earlyComplete, taskComplete, editTasks). When enabling an approval without any approvers defined, the UI prompts to create the first approver.
- Timed tasks: reducer handles `START_TIMER` and `STOP_TIMER` actions; `STOP_TIMER` computes elapsed seconds, reward percentage, adjusted stars/money, and creates `TimedCompletion` records. Approvals can be auto-applied per-task or by parent default.
- Task deletion: `DeleteTaskModal` provides three deletion options: delete single instance, disable all future instances (sets `disabledAfter` date), or delete template entirely. The `disabledAfter` field prevents new instances from being generated after the specified date.
- Modal system: All modals use React Portals for proper stacking and include `stopPropagation` on close buttons to prevent overlay click-through issues.
- Onboarding: First-run guided flow (`OnboardingWizard`) automatically triggers when no approvers or children exist, guiding users through setup.

## Backlog — Detailed Tasks & Owner-Ready Descriptions

The sections below are written for contributors: each item includes a short description, the files you will likely edit, acceptance criteria, and a rough estimate. Pick an item, create a branch `work/<short-task-name>`, and submit a PR against `master`.

### 1) Type `TaskModal` and `useTimer` (medium) — owner: frontend

- Goal: Remove remaining `any` and unused type imports, make `TaskModal` and `useTimer` strongly typed and consistent with `types/task.ts`.
- Files: 
	- `components/modals/TaskModal.tsx` (lines 14-172): Remove `as unknown as` casts on lines 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 45, 61, 70; use explicit `Task` type from `types/task.ts`
	- `components/hooks/useTimer.tsx` (lines 1-49): Ensure return type matches interface, verify usage in `TaskItem.tsx` (line 75) and `TimedCountdown.tsx`
	- `types/task.ts`: Verify `Task` type is properly exported and used
- Acceptance criteria:
	- `TaskModal` props (`TaskModalProps` interface) and internal state use explicit interfaces (no `any` or unchecked `as` casts where avoidable)
	- All `as unknown as Record<string, unknown>` casts in `TaskModal.tsx` replaced with proper type guards or explicit interfaces
	- `useTimer` returns a typed object `{ activeTimer?: ActiveTimer, start: () => void, stop: () => void, canStopNow: boolean }` (matches current implementation) and is used by `TaskItem.tsx` (line 75) and `TimedCountdown.tsx` with correct types
	- `npm run build` passes with no TypeScript errors and minimal lint warnings
	- Add unit tests for the hook behavior (optional but preferred)
- Estimate: 3–6 hours

### 2) Onboarding / First-Run Guided Flow (large) — owner: UX/frontend ✅ COMPLETE

- Goal: Add an optional first-run flow that guides a parent through: creating an approver, adding a child, making a sample timed task, and optionally connecting a wallet. This will remove any need to explain the new approver model in the settings UI.
- Files: `components/Onboarding/OnboardingWizard.tsx`, `components/Layout.tsx` (triggers first-run modal).
- Acceptance criteria:
	- ✅ Runs automatically when no approvers or children exist (checks `parentSettings.pins` and `children.length`)
	- ✅ Steps implemented as modal wizard:
		1. Welcome + short explanation
		2. Create first approver (handle + 4-digit PIN) — creates `parentSettings.pins[0]`
		3. Add a child
		4. Create a timed task sample and demo Start/Stop
		5. Optionally connect wallet (or skip)
	- ✅ Each step can be skipped/cancelled
	- ✅ Final step adds `ONBOARDING_COMPLETE` action log entry marking onboarding complete
- **Implementation Notes:**
	- Onboarding wizard is fully implemented and integrated into `Layout.tsx`
	- Automatically triggers when app detects no approvers or children
	- Uses `useChoresApp` context for state management
	- Wallet connection uses Wagmi hooks (`useAccount`, `useConnect`)
- Estimate: 1–2 days (completed)

### 3) Timed Tasks — polish and tests (medium) — owner: frontend/backend

- Goal: Harden timed-task flows, ensure rewards/penalties are calculated consistently, add tests for reducer logic.
- Files: 
	- `components/ChoresAppContext.tsx` (lines 311-402): Reducer logic for `START_TIMER`, `STOP_TIMER`, `APPROVE_TIMED_COMPLETION` actions
	- `components/TaskItem.tsx` (lines 87-145): Timed task completion flow, approval handling
	- `components/modals/TaskModal.tsx` (lines 147-162): Timed task configuration UI
	- `types/task.ts` (lines 23-32, 71-74): `TimedSettings` interface and `TaskTimed` type
	- `tests/reducer.timed.test.ts` (new): Test file for timed task reducer logic
- Acceptance criteria:
	- Reducer tests cover:
		- `START_TIMER` action creates timer in state (line 311-319)
		- `STOP_TIMER` calculates elapsed seconds, reward percentage, adjusted stars/money correctly (lines 330-401)
		- `STOP_TIMER` handles on-time completion (full reward), late completion (penalty applied), and large-late causing negative money
		- `APPROVE_TIMED_COMPLETION` records `actorHandle` correctly and applies rewards (lines 409-429)
	- `TaskModal` UI shows `allowedMinutes` (line 150), `latePenaltyPercent` (line 154), and `autoApproveOnStop` (line 158) options and they persist to task object's `timed` property
	- No regressions in other task types (recurring, one-off)
	- Test coverage for edge cases: timer stopped before 1 minute (canStopNow check), auto-approve vs manual approval flows
- Estimate: 6–10 hours

### 4) Multi-Approver UX & Security (medium) — owner: frontend/security

- Goal: Improve approver management UX and ensure secure handling of PINs.
- Files: `components/modals/SettingsModal.tsx`, `components/modals/PinModal.tsx`, `utils/pinUtils.ts`, `components/ChoresAppContext.tsx` (for action logging), `docs/TIMED_TASKS.md`.
- Acceptance criteria:
	- Settings UI supports adding/removing approvers; adding a second approver requires verification by an existing approver.
	- `PinModal` shows a chooser of handles and verifies PIN by hashing with the stored salt; on success returns the approver handle to the caller.
	- All stored PINs are salted + hashed; no plaintext PINs stored or logged.
	- `actionLog` entries that record approvals include `actorHandle`.
- Estimate: 4–8 hours

### 5) Action Log Export + Admin View (small) — owner: frontend

- Goal: Add a simple admin export to download recent action log entries as JSON/CSV.
- Files: `components/modals/ActionLogModal.tsx`, `components/ChoresAppContext.tsx` (ensure logs are serializable), `docs/AUDIT_LOG.md`.
- Acceptance criteria:
	- ActionLog modal displays `actorHandle` where present.
	- Export button downloads a JSON or CSV file containing recent entries (last 100 by default).
	- Export includes `actorHandle`, timestamps, action type, and payload.
- Estimate: 2–4 hours

### 6) Tests: Reducer + Integration (medium) — owner: testing

- Goal: Add tests for core reducers and critical UI flows. **Prerequisite**: Backlog item #10 (Test infrastructure setup) must be completed first.
- Files: 
	- `tests/` (new directory): Create test directory structure
	- Test harness config: `jest.config.js` (new), `tests/setup.ts` (new) - see backlog item #10
	- `components/ChoresAppContext.test.ts` (new): Reducer tests
	- `components/TaskItem.test.tsx` (new, optional): Component integration tests
- Acceptance criteria:
	- Test infrastructure set up (Jest + React Testing Library) - see backlog item #10
	- Reducer unit tests for:
		- `START_TIMER` action (`components/ChoresAppContext.tsx` lines 311-319)
		- `STOP_TIMER` action (lines 330-401) with various scenarios
		- `APPROVE_TIMED_COMPLETION` action (lines 409-429)
		- Task add/update/delete actions (`ADD_TASK`, `UPDATE_TASK` - lines 320-329)
		- Approval workflows with `actorHandle` tracking
	- Basic integration test for a child starting a timed task and parent approving it via `PinModal` (mock PIN hashing from `utils/pinUtils.ts`)
	- Tests run with `npm test` and pass
	- Optional: CI/CD integration runs tests on PR
- Estimate: 1–2 days (after prerequisite #10 is complete)

### 7) Docs: Onboarding + TIMED_TASKS + CONTRIBUTING (small) — owner: docs

- Goal: Add developer-friendly documentation for onboarding, timed-tasks, and contribution steps.
- Files: `docs/ONBOARDING.md`, `docs/TIMED_TASKS.md`, `README.md` (this file), `CONTRIBUTING.md` (new)
- Acceptance criteria:
	- Each doc contains clear steps, expected behaviors, and file pointers for implementers.
	- A short CONTRIBUTING guide explains branching, commit message style, and PR expectations.
- Estimate: 3–6 hours

### 8) Clean up legacy migration code (small) — owner: backend/frontend

- Goal: Remove or clearly gate any automatic legacy migration that creates approvers from old single-PIN fields. We prefer explicit user actions to create approvers.
- Files: `components/ChoresAppContext.tsx`, `components/modals/SyncModal.tsx`.
- Acceptance criteria:
	- No automatic migration turns legacy `parentSettings.pin` into approvers.
	- If legacy fields exist they are left untouched unless a migration tool is run manually.
- Estimate: 1–2 hours

### 9) Complete unified Task migration — single type with optional properties (large) — owner: backend/frontend

- Goal: Refactor to single unified `Task` interface where recurring/one-off/timed are optional properties, remove legacy state arrays (`chores` and `oneOffTasks`).
- Files: `types/task.ts`, `components/ChoresAppContext.tsx`, `components/TaskItem.tsx`, `components/ChildColumn.tsx`, `components/modals/TaskModal.tsx`, `utils/taskAssignment.ts`, `utils/choreScheduling.ts`, `components/modals/SyncModal.tsx`.
- Acceptance criteria:
	- `types/task.ts` defines single `Task` interface with optional `timed?`, `recurring?`, `oneOff?` properties (not a discriminated union)
	- `ChoresAppState` removes `chores` and `oneOffTasks` fields, keeps only `tasks` array
	- All components use only `tasks` array, no legacy normalization code
	- Reducer handles only unified tasks
	- Sync/export only exports `tasks` array
	- Migration path: On load, convert any legacy data to unified format, then save as unified
	- Remove all legacy normalization logic from `TaskItem.tsx` and `ChildColumn.tsx`
- Estimate: 2–3 days

### 10) Test infrastructure setup (medium) — owner: testing

- Goal: Set up testing infrastructure (Jest/Testing Library) as prerequisite for backlog item #6.
- Files: `package.json`, `jest.config.js` (new), `tests/setup.ts` (new), `.github/workflows/test.yml` (optional).
- Acceptance criteria:
	- Jest and React Testing Library installed and configured
	- Test script added to `package.json`: `npm test`
	- Basic test setup file with React Testing Library configuration
	- Can run `npm test` successfully (even with empty test files)
	- Optional: CI/CD workflow runs tests on PR
- Estimate: 4–6 hours

### 11) Remove TypeScript `any` types (medium) — owner: frontend

- Goal: Remove all `any` types and improve type safety across the codebase.
- Files: `utils/taskAssignment.ts` (line 37: `assignTaskToChild(task: any, ...)`), `types/actionLog.ts` (line 4: `payload?: any`), `components/modals/TaskModal.tsx` (multiple `as unknown as` casts), `components/TaskItem.tsx` (type normalization with `Record<string, unknown>`).
- Acceptance criteria:
	- `assignTaskToChild` uses proper `Task` type instead of `any`
	- `ActionLogEntry.payload` has proper type (consider union type or generic)
	- `TaskModal` uses explicit interfaces, no unchecked `as` casts
	- `TaskItem` normalization uses proper types instead of `Record<string, unknown>`
	- `npm run build` passes with no TypeScript errors
- Estimate: 4–8 hours

### 12) Missing documentation files (small) — owner: docs

- Goal: Create missing documentation files referenced in backlog items.
- Files: `docs/ONBOARDING.md` (new), `docs/TIMED_TASKS.md` (new), `docs/AUDIT_LOG.md` (new), `CONTRIBUTING.md` (new).
- Acceptance criteria:
	- `docs/ONBOARDING.md`: Documents onboarding flow implementation details
	- `docs/TIMED_TASKS.md`: Documents timed task flows, reward calculations, approval process
	- `docs/AUDIT_LOG.md`: Documents action log structure, export format, use cases
	- `CONTRIBUTING.md`: Explains branching (`work/<task-name>`), commit message style, PR expectations
	- Each doc contains clear steps, expected behaviors, and file pointers for implementers
- Estimate: 3–6 hours

### 13) Verify scheduling patterns and functional discrepancies (small) — owner: QA/frontend ✅ COMPLETE

- Goal: Verify all scheduling patterns work as documented and identify any functional discrepancies.
- Files: `utils/choreScheduling.ts`, `README.md`, `docs/SCHEDULING_VERIFICATION.md` (new).
- Acceptance criteria:
	- ✅ All scheduling patterns (daily, weekly, monthly, weekdays, weekends, custom-days) tested and verified
	- ✅ README accurately describes scheduling behavior (with minor documentation gaps noted)
	- ✅ Discrepancies documented: Weekly/monthly day determination not explicitly documented in README
	- ✅ Verification report created: `docs/SCHEDULING_VERIFICATION.md`
- **Findings:**
	- All patterns work correctly, all tests pass
	- Weekly/monthly tasks determine day based on task ID hash (deterministic but not user-selectable)
	- Monthly tasks run on "first occurrence" of day (e.g., first Monday), not specific date
	- Recommendation: Document day selection logic or add UI for explicit day selection
- Estimate: 2–4 hours (completed)

### 14) Calendar Feed Export & Sync (large) — owner: frontend

- Goal: Export task instances to iCal format for Google Calendar/Apple Calendar integration, with optional sync support for updates.
- Files: 
	- New `utils/icalExport.ts` for iCal generation
	- New `components/modals/CalendarExportModal.tsx` for export UI
	- Optional: `components/CalendarView.tsx` for in-app calendar view (fallback if sync is too complex)
- Acceptance criteria:
	- **Export functionality:**
		- Generate iCal (.ics) file from task instances
		- Include all children's tasks in a single calendar or separate calendars per child
		- Show task title, assigned child, due date/time, and rewards in description
		- Support recurring tasks (RRULE in iCal format)
		- Support one-off tasks with specific dates
		- Support timed tasks with duration
	- **Sync support (if feasible):**
		- Track exported calendar UIDs in state (e.g., `exportedCalendarUIDs: Record<string, string>`)
		- On re-export, compare existing UIDs to current instances:
			- Delete events for removed instances (send CANCELED status)
			- Add events for new instances
			- Update events for modified instances (delete old + create new, or use UPDATE if iCal supports)
		- Export includes all instances (not just today) for full calendar view
	- **Alternative: In-app calendar view (if sync is too complex):**
		- Monthly calendar view showing all children's tasks
		- Color-coded by child or task type
		- Click to view/edit task details
		- Filter by child, task type, or date range
- **Technical notes:**
	- **iCal format:** RFC 5545 standard, can be generated client-side
	- **Sync challenges:** Frontend-only app means no server to track sync state. Options:
		1. Store exported UIDs in localStorage and compare on re-export (works but requires user to re-import to calendar)
		2. Use iCal CANCELED status for deleted events (calendar apps should handle this)
		3. Generate new UIDs on each export and let calendar apps deduplicate (simpler but less clean)
	- **Recommendation:** Start with export-only (no sync), add sync if user feedback indicates need. If sync proves too complex, implement in-app calendar view instead.
- Estimate: 1–2 days (export only), 3–5 days (with sync), 2–3 days (in-app calendar view)

### 15) UI/UX Review & Fixes (medium) — owner: frontend/UX ✅ COMPLETE

- Goal: Fix critical UI bugs, improve accessibility, and ensure all components render correctly with proper labels and styling.
- **Action Button Labels**: ✅ Fixed - All action buttons now have clear text labels:
  - ✏️ Edit (was just icon)
  - 💵 Pay (was just icon, unclear)
  - 🌐 Wallet (was just icon, unclear)
  - 📝 Log (was just icon, unclear)
  - 🗑️ Delete (was just icon)
- **Modal Fixes**: ✅ All modals now properly handle click events and close correctly:
  - Added `e.stopPropagation()` to all modal close buttons to prevent overlay click-through
  - Converted `OneOffTaskModal` to use React Portals for proper stacking
  - All modals tested and verified to open/close correctly
- **Delete Task Functionality**: ✅ New `DeleteTaskModal` provides granular delete options:
  - Delete just this occurrence (single instance)
  - Delete all future occurrences (disables task after date)
  - Delete task template entirely (removes task completely)
  - Supports both recurring and one-off tasks
- Files: 
	- `components/ChildColumn.tsx`: Fix duplicate task instance generation bug
	- `components/ChildrenGrid.tsx`: Instance generation moved here (✅ completed)
	- `components/ChoresAppContext.tsx`: Add duplicate cleanup on state initialization, add duplicate check in ADD_TASK_INSTANCE reducer (✅ completed)
	- `components/Layout.tsx`: Add page title (✅ completed), fix button handlers (✅ completed - modal CSS fixed)
	- `components/modals/SettingsModal.tsx`: Add missing input labels (✅ completed), update "Add Chore" section to use unified Task system (✅ completed)
	- `components/modals/DeleteTaskModal.tsx`: New modal for granular task deletion (✅ completed)
	- `components/modals/*`: All modals updated with stopPropagation fixes (✅ completed)
	- `pages/_document.tsx`: Set page title (✅ completed)
	- `styles/globals.css`: Add `.modal-overlay` CSS for modals, delete options styling (✅ completed)
	- `types/task.ts`: Added `disabledAfter` field for future instance disabling (✅ completed)
	- `utils/taskInstanceGeneration.ts`: Respect `disabledAfter` when generating instances (✅ completed)
	- `public/script.js`, `public/styles.css`: Removed unused static files (✅ completed)
- Acceptance criteria:
	- **Critical Bug Fix:**
		- ✅ Instance generation moved from `ChildColumn` to `ChildrenGrid` (runs once, not per child)
		- ✅ Duplicate check added in `ADD_TASK_INSTANCE` reducer
		- ✅ Duplicate cleanup function added on app load (removes duplicates by ID and unique key)
		- ✅ Task instances no longer duplicate - each task appears once per child per date
	- **Page Title:**
		- ✅ Page has proper title "Family Chores" in `_document.tsx`
	- **Settings Modal:**
		- ✅ All inputs have proper labels (Stars reward, Money reward, Color picker)
		- ✅ "Add Chore" section uses unified Task system (creates Task with recurring property)
		- ✅ All form fields are accessible (proper `aria-label` or `<label>` elements)
	- **Button Functionality:**
		- ✅ Bottom right corner buttons ("+ Add Child" and "+ Add Chore") work correctly
		- ✅ "+ Add Chore" button opens `TaskModal` (unified task creation)
		- ✅ "Edit Child" button functionality tested and working
		- ✅ "Edit Task" button functionality tested and working
		- ✅ All buttons have proper tooltips or aria-labels
	- **Modal Functionality:**
		- ✅ All modals open and close correctly (Settings, Sync, Action Log, Edit Task, Add Child, Edit Child, One-Off Task, Wallet Pay, Confirmation, Alert, Delete Task)
		- ✅ Modal overlay click handling fixed (stopPropagation on close buttons)
		- ✅ Modal stacking issues resolved (React Portals used where needed)
	- **Task Deletion:**
		- ✅ DeleteTaskModal provides three deletion options
		- ✅ Single instance deletion works correctly
		- ✅ Future instance disabling works (sets `disabledAfter` date)
		- ✅ Template deletion removes task completely
	- **Accessibility:**
		- ✅ All interactive elements have proper ARIA labels
		- ✅ Form inputs are properly associated with labels
		- ✅ Buttons have descriptive text or aria-labels
		- Color contrast meets WCAG AA standards
	- **Visual Polish:**
		- ✅ Consistent spacing and styling across all modals
		- ✅ Proper visual hierarchy (headings, sections clearly separated)
		- ✅ Icons have proper alt text or aria-labels
		- ✅ Loading states are visually clear
	- **Testing:**
		- ✅ All modals systematically tested (open, display, close)
		- ✅ Delete task options tested (instance, future, template)
		- ✅ Alert modals tested (payment, settings, sync)
		- ✅ No console errors when interacting with UI
		- ✅ Visual regression testing shows consistent styling
- **Remaining Work:**
  - Visual design overhaul (see item #16) - UI appearance still needs modernization
  - Purple gradient background and overall polish deferred to visual design overhaul
- Estimate: 1–2 days (completed)

### 16) UI/UX Visual Design Overhaul (large) — owner: frontend/UX/design

- Goal: Modernize the visual design of the application to create a polished, professional, and visually appealing user interface.
- **Icon/Emoji Overuse Issues:**
  - ⚠️ **Too many icons/emojis throughout the UI** - should be optional and look good without them
  - ⚠️ **Unclear action buttons** - icons without labels are confusing:
    - 💵 (stack of money) - unclear what it does (Pay out cash)
    - 🌐 (wire sphere) - unclear what it does (Pay on blockchain)
    - ✏️ (pencil) - could be edit, but unclear context
    - 📝 (pencil over paper) - unclear difference from other pencil (View action log)
  - **Action Button Redesign Needed:**
    - All action buttons should have clear labels or tooltips that are always visible
    - Icons should be supplementary, not the primary means of communication
    - Users should be able to predict the outcome of clicking a button
    - Consider using text labels with optional icons, or icon+label combinations
    - Ensure actions are discoverable and self-explanatory
- Files:
  - `styles/globals.css`: Complete visual redesign
  - `components/Layout.tsx`: Update layout structure if needed
  - `components/ChildColumn.tsx`: Improve card styling
  - `components/TaskItem.tsx`: Enhance task card appearance
  - All modal components: Consistent modern styling
- Acceptance criteria:
  - **Color Scheme:**
    - Replace outdated purple gradient background with modern, clean design
    - Implement cohesive color palette (consider light/dark mode support)
    - Ensure proper color contrast for accessibility (WCAG AA)
  - **Typography:**
    - Consistent font sizing and weights
    - Improved line-height and spacing for readability
    - Clear visual hierarchy with headings
  - **Layout & Spacing:**
    - Consistent padding and margins throughout
    - Better use of whitespace
    - Improved card/column styling with modern shadows and borders
  - **Components:**
    - Modern button styles with consistent hover states
    - Improved task cards with better visual separation
    - Enhanced modal appearance
    - Better form input styling
  - **Visual Polish:**
    - Smooth transitions and animations
    - Consistent border-radius values
    - Modern shadow system
    - Professional, polished appearance overall
- **Design Considerations:**
  - Consider implementing a design system or component library
  - Ensure mobile responsiveness is maintained
  - Test across different screen sizes
  - Consider accessibility throughout (color contrast, focus states, etc.)
- Estimate: 3–5 days

## How to assign and pick up work

- Create a branch named `work/<short-task-name>` (e.g. `work/typed-taskmodal`).
- Add a short PR description linking the checklist items that you implement.
- If a task depends on another (e.g. tests depend on TaskModal typing), call it out in the PR description and request review from the relevant owner.

## Files of interest (quick pointer)
- Global state: `components/ChoresAppContext.tsx`
- Task UI: `components/TaskItem.tsx`, `components/modals/TaskModal.tsx`
- Approver UI: `components/modals/SettingsModal.tsx`, `components/modals/PinModal.tsx`
- Timer UI: `components/TimedCountdown.tsx`, `components/hooks/useTimer.tsx`
- Utilities: `utils/pinUtils.ts`, `utils/choreScheduling.ts`, `utils/taskAssignment.ts`

## Contributing

Open issues for major work, assign yourself, and follow the branch naming convention. For large changes, open a draft PR early so maintainers can provide feedback.

---

If you'd like, I can also create initial issue templates for the backlog items above and open draft PR branches for one or two of the higher-priority tasks (e.g. typing `TaskModal` and `useTimer`).
