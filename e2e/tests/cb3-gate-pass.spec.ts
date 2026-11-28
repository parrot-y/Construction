import { test, expect, Page } from '@playwright/test';
import { login, apiGet, unwrap } from './helpers';

/**
 * CB3 — gate pass register UI: create a PENDING pass, authorize it, confirm
 * exit; verify status transitions and 409s on illegal repeats via API.
 * Runs on chromium and mobile-390.
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

const stamp = Date.now();
const driverName = `Driver Muthoka ${String(stamp).slice(-4)}`;
let passId = '';
let passNumber = '';

test.describe.serial('CB3 — gate pass register', () => {
  test('create a gate pass via the console', async ({ page, request }) => {
    await uiLogin(page);
    await page.goto('/app/money/gatepass');
    await expect(page.getByTestId('gate-pass-view')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('gate-pass-new').click();
    await page.getByTestId('gate-pass-form-issued-to').fill(driverName);
    await page.getByTestId('gate-pass-form-store').fill('Nairobi Main Store');
    await page.getByTestId('gate-pass-form-destination').fill('Kilimani Apartments site');
    await page.getByTestId('gate-pass-form-vehicle').fill('KDA 321Y');
    await page.getByTestId('gate-pass-item-desc-0').fill('Cement 50kg');
    await page.getByTestId('gate-pass-save').click();

    // Pass number + PENDING badge visible in the register.
    const row = page.locator('tr', { hasText: driverName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Pending')).toBeVisible();
    passNumber = (await row.locator('p.font-bold').first().textContent())?.trim() ?? '';
    expect(passNumber).toMatch(/^GATE-/);

    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const list = await apiGet(request, admin, `/api/v1/gate-passes?q=${encodeURIComponent(driverName)}`);
    const rows = unwrap(await list.json());
    const arr = rows.passes ?? rows;
    passId = arr[0]?.id;
    expect(passId).toBeTruthy();
    expect(arr[0].passNumber).toBe(passNumber);
  });

  test('authorize then confirm exit through the UI', async ({ page, request }) => {
    test.skip(!passId, 'needs the pass from test 1');
    await uiLogin(page);
    await page.goto('/app/money/gatepass');
    await expect(page.getByTestId('gate-pass-view')).toBeVisible({ timeout: 30_000 });

    const row = page.locator('tr', { hasText: passNumber });
    await expect(row.getByTestId(`gate-pass-authorize-${passId}`)).toBeVisible({ timeout: 15_000 });
    await row.getByTestId(`gate-pass-authorize-${passId}`).click();
    // AppDialog confirm
    await page.getByRole('button', { name: 'Authorize', exact: true }).last().click();
    await expect(row.getByText('Authorized')).toBeVisible({ timeout: 15_000 });

    await expect(row.getByTestId(`gate-pass-exit-${passId}`)).toBeVisible({ timeout: 10_000 });
    await row.getByTestId(`gate-pass-exit-${passId}`).click();
    await page.getByRole('button', { name: 'Confirm exit', exact: true }).last().click();
    await expect(row.getByText('Exited')).toBeVisible({ timeout: 15_000 });

    // API proof: illegal repeats 409.
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const reauth = await request.post(`${process.env.E2E_API_URL || 'http://localhost:4199'}/api/v1/gate-passes/${passId}/authorize`, {
      headers: { cookie: admin.cookie }, data: {},
    });
    expect(reauth.status()).toBe(409);
  });
});
