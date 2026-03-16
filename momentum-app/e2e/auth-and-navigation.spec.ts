import { expect, test } from '@playwright/test';
import { enterDemoMode } from './helpers';

test.describe.configure({ mode: 'parallel' });

test('enters demo mode and navigates the primary tabs', async ({ page }) => {
  await enterDemoMode(page);

  await page.getByRole('tab', { name: /Explore/ }).click();
  await expect(page.getByText('Search people...')).toBeVisible();
  await expect(page.getByText('Character design practice')).toBeVisible();

  await page.getByRole('tab', { name: /Notifications/ }).click();
  await expect(page.getByText('Mark all as read')).toBeVisible();
  await expect(page.getByText('Sarah Chen celebrated your log').first()).toBeVisible();

  await page.getByRole('tab', { name: /Profile/ }).click();
  await expect(page.getByText('Demo User')).toBeVisible();
  await expect(page.getByText('Log History')).toBeVisible();

  await page.getByRole('tab', { name: /Home/ }).click();
  await expect(page.getByText('Morning coding session')).toBeVisible();
});
