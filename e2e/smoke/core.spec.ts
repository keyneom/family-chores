import { expect, test } from '@playwright/test';

async function resetState(page: import('@playwright/test').Page, disableTour = false) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  if (disableTour) {
    await page.evaluate(() => {
      localStorage.setItem(
        'choresAppState',
        JSON.stringify({
          children: [],
          tasks: [],
          taskInstances: [],
          parentSettings: {
            approvals: { taskMove: false, earlyComplete: false, taskComplete: false, editTasks: false },
            childDisplayOrder: [],
            timedAutoApproveDefault: false,
            onboardingCompleted: true,
            pins: [{ handle: 'Parent', pinHash: 'hash', salt: 'salt' }],
          },
          completedTasks: {},
          timers: {},
          timedCompletions: [],
          actionLog: [],
        }),
      );
    });
  }
  await page.goto('/');
}

async function skipTourIfVisible(page: import('@playwright/test').Page) {
  const skipButton = page.getByRole('button', { name: 'Skip Tour' });
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
  }
}

test.describe('Smoke: core flows', () => {
  test('onboarding appears in fresh state and can be skipped', async ({ page }) => {
    await resetState(page);
    await expect(page.getByText('Welcome to Family Chores')).toBeVisible();
    await page.getByRole('button', { name: 'Skip Tour' }).click();
    await expect(page.getByRole('button', { name: '⚙️ Settings' })).toBeVisible();
  });

  test('global add-child and add-task controls open correctly', async ({ page }) => {
    await resetState(page, true);

    await page.getByRole('button', { name: '+ Add Child' }).click();
    await expect(page.getByRole('heading', { name: 'Add Child' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: '+ Add Chore' }).click();
    await expect(page.getByRole('heading', { name: 'Create Task' })).toBeVisible();

    // Error/guard path: invalid cron keeps submit disabled.
    await page.getByLabel('Use advanced cron expression').check();
    await page.getByLabel('Cron Expression:').fill('not cron');
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  test('sync modal handles empty import as non-crashing error', async ({ page }) => {
    await resetState(page);
    await skipTourIfVisible(page);

    await page.getByRole('button', { name: '📱 Sync' }).click();
    await page.getByRole('button', { name: '✏️ Manual Entry' }).click();
    await page.getByRole('button', { name: 'Import Data' }).click();

    await expect(page.getByText('Please paste configuration data')).toBeVisible();
    await expect(page.getByRole('heading', { name: '📱 Sync Data' })).toBeVisible();
  });
});
