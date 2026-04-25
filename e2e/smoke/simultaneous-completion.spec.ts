import { expect, test } from '@playwright/test';
import { expectFamilyChoresApp, setAppState } from './helpers';

test.describe('Smoke: simultaneous assignment completion', () => {
  test('completing for one child leaves the chore visible for other children until they complete', async ({
    page,
  }) => {
    const today = await page.evaluate(() => {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

    const taskTitle = 'Simultaneous Daily Chore';

    await setAppState(page, {
      children: [
        { id: 1, name: 'Ava', stars: 0, money: 0 },
        { id: 2, name: 'Ben', stars: 0, money: 0 },
      ],
      tasks: [
        {
          id: 'simul_everyone',
          title: taskTitle,
          createdAt: `${today}T08:00:00.000Z`,
          type: 'recurring',
          enabled: true,
          stars: 2,
          money: 0.25,
          assignedChildIds: [1, 2],
          assignment: {
            strategy: 'simultaneous',
            childIds: [1, 2],
            rotationStartDate: today,
          },
          rotation: {
            mode: 'simultaneous',
            assignedChildIds: [1, 2],
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
        approvals: {
          taskMove: false,
          earlyComplete: false,
          taskComplete: false,
          editTasks: false,
        },
        childDisplayOrder: [1, 2],
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

    const avaColumn = page.locator('[data-child-id="1"]');
    const benColumn = page.locator('[data-child-id="2"]');

    // Scope to Today's Tasks only — the same template also appears under Scheduled for future dates.
    const avaToday = avaColumn.locator('.tasks-list > .tasks-section').first();
    const benToday = benColumn.locator('.tasks-list > .tasks-section').first();

    const avaTodayChore = avaToday.locator(`.task-item[data-task-title="${taskTitle}"]`).first();
    const benTodayChore = benToday.locator(`.task-item[data-task-title="${taskTitle}"]`).first();

    await expect(avaTodayChore).toBeVisible();
    await expect(benTodayChore).toBeVisible();

    await avaTodayChore.locator('.complete-btn').click();

    await expect(
      avaColumn.locator('.child-stats .stat-item').first().locator('span').nth(1),
    ).toHaveText('2');

    await expect(benTodayChore).toBeVisible();
    await expect(benTodayChore.locator('.complete-btn')).toHaveText('Complete');

    await benTodayChore.locator('.complete-btn').click();

    await expect(
      benColumn.locator('.child-stats .stat-item').first().locator('span').nth(1),
    ).toHaveText('2');
    await expect(
      avaColumn.locator('.child-stats .stat-item').first().locator('span').nth(1),
    ).toHaveText('2');
  });
});
