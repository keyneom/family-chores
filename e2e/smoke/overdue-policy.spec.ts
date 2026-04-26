import { expect, test } from '@playwright/test';
import { expectFamilyChoresApp, setAppState } from './helpers';

test.describe('Smoke: overdue + carry-over policy', () => {
  test('open-claim exposes overdue chore and carry-over keeps unfinished task visible', async ({ page }) => {
    const today = await page.evaluate(() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });
    const yesterday = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });

    await setAppState(page, {
      children: [
        { id: 1, name: 'Ava', stars: 0, money: 0 },
        { id: 2, name: 'Ben', stars: 0, money: 0 },
      ],
      tasks: [
        {
          id: 'open_claim_task',
          title: 'Open Claim Dish Duty',
          createdAt: `${today}T08:00:00.000Z`,
          type: 'recurring',
          enabled: true,
          stars: 1,
          money: 2,
          assignedChildIds: [1],
          assignment: { strategy: 'single', childIds: [1], rotationStartDate: today },
          rotation: { mode: 'single-child', assignedChildIds: [1], startDate: today },
          overduePolicy: 'open_claim',
          schedule: {
            rule: { frequency: 'daily', interval: 1, startDate: today, startTime: '00:01' },
            dueTime: '00:01',
          },
          recurring: { cadence: 'daily', timeOfDay: '00:01' },
        },
        {
          id: 'carry_task',
          title: 'Carry Task Vacuum',
          createdAt: `${today}T08:00:00.000Z`,
          type: 'recurring',
          enabled: true,
          stars: 1,
          money: 1,
          assignedChildIds: [1],
          assignment: { strategy: 'single', childIds: [1], rotationStartDate: today },
          rotation: { mode: 'single-child', assignedChildIds: [1], startDate: today },
          carryOverPolicy: 'carry_until_complete',
          schedule: {
            rule: { frequency: 'daily', interval: 1, startDate: yesterday, startTime: '17:00' },
            dueTime: '17:00',
          },
          recurring: { cadence: 'daily', timeOfDay: '17:00' },
        },
      ],
      taskInstances: [
        {
          id: 'carry_inst',
          templateId: 'carry_task',
          childId: 1,
          date: yesterday,
          completed: false,
          createdAt: `${yesterday}T17:00:00.000Z`,
        },
      ],
      parentSettings: {
        approvals: { taskMove: false, earlyComplete: false, taskComplete: false, editTasks: false },
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

    await expect(page.locator('[data-child-id="2"] .task-item[data-task-title="Open Claim Dish Duty"]').first()).toBeVisible();
    await expect(page.locator('[data-child-id="1"] .task-item[data-task-title="Carry Task Vacuum"]').first()).toBeVisible();
  });
});

