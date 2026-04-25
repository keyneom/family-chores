import { expect, type Page } from '@playwright/test';

export const APP_URL = 'http://localhost:3000/family-chores';

export async function expectFamilyChoresApp(page: Page) {
  expect(new URL(page.url()).pathname).toBe('/family-chores');
  await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
  await expect(page.locator('main.main-view .children-grid')).toBeVisible();
}

export async function setAppState(page: Page, state: unknown) {
  await page.goto(APP_URL);
  await page.evaluate((value) => {
    localStorage.setItem('choresAppState', JSON.stringify(value));
  }, state);
  await page.goto(APP_URL);
  await expectFamilyChoresApp(page);
}
