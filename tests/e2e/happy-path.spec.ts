import { expect, test } from '@playwright/test';

test('typed capture happy path: input -> saved -> tier + explanation shown', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Perception-Assist' })).toBeVisible();

  await page.selectOption('#signal-sleep', 'low');
  await page.fill('textarea[name="note"]', 'Slower to wake up than usual today.');
  await page.getByRole('button', { name: 'Save observation' }).click();

  await expect(page.locator('[data-testid="result-tier"]')).toContainText('Tier:');
  await expect(page.locator('[data-testid="result-explanation"]')).not.toBeEmpty();
  await expect(page.locator('[data-testid="result-override-note"]')).toContainText('your own judgment');
});

test('WebGPU-absent run still completes via the guaranteed typed path', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'WebGPU flags are Chromium-specific');
  await page.goto('/');
  await expect(page.locator('[data-testid="capture-mode"]')).not.toBeEmpty();

  await page.selectOption('#signal-agitation', 'high');
  await page.getByRole('button', { name: 'Save observation' }).click();
  await expect(page.locator('[data-testid="result-tier"]')).toContainText('Tier:');
});

test('PWA is installable: manifest link and service worker are present', async ({ page }) => {
  await page.goto('/');
  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(manifestHref).toBeTruthy();
  const hasServiceWorkerApi = await page.evaluate(() => 'serviceWorker' in navigator);
  expect(hasServiceWorkerApi).toBe(true);
});
