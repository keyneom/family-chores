import { expect, test } from '@playwright/test';
import { APP_URL, expectFamilyChoresApp, setAppState } from './helpers';

test.describe('Smoke: linked rotation visibility', () => {
  test('linked rotation tasks stored in localStorage render in child task lists', async ({ page }) => {
    await page.goto(APP_URL);
    await expectFamilyChoresApp(page);

    const today = await page.evaluate(() => {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

    await setAppState(page, {
          children: [
            { id: 1, name: 'Ava', stars: 0, money: 0 },
            { id: 2, name: 'Ben', stars: 0, money: 0 },
            { id: 3, name: 'Noah', stars: 0, money: 0 },
            { id: 4, name: 'Mia', stars: 0, money: 0 },
          ],
          tasks: [
            {
              id: 'anchor_rotation',
              title: 'Anchor Rotation',
              createdAt: `${today}T08:00:00.000Z`,
              type: 'recurring',
              enabled: true,
              stars: 1,
              money: 0,
              assignedChildIds: [1, 2, 3],
              assignment: {
                strategy: 'round_robin',
                childIds: [1, 2, 3],
                rotationStartDate: today,
              },
              rotation: {
                mode: 'round-robin',
                assignedChildIds: [1, 2, 3],
                rotationOrder: [1, 3, 2],
                startDate: today,
              },
              recurring: { cadence: 'daily', timeOfDay: '17:00' },
              schedule: {
                rule: {
                  frequency: 'daily',
                  interval: 1,
                  startDate: today,
                  startTime: '17:00',
                },
                dueTime: '17:00',
              },
            },
            {
              id: 'linked_positive',
              title: 'Linked Positive Offset',
              createdAt: `${today}T08:05:00.000Z`,
              type: 'recurring',
              enabled: true,
              stars: 1,
              money: 0,
              assignedChildIds: [],
              assignment: {
                strategy: 'round_robin',
                childIds: [],
                rotationStartDate: today,
              },
              rotation: {
                mode: 'round-robin',
                assignedChildIds: [],
                linkedTaskId: 'anchor_rotation',
                linkedTaskOffset: 1,
                startDate: today,
              },
              recurring: { cadence: 'daily', timeOfDay: '17:00' },
              schedule: {
                rule: {
                  frequency: 'daily',
                  interval: 1,
                  startDate: today,
                  startTime: '17:00',
                },
                dueTime: '17:00',
              },
            },
            {
              id: 'linked_negative',
              title: 'Linked Negative Offset',
              createdAt: `${today}T08:10:00.000Z`,
              type: 'recurring',
              enabled: true,
              stars: 1,
              money: 0,
              assignedChildIds: [],
              assignment: {
                strategy: 'round_robin',
                childIds: [],
                rotationStartDate: today,
              },
              rotation: {
                mode: 'round-robin',
                assignedChildIds: [],
                linkedTaskId: 'anchor_rotation',
                linkedTaskOffset: -1,
                startDate: today,
              },
              recurring: { cadence: 'daily', timeOfDay: '17:00' },
              schedule: {
                rule: {
                  frequency: 'daily',
                  interval: 1,
                  startDate: today,
                  startTime: '17:00',
                },
                dueTime: '17:00',
              },
            },
          ],
          taskInstances: [],
          parentSettings: {
            approvals: { taskMove: false, earlyComplete: false, taskComplete: false, editTasks: false },
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

    await expect(page.locator('.task-item[data-task-title="Anchor Rotation"]').first()).toBeVisible();
    await expect(page.locator('.task-item[data-task-title="Linked Positive Offset"]').first()).toBeVisible();
    await expect(page.locator('.task-item[data-task-title="Linked Negative Offset"]').first()).toBeVisible();

    await expect(page.locator('[data-child-id="4"] .task-item[data-task-title]')).toHaveCount(0);
  });
});
