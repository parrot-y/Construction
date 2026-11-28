import { test, expect, Page } from '@playwright/test';

/**
 * P6 — web push. Real push needs a production SW + VAPID keys, so the
 * browser path is exercised only as far as dev mode allows: the Inbox
 * renders without a push toggle (unsupported), and the VAPID-key endpoint
 * answers through the vite proxy for authenticated sessions.
 */

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill('admin@apexbuilders.co.ke');
  await page.locator('#password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('P6 — web push degradation', () => {
  test('inbox renders cleanly without push UI in dev; vapid-key endpoint answers', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/home/dashboard');
    await page.getByRole('tab', { name: 'Inbox' }).click();
    await expect(page.getByText('Team Inbox')).toBeVisible({ timeout: 30_000 });
    // No service worker in dev → push unsupported → toggle must not render.
    for (const label of ['Enable notifications', 'Notifications on', 'Notifications blocked']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }

    const res = await page.request.get('/api/v1/push/vapid-key');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('publicKey');
  });
});
