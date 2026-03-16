import { expect, test } from '@playwright/test';
import { enterDemoMode } from './helpers';

test.describe.configure({ mode: 'parallel' });

test('navigates from explore into a user profile and follows them', async ({ page }) => {
  await enterDemoMode(page);

  await page.getByText('Explore').click();
  await page.getByText('Kai Tanaka').first().click();

  await expect(page.getByText('@kai_creates')).toBeVisible();
  await page.getByText('Follow', { exact: true }).click();
  await expect(page.getByText('Following', { exact: true })).toBeVisible();
});
