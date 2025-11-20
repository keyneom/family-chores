# 🏠 Family Chores Rotation App

A comprehensive family chore management system built with Next.js that automatically rotates tasks between children and tracks rewards.

## Features

### 📋 Core Functionality
- **Automatic Task Rotation**: Chores are automatically assigned to children using a date-based rotation algorithm
- **Reward System**: Track stars and money earned for completed tasks
- **Smart Scheduling**: Support for daily, weekly, monthly, weekdays, weekends, and custom day patterns
- **Task Completion**: Mark tasks complete to earn rewards and update child statistics
- **Payment System**: Pay out accumulated money rewards to children

### 👥 Family Management
- **Children Management**: Add, edit, and delete children with individual reward tracking
- **Chore Templates**: Create reusable chore templates with custom emojis, colors, and rewards
- **One-off Tasks**: Add special tasks for specific dates (any child, first-come, or all children)

### ⚙️ Advanced Features
- **Parent Controls**: PIN-protected settings and approval workflows
- **Data Persistence**: All data saved locally in browser storage
- **Responsive Design**: Works on desktop and mobile devices
- **Export/Import**: Sync data between devices using QR codes

## Getting Started

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

### Production Build
```bash
npm run build
npm run export
# 🏠 Family Chores Rotation App

A family chore management app built with Next.js. It supports recurring and timed tasks, parent-controlled approvals using named approvers, local persistence, and a simple on-chain payment integration for later stages. This README documents how to develop locally and includes a detailed contributor-facing backlog with task breakdowns, file pointers, and acceptance criteria so work can be picked up without extra clarification.

## Quick start

Development:
```bash
npm run dev
```
Open `http://localhost:3000`.

Production build:
```bash
npm run build
npm run export
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

## Current Implementation Details (for contributors)

- Approver model: `parentSettings.pins` is an array of approver entries: `{ handle, pinHash, salt }`. PINs are salted and hashed client-side with SubtleCrypto (`utils/pinUtils.ts`).
- Approval gating: parent settings under `state.parentSettings.approvals` control which actions require approval (move, earlyComplete, taskComplete, editTasks). When enabling an approval without any approvers defined, the UI prompts to create the first approver.
- Timed tasks: reducer handles `START_TIMER` and `STOP_TIMER` actions; `STOP_TIMER` computes elapsed seconds, reward percentage, adjusted stars/money, and creates `TimedCompletion` records. Approvals can be auto-applied per-task or by parent default.

## Backlog — Detailed Tasks & Owner-Ready Descriptions

The sections below are written for contributors: each item includes a short description, the files you will likely edit, acceptance criteria, and a rough estimate. Pick an item, create a branch `work/<short-task-name>`, and submit a PR against `master`.

### 1) Type `TaskModal` and `useTimer` (medium) — owner: frontend

- Goal: Remove remaining `any` and unused type imports, make `TaskModal` and `useTimer` strongly typed and consistent with `types/task.ts`.
- Files: `components/modals/TaskModal.tsx`, `components/hooks/useTimer.tsx` (or `components/hooks/useTimer.tsx`), `types/task.ts`.
- Acceptance criteria:
	- `TaskModal` props and internal state use explicit interfaces (no `any` or unchecked `as` casts where avoidable).
	- `useTimer` returns a typed object `{ start: () => void, stop: () => void, elapsedSeconds: number, isRunning: boolean }` and is used by `TaskItem` and `TimedCountdown` with correct types.
	- `npm run build` passes with no TypeScript errors and minimal lint warnings.
	- Add unit tests for the hook behavior (optional but preferred).
- Estimate: 3–6 hours

### 2) Onboarding / First-Run Guided Flow (large) — owner: UX/frontend

- Goal: Add an optional first-run flow that guides a parent through: creating an approver, adding a child, making a sample timed task, and optionally connecting a wallet. This will remove any need to explain the new approver model in the settings UI.
- Files: new `components/Onboarding/*`, `pages/_app.tsx` (or `components/Layout.tsx`) to trigger first-run modal; `docs/ONBOARDING.md` for copy.
- Acceptance criteria:
	- Runs automatically when no `choresAppState` is present in localStorage.
	- Steps (can be a modal wizard):
		1. Welcome + short explanation
		2. Create first approver (handle + 4-digit PIN) — must create `parentSettings.pins[0]`
		3. Add a child
		4. Create a timed task sample and demo Start/Stop
		5. Optionally connect wallet (or skip)
	- Each step persists progress and can be skipped/cancelled.
	- Final step adds an analytics/log entry (local only) marking onboarding complete.
- Estimate: 1–2 days

### 3) Timed Tasks — polish and tests (medium) — owner: frontend/backend

- Goal: Harden timed-task flows, ensure rewards/penalties are calculated consistently, add tests for reducer logic.
- Files: `components/ChoresAppContext.tsx`, `components/TaskItem.tsx`, `components/modals/TaskModal.tsx`, `types/task.ts`, `tests/reducer.timed.test.ts` (new).
- Acceptance criteria:
	- Reducer tests cover `START_TIMER`, `STOP_TIMER` (on-time, late, large-late causing negative money), and `APPROVE_TIMED_COMPLETION` (actorHandle recorded and applied correctly).
	- `TaskModal` UI shows `allowedMinutes`, `latePenaltyPercent`, and `autoApproveOnStop` options and they persist to task object.
	- No regressions in other task types.
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

- Goal: Add tests for core reducers and critical UI flows.
- Files: `tests/` (new), test harness config (Jest/Testing Library), `components/ChoresAppContext.test.ts`.
- Acceptance criteria:
	- Reducer unit tests for START/STOP timers, approvals, task add/update/delete.
	- Basic integration test for a child starting a timed task and parent approving it via `PinModal` (mock hashing).
- Estimate: 1–2 days

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
