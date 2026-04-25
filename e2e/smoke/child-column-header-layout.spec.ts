import { expect, test } from '@playwright/test';
import { expectFamilyChoresApp, setAppState } from './helpers';

/** Every child column header action row and its buttons must sit inside the column box (no horizontal bleed). */
async function expectChildHeaderActionsContained(page: import('@playwright/test').Page) {
  const results = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('main.main-view .child-column'));
    const pad = 2;
    return cols.map((col, index) => {
      const colRect = col.getBoundingClientRect();
      const actions = col.querySelector('.child-header-actions');
      if (!actions) {
        return { index, ok: false, reason: 'missing .child-header-actions' };
      }
      const ar = actions.getBoundingClientRect();
      const actionsInColumn =
        ar.left >= colRect.left - pad &&
        ar.right <= colRect.right + pad &&
        ar.top >= colRect.top - pad &&
        ar.bottom <= colRect.bottom + pad;
      const buttons = Array.from(actions.querySelectorAll('button'));
      const buttonsInColumn = buttons.every((btn) => {
        const r = btn.getBoundingClientRect();
        return (
          r.left >= colRect.left - pad &&
          r.right <= colRect.right + pad &&
          r.top >= colRect.top - pad &&
          r.bottom <= colRect.bottom + pad
        );
      });
      const horizontalOverflow = Math.max(0, actions.scrollWidth - actions.clientWidth);
      return {
        index,
        ok: actionsInColumn && buttonsInColumn && horizontalOverflow <= 1,
        actionsInColumn,
        buttonsInColumn,
        horizontalOverflow,
        buttonCount: buttons.length,
        colWidth: Math.round(colRect.width),
      };
    });
  });

  expect(results.length, 'expected at least one child column').toBeGreaterThan(0);
  expect(results.every((r) => r.ok), JSON.stringify(results, null, 2)).toBe(true);
}

/** Task action controls should remain inside each task card (no clipped/overflowing controls). */
async function expectTaskActionControlsContained(page: import('@playwright/test').Page) {
  const results = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('main.main-view .task-item'));
    const pad = 2;
    return cards.map((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const actions = card.querySelector('.task-actions');
      if (!actions) return { index, ok: false, reason: 'missing .task-actions' };
      const ar = actions.getBoundingClientRect();
      const actionsInCard =
        ar.left >= cardRect.left - pad &&
        ar.right <= cardRect.right + pad &&
        ar.top >= cardRect.top - pad &&
        ar.bottom <= cardRect.bottom + pad;
      const buttons = Array.from(actions.querySelectorAll('button'));
      const buttonsInCard = buttons.every((btn) => {
        const r = btn.getBoundingClientRect();
        return (
          r.left >= cardRect.left - pad &&
          r.right <= cardRect.right + pad &&
          r.top >= cardRect.top - pad &&
          r.bottom <= cardRect.bottom + pad
        );
      });
      const actionOverflow = Math.max(0, actions.scrollWidth - actions.clientWidth);
      const completeButton = actions.querySelector('.complete-btn');
      const iconButtons = Array.from(actions.querySelectorAll('.task-icon-btn'));
      const iconSizesOk = iconButtons.every((btn) => {
        const r = btn.getBoundingClientRect();
        return r.width <= 34 && r.height <= 34;
      });
      return {
        index,
        ok: actionsInCard && buttonsInCard && actionOverflow <= 1 && !!completeButton && iconButtons.length === 2 && iconSizesOk,
        actionsInCard,
        buttonsInCard,
        actionOverflow,
        completeButtonPresent: !!completeButton,
        iconButtonCount: iconButtons.length,
        iconSizesOk,
      };
    });
  });

  expect(results.length, 'expected at least one task card').toBeGreaterThan(0);
  expect(results.every((r) => r.ok), JSON.stringify(results, null, 2)).toBe(true);
}

test.describe('Smoke: child column header layout', () => {
  test('Edit / Pay / Wallet / Log stay inside the column at common viewport sizes', async ({ page }) => {
    const today = await page.evaluate(() => {
      const date = new Date();
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    });

    await setAppState(page, {
      children: [
        { id: 1, name: 'Alexandra', stars: 0, money: 0 },
        { id: 2, name: 'Benjamin', stars: 1, money: 2.5 },
        { id: 3, name: 'Christopher', stars: 0, money: 0 },
        { id: 4, name: 'Dominique', stars: 3, money: 0.75 },
      ],
      tasks: [
        {
          id: 'col_layout_chore',
          title: 'Quick tidy',
          createdAt: `${today}T08:00:00.000Z`,
          type: 'recurring',
          enabled: true,
          stars: 1,
          money: 0,
          assignedChildIds: [1, 2, 3, 4],
          assignment: { strategy: 'simultaneous', childIds: [1, 2, 3, 4], rotationStartDate: today },
          rotation: { mode: 'simultaneous', assignedChildIds: [1, 2, 3, 4], startDate: today },
          recurring: { cadence: 'daily', timeOfDay: '17:00' },
          schedule: {
            rule: { frequency: 'daily', interval: 1, startDate: today, startTime: '17:00' },
            dueTime: '17:00',
          },
        },
      ],
      taskInstances: [],
      parentSettings: {
        approvals: {
          taskMove: false,
          earlyComplete: false,
          taskComplete: false,
          editTasks: false,
        },
        childDisplayOrder: [1, 2, 3, 4],
        timedAutoApproveDefault: false,
        onboardingCompleted: true,
        pins: [],
      },
      completedTasks: {},
      timers: {},
      timedCompletions: [],
      actionLog: [],
    });

    await expectFamilyChoresApp(page);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expectChildHeaderActionsContained(page);
    await expectTaskActionControlsContained(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectChildHeaderActionsContained(page);
    await expectTaskActionControlsContained(page);

    await page.setViewportSize({ width: 360, height: 640 });
    await expectChildHeaderActionsContained(page);
    await expectTaskActionControlsContained(page);
  });
});
