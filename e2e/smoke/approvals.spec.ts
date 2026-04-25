import { expect, test } from '@playwright/test';
import { APP_URL, expectFamilyChoresApp, setAppState } from './helpers';

async function resetState(page: import('@playwright/test').Page, disableTour = false) {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  if (disableTour) {
    await setAppState(page, {
      children: [],
      tasks: [],
      taskInstances: [],
      parentSettings: {
        approvals: { taskMove: false, earlyComplete: false, taskComplete: false, editTasks: false },
        childDisplayOrder: [],
        timedAutoApproveDefault: false,
        onboardingCompleted: true,
        pins: [],
      },
      completedTasks: {},
      timers: {},
      timedCompletions: [],
      actionLog: [],
    });
    return;
  }
  await page.goto(APP_URL);
  await expectFamilyChoresApp(page);
}

test.describe('Smoke: approval settings', () => {
  test('approver can be added and approval setting saved', async ({ page }) => {
    await resetState(page, true);
    await expect(page.getByText('No children configured')).toBeVisible();

    await page.getByRole('button', { name: '⚙️ Settings' }).click();
    await expect(page.getByRole('heading', { name: '⚙️ Settings' })).toBeVisible();

    await page.getByPlaceholder('Handle (e.g. Dad)').fill('Mom');
    await page.getByPlaceholder('PIN (4-12 digits)').fill('1111');
    await page.getByPlaceholder('Confirm PIN').fill('1111');
    await page.getByRole('button', { name: 'Add Approver' }).click();
    await expect(page.getByText('Approver added')).toBeVisible();

    await page.getByLabel('Marking any task complete').check();
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByRole('button', { name: '⚙️ Settings' })).toBeVisible();
  });
});
