import { expect, test } from '@playwright/test';
import { enterDemoMode, openCreateLog } from './helpers';

test.describe.configure({ mode: 'parallel' });

test('creates and publishes a new log from the centered add button', async ({ page }) => {
  await enterDemoMode(page);
  await openCreateLog(page);

  await page.locator('input[placeholder="What session is this?"]').fill('Ship Playwright coverage');
  await page.locator('input[placeholder="What did you work on?"]').fill('Write demo-mode journeys');

  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 2 });
  await selects.nth(2).selectOption('30');
  await page.locator('input[type="checkbox"]').check();

  await page.getByText('Log It').click();

  await expect(page.getByText('Log a Session')).toBeHidden();
  await expect(page.getByText('Ship Playwright coverage')).toBeVisible();
});
