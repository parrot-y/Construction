import { test, expect, Page } from '@playwright/test';
import { login, apiGet, unwrap } from './helpers';

/**
 * CB5 — contractor master register UI: register a firm (KRA PIN + work
 * categories), approve it, then suspend it — all through the console.
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

const stamp = Date.now().toString().slice(-6);
const firmName = `Coastal Plumbing Works ${stamp}`;
const kraPin = `P${stamp}X`;
let firmId = '';

test.describe.serial('CB5 — contractor master register', () => {
  test.setTimeout(180_000);
  test('register a contractor firm via the console', async ({ page, request }) => {
    await uiLogin(page);
    await page.goto('/app/people/subcontractors');
    await page.getByTestId('subcontractors-tab-register').click();
    await expect(page.getByTestId('contractor-master-view')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('contractor-new').click();
    await page.getByTestId('contractor-form-name').fill(firmName);
    await page.getByTestId('contractor-form-kra').fill(kraPin);
    await page.getByTestId('contractor-form-categories').fill('PLUMBING, TILING');
    await page.getByTestId('contractor-save').click();

    const row = page.locator('tr', { hasText: firmName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Pending')).toBeVisible();
    await expect(row.getByText(kraPin)).toBeVisible();

    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const list = await apiGet(request, admin, `/api/v1/contractors?q=${encodeURIComponent(firmName)}`);
    const rows = unwrap(await list.json());
    const arr = rows.contractors ?? rows;
    firmId = arr[0]?.id;
    expect(firmId).toBeTruthy();
    expect(arr[0].approvalStatus).toBe('PENDING');
    expect(arr[0].workCategories).toEqual(['PLUMBING', 'TILING']);
  });

  test('approve then suspend the firm via the UI', async ({ page, request }) => {
    test.skip(!firmId, 'needs the firm from test 1');
    await uiLogin(page);
    await page.goto('/app/people/subcontractors');
    await page.getByTestId('subcontractors-tab-register').click();
    await expect(page.getByTestId('contractor-master-view')).toBeVisible({ timeout: 30_000 });

    const row = page.locator(`tr[data-testid="contractor-row-${firmId}"]`);
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Approve — AppDialog prompt collects the reason.
    await row.getByTestId(`contractor-approve-${firmId}`).click();
    await page.locator('#app-dialog-input').fill('Registration and insurance verified');
    await page.getByRole('button', { name: 'Approved', exact: true }).last().click();
    await expect(row.getByText('Approved')).toBeVisible({ timeout: 15_000 });

    // Suspend — same prompt flow.
    await row.getByTestId(`contractor-suspend-${firmId}`).click();
    await page.locator('#app-dialog-input').fill('Insurance certificate expired');
    await page.getByRole('button', { name: 'Suspended', exact: true }).last().click();
    await expect(row.getByText('Suspended')).toBeVisible({ timeout: 15_000 });

    // API proof of final state.
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const detail = await apiGet(request, admin, `/api/v1/contractors/${firmId}`);
    const body = unwrap(await detail.json());
    const firm = body.contractor ?? body;
    expect(firm.approvalStatus).toBe('SUSPENDED');
    expect(firm.statusReason).toBe('Insurance certificate expired');
  });
});
