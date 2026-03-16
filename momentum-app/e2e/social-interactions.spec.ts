import { expect, test } from '@playwright/test';
import { enterDemoMode } from './helpers';

test.describe.configure({ mode: 'parallel' });

test('deep-links from notifications into a log and toggles the clap reaction', async ({ page }) => {
  await enterDemoMode(page);

  await page.getByText('Notifications').click();
  await page.getByText('Sarah Chen celebrated your log').first().click();

  await expect(page.getByText('Evening coding practice')).toBeVisible();
  await expect(page.getByText(/Clap \(5\)/)).toBeVisible();

  await page.getByText(/Clap \(5\)/).click();

  await expect(page.getByText(/Clapped \(6\)/)).toBeVisible();
  await expect(page.getByText('No comments yet. Be the first to celebrate this session!')).toBeVisible();
});
