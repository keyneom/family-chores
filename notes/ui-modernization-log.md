# UI modernization & readability log

## 2026-01-28 – Transparency and readability pass

### Problem
Modals, tour steps, and some controls appeared transparent or unreadable. UX guidelines require opaque surfaces and WCAG 2.1 AA contrast.

### CSS changes (globals.css)

1. **Modals**
   - `.modal-overlay .modal`: `background-color: #ffffff !important`, explicit `color: #1a1a1a`.
   - `.modal-content`: `background-color: #ffffff !important`, `color: #1a1a1a` (covers OnboardingWizard welcome dialog).
   - `.modal-header`, `.modal-body`, `.modal-footer`: `background` set with `!important` where needed; text `#1a1a1a` / `#262626`.
   - `.modal-body input, select, textarea`: `background: #ffffff !important`, solid border so form fields are never transparent.

2. **Shepherd (tour)**
   - `.shepherd-theme-custom .shepherd-content`: already had solid `#ffffff` and `#1a1a1a`; added rules for `p`, `span`, `div` inside content so all text is dark and readable.

3. **Buttons**
   - `.btn-icon-text` and `.btn-icon-text.btn-edit`: replaced `rgba(28, 28, 35, 0.72)` / `0.9` with solid `#404040` and hover `#262626` so icon+text buttons are opaque and readable.

4. **Drag handle**
   - `.drag-handle`: replaced `rgba(28, 28, 35, 0.35)` and `opacity: 0.6` with solid `#737373` and `opacity: 0.8`; hover `#525252` and `opacity: 1`.

5. **Tour popover (legacy)**
   - `.tour-popover`: `background: #ffffff !important`, `color: #1a1a1a`.

### Verification checklist (manual / browser)

**Always capture both an accessibility snapshot (browser_snapshot) and a viewport screenshot (browser_take_screenshot) at each key step** so visual appearance (opacity, contrast, layout) and structure (refs, labels) are both verified.

**2026-01-28 Browser run (cursor-browser-extension):** Full onboarding (localStorage cleared, reload) and modal verification on localhost:3000/family-chores. Screenshots + snapshots taken at: Welcome dialog; Step 2 (Settings + approver); Step 4 (Add Child); Step 5/6 (Create Task modal + Shepherd); Task Assignment step; Step 7 (Connect Wallet); main screen post-tour; Settings modal (standalone); Add Child modal (standalone). Modals and Shepherd steps rendered opaque and readable; single-focus overlap (Shepherd on top of Settings/Task) noted for future UX refinement.

- [ ] **Empty state (e.g. localhost:3001)**: Clear localStorage, reload, run full onboarding (welcome → approver → child → task → wallet). After each step: **screenshot + snapshot**; one modal at a time, CTAs visible, text readable, no console errors.
- [ ] **Populated state (e.g. localhost:3000)**: Open each modal type (Settings, Add Child, Edit Child, Task, Pin, Delete Task, Sync, Wallet Pay, Action Log, Alert, Confirmation, etc.). **Screenshot + snapshot** for each; confirm solid background and readable text.
- [ ] **Shepherd tour**: When tour is active, **screenshot + snapshot**; steps use solid white content and dark text; note single-focus overlap with Settings/Task modals.
- [ ] **Responsive**: **Screenshot + snapshot** at 375px and 768px for overflow and readability.

### Design tokens (design-tokens.css)

Legacy aliases used by globals.css are defined: `--surface`, `--text`, `--text-muted`, `--border`, `--radius-md`, etc., so no undefined variables for modals/cards.
