import { expect, type Page } from '@playwright/test';

export async function enterDemoMode(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Momentum')).toBeVisible();
  await page.getByText('Explore in Demo Mode').click();
  await expect(page.getByText('Weekly Goal')).toBeVisible();
}

export async function openCreateLog(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport is unavailable');

  await page.mouse.click(viewport.width / 2, viewport.height - 85);
  await expect(page.getByText('Log a Session')).toBeVisible();
}
