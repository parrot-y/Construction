import { test, expect } from '@playwright/test';

/** A6 — landing copy fixes: spacing, real role count, mobile screenshot, SIMULATED notice. */
test('landing page copy and responsive screenshot', async ({ page }) => {
  await page.goto('/');
  const body = await page.locator('body').innerText();
  expect(body).toContain('no more "how is the project going?" calls');
  expect(body).not.toContain('no more"how');
  expect(body).toContain('SIMULATED');
  // Role count is derived from @construction/permissions Roles (19 entries).
  expect(body).toMatch(/19 roles covered/);
  // Screenshot choice follows viewport: mobile-sized image on small screens.
  const mobileImg = page.locator('img[alt="Console on a phone"]');
  const desktopImg = page.locator('img[alt="Contractor console on desktop"]');
  const vw = page.viewportSize()!.width;
  if (vw < 1024) {
    await expect(mobileImg).toBeVisible();
    await expect(desktopImg).toBeHidden();
  } else {
    await expect(desktopImg).toBeVisible();
    await expect(mobileImg).toBeHidden();
  }
});
