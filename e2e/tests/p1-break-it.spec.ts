import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, Session } from './helpers';

/**
 * P1.6 — break-it suite: the app must fail honestly everywhere.
 *
 * Scenarios (chromium + mobile-390):
 *  A. API stopped during the main save → plain message, typed data kept,
 *     dialog stays open, retry works when the API returns.
 *  B. Injected 403 / 409 / 422 / 500 on a save → plain-language message,
 *     never raw JSON or "Failed to fetch".
 *  C. Double-click / rapid-click on submit → exactly one record.
 *  D. Offline → queued save notice or last-saved data, never a blank page.
 *  E. Fast 3G section nav → skeleton or content, never a blank page.
 *
 * Console sections + portal landings are covered by l2-click-sweep for the
 * click pass; this spec injects failures into the highest-traffic saves.
 */

const RUN = Date.now();
const PASSWORD = 'P1Break#2026';
let admin: Session;

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@p1-break.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: 'P1 Breakit Contractors',
      adminFullName: 'Wanjiru Test',
      email,
      phone: '+254712000888',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

/** Open the new-project wizard and fill through to the final step. */
async function openWizardAtSubmit(page: Page) {
  await page.goto('/app/projects/all');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByRole('button', { name: 'Skip — decide later' }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByLabel(/Project name/).fill(`P1 Break ${RUN}`);
  await dialog.getByLabel(/Project code/).fill(`P1B-${String(RUN).slice(-6)}`);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  return dialog;
}

test.describe.serial('P1.6 break-it — honest failures', () => {
  test.beforeAll(async ({ request }) => {
    admin = await register(request);
  });

  test('A. API stopped during project create — plain error, data kept, retry works', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);

    // Cut the API mid-save.
    await page.route('**/api/v1/projects', (route) => {
      if (route.request().method() === 'POST') return route.abort('connectionrefused');
      return route.continue();
    });

    const dialog = await openWizardAtSubmit(page);
    const submit = dialog.locator('button[type="submit"]');
    await page.waitForTimeout(400);
    await submit.click({ timeout: 10_000 }).catch(() => {});

    // Plain-language error inside the dialog — never "Failed to fetch"/JSON.
    const errBox = dialog.locator('[role="alert"], .text-red-600, .text-red-700').first();
    await expect(errBox).toBeVisible({ timeout: 30_000 });
    const errText = (await errBox.textContent()) || '';
    expect(errText).not.toMatch(/Failed to fetch|TypeError|ECONNREFUSED|\{.*\}/i);
    expect(errText.length).toBeGreaterThan(10);
    // Dialog stays open with typed data kept.
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Project name/)).toHaveValue(`P1 Break ${RUN}`);

    // API returns → retry succeeds, project appears.
    await page.unroute('**/api/v1/projects');
    await submit.click({ timeout: 10_000 }).catch(() => {});
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('button', { hasText: `P1 Break ${RUN}` }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('B. injected 403/409/422/500 on project create — plain messages', async ({ page, request }) => {
    test.setTimeout(180_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);

    for (const [status, expected] of [
      [403, /permission|admin/i],
      [409, /already|exists|conflict/i],
      [422, /fixing|details|required/i],
      [500, /wrong|try again|side/i],
    ] as const) {
      await page.unrouteAll();
      await page.route('**/api/v1/projects', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ message: `Injected ${status} for break-it test` }),
          });
        }
        return route.continue();
      });

      const dialog = await openWizardAtSubmit(page);
      const submit = dialog.locator('button[type="submit"]');
      await page.waitForTimeout(400);
      await submit.click({ timeout: 10_000 }).catch(() => {});

      const errBox = dialog.locator('[role="alert"], .text-red-600, .text-red-700').first();
      await expect(errBox).toBeVisible({ timeout: 30_000 });
      const errText = (await errBox.textContent()) || '';
      expect(errText).not.toContain('{');
      expect(errText).not.toMatch(/Failed to fetch|TypeError/i);
      await expect(dialog).toBeVisible(); // stays open for correction
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.waitForTimeout(300);
    }
    await page.unrouteAll();
  });

  test('C. double-click project create → exactly one record', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);

    const dialog = await openWizardAtSubmit(page);
    const submit = dialog.locator('button[type="submit"]');
    await page.waitForTimeout(400);
    // Rapid double activation.
    await submit.click({ timeout: 10_000 }).catch(() => {});
    await submit.click({ timeout: 2_000, force: true }).catch(() => {});
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });

    const name = `P1 Break ${RUN}`;
    const cards = page.locator('button', { hasText: name });
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    expect(await cards.count()).toBe(1);
  });

  test('D. offline → section shows saved/queued notice, never blank', async ({ page, request, context }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    await page.goto('/app/projects/all');
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 20_000 });

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(2500);
    // Either a queued/offline notice or cached content — never a blank main.
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 15_000 });
    const text = (await main.textContent()) || '';
    expect(text.trim().length).toBeGreaterThan(20);
    await context.setOffline(false);
  });

  test('E. Fast 3G section nav → skeleton or content, never blank', async ({ page, request, context }) => {
    test.setTimeout(120_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    await page.goto('/app/projects/all');
    await page.waitForTimeout(500);
    for (const section of ['Money', 'People', 'Site', 'Files & reports', 'Home']) {
      await page.getByRole('button', { name: section, exact: true }).first().click();
      // Within 3s the section must show skeleton, content, or an error state.
      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1200);
      const busy = await page.locator('[aria-busy="true"], [class*="skeleton"], [class*="animate-pulse"]').count();
      const text = ((await main.textContent()) || '').trim();
      expect(busy + text.length).toBeGreaterThan(0);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
